import { 
  Injectable, 
  ConflictException, 
  UnauthorizedException, 
  ForbiddenException,
  Inject,
  InternalServerErrorException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../infra/prisma/prisma.service';
import { CacheService } from '../infra/cache/cache.service';
import { RegisterEmailDto } from './dto/register-email.dto';
import { AuthType } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
@Injectable()
export class AuthService {
  // 🛡️ Declaração explícita da propriedade para evitar o erro ts(2339)
  private readonly googleClient: OAuth2Client;
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    // O CacheService deve estar conectado a um Redis para escalabilidade
    private readonly cacheService: CacheService, 
  ) {
    // Inicialização do cliente Google com o ID do projeto
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  // =====================================
  // REGISTRO DE USUÁRIO (Atomic & Secure)
  // =====================================
  async registerWithEmail(dto: RegisterEmailDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      // 🔐 Anti-enumeração: Mensagem genérica
      throw new ConflictException('Não foi possível processar o cadastro.');
    }

    // 🔐 Argon2id: Mais seguro que bcrypt contra ataques de GPU/ASIC
    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
        },
      });

      await tx.authProvider.create({
        data: {
          provider: AuthType.EMAIL,
          providerId: normalizedEmail,
          userId: newUser.id,
        },
      });

      return newUser;
    });

    this.eventEmitter.emit('user.registered', { userId: user.id, email: user.email });

    return this.generateTokens(user.id);
  }

  // =====================================
  // LOGIN DE USUÁRIO (Anti-Timing & Sessions)
  // =====================================
  async loginWithEmail(dto: RegisterEmailDto, metadata?: any) {
    const email = dto.email.toLowerCase().trim();

    // 1️⃣ Busca otimizada
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        mfaEnabled: true,
      },
    });

    // 2️⃣ 🛡️ Proteção contra Timing Attack
    // Se o usuário não existe, comparamos contra um hash falso para que o tempo de resposta seja igual
    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$ZmFrZWhhc2g';
    const isPasswordValid = await argon2.verify(
      user?.passwordHash ?? dummyHash,
      dto.password,
    );

    if (!user || !isPasswordValid) {
      this.eventEmitter.emit('auth.login.failed', { email, metadata });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 3️⃣ Verificação de Status da Conta
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Esta conta está desativada ou suspensa.');
    }

    // 4️⃣ 🛡️ Verificação de MFA
    if (user.mfaEnabled) {
      const mfaToken = await this.jwtService.signAsync(
        { sub: user.id, scope: 'mfa_pending' },
        { expiresIn: '5m' }
      );
      return { requiresMfa: true, mfaToken };
    }

    // 5️⃣ Geração de Tokens e Persistência de Sessão
    const tokens = await this.generateTokens(user.id);

    // Salva a sessão no Redis para permitir Logout Remoto/Revogação
    await this.cacheService.set(
      `session:${user.id}:${tokens.refreshTokenId}`,
      true,
      60 * 60 * 24 * 7 // Exemplo: 7 dias
    );

    this.eventEmitter.emit('auth.login.success', { userId: user.id, metadata });

    return tokens;
  }

  // =====================================
  // UTILS: GERAÇÃO DE TOKENS (JWT + JTI)
  // =====================================
  private async generateTokens(userId: string) {
    // JTI (JWT ID) é essencial para identificar e revogar sessões específicas
    const refreshTokenId = crypto.randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId },
        { expiresIn: '15m' } // Access token curto
      ),
      this.jwtService.signAsync(
        { sub: userId, jti: refreshTokenId },
        { expiresIn: '7d' } // Refresh token longo
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      refreshTokenId,
    };
  }

  async refreshTokens(refreshToken: string) {
  try {
    // 1. Verifica se o token é válido e extrai o Payload (incluindo o JTI)
    const payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET, // Use sua chave de refresh
    });

    const userId = payload.sub;
    const jti = payload.jti; // O ID único deste token específico

    // 2. 🛡️ VERIFICAÇÃO NO REDIS: O token ainda é válido?
    const isSessionActive = await this.cacheService.get(`session:${userId}:${jti}`);
    
    if (!isSessionActive) {
      // Se o token não está no Redis, pode ser uma tentativa de reuso de um token já invalidado
      // Em sistemas de alta escala, isso dispara um alerta de segurança (Possível roubo de conta)
      throw new UnauthorizedException('Sessão expirada ou inválida');
    }

    // 3. 🛡️ INVALIDAÇÃO (ROTAÇÃO): Remove o token antigo do Redis imediatamente
    await this.cacheService.del(`session:${userId}:${jti}`);

    // 4. Gera o novo par de tokens
    const tokens = await this.generateTokens(userId);

    // 5. Salva o novo Refresh Token JTI no Redis
    await this.cacheService.set(
      `session:${userId}:${tokens.refreshTokenId}`,
      true,
      60 * 60 * 24 * 7 // 7 dias
    );

    return tokens;
  } catch (e) {
    throw new UnauthorizedException('Token de atualização inválido');
  }
}
// =====================================
  // LOGOUT SIMPLES (Sessão Atual)
  // =====================================
  async logout(userId: string, refreshToken: string) {
    try {
      // Decodificamos o token para pegar o JTI (ID da sessão)
      const payload = await this.jwtService.decode(refreshToken);
      
      if (payload && payload.jti) {
        await this.cacheService.del(`session:${userId}:${payload.jti}`);
      }
      
      return { success: true };
    } catch (e) {
      return { success: true }; // Retornamos sucesso mesmo se falhar para não dar pistas
    }
  }
/**
 * Revoga todas as sessões do usuário no Redis.
 * Em escala de bilhões, não iteramos sobre as chaves. 
 * Se o Redis estiver em Cluster, usamos padrões de chaves eficientes.
 */
async logoutAll(userId: string): Promise<{ success: boolean }> {
  try {
    // 1. Buscamos todas as chaves de sessão deste usuário específico
    // O padrão 'session:userId:*' isola apenas os dispositivos dele
    const pattern = `session:${userId}:*`;
    
    // 2. Comando para deletar múltiplas sessões (depende da implementação do CacheService)
    await this.cacheService.deleteByPattern(pattern);

    // 3. Emitir evento para auditoria (opcional mas recomendado para grandes produtos)
    this.eventEmitter.emit('auth.logout.all', { 
      userId, 
      timestamp: new Date() 
    });

    return { success: true };
  } catch (error) {
    // Em produção, use um Logger aqui em vez de console.log
    throw new InternalServerErrorException('Erro ao encerrar sessões');
  }
}
/**
 * Lógica de Autenticação via Telefone
 */
async requestPhoneOtp(phone: string) {
  // 1. Prevenção de Abuso: Rate limit específico por número no Redis
  const limitKey = `otp_limit:${phone}`;
  const attempts = await this.cacheService.get<number>(limitKey) || 0;
  if (attempts >= 3) throw new ForbiddenException('Muitas tentativas. Tente em 1 hora.');

  // 2. Gerar código aleatório de 6 dígitos
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 3. Salvar no Redis com expiração curta (5 minutos)
  await this.cacheService.set(`otp:${phone}`, otp, 300);
  await this.cacheService.set(limitKey, attempts + 1, 3600); // Bloqueio de 1h

  // 4. Disparar evento para o serviço de mensageria (Twilio/AWS SNS/Z-API)
  this.eventEmitter.emit('sms.send_otp', { phone, otp });

  return { message: 'Código enviado com sucesso' };
}

async verifyPhoneOtp(phone: string, code: string) {
  const savedOtp = await this.cacheService.get<string>(`otp:${phone}`);

  if (!savedOtp || savedOtp !== code) {
    throw new UnauthorizedException('Código inválido ou expirado');
  }

  // 5. Buscar ou Criar o usuário (Just-in-Time Provisioning)
  let user = await this.prisma.user.findFirst({ where: { phone } });

  if (!user) {
    user = await this.prisma.user.create({
      data: { phone, status: 'ACTIVE' }
    });
  }

  await this.cacheService.del(`otp:${phone}`); // Limpa OTP após uso
  return this.generateTokens(user.id);
}

// =====================================
  // LOGIN SOCIAL (GOOGLE)
  // =====================================
  async loginWithGoogle(idToken: string) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) throw new UnauthorizedException();

      const user = await this.prisma.user.upsert({
        where: { email: payload.email },
        update: {},
        create: { 
          email: payload.email, 
          status: 'ACTIVE',
          // Note: Se usar authProviders, crie-os aqui na transação
        },
      });

      return this.createSession(user.id);
    } catch (e) {
      throw new UnauthorizedException('Falha na autenticação Google');
    }
  }
}
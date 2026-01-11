import { 
  Injectable, 
  ConflictException, 
  UnauthorizedException, 
  ForbiddenException,
  InternalServerErrorException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OAuth2Client } from 'google-auth-library';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../infra/prisma/prisma.service';
import { CacheService } from '../infra/cache/cache.service';
import { RegisterEmailDto } from './dto/register-email.dto';
import { LoginEmailDto } from './dto/login-email.dto';
import { AuthType } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheService: CacheService, 
  ) {
    // Inicializa o cliente oficial do Google para validar ID Tokens
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  /**
   * REGISTRO DE USUÁRIO VIA EMAIL
   * Realiza a criação atômica do usuário e do seu provedor de autenticação.
   */
  async registerWithEmail(dto: RegisterEmailDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Verifica se o e-mail já existe em algum provedor de autenticação
    const existingProvider = await this.prisma.authProvider.findUnique({
      where: { providerId: normalizedEmail },
    });

    if (existingProvider) {
      throw new ConflictException('Este método de autenticação já está em uso.');
    }

    const passwordHash = await argon2.hash(dto.password);

    // Transação atômica: ou cria tudo ou nada
    const user = await this.prisma.$transaction(async (transaction) => {
      const newUser = await transaction.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
        },
      });

      await transaction.authProvider.create({
        data: {
          provider: AuthType.EMAIL,
          providerId: normalizedEmail,
          userId: newUser.id,
        },
      });

      return newUser;
    });

    this.eventEmitter.emit('user.registered', { userId: user.id, email: user.email });
    return this.createSession(user.id);
  }

  /**
   * LOGIN VIA EMAIL E SENHA
   * Inclui proteção contra ataques de tempo e verificação de MFA.
   */
  async loginWithEmail(dto: LoginEmailDto, metadata?: any) {
    const email = dto.email.toLowerCase().trim();

    // Busca o usuário através do provedor de autenticação
    const authProvider = await this.prisma.authProvider.findUnique({
      where: { providerId: email },
      include: { user: true },
    });

    const user = authProvider?.user;

    // Proteção contra Timing Attack: hashes constantes mesmo que o usuário não exista
    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$ZmFrZWhhc2g';
    const isPasswordValid = await argon2.verify(
      user?.passwordHash ?? dummyHash,
      dto.password,
    );

    if (!user || !isPasswordValid) {
      this.eventEmitter.emit('auth.login.failed', { email, metadata });
      throw new UnauthorizedException('Credenciais de acesso inválidas.');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Esta conta encontra-se suspensa ou desativada.');
    }

    // Fluxo de Segundo Fator de Autenticação (MFA)
    if (user.mfaEnabled) {
      const mfaToken = await this.jwtService.signAsync(
        { sub: user.id, scope: 'mfa_pending' },
        { expiresIn: '5m' }
      );
      return { requiresMfa: true, mfaToken };
    }

    return this.createSession(user.id, metadata);
  }

  /**
   * LOGIN VIA GOOGLE (OAuth2)
   * Valida o token do Google e provisiona o usuário automaticamente (JIT).
   */
  async loginWithGoogle(idToken: string) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) throw new UnauthorizedException('Token inválido.');

      // Tenta encontrar ou criar o usuário vinculado a este provedor
      const authProvider = await this.prisma.authProvider.findUnique({
        where: { providerId: payload.sub }, // ID único do Google
        include: { user: true },
      });

      let userId: string;

      if (!authProvider) {
        const newUser = await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({ data: { email: payload.email, status: 'ACTIVE' } });
          await tx.authProvider.create({
            data: { provider: AuthType.GOOGLE, providerId: payload.sub, userId: user.id },
          });
          return user;
        });
        userId = newUser.id;
      } else {
        userId = authProvider.user.id;
      }

      return this.createSession(userId);
    } catch (error) {
      throw new UnauthorizedException('Falha na autenticação com o provedor Google.');
    }
  }

  /**
   * SOLICITAÇÃO DE OTP (TELEFONE)
   * Gera um código de 6 dígitos e armazena no Redis com limite de tentativas.
   */
  async requestPhoneOtp(phone: string) {
    const limitKey = `otp_limit:${phone}`;
    const attempts = (await this.cacheService.get<number>(limitKey)) || 0;

    if (attempts >= 3) {
      throw new ForbiddenException('Limite de solicitações excedido. Tente novamente mais tarde.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Armazena o código por 5 minutos no cache
    await this.cacheService.set(`otp:${phone}`, otp, 300);
    await this.cacheService.set(limitKey, attempts + 1, 3600); // Bloqueio de 1h

    this.eventEmitter.emit('sms.send_otp', { phone, otp });
    return { success: true, message: 'Código de verificação enviado.' };
  }

  /**
   * VERIFICAÇÃO DE OTP E LOGIN
   * Valida o código e vincula o telefone ao AuthProvider.
   */
  async verifyPhoneOtp(phone: string, code: string) {
    const savedOtp = await this.cacheService.get<string>(`otp:${phone}`);

    if (!savedOtp || savedOtp !== code) {
      throw new UnauthorizedException('Código de verificação inválido ou expirado.');
    }

    // Busca o provedor de telefone
    const authProvider = await this.prisma.authProvider.findUnique({
      where: { providerId: phone },
      include: { user: true },
    });

    let userId: string;

    if (!authProvider) {
      // Cria novo usuário se for o primeiro acesso deste telefone
      const newUser = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { status: 'ACTIVE' } });
        await tx.authProvider.create({
          data: { provider: AuthType.PHONE, providerId: phone, userId: user.id },
        });
        return user;
      });
      userId = newUser.id;
    } else {
      userId = authProvider.user.id;
    }

    await this.cacheService.del(`otp:${phone}`);
    return this.createSession(userId);
  }

  /**
   * RENOVAÇÃO DE TOKENS (Refresh Token Rotation)
   */
  async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken);
      const isSessionActive = await this.cacheService.get(`session:${payload.sub}:${payload.jti}`);
      
      if (!isSessionActive) throw new UnauthorizedException('Sessão inexistente ou revogada.');

      // Invalida o token antigo (segurança contra reuso)
      await this.cacheService.del(`session:${payload.sub}:${payload.jti}`);
      
      return this.createSession(payload.sub);
    } catch (e) {
      throw new UnauthorizedException('Token de atualização inválido.');
    }
  }

  /**
   * LOGOUT DE SESSÃO ÚNICA
   */
  async logout(userId: string, refreshToken: string) {
    const payload = this.jwtService.decode(refreshToken) as any;
    if (payload?.jti) {
      await this.cacheService.del(`session:${userId}:${payload.jti}`);
    }
    return { success: true };
  }

  /**
   * LOGOUT DE TODAS AS SESSÕES (Botão de Pânico)
   */
  async logoutAll(userId: string) {
    await this.cacheService.deleteByPattern(`session:${userId}:*`);
    return { success: true };
  }

  // =====================================
  // MÉTODOS PRIVADOS DE SUPORTE
  // =====================================

  /**
   * CENTRALIZADOR DE CRIAÇÃO DE SESSÃO
   * Registra a sessão no Redis e emite eventos de sucesso.
   */
  private async createSession(userId: string, metadata?: any) {
    const tokens = await this.generateTokens(userId);

    // Persistência no Redis para controle total de revogação
    await this.cacheService.set(
      `session:${userId}:${tokens.refreshTokenId}`,
      true,
      60 * 60 * 24 * 7 // Validade de 7 dias
    );

    this.eventEmitter.emit('auth.login.success', { userId, metadata });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * GERADOR DE TOKENS JWT
   * Define um JTI (JWT ID) único para o Refresh Token.
   */
  private async generateTokens(userId: string) {
    const refreshTokenId = crypto.randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId },
        { expiresIn: '15m' }
      ),
      this.jwtService.signAsync(
        { sub: userId, jti: refreshTokenId },
        { expiresIn: '7d' }
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      refreshTokenId,
    };
  }
}
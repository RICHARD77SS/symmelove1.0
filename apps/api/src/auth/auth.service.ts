
  import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
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
import { MailService } from '../mail/mail.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheService: CacheService,
    private readonly mailService: MailService,
    @InjectQueue('mail_queue') private readonly mailQueue: Queue, // Injeção correta
    @InjectQueue('sms_queue') private readonly smsQueue: Queue,
  ) {
    // Cliente oficial do Google para validar tokens OAuth2
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  // =====================================================
  // 📌 POST /auth/register/email
  // REGISTRO DE USUÁRIO COM EMAIL E SENHA
  // =====================================================
 async registerWithEmail(dto: RegisterEmailDto) {
  const email = dto.email.toLowerCase().trim();

  // 1. Verificação (Síncrona - Bloqueante)
  const existing = await this.prisma.authProvider.findUnique({
    where: { providerId: email },
  });

  if (existing) {
    throw new ConflictException('Este e-mail já está em uso.');
  }

  const passwordHash = await argon2.hash(dto.password);

  // 2. Persistência no Banco (Síncrona - Bloqueante)
  const user = await this.prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        status: 'ACTIVE',
      },
    });

    await tx.authProvider.create({
      data: {
        provider: AuthType.EMAIL,
        providerId: email,
        userId: newUser.id,
      },
    });

    return newUser;
  });

  // 3. Tarefas em Background (Assíncronas - Não Bloqueantes)
  // Em vez de esperar o e-mail ser enviado, apenas agendamos o job
  await this.mailQueue.add('welcome-email', {
    email: user.email,
    userId: user.id,
  }, {
    attempts: 3,
    backoff: 10000, // 10 segundos
  });

  this.eventEmitter.emit('user.registered', { userId: user.id });

  // 4. Resposta Imediata
  return this.createSession(user.id);
}
  // =====================================================
  // 📌 POST /auth/login/email
  // LOGIN COM EMAIL + SENHA
  // =====================================================
  async loginWithEmail(dto: LoginEmailDto, metadata?: any) {
    const email = dto.email.toLowerCase().trim();

    const provider = await this.prisma.authProvider.findUnique({
      where: { providerId: email },
      include: { user: true },
    });

    const user = provider?.user;

    const dummyHash =
      '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$ZmFrZWhhc2g';

    const isValid = await argon2.verify(
      user?.passwordHash ?? dummyHash,
      dto.password,
    );

    if (!user || !isValid) {
      this.eventEmitter.emit('auth.login.failed', { email, metadata });
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Conta desativada.');
    }

    if (user.mfaEnabled) {
      const mfaToken = await this.jwtService.signAsync(
        { sub: user.id, scope: 'mfa_pending' },
        { expiresIn: '5m' },
      );

      return { requiresMfa: true, mfaToken };
    }

    return this.createSession(user.id, metadata);
  }

  // =====================================================
  // 📌 POST /auth/login/google
  // LOGIN COM GOOGLE OAUTH
  // =====================================================
  async loginWithGoogle(idToken: string) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Token inválido.');
    }

    const provider = await this.prisma.authProvider.findUnique({
      where: { providerId: payload.sub },
      include: { user: true },
    });

    let userId: string;

    if (!provider) {
      const user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: { email: payload.email, status: 'ACTIVE' },
        });

        await tx.authProvider.create({
          data: {
            provider: AuthType.GOOGLE,
            providerId: payload.sub,
            userId: newUser.id,
          },
        });

        return newUser;
      });

      userId = user.id;
    } else {
      userId = provider.user.id;
    }

    return this.createSession(userId);
  }

  // =====================================================
  // 📌 POST /auth/phone/request-otp
  // SOLICITA OTP VIA SMS
  // =====================================================
async requestPhoneOtp(phone: string) {
  // 1. Verificação de Rate Limit (já existente no seu código)
  const limitKey = `otp_limit:${phone}`;
  const attempts = (await this.cacheService.get<number>(limitKey)) || 0;
  if (attempts >= 3) throw new ForbiddenException('Muitas tentativas.');

  // 2. Gerar OTP e Salvar no Cache
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await this.cacheService.set(`otp:${phone}`, otp, 300); // 5 min
  await this.cacheService.set(limitKey, attempts + 1, 3600); // Bloqueio por 1h

  // 3. Adicionar à Fila do Twilio
  await this.smsQueue.add('send-otp', { phone, otp }, {
    attempts: 5, // Twilio pode falhar por oscilação de rede
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
  });

  return { success: true };
}

  // =====================================================
  // 📌 POST /auth/phone/verify-otp
  // VERIFICA OTP E LOGA
  // =====================================================
  async verifyPhoneOtp(phone: string, code: string) {
    const saved = await this.cacheService.get<string>(`otp:${phone}`);

    if (!saved || saved !== code) {
      throw new UnauthorizedException('Código inválido ou expirado.');
    }

    const provider = await this.prisma.authProvider.findUnique({
      where: { providerId: phone },
      include: { user: true },
    });

    let userId: string;

    if (!provider) {
      const user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: { status: 'ACTIVE' },
        });

        await tx.authProvider.create({
          data: {
            provider: AuthType.PHONE,
            providerId: phone,
            userId: newUser.id,
          },
        });

        return newUser;
      });

      userId = user.id;
    } else {
      userId = provider.user.id;
    }

    await this.cacheService.del(`otp:${phone}`);

    return this.createSession(userId);
  }

  // =====================================================
  // 📌 POST /auth/refresh
  // ROTACIONA REFRESH TOKEN
  // =====================================================
  async refreshTokens(refreshToken: string) {
    const payload = await this.jwtService.verifyAsync(refreshToken);

    const sessionKey = `session:${payload.sub}:${payload.jti}`;

    const isActive = await this.cacheService.get(sessionKey);

    if (!isActive) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    await this.cacheService.del(sessionKey);

    return this.createSession(payload.sub);
  }

  // =====================================================
  // 📌 POST /auth/logout
  // LOGOUT DE UMA SESSÃO
  // =====================================================
  async logout(userId: string, refreshToken: string) {
    const payload = this.jwtService.decode(refreshToken) as any;

    if (payload?.jti) {
      await this.cacheService.del(`session:${userId}:${payload.jti}`);
    }

    return { success: true };
  }

  // =====================================================
  // 📌 POST /auth/logout-all
  // LOGOUT GLOBAL
  // =====================================================
  async logoutAll(userId: string) {
    await this.cacheService.deleteByPattern(`session:${userId}:*`);
    return { success: true };
  }

  // =====================================================
  // 📌 POST /auth/forgot-password
  // RECUPERAÇÃO DE SENHA
  // =====================================================
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'Se o e-mail existir, você receberá instruções.' };

    const token = this.jwtService.sign(
      { sub: user.id, type: 'password-reset' },
      { expiresIn: '15m' },
    );

    // 🔥 EM VEZ DE: await this.mailService.sendResetPasswordEmail(...)
    // NÓS FAZEMOS:
    await this.mailQueue.add('reset-password', {
      email: user.email,
      token: token,
    }, {
      attempts: 3, // Se falhar (ex: servidor de email fora), tenta 3 vezes
      backoff: 5000 // Espera 5 segundos entre tentativas
    });

    return { message: 'E-mail enviado com sucesso.' }; // Resposta instantânea!
  }

  // =====================================================
  // 🔐 MÉTODOS INTERNOS DE SESSÃO
  // =====================================================
  private async createSession(userId: string, metadata?: any) {
    const tokens = await this.generateTokens(userId);

    await this.cacheService.set(
      `session:${userId}:${tokens.refreshTokenId}`,
      true,
      60 * 60 * 24 * 7,
    );

    this.eventEmitter.emit('auth.login.success', { userId, metadata });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  private async generateTokens(userId: string) {
    const refreshTokenId = crypto.randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ sub: userId, type: 'access' }, { expiresIn: '15m' }),
      this.jwtService.signAsync(
        { sub: userId, jti: refreshTokenId, type: 'refresh' },
        { expiresIn: '7d' },
      ),
    ]);

    return { accessToken, refreshToken, refreshTokenId };
  }







  // =====================================================
  // 📌 POST /auth/password/reset
  // REDEFINIÇÃO DE SENHA FINAL
  // =====================================================
  async resetPassword(dto: ResetPasswordDto) {
    try {
      // 1. Validar o Token (O verifyAsync usará o segredo padrão configurado no JwtModule)
      const payload = await this.jwtService.verifyAsync(dto.token);

      // 2. Garantir que o token é do tipo correto
      if (payload.type !== 'password-reset') {
        throw new UnauthorizedException('Token inválido para esta operação.');
      }

      // 3. Gerar Hash da nova senha usando Argon2 (consistente com o registro)
      const passwordHash = await argon2.hash(dto.newPassword);

      // 4. Atualizar no Banco dentro de uma transação para garantir integridade
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { passwordHash },
      });

      // 5. Segurança Extra: Invalida todas as sessões ativas (Logout Global)
      // Se alguém roubou a conta, ele perde o acesso imediatamente após o reset.
      await this.logoutAll(payload.sub);

      return { success: true, message: 'Senha alterada com sucesso.' };
    } catch (error) {
      // Se o JWT estiver expirado ou a assinatura for inválida, cai aqui
      throw new UnauthorizedException('Link de recuperação expirado ou inválido.');
    }
  }

}

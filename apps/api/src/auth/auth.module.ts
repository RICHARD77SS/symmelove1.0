import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MfaService } from './mfa.service';

import { PrismaModule } from '../infra/prisma/prisma.module';
import { InfraCacheModule } from '../infra/cache/cache.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    // 🔹 Carrega variáveis de ambiente (.env)
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 🔹 Prisma (banco)
    PrismaModule,

    // 🔹 Cache / Redis
    InfraCacheModule,
    CacheModule.register(),

    // 🔹 Eventos internos
    EventEmitterModule.forRoot(),

    // 🔹 Autenticação base
    PassportModule,
    MailModule,
    // 🔹 JWT com SECRET via .env
    JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService): JwtModuleOptions => {
    const secret = config.get<string>('auth.jwtAccessSecret');
    // Fazemos o cast para 'any' ou para o tipo esperado pelo JWT
    const expiresIn = config.get<string>('auth.accessTokenTtl') as any;

    if (!secret) {
      throw new Error('❌ JWT_ACCESS_SECRET não carregado no Namespace: auth');
    }

    return {
      secret,
      signOptions: {
        expiresIn: expiresIn || '15m',
      },
    };
  },
}),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy,
    MfaService,
  ],

  exports: [AuthService],
})
export class AuthModule {}

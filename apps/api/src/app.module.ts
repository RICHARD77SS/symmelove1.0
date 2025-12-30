// apps/api/src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infra/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { VerificationModule } from './modules/verification/verification.module';
import { AuthModule } from './auth/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';

// =====================================
// APP MODULE
// Ponto central da aplicação
// =====================================
@Module({
  imports: [
    // Carrega .env globalmente
    ConfigModule.forRoot({ isGlobal: true }),

    // Banco de dados
    PrismaModule,

    // Módulos de negócio
    UsersModule,
    VerificationModule,
    ThrottlerModule.forRoot([{
      ttl: 60000, // Janela de tempo: 60 segundos (1 minuto)
      limit: 10,  // Limite padrão global (segurança base)
    }]),
    AuthModule,
  ],
})
export class AppModule {}

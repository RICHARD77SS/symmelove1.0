import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Infra e Módulos
import { PrismaModule } from './infra/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { VerificationModule } from './modules/verification/verification.module';
import { AuthModule } from './auth/auth.module';
import authConfigProvider from './auth/auth.config.provider';

// Importe o seu provider de configuração (ajuste o caminho se necessário)

@Module({
  imports: [
    // 🌍 Configuração Global
    ConfigModule.forRoot({ 
      isGlobal: true, 
      load: [authConfigProvider], // 👈 CRUCIAL: Carrega o namespace 'auth'
      // No Docker, os caminhos devem ser relativos à raiz do container (/app)
      envFilePath: ['.env', 'apps/api/.env'], 
    }),
    
    // 📡 Eventos
    EventEmitterModule.forRoot({
      global: true,
    }),

    // 🗄️ Banco de Dados
    PrismaModule, 

    // 👥 Domínios
    UsersModule,
    VerificationModule,
    
    // 🛡️ Segurança (Rate Limit)
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 10,
    }]),
    
    // 🔑 Autenticação
    AuthModule,
  ],
})
export class AppModule {}
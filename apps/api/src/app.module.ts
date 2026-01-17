import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config'; // Adicione ConfigService
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';

import { PrismaModule } from './infra/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { VerificationModule } from './modules/verification/verification.module';
import { AuthModule } from './auth/auth.module';
import authConfigProvider from './auth/auth.config.provider';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'; // Importação correta
import { ProfilesModule } from './modules/profiles/profiles.module';

@Module({
  imports: [
    // 🌍 Configuração Global
    ConfigModule.forRoot({ 
      isGlobal: true, 
      load: [authConfigProvider],
      envFilePath: ['.env', 'apps/api/.env'], 
    }),
    
    // 📡 Eventos
    EventEmitterModule.forRoot({
      global: true,
    }),

    // 🗄️ Banco de Dados
    PrismaModule, 

    // 🛡️ Redis & Filas (Configuração Global)
    // Usamos useFactory para garantir que as variáveis de ambiente do ConfigModule estejam prontas
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST') || 'localhost',
          port: config.get<number>('REDIS_PORT') || 6379,
        },
      }),
    }),
// 1. Painel principal
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),

    // 2. Registro das filas com o adaptador BullMQ
    BullBoardModule.forFeature({
      name: 'mail_queue',
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'sms_queue',
      adapter: BullMQAdapter,
    }),
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
    ProfilesModule,
  ],
})
export class AppModule {}
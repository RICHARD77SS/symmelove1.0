// apps/api/src/infra/cache/cache.module.ts

import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { CacheService } from './cache.service';

@Global() // Torna o cache disponível em toda a aplicação sem precisar importar o módulo toda hora
@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: await redisStore({
          url: process.env.REDIS_URL || 'redis://localhost:6379',
          ttl: 600, // TTL padrão de 10 minutos para caches genéricos
        }),
      }),
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class InfraCacheModule {}
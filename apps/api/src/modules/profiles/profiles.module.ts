import { Module } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { InfraCacheModule } from '../../infra/cache/cache.module'; // 👈 Importe o seu módulo customizado

@Module({
  imports: [
    PrismaModule, 
    InfraCacheModule // 👈 Substitua o CacheModule nativo pelo seu que provê o CacheService
  ],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService], // Útil se outros módulos precisarem validar perfis
})
export class ProfilesModule {}
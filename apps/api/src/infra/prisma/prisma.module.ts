// apps/api/src/infra/prisma/prisma.module.ts

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * =====================================
 * PRISMA MODULE (GLOBAL)
 * =====================================
 *
 * Responsabilidades:
 * - Disponibilizar o PrismaService globalmente
 * - Evitar múltiplas instâncias do PrismaClient
 * - Garantir uma única conexão com o banco
 *
 * IMPORTANTE:
 * - Deve ser importado apenas UMA vez (AppModule)
 * - @Global() evita imports repetidos em outros módulos
 */
@Global()
@Module({
  providers: [
    PrismaService,
  ],
  exports: [
    PrismaService,
  ],
})
export class PrismaModule {}

// apps/api/src/infra/prisma/prisma.service.ts

import { INestApplication, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// =====================================
// PRISMA SERVICE
// Responsável por:
// - Conectar ao banco
// - Gerenciar lifecycle
// - Ser injetado em Services
// =====================================
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}


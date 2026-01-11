import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // 1. Criamos a pool de conexão do Postgres manualmente
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // 2. Criamos o adaptador do Prisma
    const adapter = new PrismaPg(pool);

    // 3. Passamos o adaptador para o super()
    // Isso ignora a necessidade de 'url' no construtor do Prisma
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ Conexão via Adapter-PG estabelecida com sucesso!');
    } catch (error:any) {
      console.error('❌ Erro no Adapter-PG:', error.message);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
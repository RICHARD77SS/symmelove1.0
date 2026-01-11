import * as dotenv from 'dotenv';
import * as path from 'path';

// RESOLUÇÃO DEFINITIVA: 
// Carregamos o .env manualmente e injetamos na força bruta
const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });

// Log de diagnóstico crítico
console.log('--- DIAGNÓSTICO DE AMBIENTE ---');
console.log('Arquivo .env em:', envPath);
console.log('DATABASE_URL encontrada?', !!process.env.DATABASE_URL);
console.log('-------------------------------');

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule,{
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Adicione isso para ver as requisições chegando:
  app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers recebidos:', JSON.stringify(req.headers, null, 2));
  next();
});

  await app.listen(3000, '0.0.0.0');
}
bootstrap();
// apps/api/src/main.ts


import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
 // Se estiver usando Fastify, a configuração é diferente.
  // Aqui assumimos o padrão (Express).
  const app = await NestFactory.create(AppModule);

  // 🛡️ SEGURANÇA: Habilitar Trust Proxy para obter o IP real do cliente
  // quando atrás de Load Balancers (Nginx, Cloudflare, etc).
  // Sem isso, o Rate Limit bloqueia o IP do servidor proxy.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1); // Confia no primeiro proxy

  // 🔒 Validação global dos DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove propriedades que não estão no DTO (Segurança contra injeção de dados)
      forbidNonWhitelisted: true, // Retorna erro se enviarem dados extras
      transform: true, // Transforma os dados para os tipos do DTO
    }),
  );
// Habilitar CORS (ajuste a origem conforme seu frontend)
  app.enableCors();
  
  await app.listen(3000);
}

bootstrap();

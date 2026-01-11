//src/auth/guards/jwt-auth.guard.ts

// apps/api/src/auth/guards/jwt-auth.guard.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info) {
    // O parâmetro 'info' contém o motivo da falha (ex: Token expirado, No auth token, etc)
    if (err || !user) {
      console.error('--- ERRO DE AUTENTICAÇÃO ---');
      console.error('Erro:', err);
      console.error('Info/Motivo:', info?.message); // AQUI ESTÁ O SEGREDO
      console.error('---------------------------');
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
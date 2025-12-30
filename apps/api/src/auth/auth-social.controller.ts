// apps/api/src/auth/auth-social.controller.ts

import { Body, Controller, Post } from '@nestjs/common';

/**
 * Controller para autenticação social
 * (Google, Apple, etc.)
 */
@Controller('auth')
export class AuthSocialController {
  // =====================================================
  // LOGIN / REGISTRO COM GOOGLE
  // POST /auth/login/google
  //
  // Fluxo futuro:
  // 1. Front envia token do Google
  // 2. Backend valida token com Google
  // 3. Cria ou encontra usuário
  // 4. Retorna tokens JWT
  // =====================================================
  @Post('login/google')
  async loginGoogle(@Body() body: { token: string }) {
    // implementação futura
    return { message: 'Google login not implemented yet' };
  }
}

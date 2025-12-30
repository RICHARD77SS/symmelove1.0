// apps/api/src/auth/auth-phone.controller.ts

import { Body, Controller, Post } from '@nestjs/common';

/**
 * Controller para autenticação via telefone
 * (SMS ou WhatsApp)
 */
@Controller('auth')
export class AuthPhoneController {
  // =====================================================
  // ENVIO DE CÓDIGO
  // POST /auth/phone/send
  //
  // Fluxo:
  // 1. Usuário envia número
  // 2. Backend gera código
  // 3. Envia via SMS/WhatsApp
  // =====================================================
  @Post('phone/send')
  async sendCode(@Body() body: { phone: string }) {
    return { message: 'Phone code not implemented yet' };
  }

  // =====================================================
  // CONFIRMAÇÃO DE CÓDIGO
  // POST /auth/phone/verify
  //
  // Fluxo:
  // 1. Usuário envia telefone + código
  // 2. Backend valida
  // 3. Cria ou autentica usuário
  // =====================================================
  @Post('phone/verify')
  async verifyCode(@Body() body: { phone: string; code: string }) {
    return { message: 'Phone verification not implemented yet' };
  }
}

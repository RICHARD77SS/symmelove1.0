// apps/api/src/identity/identity.controller.ts

import { Controller, Post, Body } from '@nestjs/common';

/**
 * Controller para verificação de identidade
 * (selfie, documento, biometria)
 */
@Controller('identity')
export class IdentityController {
  // =====================================================
  // INICIAR VERIFICAÇÃO
  // POST /identity/start
  //
  // Fluxo:
  // 1. Backend gera sessão
  // 2. Retorna link ou token
  // 3. Front abre câmera ou redireciona para mobile
  // =====================================================
  @Post('start')
  async startVerification() {
    return { message: 'Identity verification not implemented yet' };
  }

  // =====================================================
  // CALLBACK DA VERIFICAÇÃO
  // POST /identity/callback
  //
  // Fluxo:
  // 1. Serviço externo confirma identidade
  // 2. Backend atualiza verificationStatus
  // =====================================================
  @Post('callback')
  async verificationCallback(@Body() payload: any) {
    return { message: 'Callback not implemented yet' };
  }
}
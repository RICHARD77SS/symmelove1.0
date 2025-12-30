// apps/api/src/auth/auth.controller.ts

import { 
  Body, 
  Controller, 
  HttpCode, 
  HttpStatus, 
  Post, 
  UseGuards, 
  UsePipes, 
  ValidationPipe 
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterEmailDto } from './dto/register-email.dto';
import { LoginEmailDto } from './dto/login-email.dto';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

/**
 * Controller responsável pelos endpoints públicos de autenticação.
 * * 🛡️ SEGURANÇA (RATE LIMITING):
 * Utilizamos o ThrottlerGuard para prevenir ataques de força bruta.
 * Se o limite for excedido, a API retornará 429 Too Many Requests.
 */
@Controller('auth')
@UseGuards(ThrottlerGuard) // 👈 Ativa o escudo para este controller
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // =====================================================
  // REGISTRO COM EMAIL E SENHA
  // POST /auth/register/email
  // =====================================================
  /**
   * 🛡️ ANTI-SPAM DE CONTAS:
   * Limite: 3 tentativas por minuto por IP.
   * Motivo: Impede que bots criem milhares de contas falsas rapidamente,
   * o que poluiria o banco de dados e custaria dinheiro (se houver envio de email).
   */
  @Post('register/email')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 👈 3 reqs / 1 min
  @HttpCode(HttpStatus.CREATED)
  async registerWithEmail(@Body() dto: RegisterEmailDto) {
    return this.authService.registerWithEmail(dto);
  }

  // =====================================================
  // LOGIN COM EMAIL E SENHA
  // POST /auth/login/email
  // =====================================================
  /**
   * 🛡️ ANTI-BRUTE FORCE:
   * Limite: 5 tentativas por minuto por IP.
   * Motivo: Se um atacante tentar descobrir a senha de um usuário,
   * ele será bloqueado após 5 tentativas, tornando o ataque inviável.
   */
  @Post('login/email')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 👈 5 reqs / 1 min
  @HttpCode(HttpStatus.OK)
  async loginEmail(@Body() dto: LoginEmailDto) {
    return this.authService.loginEmail(dto);
  }
}

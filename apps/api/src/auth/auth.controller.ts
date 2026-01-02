// apps/api/src/auth/auth.controller.ts

import { 
  Body, 
  Controller, 
  HttpCode, 
  HttpStatus, 
  Post, 
  UseGuards, 
  Req 
} from '@nestjs/common';
import { Request } from 'express'; // Importação crucial para tipagem
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { RegisterEmailDto } from './dto/register-email.dto';
import { LoginEmailDto } from './dto/login-email.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RequestOtpDto, VerifyOtpDto } from './dto/phone-login.dto';

/**
 * Controller responsável pelos endpoints públicos de autenticação.
 * 🛡️ SEGURANÇA (RATE LIMITING):
 * Utilizamos o ThrottlerGuard para prevenir ataques de força bruta.
 */
@Controller('auth')
@UseGuards(ThrottlerGuard) 
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
  ) {}

  // =====================================================
  // REGISTRO COM EMAIL E SENHA
  // POST /auth/register/email
  // =====================================================
  /**
   * 🛡️ ANTI-SPAM DE CONTAS:
   * Limite: 3 tentativas por minuto por IP.
   */
  @Post('register/email')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) 
  @HttpCode(HttpStatus.CREATED)
  async registerWithEmail(@Body() dto: RegisterEmailDto) {
    // Nota: O método no service deve ser registerWithEmail
    return this.authService.registerWithEmail(dto);
  }

  // =====================================================
  // LOGIN COM EMAIL E SENHA
  // POST /auth/login/email
  // =====================================================
  /**
   * 🛡️ ANTI-BRUTE FORCE:
   * Limite: 5 tentativas por minuto por IP.
   */
  @Post('login/email')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async loginEmail(
    @Body() dto: LoginEmailDto,
    @Req() req: Request, // Extrai o objeto da requisição Express
  ) {
    // 🔍 Extração de Metadados para auditoria e segurança.
    // Em escala, isso permite disparar alertas de "Login em novo dispositivo/IP".
    const metadata = {
      ip: req.ip || req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] || 'unknown',
      attemptedAt: new Date(),
    };

    // Chamada ao método sênior que criamos anteriormente
    return this.authService.loginWithEmail(dto, metadata);
  }
/**
   * POST /auth/token/refresh
   * Gera um novo par de tokens (Access + Refresh) e invalida o refresh token anterior.
   * 🛡️ SEGURANÇA: Implementa Rotação de Tokens para detectar roubo de sessão.
   */
  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Protege contra spam de renovação
  async refresh(@Body() dto: RefreshTokenDto) {
    // O service agora valida se o token ainda existe no Redis antes de renovar
    return this.authService.refreshTokens(dto.refreshToken);
  }
  // =====================================================
  // LOGOUT SIMPLES (Sessão Atual)
  // =====================================================
  /**
   * POST /auth/logout
   * Revoga apenas o token que o usuário está enviando.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Body() dto: RefreshTokenDto) {
    // Passamos o ID do usuário e o JTI (ID do Refresh Token) para invalidar no Redis
    return this.authService.logout(req.user.sub, dto.refreshToken);
  }
/**
 * POST /auth/logout/all
 * 🛡️ Revoga TODAS as sessões ativas deste usuário em todos os dispositivos.
 * Útil para casos de suspeita de invasão ou quando o usuário altera a senha.
 */
@Post('logout/all')
@UseGuards(JwtAuthGuard) // 👈 Garante que só o dono da conta pode deslogar
@HttpCode(HttpStatus.OK)
async logoutAll(@Req() req: any) {
  // O sub (ID do usuário) vem do payload do JWT validado pelo Guard
  return this.authService.logoutAll(req.user.sub);
}

@Post('mfa/setup')
@UseGuards(JwtAuthGuard)
async setupMfa(@Req() req: any) {
  return this.mfaService.setupTotp(req.user.sub);
}

@Post('mfa/verify')
@UseGuards(JwtAuthGuard)
async verifyMfa(@Req() req: any, @Body('token') token: string) {
  return this.mfaService.verifyAndEnable(req.user.sub, token);
}
/**
 * POST /auth/login/phone/request
 * Solicita o envio do código SMS
 */
@Post('login/phone/request')
@Throttle({ default: { limit: 2, ttl: 60000 } }) // Máximo 2 SMS por minuto por IP
async requestOtp(@Body() dto: RequestOtpDto) {
  return this.authService.requestPhoneOtp(dto.phone);
}

/**
 * POST /auth/login/phone/verify
 * Valida o código e faz login
 */
@Post('login/phone/verify')
@HttpCode(HttpStatus.OK)
async verifyOtp(@Body() dto: VerifyOtpDto) {
  return this.authService.verifyPhoneOtp(dto.phone, dto.code);
}

/**
 * POST /auth/login/google
 * Autenticação via Google Social Login
 */
@Post('login/google')
@HttpCode(HttpStatus.OK)
async loginGoogle(@Body('idToken') idToken: string) {
  // Recebe o token gerado pelo SDK do Google no Mobile/Web
  return this.authService.loginWithGoogle(idToken);
}
}
import { 
  Body, 
  Controller, 
  HttpCode, 
  HttpStatus, 
  Post, 
  UseGuards, 
  Req,
  UnauthorizedException 
} from '@nestjs/common';
import { Request } from 'express';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterEmailDto } from './dto/register-email.dto';
import { LoginEmailDto } from './dto/login-email.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RequestOtpDto, VerifyOtpDto } from './dto/phone-login.dto';
import { MfaService } from './mfa.service';
import { ResetPasswordDto } from './dto/reset-password.dto';

/**
 * Controller de Autenticação Centralizado
 * Gerencia autenticação via Email, Google, Telefone, além de MFA e Recuperação.
 */
@Controller('auth')
@UseGuards(ThrottlerGuard) 
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
  ) {}

  /**
   * 🛡️ EXTRAÇÃO SEGURA DE ID
   * Normaliza o acesso ao ID do usuário independente do payload do JWT.
   */
  private extractUserId(req: any): string {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    
    if (!userId) {
      throw new UnauthorizedException(
        'Sessão inválida ou identificador não encontrado.'
      );
    }
    return userId;
  }

  // =====================================================
  // 1. REGISTRO E LOGIN TRADICIONAL (EMAIL)
  // =====================================================

  @Post('register/email')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) 
  @HttpCode(HttpStatus.CREATED)
  async registerWithEmail(@Body() dto: RegisterEmailDto) {
    return this.authService.registerWithEmail(dto);
  }

  @Post('login/email')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async loginEmail(@Body() dto: LoginEmailDto, @Req() req: Request) {
    const metadata = {
      ip: req.ip || req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] || 'unknown',
      attemptAt: new Date(),
    };
    return this.authService.loginWithEmail(dto, metadata);
  }

  // =====================================================
  // 2. GESTÃO DE SESSÃO (REFRESH E LOGOUT)
  // =====================================================

  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(this.extractUserId(req), dto.refreshToken);
  }

  @Post('logout/all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logoutAll(@Req() req: any) {
    return this.authService.logoutAll(this.extractUserId(req));
  }

  // =====================================================
  // 3. MULTI-FACTOR AUTHENTICATION (MFA)
  // =====================================================

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  async setupMfa(@Req() req: any) {
    return this.mfaService.setupTotp(this.extractUserId(req));
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  async verifyMfa(@Req() req: any, @Body('token') token: string) {
    return this.mfaService.verifyAndEnable(this.extractUserId(req), token);
  }

  // =====================================================
  // 4. MÉTODOS DE LOGIN ALTERNATIVOS (SMS/GOOGLE)
  // =====================================================

  @Post('login/phone/request')
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestPhoneOtp(dto.phone);
  }

  @Post('login/phone/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyPhoneOtp(dto.phone, dto.code);
  }

  @Post('login/google')
  @HttpCode(HttpStatus.OK)
  async loginGoogle(@Body('idToken') idToken: string) {
    return this.authService.loginWithGoogle(idToken);
  }

  // =====================================================
  // 5. RECUPERAÇÃO DE SENHA
  // =====================================================

  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 2, ttl: 3600000 } }) // Máximo 2 envios por hora por IP
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) 
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
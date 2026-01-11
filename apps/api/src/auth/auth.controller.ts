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

/**
 * Controller de Autenticação
 * Centraliza Registro, Login, Refresh Token e MFA.
 */
@Controller('auth')
@UseGuards(ThrottlerGuard) 
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
  ) {}

  /**
   * 🛡️ HELPER DE EXTRAÇÃO DE IDENTIDADE
   * Resolve o problema do 'undefined' no Prisma. Tenta capturar o ID 
   * independente se a Strategy retornar 'userId', 'id' ou 'sub'.
   */
  private extractUserId(req: any): string {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    
    if (!userId) {
      throw new UnauthorizedException(
        'Falha na identificação do usuário. O token pode estar malformado.'
      );
    }
    return userId;
  }

  // --- REGISTRO ---
  @Post('register/email')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) 
  @HttpCode(HttpStatus.CREATED)
  async registerWithEmail(@Body() dto: RegisterEmailDto) {
    return this.authService.registerWithEmail(dto);
  }

  // --- LOGIN ---
  @Post('login/email')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async loginEmail(@Body() dto: LoginEmailDto, @Req() req: Request) {
    const metadata = {
      ip: req.ip || req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] || 'unknown',
      attemptedAt: new Date(),
    };
    return this.authService.loginWithEmail(dto, metadata);
  }

  // --- RENOVAÇÃO DE SESSÃO ---
  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  // --- LOGOUT ---
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

  // --- MULTI-FACTOR AUTHENTICATION (MFA) ---
  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  async setupMfa(@Req() req: any) {
    // Agora o ID nunca chegará undefined ao Prisma
    return this.mfaService.setupTotp(this.extractUserId(req));
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  async verifyMfa(@Req() req: any, @Body('token') token: string) {
    return this.mfaService.verifyAndEnable(this.extractUserId(req), token);
  }

  // --- LOGIN SOCIAL / TELEFONE ---
  @Post('login/phone/request')
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestPhoneOtp(dto.phone);
  }

  @Post('login/phone/verify')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyPhoneOtp(dto.phone, dto.code);
  }

  @Post('login/google')
  async loginGoogle(@Body('idToken') idToken: string) {
    return this.authService.loginWithGoogle(idToken);
  }
}
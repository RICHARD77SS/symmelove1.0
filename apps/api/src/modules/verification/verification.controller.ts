// apps/api/src/modules/verification/verification.controller.ts

import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  // =====================================
  // INICIAR VERIFICAÇÃO
  // POST /verification/start
  // =====================================
  @UseGuards(JwtAuthGuard)
  @Post('start')
  start(
    @Req() req: any,
    @Body() body: { origin: 'WEB' | 'MOBILE' },
  ) {
    return this.verificationService.startVerification(
      req.user.userId,
      body.origin,
    );
  }
}

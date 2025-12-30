// apps/api/src/modules/verification/verification.module.ts

import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';

@Module({
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}

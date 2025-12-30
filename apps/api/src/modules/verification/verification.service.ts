// apps/api/src/modules/verification/verification.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class VerificationService {
  constructor(private prisma: PrismaService) {}

  // =====================================
  // INICIAR VERIFICAÇÃO
  // =====================================
  async startVerification(userId: string, origin: 'WEB' | 'MOBILE') {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: 'PENDING',
        verificationMeta: {
          origin,
          startedAt: new Date(),
        },
      },
    });
  }

  // =====================================
  // CONFIRMAR RESULTADO (WEBHOOK FUTURO)
  // =====================================
  async completeVerification(
    userId: string,
    status: 'VERIFIED' | 'REJECTED',
    meta?: any,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: status,
        verificationMeta: meta,
      },
    });
  }
}

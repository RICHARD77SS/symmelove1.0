import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../infra/prisma/prisma.service';
import * as speakeasy from 'speakeasy';

/**
 * Serviço responsável por:
 * - Configurar MFA (TOTP)
 * - Validar código
 * - Ativar MFA permanentemente
 *
 * Arquitetura:
 * - TOTP baseado em RFC 6238
 * - Compatível com Google Authenticator, Authy, Microsoft Authenticator
 */
@Injectable()
export class MfaService {
  constructor(private prisma: PrismaService) {}

  /**
   * PASSO 1 — Setup do MFA
   *
   * Gera o segredo TOTP e retorna a URL otpauth
   * ⚠️ O MFA ainda NÃO fica ativo aqui
   */
  async setupTotp(userId: string) {
    const secret = speakeasy.generateSecret({
      name: `SymmeLove:${userId}`, // Nome visível no app autenticador
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: secret.base32,
        mfaEnabled: false, // Segurança: só ativa após validação
      },
    });

    return {
      otpauthUrl: secret.otpauth_url, // QR Code no frontend
      base32: secret.base32,          // Backup manual
    };
  }

  /**
   * PASSO 2 — Verificação e ativação definitiva do MFA
   *
   * Valida o código TOTP enviado pelo usuário
   * Se válido → MFA é ativado permanentemente
   */
  async verifyAndEnable(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        mfaSecret: true, // ✅ Agora existe no schema
      },
    });

    if (!user?.mfaSecret) {
      throw new UnauthorizedException('MFA não configurado para este usuário');
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1, // tolerância de 30s (clock drift)
    });

    if (!verified) {
      throw new UnauthorizedException('Código MFA inválido');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
      },
    });

    return { success: true };
  }
}

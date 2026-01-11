import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { VerificationStatus } from '@prisma/client';

/**
 * UsersService (Enterprise Edition)
 * ---------------------------------
 * Camada de serviço ajustada para o Schema PostgreSQL com JSONB.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // =====================================================
  // PERFIL COMPLETO DO USUÁRIO LOGADO (DONO)
  // =====================================================
  /**
   * Retorna a identidade e todos os perfis vinculados ao dono da conta.
   * Inclui MFA status e metadados de verificação.
   */
  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,         // Relação 1:1
        desiredProfiles: true, // Relação 1:N
        providers: {           // Lista métodos de login (Email, Google, etc)
          select: {
            provider: true,
            providerId: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Mapeamento explícito para garantir que passwordHash e mfaSecret NUNCA vazem
    return {
      id: user.id,
      email: user.email,
      status: user.status,
      verificationStatus: user.verificationStatus,
      mfaEnabled: user.mfaEnabled,
      providers: user.providers,
      profile: user.profile,
      desiredProfiles: user.desiredProfiles,
      createdAt: user.createdAt,
    };
  }

  // =====================================================
  // PERFIL PÚBLICO (OUTROS USUÁRIOS)
  // =====================================================
  /**
   * Retorna apenas o necessário para exibição em buscas ou listas.
   * Filtra o JSONB 'core' para expor apenas dados públicos.
   */
  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        verificationStatus: true,
        profile: {
          select: {
            core: true, // Contém idade, gênero, localização via JSONB
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return {
      id: user.id,
      verificationStatus: user.verificationStatus,
      // Retorna apenas a parte 'core' do perfil real
      displayData: user.profile?.core ?? {},
    };
  }

  // =====================================================
  // DADOS SENSÍVEIS (USUÁRIOS VERIFICADOS)
  // =====================================================
  /**
   * Acesso restrito a dados sensíveis (email, metadados de verificação).
   * Exige que o perfil consultado tenha status 'VERIFIED'.
   */
  async getSensitiveProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        verificationStatus: true,
        verificationMeta: true, // Dados de score da IA/Verificação
        createdAt: true,
      }
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Regra de Negócio: Bloqueio de acesso se o alvo não for verificado
    if (user.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException(
        'Este perfil ainda não completou a verificação de identidade.',
      );
    }

    return user;
  }

  // =====================================================
  // GESTÃO DE STATUS (ADMIN/SISTEMA)
  // =====================================================
  /**
   * Atualiza o status do usuário (Bloqueio, Ativação).
   */
  async updateUserStatus(userId: string, status: 'ACTIVE' | 'BANNED' | 'SUSPENDED') {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  }
}
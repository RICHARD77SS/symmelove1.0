import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * UsersService
 * --------------
 * Responsável por TODA a lógica de leitura e manipulação
 * de dados relacionados a usuários.
 *
 * ⚠️ Regras importantes:
 * - Nunca retornar senha
 * - Dados sensíveis só para usuários verificados
 * - Separar perfil público, privado e sensível
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // =====================================================
  // PERFIL COMPLETO DO USUÁRIO LOGADO (DONO)
  // =====================================================
  /**
   * Retorna todas as informações do usuário autenticado.
   * Usado em: /users/me
   *
   * O ID vem EXCLUSIVAMENTE do JWT (evita IDOR).
   */
  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        desiredProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    /**
     * Nunca retorne campos sensíveis diretamente.
     * Caso existam no schema futuramente, use select.
     */
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      verificationStatus: user.verificationStatus,
      profile: user.profile,
      desiredProfile: user.desiredProfile,
      createdAt: user.createdAt,
    };
  }

  // =====================================================
  // PERFIL PÚBLICO (OUTROS USUÁRIOS)
  // =====================================================
  /**
   * Retorna apenas dados públicos de um usuário.
   * Usado em: /users/:id/public
   *
   * ⚠️ Nenhuma informação sensível é exposta aqui.
   */
  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return {
      id: user.id,
      profile: user.profile?.core ?? null,
      verificationStatus: user.verificationStatus,
    };
  }

  // =====================================================
  // DADOS SENSÍVEIS (SOMENTE USUÁRIOS VERIFICADOS)
  // =====================================================
  /**
   * Retorna dados sensíveis SOMENTE se o usuário estiver verificado.
   * Usado futuramente para recursos premium / privados.
   */
  async getSensitiveProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (user.verificationStatus !== 'VERIFIED') {
      throw new ForbiddenException(
        'Usuário não verificado para acessar estes dados',
      );
    }

    /**
     * Aqui você pode futuramente filtrar campos sensíveis:
     * documentos, telefone, endereço, etc.
     */
    return {
      id: user.id,
      email: user.email,
      verificationStatus: user.verificationStatus,
      createdAt: user.createdAt,
    };
  }
}

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CacheService } from '../../infra/cache/cache.service';
import { VerificationStatus } from '@prisma/client'; // UserStatus removido pois não existe no schema
import { UpdateMeDto } from './dto/update-me.dto';

// Criamos o tipo manualmente para garantir consistência no código
export type UserStatus = 'ACTIVE' | 'BANNED' | 'SUSPENDED' | 'DELETED';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  // =====================================================
  // 1. MEU PERFIL (USUÁRIO LOGADO) - COM CACHE
  // =====================================================
  async getMe(userId: string) {
    const cacheKey = `user:me:${userId}`;

    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        desiredProfiles: true,
        providers: {
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

    const response = {
      id: user.id,
      email: user.email,
      status: user.status as UserStatus, // Fazemos o cast para o nosso tipo
      verificationStatus: user.verificationStatus,
      mfaEnabled: user.mfaEnabled,
      providers: user.providers,
      profile: user.profile,
      desiredProfiles: user.desiredProfiles,
      createdAt: user.createdAt,
    };

    await this.cacheService.set(cacheKey, response, 300);
    return response;
  }

  // =====================================================
  // 2. ATUALIZAÇÃO DE PERFIL (DEEP MERGE)
  // =====================================================
async updateMe(userId: string, dto: UpdateMeDto) {
  const profile = await this.prisma.profile.findUnique({
    where: { userId },
  });

  // 1️⃣ Convertemos as instâncias do DTO em objetos literais puros
  // O spread operator {...dto.core} transforma a instância da classe em um Object
  const coreData = dto.core ? { ...dto.core } : undefined;
  const attributesData = dto.attributes ? { ...dto.attributes } : undefined;

  let updatedProfile;

  if (!profile) {
    updatedProfile = await this.prisma.profile.create({
      data: {
        userId,
        core: coreData ?? {},
        attributes: attributesData ?? {},
      },
    });
  } else {
    updatedProfile = await this.prisma.profile.update({
      where: { userId },
      data: {
        core: coreData
          ? { ...(profile.core as object), ...coreData }
          : undefined,

        attributes: attributesData
          ? { ...(profile.attributes as object), ...attributesData }
          : undefined,
      },
    });
  }

  await this.cacheService.del(`user:me:${userId}`);
  return updatedProfile;
}

  // =====================================================
  // 3. PERFIL PÚBLICO (FILTRADO)
  // =====================================================
  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        verificationStatus: true,
        profile: {
          select: {
            core: true,
          },
        },
      },
    });

    // Segurança: Não mostra perfis deletados ou banidos na busca
    if (!user || user.status !== 'ACTIVE') {
      throw new NotFoundException('Usuário não disponível');
    }

    return {
      id: user.id,
      verificationStatus: user.verificationStatus,
      displayData: user.profile?.core ?? {},
    };
  }

  // =====================================================
  // 4. DADOS SENSÍVEIS (PÓS-VERIFICAÇÃO)
  // =====================================================
  async getSensitiveProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        verificationStatus: true,
        verificationMeta: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (user.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException(
        'Este perfil ainda não completou a verificação de identidade.',
      );
    }

    return user;
  }

  // =====================================================
  // 5. GESTÃO DE CONTA (DESATIVAÇÃO / STATUS)
  // =====================================================
  async deleteMe(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'DELETED' },
    });

    await this.cacheService.del(`user:me:${userId}`);
    return { message: 'Conta desativada com sucesso' };
  }

  async updateUserStatus(userId: string, status: UserStatus) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });

    await this.cacheService.del(`user:me:${userId}`);
    return updated;
  }
}
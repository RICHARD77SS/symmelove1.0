// apps/api/src/modules/profiles/profiles.service.ts

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CacheService } from '../../infra/cache/cache.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private get ttl() {
    return Number(process.env.CACHE_PROFILE_TTL ?? 600);
  }

  /**
   * POST /v1/profiles
   */
  async createProfile(userId: string, dto: CreateProfileDto) {
    if (!userId) throw new BadRequestException('User ID não identificado.');

    const existing = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('Perfil já existe para este usuário.');
    }

    // Convertemos classes DTO para objetos literais para o Prisma
    const profile = await this.prisma.profile.create({
      data: {
        userId,
        core: dto.core ? { ...dto.core } : {},
        attributes: dto.attributes ? { ...dto.attributes } : {},
      },
    });

    await this.cache.del(`user:me:${userId}`);
    this.logger.log(`Profile created for user ${userId}`);

    return this.sanitize(profile);
  }

  /**
   * GET /v1/profiles/me
   */
  async getMyProfile(userId: string) {
    const cacheKey = `profile:me:${userId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    // Se o perfil for deletado ou não existir
    if (!profile || (profile as any).status === 'DELETED') {
      throw new NotFoundException('Perfil não encontrado ou inativo');
    }

    const sanitized = this.sanitize(profile);
    await this.cache.set(cacheKey, sanitized, this.ttl);

    return sanitized;
  }

  /**
   * PATCH /v1/profiles/me
   */
  async updateMyProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) throw new NotFoundException('Perfil não encontrado');

    // Deep Merge Manual para garantir persistência de dados JSONB
    const updated = await this.prisma.profile.update({
      where: { userId },
      data: {
        core: dto.core 
          ? { ...(profile.core as object), ...dto.core } 
          : undefined,
        attributes: dto.attributes 
          ? { ...(profile.attributes as object), ...dto.attributes } 
          : undefined,
      },
    });

    // Limpa caches para refletir mudança imediata
    await this.cache.del(`profile:me:${userId}`);
    await this.cache.del(`user:me:${userId}`);

    return this.sanitize(updated);
  }

  /**
   * DELETE /v1/profiles/me
   */
  async deleteMyProfile(userId: string) {
    try {
      await this.prisma.profile.update({
        where: { userId },
        data: {
          // Nota: Certifique-se que 'status' existe no seu model Profile
          // Caso contrário, use uma flag no model User
          ...( { status: 'DELETED', deletedAt: new Date() } as any )
        },
      });

      await this.cache.del(`profile:me:${userId}`);
      await this.cache.del(`user:me:${userId}`);

      return { message: 'Perfil removido com sucesso' };
    } catch (error) {
      throw new NotFoundException('Erro ao remover perfil');
    }
  }

  private sanitize(profile: any) {
    return {
      id: profile.id,
      userId: profile.userId,
      core: profile.core,
      attributes: profile.attributes,
      createdAt: profile.createdAt,
    };
  }
}
import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Req,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';

@Controller('users')
@UseGuards(JwtAuthGuard) // 🔐 Todas as rotas exigem login
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  // =====================================================
  // 1. GESTÃO DA PRÓPRIA CONTA (/me)
  // =====================================================

  @Get('me')
  async getMe(@Req() req: any) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    this.logger.log(`[GET] Buscando perfil próprio: ${userId}`);
    
    // Chamando o método unificado getMe que já possui cache
    return this.usersService.getMe(userId);
  }

  @Patch('me')
  async updateMe(@Req() req: any, @Body() dto: UpdateMeDto) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    this.logger.log(`[PATCH] Atualizando perfil: ${userId}`);
    
    return this.usersService.updateMe(userId, dto);
  }

  @Delete('me')
  async deleteMe(@Req() req: any) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    this.logger.log(`[DELETE] Solicitada desativação de conta: ${userId}`);
    
    return this.usersService.deleteMe(userId);
  }

  // =====================================================
  // 2. INTERAÇÃO COM OUTROS USUÁRIOS
  // =====================================================

  /**
   * Retorna apenas dados públicos (Core) para exibição em cards/listas.
   * Livre para qualquer usuário autenticado.
   */
  @Get(':id/public')
  async getPublicProfile(@Param('id') id: string) {
    this.logger.log(`[GET] Perfil público solicitado para ID: ${id}`);
    return this.usersService.getPublicProfile(id);
  }

  /**
   * Acesso a dados sensíveis (E-mail, metadados de verificação).
   * Restrito a usuários com role ADMIN.
   */
  @Get(':id/sensitive')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getSensitiveProfile(@Param('id') id: string) {
    this.logger.log(`[ADMIN] Acesso a dados sensíveis do ID: ${id}`);
    return this.usersService.getSensitiveProfile(id);
  }
}
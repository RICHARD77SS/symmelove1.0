import {
  Controller,
  Get,
  Logger,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JwtRequest } from '../../auth/types/jwt-request.type';
import { Roles } from '../../auth/decorators/roles.decorator';

/**
 * UsersController
 * ----------------
 * Camada responsável apenas por:
 * - Receber requisições
 * - Aplicar Guards
 * - Encaminhar para o Service
 *
 * ❌ Nunca colocar lógica de negócio aqui
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
/**
 * Todas as rotas deste controller exigem JWT válido.
 * Caso contrário → 401 Unauthorized
 */
export class UsersController {
  private readonly logger = new Logger(UsersController.name);
  constructor(private readonly usersService: UsersService) {}

  // =====================================================
  // PERFIL DO USUÁRIO LOGADO
  // GET /users/me
  // =====================================================
  /**
   * Retorna o perfil COMPLETO do usuário autenticado.
   * O ID vem do token JWT (req.user.sub).
   *
   * ✔️ Seguro contra IDOR
   */
@Get('me')
  async getMe(@Req() req: any) {
    // 🔍 O segredo está aqui: Verifique se o seu Strategy retorna 'userId' ou 'id'
    // Se você seguiu o passo anterior da Strategy, o objeto está em req.user.userId
    const userId = req.user.userId || req.user.id || req.user.sub;

    this.logger.log(`Buscando perfil para o usuário ID: ${userId}`);

    if (!userId) {
      this.logger.error('ID do usuário não encontrado no request. Verifique a JwtStrategy.');
    }

    return this.usersService.getMyProfile(userId);
  }

  // =====================================================
  // PERFIL PÚBLICO DE OUTRO USUÁRIO
  // GET /users/:id/public
  // =====================================================
  /**
   * Retorna informações públicas de um usuário.
   * Pode ser usado para visualização de perfil.
   */
  @Get(':id/public')
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }

  // =====================================================
  // DADOS SENSÍVEIS (ADMIN)
  // GET /users/:id/sensitive
  // =====================================================
  /**
   * Apenas ADMIN pode acessar dados sensíveis de usuários.
   * Além disso, o usuário alvo precisa estar VERIFICADO.
   */
  @Get(':id/sensitive')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getSensitiveProfile(@Param('id') id: string) {
    return this.usersService.getSensitiveProfile(id);
  }
}

// apps/api/src/auth/decorator/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

/**
 * Chave usada para armazenar os roles no metadata da rota
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator @Roles()
 * 
 * Exemplo:
 * @Roles('ADMIN')
 * @Roles('ADMIN', 'MODERATOR')
 */
export const Roles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);

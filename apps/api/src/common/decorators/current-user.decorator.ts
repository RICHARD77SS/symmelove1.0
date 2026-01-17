// apps/api/src/common/decorators/current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Retorna o usuário autenticado (JWT).
 * Evita uso de @Req() e melhora tipagem/autocomplete.
 */
export const CurrentUser = createParamDecorator(
  (_, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);

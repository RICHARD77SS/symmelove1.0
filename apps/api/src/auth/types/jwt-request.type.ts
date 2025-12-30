import { Request } from 'express';

/**
 * Representa o request após autenticação JWT
 * O objeto user vem do JwtStrategy.validate()
 */
export interface JwtRequest extends Request {
  user: {
    sub: string;
    email: string;
    role: string;
  };
}

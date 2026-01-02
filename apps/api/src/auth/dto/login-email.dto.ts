// apps/api/src/auth/dto/login-email.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginEmailDto {
  @IsEmail({}, { message: 'Email inválido' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Senha obrigatória' })
  password!: string;
}

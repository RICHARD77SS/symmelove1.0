// apps/api/src/auth/dto/reset-password.dto.ts
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsString()
  token: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'A nova senha deve ter pelo menos 8 caracteres.' })
  newPassword: string;
}
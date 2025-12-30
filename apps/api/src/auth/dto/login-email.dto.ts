// apps/api/src/auth/dto/login-email.dto.ts
import { IsEmail, IsString } from 'class-validator';

export class LoginEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

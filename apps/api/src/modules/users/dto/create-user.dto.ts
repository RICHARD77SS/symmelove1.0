// apps/api/src/modules/users/dto/create-user.dto.ts

import { IsEmail, IsString, MinLength } from 'class-validator';

// =====================================
// DTO DE CRIAÇÃO DE USUÁRIO
// =====================================
export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

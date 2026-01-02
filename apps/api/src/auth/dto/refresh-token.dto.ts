import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'O Refresh Token é obrigatório.' })
  refreshToken!: string;
}
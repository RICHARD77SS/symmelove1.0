import { IsPhoneNumber, IsString, Length } from 'class-validator';

export class RequestOtpDto {
  @IsPhoneNumber() // Valida formato internacional (+55...)
  phone!: string;
}

export class VerifyOtpDto {
  @IsPhoneNumber()
  phone!: string;

  @IsString()
  @Length(6, 6, { message: 'O código deve ter 6 dígitos' })
  code!: string;
}

import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * =====================================
 * DTO DE REGISTRO VIA EMAIL E SENHA
 * =====================================
 *
 * Fluxo:
 * 1. Frontend envia email + password
 * 2. ValidationPipe valida os campos
 * 3. AuthController recebe dados tipados
 * 4. AuthService cria o usuário com hash
 */
export class RegisterEmailDto {
  /**
   * Email do usuário
   * - Deve ser um email válido
   */
  @IsEmail({}, { message: 'Email inválido' })
  email!: string;

  /**
   * Senha do usuário
   * Regras:
   * - mínimo 8 caracteres
   * - máximo 64 caracteres
   * - pelo menos 1 letra e 1 número
   */
  @IsString()
  @MinLength(12, { message: 'Senha muito curta (mínimo 12)' })
  @MaxLength(64, { message: 'Senha muito longa' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/,
    {
      message:
        'Senha deve conter maiúscula, minúscula, número e símbolo',
    },
  )
  password!: string;
}

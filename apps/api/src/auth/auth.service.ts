import { 
  Injectable, 
  ConflictException, 
  UnauthorizedException 
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../infra/prisma/prisma.service';
import { RegisterEmailDto } from './dto/register-email.dto'; // Assumindo que você criou este DTO
import { AuthType } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // =====================================
  // REGISTRO SEGURO
  // =====================================
  async registerWithEmail(dto: RegisterEmailDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // 1. Verificação de existência
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      // 🔐 Segurança: Mensagem genérica para dificultar enumeração
      throw new ConflictException('Não foi possível processar o cadastro.'); 
    }

    // 2. Hash forte (Custo 12)
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // 3. Transação Atômica
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
        },
      });

      await tx.authProvider.create({
        data: {
          provider: AuthType.EMAIL,
          providerId: normalizedEmail,
          userId: newUser.id,
        },
      });

      return newUser;
    });

    // 4. Retorna tokens imediatamente (ou apenas o user se exigir confirmação de email)
    return this.generateTokens(user.id, user.email);
  }

  // =====================================
  // LOGIN SEGURO
  // =====================================
  async loginEmail(dto: RegisterEmailDto) { // Reutilizando DTO ou crie um LoginDto
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // 🔐 Segurança: Mesma mensagem para usuário não encontrado ou senha errada
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.generateTokens(user.id, user.email);
  }

  // =====================================
  // GERAR TOKENS JWT
  // =====================================
  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      this.jwtService.signAsync(payload, { expiresIn: '7d' }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
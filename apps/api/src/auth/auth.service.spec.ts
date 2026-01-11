import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthService } from './auth.service';
import { PrismaService } from '../infra/prisma/prisma.service';
import { CacheService } from '../infra/cache/cache.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  // Criamos Mocks para as dependências que não queremos testar diretamente agora
  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    authProvider: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    deleteByPattern: jest.fn(),
  };

  const mockJwt = {
    signAsync: jest.fn().mockResolvedValue('fake_token'),
    verifyAsync: jest.fn(),
    decode: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        // Fornecemos os Mocks em vez das classes reais
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: JwtService, useValue: mockJwt },
        { provide: EventEmitter2, useValue: mockEventEmitter }, // 👈 Resolva o erro aqui
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  /**
   * Teste de Registro: Garante que a transação do Prisma é chamada
   */
  describe('registerWithEmail', () => {
    it('deve criar um usuário e um provedor de auth com sucesso', async () => {
      const dto = { email: 'richard@test.com', password: 'password123' };
      
      mockPrisma.authProvider.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'user_123', email: dto.email });

      const result = await service.registerWithEmail(dto);

      expect(result).toHaveProperty('accessToken');
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('user.registered', expect.any(Object));
    });
  });
});
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../infra/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn().mockResolvedValue(null),
              create: jest.fn(),
            },
            authProvider: {
              create: jest.fn(),
            },
            $transaction: jest.fn((cb) =>
              cb({
                user: {
                  create: jest.fn().mockResolvedValue({
                    id: 'uuid',
                    email: 'test@email.com',
                    createdAt: new Date(),
                  }),
                },
                authProvider: {
                  create: jest.fn(),
                },
              }),
            ),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('fake-jwt'),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    prisma = module.get(PrismaService);
  });

  it('should hash password and create user', async () => {
    const result = await service.registerWithEmail({
      email: 'test@email.com',
      password: 'Strong@Password123',
    });

    expect(result).toHaveProperty('accessToken');
    expect(result.accessToken).toBe('fake-jwt');
  });
});

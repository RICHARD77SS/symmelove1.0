import * as dotenv from 'dotenv';
dotenv.config(); // 🔥 Isso injeta a DATABASE_URL no process.env para o PrismaService ler


import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request = require('supertest');
import { AppModule } from '../../app.module';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CacheService } from '../../infra/cache/cache.service';
import { AuthService } from '../auth.service';

describe('AuthController (End-to-End)', () => {
  let application: INestApplication;
  let prismaService: PrismaService;
  let cacheService: CacheService;
  let authService: AuthService;

  /**
   * Mock de dados para os testes de integração.
   * Utilizados para simular entradas de usuários reais.
   */
  const testUser = {
    email: 'test@enterprise.com',
    password: 'StrongPassword123!',
    phone: '+5511999999999',
  };

  beforeAll(async () => {
    // Inicialização do módulo de teste importando o AppModule real
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    application = moduleFixture.createNestApplication();

    // Configuração global de pipes para garantir que as validações de DTO (class-validator) sejam testadas
    application.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    await application.init();

    // Injeção das instâncias necessárias para manipulação direta durante os testes
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    cacheService = moduleFixture.get<CacheService>(CacheService);
    authService = moduleFixture.get<AuthService>(AuthService);

    /**
     * Limpeza profunda do banco de dados de teste.
     * A ordem é importante devido às restrições de chave estrangeira (Foreign Keys).
     */
    await prismaService.authProvider.deleteMany();
    await prismaService.user.deleteMany();
  });

  afterAll(async () => {
    // Encerramento da aplicação para liberar as portas e conexões de banco/cache
    await application.close();
  });

  // =============================================================
  // 0. TESTES DE AUTENTICAÇÃO SOCIAL (GOOGLE)
  // =============================================================
  describe('Google Authentication Flow', () => {
    /**
     * Teste de segurança: Garante que tokens malformados ou inválidos 
     * sejam rejeitados pela biblioteca google-auth-library.
     */
    it('POST /auth/login/google - Deve retornar 401 para token inválido', async () => {
      const response = await request(application.getHttpServer())
        .post('/auth/login/google')
        .send({ idToken: 'invalid_token_format' });

      expect(response.status).toBe(401);
    });

    /**
     * Teste de sucesso com Mock: Como não podemos gerar um token real do Google
     * programaticamente sem interface, simulamos a resposta positiva do Service.
     */
    it('POST /auth/login/google - Deve realizar login com sucesso via Mock', async () => {
      // Espionagem da instância do serviço para interceptar a validação externa
      jest.spyOn(authService, 'loginWithGoogle').mockResolvedValueOnce({
        accessToken: 'mock_jwt_access_token',
        refreshToken: 'mock_jwt_refresh_token',
      });

      const response = await request(application.getHttpServer())
        .post('/auth/login/google')
        .send({ idToken: 'valid_mocked_token' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken', 'mock_jwt_access_token');
    });
  });

  // =============================================================
  // 1. TESTES DE REGISTRO DE CONTA
  // =============================================================
  describe('Account Registration', () => {
    it('POST /auth/register/email - Deve registrar novo usuário com sucesso', async () => {
      const response = await request(application.getHttpServer())
        .post('/auth/register/email')
        .send({ 
          email: testUser.email, 
          password: testUser.password 
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('POST /auth/register/email - Deve impedir duplicidade de e-mail (409 Conflict)', async () => {
      const response = await request(application.getHttpServer())
        .post('/auth/register/email')
        .send({ 
          email: testUser.email, 
          password: testUser.password 
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('cadastro');
    });
  });

  // =============================================================
  // 2. TESTES DE LOGIN TRADICIONAL (EMAIL)
  // =============================================================
  describe('Email Credentials Login', () => {
    it('POST /auth/login/email - Deve autenticar usuário existente', async () => {
      const response = await request(application.getHttpServer())
        .post('/auth/login/email')
        .send({ 
          email: testUser.email, 
          password: testUser.password 
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
    });

    it('POST /auth/login/email - Deve rejeitar senha incorreta', async () => {
      const response = await request(application.getHttpServer())
        .post('/auth/login/email')
        .send({ 
          email: testUser.email, 
          password: 'IncorrectPassword123' 
        });

      expect(response.status).toBe(401);
    });
  });

  // =============================================================
  // 3. TESTES DE AUTENTICAÇÃO VIA TELEFONE (OTP)
  // =============================================================
  describe('Phone OTP Authentication', () => {
    it('POST /auth/login/phone/request - Deve gerar e armazenar código OTP no Cache', async () => {
      const response = await request(application.getHttpServer())
        .post('/auth/login/phone/request')
        .send({ phone: testUser.phone });

      expect(response.status).toBe(201);

      // Validação direta no Redis/Cache para garantir persistência do código
      const storedOtpCode = await cacheService.get(`otp:${testUser.phone}`);
      expect(storedOtpCode).toBeDefined();
      expect(storedOtpCode).toHaveLength(6);
    });

    it('POST /auth/login/phone/verify - Deve validar código e criar sessão', async () => {
      // Recupera o código gerado no passo anterior diretamente do cache
      const codeFromCache = await cacheService.get<string>(`otp:${testUser.phone}`);
      
      const response = await request(application.getHttpServer())
        .post('/auth/login/phone/verify')
        .send({ 
          phone: testUser.phone, 
          code: codeFromCache 
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
    });
  });

  // =============================================================
  // 4. GESTÃO DE SESSÃO E SEGURANÇA DE TOKENS
  // =============================================================
  describe('Session Management & Token Rotation', () => {
    let currentAccessToken: string;
    let currentRefreshToken: string;

    beforeAll(async () => {
      const loginResponse = await request(application.getHttpServer())
        .post('/auth/login/email')
        .send({ 
          email: testUser.email, 
          password: testUser.password 
        });
      currentAccessToken = loginResponse.body.accessToken;
      currentRefreshToken = loginResponse.body.refreshToken;
    });

    it('POST /auth/token/refresh - Deve rotacionar tokens com sucesso', async () => {
      const response = await request(application.getHttpServer())
        .post('/auth/token/refresh')
        .send({ refreshToken: currentRefreshToken });

      expect(response.status).toBe(200);
      expect(response.body.accessToken).not.toBe(currentAccessToken);
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('POST /auth/logout - Deve invalidar a sessão no Cache', async () => {
      // Realiza o logout enviando o token de autorização e o refresh token no corpo
      await request(application.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${currentAccessToken}`)
        .send({ refreshToken: currentRefreshToken });

      // Tenta renovar o token usando um Refresh Token que acabou de ser invalidado
      const response = await request(application.getHttpServer())
        .post('/auth/token/refresh')
        .send({ refreshToken: currentRefreshToken });

      expect(response.status).toBe(401);
    });
  });

  // =============================================================
  // 5. TESTES DE SEGURANÇA E LIMITES (RATE LIMITING)
  // =============================================================
  describe('Security Throttling', () => {
    it('POST /auth/login/phone/request - Deve retornar 429 para múltiplas requisições', async () => {
      const targetPhoneNumber = '+5511888888888';
      
      // Executa requisições rápidas para estourar o limite do ThrottlerGuard
      await request(application.getHttpServer()).post('/auth/login/phone/request').send({ phone: targetPhoneNumber });
      await request(application.getHttpServer()).post('/auth/login/phone/request').send({ phone: targetPhoneNumber });
      
      const rateLimitedResponse = await request(application.getHttpServer())
        .post('/auth/login/phone/request')
        .send({ phone: targetPhoneNumber });

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body.message).toContain('Throttler');
    });
  });
});
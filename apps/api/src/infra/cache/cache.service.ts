// apps/api/src/infra/cache/cache.service.ts

import { Injectable, Inject} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * CacheService (Redis Wrapper)
 * Responsável por gerenciar sessões e dados temporários de alta performance.
 * Essencial para escalabilidade horizontal.
 */
@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Define um valor no cache (ex: salvar ID da sessão do Refresh Token)
   * @param key Chave única (ex: session:user_id:jti)
   * @param value Valor a ser guardado
   * @param ttl Tempo de vida em segundos (padrão: 7 dias)
   */
  async set(key: string, value: any, ttl: number = 60 * 60 * 24 * 7): Promise<void> {
    // No cache-manager v5+, o TTL é passado em milissegundos
    await this.cacheManager.set(key, value, ttl * 1000);
  }

  /**
   * Recupera um valor do cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    return await this.cacheManager.get<T>(key);
  }

  /**
   * Remove um item (ex: Logout)
   */
  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  /**
   * Verifica se uma chave existe
   */
  async exists(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined && value !== null;
  }
/**
 * Remove múltiplas chaves baseadas em um padrão (Pattern).
 * Muito útil para "Logout All".
 */
async deleteByPattern(pattern: string): Promise<void> {
  // Support cache-manager v7 ('stores') and legacy 'store' by using an any-cast
  const anyCache: any = this.cacheManager as any;
  const store = anyCache.store ?? anyCache.stores ?? anyCache;

  // Se estiver usando Redis, acessamos o cliente diretamente para usar 'KEYS' ou 'SCAN'
  // Nota: SCAN é preferível a KEYS em bancos de dados gigantes para não travar o Redis.
  if (store && ('keys' in store || typeof (store as any).keys === 'function')) {
    const keys = await (store as any).keys(pattern);
    if (Array.isArray(keys) && keys.length > 0) {
      for (const key of keys) {
        await this.cacheManager.del(key);
      }
    }
  }
}
}
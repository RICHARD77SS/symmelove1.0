// apps/api/src/infra/cache/cache.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Define um valor no cache. 
   * Nota: O JSON.stringify garante que o dado seja recuperável de forma idêntica por qualquer nó da API.
   */
  async set(key: string, value: any, ttlInSeconds = 60 * 60 * 24 * 7): Promise<void> {
    try {
      // Algumas stores do cache-manager usam segundos, outras milissegundos. 
      // Verifique se o seu RedisStore pede milissegundos.
      await this.cacheManager.set(key, JSON.stringify(value), ttlInSeconds * 1000);
    } catch (error) {
      this.logger.error(`Erro ao gravar no Cache: ${key}`, error);
    }
  }

  /**
   * Recupera um valor do cache com tipagem genérica.
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const data = await this.cacheManager.get<string>(key);
      if (!data) return undefined;

      // Se o dado já for um objeto (algumas stores parseiam sozinhas), retorna ele
      if (typeof data !== 'string') return data as T;

      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.error(`Erro ao ler do Cache: ${key}`, error);
      return undefined;
    }
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const value = await this.cacheManager.get(key);
    return value !== undefined && value !== null;
  }

  /**
   * Limpa cache por padrão (ex: user:me:*)
   * Implementação segura para diferentes tipos de store.
   */
  async deleteByPattern(pattern: string): Promise<void> {
    try {
      const store = (this.cacheManager as any).store;
      
      // Verifica se a store suporta busca por chaves (comum no Redis)
      if (store && typeof store.keys === 'function') {
        const keys: string[] = await store.keys(pattern);
        if (keys.length > 0) {
          await Promise.all(keys.map(key => this.cacheManager.del(key)));
          this.logger.debug(`Cache invalidado para o padrão: ${pattern} (${keys.length} chaves)`);
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao deletar padrão de cache: ${pattern}`, error);
    }
  }
}
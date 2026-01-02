import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheService } from '../../infra/cache/cache.service';

@Injectable()
export class FraudListener {
  private readonly logger = new Logger(FraudListener.name);

  constructor(private cache: CacheService) {}

  @OnEvent('auth.login.success')
  async handleSuccessfulLogin(payload: any) {
    const { userId, metadata } = payload;
    
    // 1. Chave para rastrear o último IP do usuário no Redis
    const lastIpKey = `user:${userId}:last_ip`;
    const lastIp = await this.cache.get(lastIpKey);

    if (lastIp && lastIp !== metadata.ip) {
      this.logger.warn(`⚠️ Login suspeito detectado para o usuário ${userId}. IP mudou de ${lastIp} para ${metadata.ip}`);
      
      // Aqui você dispararia:
      // - Email de alerta: "Novo acesso detectado"
      // - Notificação Push
      // - Incremento de score de risco
    }

    // Atualiza o IP atual no Redis (TTL de 30 dias)
    await this.cache.set(lastIpKey, metadata.ip, 60 * 60 * 24 * 30);
  }

  @OnEvent('auth.login.failed')
  async handleFailedLogin(payload: any) {
    const { email, metadata } = payload;
    
    // Lógica de Brute Force cumulativo
    const bruteKey = `brute_force_attempts:${metadata.ip}`;
    const attempts = (await this.cache.get<number>(bruteKey)) || 0;

    if (attempts > 10) {
      this.logger.error(`🚨 Bloqueio Crítico: IP ${metadata.ip} excedeu 10 falhas de login.`);
      // Aqui você poderia banir o IP temporariamente no Firewall/Cloudflare
    }

    await this.cache.set(bruteKey, attempts + 1, 60 * 60); // Janela de 1 hora
  }
}
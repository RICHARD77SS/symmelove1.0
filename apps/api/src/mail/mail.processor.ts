// apps/api/src/mail/mail.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from './mail.service';

/**
 * @Processor: Define que esta classe é uma consumidora da fila 'mail_queue'.
 * O NestJS vinculará automaticamente esta classe ao Redis para ouvir novos Jobs.
 */
@Processor('mail_queue')
export class MailProcessor extends WorkerHost {
  // Logger interno para monitorar o terminal sem interromper a execução do worker
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  /**
   * 🛠️ MÉTODO PRINCIPAL: process
   * Este método é chamado toda vez que um novo trabalho entra na fila.
   * Ele funciona como um "Roteador de Tarefas" (Task Router).
   */
  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Iniciando processamento: Job ID ${job.id} | Tipo: ${job.name}`);

    // Usamos um switch para lidar com diferentes tipos de e-mails na mesma fila
    switch (job.name) {
      
      /**
       * CASO 1: Redefinição de Senha
       * Disparado quando o usuário solicita recuperação de conta.
       */
      case 'reset-password':
        // Desestruturamos os dados que enviamos no 'mailQueue.add' lá no AuthService
        const { email, token } = job.data;
        
        // Chamamos o serviço de e-mail real para fazer a conexão SMTP/API
        // O retorno do await é importante para o BullMQ saber se o job foi concluído
        return await this.mailService.sendResetPasswordEmail(email, token);

      /**
       * CASO 2: Boas-vindas (Novo Registro)
       * Disparado imediatamente após a criação da conta no banco.
       */
      case 'welcome-email':
        // Aqui pegamos o e-mail do novo usuário cadastrado
        const { email: userEmail } = job.data;
        
        this.logger.log(`Enviando boas-vindas para o novo usuário: ${userEmail}`);
        
        // Supondo que você tenha este método no seu MailService
        return await this.mailService.sendWelcomeEmail(userEmail);

      /**
       * CASO PADRÃO
       * Segurança caso alguém adicione um job com nome errado na fila.
       */
      default:
        this.logger.warn(`Atenção: Recebido job sem tratativa definida: ${job.name}`);
        return null;
    }
  }

  /**
   * ✅ LISTENER: completed
   * Executado automaticamente pelo BullMQ quando o método process() retorna com sucesso.
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    // Útil para métricas e para saber que a fila está andando
    this.logger.log(`✅ [SUCESSO] Job ${job.id} do tipo ${job.name} concluído.`);
  }

  /**
   * ❌ LISTENER: failed
   * Executado quando o método process() lança um erro (throw) ou excede o tempo.
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    // Aqui registramos o erro detalhado. 
    // O BullMQ usará as configurações de 'attempts' e 'backoff' para tentar novamente.
    this.logger.error(
      `❌ [ERRO] Job ${job.id} (${job.name}) falhou. Tentativa atual: ${job.attemptsMade}. Motivo: ${error.message}`,
    );
    
    // DICA: Em produção, aqui você poderia integrar com Sentry ou Slack para alertas de erro
  }
}
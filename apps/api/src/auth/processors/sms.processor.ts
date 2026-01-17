import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('sms_queue')
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  async process(job: Job<{ phone: string; otp: string }>): Promise<any> {
    const { phone, otp } = job.data;

    this.logger.log(`Enviando SMS para ${phone}...`);
// 🚨 ESTA LINHA É A CHAVE:
    console.log('==========================================');
    console.log(`🔥 CÓDIGO RECUPERADO: ${otp} PARA O TELEFONE: ${phone}`);
    console.log('==========================================');
    // Aqui você chamaria o serviço da Twilio/Zenvia/etc.
    // Exemplo: await this.smsService.send(phone, `Seu código é: ${otp}`);
    
    return { sent: true };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Falha ao enviar SMS para ${job.data.phone}: ${error.message}`);
  }
}
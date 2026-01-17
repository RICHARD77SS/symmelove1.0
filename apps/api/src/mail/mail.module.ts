import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';

@Module({
  imports: [
    // Registra a fila apenas para quem precisa dela
    BullModule.registerQueue({
      name: 'mail_queue',
    }),
  ],
  providers: [MailService, MailProcessor],
  exports: [MailService, BullModule], // Exporta o BullModule para que o AuthService possa injetar a fila
})
export class MailModule {}
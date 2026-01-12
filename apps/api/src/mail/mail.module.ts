import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [MailService],
  exports: [MailService], // 🔴 OBRIGATÓRIO
})
export class MailModule {}

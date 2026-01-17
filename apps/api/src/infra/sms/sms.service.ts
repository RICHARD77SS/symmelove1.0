import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';

@Injectable()
export class SmsService {
  private client: Twilio.Twilio;
  private readonly logger = new Logger(SmsService.name);

  constructor(private configService: ConfigService) {
    this.client = Twilio(
      this.configService.get<string>('TWILIO_ACCOUNT_SID'),
      this.configService.get<string>('TWILIO_AUTH_TOKEN'),
    );
  }

  async sendOtp(phone: string, otp: string) {
    try {
      const message = await this.client.messages.create({
        body: `Seu código de verificação é: ${otp}. Válido por 5 minutos.`,
        from: this.configService.get<string>('TWILIO_PHONE_NUMBER'),
        to: phone,
      });

      return message.sid;
    } catch (error: any) {
      this.logger.error(`Erro Twilio: ${error.message}`);
      throw error;
    }
  }
}

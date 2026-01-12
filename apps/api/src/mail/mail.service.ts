import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend: Resend;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async sendResetPasswordEmail(email: string, token: string) {
    const resetLink = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;

    try {
      await this.resend.emails.send({
        from: this.configService.get<string>('EMAIL_FROM'),
        to: email,
        subject: 'Recuperação de Senha - SymmeLove',
        html: `
          <h1>Recuperação de Senha</h1>
          <p>Você solicitou a alteração de senha. Clique no link abaixo para prosseguir:</p>
          <a href="${resetLink}" style="padding: 10px 20px; background-color: #ff4757; color: white; text-decoration: none; border-radius: 5px;">
            Redefinir minha senha
          </a>
          <p>Este link expira em 1 hora.</p>
          <p>Se você não solicitou isso, ignore este e-mail.</p>
        `,
      });
    } catch (error) {
      throw new InternalServerErrorException('Falha ao enviar e-mail de recuperação.');
    }
  }
}
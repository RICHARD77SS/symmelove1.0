import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailService {
  private resend: Resend;
  private readonly logger = new Logger(MailService.name);
  private readonly templatesBaseDir: string;
  constructor(private configService: ConfigService) {
    // Inicializa o cliente Resend
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    
    // Registra componentes reutilizáveis (Partials)
    const possiblePaths = [
      path.join(process.cwd(), 'dist/apps/api/src/mail/templates'), // Estrutura Monorepo Dist
      path.join(process.cwd(), 'apps/api/src/mail/templates'),      // Estrutura Monorepo Src
      path.join(__dirname, 'templates'),                           // Localização relativa clássica
    ];

    this.templatesBaseDir = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
    
    this.logger.log(`Diretório de templates selecionado: ${this.templatesBaseDir}`);

    this.registerPartials();

  }

  /**
   * 🛠️ Configura componentes de layout que se repetem em todos os e-mails
   */
  private registerPartials() {
    try {
      const partialsDir = path.join(this.templatesBaseDir, 'partials');
      
      if (fs.existsSync(partialsDir)) {
        const footerPath = path.join(partialsDir, 'footer.hbs');
        if (fs.existsSync(footerPath)) {
          const footerSource = fs.readFileSync(footerPath, 'utf8');
          handlebars.registerPartial('footer', footerSource);
          this.logger.debug('Partial "footer" registrado com sucesso.');
        }
      }
    } catch (error) {
      this.logger.warn(`Aviso: Falha ao registrar partials: ${error.message}`);
    }
  }

  /**
   * 📝 Método genérico e privado para compilar templates Handlebars
   */
  private compileTemplate(templateName: string, data: any): string {
    try {
      const templatePath = path.join(this.templatesBaseDir, `${templateName}.hbs`);
      
      if (!fs.existsSync(templatePath)) {
        // Log detalhado para te ajudar a debugar no Docker
        this.logger.error(`Arquivo não encontrado no disco: ${templatePath}`);
        throw new Error(`Template não encontrado em: ${templatePath}`);
      }

      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateSource);
      
      return template(data);
    } catch (error) {
      this.logger.error(`Erro ao compilar template ${templateName}: ${error.message}`);
      throw new InternalServerErrorException('Erro ao processar template de e-mail.');
    }
  }

  /**
   * 🔑 Envia e-mail de recuperação de senha
   */
  async sendResetPasswordEmail(email: string, token: string) {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/auth/reset-password?token=${token}`;

    const html = this.compileTemplate('reset-password', {
      url: resetUrl,
    });

    await this.resend.emails.send({
      from: 'Segurança <security@seuapp.com>',
      to: email,
      subject: '⚠️ Instruções para redefinir sua senha',
      html: html,
    });
  }

  /**
   * 🚀 Envia e-mail de boas-vindas após o registro
   */
  async sendWelcomeEmail(email: string) {
    const name = email.split('@')[0];
    
    const html = this.compileTemplate('welcome', {
      name: name,
      email: email,
      url: `${this.configService.get('FRONTEND_URL')}/login`
    });

    await this.resend.emails.send({
      from: 'Onboarding <onboarding@seuapp.com>',
      to: email,
      subject: 'Bem-vindo ao App! 🚀',
      html: html,
    });
  }
}
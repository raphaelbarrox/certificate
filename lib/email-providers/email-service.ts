import nodemailer from "nodemailer"
import { ResendProvider, type ResendConfig, type EmailAttachment } from "./resend-provider"
import { EmailSecurity } from "@/lib/email-security"

export interface EmailConfig {
  enabled: boolean
  provider: "smtp" | "resend"
  senderName: string
  senderEmail: string
  subject: string
  body: string
  smtp?: {
    host: string
    port: number
    user: string
    pass: string
    secure: boolean
  }
  resend?: ResendConfig
}

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  attachments?: EmailAttachment[]
  config: EmailConfig
}

export class EmailService {
  static async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { config, to, subject, html, attachments } = options

    if (!config.enabled) {
      console.log("[v0] [Email] Envio desativado")
      return { success: true }
    }

    const fromAddress = `"${config.senderName || config.senderEmail}" <${config.senderEmail}>`

    try {
      console.log(
        "[v0] [Email] Iniciando envio:",
        EmailSecurity.sanitizeForLog({
          provider: config.provider,
          to,
          subject,
          attachmentCount: attachments?.length || 0,
        }),
      )

      if (config.provider === "resend" && config.resend?.enabled && config.resend.apiKey) {
        const result = await this.sendWithResend({
          from: fromAddress,
          to,
          subject,
          html,
          attachments,
          apiKey: config.resend.apiKey,
        })

        console.log("[v0] [Email] Resultado Resend:", EmailSecurity.sanitizeForLog(result))
        return result
      } else if (config.provider === "smtp" && config.smtp) {
        const result = await this.sendWithSMTP({
          from: fromAddress,
          to,
          subject,
          html,
          attachments,
          smtp: config.smtp,
        })

        console.log("[v0] [Email] Resultado SMTP:", EmailSecurity.sanitizeForLog(result))
        return result
      } else {
        throw new Error("Configuração de email inválida ou incompleta")
      }
    } catch (error) {
      console.error("[v0] [Email] Erro no envio:", EmailSecurity.sanitizeForLog(error))
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
      return { success: false, error: errorMessage }
    }
  }

  private static async sendWithResend(options: {
    from: string
    to: string
    subject: string
    html: string
    attachments?: EmailAttachment[]
    apiKey: string
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const resendProvider = new ResendProvider(options.apiKey)
    return await resendProvider.sendEmail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    })
  }

  private static async sendWithSMTP(options: {
    from: string
    to: string
    subject: string
    html: string
    attachments?: EmailAttachment[]
    smtp: EmailConfig["smtp"]
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!options.smtp) {
      throw new Error("Configuração SMTP não fornecida")
    }

    const transporter = nodemailer.createTransport({
      host: options.smtp.host,
      port: options.smtp.port,
      secure: options.smtp.secure,
      auth: {
        user: options.smtp.user,
        pass: options.smtp.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })

    const mailOptions = {
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    }

    const info = await transporter.sendMail(mailOptions)
    return { success: true, messageId: info.messageId }
  }

  static async testConnection(config: EmailConfig): Promise<{ success: boolean; error?: string }> {
    try {
      if (config.provider === "resend" && config.resend?.enabled && config.resend.apiKey) {
        const resendProvider = new ResendProvider(config.resend.apiKey)
        return await resendProvider.verifyConnection()
      } else if (config.provider === "smtp" && config.smtp) {
        const transporter = nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure,
          auth: {
            user: config.smtp.user,
            pass: config.smtp.pass,
          },
          tls: {
            rejectUnauthorized: false,
          },
        })

        await transporter.verify()
        return { success: true }
      } else {
        throw new Error("Configuração de email inválida")
      }
    } catch (error) {
      console.error("[v0] [Email] Erro no teste de conexão:", EmailSecurity.sanitizeForLog(error))
      const errorMessage = error instanceof Error ? error.message : "Erro na verificação"
      return { success: false, error: errorMessage }
    }
  }

  static async sendEmailWithRetry(
    options: SendEmailOptions,
    maxRetries = 3,
  ): Promise<{ success: boolean; messageId?: string; error?: string; attempts: number }> {
    let lastError = ""

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[v0] [Email] Tentativa ${attempt}/${maxRetries}`)

      const result = await this.sendEmail(options)

      if (result.success) {
        return { ...result, attempts: attempt }
      }

      lastError = result.error || "Erro desconhecido"

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
        console.log(`[v0] [Email] Aguardando ${delay}ms antes da próxima tentativa`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    return { success: false, error: lastError, attempts: maxRetries }
  }
}

import { Resend } from "resend"

export interface ResendConfig {
  apiKey: string
  enabled: boolean
}

export interface EmailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
}

export interface ResendEmailOptions {
  from: string
  to: string
  subject: string
  html: string
  attachments?: EmailAttachment[]
}

export class ResendProvider {
  private resend: Resend

  constructor(apiKey: string) {
    this.resend = new Resend(apiKey)
  }

  async sendEmail(options: ResendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`[Resend] Iniciando envio para ${options.to}`)

      // Prepare attachments for Resend format
      const resendAttachments = options.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.isBuffer(attachment.content) ? attachment.content.toString("base64") : attachment.content,
      }))

      const emailData = {
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        ...(resendAttachments &&
          resendAttachments.length > 0 && {
            attachments: resendAttachments,
          }),
      }

      const result = await this.resend.emails.send(emailData)

      if (result.error) {
        console.error("[Resend] Erro no envio:", result.error)
        return { success: false, error: result.error.message }
      }

      console.log(`[Resend] Email enviado com sucesso. ID: ${result.data?.id}`)
      return { success: true, messageId: result.data?.id }
    } catch (error) {
      console.error("[Resend] Erro inesperado:", error)
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
      return { success: false, error: errorMessage }
    }
  }

  async verifyConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Resend doesn't have a direct verify method, so we'll try to get domains
      // This is a lightweight way to test if the API key is valid
      await this.resend.domains.list()
      return { success: true }
    } catch (error) {
      console.error("[Resend] Erro na verificação:", error)
      const errorMessage = error instanceof Error ? error.message : "Erro na verificação"
      return { success: false, error: errorMessage }
    }
  }
}

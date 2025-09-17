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
      console.log(`[v0] [Resend] 🚀 Iniciando envio para ${options.to}`)

      // Prepare attachments for Resend format
      const resendAttachments = options.attachments?.map((attachment, index) => {
        console.log(
          `[v0] [Resend] 📎 Anexo ${index + 1}: ${attachment.filename} (${Buffer.isBuffer(attachment.content) ? attachment.content.length : "string"} bytes)`,
        )

        return {
          filename: attachment.filename,
          content: Buffer.isBuffer(attachment.content) ? attachment.content.toString("base64") : attachment.content,
        }
      })

      console.log(`[v0] [Resend] 📧 Dados do email preparados:`, {
        from: options.from,
        to: options.to,
        subject: options.subject,
        hasHtml: !!options.html,
        attachmentCount: resendAttachments?.length || 0,
      })

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
        console.error("[v0] [Resend] ❌ Erro retornado pela API:", result.error)
        return { success: false, error: result.error.message }
      }

      console.log(`[v0] [Resend] ✅ Email enviado com sucesso! ID: ${result.data?.id}`)
      return { success: true, messageId: result.data?.id }
    } catch (error) {
      console.error("[v0] [Resend] ❌ Erro inesperado:", error)
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido"
      return { success: false, error: errorMessage }
    }
  }

  async verifyConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log("[v0] [Resend] 🔍 Verificando conexão...")
      // Resend doesn't have a direct verify method, so we'll try to get domains
      // This is a lightweight way to test if the API key is valid
      await this.resend.domains.list()
      console.log("[v0] [Resend] ✅ Conexão verificada com sucesso!")
      return { success: true }
    } catch (error) {
      console.error("[v0] [Resend] ❌ Erro na verificação:", error)
      const errorMessage = error instanceof Error ? error.message : "Erro na verificação"
      return { success: false, error: errorMessage }
    }
  }
}

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
    if (!apiKey || apiKey.trim() === "") {
      throw new Error("API Key do Resend é obrigatória")
    }

    if (!apiKey.startsWith("re_")) {
      throw new Error("API Key do Resend deve começar com 're_'")
    }

    this.resend = new Resend(apiKey.trim())
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

      // Tentamos listar domínios - se der erro de autenticação, sabemos que a API Key está inválida
      const domainsResult = await this.resend.domains.list().catch((error) => {
        // Se o erro for de autenticação (401/403), a API Key está inválida
        if (error.message?.includes("401") || error.message?.includes("unauthorized")) {
          throw new Error("API Key inválida ou não autorizada")
        }
        // Se o erro for de permissão (403), pode ser que a API Key não tenha permissão para listar domínios
        // mas isso não significa que não pode enviar emails
        if (error.message?.includes("403")) {
          console.log("[v0] [Resend] ⚠️ Sem permissão para listar domínios, mas API Key pode estar válida")
          return { data: [] } // Assumir que está OK
        }
        throw error
      })

      console.log("[v0] [Resend] ✅ Conexão verificada com sucesso!")
      return { success: true }
    } catch (error: any) {
      console.error("[v0] [Resend] ❌ Erro na verificação:", error)

      let errorMessage = "Erro na verificação da conexão"

      if (
        error.message?.includes("API key") ||
        error.message?.includes("unauthorized") ||
        error.message?.includes("401")
      ) {
        errorMessage = "API Key inválida ou não autorizada - verifique se está correta e ativa"
      } else if (error.message?.includes("forbidden") || error.message?.includes("403")) {
        errorMessage = "Acesso negado - verifique as permissões da API Key"
      } else if (error.message?.includes("rate limit")) {
        errorMessage = "Limite de taxa excedido - tente novamente em alguns minutos"
      } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
        errorMessage = "Erro de conexão - verifique sua internet"
      } else if (error.message) {
        errorMessage = error.message
      }

      return { success: false, error: errorMessage }
    }
  }
}

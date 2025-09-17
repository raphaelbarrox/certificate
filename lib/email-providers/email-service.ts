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

    console.log("🚀 [v0] [Email] === INICIANDO ENVIO DE EMAIL ===")
    console.log("🔍 [v0] [Email] Configuração recebida:", {
      enabled: config.enabled,
      provider: config.provider,
      senderEmail: config.senderEmail,
      senderName: config.senderName,
      hasResendConfig: !!config.resend,
      resendEnabled: config.resend?.enabled,
      hasApiKey: !!config.resend?.apiKey,
      apiKeyFormat: config.resend?.apiKey?.startsWith("re_") ? "válido" : "inválido",
      apiKeyLength: config.resend?.apiKey?.length || 0,
      destinatario: to,
      assunto: subject,
      temAnexos: !!attachments?.length,
      quantidadeAnexos: attachments?.length || 0,
    })

    if (!config.enabled) {
      console.log("🔕 [v0] [Email] Envio desativado na configuração")
      return { success: true }
    }

    if (!config.resend?.enabled) {
      console.log("❌ [v0] [Email] Resend não está habilitado na configuração")
      return { success: false, error: "Resend não está habilitado" }
    }

    if (!config.resend?.apiKey) {
      console.log("❌ [v0] [Email] API Key do Resend não encontrada")
      return { success: false, error: "API Key do Resend não encontrada" }
    }

    if (!config.resend.apiKey.startsWith("re_")) {
      console.log("❌ [v0] [Email] API Key do Resend tem formato inválido")
      return { success: false, error: "API Key do Resend tem formato inválido" }
    }

    const fromAddress = `"${config.senderName || config.senderEmail}" <${config.senderEmail}>`

    try {
      console.log(
        "📤 [v0] [Email] Preparando envio via Resend:",
        EmailSecurity.sanitizeForLog({
          from: fromAddress,
          to,
          subject,
          attachmentCount: attachments?.length || 0,
        }),
      )

      const result = await this.sendWithResend({
        from: fromAddress,
        to,
        subject,
        html,
        attachments,
        apiKey: config.resend.apiKey,
      })

      console.log("📊 [v0] [Email] Resultado do envio:", EmailSecurity.sanitizeForLog(result))

      if (result.success) {
        console.log("✅ [v0] [Email] === EMAIL ENVIADO COM SUCESSO ===")
      } else {
        console.log("❌ [v0] [Email] === FALHA NO ENVIO ===")
      }

      return result
    } catch (error) {
      console.error("❌ [v0] [Email] Erro inesperado no envio:", EmailSecurity.sanitizeForLog(error))
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
    console.log(`📤 [v0] [Email] Criando provider Resend para ${options.to}`)

    try {
      const resendProvider = new ResendProvider(options.apiKey)
      const result = await resendProvider.sendEmail({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      })

      console.log(`📊 [v0] [Email] Resultado do provider:`, EmailSecurity.sanitizeForLog(result))
      return result
    } catch (providerError) {
      console.error(`❌ [v0] [Email] Erro no provider:`, EmailSecurity.sanitizeForLog(providerError))
      const errorMessage = providerError instanceof Error ? providerError.message : "Erro no provider"
      return { success: false, error: errorMessage }
    }
  }

  static async testConnection(config: EmailConfig): Promise<{ success: boolean; error?: string }> {
    console.log("🔍 [v0] [Email] === TESTANDO CONEXÃO ===")
    console.log("🔍 [v0] [Email] Configuração para teste:", {
      enabled: config.enabled,
      provider: config.provider,
      hasResendConfig: !!config.resend,
      resendEnabled: config.resend?.enabled,
      hasApiKey: !!config.resend?.apiKey,
      apiKeyFormat: config.resend?.apiKey?.startsWith("re_") ? "válido" : "inválido",
    })

    try {
      if (config.resend?.enabled && config.resend.apiKey) {
        console.log("🔍 [v0] [Email] Testando conexão Resend...")
        const resendProvider = new ResendProvider(config.resend.apiKey)
        const result = await resendProvider.verifyConnection()

        console.log("📊 [v0] [Email] Resultado do teste:", EmailSecurity.sanitizeForLog(result))

        if (result.success) {
          console.log("✅ [v0] [Email] === CONEXÃO TESTADA COM SUCESSO ===")
        } else {
          console.log("❌ [v0] [Email] === FALHA NO TESTE DE CONEXÃO ===")
        }

        return result
      } else {
        const error = "❌ Resend não configurado. Configure a API Key do Resend."
        console.log(error)
        return { success: false, error }
      }
    } catch (error) {
      console.error("❌ [v0] [Email] Erro no teste de conexão:", EmailSecurity.sanitizeForLog(error))
      const errorMessage = error instanceof Error ? error.message : "Erro na verificação"
      return { success: false, error: errorMessage }
    }
  }

  static async sendEmailWithRetry(
    options: SendEmailOptions,
    maxRetries = 3,
  ): Promise<{ success: boolean; messageId?: string; error?: string; attempts: number }> {
    console.log(`🔄 [v0] [Email] === INICIANDO ENVIO COM RETRY (máx: ${maxRetries}) ===`)

    let lastError = ""

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 [v0] [Email] Tentativa ${attempt}/${maxRetries}`)

      const result = await this.sendEmail(options)

      if (result.success) {
        console.log(`✅ [v0] [Email] === SUCESSO NA TENTATIVA ${attempt} ===`)
        return { ...result, attempts: attempt }
      }

      lastError = result.error || "Erro desconhecido"
      console.log(`❌ [v0] [Email] Tentativa ${attempt} falhou: ${lastError}`)

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
        console.log(`⏳ [v0] [Email] Aguardando ${delay}ms antes da próxima tentativa`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    console.log(`❌ [v0] [Email] === FALHA APÓS ${maxRetries} TENTATIVAS ===`)
    return { success: false, error: lastError, attempts: maxRetries }
  }
}

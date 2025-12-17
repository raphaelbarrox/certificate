import sgMail from "@sendgrid/mail"

const SENDGRID_API_KEY = process.env.SENDGRID_API

if (!SENDGRID_API_KEY) {
  console.error("[SendGrid] ERRO CRÍTICO: SENDGRID_API não está definida nas variáveis de ambiente!")
  throw new Error("SENDGRID_API é obrigatória para o funcionamento do sistema de email")
}

if (SENDGRID_API_KEY.trim() === "") {
  console.error("[SendGrid] ERRO CRÍTICO: SENDGRID_API está vazia!")
  throw new Error("SENDGRID_API não pode estar vazia")
}

console.log(`[SendGrid] API Key configurada: ${SENDGRID_API_KEY.substring(0, 10)}...`)

// Configurar a API key do SendGrid
sgMail.setApiKey(SENDGRID_API_KEY)

interface EmailData {
  to: string
  from: string
  subject: string
  html: string
  replyTo?: string
}

export class EmailService {
  static isConfigured(): boolean {
    return !!SENDGRID_API_KEY && SENDGRID_API_KEY.trim() !== ""
  }

  static async sendEmail(data: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.isConfigured()) {
        const error = "SENDGRID_API não está configurada corretamente"
        console.error(`[SendGrid] ${error}`)
        return { success: false, error }
      }

      console.log(`[SendGrid] Enviando email para ${data.to}`)
      console.log(`[SendGrid] API Key status: ${SENDGRID_API_KEY ? "Definida" : "NÃO DEFINIDA"}`)

      const msg = {
        to: data.to,
        from: data.from,
        subject: data.subject,
        html: data.html,
        replyTo: data.replyTo,
      }

      const response = await sgMail.send(msg)

      // SendGrid retorna um array com a resposta
      const statusCode = response[0].statusCode
      const messageId = response[0].headers["x-message-id"] as string

      if (statusCode >= 200 && statusCode < 300) {
        console.log(`[SendGrid] Email enviado com sucesso. Status: ${statusCode}, Message ID: ${messageId}`)
        return { success: true, messageId: messageId }
      } else {
        console.error("[SendGrid] Erro ao enviar email. Status:", statusCode)
        return { success: false, error: `Erro HTTP ${statusCode}` }
      }
    } catch (error: any) {
      console.error("[SendGrid] Erro inesperado:", error)

      // SendGrid retorna erros em um formato específico
      if (error.response) {
        const { body } = error.response
        console.error("[SendGrid] Detalhes do erro:", body)

        // Extrair mensagem de erro mais específica
        if (body && body.errors && body.errors.length > 0) {
          const errorMessage = body.errors.map((e: any) => e.message).join(", ")
          return { success: false, error: errorMessage }
        }
      }

      if (error.message && error.message.includes("API key")) {
        return { success: false, error: "API key do SendGrid não está configurada. Verifique a variável SENDGRID_API." }
      }

      return { success: false, error: error.message || "Erro desconhecido" }
    }
  }

  static validateEmailDomain(email: string): boolean {
    return email.endsWith("@therapist.international")
  }

  static formatSenderEmail(senderName: string, senderEmail: string): string {
    if (!this.validateEmailDomain(senderEmail)) {
      throw new Error("Email deve ser do domínio therapist.international")
    }
    return `${senderName} <${senderEmail}>`
  }

  static async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isConfigured()) {
        return { success: false, error: "SENDGRID_API não está configurada" }
      }

      console.log(`[SendGrid] Testando conexão com API key: ${SENDGRID_API_KEY.substring(0, 10)}...`)

      // Teste simples enviando um email para o próprio domínio
      const msg = {
        to: "test@therapist.international",
        from: "Sistema <sistema@therapist.international>",
        subject: "Teste de Conexão - Sistema de Certificados",
        html: "<p>Este é um teste de conexão do sistema de certificados.</p>",
      }

      const response = await sgMail.send(msg)
      const statusCode = response[0].statusCode

      if (statusCode >= 200 && statusCode < 300) {
        console.log("[SendGrid] Teste de conexão bem-sucedido!")
        return { success: true }
      } else {
        console.error("[SendGrid] Erro no teste de conexão. Status:", statusCode)
        return { success: false, error: `Erro HTTP ${statusCode}` }
      }
    } catch (error: any) {
      console.error("[SendGrid] Erro no teste de conexão:", error)

      if (error.response && error.response.body) {
        const errorMessage = error.response.body.errors?.map((e: any) => e.message).join(", ") || error.message
        return { success: false, error: errorMessage }
      }

      return { success: false, error: error.message || "Erro desconhecido" }
    }
  }
}

import { Resend } from "resend"

const RESEND_API_KEY = process.env.RESEND_API_KEY

if (!RESEND_API_KEY) {
  console.error("[Resend] ERRO CRÍTICO: RESEND_API_KEY não está definida nas variáveis de ambiente!")
  throw new Error("RESEND_API_KEY é obrigatória para o funcionamento do sistema de email")
}

if (RESEND_API_KEY.trim() === "") {
  console.error("[Resend] ERRO CRÍTICO: RESEND_API_KEY está vazia!")
  throw new Error("RESEND_API_KEY não pode estar vazia")
}

console.log(`[Resend] API Key configurada: ${RESEND_API_KEY.substring(0, 10)}...`)

const resend = new Resend(RESEND_API_KEY)

interface EmailData {
  to: string
  from: string
  subject: string
  html: string
  replyTo?: string
}

export class EmailService {
  static isConfigured(): boolean {
    return !!RESEND_API_KEY && RESEND_API_KEY.trim() !== ""
  }

  static async sendEmail(data: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.isConfigured()) {
        const error = "RESEND_API_KEY não está configurada corretamente"
        console.error(`[Resend] ${error}`)
        return { success: false, error }
      }

      console.log(`[Resend] Enviando email para ${data.to}`)
      console.log(`[Resend] API Key status: ${RESEND_API_KEY ? "Definida" : "NÃO DEFINIDA"}`)

      const result = await resend.emails.send({
        from: data.from,
        to: data.to,
        subject: data.subject,
        html: data.html,
        replyTo: data.replyTo,
      })

      if (result.error) {
        console.error("[Resend] Erro ao enviar email:", result.error)
        return { success: false, error: result.error.message }
      }

      console.log(`[Resend] Email enviado com sucesso. ID: ${result.data?.id}`)
      return { success: true, messageId: result.data?.id }
    } catch (error: any) {
      console.error("[Resend] Erro inesperado:", error)
      if (error.message && error.message.includes("Missing API key")) {
        return { success: false, error: "API key do Resend não está configurada. Verifique a variável RESEND_API_KEY." }
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
        return { success: false, error: "RESEND_API_KEY não está configurada" }
      }

      console.log(`[Resend] Testando conexão com API key: ${RESEND_API_KEY.substring(0, 10)}...`)

      // Teste simples enviando um email para o próprio domínio
      const testResult = await resend.emails.send({
        from: "Sistema <sistema@therapist.international>",
        to: "test@therapist.international",
        subject: "Teste de Conexão - Sistema de Certificados",
        html: "<p>Este é um teste de conexão do sistema de certificados.</p>",
      })

      if (testResult.error) {
        console.error("[Resend] Erro no teste de conexão:", testResult.error)
        return { success: false, error: testResult.error.message }
      }

      console.log("[Resend] Teste de conexão bem-sucedido!")
      return { success: true }
    } catch (error: any) {
      console.error("[Resend] Erro no teste de conexão:", error)
      return { success: false, error: error.message || "Erro desconhecido" }
    }
  }
}

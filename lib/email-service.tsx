import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

interface EmailData {
  to: string
  from: string
  subject: string
  html: string
  replyTo?: string
}

export class EmailService {
  static async sendEmail(data: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`[Resend] Iniciando envio de email`)
      console.log(`[Resend] Para: ${data.to}`)
      console.log(`[Resend] De: ${data.from}`)
      console.log(`[Resend] Assunto: ${data.subject}`)
      console.log(`[Resend] API Key configurada: ${process.env.RESEND_API_KEY ? "SIM" : "NÃO"}`)

      if (!process.env.RESEND_API_KEY) {
        const error = "RESEND_API_KEY não configurada"
        console.error(`[Resend] ERRO CRÍTICO: ${error}`)
        return { success: false, error }
      }

      const result = await resend.emails.send({
        from: data.from,
        to: data.to,
        subject: data.subject,
        html: data.html,
        replyTo: data.replyTo,
      })

      console.log(`[Resend] Resultado completo:`, JSON.stringify(result, null, 2))

      if (result.error) {
        console.error(`[Resend] Erro detalhado:`, result.error)
        return { success: false, error: result.error.message }
      }

      if (result.data?.id) {
        console.log(`[Resend] ✅ Email enviado com sucesso! ID: ${result.data.id}`)
        return { success: true, messageId: result.data.id }
      } else {
        console.error(`[Resend] ❌ Resposta sem ID de mensagem:`, result)
        return { success: false, error: "Resposta inválida do Resend" }
      }
    } catch (error: any) {
      console.error(`[Resend] ❌ Erro inesperado completo:`, error)
      console.error(`[Resend] Stack trace:`, error.stack)
      return { success: false, error: error.message || "Erro desconhecido" }
    }
  }

  static validateEmailDomain(email: string): boolean {
    const isValid = email.endsWith("@therapist.international")
    console.log(`[Resend] Validação de domínio para ${email}: ${isValid ? "VÁLIDO" : "INVÁLIDO"}`)
    return isValid
  }

  static formatSenderEmail(senderName: string, senderEmail: string): string {
    if (!this.validateEmailDomain(senderEmail)) {
      throw new Error("Email deve ser do domínio therapist.international")
    }
    const formatted = `${senderName} <${senderEmail}>`
    console.log(`[Resend] Email formatado: ${formatted}`)
    return formatted
  }

  static async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      console.log(`[Resend] 🧪 Testando conexão...`)

      if (!process.env.RESEND_API_KEY) {
        return { success: false, error: "RESEND_API_KEY não configurada" }
      }

      // Teste simples enviando um email para o próprio domínio
      const testResult = await resend.emails.send({
        from: "Sistema <sistema@therapist.international>",
        to: "test@therapist.international",
        subject: "Teste de Conexão - Sistema de Certificados",
        html: "<p>Este é um teste de conexão do sistema de certificados.</p>",
      })

      console.log(`[Resend] Resultado do teste:`, JSON.stringify(testResult, null, 2))

      if (testResult.error) {
        return {
          success: false,
          error: testResult.error.message,
          details: testResult.error,
        }
      }

      return {
        success: true,
        details: testResult.data,
      }
    } catch (error: any) {
      console.error(`[Resend] Erro no teste:`, error)
      return {
        success: false,
        error: error.message || "Erro desconhecido",
        details: error,
      }
    }
  }
}

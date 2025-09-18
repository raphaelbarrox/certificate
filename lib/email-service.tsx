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
      console.log(`[Resend] Enviando email para ${data.to}`)

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
      // Teste simples enviando um email para o próprio domínio
      const testResult = await resend.emails.send({
        from: "Sistema <sistema@therapist.international>",
        to: "test@therapist.international",
        subject: "Teste de Conexão - Sistema de Certificados",
        html: "<p>Este é um teste de conexão do sistema de certificados.</p>",
      })

      if (testResult.error) {
        return { success: false, error: testResult.error.message }
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || "Erro desconhecido" }
    }
  }
}

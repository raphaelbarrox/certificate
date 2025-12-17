import { type NextRequest, NextResponse } from "next/server"
import { EmailService } from "@/lib/email-service"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const { senderEmail, senderName } = await request.json()

    if (!senderEmail) {
      return NextResponse.json({ error: "Email do remetente é obrigatório." }, { status: 400 })
    }

    // Validar domínio
    if (!EmailService.validateEmailDomain(senderEmail)) {
      return NextResponse.json(
        {
          error: "Email deve ser do domínio therapist.international",
        },
        { status: 400 },
      )
    }

    // Enviar email de teste
    const result = await EmailService.sendEmail({
      from: EmailService.formatSenderEmail(senderName || "Sistema", senderEmail),
      to: senderEmail,
      subject: "Teste de Email - Sistema de Certificados",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Teste de Conexão Bem-sucedido!</h1>
          <p>Se você recebeu este email, o sistema de envio automático está funcionando corretamente.</p>
          <hr style="margin: 20px 0;">
          <p><strong>Remetente:</strong> ${senderName || "Sistema"}</p>
          <p><strong>Email:</strong> ${senderEmail}</p>
          <p><strong>Sistema:</strong> SendGrid API via therapist.international</p>
          <br>
          <p style="color: #16a34a; font-weight: bold;">✅ Sistema configurado e funcionando!</p>
        </div>
      `,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      message: `Email de teste enviado com sucesso para ${senderEmail}!`,
      messageId: result.messageId,
    })
  } catch (error: any) {
    console.error("[Email Test Error]", error)
    return NextResponse.json(
      {
        error: `Erro no teste: ${error.message}`,
      },
      { status: 500 },
    )
  }
}

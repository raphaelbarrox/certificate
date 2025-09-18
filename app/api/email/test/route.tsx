import { type NextRequest, NextResponse } from "next/server"
import { EmailService } from "@/lib/email-service"
import { getRealIP, checkRateLimit, createRateLimitResponse, addRateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const clientIP = getRealIP(request)
  const rateLimitKey = `${clientIP}:/api/email/test`
  const rateLimitConfig = RATE_LIMITS["/api/email/test"]

  const { allowed, remaining, resetTime } = checkRateLimit(rateLimitKey, rateLimitConfig)

  if (!allowed) {
    console.log(`[Rate Limit] Blocked request from ${clientIP} - limit exceeded`)
    return createRateLimitResponse(resetTime)
  }

  console.log(`[Rate Limit] Request allowed from ${clientIP} - ${remaining} remaining`)

  try {
    const { senderEmail, senderName } = await request.json()

    if (!senderEmail) {
      const errorResponse = NextResponse.json({ error: "Email do remetente é obrigatório." }, { status: 400 })
      return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
    }

    // Validar domínio
    if (!EmailService.validateEmailDomain(senderEmail)) {
      const errorResponse = NextResponse.json(
        {
          error: "Email deve ser do domínio therapist.international",
        },
        { status: 400 },
      )
      return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
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
          <p><strong>Sistema:</strong> Resend API via therapist.international</p>
          <br>
          <p style="color: #16a34a; font-weight: bold;">✅ Sistema configurado e funcionando!</p>
        </div>
      `,
    })

    if (!result.success) {
      const errorResponse = NextResponse.json({ error: result.error }, { status: 500 })
      return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
    }

    const response = NextResponse.json({
      message: `Email de teste enviado com sucesso para ${senderEmail}!`,
      messageId: result.messageId,
    })

    return addRateLimitHeaders(response, remaining - 1, resetTime)
  } catch (error: any) {
    console.error("[Email Test Error]", error)
    const errorResponse = NextResponse.json(
      {
        error: `Erro no teste: ${error.message}`,
      },
      { status: 500 },
    )
    return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
  }
}

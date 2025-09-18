import { type NextRequest, NextResponse } from "next/server"
import { EmailService } from "@/lib/email-service"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    console.log(`[Email Test] 🧪 INICIANDO TESTE COMPLETO DO SISTEMA DE EMAIL`)

    const { senderEmail, senderName } = await request.json()

    console.log(`[Email Test] Dados recebidos:`)
    console.log(`[Email Test] - senderEmail: ${senderEmail}`)
    console.log(`[Email Test] - senderName: ${senderName}`)

    if (!senderEmail) {
      console.error(`[Email Test] ❌ Email do remetente não fornecido`)
      return NextResponse.json({ error: "Email do remetente é obrigatório." }, { status: 400 })
    }

    console.log(`[Email Test] 🔍 Testando conexão com Resend...`)
    const connectionTest = await EmailService.testConnection()
    console.log(`[Email Test] Resultado do teste de conexão:`, connectionTest)

    if (!connectionTest.success) {
      console.error(`[Email Test] ❌ FALHA na conexão com Resend:`, connectionTest.error)
      return NextResponse.json(
        {
          error: `Falha na conexão com Resend: ${connectionTest.error}`,
          details: connectionTest.details,
        },
        { status: 500 },
      )
    }

    console.log(`[Email Test] ✅ Conexão com Resend OK`)

    // Validar domínio
    if (!EmailService.validateEmailDomain(senderEmail)) {
      console.error(`[Email Test] ❌ Domínio inválido: ${senderEmail}`)
      return NextResponse.json(
        {
          error: "Email deve ser do domínio therapist.international",
        },
        { status: 400 },
      )
    }

    console.log(`[Email Test] ✅ Domínio válido: ${senderEmail}`)

    console.log(`[Email Test] 📧 Enviando email de teste...`)
    const result = await EmailService.sendEmail({
      from: EmailService.formatSenderEmail(senderName || "Sistema", senderEmail),
      to: senderEmail,
      subject: "🧪 TESTE COMPLETO - Sistema de Certificados",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #10b981; border-radius: 10px;">
          <h1 style="color: #10b981; text-align: center;">🎉 TESTE COMPLETO BEM-SUCEDIDO!</h1>
          
          <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #166534; margin-top: 0;">✅ Sistema Funcionando Perfeitamente</h2>
            <p>Se você recebeu este email, significa que:</p>
            <ul style="color: #166534;">
              <li>✅ API Key do Resend está configurada</li>
              <li>✅ Domínio therapist.international está verificado</li>
              <li>✅ Sistema de envio automático está operacional</li>
              <li>✅ Certificados serão enviados automaticamente</li>
            </ul>
          </div>

          <hr style="margin: 30px 0; border: 1px solid #d1d5db;">
          
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
            <h3 style="color: #374151; margin-top: 0;">📋 Detalhes do Teste</h3>
            <p><strong>Remetente:</strong> ${senderName || "Sistema"}</p>
            <p><strong>Email:</strong> ${senderEmail}</p>
            <p><strong>Provedor:</strong> Resend API</p>
            <p><strong>Domínio:</strong> therapist.international</p>
            <p><strong>Data/Hora:</strong> ${new Date().toLocaleString("pt-BR")}</p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #10b981; font-weight: bold; font-size: 18px;">🚀 SISTEMA PRONTO PARA USO!</p>
            <p style="color: #6b7280;">Os certificados serão enviados automaticamente quando gerados.</p>
          </div>
        </div>
      `,
    })

    console.log(`[Email Test] Resultado do envio:`, result)

    if (!result.success) {
      console.error(`[Email Test] ❌ FALHA no envio:`, result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    console.log(`[Email Test] ✅ TESTE COMPLETO BEM-SUCEDIDO!`)
    console.log(`[Email Test] Message ID: ${result.messageId}`)

    return NextResponse.json({
      success: true,
      message: `✅ TESTE COMPLETO BEM-SUCEDIDO! Email enviado para ${senderEmail}`,
      messageId: result.messageId,
      connectionTest: connectionTest.success,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error(`[Email Test] ❌ ERRO CRÍTICO:`, error)
    console.error(`[Email Test] Stack:`, error.stack)
    return NextResponse.json(
      {
        error: `Erro crítico no teste: ${error.message}`,
        stack: error.stack,
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    console.log(`[Email Test] 🔍 Teste rápido de configuração...`)

    // Verificar se API Key está configurada
    const hasApiKey = !!process.env.RESEND_API_KEY
    console.log(`[Email Test] RESEND_API_KEY configurada: ${hasApiKey}`)

    if (!hasApiKey) {
      return NextResponse.json({
        success: false,
        error: "RESEND_API_KEY não configurada",
        checks: {
          apiKey: false,
          connection: false,
        },
      })
    }

    // Teste de conexão
    const connectionTest = await EmailService.testConnection()

    return NextResponse.json({
      success: connectionTest.success,
      message: connectionTest.success ? "Sistema configurado corretamente" : "Problema na configuração",
      error: connectionTest.error,
      checks: {
        apiKey: hasApiKey,
        connection: connectionTest.success,
      },
      details: connectionTest.details,
    })
  } catch (error: any) {
    console.error(`[Email Test] Erro no teste GET:`, error)
    return NextResponse.json({
      success: false,
      error: error.message,
      checks: {
        apiKey: !!process.env.RESEND_API_KEY,
        connection: false,
      },
    })
  }
}

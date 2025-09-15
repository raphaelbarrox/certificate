import { type NextRequest, NextResponse } from "next/server"
import { EmailService } from "@/lib/email-providers/email-service"

export const runtime = "nodejs"

function getErrorSuggestion(errorCode?: string, errorMessage?: string): string {
  const lowerCaseMessage = errorMessage?.toLowerCase() || ""

  if (lowerCaseMessage.includes("invalid login") || lowerCaseMessage.includes("authentication failed")) {
    return "Autenticação falhou. Verifique usuário e senha. Para serviços como Gmail ou Outlook, pode ser necessário criar uma 'Senha de Aplicativo'."
  }
  if (lowerCaseMessage.includes("api key") || lowerCaseMessage.includes("unauthorized")) {
    return "API Key inválida. Verifique se a API Key do Resend está correta e ativa."
  }
  if (errorCode === "ENOTFOUND") {
    return "Servidor não encontrado. Verifique o endereço do servidor SMTP."
  }
  if (errorCode === "ECONNREFUSED") {
    return "Conexão recusada. Verifique o endereço do servidor e a porta. A porta pode estar bloqueada por um firewall."
  }
  if (errorCode === "ETIMEDOUT") {
    return "Tempo de conexão esgotado. O servidor pode estar offline ou a porta bloqueada."
  }
  if (lowerCaseMessage.includes("ssl") || lowerCaseMessage.includes("tls")) {
    return "Erro de SSL/TLS. Tente alternar a opção 'Usar TLS/SSL' ou verifique se a porta está correta (ex: 465 para SSL, 587 para TLS)."
  }
  return "Ocorreu um erro inesperado. Verifique todas as configurações e tente novamente."
}

export async function POST(request: NextRequest) {
  try {
    const { action, config } = await request.json()

    if (!config) {
      return NextResponse.json({ error: "Configuração de email ausente." }, { status: 400 })
    }

    const { provider, senderEmail, senderName } = config

    if (action === "verify") {
      const result = await EmailService.testConnection(config)

      if (!result.success) {
        throw new Error(result.error || "Falha na verificação")
      }

      const providerName = provider === "resend" ? "Resend" : "SMTP"
      return NextResponse.json({
        message: `Conexão com ${providerName} bem-sucedida!`,
      })
    }

    if (action === "send") {
      if (!senderEmail) {
        return NextResponse.json({ error: "Email do remetente é obrigatório para enviar um teste." }, { status: 400 })
      }

      const result = await EmailService.sendEmail({
        to: senderEmail,
        subject: "Email de Teste - CertGen",
        html: `
          <h1>Teste de Conexão ${provider === "resend" ? "Resend" : "SMTP"}</h1>
          <p>Se você recebeu este email, suas configurações estão funcionando corretamente.</p>
          <hr>
          ${
            provider === "resend"
              ? "<p><strong>Provedor:</strong> Resend API</p>"
              : `<p><strong>Servidor:</strong> ${config.smtp?.host}</p><p><strong>Porta:</strong> ${config.smtp?.port}</p><p><strong>Usuário:</strong> ${config.smtp?.user}</p>`
          }
        `,
        config,
      })

      if (!result.success) {
        throw new Error(result.error || "Falha no envio do teste")
      }

      return NextResponse.json({
        message: `Email de teste enviado com sucesso para ${senderEmail}!`,
      })
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
  } catch (error: any) {
    console.error("[Email Test Error]", error)
    const suggestion = getErrorSuggestion(error.code, error.message)
    const errorMessage = `Falha no teste: ${error.message}. Sugestão: ${suggestion}`
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

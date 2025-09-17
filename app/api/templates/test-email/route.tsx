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

    const { senderEmail, senderName } = config

    // Forçar provider para resend
    config.provider = "resend"

    if (!config.resend?.apiKey) {
      return NextResponse.json(
        {
          error: "API Key do Resend é obrigatória.",
        },
        { status: 400 },
      )
    }

    if (!config.resend.apiKey.startsWith("re_")) {
      return NextResponse.json(
        {
          error: "API Key do Resend deve começar com 're_'. Verifique se copiou corretamente.",
        },
        { status: 400 },
      )
    }

    if (!senderEmail) {
      return NextResponse.json(
        {
          error: "Email do remetente é obrigatório para o Resend.",
        },
        { status: 400 },
      )
    }

    // Verificar se o domínio do email parece ser personalizado
    const emailDomain = senderEmail.split("@")[1]
    if (["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(emailDomain)) {
      return NextResponse.json(
        {
          error: `Resend não permite emails de provedores públicos como ${emailDomain}. Use um domínio próprio verificado no Resend.`,
        },
        { status: 400 },
      )
    }

    if (action === "verify") {
      const result = await EmailService.testConnection(config)

      if (!result.success) {
        let errorMessage = result.error || "Falha na verificação"

        if (errorMessage.includes("401") || errorMessage.includes("unauthorized")) {
          errorMessage = "API Key do Resend inválida. Verifique se a chave está correta e ativa."
        } else if (errorMessage.includes("domain")) {
          errorMessage = "Domínio não verificado no Resend. Acesse resend.com/domains para verificar seu domínio."
        } else if (errorMessage.includes("forbidden")) {
          errorMessage = "Email remetente não autorizado. Certifique-se de que o domínio está verificado no Resend."
        }

        throw new Error(errorMessage)
      }

      return NextResponse.json({
        message: `✅ Conexão com Resend bem-sucedida! Configuração válida.`,
      })
    }

    if (action === "send") {
      if (!senderEmail) {
        return NextResponse.json({ error: "Email do remetente é obrigatório para enviar um teste." }, { status: 400 })
      }

      const result = await EmailService.sendEmail({
        to: senderEmail,
        subject: "✅ Teste de Conexão - CertGen",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #10b981;">🎉 Teste de Conexão Resend</h1>
            <p>Se você recebeu este email, suas configurações estão funcionando <strong>perfeitamente</strong>!</p>
            
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #374151;">📋 Detalhes da Configuração:</h3>
              <p><strong>🚀 Provedor:</strong> Resend API</p>
              <p><strong>📧 Email Remetente:</strong> ${senderEmail}</p>
              <p><strong>✅ Status:</strong> Domínio verificado e funcionando</p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
              Agora você pode ativar o envio automático de certificados com confiança! 🎯
            </p>
          </div>
        `,
        config,
      })

      if (!result.success) {
        let errorMessage = result.error || "Falha no envio do teste"

        if (errorMessage.includes("domain")) {
          errorMessage =
            "❌ Domínio não verificado no Resend. Acesse https://resend.com/domains para verificar seu domínio antes de enviar emails."
        }

        throw new Error(errorMessage)
      }

      return NextResponse.json({
        message: `🎉 Email de teste enviado com sucesso para ${senderEmail}! Verifique sua caixa de entrada.`,
      })
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
  } catch (error: any) {
    console.error("❌ [Email Test Error]", error)

    let suggestion = ""
    if (error.message.includes("domain")) {
      suggestion = "Configure seu domínio no Resend: https://resend.com/domains"
    } else if (error.message.includes("unauthorized") || error.message.includes("401")) {
      suggestion = "Verifique se a API Key está correta e ativa no Resend"
    }

    const errorMessage = `❌ ${error.message}${suggestion ? ` | 💡 ${suggestion}` : ""}`
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

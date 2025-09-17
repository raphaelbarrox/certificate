import { type NextRequest, NextResponse } from "next/server"
import { EmailService } from "@/lib/email-providers/email-service"
import { getDecryptedConfigAction } from "@/app/actions/email-actions"

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
    const { action, config, userId } = await request.json()

    console.log("[v0] [Email Test API] 🚀 Iniciando teste:", {
      action,
      provider: config?.provider,
      hasUserId: !!userId,
    })

    if (!config) {
      console.log("[v0] [Email Test API] ❌ Configuração ausente")
      return NextResponse.json({ error: "Configuração de email ausente." }, { status: 400 })
    }

    const hasSecureKey = config.resend?.keyHash
    const hasLegacyKey = config.resend?.apiKey && config.resend.apiKey.trim() !== ""

    if (!hasSecureKey && !hasLegacyKey) {
      console.log("[v0] [Email Test API] ❌ API Key ausente")
      return NextResponse.json(
        {
          error: "API Key do Resend é obrigatória. Configure e salve sua API Key primeiro.",
        },
        { status: 400 },
      )
    }

    let finalConfig = config

    if (hasSecureKey) {
      if (!userId) {
        console.log("[v0] [Email Test API] ❌ UserId necessário para descriptografar")
        return NextResponse.json(
          {
            error: "Erro de autenticação. Faça login novamente.",
          },
          { status: 401 },
        )
      }

      try {
        console.log("[v0] [Email Test API] 🔓 Descriptografando API Key...")
        const decryptResult = await getDecryptedConfigAction(userId, config.resend.keyHash)

        if (!decryptResult.success) {
          throw new Error(decryptResult.error)
        }

        finalConfig = {
          ...config,
          resend: {
            enabled: true,
            apiKey: decryptResult.apiKey,
          },
        }
        console.log("[v0] [Email Test API] ✅ API Key descriptografada com sucesso")
      } catch (decryptError) {
        console.error("[v0] [Email Test API] ❌ Erro ao descriptografar:", decryptError)
        return NextResponse.json(
          {
            error: "Erro ao acessar API Key. Verifique se a chave foi salva corretamente.",
          },
          { status: 400 },
        )
      }
    }

    const apiKey = finalConfig.resend?.apiKey
    if (!apiKey || !apiKey.startsWith("re_")) {
      console.log("[v0] [Email Test API] ❌ API Key formato inválido")
      return NextResponse.json(
        {
          error: "API Key do Resend deve começar com 're_'. Verifique se copiou corretamente da dashboard do Resend.",
        },
        { status: 400 },
      )
    }

    const { senderEmail, senderName } = finalConfig

    if (!senderEmail || senderEmail.trim() === "") {
      console.log("[v0] [Email Test API] ❌ Email remetente ausente")
      return NextResponse.json(
        {
          error: "Email do remetente é obrigatório para o Resend.",
        },
        { status: 400 },
      )
    }

    const emailDomain = senderEmail.split("@")[1]?.toLowerCase()
    const publicDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "aol.com"]

    if (publicDomains.includes(emailDomain)) {
      console.log("[v0] [Email Test API] ❌ Domínio público detectado:", emailDomain)
      return NextResponse.json(
        {
          error: `Resend não permite emails de provedores públicos como ${emailDomain}. Você precisa usar um domínio próprio verificado no Resend (ex: contato@suaempresa.com).`,
        },
        { status: 400 },
      )
    }

    const emailConfig = {
      ...finalConfig,
      provider: "resend",
      resend: {
        enabled: true,
        apiKey: apiKey,
      },
    }

    if (action === "verify") {
      console.log("[v0] [Email Test API] 🔍 Testando conexão...")
      const result = await EmailService.testConnection(emailConfig)

      if (!result.success) {
        let errorMessage = result.error || "Falha na verificação"
        console.log("[v0] [Email Test API] ❌ Falha na verificação:", errorMessage)

        if (errorMessage.includes("401") || errorMessage.includes("unauthorized")) {
          errorMessage =
            "API Key do Resend inválida ou expirada. Verifique se a chave está correta e ativa na dashboard do Resend."
        } else if (errorMessage.includes("403") || errorMessage.includes("forbidden")) {
          errorMessage = "Acesso negado. Verifique se a API Key tem as permissões necessárias para enviar emails."
        } else if (errorMessage.includes("domain")) {
          errorMessage = `Domínio '${emailDomain}' não está verificado no Resend. Acesse https://resend.com/domains para verificar seu domínio.`
        }

        return NextResponse.json({ error: errorMessage }, { status: 400 })
      }

      console.log("[v0] [Email Test API] ✅ Conexão verificada com sucesso")
      return NextResponse.json({
        message: `✅ Conexão com Resend bem-sucedida! API Key válida e domínio '${emailDomain}' verificado.`,
      })
    }

    if (action === "send") {
      console.log("[v0] [Email Test API] 📧 Enviando email de teste...")

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
              <p><strong>👤 Nome Remetente:</strong> ${senderName || "Não definido"}</p>
              <p><strong>🌐 Domínio:</strong> ${emailDomain}</p>
              <p><strong>✅ Status:</strong> Domínio verificado e funcionando</p>
              <p><strong>🔐 Segurança:</strong> API Key criptografada</p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
              Agora você pode ativar o envio automático de certificados com confiança! 🎯
            </p>
          </div>
        `,
        config: emailConfig,
      })

      if (!result.success) {
        let errorMessage = result.error || "Falha no envio do teste"
        console.log("[v0] [Email Test API] ❌ Falha no envio:", errorMessage)

        if (errorMessage.includes("domain")) {
          errorMessage = `❌ Domínio '${emailDomain}' não está verificado no Resend. Acesse https://resend.com/domains para verificar seu domínio antes de enviar emails.`
        } else if (errorMessage.includes("rate limit")) {
          errorMessage = "❌ Limite de envio excedido. Aguarde alguns minutos antes de tentar novamente."
        }

        return NextResponse.json({ error: errorMessage }, { status: 400 })
      }

      console.log("[v0] [Email Test API] ✅ Email de teste enviado com sucesso")
      return NextResponse.json({
        message: `🎉 Email de teste enviado com sucesso para ${senderEmail}! Verifique sua caixa de entrada (e spam).`,
      })
    }

    return NextResponse.json({ error: "Ação inválida. Use 'verify' ou 'send'." }, { status: 400 })
  } catch (error: any) {
    console.error("❌ [Email Test API Error]", error)

    let errorMessage = "Erro interno do servidor"
    let suggestion = ""

    if (error instanceof Error) {
      errorMessage = error.message

      if (error.message.includes("domain")) {
        suggestion = "Configure seu domínio no Resend: https://resend.com/domains"
      } else if (error.message.includes("unauthorized") || error.message.includes("401")) {
        suggestion = "Verifique se a API Key está correta e ativa no Resend"
      } else if (error.message.includes("JSON")) {
        errorMessage = "Erro ao processar dados da requisição"
      } else if (error.message.includes("fetch")) {
        errorMessage = "Erro de conexão com o serviço de email"
      }
    }

    const finalErrorMessage = `❌ ${errorMessage}${suggestion ? ` | 💡 ${suggestion}` : ""}`

    return NextResponse.json(
      { error: finalErrorMessage },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}

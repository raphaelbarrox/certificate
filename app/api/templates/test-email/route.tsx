import { type NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

export const runtime = "nodejs"

const smtpConfigSchema = z.object({
  smtp: z.object({
    host: z.string().min(1, "Host SMTP é obrigatório"),
    port: z.number().min(1).max(65535, "Porta inválida"),
    user: z.string().min(1, "Usuário SMTP é obrigatório"),
    pass: z.string().min(1, "Senha SMTP é obrigatória"),
  }),
  senderEmail: z.string().email("Email do remetente inválido"),
  senderName: z.string().optional(),
})

async function verifyAdminAccess(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return false
  }

  return true
}

function getErrorSuggestion(errorCode?: string, errorMessage?: string): string {
  const lowerCaseMessage = errorMessage?.toLowerCase() || ""

  if (lowerCaseMessage.includes("invalid login") || lowerCaseMessage.includes("authentication failed")) {
    return "Autenticação falhou. Verifique usuário e senha. Para serviços como Gmail ou Outlook, pode ser necessário criar uma 'Senha de Aplicativo'."
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
    const hasAccess = await verifyAdminAccess(request)
    if (!hasAccess) {
      console.log(`[SECURITY] Unauthorized email test attempt - IP: ${request.ip}`)
      return NextResponse.json({ error: "Acesso não autorizado" }, { status: 401 })
    }

    const { action, config } = await request.json()

    if (!config || !config.smtp) {
      return NextResponse.json({ error: "Configuração SMTP ausente." }, { status: 400 })
    }

    const validationResult = smtpConfigSchema.safeParse(config)
    if (!validationResult.success) {
      console.log(`[SECURITY] Invalid SMTP config - IP: ${request.ip}`)
      return NextResponse.json({ error: "Configuração SMTP inválida" }, { status: 400 })
    }

    const { smtp, senderEmail, senderName } = validationResult.data

    console.log(`[AUDIT] Email test - Action: ${action} - IP: ${request.ip} - Host: ${smtp.host}`)

    const transporter = nodemailer.createTransporter({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      tls: {
        rejectUnauthorized: true, // Melhorar segurança TLS
      },
    })

    if (action === "verify") {
      await transporter.verify()
      return NextResponse.json({ message: `Conexão com ${smtp.host}:${smtp.port} bem-sucedida!` })
    }

    if (action === "send") {
      if (!senderEmail) {
        return NextResponse.json({ error: "Email do remetente é obrigatório para enviar um teste." }, { status: 400 })
      }

      await transporter.sendMail({
        from: `"${senderName || "Teste CertGen"}" <${senderEmail}>`,
        to: senderEmail,
        subject: "Email de Teste - CertGen",
        html: `
        <h1>Teste de Conexão SMTP</h1>
        <p>Se você recebeu este email, suas configurações SMTP estão funcionando corretamente.</p>
        <hr>
        <p><strong>Servidor:</strong> ${smtp.host}</p>
        <p><strong>Porta:</strong> ${smtp.port}</p>
        <p><strong>Usuário:</strong> ${smtp.user}</p>
      `,
      })
      return NextResponse.json({ message: `Email de teste enviado com sucesso para ${senderEmail}!` })
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
  } catch (error: any) {
    console.error("[SMTP Test Error]", error)
    const suggestion = getErrorSuggestion(error.code, error.message)
    const errorMessage = `Falha no teste: ${error.message}. Sugestão: ${suggestion}`
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

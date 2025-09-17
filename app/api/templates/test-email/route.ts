import { type NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"

export const runtime = "nodejs" // Force Node.js runtime

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
    const { action, config } = await request.json()

    if (!config || !config.smtp) {
      return NextResponse.json({ error: "Configuração SMTP ausente." }, { status: 400 })
    }

    const { smtp, senderEmail, senderName } = config

    if (!smtp.host || !smtp.port || !smtp.user || !smtp.pass) {
      return NextResponse.json({ error: "Todos os campos SMTP são obrigatórios." }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465, // Enforce direct TLS only for port 465. For other ports (like 587), this will be false, allowing nodemailer to use STARTTLS.
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false,
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
        to: senderEmail, // Sends test to the sender themselves
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

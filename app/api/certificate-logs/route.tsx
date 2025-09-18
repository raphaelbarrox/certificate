import { NextResponse } from "next/server"

let certificateLogs: string[] = []

export async function GET() {
  return NextResponse.json({ logs: [...certificateLogs] })
}

export async function POST(request: Request) {
  try {
    const { message } = await request.json()
    const timestamp = new Date().toLocaleTimeString("pt-BR")
    const logEntry = `[${timestamp}] ${message}`

    certificateLogs.push(logEntry)

    // Manter apenas os últimos 50 logs
    if (certificateLogs.length > 50) {
      certificateLogs = certificateLogs.slice(-50)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Erro ao adicionar log" }, { status: 500 })
  }
}

export async function DELETE() {
  certificateLogs = []
  return NextResponse.json({ success: true })
}

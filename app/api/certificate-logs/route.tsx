import { NextResponse } from "next/server"

// Armazenamento em memória com timestamp para melhor controle
let certificateLogs: Array<{ id: string; message: string; timestamp: string }> = []

export async function GET() {
  // Retorna logs ordenados por timestamp (mais recentes primeiro)
  const sortedLogs = certificateLogs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map((log) => `[${log.timestamp}] ${log.message}`)

  return NextResponse.json({
    logs: sortedLogs,
    count: certificateLogs.length,
    lastUpdate: certificateLogs.length > 0 ? certificateLogs[0].timestamp : null,
  })
}

export async function POST(request: Request) {
  try {
    const { message } = await request.json()
    const now = new Date()
    const timestamp = now.toLocaleTimeString("pt-BR", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "America/Sao_Paulo",
    })

    const logEntry = {
      id: `${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      timestamp,
    }

    certificateLogs.unshift(logEntry) // Adiciona no início para logs mais recentes primeiro

    // Manter apenas os últimos 100 logs para melhor performance
    if (certificateLogs.length > 100) {
      certificateLogs = certificateLogs.slice(0, 100)
    }

    console.log(`[CERTIFICATE-LOGS] ${timestamp} - ${message}`)

    return NextResponse.json({
      success: true,
      logId: logEntry.id,
      totalLogs: certificateLogs.length,
    })
  } catch (error) {
    console.error("[CERTIFICATE-LOGS] Erro ao adicionar log:", error)
    return NextResponse.json({ error: "Erro ao adicionar log" }, { status: 500 })
  }
}

export async function DELETE() {
  const clearedCount = certificateLogs.length
  certificateLogs = []
  console.log(`[CERTIFICATE-LOGS] Logs limpos: ${clearedCount} entradas removidas`)
  return NextResponse.json({ success: true, clearedCount })
}

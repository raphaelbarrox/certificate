import { NextResponse } from "next/server"
import { AdvancedRateLimiter } from "@/lib/advanced-rate-limiter"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Acesso não autorizado" }, { status: 401 })
    }

    const stats = AdvancedRateLimiter.getSecurityStats()

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      rateLimiting: stats,
      systemStatus: "operational",
      securityLevel: stats.activeBlocks > 10 ? "high" : stats.activeBlocks > 5 ? "medium" : "normal",
    })
  } catch (error) {
    console.error("Error getting security stats:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

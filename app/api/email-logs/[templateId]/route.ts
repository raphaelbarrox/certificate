import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export async function GET(request: NextRequest, { params }: { params: { templateId: string } }) {
  try {
    const { templateId } = params

    if (!isValidUUID(templateId)) {
      console.log(`[v0] TemplateId inválido: ${templateId}`)
      return NextResponse.json([]) // Retornar array vazio para IDs inválidos
    }

    const supabase = createClient()

    const { data: logs, error } = await supabase
      .from("email_logs")
      .select("*")
      .eq("template_id", templateId)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("[v0] Erro ao buscar logs de email:", error)

      // Se a tabela não existe ainda, retornar array vazio
      if (error.message.includes('relation "public.email_logs" does not exist')) {
        return NextResponse.json([])
      }

      throw error
    }

    const formattedLogs = (logs || []).map((log) => ({
      id: log.id,
      timestamp: log.created_at,
      type: log.type,
      status: log.status,
      message: log.message,
      details: {
        ...log.details,
        templateId: log.template_id,
      },
    }))

    return NextResponse.json(formattedLogs)
  } catch (error) {
    console.error("[v0] Erro ao buscar logs de email:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { templateId: string } }) {
  try {
    const { templateId } = params

    if (!isValidUUID(templateId)) {
      return NextResponse.json({ error: "Template ID inválido" }, { status: 400 })
    }

    const supabase = createClient()

    const { error } = await supabase.from("email_logs").delete().eq("template_id", templateId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, message: "Logs limpos com sucesso" })
  } catch (error) {
    console.error("[v0] Erro ao limpar logs de email:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAuth, checkRateLimit } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)

    if (!checkRateLimit(request, 20, 60000)) {
      // 20 buscas por minuto
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em alguns minutos." }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")?.trim()

    if (!query) {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
    }

    const supabase = createClient()

    // Solução simples e performática:
    // Busca diretamente no banco de dados por uma correspondência exata (case-insensitive)
    // no código do certificado OU no e-mail.
    // O operador '.ilike.' sem wildcards (%) funciona como uma igualdade case-insensitive.
    const { data, error } = await supabase
      .from("issued_certificates")
      .select(
        `
        *,
        certificate_templates!inner (
          title,
          template_data,
          placeholders
        )
      `,
      )
      // Updated .or() clause
      .or(
        `certificate_number.ilike.${query},recipient_email.ilike.${query},recipient_data->>cpf.ilike.${query},recipient_data->>name.ilike.${query}`,
      )
      .order("issued_at", { ascending: false })

    if (error) {
      console.error("Database search error:", error)
      // Lançar um erro genérico para o catch block lidar com a resposta ao cliente.
      throw new Error("Database search failed")
    }

    return NextResponse.json({
      certificates: data || [],
      total: data?.length || 0,
    })
  } catch (error) {
    console.error("Search API error:", error)
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor. Tente novamente."

    if (errorMessage.includes("Acesso negado")) {
      return NextResponse.json({ error: errorMessage }, { status: 401 })
    }

    return NextResponse.json({ error: "Erro interno do servidor. Tente novamente." }, { status: 500 })
  }
}

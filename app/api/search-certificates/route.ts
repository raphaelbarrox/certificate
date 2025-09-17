import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { searchQuerySchema, sanitizeSearchQuery, RateLimiter } from "@/lib/security-validator"

export async function GET(request: NextRequest) {
  try {
    const clientIP = request.ip || request.headers.get("x-forwarded-for") || "unknown"
    if (!RateLimiter.isAllowed(`search_${clientIP}`, 20, 60000)) {
      return NextResponse.json({ error: "Muitas tentativas de busca. Tente novamente em 1 minuto." }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const rawQuery = searchParams.get("q")?.trim()

    if (!rawQuery) {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
    }

    const validationResult = searchQuerySchema.safeParse({ q: rawQuery })
    if (!validationResult.success) {
      console.log(`[SECURITY] Invalid search query blocked: ${rawQuery}`)
      return NextResponse.json({ error: "Query inválida" }, { status: 400 })
    }

    const sanitizedQuery = sanitizeSearchQuery(validationResult.data.q)

    console.log(`[AUDIT] Search performed - IP: ${clientIP} - Query: ${sanitizedQuery}`)

    const supabase = createClient()

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
      .or(
        `certificate_number.ilike.${sanitizedQuery},recipient_email.ilike.${sanitizedQuery},recipient_data->>cpf.ilike.${sanitizedQuery},recipient_data->>name.ilike.${sanitizedQuery}`,
      )
      .order("issued_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("Database search error:", error)
      throw new Error("Database search failed")
    }

    return NextResponse.json({
      certificates: data || [],
      total: data?.length || 0,
    })
  } catch (error) {
    console.error("Search API error:", error)
    return NextResponse.json({ error: "Erro interno do servidor. Tente novamente." }, { status: 500 })
  }
}

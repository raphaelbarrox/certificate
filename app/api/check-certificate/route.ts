import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getRealIP, checkRateLimit, createRateLimitResponse, addRateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  const clientIP = getRealIP(request)
  const rateLimitKey = `${clientIP}:/api/check-certificate`
  const rateLimitConfig = RATE_LIMITS["/api/check-certificate"]

  const { allowed, remaining, resetTime } = checkRateLimit(rateLimitKey, rateLimitConfig)

  if (!allowed) {
    console.log(`[Rate Limit] Blocked request from ${clientIP} - limit exceeded`)
    return createRateLimitResponse(resetTime)
  }

  console.log(`[Rate Limit] Request allowed from ${clientIP} - ${remaining} remaining`)

  try {
    const { template_id, cpf, dob } = await request.json()

    if (!template_id || !cpf || !dob) {
      const errorResponse = NextResponse.json(
        { error: "ID do template, CPF e Data de Nascimento são obrigatórios" },
        { status: 400 },
      )
      return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
    }

    // Busca o certificado mais recente para o CPF, Data de Nascimento e template fornecidos
    const { data: certificate, error } = await supabase
      .from("issued_certificates")
      .select("id, certificate_number, pdf_url, recipient_data") // Puxa também os dados para preencher o form
      .eq("template_id", template_id)
      .eq("recipient_cpf", cpf)
      .eq("recipient_dob", dob)
      .order("issued_at", { ascending: false })
      .limit(1)
      .single()

    if (error || !certificate) {
      // Isso é esperado se for um novo usuário, então retornamos 404.
      const errorResponse = NextResponse.json({ error: "Nenhum certificado encontrado." }, { status: 404 })
      return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
    }

    // Retorna os dados do certificado encontrado
    const response = NextResponse.json(certificate)
    return addRateLimitHeaders(response, remaining - 1, resetTime)
  } catch (error) {
    console.error("Erro ao verificar certificado:", error)
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido"
    const errorResponse = NextResponse.json({ error: errorMessage }, { status: 500 })
    return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
  }
}

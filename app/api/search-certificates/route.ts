import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getRealIP, checkRateLimit, createRateLimitResponse, addRateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit"
import { SearchSchema, sanitizeString } from "@/lib/input-validator"
import { createSecureResponse } from "@/lib/security-headers"
import { securityLogger } from "@/lib/security-logger"

export async function GET(request: NextRequest) {
  const clientIP = getRealIP(request)
  const userAgent = request.headers.get("user-agent") || "unknown"
  const rateLimitKey = `${clientIP}:/api/search-certificates`
  const rateLimitConfig = RATE_LIMITS["/api/search-certificates"]

  const { allowed, remaining, resetTime } = checkRateLimit(rateLimitKey, rateLimitConfig)

  if (!allowed) {
    securityLogger.log({
      type: "rate_limit",
      ip: clientIP,
      userAgent,
      endpoint: "/api/search-certificates",
      details: "Rate limit exceeded",
    })
    console.log(`[Rate Limit] Blocked request from ${clientIP} - limit exceeded`)
    return createRateLimitResponse(resetTime)
  }

  console.log(`[Rate Limit] Request allowed from ${clientIP} - ${remaining} remaining`)

  try {
    const { searchParams } = new URL(request.url)
    const rawQuery = searchParams.get("q")?.trim()

    const validationResult = SearchSchema.safeParse({ q: rawQuery })

    if (!validationResult.success) {
      securityLogger.log({
        type: "validation_error",
        ip: clientIP,
        userAgent,
        endpoint: "/api/search-certificates",
        details: `Invalid search query: ${rawQuery}`,
      })

      const errorResponse = createSecureResponse({ error: "Query de busca inválida" }, 400)
      return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
    }

    const query = sanitizeString(validationResult.data.q)

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

    const response = createSecureResponse({
      certificates: data || [],
      total: data?.length || 0,
    })

    return addRateLimitHeaders(response, remaining - 1, resetTime)
  } catch (error) {
    securityLogger.log({
      type: "suspicious_activity",
      ip: clientIP,
      userAgent,
      endpoint: "/api/search-certificates",
      details: `Search error: ${error instanceof Error ? error.message : "Unknown error"}`,
    })

    console.error("Search API error:", error)
    const errorResponse = createSecureResponse({ error: "Erro interno do servidor. Tente novamente." }, 500)
    return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
  }
}

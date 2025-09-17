import { createClient } from "@/lib/supabase/server"
import type { NextRequest } from "next/server"

/**
 * Utilitário para validar autenticação em APIs
 * Retorna o usuário autenticado ou null se não autenticado
 */
export async function validateAuth(request: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    return user
  } catch (error) {
    console.error("[Auth] Erro na validação:", error)
    return null
  }
}

/**
 * Middleware simples para APIs que requerem autenticação
 * Uso: const user = await requireAuth(request)
 */
export async function requireAuth(request: NextRequest) {
  const user = await validateAuth(request)

  if (!user) {
    throw new Error("Acesso negado. Autenticação necessária.")
  }

  return user
}

/**
 * Rate limiting simples baseado em IP
 * Armazena tentativas em memória (resetado a cada restart)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  request: NextRequest,
  maxRequests = 10,
  windowMs = 60000, // 1 minuto
): boolean {
  const ip = request.ip || request.headers.get("x-forwarded-for") || "unknown"
  const now = Date.now()

  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    // Primeira tentativa ou janela expirou
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false // Rate limit excedido
  }

  record.count++
  return true
}

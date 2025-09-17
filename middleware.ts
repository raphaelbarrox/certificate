import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: "",
            ...options,
          })
        },
      },
    },
  )

  const isApiRoute = request.nextUrl.pathname.startsWith("/api/")

  if (isApiRoute) {
    // Log de auditoria para todas as requisições de API
    const clientIP = request.ip || request.headers.get("x-forwarded-for") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"
    const timestamp = new Date().toISOString()

    console.log(
      `[SECURITY AUDIT] ${timestamp} - ${request.method} ${request.nextUrl.pathname} - IP: ${clientIP} - UA: ${userAgent}`,
    )

    // Verificar se é uma rota administrativa crítica
    const adminRoutes = ["/api/storage/cleanup", "/api/templates/test-email"]

    const isAdminRoute = adminRoutes.some((route) => request.nextUrl.pathname.startsWith(route))

    if (isAdminRoute) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        console.log(`[SECURITY BLOCK] Unauthorized access attempt to admin route: ${request.nextUrl.pathname}`)
        return NextResponse.json({ error: "Acesso não autorizado. Esta rota requer autenticação." }, { status: 401 })
      }
    }

    // Rate limiting básico por IP
    const rateLimitKey = `rate_limit_${clientIP}`
    const rateLimitHeader = request.headers.get("x-rate-limit-count") || "0"
    const requestCount = Number.parseInt(rateLimitHeader) + 1

    if (requestCount > 100) {
      // 100 requests por período
      console.log(`[SECURITY BLOCK] Rate limit exceeded for IP: ${clientIP}`)
      return NextResponse.json({ error: "Muitas requisições. Tente novamente mais tarde." }, { status: 429 })
    }

    // Adicionar headers de segurança
    response.headers.set("x-rate-limit-count", requestCount.toString())
    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-XSS-Protection", "1; mode=block")
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}

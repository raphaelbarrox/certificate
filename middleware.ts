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

  const pathname = request.nextUrl.pathname
  const clientIP = request.ip || request.headers.get("x-forwarded-for") || "unknown"

  // Rate limiting para APIs de certificados
  if (
    pathname.startsWith("/api/issue-certificate") ||
    pathname.startsWith("/api/check-certificate") ||
    pathname.startsWith("/api/generate-certificate")
  ) {
    const rateLimitKey = `rate_limit:${clientIP}:${pathname}`
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minuto
    const maxRequests = 10 // máximo 10 requests por minuto

    // Simular rate limiting (em produção usar Redis)
    const requestCount = Number.parseInt(request.headers.get("x-request-count") || "0")
    if (requestCount > maxRequests) {
      return new NextResponse(JSON.stringify({ error: "Muitas tentativas. Tente novamente em 1 minuto." }), {
        status: 429,
        headers: { "content-type": "application/json" },
      })
    }
  }

  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}

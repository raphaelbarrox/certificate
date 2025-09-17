import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { AdvancedRateLimiter } from "@/lib/advanced-rate-limiter"

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
    const clientIP = request.ip || request.headers.get("x-forwarded-for") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"
    const timestamp = new Date().toISOString()

    let endpoint = "default"
    if (request.nextUrl.pathname.includes("/issue-certificate")) endpoint = "issue"
    else if (request.nextUrl.pathname.includes("/generate-certificate")) endpoint = "generate"
    else if (request.nextUrl.pathname.includes("/search-certificates")) endpoint = "search"
    else if (request.nextUrl.pathname.includes("/check-certificate")) endpoint = "check"
    else if (request.nextUrl.pathname.includes("/download")) endpoint = "download"

    const rateLimitResult = AdvancedRateLimiter.isAllowed(clientIP, endpoint)

    if (!rateLimitResult.allowed) {
      console.log(
        `[SECURITY BLOCK] ${timestamp} - Rate limit exceeded - ${request.method} ${request.nextUrl.pathname} - IP: ${clientIP} - Reason: ${rateLimitResult.reason}`,
      )

      const errorResponse = NextResponse.json(
        {
          error: rateLimitResult.reason || "Muitas requisições. Tente novamente mais tarde.",
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429 },
      )

      if (rateLimitResult.retryAfter) {
        errorResponse.headers.set("Retry-After", rateLimitResult.retryAfter.toString())
      }
      errorResponse.headers.set("X-RateLimit-Limit", "Varia por endpoint")
      errorResponse.headers.set("X-RateLimit-Remaining", "0")

      return errorResponse
    }

    console.log(
      `[SECURITY AUDIT] ${timestamp} - ${request.method} ${request.nextUrl.pathname} - IP: ${clientIP} - UA: ${userAgent}`,
    )

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

    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-XSS-Protection", "1; mode=block")
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}

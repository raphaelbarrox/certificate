import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const publicRoutes = ["/", "/auth/login", "/auth/register", "/auth/callback"]
  const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith("/auth/")

  // Se não há usuário e está tentando acessar rota protegida
  if (!user && !isPublicRoute) {
    console.log("[v0] Middleware: Redirecionando usuário não autenticado:", pathname)
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  // Se há usuário e está em página de login/register, redireciona para dashboard
  if (user && (pathname === "/auth/login" || pathname === "/auth/register" || pathname === "/")) {
    console.log("[v0] Middleware: Redirecionando usuário autenticado para dashboard")
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

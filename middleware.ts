import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { addSecurityHeaders } from "@/lib/security-headers"

export function middleware(request: NextRequest) {
  // Aplicar headers de segurança a todas as respostas
  const response = NextResponse.next()

  return addSecurityHeaders(response)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}

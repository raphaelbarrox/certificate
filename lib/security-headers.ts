import { NextResponse } from "next/server"

export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Necessário para Next.js
      "style-src 'self' 'unsafe-inline'", // Necessário para Tailwind
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  )

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY")

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff")

  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Permissions policy
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")

  return response
}

export function createSecureResponse(data: any, status = 200): NextResponse {
  const response = NextResponse.json(data, { status })
  return addSecurityHeaders(response)
}

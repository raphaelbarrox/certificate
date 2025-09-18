import type { NextRequest } from "next/server"

// Simple in-memory rate limiting (for production, consider Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

interface RateLimitConfig {
  requests: number
  windowMs: number
}

// Rate limit configurations for different endpoints
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "/api/issue-certificate": { requests: 5, windowMs: 60000 }, // 5 requests per minute
  "/api/generate-certificate": { requests: 10, windowMs: 60000 }, // 10 requests per minute
  "/api/email/test": { requests: 3, windowMs: 60000 }, // 3 requests per minute
  "/api/search-certificates": { requests: 30, windowMs: 60000 }, // 30 requests per minute
  "/api/check-certificate": { requests: 20, windowMs: 60000 }, // 20 requests per minute
  "/api/certificates/[id]/download": { requests: 50, windowMs: 60000 }, // 50 requests per minute
  "/api/storage/cleanup": { requests: 10, windowMs: 60000 }, // 10 requests per minute
  "/api/templates/public/[linkId]": { requests: 60, windowMs: 60000 }, // 60 requests per minute
}

export function getRealIP(request: NextRequest): string {
  // Get real IP from various headers (for production with proxies)
  const forwarded = request.headers.get("x-forwarded-for")
  const realIP = request.headers.get("x-real-ip")
  const cfConnectingIP = request.headers.get("cf-connecting-ip")

  if (cfConnectingIP) return cfConnectingIP
  if (realIP) return realIP
  if (forwarded) return forwarded.split(",")[0].trim()

  return request.ip || "unknown"
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = identifier

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    // 1% chance to cleanup
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetTime) {
        rateLimitMap.delete(k)
      }
    }
  }

  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    // First request or window expired
    const resetTime = now + config.windowMs
    rateLimitMap.set(key, { count: 1, resetTime })
    return { allowed: true, remaining: config.requests - 1, resetTime }
  }

  if (record.count >= config.requests) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetTime: record.resetTime }
  }

  // Increment count
  record.count++
  rateLimitMap.set(key, record)

  return {
    allowed: true,
    remaining: config.requests - record.count,
    resetTime: record.resetTime,
  }
}

export function createRateLimitResponse(resetTime: number) {
  const resetInSeconds = Math.ceil((resetTime - Date.now()) / 1000)

  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: `Too many requests. Try again in ${resetInSeconds} seconds.`,
      resetIn: resetInSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": resetInSeconds.toString(),
        "X-RateLimit-Reset": Math.ceil(resetTime / 1000).toString(),
      },
    },
  )
}

export function addRateLimitHeaders(response: Response, remaining: number, resetTime: number): Response {
  const newHeaders = new Headers(response.headers)
  newHeaders.set("X-RateLimit-Remaining", remaining.toString())
  newHeaders.set("X-RateLimit-Reset", Math.ceil(resetTime / 1000).toString())

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}

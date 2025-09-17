interface RateLimitConfig {
  requests: number
  windowMs: number
  blockDurationMs?: number
  skipSuccessfulRequests?: boolean
}

interface RateLimitRecord {
  count: number
  resetTime: number
  blocked?: boolean
  blockedUntil?: number
  suspiciousActivity?: number
}

export class AdvancedRateLimiter {
  private static requests = new Map<string, RateLimitRecord>()
  private static suspiciousIPs = new Set<string>()

  private static endpointConfigs: Record<string, RateLimitConfig> = {
    issue: { requests: 3, windowMs: 300000, blockDurationMs: 600000 }, // 3 por 5min, bloqueia 10min
    generate: { requests: 5, windowMs: 300000, blockDurationMs: 300000 }, // 5 por 5min, bloqueia 5min
    search: { requests: 15, windowMs: 60000, blockDurationMs: 120000 }, // 15 por 1min, bloqueia 2min
    check: { requests: 8, windowMs: 60000, blockDurationMs: 180000 }, // 8 por 1min, bloqueia 3min
    download: { requests: 20, windowMs: 60000, blockDurationMs: 60000 }, // 20 por 1min, bloqueia 1min
    default: { requests: 50, windowMs: 60000, blockDurationMs: 300000 }, // Padrão geral
  }

  static isAllowed(
    identifier: string,
    endpoint = "default",
  ): { allowed: boolean; reason?: string; retryAfter?: number } {
    const now = Date.now()
    const config = this.endpointConfigs[endpoint] || this.endpointConfigs.default
    const record = this.requests.get(identifier) || { count: 0, resetTime: now + config.windowMs }

    if (record.blocked && record.blockedUntil && now < record.blockedUntil) {
      return {
        allowed: false,
        reason: "IP temporariamente bloqueado por atividade suspeita",
        retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
      }
    }

    if (now > record.resetTime) {
      record.count = 0
      record.resetTime = now + config.windowMs
      record.blocked = false
      record.blockedUntil = undefined
    }

    if (record.count >= config.requests) {
      // Marcar como suspeito se exceder muito o limite
      if (record.count > config.requests * 2) {
        record.suspiciousActivity = (record.suspiciousActivity || 0) + 1
        this.suspiciousIPs.add(identifier)

        if (record.suspiciousActivity >= 3) {
          record.blocked = true
          record.blockedUntil = now + (config.blockDurationMs || 300000)
          console.log(`[SECURITY BLOCK] IP ${identifier} bloqueado por atividade suspeita excessiva`)
        }
      }

      return {
        allowed: false,
        reason: "Rate limit excedido",
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      }
    }

    record.count++
    this.requests.set(identifier, record)

    return { allowed: true }
  }

  static getSecurityStats() {
    const now = Date.now()
    const activeBlocks = Array.from(this.requests.entries()).filter(
      ([_, record]) => record.blocked && record.blockedUntil && now < record.blockedUntil,
    ).length

    return {
      totalTrackedIPs: this.requests.size,
      suspiciousIPs: this.suspiciousIPs.size,
      activeBlocks,
      endpointConfigs: this.endpointConfigs,
    }
  }

  static cleanup() {
    const now = Date.now()
    const cutoff = now - 3600000 // 1 hora

    for (const [key, record] of this.requests.entries()) {
      if (record.resetTime < cutoff && !record.blocked) {
        this.requests.delete(key)
      }
    }
  }
}

if (typeof setInterval !== "undefined") {
  setInterval(() => AdvancedRateLimiter.cleanup(), 1800000)
}

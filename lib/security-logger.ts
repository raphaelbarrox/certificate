interface SecurityEvent {
  type: "rate_limit" | "validation_error" | "unauthorized_access" | "suspicious_activity"
  ip: string
  userAgent?: string
  endpoint: string
  details: string
  timestamp: Date
}

class SecurityLogger {
  private events: SecurityEvent[] = []
  private maxEvents = 1000

  log(event: Omit<SecurityEvent, "timestamp">) {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    }

    this.events.push(securityEvent)

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }

    // Log to console for monitoring
    console.log(`[SECURITY] ${event.type.toUpperCase()}: ${event.details}`, {
      ip: event.ip,
      endpoint: event.endpoint,
      userAgent: event.userAgent,
    })
  }

  getRecentEvents(limit = 100): SecurityEvent[] {
    return this.events.slice(-limit)
  }

  getEventsByIP(ip: string, limit = 50): SecurityEvent[] {
    return this.events.filter((event) => event.ip === ip).slice(-limit)
  }
}

export const securityLogger = new SecurityLogger()

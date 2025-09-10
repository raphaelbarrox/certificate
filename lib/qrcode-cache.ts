import QRCode from "qrcode"

interface CachedQRCode {
  dataUrl: string
  timestamp: number
  originalUrl: string
}

export class QRCodeCache {
  private static cache = new Map<string, CachedQRCode>()
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000 // 24 horas - QR codes raramente mudam
  private static readonly MAX_CACHE_SIZE = 500 // 500 QR codes

  private static hits = 0
  private static misses = 0

  static async getQRCodeDataUrl(url: string, options?: any): Promise<string> {
    const cacheKey = `${url}-${JSON.stringify(options || {})}`
    const cached = this.cache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.hits++
      return cached.dataUrl
    }

    this.misses++

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 256,
        ...options,
      })

      // Limpar cache se necessário
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        const entries = Array.from(this.cache.entries())
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
        const toRemove = Math.ceil(this.MAX_CACHE_SIZE * 0.1)

        for (let i = 0; i < toRemove; i++) {
          this.cache.delete(entries[i][0])
        }
      }

      this.cache.set(cacheKey, {
        dataUrl: qrCodeDataUrl,
        timestamp: Date.now(),
        originalUrl: url,
      })

      return qrCodeDataUrl
    } catch (error) {
      console.error(`Failed to generate QR Code for URL: ${url}`, error)
      return ""
    }
  }

  static clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  static getStats(): { size: number; maxSize: number; hitRate: number; hits: number; misses: number } {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0

    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      hitRate: Math.round(hitRate * 100) / 100,
      hits: this.hits,
      misses: this.misses,
    }
  }

  static cleanExpired(): number {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key)
        cleanedCount++
      }
    }

    return cleanedCount
  }
}

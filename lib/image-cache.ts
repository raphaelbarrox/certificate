interface CachedImage {
  dataUrl: string
  timestamp: number
  originalUrl: string
}

export class ImageCache {
  private static cache = new Map<string, CachedImage>()
  private static readonly CACHE_TTL = 4 * 60 * 60 * 1000 // 4 horas (era 1 hora)
  private static readonly MAX_CACHE_SIZE = 200 // 200 imagens (era 100)

  private static hits = 0
  private static misses = 0

  static async getImageDataUrl(url: string): Promise<string> {
    const cached = this.cache.get(url)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.hits++
      return cached.dataUrl
    }

    this.misses++

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`)

      const contentType = response.headers.get("content-type") || "image/jpeg"
      const buffer = Buffer.from(await response.arrayBuffer())
      const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`

      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        // Remove os 10% mais antigos em vez de apenas o primeiro
        const entries = Array.from(this.cache.entries())
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
        const toRemove = Math.ceil(this.MAX_CACHE_SIZE * 0.1)

        for (let i = 0; i < toRemove; i++) {
          this.cache.delete(entries[i][0])
        }
      }

      this.cache.set(url, {
        dataUrl,
        timestamp: Date.now(),
        originalUrl: url,
      })

      return dataUrl
    } catch (error) {
      console.error(`Failed to convert image URL to data URL: ${url}`, error)
      return ""
    }
  }

  static invalidateForTemplate(templateId: string): number {
    // Para imagens, invalidamos todas já que não temos referência direta ao template
    // Isso garante que imagens atualizadas sejam recarregadas
    let invalidatedCount = 0
    const now = Date.now()

    // Invalida imagens mais antigas que 1 hora durante atualizações
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > 60 * 60 * 1000) {
        // 1 hora
        this.cache.delete(key)
        invalidatedCount++
      }
    }

    if (invalidatedCount > 0) {
      console.log(`[Image Cache] Invalidated ${invalidatedCount} old entries for template update`)
    }
    return invalidatedCount
  }

  static invalidateUrl(url: string): boolean {
    const deleted = this.cache.delete(url)
    if (deleted) {
      console.log(`[Image Cache] Invalidated specific URL: ${url}`)
    }
    return deleted
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

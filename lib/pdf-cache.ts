interface CachedPDF {
  data: ArrayBuffer
  timestamp: number
  templateId: string
  recipientHash: string
}

export class PDFCache {
  private static cache = new Map<string, CachedPDF>()
  private static readonly CACHE_TTL = 2 * 60 * 60 * 1000 // 2 horas (era 30 minutos)
  private static readonly MAX_CACHE_SIZE = 100 // 100 PDFs (era 50)

  private static hits = 0
  private static misses = 0

  static generateCacheKey(templateId: string, recipientData: Record<string, any>): string {
    const dataString = JSON.stringify(recipientData, Object.keys(recipientData).sort())
    return `${templateId}-${btoa(dataString).slice(0, 16)}`
  }

  static get(templateId: string, recipientData: Record<string, any>): ArrayBuffer | null {
    const key = this.generateCacheKey(templateId, recipientData)
    const cached = this.cache.get(key)

    if (!cached) {
      this.misses++
      return null
    }

    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key)
      this.misses++
      return null
    }

    this.hits++
    return cached.data
  }

  static set(templateId: string, recipientData: Record<string, any>, pdfData: ArrayBuffer): void {
    const key = this.generateCacheKey(templateId, recipientData)

    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }

    this.cache.set(key, {
      data: pdfData,
      timestamp: Date.now(),
      templateId,
      recipientHash: key,
    })
  }

  static invalidateForTemplate(templateId: string): number {
    let invalidatedCount = 0
    for (const [key, value] of this.cache.entries()) {
      if (value.templateId === templateId) {
        this.cache.delete(key)
        invalidatedCount++
      }
    }
    console.log(`[PDF Cache] Invalidated ${invalidatedCount} entries for template ${templateId}`)
    return invalidatedCount
  }

  static invalidateSpecific(templateId: string, recipientData: Record<string, any>): boolean {
    const key = this.generateCacheKey(templateId, recipientData)
    const deleted = this.cache.delete(key)
    if (deleted) {
      console.log(`[PDF Cache] Invalidated specific cache entry: ${key}`)
    }
    return deleted
  }

  static forceInvalidateForUpdate(templateId: string, recipientData: Record<string, any>): void {
    // Invalida cache específico
    this.invalidateSpecific(templateId, recipientData)

    // Invalida todo o template para garantir
    this.invalidateForTemplate(templateId)

    console.log(`[PDF Cache] Force invalidated all cache for template ${templateId} during update`)
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

  static getCacheEntriesByTemplate(templateId: string): CachedPDF[] {
    const entries: CachedPDF[] = []
    for (const [key, value] of this.cache.entries()) {
      if (value.templateId === templateId) {
        entries.push(value)
      }
    }
    return entries
  }

  static getMemoryUsage(): { totalSizeMB: number; averageSizeMB: number } {
    let totalSize = 0
    for (const [key, value] of this.cache.entries()) {
      totalSize += value.data.byteLength
    }

    const totalSizeMB = totalSize / (1024 * 1024)
    const averageSizeMB = this.cache.size > 0 ? totalSizeMB / this.cache.size : 0

    return {
      totalSizeMB: Math.round(totalSizeMB * 100) / 100,
      averageSizeMB: Math.round(averageSizeMB * 100) / 100,
    }
  }
}

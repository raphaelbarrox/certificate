import { createClient } from "@/lib/supabase/client"

export interface DashboardStats {
  today: number
  change: number
  last7days: number
  totalCertificates: number
  totalTemplates: number
  thisMonthCertificates: number
}

export interface ChartData {
  date: string
  Certificados: number
}

export class DashboardQueries {
  private static certificatesCache = new Map<string, { data: any; timestamp: number }>()
  private static templatesCache = new Map<string, { data: any; timestamp: number }>()
  private static foldersCache = new Map<string, { data: any; timestamp: number }>()
  private static statsCache = new Map<string, { data: any; timestamp: number }>()
  private static chartCache = new Map<string, { data: any; timestamp: number }>()

  private static CACHE_TTL = 15 * 60 * 1000 // 15 minutos (era 2 minutos)
  private static FOLDERS_CACHE_TTL = 30 * 60 * 1000 // 30 minutos (era 10 minutos)
  private static STATS_CACHE_TTL = 10 * 60 * 1000 // 10 minutos para estatísticas
  private static CHART_CACHE_TTL = 20 * 60 * 1000 // 20 minutos para gráficos

  private static cacheHits = new Map<string, number>()
  private static cacheMisses = new Map<string, number>()

  private get supabase() {
    return createClient()
  }

  private static getCacheKey(type: string, userId: string, ...params: (string | number | null)[]): string {
    return `${type}:${userId}:${params.filter((p) => p !== null && p !== undefined).join(":")}`
  }

  private static invalidateCacheByPattern(pattern: RegExp) {
    const keysToDelete: string[] = []

    for (const [cacheMap, mapName] of [
      [this.certificatesCache, "certificates"],
      [this.templatesCache, "templates"],
      [this.foldersCache, "folders"],
      [this.statsCache, "stats"],
      [this.chartCache, "chart"],
    ] as const) {
      for (const key of cacheMap.keys()) {
        if (pattern.test(key)) {
          keysToDelete.push(`${mapName}:${key}`)
          cacheMap.delete(key)
        }
      }
    }

    console.log(`[v0] Cache invalidated: ${keysToDelete.length} keys`, keysToDelete)
  }

  private static recordCacheMetric(key: string, hit: boolean) {
    const metric = hit ? this.cacheHits : this.cacheMisses
    metric.set(key, (metric.get(key) || 0) + 1)
  }

  async getDashboardStats(userId: string): Promise<DashboardStats> {
    const cacheKey = DashboardQueries.getCacheKey("stats", userId)
    const cached = DashboardQueries.statsCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < DashboardQueries.STATS_CACHE_TTL) {
      DashboardQueries.recordCacheMetric("stats", true)
      console.log("[v0] Cache hit para dashboard stats")
      return cached.data
    }

    DashboardQueries.recordCacheMetric("stats", false)

    const now = new Date()
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const yesterdayUTC = new Date(todayUTC)
    yesterdayUTC.setUTCDate(todayUTC.getUTCDate() - 1)
    const sevenDaysAgoUTC = new Date(todayUTC)
    sevenDaysAgoUTC.setUTCDate(todayUTC.getUTCDate() - 6)

    console.log("[v0] Parâmetros para get_dashboard_stats:", {
      p_user_id: userId,
      p_today: todayUTC.toISOString(),
      p_yesterday: yesterdayUTC.toISOString(),
      p_seven_days_ago: sevenDaysAgoUTC.toISOString(),
    })

    const { data, error } = await this.supabase.rpc("get_dashboard_stats", {
      p_user_id: userId,
      p_today: todayUTC.toISOString(),
      p_yesterday: yesterdayUTC.toISOString(),
      p_seven_days_ago: sevenDaysAgoUTC.toISOString(),
    })

    if (error) {
      console.error("Dashboard stats error:", error)
      throw error
    }

    console.log("[v0] Dados brutos da função SQL:", data)
    const stats = data[0] || {}
    console.log("[v0] Stats processadas:", stats)
    console.log("[v0] this_month_count do SQL:", stats.this_month_count)

    const todayCount = stats.today_count || 0
    const yesterdayCount = stats.yesterday_count || 0
    const change =
      yesterdayCount > 0 ? ((todayCount - yesterdayCount) / yesterdayCount) * 100 : todayCount > 0 ? 100 : 0

    const result = {
      today: todayCount,
      change,
      last7days: stats.last7days_count || 0,
      totalCertificates: stats.total_certificates || 0,
      totalTemplates: stats.total_templates || 0,
      thisMonthCertificates: stats.this_month_count || 0,
    }

    DashboardQueries.statsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    })

    console.log("[v0] Resultado final getDashboardStats:", result)
    return result
  }

  async getChartData(userId: string): Promise<ChartData[]> {
    const cacheKey = DashboardQueries.getCacheKey("chart", userId)
    const cached = DashboardQueries.chartCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < DashboardQueries.CHART_CACHE_TTL) {
      DashboardQueries.recordCacheMetric("chart", true)
      console.log("[v0] Cache hit para chart data")
      return cached.data
    }

    DashboardQueries.recordCacheMetric("chart", false)

    const now = new Date()
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const sevenDaysAgoUTC = new Date(todayUTC)
    sevenDaysAgoUTC.setUTCDate(todayUTC.getUTCDate() - 6)

    const { data, error } = await this.supabase.rpc("get_chart_data", {
      p_user_id: userId,
      p_start_date: sevenDaysAgoUTC.toISOString(),
      p_end_date: todayUTC.toISOString(),
    })

    if (error) {
      console.error("Chart data error:", error)
      throw error
    }

    // Preencher dias sem dados com 0
    const countsByDay = new Map<string, number>()
    for (let i = 0; i < 7; i++) {
      const d = new Date(todayUTC)
      d.setUTCDate(todayUTC.getUTCDate() - i)
      const day = String(d.getUTCDate()).padStart(2, "0")
      const month = String(d.getUTCMonth() + 1).padStart(2, "0")
      countsByDay.set(`${day}/${month}`, 0)
    }

    // Preencher com dados reais
    data?.forEach((item: any) => {
      const date = new Date(item.date)
      const day = String(date.getUTCDate()).padStart(2, "0")
      const month = String(date.getUTCMonth() + 1).padStart(2, "0")
      const dateKey = `${day}/${month}`
      countsByDay.set(dateKey, item.count)
    })

    const result = Array.from(countsByDay.entries())
      .map(([date, count]) => ({ date, Certificados: count }))
      .reverse()

    DashboardQueries.chartCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    })

    return result
  }

  async getCertificatesPaginated(userId: string, page = 1, pageSize = 10, searchTerm?: string, templateId?: string) {
    const cacheKey = DashboardQueries.getCacheKey(
      "certificates",
      userId,
      page,
      pageSize,
      searchTerm || "",
      templateId || "",
    )
    const cached = DashboardQueries.certificatesCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < DashboardQueries.CACHE_TTL) {
      DashboardQueries.recordCacheMetric("certificates", true)
      console.log("[v0] Cache hit para certificados paginados")
      return cached.data
    }

    DashboardQueries.recordCacheMetric("certificates", false)

    let query = this.supabase
      .from("issued_certificates")
      .select(
        `
        id,
        certificate_number,
        recipient_data,
        recipient_email,
        issued_at,
        certificate_templates!inner(id, title, user_id)
      `,
        { count: "exact" },
      )
      .eq("certificate_templates.user_id", userId)
      .order("issued_at", { ascending: false })

    if (templateId && templateId !== "all") {
      query = query.eq("template_id", templateId)
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      query = query.or(
        `certificate_number.ilike.%${searchLower}%,recipient_email.ilike.%${searchLower}%,recipient_data->>name.ilike.%${searchLower}%,recipient_data->>nome_completo.ilike.%${searchLower}%`,
      )
    }

    // Paginação
    const startIndex = (page - 1) * pageSize
    query = query.range(startIndex, startIndex + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("Certificates pagination error:", error)
      throw error
    }

    const result = {
      certificates: data || [],
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
    }

    DashboardQueries.certificatesCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    })

    return result
  }

  static invalidateCertificatesCache(userId: string, templateId?: string) {
    const pattern = templateId
      ? new RegExp(`^certificates:${userId}:.*:.*:${templateId}$`)
      : new RegExp(`^certificates:${userId}:`)

    this.invalidateCacheByPattern(pattern)

    // Também invalida estatísticas relacionadas
    this.statsCache.delete(DashboardQueries.getCacheKey("stats", userId))
    this.chartCache.delete(DashboardQueries.getCacheKey("chart", userId))
  }

  async getTemplatesPaginated(
    userId: string,
    folderId: string | null = null,
    page = 1,
    pageSize = 10,
    searchTerm?: string,
  ) {
    const cacheKey = DashboardQueries.getCacheKey(
      "templates",
      userId,
      folderId || "root",
      page,
      pageSize,
      searchTerm || "",
    )
    const cached = DashboardQueries.templatesCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < DashboardQueries.CACHE_TTL) {
      DashboardQueries.recordCacheMetric("templates", true)
      console.log("[v0] Cache hit para templates paginados")
      return cached.data
    }

    DashboardQueries.recordCacheMetric("templates", false)

    let query = this.supabase
      .from("certificate_templates")
      .select(
        `
        id,
        title,
        is_active,
        created_at,
        updated_at,
        placeholders,
        public_link_id,
        folder_id,
        user_id,
        template_data,
        form_design,
        description,
        thumbnail_url
      `,
        { count: "exact" },
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (folderId) {
      query = query.eq("folder_id", folderId)
    } else {
      query = query.is("folder_id", null)
    }

    if (searchTerm) {
      query = query.ilike("title", `%${searchTerm}%`)
    }

    // Paginação
    const startIndex = (page - 1) * pageSize
    query = query.range(startIndex, startIndex + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("Templates pagination error:", error)
      throw error
    }

    const result = {
      templates: data || [],
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
    }

    DashboardQueries.templatesCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    })

    return result
  }

  async getFoldersWithCache(userId: string) {
    const cacheKey = DashboardQueries.getCacheKey("folders", userId)
    const cached = DashboardQueries.foldersCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < DashboardQueries.FOLDERS_CACHE_TTL) {
      DashboardQueries.recordCacheMetric("folders", true)
      console.log("[v0] Cache hit para pastas")
      return cached.data
    }

    DashboardQueries.recordCacheMetric("folders", false)

    const { data, error } = await this.supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true })

    if (error) {
      if (error.message.includes('relation "public.folders" does not exist')) {
        return { folders: [], foldersEnabled: false }
      }
      throw error
    }

    const result = { folders: data || [], foldersEnabled: true }

    DashboardQueries.foldersCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    })

    return result
  }

  async preloadNextPage(
    userId: string,
    folderId: string | null,
    currentPage: number,
    pageSize = 10,
    searchTerm?: string,
  ) {
    const nextPage = currentPage + 1

    // Verificar se já existe cache para a próxima página
    const cacheKey = DashboardQueries.getCacheKey(
      "templates",
      userId,
      folderId || "root",
      nextPage,
      pageSize,
      searchTerm || "",
    )

    const cached = DashboardQueries.templatesCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < DashboardQueries.CACHE_TTL) {
      console.log("[v0] Preload cancelado - cache já existe para página", nextPage)
      return
    }

    // Executa em background sem await para não bloquear
    this.getTemplatesPaginated(userId, folderId, nextPage, pageSize, searchTerm).catch((error) => {
      console.warn("[v0] Erro no preload da página", nextPage, ":", error)
    })
  }

  static invalidateTemplatesCache(userId: string, folderId?: string | null) {
    console.log("[v0] Invalidando cache de templates para:", { userId, folderId })

    if (folderId !== undefined) {
      // Invalida cache da pasta específica
      const pattern = new RegExp(`^templates:${userId}:${folderId || "root"}:`)
      this.invalidateCacheByPattern(pattern)

      const templatesWithCountsPattern = new RegExp(`^templates-with-counts:${userId}:${folderId || "root"}:`)
      this.invalidateCacheByPattern(templatesWithCountsPattern)
    } else {
      // Invalida todo cache de templates do usuário
      const pattern = new RegExp(`^templates:${userId}:`)
      this.invalidateCacheByPattern(pattern)

      const templatesWithCountsPattern = new RegExp(`^templates-with-counts:${userId}:`)
      this.invalidateCacheByPattern(templatesWithCountsPattern)
    }

    this.statsCache.delete(this.getCacheKey("stats", userId))

    const preloadPattern = new RegExp(`^templates:${userId}:.*:.*:.*:.*`)
    this.invalidateCacheByPattern(preloadPattern)

    console.log("[v0] Cache de templates invalidado completamente")
  }

  static invalidateFoldersCache(userId: string) {
    const cacheKey = DashboardQueries.getCacheKey("folders", userId)
    DashboardQueries.foldersCache.delete(cacheKey)

    // Também invalida cache de templates pois a estrutura de pastas mudou
    const pattern = new RegExp(`^templates:${userId}:`)
    this.invalidateCacheByPattern(pattern)
  }

  async getDashboardDataConsolidated(userId: string) {
    const now = new Date()
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const yesterdayUTC = new Date(todayUTC)
    yesterdayUTC.setUTCDate(todayUTC.getUTCDate() - 1)
    const sevenDaysAgoUTC = new Date(todayUTC)
    sevenDaysAgoUTC.setUTCDate(todayUTC.getUTCDate() - 6)

    const [statsResult, chartResult, templatesResult] = await Promise.allSettled([
      this.supabase.rpc("get_dashboard_stats", {
        p_user_id: userId,
        p_today: todayUTC.toISOString(),
        p_yesterday: yesterdayUTC.toISOString(),
        p_seven_days_ago: sevenDaysAgoUTC.toISOString(),
      }),
      this.supabase.rpc("get_chart_data", {
        p_user_id: userId,
        p_start_date: sevenDaysAgoUTC.toISOString(),
        p_end_date: todayUTC.toISOString(),
      }),
      this.getTemplatesWithCache(userId),
    ])

    return {
      stats: statsResult.status === "fulfilled" ? statsResult.value.data?.[0] : null,
      chartData: chartResult.status === "fulfilled" ? chartResult.value.data : [],
      templates: templatesResult.status === "fulfilled" ? templatesResult.value : [],
    }
  }

  async getTemplatesWithCache(userId: string, folderId?: string | null, limit = 50) {
    const cacheKey = DashboardQueries.getCacheKey("templates-with-counts", userId, folderId || "root", limit)
    const cached = DashboardQueries.templatesCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < DashboardQueries.CACHE_TTL) {
      DashboardQueries.recordCacheMetric("templates-with-counts", true)
      console.log("[v0] Cache hit para templates com contadores")
      return cached.data
    }

    DashboardQueries.recordCacheMetric("templates-with-counts", false)

    const { data, error } = await this.supabase.rpc("get_templates_with_folder_counts", {
      p_user_id: userId,
      p_folder_id: folderId || null,
      p_limit: limit,
    })

    if (error) {
      console.error("Templates query error:", error)
      throw error
    }

    const result = data || []

    DashboardQueries.templatesCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    })

    return result
  }

  async getFoldersWithTemplateCount(userId: string) {
    const cacheKey = DashboardQueries.getCacheKey("folders-with-counts", userId)
    const cached = DashboardQueries.foldersCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < DashboardQueries.FOLDERS_CACHE_TTL) {
      DashboardQueries.recordCacheMetric("folders-with-counts", true)
      console.log("[v0] Cache hit para pastas com contadores")
      return cached.data
    }

    DashboardQueries.recordCacheMetric("folders-with-counts", false)

    const { data, error } = await this.supabase.rpc("get_folders_with_template_counts", {
      p_user_id: userId,
    })

    if (error) {
      if (error.message.includes('relation "public.folders" does not exist')) {
        return { folders: [], foldersEnabled: false }
      }
      throw error
    }

    const result = { folders: data || [], foldersEnabled: true }

    DashboardQueries.foldersCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    })

    return result
  }

  static getCacheMetrics() {
    const totalHits = Array.from(this.cacheHits.values()).reduce((sum, hits) => sum + hits, 0)
    const totalMisses = Array.from(this.cacheMisses.values()).reduce((sum, misses) => sum + misses, 0)
    const hitRate = totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0

    return {
      hitRate: Math.round(hitRate * 100) / 100,
      totalHits,
      totalMisses,
      cacheSize: {
        certificates: this.certificatesCache.size,
        templates: this.templatesCache.size,
        folders: this.foldersCache.size,
        stats: this.statsCache.size,
        chart: this.chartCache.size,
      },
      hitsByType: Object.fromEntries(this.cacheHits.entries()),
      missesByType: Object.fromEntries(this.cacheMisses.entries()),
    }
  }

  static cleanExpiredCache() {
    const now = Date.now()
    const caches = [
      { cache: this.certificatesCache, ttl: this.CACHE_TTL },
      { cache: this.templatesCache, ttl: this.CACHE_TTL },
      { cache: this.foldersCache, ttl: this.FOLDERS_CACHE_TTL },
      { cache: this.statsCache, ttl: this.STATS_CACHE_TTL },
      { cache: this.chartCache, ttl: this.CHART_CACHE_TTL },
    ]

    let cleanedCount = 0
    for (const { cache, ttl } of caches) {
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > ttl) {
          cache.delete(key)
          cleanedCount++
        }
      }
    }

    console.log(`[v0] Cache cleanup: removed ${cleanedCount} expired entries`)
    return cleanedCount
  }
}

export const dashboardQueries = new DashboardQueries()

export default DashboardQueries

import { createClient } from "@/lib/supabase/client"

export interface DashboardStats {
  today: number
  change: number
  last7days: number
  totalCertificates: number
  totalTemplates: number
}

export interface ChartData {
  date: string
  Certificados: number
}

export class DashboardQueries {
  private supabase = createClient()

  async getDashboardStats(userId: string): Promise<DashboardStats> {
    const now = new Date()
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const yesterdayUTC = new Date(todayUTC)
    yesterdayUTC.setUTCDate(todayUTC.getUTCDate() - 1)
    const sevenDaysAgoUTC = new Date(todayUTC)
    sevenDaysAgoUTC.setUTCDate(todayUTC.getUTCDate() - 6)

    // Query única com CTEs para buscar todas as estatísticas
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

    const stats = data[0] || {}
    const todayCount = stats.today_count || 0
    const yesterdayCount = stats.yesterday_count || 0
    const change =
      yesterdayCount > 0 ? ((todayCount - yesterdayCount) / yesterdayCount) * 100 : todayCount > 0 ? 100 : 0

    return {
      today: todayCount,
      change,
      last7days: stats.last7days_count || 0,
      totalCertificates: stats.total_certificates || 0,
      totalTemplates: stats.total_templates || 0,
    }
  }

  async getChartData(userId: string): Promise<ChartData[]> {
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

    return Array.from(countsByDay.entries())
      .map(([date, count]) => ({ date, Certificados: count }))
      .reverse()
  }

  async getCertificatesPaginated(userId: string, page = 1, pageSize = 10, searchTerm?: string, templateId?: string) {
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

    // Filtros opcionais
    if (templateId && templateId !== "all") {
      query = query.eq("template_id", templateId)
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      query = query.or(
        `certificate_number.ilike.%${searchLower}%,recipient_email.ilike.%${searchLower}%,recipient_data->>name.ilike.%${searchLower}%`,
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

    return {
      certificates: data || [],
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
    }
  }

  async getTemplatesWithCache(userId: string, folderId?: string | null) {
    let query = this.supabase
      .from("certificate_templates")
      .select("id, title, is_active, created_at, placeholders, public_link_id, folder_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (folderId) {
      query = query.eq("folder_id", folderId)
    } else {
      query = query.is("folder_id", null)
    }

    const { data, error } = await query

    if (error) {
      console.error("Templates query error:", error)
      throw error
    }

    return data || []
  }
}

export const dashboardQueries = new DashboardQueries()

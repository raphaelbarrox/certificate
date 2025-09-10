"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Award, Plus, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { dashboardQueries, type DashboardStats } from "@/lib/dashboard-queries"

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTemplates: 0,
    totalCertificates: 0,
    thisMonthCertificates: 0,
    today: 0,
    change: 0,
    last7days: 0,
  })
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      loadStats()
    }
  }, [user])

  const loadStats = async () => {
    if (!user) return

    try {
      setLoading(true)
      console.log("[v0] Carregando stats do dashboard para user:", user.id)
      const dashboardStats = await dashboardQueries.getDashboardStats(user.id)
      console.log("[v0] Stats retornadas:", dashboardStats)
      console.log("[v0] thisMonthCertificates:", dashboardStats.thisMonthCertificates)
      setStats(dashboardStats)
    } catch (error) {
      console.error("Error loading stats:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Bem-vindo ao seu painel de controle</p>
          </div>
          <Button asChild>
            <Link href="/dashboard/templates/create">
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Templates</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTemplates}</div>
              <p className="text-xs text-muted-foreground">Templates criados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Certificados</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCertificates}</div>
              <p className="text-xs text-muted-foreground">Total emitidos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Este Mês</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.thisMonthCertificates}</div>
              <p className="text-xs text-muted-foreground">Certificados emitidos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hoje</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.today}</div>
              <p className="text-xs text-muted-foreground">
                {stats.change >= 0 ? "+" : ""}
                {stats.change.toFixed(1)}% em relação a ontem
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild className="w-full justify-start">
                <Link href="/dashboard/templates/create">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Novo Template
                </Link>
              </Button>

              <Button asChild variant="outline" className="w-full justify-start bg-transparent">
                <Link href="/dashboard/templates">
                  <FileText className="h-4 w-4 mr-2" />
                  Ver Todos os Templates
                </Link>
              </Button>

              <Button asChild variant="outline" className="w-full justify-start bg-transparent">
                <Link href="/dashboard/certificates">
                  <Award className="h-4 w-4 mr-2" />
                  Ver Certificados Emitidos
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Começando</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                <p className="mb-2">Para começar a emitir certificados:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Crie um template de certificado</li>
                  <li>Configure os campos do formulário</li>
                  <li>Compartilhe o link público</li>
                  <li>Acompanhe os certificados emitidos</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

"use client"

import type React from "react"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Award,
  Calendar,
  TrendingUp,
  Users,
  FileDown,
  Search,
  ChevronLeft,
  ChevronRight,
  LinkIcon,
  ChevronsUpDown,
  Check,
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useDebounce } from "use-debounce"
import Papa from "papaparse"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import DashboardQueries, { type DashboardStats, type ChartData } from "@/lib/dashboard-queries"

// --- TYPE DEFINITIONS ---
interface Template {
  id: string
  title: string
}

interface IssuedCertificate {
  id: string
  certificate_number: string
  recipient_data: { [key: string]: string }
  recipient_email: string | null
  issued_at: string
  certificate_templates: {
    id: string
    title: string
  } | null
}

const CERTIFICATES_PER_PAGE = 10

// --- UI COMPONENTS ---

const StatCard = ({
  title,
  value,
  change,
  icon: Icon,
  loading,
  description,
}: {
  title: string
  value: string | number
  change?: number
  icon: React.ElementType
  loading: boolean
  description?: string
}) => {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="h-8 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
          <div className="mt-1 h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          {change !== undefined ? (
            <span className={change >= 0 ? "text-emerald-600" : "text-red-600"}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}% em relação a ontem
            </span>
          ) : (
            description || ""
          )}
        </p>
      </CardContent>
    </Card>
  )
}

function TemplateFilterCombobox({
  templates,
  selectedTemplate,
  onSelectTemplate,
  loading,
}: {
  templates: any[]
  selectedTemplate: string
  onSelectTemplate: (templateId: string) => void
  loading: boolean
}) {
  const [open, setOpen] = useState(false)
  const selectedValue = templates.find((t) => t.id === selectedTemplate)?.title || "Todos os Templates"

  if (loading) {
    return <div className="h-10 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700 md:w-[250px]"></div>
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between md:w-[250px] bg-transparent"
        >
          <span className="truncate">{selectedValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 md:w-[250px]">
        <Command>
          <CommandInput placeholder="Buscar template..." />
          <CommandEmpty>Nenhum template encontrado.</CommandEmpty>
          <CommandGroup>
            <CommandList>
              <CommandItem
                onSelect={() => {
                  onSelectTemplate("all")
                  setOpen(false)
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", selectedTemplate === "all" ? "opacity-100" : "opacity-0")} />
                Todos os Templates
              </CommandItem>
              {templates.map((template) => (
                <CommandItem
                  key={template.id}
                  value={template.title}
                  onSelect={() => {
                    onSelectTemplate(template.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", selectedTemplate === template.id ? "opacity-100" : "opacity-0")}
                  />
                  {template.title}
                </CommandItem>
              ))}
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// --- MAIN PAGE COMPONENT ---
export default function CertificatesPage() {
  const { user } = useAuth()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [certificates, setCertificates] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [certificatesLoading, setCertificatesLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState("all")
  const [debouncedSearchTerm] = useDebounce(searchTerm, 800)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCertificates, setTotalCertificates] = useState(0)

  const fetchInitialData = useCallback(async () => {
    if (!user) return

    console.log("[v0] Carregando dados iniciais do dashboard")
    setLoading(true)

    try {
      const dashboardQueries = new DashboardQueries()
      const {
        stats: statsData,
        chartData: chartResult,
        templates: templatesData,
      } = await dashboardQueries.getDashboardDataConsolidated(user.id)

      if (statsData) {
        const todayCount = statsData.today_count || 0
        const yesterdayCount = statsData.yesterday_count || 0
        const change =
          yesterdayCount > 0 ? ((todayCount - yesterdayCount) / yesterdayCount) * 100 : todayCount > 0 ? 100 : 0

        setStats({
          today: todayCount,
          change,
          last7days: statsData.last7days_count || 0,
          totalCertificates: statsData.total_certificates || 0,
          totalTemplates: statsData.total_templates || 0,
        })
      }

      if (chartResult) {
        const now = new Date()
        const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
        const countsByDay = new Map<string, number>()

        for (let i = 0; i < 7; i++) {
          const d = new Date(todayUTC)
          d.setUTCDate(todayUTC.getUTCDate() - i)
          const day = String(d.getUTCDate()).padStart(2, "0")
          const month = String(d.getUTCMonth() + 1).padStart(2, "0")
          countsByDay.set(`${day}/${month}`, 0)
        }

        chartResult.forEach((item: any) => {
          const date = new Date(item.date)
          const day = String(date.getUTCDate()).padStart(2, "0")
          const month = String(date.getUTCMonth() + 1).padStart(2, "0")
          const dateKey = `${day}/${month}`
          countsByDay.set(dateKey, item.count)
        })

        setChartData(
          Array.from(countsByDay.entries())
            .map(([date, count]) => ({ date, Certificados: count }))
            .reverse(),
        )
      }

      setTemplates(templatesData || [])
      console.log("[v0] Dados iniciais carregados com sucesso")
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }, [user])

  const fetchCertificates = useCallback(async () => {
    if (!user) return

    console.log("[v0] Carregando certificados paginados")
    setCertificatesLoading(true)

    try {
      const dashboardQueries = new DashboardQueries()
      const result = await dashboardQueries.getCertificatesPaginated(
        user.id,
        currentPage,
        CERTIFICATES_PER_PAGE,
        debouncedSearchTerm || undefined,
        selectedTemplate !== "all" ? selectedTemplate : undefined,
      )

      setCertificates(result.certificates)
      setTotalPages(result.totalPages)
      setTotalCertificates(result.total)
      console.log("[v0] Certificados carregados:", result.certificates.length)
    } catch (error) {
      console.error("Error fetching certificates:", error)
    } finally {
      setCertificatesLoading(false)
    }
  }, [user, currentPage, debouncedSearchTerm, selectedTemplate])

  useEffect(() => {
    if (user?.id) {
      fetchInitialData()
    }
  }, [user])

  useEffect(() => {
    if (user?.id) {
      fetchCertificates()
    }
  }, [fetchCertificates])

  useEffect(() => {
    setCurrentPage(1)
    // O cache já é invalidado automaticamente quando necessário
  }, [debouncedSearchTerm, selectedTemplate])

  const handleExport = () => {
    if (!user) return
    const formattedData = certificates.map((cert) => ({
      ID_Certificado: cert.certificate_number,
      Nome_Recebedor: cert.recipient_data?.name || cert.recipient_data?.nome_completo || "N/A",
      Email_Recebedor: cert.recipient_email || "N/A",
      Template: cert.certificate_templates?.title || "N/A",
      Data_Emissao: new Date(cert.issued_at).toLocaleString("pt-BR"),
      Link_Publico: `${window.location.origin}/certificates/${cert.certificate_number}`,
    }))
    const csv = Papa.unparse(formattedData)
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "certificados_exportados.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard de Certificados</h1>
            <p className="text-gray-600 dark:text-gray-400">Métricas e visão geral dos certificados emitidos.</p>
          </div>
          <Button onClick={handleExport} disabled={loading || certificates.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            Exportar Dados
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Emitidos Hoje"
            value={stats?.today ?? 0}
            change={stats?.change}
            icon={Calendar}
            loading={loading}
          />
          <StatCard
            title="Últimos 7 Dias"
            value={stats?.last7days ?? 0}
            icon={TrendingUp}
            loading={loading}
            description="Total de emissões na semana"
          />
          <StatCard
            title="Total de Templates"
            value={stats?.totalTemplates ?? 0}
            icon={Award}
            loading={loading}
            description="Modelos de certificados criados"
          />
          <StatCard
            title="Total de Certificados"
            value={stats?.totalCertificates ?? 0}
            icon={Users}
            loading={loading}
            description="Total de emissões na história"
          />
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Tendência de Emissões (Últimos 7 Dias)</CardTitle>
              <CardDescription>Visualização do número de certificados emitidos por dia.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              {loading ? (
                <div className="h-[300px] w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))" }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="Certificados"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Todos os Certificados</CardTitle>
              <CardDescription>Pesquise e gerencie todos os certificados emitidos.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-col gap-4 md:flex-row">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Buscar por número, email ou dados do recebedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <TemplateFilterCombobox
                  templates={templates}
                  selectedTemplate={selectedTemplate}
                  onSelectTemplate={setSelectedTemplate}
                  loading={loading}
                />
              </div>

              {certificatesLoading ? (
                <div className="space-y-2">
                  <div className="h-10 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
                  <div className="h-10 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
                  <div className="h-10 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recebedor</TableHead>
                        <TableHead className="hidden sm:table-cell">Template</TableHead>
                        <TableHead className="hidden md:table-cell">Data de Emissão</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {certificates.length > 0 ? (
                        certificates.map((cert) => (
                          <TableRow key={cert.id}>
                            <TableCell>
                              <div className="font-medium">
                                {cert.recipient_data?.name ||
                                  cert.recipient_data?.nome_completo ||
                                  "Nome não informado"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {cert.recipient_email || cert.certificate_number}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline">{cert.certificate_templates?.title || "N/A"}</Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {new Date(cert.issued_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button asChild variant="ghost" size="icon">
                                <Link href={`/certificates/${cert.certificate_number}`} target="_blank">
                                  <LinkIcon className="h-4 w-4" />
                                  <span className="sr-only">Ver Página</span>
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center">
                            Nenhum certificado encontrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-between space-x-2 py-4">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Mostrando {(currentPage - 1) * CERTIFICATES_PER_PAGE + 1} a{" "}
                    {Math.min(currentPage * CERTIFICATES_PER_PAGE, totalCertificates)} de {totalCertificates}{" "}
                    certificados
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => p - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => p + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Próxima
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

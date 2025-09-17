"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Activity, Mail, AlertCircle, CheckCircle, Clock, Trash2, RefreshCw, Eye, EyeOff, Shield } from "lucide-react"

interface EmailLog {
  id: string
  timestamp: string
  type: "certificate_issued" | "test_email" | "error" | "debug"
  status: "success" | "error" | "pending" | "info"
  message: string
  details?: {
    recipient?: string
    certificateId?: string
    templateId?: string
    error?: string
    apiKeyStatus?: string
    configStatus?: string
    duration?: number
  }
}

interface EmailLogsMonitorProps {
  templateId: string
  isEmailEnabled: boolean
}

export default function EmailLogsMonitor({ templateId, isEmailEnabled }: EmailLogsMonitorProps) {
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [isVisible, setIsVisible] = useState(true)
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<NodeJS.Timeout>()

  // Função para buscar logs do servidor
  const fetchLogs = async () => {
    try {
      console.log("[v0] [EmailLogsMonitor] Buscando logs para template:", templateId)
      const response = await fetch(`/api/email-logs/${templateId}`)
      if (response.ok) {
        const newLogs = await response.json()
        console.log("[v0] [EmailLogsMonitor] Logs recebidos:", newLogs.length)
        setLogs(newLogs)

        // Auto-scroll para o final quando novos logs chegam
        setTimeout(() => {
          if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
            if (scrollContainer) {
              scrollContainer.scrollTop = scrollContainer.scrollHeight
            }
          }
        }, 100)
      } else {
        console.log("[v0] [EmailLogsMonitor] Erro na resposta:", response.status)
      }
    } catch (error) {
      console.error("[v0] Erro ao buscar logs de email:", error)
    }
  }

  // Configurar polling para logs em tempo real
  useEffect(() => {
    if (isEmailEnabled && isAutoRefresh) {
      console.log("[v0] [EmailLogsMonitor] Iniciando monitoramento para template:", templateId)
      fetchLogs() // Buscar logs iniciais

      intervalRef.current = setInterval(fetchLogs, 3000) // Atualizar a cada 3 segundos

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [templateId, isEmailEnabled, isAutoRefresh])

  // Limpar logs
  const clearLogs = () => {
    setLogs([])
  }

  // Adicionar log manualmente (para testes)
  const addTestLog = () => {
    const testLog: EmailLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type: "debug",
      status: "info",
      message: "🧪 Log de teste - Sistema de monitoramento funcionando",
      details: {
        templateId,
        configStatus: "monitoring_active",
      },
    }
    setLogs((prev) => [...prev, testLog])
  }

  const getStatusIcon = (status: EmailLog["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Activity className="h-4 w-4 text-blue-600" />
    }
  }

  const getStatusBadge = (status: EmailLog["status"]) => {
    const variants = {
      success: "default",
      error: "destructive",
      pending: "secondary",
      info: "outline",
    } as const

    return (
      <Badge variant={variants[status]} className="text-xs">
        {status.toUpperCase()}
      </Badge>
    )
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  if (!isEmailEnabled) {
    return null
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            Monitor de Logs de Email
            {logs.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {logs.length} logs
              </Badge>
            )}
            {isAutoRefresh && (
              <Badge variant="secondary" className="ml-1 text-xs">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                LIVE
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className={isAutoRefresh ? "text-green-600" : "text-gray-400"}
              title={isAutoRefresh ? "Pausar atualização automática" : "Ativar atualização automática"}
            >
              <RefreshCw className={`h-4 w-4 ${isAutoRefresh ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(!isVisible)}
              title={isVisible ? "Ocultar logs" : "Mostrar logs"}
            >
              {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              disabled={logs.length === 0}
              title="Limpar todos os logs"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isVisible && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium mb-1">📊 Sistema de Monitoramento Ativo</p>
                  <ul className="space-y-1 text-xs">
                    <li>
                      • Monitorando emissões de certificado para template:{" "}
                      <code className="bg-blue-100 px-1 rounded">{templateId}</code>
                    </li>
                    <li>• Logs aparecem automaticamente quando certificados são emitidos</li>
                    <li>• Atualização automática a cada 3 segundos {isAutoRefresh ? "✅" : "⏸️"}</li>
                    <li>• Use "Adicionar Log Teste" para verificar se o sistema está funcionando</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Aguardando atividade de email...</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={addTestLog} className="text-xs h-6 bg-transparent">
                  🧪 Adicionar Log Teste
                </Button>
                <Button variant="outline" size="sm" onClick={fetchLogs} className="text-xs h-6 bg-transparent">
                  🔄 Atualizar Agora
                </Button>
              </div>
            </div>

            <Separator />

            <ScrollArea className="h-64 w-full" ref={scrollAreaRef}>
              {logs.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-500">
                  <div className="text-center">
                    <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">Aguardando logs de email</p>
                    <p className="text-xs mt-1">Os logs aparecerão aqui quando:</p>
                    <ul className="text-xs mt-2 space-y-1 text-left">
                      <li>• Alguém solicitar um certificado pelo link público</li>
                      <li>• Você testar o envio de email</li>
                      <li>• Houver erros de configuração</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span className="text-sm font-medium">{log.message}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(log.status)}
                          <span className="text-xs text-gray-500">{formatTime(log.timestamp)}</span>
                        </div>
                      </div>

                      {log.details && (
                        <div className="text-xs text-gray-600 space-y-1 ml-6">
                          {log.details.recipient && <div>📧 Destinatário: {log.details.recipient}</div>}
                          {log.details.certificateId && <div>📄 Certificado ID: {log.details.certificateId}</div>}
                          {log.details.apiKeyStatus && <div>🔑 Status API Key: {log.details.apiKeyStatus}</div>}
                          {log.details.configStatus && <div>⚙️ Status Config: {log.details.configStatus}</div>}
                          {log.details.duration && <div>⏱️ Duração: {log.details.duration}ms</div>}
                          {log.details.error && <div className="text-red-600">❌ Erro: {log.details.error}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="text-xs text-gray-500 bg-green-50 border border-green-200 p-3 rounded">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800 mb-1">✅ Monitor Ativo - Como Funciona:</p>
                  <ul className="space-y-1 text-green-700">
                    <li>
                      1. <strong>Emissão de Certificado:</strong> Quando alguém preenche o formulário público
                    </li>
                    <li>
                      2. <strong>Tentativa de Email:</strong> Sistema tenta enviar email com certificado anexo
                    </li>
                    <li>
                      3. <strong>Log Detalhado:</strong> Todos os passos são registrados aqui em tempo real
                    </li>
                    <li>
                      4. <strong>Debug Completo:</strong> Erros de API Key, configuração, etc. aparecem aqui
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

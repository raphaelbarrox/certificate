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
  status: "success" | "error" | "pending" | "info" | "warning"
  message: string
  details?: {
    recipient?: string
    certificateId?: string
    templateId?: string
    error?: string
    apiKeyStatus?: string
    configStatus?: any
    duration?: number
    attempts?: number
    messageId?: string
    hasFormDesign?: boolean
    hasEmailConfig?: boolean
    configEnabled?: any
    hasResendConfig?: boolean
    hasApiKey?: boolean
    hasKeyHash?: boolean
    configDetails?: any
    suggestion?: string
    enabledType?: string
    availableFields?: string[]
    pdfSize?: string
    keyHash?: string
    stack?: string
    [key: string]: any
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
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
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
      warning: "secondary",
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

  const renderLogDetails = (details: EmailLog["details"]) => {
    if (!details) return null

    const renderValue = (value: any): string => {
      if (typeof value === "object" && value !== null) {
        return JSON.stringify(value, null, 2)
      }
      return String(value)
    }

    const importantFields = [
      "recipient",
      "certificateId",
      "error",
      "suggestion",
      "apiKeyStatus",
      "messageId",
      "attempts",
      "duration",
      "pdfSize",
    ]

    const configFields = [
      "hasFormDesign",
      "hasEmailConfig",
      "configEnabled",
      "enabledType",
      "hasResendConfig",
      "hasApiKey",
      "hasKeyHash",
      "configDetails",
    ]

    const debugFields = Object.keys(details).filter(
      (key) => !importantFields.includes(key) && !configFields.includes(key),
    )

    return (
      <div className="text-xs space-y-2 ml-6 mt-2">
        {/* Informações Importantes */}
        {importantFields.some((field) => details[field] !== undefined) && (
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <div className="font-medium text-blue-800 mb-1">📋 Informações Principais:</div>
            <div className="space-y-1 text-blue-700">
              {details.recipient && (
                <div>
                  📧 <strong>Destinatário:</strong> {details.recipient}
                </div>
              )}
              {details.certificateId && (
                <div>
                  📄 <strong>Certificado ID:</strong> {details.certificateId}
                </div>
              )}
              {details.messageId && (
                <div>
                  ✉️ <strong>Message ID:</strong> {details.messageId}
                </div>
              )}
              {details.attempts && (
                <div>
                  🔄 <strong>Tentativas:</strong> {details.attempts}
                </div>
              )}
              {details.duration && (
                <div>
                  ⏱️ <strong>Duração:</strong> {details.duration}ms
                </div>
              )}
              {details.pdfSize && (
                <div>
                  📎 <strong>Tamanho PDF:</strong> {details.pdfSize}
                </div>
              )}
              {details.apiKeyStatus && (
                <div>
                  🔑 <strong>Status API Key:</strong> {details.apiKeyStatus}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Configuração de Email */}
        {configFields.some((field) => details[field] !== undefined) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
            <div className="font-medium text-yellow-800 mb-1">⚙️ Configuração de Email:</div>
            <div className="space-y-1 text-yellow-700">
              {details.hasFormDesign !== undefined && (
                <div>
                  📋 <strong>Form Design:</strong> {details.hasFormDesign ? "✅ Existe" : "❌ Não encontrado"}
                </div>
              )}
              {details.hasEmailConfig !== undefined && (
                <div>
                  📧 <strong>Email Config:</strong> {details.hasEmailConfig ? "✅ Existe" : "❌ Não encontrado"}
                </div>
              )}
              {details.configEnabled !== undefined && (
                <div>
                  🔘 <strong>Email Ativado:</strong> {String(details.configEnabled)} (
                  {details.enabledType || typeof details.configEnabled})
                </div>
              )}
              {details.hasResendConfig !== undefined && (
                <div>
                  🔧 <strong>Resend Config:</strong> {details.hasResendConfig ? "✅ Configurado" : "❌ Não configurado"}
                </div>
              )}
              {details.hasApiKey !== undefined && (
                <div>
                  🔑 <strong>API Key:</strong> {details.hasApiKey ? "✅ Presente" : "❌ Ausente"}
                </div>
              )}
              {details.hasKeyHash !== undefined && (
                <div>
                  🔐 <strong>Key Hash:</strong> {details.hasKeyHash ? "✅ Presente" : "❌ Ausente"}
                </div>
              )}
              {details.configDetails && (
                <div className="mt-2">
                  <div className="font-medium">📝 Detalhes da Configuração:</div>
                  <pre className="bg-yellow-100 p-2 rounded text-xs mt-1 overflow-x-auto">
                    {renderValue(details.configDetails)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Erro e Sugestão */}
        {(details.error || details.suggestion) && (
          <div className="bg-red-50 border border-red-200 rounded p-2">
            {details.error && (
              <div className="text-red-700 mb-2">
                <div className="font-medium text-red-800">❌ Erro:</div>
                <div className="mt-1">{details.error}</div>
              </div>
            )}
            {details.suggestion && (
              <div className="text-orange-700">
                <div className="font-medium text-orange-800">💡 Sugestão:</div>
                <div className="mt-1">{details.suggestion}</div>
              </div>
            )}
            {details.stack && (
              <details className="mt-2">
                <summary className="cursor-pointer text-red-600 font-medium">🔍 Stack Trace</summary>
                <pre className="bg-red-100 p-2 rounded text-xs mt-1 overflow-x-auto whitespace-pre-wrap">
                  {details.stack}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Outros Detalhes de Debug */}
        {debugFields.length > 0 && (
          <details className="bg-gray-50 border border-gray-200 rounded p-2">
            <summary className="cursor-pointer font-medium text-gray-700">
              🔧 Detalhes Técnicos ({debugFields.length})
            </summary>
            <div className="mt-2 space-y-1 text-gray-600">
              {debugFields.map((key) => (
                <div key={key} className="flex flex-col">
                  <span className="font-medium">{key}:</span>
                  <pre className="bg-gray-100 p-1 rounded text-xs mt-1 overflow-x-auto">
                    {renderValue(details[key])}
                  </pre>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    )
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
                    <div key={log.id} className="border rounded-lg p-3 bg-white shadow-sm">
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

                      {renderLogDetails(log.details)}
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

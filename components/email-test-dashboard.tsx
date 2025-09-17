"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle, XCircle, Send, Zap, AlertTriangle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface EmailTestResult {
  success: boolean
  message?: string
  error?: string
  messageId?: string
  attempts?: number
}

export function EmailTestDashboard() {
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [connectionResult, setConnectionResult] = useState<EmailTestResult | null>(null)
  const [sendResult, setSendResult] = useState<EmailTestResult | null>(null)

  const [testConfig, setTestConfig] = useState({
    provider: "resend" as "smtp" | "resend",
    senderEmail: "",
    senderName: "CertGen Test",
    resendApiKey: "",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    smtpSecure: false,
    testSubject: "🧪 Teste de Conexão - CertGen",
    testBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #10b981;">🎉 Teste de Conexão Bem-Sucedido!</h1>
        <p>Se você recebeu este email, suas configurações estão funcionando <strong>perfeitamente</strong>!</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #374151;">📋 Detalhes da Configuração:</h3>
          <p><strong>🚀 Provedor:</strong> {{provider}}</p>
          <p><strong>📧 Email Remetente:</strong> {{senderEmail}}</p>
          <p><strong>⏰ Testado em:</strong> {{timestamp}}</p>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          Agora você pode ativar o envio automático de certificados com confiança! 🎯
        </p>
      </div>
    `,
  })

  const testConnection = async () => {
    setIsTestingConnection(true)
    setConnectionResult(null)

    try {
      const config = {
        enabled: true,
        provider: testConfig.provider,
        senderEmail: testConfig.senderEmail,
        senderName: testConfig.senderName,
        subject: "",
        body: "",
        ...(testConfig.provider === "resend"
          ? {
              resend: {
                apiKey: testConfig.resendApiKey,
                enabled: true,
              },
            }
          : {
              smtp: {
                host: testConfig.smtpHost,
                port: testConfig.smtpPort,
                user: testConfig.smtpUser,
                pass: testConfig.smtpPass,
                secure: testConfig.smtpSecure,
              },
            }),
      }

      const response = await fetch("/api/templates/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", config }),
      })

      const result = await response.json()

      if (response.ok) {
        setConnectionResult({ success: true, message: result.message })
      } else {
        setConnectionResult({ success: false, error: result.error })
      }
    } catch (error) {
      setConnectionResult({
        success: false,
        error: error instanceof Error ? error.message : "Erro inesperado",
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const sendTestEmail = async () => {
    if (!testConfig.senderEmail) {
      setSendResult({ success: false, error: "Email do remetente é obrigatório" })
      return
    }

    setIsSendingTest(true)
    setSendResult(null)

    try {
      const config = {
        enabled: true,
        provider: testConfig.provider,
        senderEmail: testConfig.senderEmail,
        senderName: testConfig.senderName,
        subject: testConfig.testSubject,
        body: testConfig.testBody
          .replace("{{provider}}", testConfig.provider === "resend" ? "Resend API" : "SMTP")
          .replace("{{senderEmail}}", testConfig.senderEmail)
          .replace("{{timestamp}}", new Date().toLocaleString("pt-BR")),
        ...(testConfig.provider === "resend"
          ? {
              resend: {
                apiKey: testConfig.resendApiKey,
                enabled: true,
              },
            }
          : {
              smtp: {
                host: testConfig.smtpHost,
                port: testConfig.smtpPort,
                user: testConfig.smtpUser,
                pass: testConfig.smtpPass,
                secure: testConfig.smtpSecure,
              },
            }),
      }

      const response = await fetch("/api/templates/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", config }),
      })

      const result = await response.json()

      if (response.ok) {
        setSendResult({ success: true, message: result.message, messageId: result.messageId })
      } else {
        setSendResult({ success: false, error: result.error })
      }
    } catch (error) {
      setSendResult({
        success: false,
        error: error instanceof Error ? error.message : "Erro inesperado",
      })
    } finally {
      setIsSendingTest(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Teste de Sistema de Email
          </CardTitle>
          <CardDescription>
            Teste sua configuração de email antes de ativar o envio automático de certificados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label>Provedor de Email</Label>
            <div className="flex gap-2">
              <Button
                variant={testConfig.provider === "resend" ? "default" : "outline"}
                onClick={() => setTestConfig((prev) => ({ ...prev, provider: "resend" }))}
                className="flex-1"
              >
                Resend (Recomendado)
              </Button>
              <Button
                variant={testConfig.provider === "smtp" ? "default" : "outline"}
                onClick={() => setTestConfig((prev) => ({ ...prev, provider: "smtp" }))}
                className="flex-1"
              >
                SMTP Tradicional
              </Button>
            </div>
          </div>

          {/* Basic Config */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="senderEmail">Email Remetente *</Label>
              <Input
                id="senderEmail"
                type="email"
                placeholder="certificados@seudominio.com"
                value={testConfig.senderEmail}
                onChange={(e) => setTestConfig((prev) => ({ ...prev, senderEmail: e.target.value }))}
              />
              {testConfig.provider === "resend" && (
                <p className="text-xs text-muted-foreground">⚠️ Deve ser um domínio verificado no Resend</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderName">Nome Remetente</Label>
              <Input
                id="senderName"
                placeholder="CertGen"
                value={testConfig.senderName}
                onChange={(e) => setTestConfig((prev) => ({ ...prev, senderName: e.target.value }))}
              />
            </div>
          </div>

          {/* Provider Specific Config */}
          {testConfig.provider === "resend" ? (
            <div className="space-y-2">
              <Label htmlFor="resendApiKey">API Key do Resend *</Label>
              <Input
                id="resendApiKey"
                type="password"
                placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={testConfig.resendApiKey}
                onChange={(e) => setTestConfig((prev) => ({ ...prev, resendApiKey: e.target.value }))}
              />
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700">
                  <p className="font-medium">Configuração Resend:</p>
                  <p>
                    1. Acesse{" "}
                    <a href="https://resend.com/api-keys" target="_blank" className="underline" rel="noreferrer">
                      resend.com/api-keys
                    </a>
                  </p>
                  <p>
                    2. Verifique seu domínio em{" "}
                    <a href="https://resend.com/domains" target="_blank" className="underline" rel="noreferrer">
                      resend.com/domains
                    </a>
                  </p>
                  <p>3. Use um email do domínio verificado como remetente</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtpHost">Servidor SMTP *</Label>
                <Input
                  id="smtpHost"
                  placeholder="smtp.gmail.com"
                  value={testConfig.smtpHost}
                  onChange={(e) => setTestConfig((prev) => ({ ...prev, smtpHost: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPort">Porta</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  placeholder="587"
                  value={testConfig.smtpPort}
                  onChange={(e) =>
                    setTestConfig((prev) => ({ ...prev, smtpPort: Number.parseInt(e.target.value) || 587 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpUser">Usuário SMTP *</Label>
                <Input
                  id="smtpUser"
                  placeholder="seu@email.com"
                  value={testConfig.smtpUser}
                  onChange={(e) => setTestConfig((prev) => ({ ...prev, smtpUser: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPass">Senha SMTP *</Label>
                <Input
                  id="smtpPass"
                  type="password"
                  placeholder="sua_senha_ou_app_password"
                  value={testConfig.smtpPass}
                  onChange={(e) => setTestConfig((prev) => ({ ...prev, smtpPass: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Test Actions */}
          <div className="flex gap-3">
            <Button
              onClick={testConnection}
              disabled={isTestingConnection}
              variant="outline"
              className="flex-1 bg-transparent"
            >
              {isTestingConnection ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Testar Conexão
            </Button>

            <Button onClick={sendTestEmail} disabled={isSendingTest || !testConfig.senderEmail} className="flex-1">
              {isSendingTest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar Email Teste
            </Button>
          </div>

          {/* Results */}
          {connectionResult && (
            <Alert className={connectionResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <div className="flex items-start gap-2">
                {connectionResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                )}
                <AlertDescription className={connectionResult.success ? "text-green-800" : "text-red-800"}>
                  <strong>Teste de Conexão:</strong> {connectionResult.message || connectionResult.error}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {sendResult && (
            <Alert className={sendResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <div className="flex items-start gap-2">
                {sendResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                )}
                <AlertDescription className={sendResult.success ? "text-green-800" : "text-red-800"}>
                  <strong>Envio de Teste:</strong> {sendResult.message || sendResult.error}
                  {sendResult.messageId && (
                    <div className="mt-1">
                      <Badge variant="secondary" className="text-xs">
                        ID: {sendResult.messageId}
                      </Badge>
                    </div>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

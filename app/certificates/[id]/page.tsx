import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, User, Hash, Download, Award, Shield } from "lucide-react"
import { notFound } from "next/navigation"
import { applyCpfMask, applyPhoneMask } from "@/lib/masks"
import { SecurityUtils } from "@/lib/security-utils"
import { AuditLogger } from "@/lib/audit-logger"
import { headers } from "next/headers"

interface CertificatePageProps {
  params: { id: string }
}

const formatDisplayValue = (key: string, value: any): string => {
  if (!value) return "N/A"
  const strValue = String(value)
  const lowerKey = key.toLowerCase()

  if (lowerKey.includes("cpf") && strValue.length === 11) {
    return applyCpfMask(strValue)
  }
  if (
    (lowerKey.includes("whatsapp") || lowerKey.includes("telefone")) &&
    (strValue.length === 10 || strValue.length === 11)
  ) {
    return applyPhoneMask(strValue)
  }
  if (lowerKey.includes("data") && /^\d{4}-\d{2}-\d{2}/.test(strValue)) {
    const [year, month, day] = strValue.split("T")[0].split("-")
    return `${day}/${month}/${year}`
  }
  return strValue
}

const formatDisplayLabel = (key: string): string => {
  if (key === "default_email") return "Email Profissional"
  if (key === "default_whatsapp") return "WhatsApp"

  return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
}

export default async function CertificatePage({ params }: CertificatePageProps) {
  const { id } = params
  const supabase = createClient()

  const headersList = headers()
  const clientIP = headersList.get("x-forwarded-for") || "unknown"
  const userAgent = headersList.get("user-agent") || "unknown"

  const sanitizedId = SecurityUtils.sanitizeInput(id)
  if (!sanitizedId || sanitizedId.length > 100) {
    notFound()
  }

  const { data: certificate, error } = await supabase
    .from("issued_certificates")
    .select(`
      *,
      pdf_url,
      data_hash,
      certificate_templates (
        title,
        template_data,
        placeholders,
        is_active
      )
    `)
    .eq("certificate_number", sanitizedId)
    .single()

  if (error || !certificate) {
    await AuditLogger.log({
      action: "certificate_access_not_found",
      resource_type: "certificate",
      resource_id: sanitizedId,
      ip_address: clientIP,
      user_agent: userAgent,
      details: {
        attempted_certificate_id: sanitizedId,
      },
      status: "warning",
      error_message: "Certificado não encontrado",
    })
    notFound()
  }

  if (!certificate.certificate_templates.is_active) {
    await AuditLogger.log({
      action: "certificate_access_inactive_template",
      resource_type: "certificate",
      resource_id: certificate.certificate_number,
      ip_address: clientIP,
      user_agent: userAgent,
      details: {
        template_id: certificate.template_id,
      },
      status: "warning",
      error_message: "Template inativo",
    })
    notFound()
  }

  let integrityValid = true
  if (certificate.data_hash && certificate.recipient_cpf && certificate.recipient_dob) {
    const expectedHash = SecurityUtils.createSecureHash({
      template_id: certificate.template_id,
      recipient_cpf: certificate.recipient_cpf,
      recipient_dob: certificate.recipient_dob,
      certificate_number: certificate.certificate_number,
    })

    if (certificate.data_hash !== expectedHash) {
      integrityValid = false
      await AuditLogger.log({
        action: "certificate_integrity_violation_view",
        resource_type: "certificate",
        resource_id: certificate.certificate_number,
        ip_address: clientIP,
        user_agent: userAgent,
        details: {
          expected_hash: expectedHash,
          stored_hash: certificate.data_hash,
        },
        status: "error",
        error_message: "Violação de integridade na visualização",
      })
    }
  }

  await AuditLogger.log({
    action: "certificate_view",
    resource_type: "certificate",
    resource_id: certificate.certificate_number,
    ip_address: clientIP,
    user_agent: userAgent,
    details: {
      template_id: certificate.template_id,
      integrity_valid: integrityValid,
    },
    status: "success",
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <Award className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Certificado Digital</h1>
          <p className="text-gray-600">Visualização pública do certificado</p>

          {!integrityValid && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-center gap-2 text-red-700">
                <Shield className="h-5 w-5" />
                <span className="text-sm font-medium">Aviso: Possível violação de integridade detectada</span>
              </div>
            </div>
          )}
        </div>

        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <Badge variant="secondary" className="text-lg font-medium mb-4 px-4 py-2">
                {certificate.certificate_templates.title}
              </Badge>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Badge variant="outline" className="text-sm font-mono">
                  <Hash className="h-3 w-3 mr-1" />
                  {certificate.certificate_number}
                </Badge>
                {integrityValid && certificate.data_hash && (
                  <Badge variant="outline" className="text-sm text-green-600 border-green-200">
                    <Shield className="h-3 w-3 mr-1" />
                    Verificado
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Dados do Certificado</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(certificate.recipient_data).map(([key, value]) => {
                  if (
                    key.toLowerCase().includes("imagem") ||
                    (typeof value === "string" && value.startsWith("http") && value.length > 50)
                  ) {
                    return null
                  }

                  return (
                    <div key={key} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <User className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-700 capitalize text-sm">{formatDisplayLabel(key)}</div>
                        <div className="text-gray-900 break-words">{formatDisplayValue(key, value)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-8 pt-4 border-t">
              <Calendar className="h-4 w-4" />
              <span>Emitido em {new Date(certificate.issued_at).toLocaleString("pt-BR")}</span>
            </div>

            <div className="text-center">
              <Button asChild size="lg" className="px-8" disabled={!certificate.pdf_url}>
                <a
                  href={certificate.pdf_url || ""}
                  download={`certificado-${certificate.certificate_number}.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Baixar Certificado PDF
                </a>
              </Button>
              {!certificate.pdf_url && (
                <p className="text-xs text-red-500 mt-2">
                  Link de download indisponível. O certificado pode estar sendo processado.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold text-gray-900 mb-2">Verificação de Autenticidade</h3>
            <p className="text-sm text-gray-600">
              Este certificado é válido e foi emitido digitalmente. O código{" "}
              <span className="font-mono font-medium">{certificate.certificate_number}</span> pode ser usado para
              verificar sua autenticidade.
              {integrityValid && certificate.data_hash && (
                <span className="block mt-2 text-green-600 font-medium">✓ Integridade dos dados verificada</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

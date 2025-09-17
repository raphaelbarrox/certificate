import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, User, Hash, Download, Award } from "lucide-react"
import { notFound } from "next/navigation"
import { applyCpfMask, applyPhoneMask } from "@/lib/masks"

interface CertificatePageProps {
  params: Promise<{ id: string }>
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
  // Assuming date is stored as YYYY-MM-DD
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
  const { id } = await params

  // Fetch certificate data
  const { data: certificate, error } = await supabase
    .from("issued_certificates")
    .select(
      `
    *,
    pdf_url,
    certificate_templates (
      title,
      template_data,
      placeholders
    )
  `,
    )
    .eq("certificate_number", id)
    .single()

  if (error || !certificate) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Award className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Certificado Digital</h1>
          <p className="text-gray-600">Visualização pública do certificado</p>
        </div>

        {/* Certificate Card */}
        <Card className="mb-8">
          <CardContent className="p-8">
            {/* Title and Certificate Number */}
            <div className="text-center mb-8">
              <Badge variant="secondary" className="text-lg font-medium mb-4 px-4 py-2">
                {certificate.certificate_templates.title}
              </Badge>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Badge variant="outline" className="text-sm font-mono">
                  <Hash className="h-3 w-3 mr-1" />
                  {certificate.certificate_number}
                </Badge>
              </div>
            </div>

            {/* Certificate Details */}
            <div className="space-y-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Dados do Certificado</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(certificate.recipient_data).map(([key, value]) => {
                  // Skip displaying image URLs
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

            {/* Issue Date */}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-8 pt-4 border-t">
              <Calendar className="h-4 w-4" />
              <span>Emitido em {new Date(certificate.issued_at).toLocaleString("pt-BR")}</span>
            </div>

            {/* Download Button */}
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

        {/* Verification Info */}
        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold text-gray-900 mb-2">Verificação de Autenticidade</h3>
            <p className="text-sm text-gray-600">
              Este certificado é válido e foi emitido digitalmente. O código{" "}
              <span className="font-mono font-medium">{certificate.certificate_number}</span> pode ser usado para
              verificar sua autenticidade.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

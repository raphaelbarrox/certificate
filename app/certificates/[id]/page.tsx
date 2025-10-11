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

const shouldDisplayField = (key: string, value: any, allData: Record<string, any>): boolean => {
  // Ignorar campos internos de email que não devem ser exibidos
  const internalFields = [
    "recipient_email",
    "recipient_name",
    "email", // Campo genérico interno
  ]

  if (internalFields.includes(key.toLowerCase())) {
    return false
  }

  // Ignorar campos com IDs numéricos longos (campos gerados automaticamente)
  if (/^field_\d{13,}$/.test(key)) {
    return false
  }

  // Ignorar imagens (URLs longas)
  if (
    key.toLowerCase().includes("imagem") ||
    key.toLowerCase().includes("image") ||
    (typeof value === "string" && value.startsWith("http") && value.length > 50)
  ) {
    return false
  }

  // Detectar duplicatas: se o valor é igual a outro campo já processado, ignorar
  const normalizedValue = String(value).toLowerCase().trim()
  const seenValues = new Set<string>()

  for (const [otherKey, otherValue] of Object.entries(allData)) {
    if (otherKey === key) continue // Pular o próprio campo

    const otherNormalizedValue = String(otherValue).toLowerCase().trim()
    if (normalizedValue === otherNormalizedValue && seenValues.has(otherNormalizedValue)) {
      // Este é um valor duplicado, verificar qual campo tem prioridade
      const priorityFields = ["default_email", "default_whatsapp", "nome_completo", "full_name", "participante"]

      // Se o campo atual não é prioritário e já existe um campo com o mesmo valor, ignorar
      if (!priorityFields.includes(key.toLowerCase())) {
        return false
      }
    }
    seenValues.add(otherNormalizedValue)
  }

  return true
}

const getUniqueFields = (recipientData: Record<string, any>): Array<[string, any]> => {
  const entries = Object.entries(recipientData)
  const uniqueEntries: Array<[string, any]> = []
  const seenValues = new Map<string, string>() // valor normalizado -> chave preferida

  // Definir prioridade de campos (campos mais descritivos têm prioridade)
  const fieldPriority: Record<string, number> = {
    default_email: 10,
    default_whatsapp: 10,
    nome_completo: 9,
    full_name: 8,
    participante: 7,
    nome: 6,
    name: 5,
    email_profissional: 4,
  }

  for (const [key, value] of entries) {
    // Pular campos internos
    if (!shouldDisplayField(key, value, recipientData)) {
      continue
    }

    const normalizedValue = String(value).toLowerCase().trim()

    // Verificar se já temos um campo com este valor
    const existingKey = seenValues.get(normalizedValue)

    if (existingKey) {
      // Já existe um campo com este valor, verificar prioridade
      const existingPriority = fieldPriority[existingKey.toLowerCase()] || 0
      const currentPriority = fieldPriority[key.toLowerCase()] || 0

      // Se o campo atual tem maior prioridade, substituir
      if (currentPriority > existingPriority) {
        // Remover o campo antigo
        const index = uniqueEntries.findIndex(([k]) => k === existingKey)
        if (index !== -1) {
          uniqueEntries.splice(index, 1)
        }
        // Adicionar o novo
        uniqueEntries.push([key, value])
        seenValues.set(normalizedValue, key)
      }
      // Caso contrário, ignorar o campo atual (manter o existente)
    } else {
      // Valor único, adicionar
      uniqueEntries.push([key, value])
      seenValues.set(normalizedValue, key)
    }
  }

  return uniqueEntries
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
                {getUniqueFields(certificate.recipient_data).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <User className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-700 capitalize text-sm">{formatDisplayLabel(key)}</div>
                      <div className="text-gray-900 break-words">{formatDisplayValue(key, value)}</div>
                    </div>
                  </div>
                ))}
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

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { CertificateIdSchema, sanitizeString } from "@/lib/input-validator"
import { createSecureResponse } from "@/lib/security-headers"
import { securityLogger } from "@/lib/security-logger"

function getRealIP(request: NextRequest) {
  return request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || request.ip
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const clientIP = getRealIP(request) || "unknown"
  const userAgent = request.headers.get("user-agent") || "unknown"

  try {
    const { id: rawId } = params

    const validationResult = CertificateIdSchema.safeParse({ id: rawId })

    if (!validationResult.success) {
      securityLogger.log({
        type: "validation_error",
        ip: clientIP,
        userAgent,
        endpoint: "/api/certificates/download",
        details: `Invalid certificate ID: ${rawId}`,
      })

      return createSecureResponse({ error: "ID de certificado inválido" }, 400)
    }

    const id = sanitizeString(validationResult.data.id)
    const supabase = createClient()

    const { data: certificate, error } = await supabase
      .from("issued_certificates")
      .select("pdf_url, certificate_number, recipient_data")
      .or(`id.eq.${id},certificate_number.eq.${id}`)
      .single()

    if (error || !certificate) {
      securityLogger.log({
        type: "unauthorized_access",
        ip: clientIP,
        userAgent,
        endpoint: "/api/certificates/download",
        details: `Attempted to access non-existent certificate: ${id}`,
      })

      console.error("Certificate not found:", error)
      return createSecureResponse({ error: "Certificado não encontrado" }, 404)
    }

    if (!certificate.pdf_url) {
      console.error("PDF URL not found for certificate:", id)
      return createSecureResponse({ error: "PDF não disponível" }, 404)
    }

    try {
      const response = await fetch(certificate.pdf_url)
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`)
      }

      const pdfBuffer = await response.arrayBuffer()
      const fileName = `certificado-${certificate.certificate_number}.pdf`

      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        },
      })
    } catch (fetchError) {
      console.error("Error fetching PDF:", fetchError)
      return createSecureResponse({ error: "Erro ao baixar PDF" }, 500)
    }
  } catch (error) {
    securityLogger.log({
      type: "suspicious_activity",
      ip: clientIP,
      userAgent,
      endpoint: "/api/certificates/download",
      details: `Download error: ${error instanceof Error ? error.message : "Unknown error"}`,
    })

    console.error("Error in download route:", error)
    return createSecureResponse({ error: "Erro interno do servidor" }, 500)
  }
}

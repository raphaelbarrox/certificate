import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { RateLimiter } from "@/lib/security-validator"
import { z } from "zod"

const downloadParamsSchema = z.object({
  id: z
    .string()
    .min(1, "ID é obrigatório")
    .max(100, "ID muito longo")
    .regex(/^[a-zA-Z0-9\-_]+$/, "ID contém caracteres inválidos"),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientIP = request.ip || request.headers.get("x-forwarded-for") || "unknown"
    if (!RateLimiter.isAllowed(`download_${clientIP}`, 30, 60000)) {
      return NextResponse.json({ error: "Muitos downloads. Tente novamente em 1 minuto." }, { status: 429 })
    }

    const { id } = await params

    const validationResult = downloadParamsSchema.safeParse({ id })
    if (!validationResult.success) {
      console.log(`[SECURITY] Invalid download ID blocked - IP: ${clientIP} - ID: ${id}`)
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    const sanitizedId = validationResult.data.id
    console.log(`[AUDIT] Certificate download - IP: ${clientIP} - ID: ${sanitizedId}`)

    const supabase = createClient()

    const { data: certificate, error } = await supabase
      .from("issued_certificates")
      .select("pdf_url, certificate_number, recipient_data")
      .or(`id.eq.${sanitizedId},certificate_number.eq.${sanitizedId}`)
      .single()

    if (error || !certificate) {
      console.error("Certificate not found:", error)
      return NextResponse.json({ error: "Certificado não encontrado" }, { status: 404 })
    }

    if (!certificate.pdf_url) {
      console.error("PDF URL not found for certificate:", sanitizedId)
      return NextResponse.json({ error: "PDF não disponível" }, { status: 404 })
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
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        },
      })
    } catch (fetchError) {
      console.error("Error fetching PDF:", fetchError)
      return NextResponse.json({ error: "Erro ao baixar PDF" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error in download route:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

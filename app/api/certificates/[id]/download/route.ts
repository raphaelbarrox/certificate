import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/auth-utils"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!checkRateLimit(request, 10, 60000)) {
      // 10 downloads por minuto por IP
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em alguns minutos." }, { status: 429 })
    }

    const { id } = await params
    const supabase = createClient()

    const { data: certificate, error } = await supabase
      .from("issued_certificates")
      .select("pdf_url, certificate_number, recipient_data")
      .or(`id.eq.${id},certificate_number.eq.${id}`)
      .single()

    if (error || !certificate) {
      console.error("Certificate not found:", error)
      return NextResponse.json({ error: "Certificado não encontrado" }, { status: 404 })
    }

    if (!certificate.pdf_url) {
      console.error("PDF URL not found for certificate:", id)
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
          "Cache-Control": "public, max-age=3600",
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

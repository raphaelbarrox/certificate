import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { certificateCheckSchema, RateLimiter } from "@/lib/security-validator"

export async function POST(request: NextRequest) {
  try {
    const clientIP = request.ip || request.headers.get("x-forwarded-for") || "unknown"
    if (!RateLimiter.isAllowed(`check_${clientIP}`, 10, 60000)) {
      return NextResponse.json(
        { error: "Muitas tentativas de verificação. Tente novamente em 1 minuto." },
        { status: 429 },
      )
    }

    const rawData = await request.json()

    const validationResult = certificateCheckSchema.safeParse(rawData)
    if (!validationResult.success) {
      console.log(`[SECURITY] Invalid certificate check blocked - IP: ${clientIP}`)
      return NextResponse.json({ error: "Dados inválidos fornecidos" }, { status: 400 })
    }

    const { template_id, cpf, dob } = validationResult.data

    console.log(
      `[AUDIT] Certificate check - IP: ${clientIP} - Template: ${template_id} - CPF: ${cpf.substring(0, 3)}***`,
    )

    const { data: certificate, error } = await supabase
      .from("issued_certificates")
      .select("id, certificate_number, pdf_url, recipient_data")
      .eq("template_id", template_id)
      .eq("recipient_cpf", cpf)
      .eq("recipient_dob", dob)
      .order("issued_at", { ascending: false })
      .limit(1)
      .single()

    if (error || !certificate) {
      return NextResponse.json({ error: "Nenhum certificado encontrado." }, { status: 404 })
    }

    return NextResponse.json(certificate)
  } catch (error) {
    console.error("Erro ao verificar certificado:", error)
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { checkRateLimit } from "@/lib/auth-utils"

export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit(request, 10, 300000)) {
      // 10 tentativas por 5 minutos
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em alguns minutos." }, { status: 429 })
    }

    const { template_id, cpf, dob } = await request.json()

    if (!template_id || !cpf || !dob) {
      return NextResponse.json({ error: "ID do template, CPF e Data de Nascimento são obrigatórios" }, { status: 400 })
    }

    const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/
    if (!cpfRegex.test(cpf)) {
      return NextResponse.json({ error: "Formato de CPF inválido" }, { status: 400 })
    }

    const dobRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dobRegex.test(dob)) {
      return NextResponse.json({ error: "Formato de data inválido (YYYY-MM-DD)" }, { status: 400 })
    }

    // Busca o certificado mais recente para o CPF, Data de Nascimento e template fornecidos
    const { data: certificate, error } = await supabase
      .from("issued_certificates")
      .select("id, certificate_number, pdf_url, recipient_data") // Puxa também os dados para preencher o form
      .eq("template_id", template_id)
      .eq("recipient_cpf", cpf)
      .eq("recipient_dob", dob)
      .order("issued_at", { ascending: false })
      .limit(1)
      .single()

    if (error || !certificate) {
      // Isso é esperado se for um novo usuário, então retornamos 404.
      return NextResponse.json({ error: "Nenhum certificado encontrado." }, { status: 404 })
    }

    // Retorna os dados do certificado encontrado
    return NextResponse.json(certificate)
  } catch (error) {
    console.error("Erro ao verificar certificado:", error)
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

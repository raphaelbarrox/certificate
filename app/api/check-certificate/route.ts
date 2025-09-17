import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { SecurityUtils } from "@/lib/security-utils"
import { AuditLogger } from "@/lib/audit-logger"
import { z } from "zod"

const CheckCertificateSchema = z.object({
  template_id: z.string().uuid("ID do template deve ser um UUID válido"),
  cpf: z.string().refine((cpf) => SecurityUtils.validateCPF(cpf), "CPF inválido"),
  dob: z.string().refine((dob) => SecurityUtils.validateDateOfBirth(dob), "Data de nascimento inválida"),
})

export async function POST(request: NextRequest) {
  const clientIP = request.ip || request.headers.get("x-forwarded-for") || "unknown"
  const userAgent = request.headers.get("user-agent") || "unknown"
  const supabase = await createClient()

  try {
    const requestBody = await request.json()
    const validatedData = CheckCertificateSchema.parse(requestBody)
    const { template_id, cpf, dob } = validatedData

    const cleanCpf = cpf.replace(/\D/g, "")

    const { data: template, error: templateError } = await supabase
      .from("certificate_templates")
      .select("id, is_active")
      .eq("id", template_id)
      .eq("is_active", true)
      .single()

    if (templateError || !template) {
      await AuditLogger.log({
        action: "certificate_check_failed",
        resource_type: "certificate",
        ip_address: clientIP,
        user_agent: userAgent,
        details: {
          template_id,
          cpf_hash: SecurityUtils.createSecureHash(cleanCpf),
          reason: "template_not_found_or_inactive",
        },
        status: "error",
        error_message: "Template não encontrado ou inativo",
      })
      return NextResponse.json({ error: "Template não encontrado ou inativo" }, { status: 404 })
    }

    const { data: certificate, error } = await supabase
      .from("issued_certificates")
      .select("id, certificate_number, pdf_url, recipient_data, data_hash")
      .eq("template_id", template_id)
      .eq("recipient_cpf", cleanCpf)
      .eq("recipient_dob", dob)
      .order("issued_at", { ascending: false })
      .limit(1)
      .single()

    if (error || !certificate) {
      await AuditLogger.log({
        action: "certificate_check_not_found",
        resource_type: "certificate",
        ip_address: clientIP,
        user_agent: userAgent,
        details: {
          template_id,
          cpf_hash: SecurityUtils.createSecureHash(cleanCpf),
          dob,
        },
        status: "warning",
      })
      return NextResponse.json({ error: "Nenhum certificado encontrado." }, { status: 404 })
    }

    if (certificate.data_hash) {
      const expectedHash = SecurityUtils.createSecureHash({
        template_id,
        recipient_cpf: cleanCpf,
        recipient_dob: dob,
        certificate_number: certificate.certificate_number,
      })

      if (certificate.data_hash !== expectedHash) {
        await AuditLogger.log({
          action: "certificate_integrity_violation",
          resource_type: "certificate",
          resource_id: certificate.certificate_number,
          ip_address: clientIP,
          user_agent: userAgent,
          details: {
            expected_hash: expectedHash,
            stored_hash: certificate.data_hash,
          },
          status: "error",
          error_message: "Violação de integridade detectada",
        })
        return NextResponse.json({ error: "Erro de integridade dos dados" }, { status: 400 })
      }
    }

    await AuditLogger.log({
      action: "certificate_check_success",
      resource_type: "certificate",
      resource_id: certificate.certificate_number,
      ip_address: clientIP,
      user_agent: userAgent,
      details: {
        template_id,
        cpf_hash: SecurityUtils.createSecureHash(cleanCpf),
      },
      status: "success",
    })

    const sanitizedCertificate = {
      id: certificate.id,
      certificate_number: certificate.certificate_number,
      pdf_url: certificate.pdf_url,
      recipient_data: certificate.recipient_data,
    }

    return NextResponse.json(sanitizedCertificate)
  } catch (error) {
    console.error("Erro ao verificar certificado:", error)

    await AuditLogger.log({
      action: "certificate_check_error",
      resource_type: "certificate",
      ip_address: clientIP,
      user_agent: userAgent,
      details: {
        error_type: error instanceof Error ? error.constructor.name : "unknown",
      },
      status: "error",
      error_message: error instanceof Error ? error.message : "Erro desconhecido",
    })

    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

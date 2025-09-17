import { createClient } from "@/lib/supabase/server"

export interface AuditLogEntry {
  action: string
  resource_type: string
  resource_id?: string
  user_id?: string
  ip_address?: string
  user_agent?: string
  details?: any
  status: "success" | "error" | "warning"
  error_message?: string
}

export class AuditLogger {
  private static supabase = createClient()

  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      const { error } = await this.supabase.from("audit_logs").insert({
        ...entry,
        created_at: new Date().toISOString(),
      })

      if (error) {
        console.error("Erro ao salvar log de auditoria:", error)
      }
    } catch (error) {
      console.error("Erro crítico no sistema de auditoria:", error)
    }
  }

  static async logCertificateGeneration(
    certificateNumber: string,
    templateId: string,
    recipientCpf: string,
    ipAddress: string,
    userAgent: string,
    status: "success" | "error",
    errorMessage?: string,
  ): Promise<void> {
    await this.log({
      action: "certificate_generation",
      resource_type: "certificate",
      resource_id: certificateNumber,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: {
        template_id: templateId,
        recipient_cpf_hash: this.hashSensitiveData(recipientCpf),
      },
      status,
      error_message: errorMessage,
    })
  }

  static async logCertificateDownload(certificateNumber: string, ipAddress: string, userAgent: string): Promise<void> {
    await this.log({
      action: "certificate_download",
      resource_type: "certificate",
      resource_id: certificateNumber,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: {
        download_timestamp: new Date().toISOString(),
      },
      status: "success",
    })
  }

  private static hashSensitiveData(data: string): string {
    const crypto = require("crypto")
    return crypto.createHash("sha256").update(data).digest("hex").substring(0, 8)
  }
}

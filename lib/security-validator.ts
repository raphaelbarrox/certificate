import { z } from "zod"

export const searchQuerySchema = z.object({
  q: z
    .string()
    .min(1, "Query é obrigatória")
    .max(100, "Query muito longa")
    .regex(/^[a-zA-Z0-9@.\-_\s]+$/, "Query contém caracteres inválidos")
    .transform((str) => str.trim()),
})

export const certificateCheckSchema = z.object({
  template_id: z.string().uuid("Template ID inválido"),
  cpf: z
    .string()
    .regex(/^\d{11}$/, "CPF deve conter exatamente 11 dígitos")
    .transform((str) => str.replace(/\D/g, "")),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
})

export const certificateIssueSchema = z.object({
  template_id: z.string().uuid("Template ID inválido"),
  recipient_data: z.object({
    name: z.string().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
    email: z.string().email("Email inválido").optional(),
    default_email: z.string().email("Email inválido").optional(),
    cpf: z
      .string()
      .regex(/^\d{11}$/, "CPF inválido")
      .optional(),
  }),
  recipient_cpf: z.string().regex(/^\d{11}$/, "CPF deve conter exatamente 11 dígitos"),
  recipient_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  certificate_number_to_update: z.string().optional(),
  photo_url: z.string().url("URL da foto inválida").optional(),
})

export function sanitizeSearchQuery(query: string): string {
  // Remove caracteres perigosos para SQL injection
  return query
    .replace(/['"\\;]/g, "") // Remove aspas e ponto e vírgula
    .replace(/--/g, "") // Remove comentários SQL
    .replace(/\/\*/g, "") // Remove início de comentário de bloco
    .replace(/\*\//g, "") // Remove fim de comentário de bloco
    .replace(/\bUNION\b/gi, "") // Remove UNION
    .replace(/\bSELECT\b/gi, "") // Remove SELECT
    .replace(/\bINSERT\b/gi, "") // Remove INSERT
    .replace(/\bUPDATE\b/gi, "") // Remove UPDATE
    .replace(/\bDELETE\b/gi, "") // Remove DELETE
    .replace(/\bDROP\b/gi, "") // Remove DROP
    .trim()
}

export class RateLimiter {
  private static requests = new Map<string, { count: number; resetTime: number }>()

  static isAllowed(identifier: string, limit = 50, windowMs = 60000): boolean {
    const now = Date.now()
    const record = this.requests.get(identifier)

    if (!record || now > record.resetTime) {
      this.requests.set(identifier, { count: 1, resetTime: now + windowMs })
      return true
    }

    if (record.count >= limit) {
      return false
    }

    record.count++
    return true
  }
}

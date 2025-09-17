import { z } from "zod"

export const searchQuerySchema = z.object({
  q: z
    .string()
    .min(1, "Query é obrigatória")
    .max(100, "Query muito longa")
    .regex(/^[a-zA-Z0-9@.\-_\sÀ-ÿ]+$/, "Query contém caracteres inválidos")
    .transform((str) => str.trim()),
})

export const certificateCheckSchema = z.object({
  template_id: z.string().uuid("Template ID inválido"),
  cpf: z
    .string()
    .transform((str) => str.replace(/\D/g, ""))
    .refine((str) => str.length === 11, "CPF deve conter exatamente 11 dígitos"),
  dob: z
    .string()
    .transform((str) => {
      if (str.match(/^\d{2}[/-]\d{2}[/-]\d{4}$/)) {
        const parts = str.split(/[/-]/)
        return `${parts[2]}-${parts[1]}-${parts[0]}`
      }
      return str
    })
    .refine(
      (str) => str.match(/^\d{4}-\d{2}-\d{2}$/),
      "Data deve estar no formato DD/MM/YYYY, DD-MM-YYYY ou YYYY-MM-DD",
    ),
})

export const certificateIssueSchema = z.object({
  template_id: z.string().uuid("Template ID inválido"),
  recipient_data: z.object({
    name: z
      .string()
      .min(1, "Nome é obrigatório")
      .max(200, "Nome muito longo")
      .regex(/^[a-zA-Z\sÀ-ÿ\-'.]+$/, "Nome contém caracteres inválidos"),
    email: z.string().email("Email inválido").optional(),
    default_email: z.string().email("Email inválido").optional(),
    cpf: z
      .string()
      .transform((str) => str.replace(/\D/g, ""))
      .refine((str) => str.length === 11, "CPF inválido")
      .optional(),
  }),
  recipient_cpf: z
    .string()
    .transform((str) => str.replace(/\D/g, ""))
    .refine((str) => str.length === 11, "CPF deve conter exatamente 11 dígitos"),
  recipient_dob: z
    .string()
    .transform((str) => {
      if (str.match(/^\d{2}[/-]\d{2}[/-]\d{4}$/)) {
        const parts = str.split(/[/-]/)
        return `${parts[2]}-${parts[1]}-${parts[0]}`
      }
      return str
    })
    .refine((str) => str.match(/^\d{4}-\d{2}-\d{2}$/), "Data inválida"),
  certificate_number_to_update: z.string().optional(),
  photo_url: z.string().url("URL da foto inválida").optional(),
})

export function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/['"\\;]/g, "")
    .replace(/--/g, "")
    .replace(/\/\*/g, "")
    .replace(/\*\//g, "")
    .replace(/\bUNION\b/gi, "")
    .replace(/\bSELECT\b/gi, "")
    .replace(/\bINSERT\b/gi, "")
    .replace(/\bUPDATE\b/gi, "")
    .replace(/\bDELETE\b/gi, "")
    .replace(/\bDROP\b/gi, "")
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

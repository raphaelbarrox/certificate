import { z } from "zod"

// Schema para validação de dados de certificado
export const CertificateDataSchema = z.object({
  template_id: z.string().uuid("ID do template deve ser um UUID válido"),
  recipient_data: z
    .record(z.any())
    .refine((data) => Object.keys(data).length > 0, "Dados do destinatário são obrigatórios"),
  recipient_cpf: z.string().regex(/^\d{11}$/, "CPF deve conter exatamente 11 dígitos"),
  recipient_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  photo_url: z.string().url().optional().or(z.literal("")),
  certificate_number_to_update: z.string().optional(),
})

// Schema para validação de busca
export const SearchSchema = z.object({
  q: z.string().min(1, "Query de busca é obrigatória").max(100, "Query muito longa"),
})

// Schema para validação de email
export const EmailSchema = z.object({
  email: z.string().email("Email inválido"),
})

// Schema para validação de ID de certificado
export const CertificateIdSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9\-_]+$/, "ID de certificado inválido"),
})

// Função para sanitizar strings
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove < e >
    .replace(/javascript:/gi, "") // Remove javascript:
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim()
}

// Função para sanitizar objeto recursivamente
export function sanitizeObject(obj: any): any {
  if (typeof obj === "string") {
    return sanitizeString(obj)
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject)
  }

  if (obj && typeof obj === "object") {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key)
      sanitized[sanitizedKey] = sanitizeObject(value)
    }
    return sanitized
  }

  return obj
}

// Validação de ownership para certificados
export function validateCertificateOwnership(
  certificate: any,
  requestData: { recipient_cpf: string; recipient_dob: string },
): boolean {
  return (
    certificate.recipient_cpf === requestData.recipient_cpf && certificate.recipient_dob === requestData.recipient_dob
  )
}

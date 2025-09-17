import crypto from "crypto"

export class SecurityUtils {
  static validateCPF(cpf: string): boolean {
    if (!cpf) return false

    // Remove caracteres não numéricos
    const cleanCPF = cpf.replace(/\D/g, "")

    // Verifica se tem 11 dígitos
    if (cleanCPF.length !== 11) return false

    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false

    // Validação do primeiro dígito verificador
    let sum = 0
    for (let i = 0; i < 9; i++) {
      sum += Number.parseInt(cleanCPF.charAt(i)) * (10 - i)
    }
    let remainder = (sum * 10) % 11
    if (remainder === 10 || remainder === 11) remainder = 0
    if (remainder !== Number.parseInt(cleanCPF.charAt(9))) return false

    // Validação do segundo dígito verificador
    sum = 0
    for (let i = 0; i < 10; i++) {
      sum += Number.parseInt(cleanCPF.charAt(i)) * (11 - i)
    }
    remainder = (sum * 10) % 11
    if (remainder === 10 || remainder === 11) remainder = 0
    if (remainder !== Number.parseInt(cleanCPF.charAt(10))) return false

    return true
  }

  static sanitizeInput(input: string): string {
    if (!input || typeof input !== "string") return ""

    return input
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .substring(0, 1000) // Limitar tamanho
  }

  static generateSecureCertificateNumber(): string {
    const timestamp = Date.now()
    const randomBytes = crypto.randomBytes(8).toString("hex").toUpperCase()
    const checksum = crypto
      .createHash("sha256")
      .update(`${timestamp}-${randomBytes}`)
      .digest("hex")
      .substring(0, 4)
      .toUpperCase()

    return `CERT-${timestamp}-${randomBytes}-${checksum}`
  }

  static validateDateOfBirth(dob: string): boolean {
    if (!dob) return false

    const date = new Date(dob)
    const now = new Date()
    const minAge = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate())
    const maxAge = new Date(now.getFullYear() - 13, now.getMonth(), now.getDate())

    return date >= minAge && date <= maxAge
  }

  static createSecureHash(data: any): string {
    const jsonString = JSON.stringify(data, Object.keys(data).sort())
    return crypto.createHash("sha256").update(jsonString).digest("hex")
  }

  static validateEmail(email: string): boolean {
    if (!email) return false
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && email.length <= 254
  }
}

import crypto from "crypto"

const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY
if (!ENCRYPTION_KEY) {
  throw new Error("EMAIL_ENCRYPTION_KEY é obrigatória para segurança do sistema")
}

const ALGORITHM = "aes-256-gcm"

export class EmailSecurity {
  static encryptApiKey(apiKey: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipherGCM(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"))
    cipher.setIVLength(16)

    let encrypted = cipher.update(apiKey, "utf8", "hex")
    encrypted += cipher.final("hex")

    const tag = cipher.getAuthTag()

    return {
      encrypted,
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
    }
  }

  static decryptApiKey(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const decipher = crypto.createDecipherGCM(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"))
    decipher.setAuthTag(Buffer.from(encryptedData.tag, "hex"))

    let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")

    return decrypted
  }

  static hashApiKey(apiKey: string): string {
    return crypto.createHash("sha256").update(apiKey).digest("hex")
  }

  static maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) return "*".repeat(apiKey.length)
    return apiKey.substring(0, 4) + "*".repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4)
  }

  static sanitizeForLog(data: any): any {
    if (typeof data === "string") {
      // Mascarar API keys, emails e dados sensíveis
      return data
        .replace(/re_[a-zA-Z0-9]{32}/g, "re_****")
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "***@***.***")
    }

    if (typeof data === "object" && data !== null) {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(data)) {
        if (key.toLowerCase().includes("key") || key.toLowerCase().includes("pass")) {
          sanitized[key] = "***"
        } else {
          sanitized[key] = this.sanitizeForLog(value)
        }
      }
      return sanitized
    }

    return data
  }
}

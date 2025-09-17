import crypto from "crypto"

const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || "default-key-change-in-production"
const ALGORITHM = "aes-256-gcm"

export class EmailSecurity {
  static encryptApiKey(apiKey: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY)

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
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY)
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
}

const ALGORITHM = "AES-GCM"

export class EmailSecurity {
  private static async generateUserKey(userId: string): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const keyMaterial = encoder.encode(`email-security-${userId}-v1`)

    // Gerar hash SHA-256 da chave base
    const hashBuffer = await crypto.subtle.digest("SHA-256", keyMaterial)

    // Importar como chave AES-GCM
    return await crypto.subtle.importKey("raw", hashBuffer, { name: ALGORITHM }, false, ["encrypt", "decrypt"])
  }

  static async encryptApiKey(apiKey: string, userId: string): Promise<{ encrypted: string; iv: string; tag: string }> {
    const encoder = new TextEncoder()
    const data = encoder.encode(apiKey)

    // Gerar IV aleatório
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Gerar chave baseada no usuário
    const key = await this.generateUserKey(userId)

    // Criptografar
    const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv: iv }, key, data)

    // Separar dados criptografados e tag de autenticação
    const encryptedArray = new Uint8Array(encrypted)
    const encryptedData = encryptedArray.slice(0, -16)
    const tag = encryptedArray.slice(-16)

    return {
      encrypted: Array.from(encryptedData)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      iv: Array.from(iv)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      tag: Array.from(tag)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    }
  }

  static async decryptApiKey(
    encryptedData: { encrypted: string; iv: string; tag: string },
    userId: string,
  ): Promise<string> {
    // Converter hex strings para Uint8Array
    const iv = new Uint8Array(encryptedData.iv.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)))
    const encrypted = new Uint8Array(encryptedData.encrypted.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)))
    const tag = new Uint8Array(encryptedData.tag.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)))

    // Combinar dados criptografados com tag
    const combinedData = new Uint8Array(encrypted.length + tag.length)
    combinedData.set(encrypted)
    combinedData.set(tag, encrypted.length)

    // Gerar chave baseada no usuário
    const key = await this.generateUserKey(userId)

    // Descriptografar
    const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv: iv }, key, combinedData)

    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  }

  static async hashApiKey(apiKey: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(apiKey)
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    const hashArray = new Uint8Array(hashBuffer)
    return Array.from(hashArray)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
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

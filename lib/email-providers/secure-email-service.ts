import { createClient } from "@/lib/supabase/server"
import { EmailSecurity } from "@/lib/email-security"
import { EmailService, type EmailConfig } from "./email-service"

export interface SecureEmailConfig extends Omit<EmailConfig, "resend"> {
  resend?: {
    enabled: boolean
    keyHash?: string // Hash da chave para identificação
  }
}

export class SecureEmailService {
  static async getDecryptedConfig(userId: string, config: SecureEmailConfig): Promise<EmailConfig> {
    if (config.provider !== "resend" || !config.resend?.keyHash) {
      return config as EmailConfig
    }

    const supabase = createClient()

    const { data: keyData, error } = await supabase
      .from("email_api_keys")
      .select("encrypted_key, key_hash")
      .eq("user_id", userId)
      .eq("provider", "resend")
      .eq("key_hash", config.resend.keyHash)
      .eq("is_active", true)
      .single()

    if (error || !keyData) {
      throw new Error("API key não encontrada ou inválida")
    }

    // Descriptografar a chave
    const decryptedKey = await EmailSecurity.decryptApiKey(JSON.parse(keyData.encrypted_key), userId)

    return {
      ...config,
      resend: {
        enabled: config.resend.enabled,
        apiKey: decryptedKey,
      },
    } as EmailConfig
  }

  static async saveApiKey(userId: string, provider: "resend" | "smtp", apiKey: string): Promise<string> {
    const supabase = createClient()

    const keyHash = await EmailSecurity.hashApiKey(apiKey)
    const encryptedData = await EmailSecurity.encryptApiKey(apiKey, userId)

    const { error } = await supabase.from("email_api_keys").upsert({
      user_id: userId,
      provider,
      encrypted_key: JSON.stringify(encryptedData),
      key_hash: keyHash,
      is_active: true,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      throw new Error("Erro ao salvar API key: " + error.message)
    }

    return keyHash
  }

  static async sendSecureEmail(
    userId: string,
    config: SecureEmailConfig,
    options: {
      to: string
      subject: string
      html: string
      attachments?: any[]
    },
  ) {
    const decryptedConfig = await this.getDecryptedConfig(userId, config)

    return EmailService.sendEmail({
      ...options,
      config: decryptedConfig,
    })
  }

  static async testSecureConnection(userId: string, config: SecureEmailConfig) {
    const decryptedConfig = await this.getDecryptedConfig(userId, config)
    return EmailService.testConnection(decryptedConfig)
  }
}

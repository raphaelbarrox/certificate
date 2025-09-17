"use server"

import { createClient } from "@/lib/supabase/server"
import { EmailSecurity } from "@/lib/email-security"

export async function saveApiKeyAction(
  userId: string,
  provider: "resend" | "smtp",
  apiKey: string,
): Promise<{ success: boolean; keyHash?: string; error?: string }> {
  try {
    const supabase = createClient()

    const keyHash = await EmailSecurity.hashApiKey(apiKey)
    const encryptedData = await EmailSecurity.encryptApiKey(apiKey, userId)

    const { error } = await supabase.from("email_api_keys").upsert(
      {
        user_id: userId,
        provider,
        encrypted_key: JSON.stringify(encryptedData),
        key_hash: keyHash,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,provider",
      },
    )

    if (error) {
      return { success: false, error: "Erro ao salvar API key: " + error.message }
    }

    return { success: true, keyHash }
  } catch (error: any) {
    return { success: false, error: error.message || "Erro desconhecido" }
  }
}

export async function getDecryptedConfigAction(
  userId: string,
  keyHash: string,
): Promise<{ success: boolean; apiKey?: string; error?: string }> {
  try {
    const supabase = createClient()

    const { data: keyData, error } = await supabase
      .from("email_api_keys")
      .select("encrypted_key, key_hash")
      .eq("user_id", userId)
      .eq("provider", "resend")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .single()

    if (error || !keyData) {
      return { success: false, error: "API key não encontrada ou inválida" }
    }

    // Descriptografar a chave
    const decryptedKey = await EmailSecurity.decryptApiKey(JSON.parse(keyData.encrypted_key), userId)

    return { success: true, apiKey: decryptedKey }
  } catch (error: any) {
    return { success: false, error: error.message || "Erro ao descriptografar chave" }
  }
}

// Script para testar a descriptografia de API Keys
// Execute este script para verificar se a descriptografia está funcionando

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variáveis de ambiente do Supabase não encontradas")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Simular a classe EmailSecurity (versão simplificada para teste)
class EmailSecurityTest {
  static async generateUserKey(userId) {
    const encoder = new TextEncoder()
    const keyMaterial = encoder.encode(`email-security-${userId}-v1`)
    const hashBuffer = await crypto.subtle.digest("SHA-256", keyMaterial)
    return await crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
  }

  static async decryptApiKey(encryptedData, userId) {
    try {
      const iv = new Uint8Array(encryptedData.iv.match(/.{2}/g).map((byte) => Number.parseInt(byte, 16)))
      const encrypted = new Uint8Array(encryptedData.encrypted.match(/.{2}/g).map((byte) => Number.parseInt(byte, 16)))
      const tag = new Uint8Array(encryptedData.tag.match(/.{2}/g).map((byte) => Number.parseInt(byte, 16)))

      const combinedData = new Uint8Array(encrypted.length + tag.length)
      combinedData.set(encrypted)
      combinedData.set(tag, encrypted.length)

      const key = await this.generateUserKey(userId)
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, combinedData)

      const decoder = new TextDecoder()
      return decoder.decode(decrypted)
    } catch (error) {
      throw new Error(`Erro na descriptografia: ${error.message}`)
    }
  }
}

async function testEmailDecryption() {
  console.log("🔐 [Test] Testando descriptografia de API Keys...\n")

  try {
    // 1. Buscar todas as API Keys criptografadas
    console.log("1️⃣ Buscando API Keys criptografadas...")
    const { data: apiKeys, error: apiKeysError } = await supabase
      .from("email_api_keys")
      .select("*")
      .eq("provider", "resend")
      .eq("is_active", true)

    if (apiKeysError) {
      console.error("❌ Erro ao buscar API Keys:", apiKeysError.message)
      return
    }

    console.log(`✅ Encontradas ${apiKeys.length} API Keys do Resend`)

    // 2. Testar descriptografia de cada chave
    for (const keyRecord of apiKeys) {
      console.log(`\n🔍 Testando chave do usuário ${keyRecord.user_id}...`)
      console.log(`   - Hash: ${keyRecord.key_hash.substring(0, 8)}...`)
      console.log(`   - Criada em: ${keyRecord.created_at}`)

      try {
        const encryptedData = JSON.parse(keyRecord.encrypted_key)
        console.log(`   - Dados criptografados: ✅`)
        console.log(`   - IV: ${encryptedData.iv ? "✅" : "❌"}`)
        console.log(`   - Encrypted: ${encryptedData.encrypted ? "✅" : "❌"}`)
        console.log(`   - Tag: ${encryptedData.tag ? "✅" : "❌"}`)

        // Tentar descriptografar
        const decryptedKey = await EmailSecurityTest.decryptApiKey(encryptedData, keyRecord.user_id)

        console.log(`   - Descriptografia: ✅`)
        console.log(`   - Formato da chave: ${decryptedKey.startsWith("re_") ? "✅" : "❌"}`)
        console.log(`   - Tamanho da chave: ${decryptedKey.length} caracteres`)

        // Verificar se a chave parece válida
        if (decryptedKey.startsWith("re_") && decryptedKey.length > 30) {
          console.log(`   - ✅ Chave parece válida`)
        } else {
          console.log(`   - ❌ Chave pode estar corrompida`)
        }
      } catch (decryptError) {
        console.error(`   - ❌ Erro na descriptografia: ${decryptError.message}`)
      }
    }

    // 3. Buscar templates que usam essas chaves
    console.log("\n2️⃣ Verificando templates que usam essas chaves...")
    const { data: templates, error: templatesError } = await supabase
      .from("certificate_templates")
      .select("id, title, user_id, form_design")
      .not("form_design->emailConfig->resend->keyHash", "is", null)

    if (templatesError) {
      console.error("❌ Erro ao buscar templates:", templatesError.message)
    } else {
      console.log(`✅ Encontrados ${templates.length} templates com keyHash`)

      for (const template of templates) {
        const keyHash = template.form_design?.emailConfig?.resend?.keyHash
        if (keyHash) {
          console.log(`\n📋 Template: ${template.title}`)
          console.log(`   - KeyHash: ${keyHash.substring(0, 8)}...`)

          // Verificar se existe uma chave correspondente
          const matchingKey = apiKeys.find((key) => key.key_hash === keyHash && key.user_id === template.user_id)

          if (matchingKey) {
            console.log(`   - ✅ Chave correspondente encontrada`)
          } else {
            console.log(`   - ❌ Chave correspondente NÃO encontrada`)
            console.log(`   - 💡 Possível problema: chave foi deletada ou corrompida`)
          }
        }
      }
    }

    console.log("\n🎯 [Test] Teste de descriptografia concluído!")
  } catch (error) {
    console.error("❌ Erro durante o teste:", error)
  }
}

// Executar o teste
testEmailDecryption()

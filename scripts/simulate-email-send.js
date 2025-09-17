// Script para simular o envio de email e identificar problemas
// Execute este script para testar o fluxo completo de envio

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variáveis de ambiente do Supabase não encontradas")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Simular EmailSecurity
class EmailSecuritySim {
  static async generateUserKey(userId) {
    const encoder = new TextEncoder()
    const keyMaterial = encoder.encode(`email-security-${userId}-v1`)
    const hashBuffer = await crypto.subtle.digest("SHA-256", keyMaterial)
    return await crypto.subtle.importKey("raw", hashBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
  }

  static async decryptApiKey(encryptedData, userId) {
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
  }
}

async function simulateEmailSend() {
  console.log("📧 [Simulate] Simulando envio de email...\n")

  try {
    // 1. Buscar um template com configuração de email ativa
    console.log("1️⃣ Buscando template com email ativo...")
    const { data: templates, error: templatesError } = await supabase
      .from("certificate_templates")
      .select("*")
      .eq("is_active", true)
      .not("form_design->emailConfig", "is", null)
      .limit(1)

    if (templatesError || !templates.length) {
      console.error("❌ Nenhum template com email encontrado:", templatesError?.message)
      return
    }

    const template = templates[0]
    const emailConfig = template.form_design?.emailConfig

    console.log(`✅ Template encontrado: ${template.title}`)
    console.log(`   - Email habilitado: ${emailConfig?.enabled}`)
    console.log(`   - Provider: ${emailConfig?.provider}`)
    console.log(`   - Sender: ${emailConfig?.senderEmail}`)

    if (!emailConfig?.enabled) {
      console.log("❌ Email não está habilitado neste template")
      return
    }

    // 2. Simular o processo de descriptografia
    console.log("\n2️⃣ Simulando processo de descriptografia...")

    let finalEmailConfig = { ...emailConfig }

    if (emailConfig.resend?.keyHash && !emailConfig.resend?.apiKey) {
      console.log("🔐 KeyHash detectado, tentando descriptografar...")

      try {
        // Buscar a chave criptografada
        const { data: keyData, error: keyError } = await supabase
          .from("email_api_keys")
          .select("encrypted_key, key_hash")
          .eq("user_id", template.user_id)
          .eq("provider", "resend")
          .eq("key_hash", emailConfig.resend.keyHash)
          .eq("is_active", true)
          .single()

        if (keyError || !keyData) {
          console.error("❌ API Key não encontrada:", keyError?.message)
          return
        }

        console.log("✅ Chave criptografada encontrada")

        // Descriptografar
        const encryptedData = JSON.parse(keyData.encrypted_key)
        const decryptedKey = await EmailSecuritySim.decryptApiKey(encryptedData, template.user_id)

        console.log("✅ Chave descriptografada com sucesso")
        console.log(`   - Formato: ${decryptedKey.startsWith("re_") ? "✅" : "❌"}`)
        console.log(`   - Tamanho: ${decryptedKey.length} caracteres`)

        finalEmailConfig = {
          ...emailConfig,
          resend: {
            enabled: true,
            apiKey: decryptedKey,
          },
        }
      } catch (decryptError) {
        console.error("❌ Erro na descriptografia:", decryptError.message)
        return
      }
    } else if (emailConfig.resend?.apiKey) {
      console.log("✅ API Key já disponível (não criptografada)")
    } else {
      console.log("❌ Nenhuma API Key encontrada")
      return
    }

    // 3. Simular dados do certificado
    console.log("\n3️⃣ Simulando dados do certificado...")
    const mockRecipientData = {
      nome_completo: "João da Silva",
      email: "joao@exemplo.com",
      curso: "Curso de Teste",
    }
    const mockCertificateNumber = "CERT-TEST-123456"
    const mockPdfUrl = "https://exemplo.com/certificado.pdf"

    console.log(`✅ Dados simulados:`)
    console.log(`   - Destinatário: ${mockRecipientData.email}`)
    console.log(`   - Certificado: ${mockCertificateNumber}`)

    // 4. Simular substituição de placeholders
    console.log("\n4️⃣ Simulando substituição de placeholders...")
    let finalBody = emailConfig.body
    let finalSubject = emailConfig.subject

    const allData = {
      ...mockRecipientData,
      certificate_link: mockPdfUrl,
      certificate_id: mockCertificateNumber,
    }

    for (const key in allData) {
      const regex = new RegExp(`{{${key}}}`, "g")
      finalBody = finalBody.replace(regex, allData[key])
      finalSubject = finalSubject.replace(regex, allData[key])
    }

    console.log("✅ Placeholders substituídos:")
    console.log(`   - Assunto: ${finalSubject}`)
    console.log(`   - Corpo: ${finalBody.substring(0, 100)}...`)

    // 5. Verificar configuração final
    console.log("\n5️⃣ Verificando configuração final...")
    console.log(`✅ Configuração final:`)
    console.log(`   - Provider: ${finalEmailConfig.provider}`)
    console.log(`   - Sender: ${finalEmailConfig.senderEmail}`)
    console.log(`   - API Key válida: ${!!finalEmailConfig.resend?.apiKey}`)
    console.log(`   - API Key formato: ${finalEmailConfig.resend?.apiKey?.startsWith("re_") ? "✅" : "❌"}`)

    // 6. Simular validações
    console.log("\n6️⃣ Executando validações...")

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const validEmail = emailRegex.test(mockRecipientData.email)
    console.log(`   - Email válido: ${validEmail ? "✅" : "❌"}`)

    const hasApiKey = !!finalEmailConfig.resend?.apiKey
    console.log(`   - Tem API Key: ${hasApiKey ? "✅" : "❌"}`)

    const validApiKey = finalEmailConfig.resend?.apiKey?.startsWith("re_")
    console.log(`   - API Key válida: ${validApiKey ? "✅" : "❌"}`)

    if (validEmail && hasApiKey && validApiKey) {
      console.log("\n🎉 SUCESSO: Todas as validações passaram!")
      console.log("💡 O email deveria ser enviado com sucesso")
      console.log("\n📋 Próximos passos para debug:")
      console.log("1. Verifique os logs do console durante a emissão real")
      console.log("2. Teste com o dashboard de teste de email")
      console.log("3. Verifique se o Resend está funcionando")
    } else {
      console.log("\n❌ FALHA: Algumas validações falharam")
      console.log("💡 O email NÃO seria enviado")
    }
  } catch (error) {
    console.error("❌ Erro durante a simulação:", error)
  }
}

// Executar a simulação
simulateEmailSend()

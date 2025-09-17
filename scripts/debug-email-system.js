// Script para debugar o sistema de email
// Execute este script para verificar se tudo está funcionando

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variáveis de ambiente do Supabase não encontradas")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugEmailSystem() {
  console.log("🔍 [Debug] Iniciando auditoria do sistema de email...\n")

  try {
    // 1. Verificar se a tabela email_api_keys existe
    console.log("1️⃣ Verificando tabela email_api_keys...")
    const { data: apiKeysTable, error: apiKeysError } = await supabase.from("email_api_keys").select("*").limit(1)

    if (apiKeysError) {
      console.error("❌ Erro ao acessar tabela email_api_keys:", apiKeysError.message)
      if (apiKeysError.message.includes("does not exist")) {
        console.log("💡 Solução: Execute o script scripts/31-add-encrypted-api-keys.sql")
      }
    } else {
      console.log("✅ Tabela email_api_keys existe e está acessível")
    }

    // 2. Verificar templates com configuração de email
    console.log("\n2️⃣ Verificando templates com configuração de email...")
    const { data: templates, error: templatesError } = await supabase
      .from("certificate_templates")
      .select("id, title, user_id, form_design")
      .not("form_design->emailConfig", "is", null)

    if (templatesError) {
      console.error("❌ Erro ao buscar templates:", templatesError.message)
    } else {
      console.log(`✅ Encontrados ${templates.length} templates com configuração de email`)

      for (const template of templates) {
        const emailConfig = template.form_design?.emailConfig
        if (emailConfig) {
          console.log(`\n📋 Template: ${template.title} (${template.id})`)
          console.log(`   - Email habilitado: ${emailConfig.enabled}`)
          console.log(`   - Provider: ${emailConfig.provider}`)
          console.log(`   - Sender: ${emailConfig.senderEmail}`)
          console.log(`   - Tem API Key: ${!!emailConfig.resend?.apiKey}`)
          console.log(`   - Tem keyHash: ${!!emailConfig.resend?.keyHash}`)

          // Se tem keyHash, verificar se existe na tabela de API keys
          if (emailConfig.resend?.keyHash) {
            const { data: keyData, error: keyError } = await supabase
              .from("email_api_keys")
              .select("id, provider, is_active, created_at")
              .eq("user_id", template.user_id)
              .eq("provider", "resend")
              .eq("key_hash", emailConfig.resend.keyHash)
              .eq("is_active", true)
              .single()

            if (keyError) {
              console.log(`   ❌ API Key não encontrada no banco: ${keyError.message}`)
            } else {
              console.log(`   ✅ API Key encontrada no banco (criada em ${keyData.created_at})`)
            }
          }
        }
      }
    }

    // 3. Verificar certificados emitidos recentemente
    console.log("\n3️⃣ Verificando certificados emitidos nas últimas 24h...")
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const { data: recentCerts, error: certsError } = await supabase
      .from("issued_certificates")
      .select("id, certificate_number, recipient_email, issued_at, template_id")
      .gte("issued_at", yesterday.toISOString())
      .order("issued_at", { ascending: false })
      .limit(10)

    if (certsError) {
      console.error("❌ Erro ao buscar certificados:", certsError.message)
    } else {
      console.log(`✅ Encontrados ${recentCerts.length} certificados emitidos nas últimas 24h`)

      for (const cert of recentCerts) {
        console.log(`\n📜 Certificado: ${cert.certificate_number}`)
        console.log(`   - Email destinatário: ${cert.recipient_email}`)
        console.log(`   - Emitido em: ${cert.issued_at}`)
        console.log(`   - Template ID: ${cert.template_id}`)
      }
    }

    // 4. Verificar logs de email (se houver)
    console.log("\n4️⃣ Verificando configuração do Resend...")
    const resendApiKey = process.env.RESEND_API_KEY
    if (resendApiKey) {
      console.log("✅ RESEND_API_KEY encontrada nas variáveis de ambiente")
      console.log(`   - Formato correto: ${resendApiKey.startsWith("re_") ? "✅" : "❌"}`)
    } else {
      console.log("⚠️ RESEND_API_KEY não encontrada nas variáveis de ambiente")
      console.log("💡 Isso é normal se estiver usando chaves criptografadas por usuário")
    }

    console.log("\n🎯 [Debug] Auditoria concluída!")
    console.log("\n📋 Resumo dos possíveis problemas:")
    console.log("1. Verifique se a tabela email_api_keys existe")
    console.log("2. Verifique se os templates têm emailConfig.enabled = true")
    console.log("3. Verifique se há API Keys válidas salvas para os usuários")
    console.log("4. Verifique os logs do console durante a emissão de certificados")
    console.log("5. Teste o envio manual usando o dashboard de teste de email")
  } catch (error) {
    console.error("❌ Erro durante a auditoria:", error)
  }
}

// Executar o debug
debugEmailSystem()

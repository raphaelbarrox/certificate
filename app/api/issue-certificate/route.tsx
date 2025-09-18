import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateVisualCertificatePDF } from "@/lib/visual-certificate-generator"
import { EmailService } from "@/lib/email-service"
import { ImageCache } from "@/lib/image-cache"
import { PDFCache } from "@/lib/pdf-cache"
import { QRCodeCache } from "@/lib/qrcode-cache"
import { getRealIP, checkRateLimit, createRateLimitResponse, addRateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit"
import { CertificateDataSchema, sanitizeObject, validateCertificateOwnership } from "@/lib/input-validator"
import { createSecureResponse } from "@/lib/security-headers"
import { securityLogger } from "@/lib/security-logger"

async function imageUrlToDataUrl(url: string): Promise<string> {
  return ImageCache.getImageDataUrl(url)
}

async function sendCertificateEmail(template: any, recipientData: any, certificateNumber: string, pdfUrl: string) {
  console.log(`[v0] [Email] 🚀 Iniciando processo de envio para certificado ${certificateNumber}`)

  // DEBUG: Ver toda a estrutura do template
  console.log(`[v0] [Email] Template completo:`, {
    hasFormDesign: !!template.form_design,
    formDesignKeys: Object.keys(template.form_design || {}),
    hasDesign: !!template.form_design?.design,
    hasEmailConfig: !!template.form_design?.emailConfig,
    hasDesignEmailConfig: !!template.form_design?.design?.emailConfig,
  })

  // CORREÇÃO PRINCIPAL: Buscar emailConfig no lugar CORRETO
  // Tenta primeiro em form_design.design.emailConfig (estrutura nova)
  // Se não encontrar, tenta em form_design.emailConfig (estrutura antiga/legado)
  const emailConfig = template.form_design?.design?.emailConfig || template.form_design?.emailConfig

  console.log(`[v0] [Email] EmailConfig encontrado:`, !!emailConfig)
  console.log(`[v0] [Email] EmailConfig completo:`, JSON.stringify(emailConfig, null, 2))

  if (!emailConfig) {
    console.log(`[v0] [Email] ❌ EmailConfig não encontrado no template ${template.id}`)
    console.log(`[v0] [Email] form_design disponível:`, JSON.stringify(template.form_design, null, 2))
    return { success: false, reason: "Configuração de email não encontrada no template" }
  }

  // Verificação robusta do enabled - aceita múltiplos formatos
  const isEnabled =
    emailConfig.enabled === true ||
    emailConfig.enabled === "true" ||
    emailConfig.enabled === 1 ||
    emailConfig.enabled === "1"

  console.log(`[v0] [Email] Toggle enabled (raw):`, emailConfig.enabled)
  console.log(`[v0] [Email] Toggle enabled (tipo):`, typeof emailConfig.enabled)
  console.log(`[v0] [Email] Toggle enabled (convertido):`, isEnabled)

  if (!isEnabled) {
    console.log(`[v0] [Email] ❌ Envio desativado para o template ${template.id}`)
    return { success: false, reason: "Envio de email está desativado no template" }
  }

  console.log(`[v0] [Email] ✅ Email habilitado para template ${template.id}`)

  const { senderName, senderEmail, subject, body } = emailConfig

  // Validação dos campos obrigatórios
  const missingFields = []
  if (!senderEmail || typeof senderEmail !== "string" || !senderEmail.trim()) missingFields.push("senderEmail")
  if (!subject || typeof subject !== "string" || !subject.trim()) missingFields.push("subject")
  if (!body || typeof body !== "string" || !body.trim()) missingFields.push("body")

  if (missingFields.length > 0) {
    console.error(`[v0] [Email] ❌ Campos obrigatórios faltando:`, missingFields)
    console.error(`[v0] [Email] Configuração atual:`, {
      senderName: senderName || "VAZIO",
      senderEmail: senderEmail || "VAZIO",
      subject: subject || "VAZIO",
      body: body ? `DEFINIDO (${body.length} chars)` : "VAZIO",
    })
    return { success: false, reason: `Campos obrigatórios não preenchidos: ${missingFields.join(", ")}` }
  }

  // Busca aprimorada do email do destinatário
  let recipientEmail = recipientData.default_email || recipientData.email || recipientData.recipient_email

  // Se não encontrou nas chaves padrão, busca em QUALQUER campo que tenha @
  if (!recipientEmail) {
    console.log(`[v0] [Email] Email não encontrado nas chaves padrão, buscando em todos os campos...`)
    for (const [key, value] of Object.entries(recipientData)) {
      if (typeof value === "string" && value.includes("@")) {
        recipientEmail = value
        console.log(`[v0] [Email] Email encontrado na chave '${key}': ${recipientEmail}`)
        break
      }
    }
  }

  console.log(`[v0] [Email] Buscando email do destinatário:`, {
    default_email: recipientData.default_email,
    email: recipientData.email,
    recipient_email: recipientData.recipient_email,
    emailEncontrado: recipientEmail,
    todasAsChaves: Object.keys(recipientData),
  })

  if (!recipientEmail || typeof recipientEmail !== "string" || !recipientEmail.trim()) {
    console.error(`[v0] [Email] ❌ Email do destinatário não encontrado`)
    console.error(`[v0] [Email] Chaves disponíveis:`, Object.keys(recipientData))
    console.error(`[v0] [Email] Dados completos:`, JSON.stringify(recipientData, null, 2))
    return { success: false, reason: "Email do destinatário não encontrado nos dados fornecidos" }
  }

  // Validação do formato do email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(recipientEmail)) {
    console.error(`[v0] [Email] ❌ Email inválido: ${recipientEmail}`)
    return { success: false, reason: `Email inválido: ${recipientEmail}` }
  }

  console.log(`[v0] [Email] ✅ Email do destinatário confirmado e válido: ${recipientEmail}`)

  // Validação do domínio do remetente
  if (!EmailService.validateEmailDomain(senderEmail)) {
    console.error(`[v0] [Email] ❌ Domínio inválido: ${senderEmail}`)
    return {
      success: false,
      reason: `Domínio de email inválido: ${senderEmail}. Use um email @therapist.international`,
    }
  }

  console.log(`[v0] [Email] ✅ Domínio válido: ${senderEmail}`)
  console.log(`[v0] [Email] 📧 Configuração final:`, {
    from: `${senderName || "Sistema"} <${senderEmail}>`,
    to: recipientEmail,
    subject: subject,
    bodyLength: body.length,
  })

  try {
    console.log(`[v0] [Email] === DADOS RECEBIDOS DO FORMULÁRIO ===`)
    console.log(`[v0] [Email] Todas as chaves disponíveis:`, Object.keys(recipientData))
    console.log(`[v0] [Email] Dados completos:`, JSON.stringify(recipientData, null, 2))
    console.log(`[v0] [Email] ==========================================`)

    // Preparação dos dados para substituição - usar EXATAMENTE os dados que vieram
    const emailData: Record<string, any> = {
      // Dados do certificado
      certificate_link: pdfUrl,
      certificate_id: certificateNumber,

      // Dados do destinatário - incluir TODOS os campos EXATOS
      ...recipientData,

      // Garantir que campos de email existam
      email: recipientEmail,
      default_email: recipientEmail,
    }

    console.log(`[v0] [Email] Dados finais para substituição:`, Object.keys(emailData))
    console.log(`[v0] [Email] Verificando se 'nome' existe:`, emailData.nome)
    console.log(`[v0] [Email] Verificando se 'name' existe:`, emailData.name)
    console.log(`[v0] [Email] Verificando se 'participante' existe:`, emailData.participante)

    // Substituição das variáveis no corpo e assunto
    let finalBody = String(body)
    let finalSubject = String(subject)

    // Realizar substituições - aceita {{var}} e {{ var }} (com espaços)
    Object.keys(emailData).forEach((key) => {
      const value = emailData[key] || ""

      // Substituir {{key}} (exato)
      const regex1 = new RegExp(`{{${key}}}`, "gi")
      finalBody = finalBody.replace(regex1, String(value))
      finalSubject = finalSubject.replace(regex1, String(value))

      // Substituir {{ key }} (com espaços)
      const regex2 = new RegExp(`{{\\s*${key}\\s*}}`, "gi")
      finalBody = finalBody.replace(regex2, String(value))
      finalSubject = finalSubject.replace(regex2, String(value))
    })

    console.log(`[v0] [Email] 📧 === PREPARANDO ENVIO FINAL ===`)
    console.log(`[v0] [Email] 📧 De: ${senderName || "Sistema de Certificados"} <${senderEmail}>`)
    console.log(`[v0] [Email] 📧 Para: ${recipientEmail}`)
    console.log(`[v0] [Email] 📧 Assunto processado: ${finalSubject}`)
    console.log(`[v0] [Email] 📧 Corpo (primeiros 200 chars): ${finalBody.substring(0, 200)}...`)
    console.log(`[v0] [Email] 📧 ========================`)

    // CHAMADA DO ENVIO - Exatamente como no teste que funciona
    const result = await EmailService.sendEmail({
      from: EmailService.formatSenderEmail(senderName || "Sistema de Certificados", senderEmail),
      to: recipientEmail,
      subject: finalSubject,
      html: finalBody,
    })

    console.log(`[v0] [Email] Resultado do envio:`, JSON.stringify(result, null, 2))

    if (result.success) {
      console.log(`[v0] [Email] ✅ === EMAIL ENVIADO COM SUCESSO ===`)
      console.log(`[v0] [Email] ✅ Message ID: ${result.messageId}`)
      console.log(`[v0] [Email] ✅ Destinatário: ${recipientEmail}`)
      console.log(`[v0] [Email] ✅ Certificado: ${certificateNumber}`)
      console.log(`[v0] [Email] ✅ ================================`)
      return { success: true, messageId: result.messageId }
    } else {
      console.error(`[v0] [Email] ❌ === FALHA NO ENVIO ===`)
      console.error(`[v0] [Email] ❌ Erro: ${result.error}`)
      console.error(`[v0] [Email] ❌ Destinatário: ${recipientEmail}`)
      console.error(`[v0] [Email] ❌ ====================`)
      return { success: false, reason: result.error }
    }
  } catch (error) {
    console.error(`[v0] [Email] ❌ === ERRO INESPERADO ===`)
    console.error(`[v0] [Email] ❌ Erro:`, error)
    console.error(`[v0] [Email] ❌ Stack:`, error instanceof Error ? error.stack : "N/A")
    console.error(`[v0] [Email] ❌ Tipo do erro:`, typeof error)
    console.error(`[v0] [Email] ❌ ======================`)
    return { success: false, reason: error instanceof Error ? error.message : "Erro desconhecido" }
  }
}

export async function POST(request: NextRequest) {
  const clientIP = getRealIP(request)
  const userAgent = request.headers.get("user-agent") || "unknown"
  const rateLimitKey = `${clientIP}:/api/issue-certificate`
  const rateLimitConfig = RATE_LIMITS["/api/issue-certificate"]

  const { allowed, remaining, resetTime } = checkRateLimit(rateLimitKey, rateLimitConfig)

  if (!allowed) {
    securityLogger.log({
      type: "rate_limit",
      ip: clientIP,
      userAgent,
      endpoint: "/api/issue-certificate",
      details: "Rate limit exceeded",
    })
    console.log(`[Rate Limit] Blocked request from ${clientIP} - limit exceeded`)
    return createRateLimitResponse(resetTime)
  }

  console.log(`[Rate Limit] Request allowed from ${clientIP} - ${remaining} remaining`)

  const supabase = createClient()
  let issuedCertificateData: any = null
  let oldPdfPath: string | null = null // Track old PDF for deletion

  try {
    const requestData = await request.json()

    const validationResult = CertificateDataSchema.safeParse(requestData)

    if (!validationResult.success) {
      securityLogger.log({
        type: "validation_error",
        ip: clientIP,
        userAgent,
        endpoint: "/api/issue-certificate",
        details: `Validation failed: ${validationResult.error.message}`,
      })

      const errorResponse = createSecureResponse({ error: "Dados inválidos fornecidos" }, 400)
      return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
    }

    const sanitizedData = sanitizeObject(validationResult.data)
    const { template_id, recipient_data, photo_url, certificate_number_to_update, recipient_cpf, recipient_dob } =
      sanitizedData

    // DEBUG: Log para rastrear os dados recebidos
    console.log(`[API] ====== INÍCIO DO PROCESSAMENTO ======`)
    console.log(`[API] Template ID: ${template_id}`)
    console.log(`[API] Certificate Update: ${certificate_number_to_update || "NOVO"}`)
    console.log(`[API] Recipient Data Keys:`, Object.keys(recipient_data || {}))
    console.log(`[API] Recipient Data Completo:`, JSON.stringify(recipient_data, null, 2))

    // Verificar especificamente campos de email
    const emailFields = Object.entries(recipient_data || {}).filter(
      ([key, value]) =>
        key.toLowerCase().includes("email") ||
        key.toLowerCase().includes("mail") ||
        (typeof value === "string" && value.includes("@")),
    )
    console.log(`[API] Campos relacionados a email encontrados:`, emailFields)
    console.log(`[API] =====================================`)

    if (!template_id || !recipient_data || !recipient_cpf || !recipient_dob) {
      return NextResponse.json(
        { error: "Dados do destinatário, CPF e Data de Nascimento são obrigatórios" },
        { status: 400 },
      )
    }

    if (certificate_number_to_update) {
      console.log("[PDF Cache] Invalidating cache for certificate update:", certificate_number_to_update)
      PDFCache.forceInvalidateForUpdate(template_id, recipient_data)
      ImageCache.invalidateForTemplate?.(template_id)

      const { data: existingCert } = await supabase
        .from("issued_certificates")
        .select("pdf_url")
        .eq("certificate_number", certificate_number_to_update)
        .single()

      if (existingCert?.pdf_url) {
        const urlParts = existingCert.pdf_url.split("/generated-certificates/")
        if (urlParts.length > 1) {
          oldPdfPath = urlParts[1]
          console.log("[Storage] Old PDF path to delete:", oldPdfPath)
        }
      }

      const { data: existingCertificate, error: checkError } = await supabase
        .from("issued_certificates")
        .select("id, template_id, recipient_cpf, recipient_dob, pdf_url")
        .eq("certificate_number", certificate_number_to_update)
        .eq("recipient_cpf", recipient_cpf)
        .eq("recipient_dob", recipient_dob)
        .single()

      if (checkError || !existingCertificate) {
        securityLogger.log({
          type: "unauthorized_access",
          ip: clientIP,
          userAgent,
          endpoint: "/api/issue-certificate",
          details: `Attempted to update non-existent certificate: ${certificate_number_to_update}`,
        })

        console.error("Certificado não encontrado para atualização:", checkError)
        const errorResponse = createSecureResponse(
          { error: "Certificado não encontrado ou dados de validação incorretos" },
          404,
        )
        return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
      }

      if (!validateCertificateOwnership(existingCertificate, { recipient_cpf, recipient_dob })) {
        securityLogger.log({
          type: "unauthorized_access",
          ip: clientIP,
          userAgent,
          endpoint: "/api/issue-certificate",
          details: `Ownership validation failed for certificate: ${certificate_number_to_update}`,
        })

        const errorResponse = createSecureResponse({ error: "Acesso negado" }, 403)
        return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
      }

      if (existingCertificate.template_id !== template_id) {
        return NextResponse.json({ error: "Template não corresponde ao certificado original" }, { status: 400 })
      }

      console.log(
        `[AUDIT] Updating certificate ${certificate_number_to_update} - Old PDF: ${existingCertificate.pdf_url}`,
      )
    }

    const cachedPDF = certificate_number_to_update ? null : PDFCache.get(template_id, recipient_data)
    if (cachedPDF && !certificate_number_to_update) {
      console.log("[PDF Cache] Using cached PDF for template:", template_id)
    }

    const { data: template, error: templateError } = await supabase
      .from("certificate_templates")
      .select(`*`)
      .eq("id", template_id)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: "Template de certificado não encontrado" }, { status: 404 })
    }

    const templateData = template.template_data || {}
    const processedRecipientData = { ...recipient_data }

    let finalBackgroundImage = templateData.background_image || templateData.backgroundImage
    if (finalBackgroundImage && finalBackgroundImage.startsWith("http")) {
      finalBackgroundImage = await imageUrlToDataUrl(finalBackgroundImage)
    }

    const imagePlaceholders = (templateData.elements || []).filter(
      (el: any) => el.type === "image-placeholder" && el.placeholderId,
    )

    const imagePromises = imagePlaceholders.map(async (placeholder: any) => {
      const imageUrl = processedRecipientData[placeholder.placeholderId]
      if (imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http")) {
        const dataUrl = await imageUrlToDataUrl(imageUrl)
        return { placeholderId: placeholder.placeholderId, dataUrl }
      }
      return null
    })

    const imageResults = await Promise.allSettled(imagePromises)
    imageResults.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        const { placeholderId, dataUrl } = result.value
        if (dataUrl) processedRecipientData[placeholderId] = dataUrl
      }
    })

    const canvasWidth = templateData.canvasSize?.width || templateData.canvas_width || 1200
    const canvasHeight = templateData.canvasSize?.height || templateData.canvas_height || 850

    const templateForPdf = {
      elements: templateData.elements || [],
      backgroundImage: finalBackgroundImage,
      backgroundColor: templateData.background_color || templateData.backgroundColor || "#ffffff",
      canvasWidth: canvasWidth,
      canvasHeight: canvasHeight,
      placeholders: template.placeholders || [],
    }

    const certificateNumber =
      certificate_number_to_update || `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    const verificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/certificates/${certificateNumber}`

    let qrCodeDataUrl = ""
    try {
      qrCodeDataUrl = await QRCodeCache.getQRCodeDataUrl(verificationUrl, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 256,
      })
    } catch (qrError) {
      console.error("Erro ao gerar QR Code:", qrError)
    }

    let pdfBytes: ArrayBuffer
    if (cachedPDF && !certificate_number_to_update) {
      console.log("[PDF Cache] Using cached PDF for new certificate")
      pdfBytes = cachedPDF
    } else {
      console.log("[PDF Generation] Generating new PDF for certificate:", certificateNumber)
      const pdf = generateVisualCertificatePDF(templateForPdf, processedRecipientData, qrCodeDataUrl, certificateNumber)
      pdfBytes = pdf.output("arraybuffer")

      if (!certificate_number_to_update) {
        PDFCache.set(template_id, recipient_data, pdfBytes)
      }
    }

    const timestamp = Date.now()
    const pdfFileName = certificate_number_to_update
      ? `certificado-${certificateNumber}-${timestamp}.pdf`
      : `certificado-${certificateNumber}.pdf`
    const pdfFilePath = `public/${pdfFileName}`

    const { error: uploadError } = await supabase.storage
      .from("generated-certificates")
      .upload(pdfFilePath, pdfBytes, { contentType: "application/pdf", upsert: false })

    if (uploadError) {
      console.error("Erro no Upload do PDF:", uploadError)
      throw new Error(`Falha ao fazer upload do PDF: ${uploadError.message}`)
    }

    const { data: urlData } = supabase.storage.from("generated-certificates").getPublicUrl(pdfFilePath)
    const pdf_url = urlData.publicUrl

    if (certificate_number_to_update) {
      console.log("[DB Update] Updating certificate:", certificate_number_to_update)
      const { data: updatedCertificate, error: dbError } = await supabase
        .from("issued_certificates")
        .update({
          recipient_data: recipient_data,
          recipient_email: recipient_data.default_email || recipient_data.email,
          photo_url: photo_url || null,
          pdf_url: pdf_url,
          updated_at: new Date().toISOString(),
        })
        .eq("certificate_number", certificate_number_to_update)
        .eq("recipient_cpf", recipient_cpf)
        .eq("recipient_dob", recipient_dob)
        .select()
        .single()

      if (dbError) {
        console.error("Erro ao atualizar no BD:", dbError)
        throw new Error("Falha ao atualizar os dados do certificado.")
      }

      if (oldPdfPath) {
        try {
          const { error: deleteError } = await supabase.storage.from("generated-certificates").remove([oldPdfPath])

          if (deleteError) {
            console.warn("[Storage] Failed to delete old PDF:", deleteError.message)
          } else {
            console.log("[Storage] Successfully deleted old PDF:", oldPdfPath)
          }
        } catch (deleteErr) {
          console.warn("[Storage] Error deleting old PDF:", deleteErr)
        }
      }

      issuedCertificateData = updatedCertificate
      console.log(`[AUDIT] Certificate updated successfully - ID: ${updatedCertificate.id}, New PDF: ${pdf_url}`)
    } else {
      const { data: newCertificate, error: dbError } = await supabase
        .from("issued_certificates")
        .insert({
          template_id: template_id,
          recipient_data: recipient_data,
          recipient_email: recipient_data.default_email || recipient_data.email,
          certificate_number: certificateNumber,
          photo_url: photo_url || null,
          pdf_url: pdf_url,
          recipient_cpf,
          recipient_dob,
        })
        .select()
        .single()

      if (dbError) {
        console.error("Erro na Inserção no BD:", dbError)
        throw new Error("Falha ao salvar os dados do certificado.")
      }
      issuedCertificateData = newCertificate
    }

    console.log(`[v0] [Email] 🚀 Iniciando envio automático de email...`)
    console.log(`[v0] [Email] Template para envio:`, {
      id: template.id,
      hasFormDesign: !!template.form_design,
      hasEmailConfig: !!template.form_design?.emailConfig,
      hasDesignEmailConfig: !!template.form_design?.design?.emailConfig,
    })
    console.log(`[v0] [Email] Dados do destinatário para envio:`, recipient_data)

    const emailResult = await sendCertificateEmail(template, recipient_data, certificateNumber, pdf_url)

    console.log(`[v0] [Email] Resultado final do envio:`, emailResult)

    if (emailResult.success) {
      console.log(`[v0] [Email] ✅ Email enviado automaticamente! ID: ${emailResult.messageId}`)
    } else {
      console.error(`[v0] [Email] ❌ Falha no envio automático: ${emailResult.reason}`)
    }

    const response = createSecureResponse({
      ...issuedCertificateData,
      emailSent: emailResult.success,
      emailError: emailResult.success ? null : emailResult.reason,
    })

    return addRateLimitHeaders(response, remaining - 1, resetTime)
  } catch (error) {
    securityLogger.log({
      type: "suspicious_activity",
      ip: clientIP,
      userAgent,
      endpoint: "/api/issue-certificate",
      details: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
    })

    console.error("Erro ao emitir certificado:", error)
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido"

    const errorResponse = createSecureResponse({ error: "Erro interno do servidor" }, 500)
    return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
  }
}

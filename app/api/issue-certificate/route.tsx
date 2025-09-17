import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateVisualCertificatePDF } from "@/lib/visual-certificate-generator"
import { ImageCache } from "@/lib/image-cache"
import { PDFCache } from "@/lib/pdf-cache"
import { QRCodeCache } from "@/lib/qrcode-cache"
import { EmailService } from "@/lib/email-providers/email-service"

async function imageUrlToDataUrl(url: string): Promise<string> {
  return ImageCache.getImageDataUrl(url)
}

async function logEmailEvent(
  templateId: string,
  userId: string,
  type: string,
  status: string,
  message: string,
  details: any = {},
) {
  try {
    const supabase = createClient()
    await supabase.from("email_logs").insert({
      template_id: templateId,
      user_id: userId,
      type,
      status,
      message,
      details,
    })
    console.log(`📝 [v0] [Email Log] ${status.toUpperCase()}: ${message}`)
  } catch (error) {
    console.error(`❌ [v0] [Email Log] Erro ao salvar log:`, error)
  }
}

async function sendCertificateEmail(
  template: any,
  recipientData: any,
  certificateNumber: string,
  pdfUrl: string,
  pdfBytes: ArrayBuffer,
) {
  const startTime = Date.now()
  const emailConfig = template.form_design?.emailConfig

  await logEmailEvent(
    template.id,
    template.user_id,
    "certificate_issued",
    "info",
    "Iniciando processo de envio de certificado",
    {
      certificateId: certificateNumber,
      configEnabled: !!emailConfig?.enabled,
      hasResendConfig: !!emailConfig?.resend,
    },
  )

  if (!emailConfig || !emailConfig.enabled) {
    console.log(`🔕 [v0] [Email] Envio desativado para o template ${template.id}.`)
    await logEmailEvent(
      template.id,
      template.user_id,
      "certificate_issued",
      "info",
      "Envio de email desativado na configuração do template",
      { certificateId: certificateNumber },
    )
    return
  }

  // Priorizar 'email' (campo padrão do formulário) ao invés de 'default_email'
  const recipientEmail = recipientData.email || recipientData.default_email

  console.log(`🔍 [v0] [Email Debug] Dados do destinatário:`, {
    hasEmail: !!recipientData.email,
    hasDefaultEmail: !!recipientData.default_email,
    finalEmail: recipientEmail,
    allKeys: Object.keys(recipientData),
    certificateNumber,
  })

  if (!recipientEmail) {
    const errorMsg = `Nenhum email encontrado nos dados do destinatário`
    console.error(`❌ [v0] [Email] ERRO: ${errorMsg} para o certificado ${certificateNumber}`)
    console.error(`🔍 [v0] [Email] Dados disponíveis:`, Object.keys(recipientData))

    await logEmailEvent(template.id, template.user_id, "certificate_issued", "error", errorMsg, {
      certificateId: certificateNumber,
      availableFields: Object.keys(recipientData),
      error: "No email field found in recipient data",
    })
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(recipientEmail)) {
    const errorMsg = `Email inválido: ${recipientEmail}`
    console.error(`❌ [v0] [Email] ERRO: ${errorMsg} para o certificado ${certificateNumber}`)

    await logEmailEvent(template.id, template.user_id, "certificate_issued", "error", errorMsg, {
      certificateId: certificateNumber,
      recipient: recipientEmail,
      error: "Invalid email format",
    })
    return
  }

  try {
    console.log(`🚀 [v0] [Email] ✅ Iniciando envio para ${recipientEmail} (Certificado: ${certificateNumber})`)

    await logEmailEvent(template.id, template.user_id, "certificate_issued", "info", "Preparando envio de email", {
      certificateId: certificateNumber,
      recipient: recipientEmail,
      pdfSize: `${Math.round(pdfBytes.byteLength / 1024)}KB`,
    })

    // Replace placeholders
    let finalBody = emailConfig.body
    let finalSubject = emailConfig.subject

    const allData = {
      ...recipientData,
      certificate_link: pdfUrl,
      certificate_id: certificateNumber,
    }

    for (const key in allData) {
      const regex = new RegExp(`{{${key}}}`, "g")
      finalBody = finalBody.replace(regex, allData[key])
      finalSubject = finalSubject.replace(regex, allData[key])
    }

    // Prepare PDF attachment
    const pdfAttachment = {
      filename: `certificado-${certificateNumber}.pdf`,
      content: Buffer.from(pdfBytes),
      contentType: "application/pdf",
    }

    console.log(`📧 [v0] [Email] Enviando email com anexo de ${Math.round(pdfBytes.byteLength / 1024)}KB`)

    let finalEmailConfig = {
      ...emailConfig,
      provider: "resend" as const,
    }

    // Se há keyHash mas não há apiKey, precisamos descriptografar
    if (emailConfig.resend?.keyHash && !emailConfig.resend?.apiKey) {
      console.log(`🔐 [v0] [Email] Detectado keyHash, descriptografando API Key...`)

      await logEmailEvent(
        template.id,
        template.user_id,
        "certificate_issued",
        "info",
        "Descriptografando API Key do Resend",
        {
          certificateId: certificateNumber,
          keyHash: emailConfig.resend.keyHash.substring(0, 8) + "...",
        },
      )

      // Buscar o user_id do template
      const supabase = createClient()
      const { data: templateData, error: templateError } = await supabase
        .from("certificate_templates")
        .select("user_id")
        .eq("id", template.id)
        .single()

      if (templateError || !templateData) {
        const errorMsg = `Não foi possível obter user_id do template`
        console.error(`❌ [v0] [Email] ERRO: ${errorMsg} ${template.id}`)

        await logEmailEvent(template.id, template.user_id, "certificate_issued", "error", errorMsg, {
          certificateId: certificateNumber,
          error: templateError?.message || "Template not found",
        })
        return
      }

      try {
        // Importar o SecureEmailService
        const { SecureEmailService } = await import("@/lib/email-providers/secure-email-service")

        const decryptedConfig = await SecureEmailService.getDecryptedConfig(templateData.user_id, emailConfig)
        finalEmailConfig = decryptedConfig

        console.log(`✅ [v0] [Email] API Key descriptografada com sucesso`)

        await logEmailEvent(
          template.id,
          template.user_id,
          "certificate_issued",
          "info",
          "API Key descriptografada com sucesso",
          {
            certificateId: certificateNumber,
            apiKeyStatus: "decrypted",
          },
        )
      } catch (decryptError) {
        const errorMsg = `Erro ao descriptografar API Key`
        console.error(`❌ [v0] [Email] ${errorMsg}:`, decryptError)
        console.error(`🔍 [v0] [Email] Detalhes - keyHash: ${emailConfig.resend?.keyHash?.substring(0, 8)}...`)

        await logEmailEvent(template.id, template.user_id, "certificate_issued", "error", errorMsg, {
          certificateId: certificateNumber,
          keyHash: emailConfig.resend?.keyHash?.substring(0, 8) + "...",
          error: decryptError.message,
        })
        return
      }
    }

    // Verificar se temos uma API Key válida
    if (!finalEmailConfig.resend?.apiKey) {
      const errorMsg = `API Key do Resend não encontrada ou inválida`
      console.error(`❌ [v0] [Email] ERRO: ${errorMsg}`)
      console.error(`🔍 [v0] [Email] Config debug:`, {
        hasResendConfig: !!finalEmailConfig.resend,
        hasApiKey: !!finalEmailConfig.resend?.apiKey,
        hasKeyHash: !!emailConfig.resend?.keyHash,
        provider: finalEmailConfig.provider,
      })

      await logEmailEvent(template.id, template.user_id, "certificate_issued", "error", errorMsg, {
        certificateId: certificateNumber,
        configStatus: {
          hasResendConfig: !!finalEmailConfig.resend,
          hasApiKey: !!finalEmailConfig.resend?.apiKey,
          hasKeyHash: !!emailConfig.resend?.keyHash,
          provider: finalEmailConfig.provider,
        },
      })
      return
    }

    await logEmailEvent(template.id, template.user_id, "certificate_issued", "info", "Enviando email via Resend", {
      certificateId: certificateNumber,
      recipient: recipientEmail,
      subject: finalSubject,
      apiKeyStatus: "valid",
    })

    const result = await EmailService.sendEmailWithRetry(
      {
        to: recipientEmail,
        subject: finalSubject,
        html: finalBody,
        attachments: [pdfAttachment],
        config: finalEmailConfig,
      },
      3,
    )

    const duration = Date.now() - startTime

    if (result.success) {
      const successMsg = `Email enviado com sucesso para ${recipientEmail}`
      console.log(
        `✅ [v0] [Email] SUCESSO: ${successMsg} após ${result.attempts} tentativa(s). ID: ${result.messageId}`,
      )

      await logEmailEvent(template.id, template.user_id, "certificate_issued", "success", successMsg, {
        certificateId: certificateNumber,
        recipient: recipientEmail,
        messageId: result.messageId,
        attempts: result.attempts,
        duration,
      })
    } else {
      const errorMsg = `Falha no envio para ${recipientEmail} após ${result.attempts} tentativas`
      console.error(`❌ [v0] [Email] FALHA: ${errorMsg}: ${result.error}`)

      await logEmailEvent(template.id, template.user_id, "certificate_issued", "error", errorMsg, {
        certificateId: certificateNumber,
        recipient: recipientEmail,
        attempts: result.attempts,
        duration,
        error: result.error,
      })
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMsg = `Exceção durante envio de email para ${recipientEmail}`

    // Log the error but do not throw, to avoid breaking the main flow
    console.error(`❌ [v0] [Email] EXCEÇÃO: ${errorMsg} (Certificado: ${certificateNumber}):`, error)

    await logEmailEvent(template.id, template.user_id, "certificate_issued", "error", errorMsg, {
      certificateId: certificateNumber,
      recipient: recipientEmail,
      duration,
      error: error.message,
      stack: error.stack,
    })
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  let issuedCertificateData: any = null

  try {
    const { template_id, recipient_data, photo_url, certificate_number_to_update, recipient_cpf, recipient_dob } =
      await request.json()

    if (!template_id || !recipient_data || !recipient_cpf || !recipient_dob) {
      return NextResponse.json(
        { error: "Dados do destinatário, CPF e Data de Nascimento são obrigatórios" },
        { status: 400 },
      )
    }

    const cachedPDF = PDFCache.get(template_id, recipient_data)
    if (cachedPDF && !certificate_number_to_update) {
      console.log("[PDF Cache] Using cached PDF for template:", template_id)
      // Skip to database operations with cached PDF
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
      pdfBytes = cachedPDF
    } else {
      const pdf = generateVisualCertificatePDF(templateForPdf, processedRecipientData, qrCodeDataUrl, certificateNumber)
      pdfBytes = pdf.output("arraybuffer")

      PDFCache.set(template_id, recipient_data, pdfBytes)
    }

    const pdfFileName = `certificado-${certificateNumber}.pdf`
    const pdfFilePath = `public/${pdfFileName}`

    const { error: uploadError } = await supabase.storage
      .from("generated-certificates")
      .upload(pdfFilePath, pdfBytes, { contentType: "application/pdf", upsert: true })

    if (uploadError) {
      console.error("Erro no Upload do PDF:", uploadError)
      throw new Error(`Falha ao fazer upload do PDF: ${uploadError.message}`)
    }

    const { data: urlData } = supabase.storage.from("generated-certificates").getPublicUrl(pdfFilePath)
    const pdf_url = urlData.publicUrl

    if (certificate_number_to_update) {
      const { data: updatedCertificate, error: dbError } = await supabase
        .from("issued_certificates")
        .update({
          recipient_data: recipient_data,
          recipient_email: recipient_data.email || recipient_data.default_email,
          photo_url: photo_url || null,
          pdf_url: pdf_url,
          issued_at: new Date().toISOString(),
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
      issuedCertificateData = updatedCertificate
    } else {
      const { data: newCertificate, error: dbError } = await supabase
        .from("issued_certificates")
        .insert({
          template_id: template_id,
          recipient_data: recipient_data,
          recipient_email: recipient_data.email || recipient_data.default_email,
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

    // Trigger email sending after successful DB operation, without blocking the response
    try {
      await sendCertificateEmail(template, recipient_data, certificateNumber, pdf_url, pdfBytes)
      console.log(`✅ [v0] [Email] Processo de email concluído para certificado ${certificateNumber}`)
    } catch (emailError) {
      console.error(`❌ [v0] [Email] Erro no processo de email:`, emailError)
      // Não quebrar o fluxo principal se o email falhar
    }

    return NextResponse.json(issuedCertificateData)
  } catch (error) {
    console.error("Erro ao emitir certificado:", error)
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

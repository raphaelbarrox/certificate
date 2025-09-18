import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateVisualCertificatePDF } from "@/lib/visual-certificate-generator"
import { EmailService } from "@/lib/email-service"
import { ImageCache } from "@/lib/image-cache"
import { PDFCache } from "@/lib/pdf-cache"
import { QRCodeCache } from "@/lib/qrcode-cache"

async function imageUrlToDataUrl(url: string): Promise<string> {
  return ImageCache.getImageDataUrl(url)
}

async function sendCertificateEmail(template: any, recipientData: any, certificateNumber: string, pdfUrl: string) {
  console.log(`[v0] [Email] 🚀 Iniciando processo de envio para certificado ${certificateNumber}`)

  const emailConfig = template.form_design?.emailConfig
  console.log(`[v0] [Email] EmailConfig completo:`, JSON.stringify(emailConfig, null, 2))

  if (!emailConfig) {
    console.log(`[v0] [Email] ❌ EmailConfig não encontrado no template ${template.id}`)
    console.log(`[v0] [Email] form_design disponível:`, JSON.stringify(template.form_design, null, 2))
    return { success: false, reason: "Configuração de email não encontrada no template" }
  }

  const isEnabled = emailConfig.enabled === true || emailConfig.enabled === "true" || emailConfig.enabled === 1
  console.log(`[v0] [Email] Toggle enabled (original):`, emailConfig.enabled)
  console.log(`[v0] [Email] Toggle enabled (tipo):`, typeof emailConfig.enabled)
  console.log(`[v0] [Email] Toggle enabled (convertido):`, isEnabled)

  if (!isEnabled) {
    console.log(`[v0] [Email] ❌ Envio desativado para o template ${template.id}`)
    console.log(`[v0] [Email] Valor original do toggle:`, emailConfig.enabled)
    return { success: false, reason: "Envio de email está desativado no template" }
  }

  console.log(`[v0] [Email] ✅ Email habilitado para template ${template.id}`)

  const { senderName, senderEmail, subject, body } = emailConfig

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
      body: body ? "DEFINIDO" : "VAZIO",
      senderEmailType: typeof senderEmail,
      subjectType: typeof subject,
      bodyType: typeof body,
    })
    return { success: false, reason: `Campos obrigatórios não preenchidos: ${missingFields.join(", ")}` }
  }

  const recipientEmail = recipientData.default_email || recipientData.email || recipientData.recipient_email
  console.log(`[v0] [Email] Buscando email do destinatário:`, {
    default_email: recipientData.default_email,
    email: recipientData.email,
    recipient_email: recipientData.recipient_email,
    emailEncontrado: recipientEmail,
  })

  if (!recipientEmail || typeof recipientEmail !== "string" || !recipientEmail.trim()) {
    console.error(`[v0] [Email] ❌ Email do destinatário não encontrado`)
    console.error(`[v0] [Email] Dados completos do destinatário:`, JSON.stringify(recipientData, null, 2))
    return { success: false, reason: "Email do destinatário não encontrado nos dados fornecidos" }
  }

  console.log(`[v0] [Email] ✅ Email do destinatário confirmado: ${recipientEmail}`)

  console.log(`[v0] [Email] Configuração extraída:`, {
    senderName: senderName || "Não definido",
    senderEmail: senderEmail || "Não definido",
    subject: subject || "Não definido",
    body: body ? `Definido (${body.length} caracteres)` : "Não definido",
    recipientEmail: recipientEmail,
  })

  if (!EmailService.validateEmailDomain(senderEmail)) {
    console.error(`[v0] [Email] ❌ Domínio inválido: ${senderEmail}`)
    return {
      success: false,
      reason: `Domínio de email inválido: ${senderEmail}. Use um email @therapist.international`,
    }
  }

  console.log(`[v0] [Email] ✅ Domínio válido: ${senderEmail}`)

  try {
    const emailData = {
      nome: recipientData.nome || recipientData.name || recipientData.nome_completo || "Destinatário",
      certificate_link: pdfUrl,
      certificate_id: certificateNumber,
      ...recipientData,
    }

    console.log(`[v0] [Email] Dados para substituição:`, emailData)

    let finalBody = String(body)
    let finalSubject = String(subject)

    Object.keys(emailData).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, "g")
      const value = emailData[key] || ""
      finalBody = finalBody.replace(regex, String(value))
      finalSubject = finalSubject.replace(regex, String(value))
    })

    console.log(`[v0] [Email] 📧 Preparando envio:`)
    console.log(`[v0] [Email] 📧 Para: ${recipientEmail}`)
    console.log(`[v0] [Email] 📧 Assunto: ${finalSubject}`)
    console.log(`[v0] [Email] 📧 De: ${EmailService.formatSenderEmail(senderName || "Sistema", senderEmail)}`)
    console.log(`[v0] [Email] 📧 Corpo: ${finalBody.substring(0, 200)}...`)

    const result = await EmailService.sendEmail({
      from: EmailService.formatSenderEmail(senderName || "Sistema", senderEmail),
      to: recipientEmail,
      subject: finalSubject,
      html: finalBody,
    })

    console.log(`[v0] [Email] Resultado do envio:`, result)

    if (result.success) {
      console.log(`[v0] [Email] ✅ Email enviado com sucesso! ID: ${result.messageId}`)
      return { success: true, messageId: result.messageId }
    } else {
      console.error(`[v0] [Email] ❌ Falha no envio: ${result.error}`)
      return { success: false, reason: result.error }
    }
  } catch (error) {
    console.error(`[v0] [Email] ❌ Erro inesperado:`, error)
    return { success: false, reason: error instanceof Error ? error.message : "Erro desconhecido" }
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  let issuedCertificateData: any = null
  let oldPdfPath: string | null = null // Track old PDF for deletion

  try {
    const { template_id, recipient_data, photo_url, certificate_number_to_update, recipient_cpf, recipient_dob } =
      await request.json()

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

    if (certificate_number_to_update) {
      const { data: existingCertificate, error: checkError } = await supabase
        .from("issued_certificates")
        .select("id, template_id, recipient_cpf, recipient_dob, pdf_url")
        .eq("certificate_number", certificate_number_to_update)
        .eq("recipient_cpf", recipient_cpf)
        .eq("recipient_dob", recipient_dob)
        .single()

      if (checkError || !existingCertificate) {
        console.error("Certificado não encontrado para atualização:", checkError)
        return NextResponse.json(
          { error: "Certificado não encontrado ou dados de validação incorretos" },
          { status: 404 },
        )
      }

      if (existingCertificate.template_id !== template_id) {
        return NextResponse.json({ error: "Template não corresponde ao certificado original" }, { status: 400 })
      }

      console.log(
        `[AUDIT] Updating certificate ${certificate_number_to_update} - Old PDF: ${existingCertificate.pdf_url}`,
      )
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
    })
    console.log(`[v0] [Email] Dados do destinatário para envio:`, recipient_data)

    const emailResult = await sendCertificateEmail(template, recipient_data, certificateNumber, pdf_url)

    console.log(`[v0] [Email] Resultado final do envio:`, emailResult)

    if (emailResult.success) {
      console.log(`[v0] [Email] ✅ Email enviado automaticamente! ID: ${emailResult.messageId}`)
    } else {
      console.error(`[v0] [Email] ❌ Falha no envio automático: ${emailResult.reason}`)
    }

    return NextResponse.json({
      ...issuedCertificateData,
      emailSent: emailResult.success,
      emailError: emailResult.success ? null : emailResult.reason,
    })
  } catch (error) {
    console.error("Erro ao emitir certificado:", error)
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

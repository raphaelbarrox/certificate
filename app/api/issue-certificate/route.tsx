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
  const emailConfig = template.form_design?.emailConfig
  if (!emailConfig || !emailConfig.enabled) {
    console.log(`[Email] Envio desativado para o template ${template.id}.`)
    return
  }

  const { senderName, senderEmail, subject, body } = emailConfig
  const recipientEmail = recipientData.default_email || recipientData.email

  if (!recipientEmail) {
    console.error(`[Email] Nenhum email de destinatário encontrado para o certificado ${certificateNumber}.`)
    return
  }

  if (!EmailService.validateEmailDomain(senderEmail)) {
    console.error(`[Email] Email do remetente deve ser do domínio therapist.international: ${senderEmail}`)
    return
  }

  try {
    console.log(`[Email] Iniciando envio para ${recipientEmail} (Certificado: ${certificateNumber})`)

    let finalBody = body
    let finalSubject = subject

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

    const result = await EmailService.sendEmail({
      from: EmailService.formatSenderEmail(senderName || "Sistema", senderEmail),
      to: recipientEmail,
      subject: finalSubject,
      html: finalBody,
    })

    if (result.success) {
      console.log(`[Email] Mensagem enviada com sucesso. ID: ${result.messageId}`)
    } else {
      console.error(`[Email] Falha ao enviar email: ${result.error}`)
    }
  } catch (error) {
    // Log the error but do not throw, to avoid breaking the main flow
    console.error(`[Email] Falha ao enviar email para ${recipientEmail} (Certificado: ${certificateNumber}):`, error)
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

      // Get old PDF path for deletion
      const { data: existingCert } = await supabase
        .from("issued_certificates")
        .select("pdf_url")
        .eq("certificate_number", certificate_number_to_update)
        .single()

      if (existingCert?.pdf_url) {
        // Extract path from URL
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
      .upload(pdfFilePath, pdfBytes, { contentType: "application/pdf", upsert: false }) // Use upsert: false for new files

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

    await sendCertificateEmail(template, recipient_data, certificateNumber, pdf_url)

    return NextResponse.json(issuedCertificateData)
  } catch (error) {
    console.error("Erro ao emitir certificado:", error)
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

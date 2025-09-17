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

async function sendCertificateEmail(
  template: any,
  recipientData: any,
  certificateNumber: string,
  pdfUrl: string,
  pdfBytes: ArrayBuffer,
) {
  const emailConfig = template.form_design?.emailConfig
  if (!emailConfig || !emailConfig.enabled) {
    console.log(`[v0] [Email] Envio desativado para o template ${template.id}.`)
    return
  }

  const recipientEmail = recipientData.default_email || recipientData.email

  if (!recipientEmail) {
    console.error(`[v0] [Email] Nenhum email de destinatário encontrado para o certificado ${certificateNumber}.`)
    return
  }

  try {
    console.log(`[v0] [Email] Iniciando envio para ${recipientEmail} (Certificado: ${certificateNumber})`)

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

    const result = await EmailService.sendEmailWithRetry(
      {
        to: recipientEmail,
        subject: finalSubject,
        html: finalBody,
        attachments: [pdfAttachment],
        config: emailConfig,
      },
      3,
    )

    if (result.success) {
      console.log(
        `[v0] [Email] Mensagem enviada com sucesso após ${result.attempts} tentativa(s). ID: ${result.messageId}`,
      )
    } else {
      console.error(`[v0] [Email] Falha no envio após ${result.attempts} tentativas: ${result.error}`)
    }
  } catch (error) {
    // Log the error but do not throw, to avoid breaking the main flow
    console.error(
      `[v0] [Email] Falha ao enviar email para ${recipientEmail} (Certificado: ${certificateNumber}):`,
      error,
    )
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
          recipient_email: recipient_data.default_email || recipient_data.email,
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

    // Trigger email sending after successful DB operation, without blocking the response
    sendCertificateEmail(template, recipient_data, certificateNumber, pdf_url, pdfBytes)

    return NextResponse.json(issuedCertificateData)
  } catch (error) {
    console.error("Erro ao emitir certificado:", error)
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

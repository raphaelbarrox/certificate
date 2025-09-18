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

async function sendLogToAPI(message: string) {
  try {
    await fetch("/api/certificate-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    })
  } catch (error) {
    console.error("[Log API] Erro ao enviar log:", error)
  }
}

async function sendCertificateEmail(template: any, recipientData: any, certificateNumber: string, pdfUrl: string) {
  await sendLogToAPI(`🚀 INICIANDO PROCESSO DE ENVIO DE EMAIL - Certificado: ${certificateNumber}`)
  console.log(`[v0] 🚀 INICIANDO PROCESSO DE ENVIO DE EMAIL`)
  console.log(`[v0] Template ID: ${template.id}`)
  console.log(`[v0] Certificado: ${certificateNumber}`)
  console.log(`[v0] PDF URL: ${pdfUrl}`)
  console.log(`[v0] Template completo:`, JSON.stringify(template, null, 2))

  const emailConfig = template.form_design?.emailConfig
  console.log(`[v0] Configuração de email:`, JSON.stringify(emailConfig, null, 2))

  if (!emailConfig || !emailConfig.enabled) {
    await sendLogToAPI(
      `❌ ENVIO DESATIVADO - Template ${template.id} - emailConfig=${!!emailConfig}, enabled=${emailConfig?.enabled}`,
    )
    console.log(`[v0] ❌ Envio desativado para o template ${template.id}.`)
    console.log(`[v0] Motivo: emailConfig=${!!emailConfig}, enabled=${emailConfig?.enabled}`)
    return
  }

  await sendLogToAPI(`✅ EMAIL ATIVADO - Prosseguindo com envio`)
  console.log(`[v0] ✅ Email está ATIVADO - prosseguindo...`)

  const { senderName, senderEmail, subject, body } = emailConfig
  const recipientEmail = recipientData.default_email || recipientData.email

  await sendLogToAPI(
    `📧 DADOS DO EMAIL - De: ${senderName} <${senderEmail}> | Para: ${recipientEmail} | Assunto: ${subject}`,
  )
  console.log(`[v0] Dados do remetente:`)
  console.log(`[v0] - Nome: ${senderName}`)
  console.log(`[v0] - Email: ${senderEmail}`)
  console.log(`[v0] - Assunto: ${subject}`)
  console.log(`[v0] - Corpo (primeiros 50 chars): ${body?.substring(0, 50)}...`)
  console.log(`[v0] Destinatário: ${recipientEmail}`)
  console.log(`[v0] Dados do destinatário completos:`, JSON.stringify(recipientData, null, 2))

  if (!recipientEmail) {
    await sendLogToAPI(
      `❌ ERRO CRÍTICO - Nenhum email de destinatário encontrado para certificado ${certificateNumber}`,
    )
    console.error(`[v0] ❌ ERRO: Nenhum email de destinatário encontrado para o certificado ${certificateNumber}.`)
    return
  }

  if (!EmailService.validateEmailDomain(senderEmail)) {
    await sendLogToAPI(`❌ ERRO DOMÍNIO - Email remetente deve ser @therapist.international: ${senderEmail}`)
    console.error(`[v0] ❌ ERRO: Email do remetente deve ser do domínio therapist.international: ${senderEmail}`)
    return
  }

  try {
    await sendLogToAPI(`📧 PROCESSANDO TEMPLATE - Substituindo placeholders no email`)
    console.log(`[v0] 📧 Processando template do email...`)

    let finalBody = body
    let finalSubject = subject

    const allData = {
      ...recipientData,
      certificate_link: pdfUrl,
      certificate_id: certificateNumber,
    }

    console.log(`[v0] Dados para substituição:`, Object.keys(allData))

    for (const key in allData) {
      const regex = new RegExp(`{{${key}}}`, "g")
      finalBody = finalBody.replace(regex, allData[key])
      finalSubject = finalSubject.replace(regex, allData[key])
    }

    console.log(`[v0] Assunto final: ${finalSubject}`)
    console.log(`[v0] Corpo processado (primeiros 100 chars): ${finalBody.substring(0, 100)}...`)

    await sendLogToAPI(`🚀 ENVIANDO EMAIL VIA RESEND - Para: ${recipientEmail}`)
    console.log(`[v0] 🚀 ENVIANDO EMAIL VIA RESEND...`)
    const result = await EmailService.sendEmail({
      from: EmailService.formatSenderEmail(senderName || "Sistema", senderEmail),
      to: recipientEmail,
      subject: finalSubject,
      html: finalBody,
    })

    console.log(`[v0] Resultado do envio:`, JSON.stringify(result, null, 2))

    if (result.success) {
      await sendLogToAPI(`✅ EMAIL ENVIADO COM SUCESSO! ID: ${result.messageId} - Para: ${recipientEmail}`)
      console.log(`[v0] ✅ SUCESSO! Mensagem enviada. ID: ${result.messageId}`)
    } else {
      await sendLogToAPI(`❌ FALHA NO ENVIO - Erro: ${result.error} - Para: ${recipientEmail}`)
      console.error(`[v0] ❌ FALHA no envio: ${result.error}`)
    }
  } catch (error) {
    await sendLogToAPI(`❌ ERRO CRÍTICO NO ENVIO - ${error} - Para: ${recipientEmail}`)
    console.error(`[v0] ❌ ERRO CRÍTICO ao enviar email para ${recipientEmail} (Certificado: ${certificateNumber}):`)
    console.error(`[v0] Erro:`, error)
    console.error(`[v0] Stack:`, (error as Error).stack)
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  let issuedCertificateData: any = null
  let oldPdfPath: string | null = null // Track old PDF for deletion

  try {
    let requestData
    try {
      const requestText = await request.text()
      console.log("[API] Raw request body:", requestText.substring(0, 200) + "...")

      if (!requestText.trim()) {
        throw new Error("Request body is empty")
      }

      // Verificar se o conteúdo parece ser JSON
      if (!requestText.trim().startsWith("{") && !requestText.trim().startsWith("[")) {
        throw new Error(`Request body is not JSON format. Content starts with: "${requestText.substring(0, 50)}..."`)
      }

      requestData = JSON.parse(requestText)
      console.log("[API] Successfully parsed JSON request")
    } catch (parseError) {
      await sendLogToAPI(`❌ ERRO DE PARSING JSON - ${parseError}`)
      console.error("[API] JSON parsing error:", parseError)
      return NextResponse.json(
        {
          error: "Invalid JSON in request body",
          details: parseError instanceof Error ? parseError.message : "Unknown parsing error",
        },
        { status: 400 },
      )
    }

    const { template_id, recipient_data, photo_url, certificate_number_to_update, recipient_cpf, recipient_dob } =
      requestData

    await sendLogToAPI(`🎯 NOVA SOLICITAÇÃO DE CERTIFICADO - Template: ${template_id}`)

    if (!template_id || !recipient_data || !recipient_cpf || !recipient_dob) {
      await sendLogToAPI(
        `❌ DADOS OBRIGATÓRIOS FALTANDO - template_id: ${!!template_id}, recipient_data: ${!!recipient_data}, cpf: ${!!recipient_cpf}, dob: ${!!recipient_dob}`,
      )
      return NextResponse.json(
        { error: "Dados do destinatário, CPF e Data de Nascimento são obrigatórios" },
        { status: 400 },
      )
    }

    const recipientEmail = recipient_data.default_email || recipient_data.email
    await sendLogToAPI(`📋 DADOS RECEBIDOS - Email: ${recipientEmail} | CPF: ${recipient_cpf?.substring(0, 3)}***`)

    if (certificate_number_to_update) {
      await sendLogToAPI(`🔄 ATUALIZANDO CERTIFICADO EXISTENTE - ${certificate_number_to_update}`)
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
      await sendLogToAPI(`📄 USANDO PDF EM CACHE - Template: ${template_id}`)
      console.log("[PDF Cache] Using cached PDF for template:", template_id)
    }

    const { data: template, error: templateError } = await supabase
      .from("certificate_templates")
      .select(`*`)
      .eq("id", template_id)
      .single()

    if (templateError || !template) {
      await sendLogToAPI(`❌ TEMPLATE NÃO ENCONTRADO - ID: ${template_id}`)
      return NextResponse.json({ error: "Template de certificado não encontrado" }, { status: 404 })
    }

    await sendLogToAPI(`✅ TEMPLATE CARREGADO - ${template.name || template_id}`)

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

    await sendLogToAPI(`🔢 NÚMERO DO CERTIFICADO - ${certificateNumber}`)

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
      await sendLogToAPI(`📄 GERANDO PDF - Certificado: ${certificateNumber}`)
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

    await sendLogToAPI(`☁️ FAZENDO UPLOAD DO PDF - ${pdfFileName}`)

    const { error: uploadError } = await supabase.storage
      .from("generated-certificates")
      .upload(pdfFilePath, pdfBytes, { contentType: "application/pdf", upsert: false }) // Use upsert: false for new files

    if (uploadError) {
      await sendLogToAPI(`❌ ERRO NO UPLOAD - ${uploadError.message}`)
      console.error("Erro no Upload do PDF:", uploadError)
      throw new Error(`Falha ao fazer upload do PDF: ${uploadError.message}`)
    }

    const { data: urlData } = supabase.storage.from("generated-certificates").getPublicUrl(pdfFilePath)
    const pdf_url = urlData.publicUrl

    await sendLogToAPI(`✅ PDF SALVO COM SUCESSO - URL: ${pdf_url}`)

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
        await sendLogToAPI(`❌ ERRO AO ATUALIZAR BD - ${dbError.message}`)
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
      await sendLogToAPI(`✅ CERTIFICADO ATUALIZADO - ID: ${updatedCertificate.id}`)
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
        await sendLogToAPI(`❌ ERRO AO SALVAR BD - ${dbError.message}`)
        console.error("Erro na Inserção no BD:", dbError)
        throw new Error("Falha ao salvar os dados do certificado.")
      }
      issuedCertificateData = newCertificate
      await sendLogToAPI(`✅ CERTIFICADO CRIADO - ID: ${newCertificate.id}`)
    }

    await sendLogToAPI(`📧 INICIANDO PROCESSO DE EMAIL - Certificado: ${certificateNumber}`)
    console.log(`[v0] 📧 Chamando função de envio de email...`)
    console.log(`[v0] Dados que serão passados para sendCertificateEmail:`)
    console.log(`[v0] - Template ID: ${template.id}`)
    console.log(`[v0] - Recipient data keys: ${Object.keys(recipient_data)}`)
    console.log(`[v0] - Certificate number: ${certificateNumber}`)
    console.log(`[v0] - PDF URL: ${pdf_url}`)

    await sendCertificateEmail(template, recipient_data, certificateNumber, pdf_url)
    await sendLogToAPI(`✅ PROCESSO COMPLETO - Certificado ${certificateNumber} gerado e email processado`)
    console.log(`[v0] ✅ Função de email executada`)

    return NextResponse.json(issuedCertificateData)
  } catch (error) {
    await sendLogToAPI(`❌ ERRO CRÍTICO NO PROCESSO - ${error}`)
    console.error("Erro ao emitir certificado:", error)
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

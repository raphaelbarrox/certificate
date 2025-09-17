import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateVisualCertificatePDF } from "@/lib/visual-certificate-generator"
import nodemailer from "nodemailer"
import { ImageCache } from "@/lib/image-cache"
import { QRCodeCache } from "@/lib/qrcode-cache"
import { SecurityUtils } from "@/lib/security-utils"
import { AuditLogger } from "@/lib/audit-logger"
import { z } from "zod"

const IssueRequestSchema = z.object({
  template_id: z.string().uuid("ID do template deve ser um UUID válido"),
  recipient_data: z
    .record(z.any())
    .refine((data) => Object.keys(data).length > 0, "Dados do destinatário são obrigatórios"),
  recipient_cpf: z.string().refine((cpf) => SecurityUtils.validateCPF(cpf), "CPF inválido"),
  recipient_dob: z.string().refine((dob) => SecurityUtils.validateDateOfBirth(dob), "Data de nascimento inválida"),
  certificate_number_to_update: z.string().optional(),
  photo_url: z.string().url().optional(),
})

async function imageUrlToDataUrl(url: string): Promise<string> {
  return ImageCache.getImageDataUrl(url)
}

async function sendCertificateEmail(template: any, recipientData: any, certificateNumber: string, pdfUrl: string) {
  const emailConfig = template.form_design?.emailConfig
  if (!emailConfig || !emailConfig.enabled) {
    console.log(`[Email] Envio desativado para o template ${template.id}.`)
    return
  }

  const { smtp, senderName, senderEmail, subject, body } = emailConfig
  const recipientEmail = recipientData.default_email || recipientData.email

  if (!recipientEmail) {
    console.error(`[Email] Nenhum email de destinatário encontrado para o certificado ${certificateNumber}.`)
    return
  }

  try {
    console.log(`[Email] Iniciando envio para ${recipientEmail} (Certificado: ${certificateNumber})`)

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })

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

    const mailOptions = {
      from: `"${senderName || senderEmail}" <${senderEmail}>`,
      to: recipientEmail,
      subject: finalSubject,
      html: finalBody,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log(`[Email] Mensagem enviada: ${info.messageId}`)
  } catch (error) {
    console.error(`[Email] Falha ao enviar email para ${recipientEmail} (Certificado: ${certificateNumber}):`, error)
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  let issuedCertificateData: any = null
  const clientIP = request.ip || request.headers.get("x-forwarded-for") || "unknown"
  const userAgent = request.headers.get("user-agent") || "unknown"
  let certificateNumber = ""

  try {
    const requestBody = await request.json()
    const validatedData = IssueRequestSchema.parse(requestBody)
    const { template_id, recipient_data, photo_url, certificate_number_to_update, recipient_cpf, recipient_dob } =
      validatedData

    const sanitizedRecipientData: Record<string, any> = {}
    for (const [key, value] of Object.entries(recipient_data)) {
      if (typeof value === "string") {
        sanitizedRecipientData[key] = SecurityUtils.sanitizeInput(value)
      } else {
        sanitizedRecipientData[key] = value
      }
    }

    if (sanitizedRecipientData.default_email && !SecurityUtils.validateEmail(sanitizedRecipientData.default_email)) {
      throw new Error("Email inválido")
    }

    const { data: template, error: templateError } = await supabase
      .from("certificate_templates")
      .select(`*`)
      .eq("id", template_id)
      .eq("is_active", true)
      .single()

    if (templateError || !template) {
      await AuditLogger.logCertificateGeneration(
        certificate_number_to_update || "unknown",
        template_id,
        recipient_cpf,
        clientIP,
        userAgent,
        "error",
        "Template não encontrado ou inativo",
      )
      return NextResponse.json({ error: "Template de certificado não encontrado ou inativo" }, { status: 404 })
    }

    const templateData = template.template_data || {}
    const processedRecipientData = { ...sanitizedRecipientData }

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

    certificateNumber = certificate_number_to_update || SecurityUtils.generateSecureCertificateNumber()

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

    const pdf = generateVisualCertificatePDF(templateForPdf, processedRecipientData, qrCodeDataUrl, certificateNumber)
    const pdfBytes = pdf.output("arraybuffer")

    const pdfFileName = `certificado-${certificateNumber}.pdf`
    const pdfFilePath = `public/${pdfFileName}`

    const { error: uploadError } = await supabase.storage
      .from("generated-certificates")
      .upload(pdfFilePath, pdfBytes, { contentType: "application/pdf", upsert: true })

    if (uploadError) {
      console.error("Erro no Upload do PDF:", uploadError)
      await AuditLogger.logCertificateGeneration(
        certificateNumber,
        template_id,
        recipient_cpf,
        clientIP,
        userAgent,
        "error",
        `Erro no upload: ${uploadError.message}`,
      )
      throw new Error(`Falha ao fazer upload do PDF: ${uploadError.message}`)
    }

    const { data: urlData } = supabase.storage.from("generated-certificates").getPublicUrl(pdfFilePath)
    const pdf_url = urlData.publicUrl

    const dataHash = SecurityUtils.createSecureHash({
      template_id,
      recipient_cpf,
      recipient_dob,
      certificate_number: certificateNumber,
      recipient_data: sanitizedRecipientData, // Incluindo todos os dados do formulário
      timestamp: new Date().toISOString(), // Garantindo unicidade temporal
    })

    if (certificate_number_to_update) {
      const { data: existingCert } = await supabase
        .from("issued_certificates")
        .select("id, certificate_number")
        .eq("certificate_number", certificate_number_to_update)
        .eq("recipient_cpf", recipient_cpf)
        .eq("recipient_dob", recipient_dob)
        .single()

      if (!existingCert) {
        throw new Error("Certificado não encontrado ou dados não conferem")
      }

      const { data: updatedCertificate, error: dbError } = await supabase
        .from("issued_certificates")
        .update({
          recipient_data: sanitizedRecipientData,
          recipient_email: sanitizedRecipientData.default_email || sanitizedRecipientData.email,
          photo_url: photo_url || null,
          pdf_url: pdf_url,
          issued_at: new Date().toISOString(),
          data_hash: dataHash,
        })
        .eq("certificate_number", certificate_number_to_update)
        .eq("recipient_cpf", recipient_cpf)
        .eq("recipient_dob", recipient_dob)
        .select()
        .single()

      if (dbError) {
        console.error("Erro ao atualizar no BD:", dbError)
        await AuditLogger.logCertificateGeneration(
          certificateNumber,
          template_id,
          recipient_cpf,
          clientIP,
          userAgent,
          "error",
          `Erro na atualização: ${dbError.message}`,
        )
        throw new Error("Falha ao atualizar os dados do certificado.")
      }
      issuedCertificateData = updatedCertificate
    } else {
      const currentDataHash = SecurityUtils.createSecureHash({
        template_id,
        recipient_cpf,
        recipient_dob,
        recipient_data: sanitizedRecipientData,
      })

      const { data: existingCert } = await supabase
        .from("issued_certificates")
        .select("certificate_number, data_hash, recipient_data")
        .eq("template_id", template_id)
        .eq("recipient_cpf", recipient_cpf)
        .eq("recipient_dob", recipient_dob)

      let matchingCert = null
      if (existingCert && existingCert.length > 0) {
        for (const cert of existingCert) {
          const existingDataHash = SecurityUtils.createSecureHash({
            template_id,
            recipient_cpf,
            recipient_dob,
            recipient_data: cert.recipient_data,
          })

          if (existingDataHash === currentDataHash) {
            matchingCert = cert
            break
          }
        }
      }

      if (matchingCert) {
        const { data: existingCertData } = await supabase
          .from("issued_certificates")
          .select("*")
          .eq("certificate_number", matchingCert.certificate_number)
          .single()

        await AuditLogger.logCertificateGeneration(
          matchingCert.certificate_number,
          template_id,
          recipient_cpf,
          clientIP,
          userAgent,
          "success",
          "Certificado existente retornado - dados idênticos",
        )

        return NextResponse.json(existingCertData)
      }

      const { data: newCertificate, error: dbError } = await supabase
        .from("issued_certificates")
        .insert({
          template_id: template_id,
          recipient_data: sanitizedRecipientData,
          recipient_email: sanitizedRecipientData.default_email || sanitizedRecipientData.email,
          certificate_number: certificateNumber,
          photo_url: photo_url || null,
          pdf_url: pdf_url,
          recipient_cpf,
          recipient_dob,
          data_hash: dataHash,
        })
        .select()
        .single()

      if (dbError) {
        console.error("Erro na Inserção no BD:", dbError)
        await AuditLogger.logCertificateGeneration(
          certificateNumber,
          template_id,
          recipient_cpf,
          clientIP,
          userAgent,
          "error",
          `Erro na inserção: ${dbError.message}`,
        )
        throw new Error("Falha ao salvar os dados do certificado.")
      }
      issuedCertificateData = newCertificate
    }

    await AuditLogger.logCertificateGeneration(
      certificateNumber,
      template_id,
      recipient_cpf,
      clientIP,
      userAgent,
      "success",
    )

    sendCertificateEmail(template, sanitizedRecipientData, certificateNumber, pdf_url)

    return NextResponse.json(issuedCertificateData)
  } catch (error) {
    console.error("Erro ao emitir certificado:", error)

    if (certificateNumber) {
      await AuditLogger.logCertificateGeneration(
        certificateNumber,
        request.body?.template_id || "unknown",
        request.body?.recipient_cpf || "unknown",
        clientIP,
        userAgent,
        "error",
        error instanceof Error ? error.message : "Erro desconhecido",
      )
    }

    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

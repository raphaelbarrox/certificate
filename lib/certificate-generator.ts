// ============================================
// 1. lib/certificate-generator.ts (SEU CÓDIGO ORIGINAL - INALTERADO)
// ============================================
import { jsPDF } from "jspdf"
import type { File } from "formdata-node"
import "jspdf-autotable"
import type { CertificateTemplate, CertificateData } from "@/lib/types"

// Helper to map font weight/style to jsPDF font types
const getFontType = (fontWeight = "normal", fontStyle = "normal"): string => {
  if (fontWeight === "bold" && fontStyle === "italic") return "bolditalic"
  if (fontWeight === "bold") return "bold"
  if (fontStyle === "italic") return "italic"
  return "normal"
}

export const generateCertificatePDF = (template: CertificateTemplate, recipientData: Record<string, any>): jsPDF => {
  const { template_data } = template
  // FIX: Correctly read canvas dimensions from the nested canvasSize object or fallbacks.
  const canvasWidth = template_data.canvasSize?.width || template_data.canvasWidth || 1200
  const canvasHeight = template_data.canvasSize?.height || template_data.canvasHeight || 850
  const { elements, backgroundImage } = template_data
  const FONT_SCALE_FACTOR = 4 / 3 // Correction factor to match canvas px to jsPDF pt

  const pdf = new jsPDF({
    orientation: canvasWidth > canvasHeight ? "landscape" : "portrait",
    unit: "px",
    format: [canvasWidth, canvasHeight],
  })

  // Add background image
  if (backgroundImage) {
    pdf.addImage(backgroundImage, "PNG", 0, 0, canvasWidth, canvasHeight)
  }

  // Render each element
  elements.forEach((element: any) => {
    if (element.type === "image") {
      return // Handled separately in generateCertificate
    }

    let textToRender = element.text || ""

    // Replace placeholders from recipient data, e.g., {{student_name}}
    Object.keys(recipientData).forEach((key) => {
      // Use a regex to find and replace all instances of {{key}}
      const placeholderRegex = new RegExp(`{{${key}}}`, "g")
      textToRender = textToRender.replace(placeholderRegex, recipientData[key] || "")
    })

    // Replace special, system-generated placeholders
    textToRender = textToRender
      .replace(/{{issue_date}}/g, new Date().toLocaleDateString())
      .replace(/{{certificate_id}}/g, template.id)

    // Destructure element properties
    const { font, fontSize, color, x, y, width, height, textAlign, fontWeight, fontStyle } = element

    // Apply the scaling factor to the font size
    const scaledFontSize = fontSize * FONT_SCALE_FACTOR

    // Set font properties in the PDF
    pdf.setFont(font, getFontType(fontWeight, fontStyle))
    pdf.setFontSize(scaledFontSize)
    pdf.setTextColor(color)

    // Calculate text wrapping and dimensions
    const lines = pdf.splitTextToSize(textToRender, width)
    const lineHeight = pdf.getLineHeight() / pdf.internal.scaleFactor
    const textHeight = lines.length * lineHeight

    // Vertically center the text block within its bounding box (height)
    const textBlockTopY = y + (height - textHeight) / 2

    // Render each line of text
    lines.forEach((line: string, index: number) => {
      const lineTopY = textBlockTopY + index * lineHeight
      let startX = x
      if (textAlign === "center") {
        startX = x + width / 2
      } else if (textAlign === "right") {
        startX = x + width
      }

      // Use 'top' baseline for consistent rendering between canvas and PDF
      pdf.text(line, startX, lineTopY, {
        align: textAlign,
        maxWidth: width,
        baseline: "top",
      })
    })
  })

  return pdf
}

export async function generateCertificate(
  template: CertificateTemplate,
  data: CertificateData,
  photoUrl?: string,
): Promise<Uint8Array> {
  const pdf = generateCertificatePDF(template, data)

  // Add photo if provided
  if (photoUrl) {
    try {
      const response = await fetch(photoUrl)
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)

      const arrayBuffer = await response.arrayBuffer()
      const imageBuffer = Buffer.from(arrayBuffer)

      const contentType = response.headers.get("content-type") || "image/jpeg"
      const imageFormat = contentType.split("/")[1].toUpperCase()

      // Find image placeholder position from template elements
      const imageElement = template.template_data.elements?.find((el: any) => el.type === "image")
      if (imageElement) {
        const { x, y, width, height } = imageElement
        pdf.addImage(imageBuffer, imageFormat, x, y, width, height)
      } else {
        console.warn("Image placeholder not found in template, skipping photo.")
      }
    } catch (error) {
      console.error("Error adding photo to certificate:", error)
    }
  }

  return pdf.output("arraybuffer") as Uint8Array
}

export function generatePublicLinkId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Helper function to convert file to data URL (if needed elsewhere)
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ============================================
// 2. lib/email-service.ts (SEU TESTE QUE FUNCIONA)
// ============================================
import { Resend } from 'resend'

export class EmailService {
  private static resend = new Resend(process.env.RESEND_API_KEY)

  static validateEmailDomain(email: string): boolean {
    return email.endsWith('@therapist.international')
  }

  static formatSenderEmail(name: string, email: string): string {
    return `${name} <${email}>`
  }

  static async sendEmail(params: {
    from: string
    to: string | string[]
    subject: string
    html: string
  }) {
    try {
      const data = await this.resend.emails.send({
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html
      })
      
      return { 
        success: true, 
        messageId: data.id 
      }
    } catch (error: any) {
      console.error('[EmailService Error]', error)
      return { 
        success: false, 
        error: error.message || 'Erro ao enviar email' 
      }
    }
  }
}

// ============================================
// 3. app/api/certificates/send-with-email/route.ts
// VERSÃO HARDCODED COM AS TAGS ESPECIFICADAS
// ============================================
import { type NextRequest, NextResponse } from "next/server"
import { generateCertificate, generatePublicLinkId } from "@/lib/certificate-generator"
import { EmailService } from "@/lib/email-service"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const { 
      template,
      recipientData, // Deve conter: nome_do_aluno, default_email, default_whatsapp, etc
      senderEmail,
      senderName
    } = await request.json()

    // Validações
    if (!template || !recipientData || !senderEmail) {
      return NextResponse.json(
        { error: "Template, dados do destinatário e email do remetente são obrigatórios" },
        { status: 400 }
      )
    }

    // Validar domínio
    if (!EmailService.validateEmailDomain(senderEmail)) {
      return NextResponse.json(
        { error: "Email deve ser do domínio therapist.international" },
        { status: 400 },
      )
    }

    // O email do destinatário vem de {{default_email}}
    const recipientEmail = recipientData.default_email || recipientData.email
    if (!recipientEmail) {
      return NextResponse.json(
        { error: "Email do destinatário não encontrado (default_email)" },
        { status: 400 }
      )
    }

    try {
      // Gerar o certificado PDF
      const pdfUint8Array = await generateCertificate(
        template,
        recipientData,
        recipientData.photoUrl
      )
      
      // Converter para Buffer
      const pdfBuffer = Buffer.from(pdfUint8Array)
      console.log('[Certificate] PDF gerado:', pdfBuffer.length, 'bytes')
      
      // Gerar ID único
      const certificateId = generatePublicLinkId()
      
      // Gerar link do certificado
      const certificateLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://seusite.com'}/certificates/${certificateId}`
      
      // Template hardcoded do email com as tags especificadas
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎓 Certificado Disponível!</h1>
            </div>
            
            <!-- Body -->
            <div style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Olá <strong>${recipientData.nome_do_aluno || recipientData.student_name || 'Participante'}</strong>,
              </p>
              
              <p style="color: #666666; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
                Parabéns! Seu certificado foi gerado com sucesso e está pronto para download.
              </p>
              
              <!-- Info Box -->
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 5px;">
                <h3 style="color: #333333; margin: 0 0 10px 0; font-size: 16px;">Informações do Certificado:</h3>
                
                <p style="color: #666666; margin: 8px 0; font-size: 14px;">
                  <strong>ID do Certificado:</strong> ${certificateId}
                </p>
                
                <p style="color: #666666; margin: 8px 0; font-size: 14px;">
                  <strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}
                </p>
                
                <p style="color: #666666; margin: 8px 0; font-size: 14px;">
                  <strong>Link:</strong> <a href="${certificateLink}" style="color: #667eea;">${certificateLink}</a>
                </p>
                
                ${recipientData.default_whatsapp ? `
                  <p style="color: #666666; margin: 8px 0; font-size: 14px;">
                    <strong>WhatsApp:</strong> ${recipientData.default_whatsapp}
                  </p>
                ` : ''}
              </div>
              
              <!-- Download Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="${certificateLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 30px; 
                          font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                  📥 Baixar Certificado
                </a>
              </div>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eeeeee;">
              
              <p style="color: #999999; font-size: 13px; line-height: 1.5;">
                <strong>Importante:</strong> Este link é único e exclusivo para seu certificado. 
                Guarde-o em local seguro para futuras consultas.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee; border-radius: 0 0 10px 10px;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                Enviado por ${senderName || 'Sistema de Certificados'}<br>
                ${senderEmail}
              </p>
            </div>
          </div>
        </body>
        </html>
      `
      
      // Enviar email (sem anexo)
      const emailResult = await EmailService.sendEmail({
        from: EmailService.formatSenderEmail(senderName || "Sistema de Certificados", senderEmail),
        to: recipientEmail, // Usando {{default_email}}
        subject: `🎓 Certificado - ${recipientData.nome_do_aluno || recipientData.student_name || 'Participante'}`,
        html: emailHtml
      })

      if (!emailResult.success) {
        throw new Error(emailResult.error || 'Erro ao enviar email')
      }

      console.log('[Email] Enviado com sucesso para:', recipientEmail)

      // Retornar resposta com todas as informações
      return NextResponse.json({
        success: true,
        message: "Certificado gerado e email enviado com sucesso!",
        data: {
          certificateId: certificateId,
          certificateLink: certificateLink,
          recipientEmail: recipientEmail,
          recipientName: recipientData.nome_do_aluno,
          messageId: emailResult.messageId
        }
      })
      
    } catch (error: any) {
      console.error('[Process Error]', error)
      throw error
    }

  } catch (error: any) {
    console.error("[API Error]", error)
    return NextResponse.json(
      {
        error: `Erro ao processar: ${error.message}`,
      },
      { status: 500 },
    )
  }
}

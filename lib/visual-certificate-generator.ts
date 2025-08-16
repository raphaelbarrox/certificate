import { jsPDF } from "jspdf"
import "jspdf-autotable"

interface TemplateForPDF {
  elements: any[]
  backgroundImage?: string | null
  backgroundColor: string
  canvasWidth: number
  canvasHeight: number
  placeholders: any[]
}

// Helper to map font weight/style to jsPDF font types
const getFontType = (fontWeight = "normal", fontStyle = "normal"): string => {
  if (fontWeight === "bold" && fontStyle === "italic") return "bolditalic"
  if (fontWeight === "bold") return "bold"
  if (fontStyle === "italic") return "italic"
  return "normal"
}

export const generateVisualCertificatePDF = (
  template: TemplateForPDF,
  recipientData: Record<string, any>,
  qrCodeDataUrl: string,
  certificateNumber: string,
): jsPDF => {
  const { canvasWidth, canvasHeight, elements, backgroundImage, backgroundColor } = template
  const FONT_SCALE_FACTOR = 4 / 3 // Correction factor to match canvas px to jsPDF pt.

  const pdf = new jsPDF({
    orientation: canvasWidth > canvasHeight ? "landscape" : "portrait",
    unit: "px",
    format: [canvasWidth, canvasHeight],
  })

  // Add background color first
  pdf.setFillColor(backgroundColor)
  pdf.rect(0, 0, canvasWidth, canvasHeight, "F")

  // Add background image
  if (backgroundImage) {
    try {
      pdf.addImage(backgroundImage, "PNG", 0, 0, canvasWidth, canvasHeight)
    } catch (e) {
      console.error("Error adding background image to PDF:", e)
    }
  }

  // Render each element
  elements.forEach((element: any) => {
    if (element.type === "qrcode") {
      if (qrCodeDataUrl) {
        try {
          pdf.addImage(qrCodeDataUrl, "PNG", element.x, element.y, element.width, element.height)
        } catch (e) {
          console.error("Error adding QR code to PDF:", e)
        }
      }
      return
    }

    if (element.type === "image" && element.imageUrl) {
      try {
        pdf.addImage(element.imageUrl, "PNG", element.x, element.y, element.width, element.height)
      } catch (e) {
        console.error("Error adding static image to PDF:", e)
      }
      return
    }

    if (element.type === "image-placeholder" && element.placeholderId) {
      const imageUrl = recipientData[element.placeholderId]
      if (imageUrl && typeof imageUrl === "string") {
        try {
          pdf.addImage(imageUrl, "PNG", element.x, element.y, element.width, element.height)
        } catch (e) {
          console.error(`Error adding placeholder image ${element.placeholderId} to PDF:`, e)
        }
      }
      return
    }

    let textToRender = element.content || ""

    // Replace custom placeholders from form data
    Object.keys(recipientData).forEach((key) => {
      const placeholder = `{{${key}}}`
      if (textToRender.includes(placeholder)) {
        textToRender = textToRender.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), recipientData[key] || "")
      }
    })

    // Replace special hardcoded placeholders
    textToRender = textToRender
      .replace(/\{\{issue_date\}\}/g, new Date().toLocaleDateString("pt-BR"))
      .replace(/\{\{certificate_id\}\}/g, certificateNumber)
      .replace(/\{\{default_email\}\}/g, recipientData.default_email || recipientData.email || "")

    // Destructure element properties
    const { fontFamily, fontSize, color, x, y, width, height, textAlign, fontWeight, fontStyle } = element

    // Apply the scaling factor to the font size
    const scaledFontSize = fontSize * FONT_SCALE_FACTOR

    // Set font properties in the PDF
    pdf.setFont(fontFamily, getFontType(fontWeight, fontStyle))
    pdf.setFontSize(scaledFontSize)
    pdf.setTextColor(color)

    // Calculate text wrapping and dimensions
    const lines = pdf.splitTextToSize(textToRender, width)
    const lineHeight = pdf.getLineHeight() / pdf.internal.scaleFactor
    const textHeight = lines.length * lineHeight

    // Position the text block at the top of its bounding box, removing the previous vertical centering.
    const textBlockTopY = y

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

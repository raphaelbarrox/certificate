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

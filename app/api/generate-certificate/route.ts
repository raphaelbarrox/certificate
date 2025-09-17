import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { generateCertificate } from "@/lib/certificate-generator"
import { RateLimiter } from "@/lib/security-validator"
import { z } from "zod"

const generateCertificateSchema = z.object({
  templateId: z.string().uuid("Template ID deve ser um UUID válido"),
  recipientData: z.object({
    name: z.string().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
    email: z.string().email("Email inválido").optional(),
    default_email: z.string().email("Email inválido").optional(),
  }),
  image: z.any().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const clientIP = request.ip || request.headers.get("x-forwarded-for") || "unknown"
    if (!RateLimiter.isAllowed(`generate_${clientIP}`, 10, 300000)) {
      // 10 certificados por 5 minutos
      return NextResponse.json(
        { error: "Muitas gerações de certificado. Tente novamente em 5 minutos." },
        { status: 429 },
      )
    }

    const formData = await request.formData()
    const templateId = formData.get("templateId") as string
    const recipientDataStr = formData.get("recipientData") as string
    const imageFile = formData.get("image") as File | null

    if (!templateId || !recipientDataStr) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    let recipientData
    try {
      recipientData = JSON.parse(recipientDataStr)
    } catch (parseError) {
      console.log(`[SECURITY] Invalid JSON in recipient data - IP: ${clientIP}`)
      return NextResponse.json({ error: "Dados do destinatário inválidos" }, { status: 400 })
    }

    const validationResult = generateCertificateSchema.safeParse({
      templateId,
      recipientData,
      image: imageFile,
    })

    if (!validationResult.success) {
      console.log(`[SECURITY] Invalid certificate generation data - IP: ${clientIP}`)
      return NextResponse.json({ error: "Dados inválidos fornecidos" }, { status: 400 })
    }

    console.log(`[AUDIT] Certificate generation - IP: ${clientIP} - Template: ${templateId}`)

    if (imageFile) {
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
      const maxSize = 5 * 1024 * 1024 // 5MB

      if (!allowedTypes.includes(imageFile.type)) {
        return NextResponse.json({ error: "Tipo de arquivo não permitido. Use JPEG, PNG ou WebP." }, { status: 400 })
      }

      if (imageFile.size > maxSize) {
        return NextResponse.json({ error: "Arquivo muito grande. Máximo 5MB." }, { status: 400 })
      }
    }

    // Get template
    const { data: template, error: templateError } = await supabase
      .from("certificate_templates")
      .select("*")
      .eq("id", templateId)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    let photoUrl: string | undefined

    // Upload image if provided
    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop()
      const fileName = `${Date.now()}-photo.${fileExt}`
      const filePath = `certificates/${fileName}`

      const { error: uploadError } = await supabase.storage.from("certificate-images").upload(filePath, imageFile)

      if (uploadError) {
        console.error("Upload error:", uploadError)
        return NextResponse.json({ error: "Failed to upload image" }, { status: 500 })
      }

      const { data } = supabase.storage.from("certificate-images").getPublicUrl(filePath)
      photoUrl = data.publicUrl
    }

    // Generate certificate number
    const certificateNumber = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Save to database
    const { data: certificate, error: dbError } = await supabase
      .from("issued_certificates")
      .insert({
        template_id: templateId,
        recipient_data: recipientData,
        recipient_email: recipientData.email || recipientData.default_email,
        certificate_number: certificateNumber,
        photo_url: photoUrl || null,
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database error:", dbError)
      return NextResponse.json({ error: "Failed to save certificate" }, { status: 500 })
    }

    // Generate PDF
    const pdfBytes = await generateCertificate(template, recipientData, photoUrl)

    // Return download URL
    return NextResponse.json({
      success: true,
      certificateId: certificate.id,
      certificateNumber,
      downloadUrl: `/api/certificates/${certificate.id}/download`,
    })
  } catch (error) {
    console.error("Error generating certificate:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

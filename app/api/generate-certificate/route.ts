import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { generateCertificate } from "@/lib/certificate-generator"
import { checkRateLimit } from "@/lib/auth-utils"

export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit(request, 5, 60000)) {
      // 5 certificados por minuto por IP
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em alguns minutos." }, { status: 429 })
    }

    const formData = await request.formData()
    const templateId = formData.get("templateId") as string
    const recipientDataStr = formData.get("recipientData") as string
    const imageFile = formData.get("image") as File | null

    if (!templateId || !recipientDataStr) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const recipientData = JSON.parse(recipientDataStr)

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
      const allowedTypes = ["image/jpeg", "image/png", "image/jpg"]
      if (!allowedTypes.includes(imageFile.type)) {
        return NextResponse.json({ error: "Tipo de arquivo não permitido. Use JPEG ou PNG." }, { status: 400 })
      }

      if (imageFile.size > 5 * 1024 * 1024) {
        // 5MB
        return NextResponse.json({ error: "Arquivo muito grande. Máximo 5MB." }, { status: 400 })
      }

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

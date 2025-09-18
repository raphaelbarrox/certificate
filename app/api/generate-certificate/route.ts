import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { generateCertificate } from "@/lib/certificate-generator"
import { getRealIP, checkRateLimit, createRateLimitResponse, addRateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  const clientIP = getRealIP(request)
  const rateLimitKey = `${clientIP}:/api/generate-certificate`
  const rateLimitConfig = RATE_LIMITS["/api/generate-certificate"]

  const { allowed, remaining, resetTime } = checkRateLimit(rateLimitKey, rateLimitConfig)

  if (!allowed) {
    console.log(`[Rate Limit] Blocked request from ${clientIP} - limit exceeded`)
    return createRateLimitResponse(resetTime)
  }

  console.log(`[Rate Limit] Request allowed from ${clientIP} - ${remaining} remaining`)

  try {
    const formData = await request.formData()
    const templateId = formData.get("templateId") as string
    const recipientDataStr = formData.get("recipientData") as string
    const imageFile = formData.get("image") as File | null

    if (!templateId || !recipientDataStr) {
      const errorResponse = NextResponse.json({ error: "Missing required fields" }, { status: 400 })
      return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
    }

    const recipientData = JSON.parse(recipientDataStr)

    // Get template
    const { data: template, error: templateError } = await supabase
      .from("certificate_templates")
      .select("*")
      .eq("id", templateId)
      .single()

    if (templateError || !template) {
      const errorResponse = NextResponse.json({ error: "Template not found" }, { status: 404 })
      return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
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
        const errorResponse = NextResponse.json({ error: "Failed to upload image" }, { status: 500 })
        return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
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
      const errorResponse = NextResponse.json({ error: "Failed to save certificate" }, { status: 500 })
      return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
    }

    // Generate PDF
    const pdfBytes = await generateCertificate(template, recipientData, photoUrl)

    // Return download URL
    const response = NextResponse.json({
      success: true,
      certificateId: certificate.id,
      certificateNumber,
      downloadUrl: `/api/certificates/${certificate.id}/download`,
    })

    return addRateLimitHeaders(response, remaining - 1, resetTime)
  } catch (error) {
    console.error("Error generating certificate:", error)
    const errorResponse = NextResponse.json({ error: "Internal server error" }, { status: 500 })
    return addRateLimitHeaders(errorResponse, remaining - 1, resetTime)
  }
}

import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { generateVisualCertificatePDF } from "@/lib/visual-certificate-generator"

// Helper function to fetch an image and convert it to a base64 data URL (SERVER-SIDE)
async function imageUrlToDataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }
    const contentType = response.headers.get("content-type") || "image/jpeg"
    const buffer = Buffer.from(await response.arrayBuffer())
    return `data:${contentType};base64,${buffer.toString("base64")}`
  } catch (error) {
    console.error(`Could not convert image URL to data URL: ${url}`, error)
    return "" // Return empty string on failure
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { data: template, error } = await supabase
      .from("certificate_templates")
      .select("template_data, placeholders")
      .eq("id", params.id)
      .single()

    if (error || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    const templateData = template.template_data || {}
    const placeholders = template.placeholders || []

    // Generate dummy data for preview
    const recipientData: Record<string, string> = {}
    placeholders.forEach((p: any) => {
      recipientData[p.id] = `[${p.label}]`
    })

    // Process background image
    let finalBackgroundImage = templateData.background_image || templateData.backgroundImage
    if (finalBackgroundImage && finalBackgroundImage.startsWith("http")) {
      finalBackgroundImage = await imageUrlToDataUrl(finalBackgroundImage)
    }

    const templateForPdf = {
      ...templateData,
      backgroundImage: finalBackgroundImage,
    }

    const pdf = generateVisualCertificatePDF(templateForPdf, recipientData, { getThumbnail: true })
    const imageBytes = pdf.output("arraybuffer")

    return new NextResponse(imageBytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, must-revalidate", // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error("Error generating thumbnail:", error)
    return NextResponse.json({ error: "Failed to generate thumbnail" }, { status: 500 })
  }
}

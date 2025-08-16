"use server"

import { supabase } from "@/lib/supabase"
import { revalidatePath } from "next/cache"
import { generateCertificatePDF } from "@/lib/certificate-generator"

export interface CertificateTemplate {
  id: string
  form_design: any
  // Add other template properties if needed
}

export async function generateAndSaveCertificate(
  prevState: any,
  formData: FormData,
): Promise<{ success: boolean; error?: string; certificateId?: string } | null> {
  const templateId = formData.get("templateId") as string

  if (!templateId) {
    return { success: false, error: "ID do template não encontrado." }
  }

  // 1. Fetch Template
  const { data: template, error: templateError } = await supabase
    .from("certificate_templates")
    .select("id, title, form_design, placeholders, template_data, public_link_id")
    .eq("id", templateId)
    .single()

  if (templateError || !template) {
    console.error("Template fetch error:", templateError)
    return { success: false, error: "Template de certificado inválido ou não encontrado." }
  }

  const formFields = template.form_design?.fields || []
  const recipientData: Record<string, any> = {}

  try {
    // 2. Process form data and upload images
    for (const field of formFields) {
      const value = formData.get(field.id)

      if (field.type === "image") {
        if (value instanceof File && value.size > 0) {
          // Upload to Supabase Storage
          const filePath = `public/${templateId}/${Date.now()}-${value.name}`
          const { error: uploadError } = await supabase.storage.from("certificate-images").upload(filePath, value)

          if (uploadError) {
            console.error("Supabase image upload error:", uploadError)
            if (uploadError.message.includes("Bucket not found")) {
              throw new Error(
                "Erro: O bucket de armazenamento 'certificate-images' não foi encontrado. Por favor, crie este bucket no seu painel Supabase.",
              )
            }
            throw new Error(`Erro ao enviar a imagem do campo "${field.label}". Detalhes: ${uploadError.message}`)
          }

          // Get public URL
          const { data: urlData } = supabase.storage.from("certificate-images").getPublicUrl(filePath)
          recipientData[field.placeholderId] = urlData.publicUrl
        } else if (field.required) {
          throw new Error(`O campo de imagem "${field.label}" é obrigatório.`)
        }
      } else {
        if (field.placeholderId) {
          recipientData[field.placeholderId] = value
        }
      }
    }

    // 3. Generate unique certificate number
    const certificate_number = `CERT-${Date.now()}`

    // 4. Save to issued_certificates table
    const { data: issuedCert, error: insertError } = await supabase
      .from("issued_certificates")
      .insert({
        template_id: template.id,
        recipient_data: recipientData,
        certificate_number: certificate_number,
        issued_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (insertError) {
      console.error("Supabase insert error:", insertError)
      throw new Error("Não foi possível salvar os dados do certificado.")
    }

    // 5. Generate, upload, and save PDF URL
    try {
      const pdf = generateCertificatePDF(template, recipientData)
      const pdfBytes = pdf.output("arraybuffer")
      const pdfPath = `public/${issuedCert.id}.pdf`

      const { error: uploadPdfError } = await supabase.storage
        .from("generated-certificates")
        .upload(pdfPath, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        })

      if (uploadPdfError) {
        console.error("PDF Upload Error:", uploadPdfError)
        if (uploadPdfError.message.includes("Bucket not found")) {
          throw new Error(
            "Bucket 'generated-certificates' não encontrado. Por favor, crie um bucket PÚBLICO com este nome no seu painel Supabase Storage para salvar os PDFs.",
          )
        }
        throw new Error(`Não foi possível salvar o PDF do certificado. Detalhes: ${uploadPdfError.message}`)
      }

      const { data: urlData } = supabase.storage.from("generated-certificates").getPublicUrl(pdfPath)
      const pdfUrl = urlData.publicUrl

      const { error: updateError } = await supabase
        .from("issued_certificates")
        .update({ pdf_url: pdfUrl })
        .eq("id", issuedCert.id)

      if (updateError) {
        console.error("PDF URL Update Error:", updateError)
        throw new Error("Não foi possível salvar o link do PDF do certificado no banco de dados.")
      }
    } catch (pdfError: any) {
      // Re-throw to be caught by the outer catch block
      throw pdfError
    }

    revalidatePath(`/issue/${templateId}`)
    return { success: true, certificateId: issuedCert.id }
  } catch (error: any) {
    return { success: false, error: error.message || "Ocorreu um erro inesperado." }
  }
}

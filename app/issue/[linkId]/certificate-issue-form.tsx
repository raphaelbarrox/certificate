"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, X, ImageIcon } from "lucide-react"
import { supabase } from "@/lib/supabase"
import useLocalStorage from "@/hooks/use-local-storage"
import { getMaskedValue, unmask } from "@/lib/masks"
import { ImageOptimizer } from "@/lib/image-optimizer"

interface FormField {
  id: string
  type: "text" | "email" | "tel" | "date" | "number" | "textarea" | "select" | "checkbox" | "image"
  label: string
  description?: string
  required: boolean
  options?: string[]
  placeholderId?: string
  isDefault?: boolean
}

interface IssuedCertificate {
  id: string
  certificate_number: string
  pdf_url: string
  recipient_data: Record<string, any>
}

interface CertificateIssueFormProps {
  template: {
    id: string
    title: string
    description: string | null
    form_design: {
      fields: FormField[]
      design: any
    } | null
  }
  onSuccess: (certificate: IssuedCertificate) => void
  prefilledCpf: string
  prefilledDob: string
  onCancelEdit: () => void
  certificateToUpdate: IssuedCertificate | null
}

export function CertificateIssueForm({
  template,
  onSuccess,
  prefilledCpf,
  prefilledDob,
  certificateToUpdate,
  onCancelEdit,
}: CertificateIssueFormProps) {
  const [formData, setFormData] = useLocalStorage<Record<string, any>>(`formData-${template.id}`, {})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({})
  const [uploadPreviews, setUploadPreviews] = useLocalStorage<Record<string, string>>(`formPreviews-${template.id}`, {})

  const defaultFields: FormField[] = [
    {
      id: "default_email",
      type: "email",
      label: "Seu melhor e-mail",
      description: "Usaremos este e-mail para enviar o certificado e para contato.",
      required: true,
      isDefault: true,
    },
    {
      id: "default_whatsapp",
      type: "tel",
      label: "WhatsApp (com DDD)",
      description: "Para comunicações importantes sobre seu certificado.",
      required: true,
      isDefault: true,
    },
  ]

  const fields =
    template.form_design?.fields && template.form_design.fields.length > 0 ? template.form_design.fields : defaultFields

  useEffect(() => {
    if (certificateToUpdate && certificateToUpdate.recipient_data) {
      const recipientData = certificateToUpdate.recipient_data
      const mappedData: Record<string, any> = {}
      const newPreviews: Record<string, string> = {}

      fields.forEach((field) => {
        const value = field.placeholderId ? recipientData[field.placeholderId] : recipientData[field.id]
        if (value !== undefined) {
          mappedData[field.id] = value
          if (field.type === "image" && typeof value === "string") {
            newPreviews[field.id] = value
          }
        }
      })

      setFormData(mappedData)
      setUploadPreviews(newPreviews)
    }
  }, [certificateToUpdate, fields, setFormData, setUploadPreviews])

  const design = template.form_design?.design || {
    primaryColor: "#3b82f6",
    backgroundColor: "#ffffff",
    textColor: "#1f2937",
    borderRadius: 8,
    title: "Solicitar Certificado",
    description: "Preencha os dados abaixo para receber seu certificado digital.",
    submitButtonText: "Gerar Certificado",
    footerEnabled: true,
    footerText: "Powered by CertGen • Certificados digitais profissionais",
  }

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }))
  }

  const handleMaskedInputChange = (fieldId: string, value: string) => {
    handleInputChange(fieldId, unmask(value))
  }

  const handleFileChange = async (fieldId: string, file: File | null) => {
    setError(null)
    if (!file) {
      setUploadedFiles((prev) => {
        const newFiles = { ...prev }
        delete newFiles[fieldId]
        return newFiles
      })
      setUploadPreviews((prev) => {
        const newPreviews = { ...prev }
        delete newPreviews[fieldId]
        return newPreviews
      })
      handleInputChange(fieldId, null)
      return
    }

    const field = fields.find((f) => f.id === fieldId)
    if (field?.type === "image") {
      const validation = ImageOptimizer.validateImageFile(file)
      if (!validation.valid) {
        setError(validation.error || "Arquivo inválido")
        return
      }

      try {
        const compressedFile = await ImageOptimizer.compressImage(file, {
          maxWidth: 1200,
          maxHeight: 800,
          quality: 0.85,
          format: "jpeg",
        })

        const reader = new FileReader()
        reader.onload = (e) => setUploadPreviews((prev) => ({ ...prev, [fieldId]: e.target?.result as string }))
        reader.readAsDataURL(compressedFile)

        setUploadedFiles((prev) => ({ ...prev, [fieldId]: compressedFile }))
        handleInputChange(fieldId, compressedFile.name)
      } catch (compressionError) {
        setError("Erro ao processar imagem. Tente novamente.")
        return
      }
    }
  }

  const uploadFile = async (file: File, fieldId: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${Date.now()}-${fieldId}.${fileExt}`
      const filePath = `certificates/${fileName}`

      const { error: uploadError } = await supabase.storage.from("certificate-images").upload(filePath, file)
      if (uploadError) {
        console.error("Upload error:", uploadError)
        return null
      }
      const { data } = supabase.storage.from("certificate-images").getPublicUrl(filePath)
      return data.publicUrl
    } catch (error) {
      console.error("Error uploading file:", error)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      for (const field of fields) {
        if (field.required && !formData[field.id]) {
          throw new Error(`O campo "${field.label}" é obrigatório.`)
        }
      }

      const finalFormData = { ...formData }

      const uploadPromises = Object.entries(uploadedFiles).map(async ([fieldId, file]) => {
        const url = await uploadFile(file, fieldId)
        return { fieldId, url }
      })

      const uploadResults = await Promise.allSettled(uploadPromises)

      for (const result of uploadResults) {
        if (result.status === "fulfilled") {
          const { fieldId, url } = result.value
          if (url) {
            finalFormData[fieldId] = url
          } else {
            const fieldLabel = fields.find((f) => f.id === fieldId)?.label || fieldId
            throw new Error(`Falha ao enviar o arquivo para o campo "${fieldLabel}". Tente novamente.`)
          }
        } else {
          throw new Error(`Erro no upload: ${result.reason}`)
        }
      }

      // CORREÇÃO PRINCIPAL: Garantir que o email seja salvo com múltiplas chaves
      const recipientDataForDb: Record<string, any> = {}

      for (const field of fields) {
        const value = finalFormData[field.id]
        if (value) {
          // CORREÇÃO: Salvar o valor com AMBAS as chaves se for email
          if (field.id === 'default_email' || field.type === 'email') {
            // Salvar com a chave original
            recipientDataForDb[field.id] = value
            
            // Se tiver placeholderId, salvar também com ele
            if (field.placeholderId) {
              recipientDataForDb[field.placeholderId] = value
            }
            
            // Garantir que também existe como 'email' genérico
            recipientDataForDb['email'] = value
            recipientDataForDb['recipient_email'] = value
            
            console.log(`[Form] Email salvo com múltiplas chaves:`, {
              [field.id]: value,
              [field.placeholderId || 'no-placeholder']: value,
              email: value,
              recipient_email: value
            })
          } else {
            // Para outros campos, manter o comportamento original
            if (field.placeholderId) {
              recipientDataForDb[field.placeholderId] = value
            } else {
              recipientDataForDb[field.id] = value
            }
          }
        }
      }

      // Adicionar log para debug
      console.log(`[Form] Dados finais para o banco:`, recipientDataForDb)
      console.log(`[Form] Chaves disponíveis:`, Object.keys(recipientDataForDb))

      const response = await fetch("/api/issue-certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: template.id,
          recipient_data: recipientDataForDb,
          certificate_number_to_update: certificateToUpdate?.certificate_number || null,
          recipient_cpf: prefilledCpf,
          recipient_dob: prefilledDob,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Erro ao gerar o certificado.")

      onSuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderInput = (field: FormField) => {
    const commonProps = {
      id: field.id,
      required: field.required,
      style: { borderRadius: `${design.borderRadius}px` },
    }

    const isMasked =
      field.type === "tel" ||
      field.label.toLowerCase().includes("cpf") ||
      field.label.toLowerCase().includes("cnpj") ||
      field.label.toLowerCase().includes("cep")

    if (isMasked) {
      return (
        <Input
          {...commonProps}
          type="text"
          value={getMaskedValue(formData[field.id] || "", field.label)}
          onChange={(e) => handleMaskedInputChange(field.id, e.target.value)}
          placeholder={
            field.label.toLowerCase().includes("cpf")
              ? "000.000.000-00"
              : field.label.toLowerCase().includes("whatsapp")
                ? "(00) 00000-0000"
                : ""
          }
        />
      )
    }

    switch (field.type) {
      case "email":
      case "date":
      case "number":
      case "text":
        return (
          <Input
            {...commonProps}
            type={field.type}
            value={formData[field.id] || ""}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
          />
        )
      case "tel": // Fallback for non-masked tel
        return (
          <Input
            {...commonProps}
            type="tel"
            value={formData[field.id] || ""}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
          />
        )
      case "textarea":
        return (
          <Textarea
            {...commonProps}
            value={formData[field.id] || ""}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            rows={3}
          />
        )
      case "select":
        return (
          <Select
            value={formData[field.id] || ""}
            onValueChange={(value) => handleInputChange(field.id, value)}
            required={field.required}
          >
            <SelectTrigger style={{ borderRadius: `${design.borderRadius}px` }}>
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <input
              {...commonProps}
              type="checkbox"
              checked={formData[field.id] || false}
              onChange={(e) => handleInputChange(field.id, e.target.checked)}
              className="rounded"
            />
            <Label htmlFor={field.id} className="text-sm">
              {field.description || field.label}
            </Label>
          </div>
        )
      case "image":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor={field.id}
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                style={{ borderRadius: `${design.borderRadius}px` }}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {uploadPreviews[field.id] ? (
                    <img
                      src={uploadPreviews[field.id] || "/placeholder.svg"}
                      alt="Preview"
                      className="w-16 h-20 object-cover rounded mb-2"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 mb-4 text-gray-500" />
                  )}
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Clique para enviar</span> ou arraste
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG até 2MB</p>
                </div>
                <input
                  id={field.id}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => handleFileChange(field.id, e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {(uploadPreviews[field.id] || uploadedFiles[field.id]) && (
              <div className="flex items-center justify-between p-2 bg-gray-100 rounded">
                <span className="text-sm text-gray-700 truncate">
                  {uploadedFiles[field.id]?.name || "Imagem existente"}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleFileChange(field.id, null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div
      className="rounded-lg shadow-lg overflow-hidden w-full"
      style={{
        backgroundColor: design.backgroundColor,
        color: design.textColor,
        borderRadius: `${design.borderRadius}px`,
      }}
    >
      <div className="p-6 md:p-8 text-center" style={{ backgroundColor: design.primaryColor }}>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{design.title}</h1>
        <p className="text-blue-100 text-sm md:text-base">{design.description}</p>
      </div>

      <div className="p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id} className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>

              {field.description && <p className="text-xs md:text-sm text-gray-600">{field.description}</p>}

              {renderInput(field)}
            </div>
          ))}

          <div className="flex flex-col sm:flex-row-reverse gap-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full text-white font-semibold"
              size="lg"
              style={{
                backgroundColor: design.primaryColor,
                borderRadius: `${design.borderRadius}px`,
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {certificateToUpdate ? "Atualizando..." : "Gerando Certificado..."}
                </>
              ) : certificateToUpdate ? (
                "Salvar e Gerar Novo Certificado"
              ) : (
                design.submitButtonText
              )}
            </Button>
            {certificateToUpdate && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancelEdit}
                className="w-full bg-transparent"
                size="lg"
                style={{
                  borderColor: design.primaryColor,
                  color: design.primaryColor,
                }}
              >
                Cancelar Edição
              </Button>
            )}
          </div>
        </form>
      </div>

      {design.footerEnabled && (
        <div className="px-6 md:px-8 py-4 text-center text-xs md:text-sm text-gray-500 border-t">
          {design.footerText}
        </div>
      )}
    </div>
  )
}

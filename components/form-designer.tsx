"use client"

import type React from "react"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Type,
  Mail,
  Phone,
  Calendar,
  Hash,
  FileText,
  ToggleLeft,
  List,
  Palette,
  MessageSquare,
  Settings,
  Tag,
  ImageIcon,
  Upload,
  X,
  GripVertical,
  Copy,
  Check,
  Send,
  Loader2,
  Play,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface FormField {
  id: string
  type: "text" | "email" | "tel" | "date" | "number" | "textarea" | "select" | "checkbox" | "image"
  label: string
  description?: string
  placeholder?: string
  required: boolean
  options?: string[]
  placeholderId?: string
  isDefault?: boolean
}

interface SpecialOffer {
  id: string
  image: string
  title: string
  description: string
  price: string
  priceText: string
  buttonText: string
  buttonUrl: string
}

interface EmailConfig {
  enabled: boolean
  senderName: string
  senderEmail: string
  subject: string
  body: string
}

interface FormDesign {
  primaryColor: string
  backgroundColor: string
  textColor: string
  borderRadius: number
  showLogo: boolean
  logoUrl?: string
  title: string
  description: string
  submitButtonText: string
  successMessage: string
  specialOffers: SpecialOffer[]
  footerEnabled: boolean
  footerText: string
  emailConfig: EmailConfig
}

interface FormDesignerProps {
  onStateChange: (formData: { fields: FormField[]; design: FormDesign }) => void
  initialData?: { fields: FormField[]; design: FormDesign } | null
  availablePlaceholders?: Array<{ id: string; label: string; type?: "text" | "image" }>
}

const fieldTypeIcons = {
  text: Type,
  email: Mail,
  tel: Phone,
  date: Calendar,
  number: Hash,
  textarea: FileText,
  select: List,
  checkbox: ToggleLeft,
  image: ImageIcon,
}

const defaultDesign: FormDesign = {
  primaryColor: "#3b82f6",
  backgroundColor: "#ffffff",
  textColor: "#1f2937",
  borderRadius: 8,
  showLogo: false,
  title: "Solicitar Certificado",
  description: "Preencha os dados abaixo para receber seu certificado digital.",
  submitButtonText: "Gerar Certificado",
  successMessage: "Parabéns! Seu certificado foi gerado com sucesso. Você pode baixá-lo clicando no botão abaixo.",
  specialOffers: [],
  footerEnabled: true,
  footerText: "Powered by CertGen • Certificados digitais profissionais",
  emailConfig: {
    enabled: false,
    senderName: "",
    senderEmail: "",
    subject: "Seu certificado está pronto!",
    body: `<p>Olá {{nome_completo}},</p><p>Seu certificado foi emitido com sucesso. Clique no link abaixo para fazer o download:</p><p><a href="{{certificate_link}}">Baixar Certificado</a></p><p>Número do Certificado: {{certificate_id}}</p>`,
  },
}

export default function FormDesigner({ onStateChange, initialData, availablePlaceholders = [] }: FormDesignerProps) {
  const defaultFields = useMemo(
    () => [
      {
        id: "default_email",
        type: "email" as const,
        label: "Seu melhor e-mail",
        description: "Usaremos este e-mail para enviar o certificado e para contato.",
        placeholder: "seu@email.com",
        required: true,
        isDefault: true,
        placeholderId: availablePlaceholders.find((p) => p.id.includes("email"))?.id,
      },
      {
        id: "default_whatsapp",
        type: "tel" as const,
        label: "WhatsApp (com DDD)",
        description: "Para comunicações importantes sobre seu certificado.",
        placeholder: "(99) 99999-9999",
        required: true,
        isDefault: true,
        placeholderId: availablePlaceholders.find((p) => p.id.includes("whatsapp") || p.id.includes("phone"))?.id,
      },
    ],
    [availablePlaceholders],
  )

  const [fields, setFields] = useState<FormField[]>([])
  const [design, setDesign] = useState<FormDesign>(defaultDesign)
  const [showPreview, setShowPreview] = useState(false)
  const [editingField, setEditingField] = useState<FormField | null>(null)
  const { toast } = useToast()
  const [isInitialized, setIsInitialized] = useState(false)
  const [isTestingSmtp, setIsTestingSmtp] = useState(false)
  const [certificateLogs, setCertificateLogs] = useState<string[]>([])
  const [isListeningLogs, setIsListeningLogs] = useState(false)

  // Drag and drop state
  const dragField = useRef<number | null>(null)
  const dragOverField = useRef<number | null>(null)

  // Special offers state
  const [newOffer, setNewOffer] = useState<Partial<SpecialOffer>>({
    image: "",
    title: "",
    description: "",
    price: "",
    priceText: "por apenas",
    buttonText: "Comprar Agora",
    buttonUrl: "",
  })

  useEffect(() => {
    if (initialData) {
      setFields(initialData.fields && initialData.fields.length > 0 ? initialData.fields : defaultFields)
      const newDesign = { ...defaultDesign, ...initialData.design }
      newDesign.emailConfig = { ...defaultDesign.emailConfig, ...(initialData.design?.emailConfig || {}) }
      setDesign(newDesign)
    } else {
      setFields(defaultFields)
      setDesign(defaultDesign)
    }
    setIsInitialized(true)
  }, [initialData, defaultFields])

  useEffect(() => {
    if (!isInitialized) {
      return
    }
    const handler = setTimeout(() => {
      onStateChange({ fields, design })
    }, 500)

    return () => {
      clearTimeout(handler)
    }
  }, [fields, design, onStateChange, isInitialized])

  useEffect(() => {
    if (editingField) {
      const formDesigner = document.getElementById("form-designer-card")
      formDesigner?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [editingField])

  const handleTestEmail = async () => {
    const { senderEmail, senderName } = design.emailConfig

    if (!senderEmail) {
      toast({
        title: "Email Obrigatório",
        description: "Por favor, preencha o campo 'Email do Remetente' para enviar um teste.",
        variant: "destructive",
      })
      return
    }

    if (!senderEmail.endsWith("@therapist.international")) {
      toast({
        title: "Domínio Inválido",
        description: "O email deve ser do domínio therapist.international",
        variant: "destructive",
      })
      return
    }

    setIsTestingSmtp(true)
    try {
      const response = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderEmail,
          senderName,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Falha no teste de email.")
      }

      toast({
        title: "Sucesso!",
        description: result.message,
        variant: "default",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ocorreu um erro desconhecido."
      console.error(`[Email Test Error]:`, message)
      toast({
        title: "Erro no Teste de Email",
        description: message,
        variant: "destructive",
        duration: 9000,
      })
    } finally {
      setIsTestingSmtp(false)
    }
  }

  const allPlaceholders = useMemo(() => {
    const fieldPlaceholders = fields.map((f) => ({
      tag: `{{${f.placeholderId || f.id}}}`,
      description: f.label,
    }))
    return [
      { tag: "{{certificate_link}}", description: "Link para download do PDF" },
      { tag: "{{certificate_id}}", description: "Número único do certificado" },
      ...fieldPlaceholders,
    ]
  }, [fields])

  // Special offers functions
  const addSpecialOffer = () => {
    if (!newOffer.title?.trim() || !newOffer.price?.trim()) {
      toast({
        title: "Erro",
        description: "Título e preço são obrigatórios.",
        variant: "destructive",
      })
      return
    }

    const offer: SpecialOffer = {
      id: `offer_${Date.now()}`,
      image: newOffer.image || "/placeholder.svg?height=200&width=200",
      title: newOffer.title,
      description: newOffer.description || "",
      price: newOffer.price,
      priceText: newOffer.priceText || "por apenas",
      buttonText: "Comprar Agora",
      buttonUrl: newOffer.buttonUrl || "#",
    }

    setDesign((prev) => ({
      ...prev,
      specialOffers: [...prev.specialOffers, offer],
    }))

    setNewOffer({
      image: "",
      title: "",
      description: "",
      price: "",
      priceText: "por apenas",
      buttonText: "Comprar Agora",
      buttonUrl: "",
    })

    toast({
      title: "Oferta adicionada!",
      description: `Oferta "${offer.title}" foi adicionada com sucesso.`,
    })
  }

  const removeSpecialOffer = (id: string) => {
    setDesign((prev) => ({
      ...prev,
      specialOffers: prev.specialOffers.filter((offer) => offer.id !== id),
    }))
    toast({
      title: "Oferta removida",
      description: "A oferta foi removida com sucesso.",
    })
  }

  const formatPrice = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    if (!numbers) return ""
    const cents = Number.parseInt(numbers)
    return (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  const handlePriceChange = (value: string) => {
    const formatted = formatPrice(value)
    setNewOffer((prev) => ({ ...prev, price: formatted }))
  }

  const getUnusedPlaceholders = (type: "text" | "image") => {
    const usedPlaceholderIds = fields
      .filter((field) => field.placeholderId && field.id !== editingField?.id)
      .map((field) => field.placeholderId)

    return availablePlaceholders.filter(
      (placeholder) => !usedPlaceholderIds.includes(placeholder.id) && (placeholder.type || "text") === type,
    )
  }

  const handleFieldSubmit = (fieldData: FormField) => {
    if (editingField) {
      setFields((prev) => prev.map((field) => (field.id === editingField.id ? fieldData : field)))
      toast({
        title: "Campo atualizado!",
        description: `Campo "${fieldData.label}" foi atualizado.`,
      })
      setEditingField(null)
    } else {
      if (!fieldData.label?.trim()) {
        toast({
          title: "Erro",
          description: "O rótulo do campo é obrigatório.",
          variant: "destructive",
        })
        return
      }
      setFields((prev) => [...prev, fieldData])
      toast({
        title: "Campo adicionado!",
        description: `Campo "${fieldData.label}" foi adicionado ao formulário.`,
      })
    }
  }

  const removeField = (id: string) => {
    if (editingField?.id === id) {
      setEditingField(null)
    }
    setFields((prev) => prev.filter((field) => field.id !== id))
    toast({
      title: "Campo removido",
      description: "O campo foi removido do formulário.",
    })
  }

  const handleDragSort = () => {
    if (dragField.current === null || dragOverField.current === null) return

    const fieldsClone = [...fields]
    const draggedItem = fieldsClone.splice(dragField.current, 1)[0]
    fieldsClone.splice(dragOverField.current, 0, draggedItem)
    setFields(fieldsClone)
    dragField.current = null
    dragOverField.current = null
  }

  const renderPreview = () => {
    return (
      <div className="max-w-2xl mx-auto">
        <div
          className="rounded-lg shadow-lg overflow-hidden"
          style={{
            backgroundColor: design.backgroundColor,
            color: design.textColor,
            borderRadius: `${design.borderRadius}px`,
          }}
        >
          {/* Header */}
          <div className="p-8 text-center" style={{ backgroundColor: design.primaryColor }}>
            {design.showLogo && design.logoUrl && (
              <img src={design.logoUrl || "/placeholder.svg"} alt="Logo" className="h-16 mx-auto mb-4" />
            )}
            <h1 className="text-3xl font-bold text-white mb-2">{design.title}</h1>
            <p className="text-blue-100">{design.description}</p>
          </div>

          {/* Form */}
          <div className="p-8 space-y-6">
            {fields.map((field) => {
              const IconComponent = fieldTypeIcons[field.type] || Type
              return (
                <div key={field.id} className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <IconComponent className="h-4 w-4" />
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                    {field.placeholderId && (
                      <Badge variant="outline" className="text-xs">
                        <Tag className="h-3 w-3 mr-1" />
                        {field.placeholderId}
                      </Badge>
                    )}
                  </Label>
                  {field.description && <p className="text-xs text-gray-500 -mt-1 mb-2">{field.description}</p>}

                  {field.type === "textarea" ? (
                    <Textarea
                      placeholder={field.placeholder}
                      className="w-full"
                      style={{ borderRadius: `${design.borderRadius}px` }}
                      disabled
                    />
                  ) : field.type === "select" ? (
                    <Select disabled>
                      <SelectTrigger style={{ borderRadius: `${design.borderRadius}px` }}>
                        <SelectValue placeholder={field.placeholder || "Selecione uma opção"} />
                      </SelectTrigger>
                    </Select>
                  ) : field.type === "checkbox" ? (
                    <div className="space-y-2">
                      {field.options && field.options.length > 0 ? (
                        field.options.map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <input type="checkbox" id={`${field.id}_${index}`} disabled className="rounded" />
                            <label htmlFor={`${field.id}_${index}`} className="text-sm">
                              {option}
                            </label>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center space-x-2">
                          <input type="checkbox" id={field.id} disabled className="rounded" />
                          <label htmlFor={field.id} className="text-sm">
                            {field.label}
                          </label>
                        </div>
                      )}
                    </div>
                  ) : field.type === "image" ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-500">Clique para enviar uma imagem</p>
                    </div>
                  ) : (
                    <Input
                      type={field.type}
                      placeholder={field.placeholder}
                      className="w-full"
                      style={{ borderRadius: `${design.borderRadius}px` }}
                      disabled
                    />
                  )}
                </div>
              )
            })}

            <Button
              className="w-full py-3 text-white font-semibold"
              style={{
                backgroundColor: design.primaryColor,
                borderRadius: `${design.borderRadius}px`,
              }}
              disabled
            >
              {design.submitButtonText}
            </Button>
          </div>

          {/* Footer */}
          {design.footerEnabled && (
            <div className="px-8 py-4 text-center text-sm text-gray-500 border-t">{design.footerText}</div>
          )}
        </div>

        {/* Success Message Preview */}
        <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 mb-2">Mensagem de Sucesso:</h3>
          <div
            className="prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: design.successMessage }}
          />

          {/* Special Offers Preview */}
          {design.specialOffers.length > 0 && (
            <div className="mt-6">
              <h4 className="text-md font-semibold text-green-800 mb-4">Ofertas Especiais:</h4>
              <div className="space-y-4">
                {design.specialOffers.map((offer) => (
                  <div key={offer.id} className="bg-white rounded-lg p-4 shadow-sm border">
                    <div className="flex items-start space-x-4">
                      <img
                        src={offer.image || "/placeholder.svg"}
                        alt={offer.title}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h5 className="font-semibold text-gray-900 mb-1">{offer.title}</h5>
                        {offer.description && <p className="text-sm text-gray-600 mb-2">{offer.description}</p>}
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            {offer.priceText} <span className="text-lg font-bold text-green-600">{offer.price}</span>
                          </div>
                          <Button
                            size="sm"
                            style={{ backgroundColor: design.primaryColor }}
                            className="text-white"
                            disabled
                          >
                            {offer.buttonText}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const startListeningCertificateLogs = () => {
    setIsListeningLogs(true)
    setCertificateLogs([])

    // Polling para capturar logs
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/certificate-logs")
        if (response.ok) {
          const data = await response.json()
          if (data.logs && data.logs.length > 0) {
            setCertificateLogs((prev) => [...prev, ...data.logs])
          }
        }
      } catch (error) {
        console.error("Erro ao capturar logs:", error)
      }
    }, 2000)

    // Parar após 5 minutos
    setTimeout(() => {
      clearInterval(interval)
      setIsListeningLogs(false)
    }, 300000)
  }

  const clearCertificateLogs = () => {
    setCertificateLogs([])
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar - Editor */}
      <div className="w-[450px] bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Designer de Formulário</h2>
              <p className="text-sm text-gray-600">Configure campos e aparência</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <Tabs defaultValue="fields" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="fields" className="text-xs">
                  <Type className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="appearance" className="text-xs">
                  <Palette className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="messages" className="text-xs">
                  <MessageSquare className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="email" className="text-xs">
                  <Mail className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="footer" className="text-xs">
                  <Settings className="h-3 w-3" />
                </TabsTrigger>
              </TabsList>

              <TabsContent value="fields" className="space-y-4 mt-4">
                <FieldEditor
                  key={editingField ? editingField.id : "new"}
                  onSubmit={handleFieldSubmit}
                  onCancel={() => setEditingField(null)}
                  initialData={editingField}
                  getUnusedPlaceholders={getUnusedPlaceholders}
                />

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Campos do Formulário ({fields.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {fields.length > 0 ? (
                        fields.map((field, index) => {
                          const IconComponent = fieldTypeIcons[field.type] || Type
                          return (
                            <div
                              key={field.id}
                              draggable={!field.isDefault}
                              onDragStart={() => (dragField.current = index)}
                              onDragEnter={() => (dragOverField.current = index)}
                              onDragEnd={handleDragSort}
                              onDragOver={(e) => e.preventDefault()}
                              onClick={() => !field.isDefault && setEditingField(field)}
                              className={cn(
                                "flex items-start gap-3 p-3 border rounded-lg transition-colors",
                                field.isDefault
                                  ? "bg-gray-50 cursor-not-allowed"
                                  : "hover:bg-gray-100 cursor-pointer active:bg-gray-200",
                                editingField?.id === field.id && "ring-2 ring-blue-500",
                              )}
                            >
                              <div className="flex items-center gap-3 flex-shrink-0 pt-0.5">
                                {!field.isDefault && <GripVertical className="h-5 w-5 text-gray-400 cursor-grab" />}
                                <IconComponent className="h-4 w-4 text-gray-500" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium break-words">{field.label}</p>
                                {field.description && (
                                  <p className="text-xs text-gray-500 break-words mt-0.5">{field.description}</p>
                                )}
                                <div className="flex items-center flex-wrap gap-2 mt-1.5">
                                  <Badge variant="outline" className="text-xs">
                                    {field.type}
                                  </Badge>
                                  {field.required && (
                                    <Badge variant="destructive" className="text-xs">
                                      Obrigatório
                                    </Badge>
                                  )}
                                  {field.placeholderId && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Tag className="h-3 w-3 mr-1" />
                                      {field.placeholderId}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {!field.isDefault && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeField(field.id)
                                  }}
                                  className="h-8 w-8 p-0 flex-shrink-0"
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-center text-gray-500 text-sm py-8">Nenhum campo adicionado ainda.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="appearance" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Cores e Estilo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Cor Primária</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={design.primaryColor}
                          onChange={(e) => setDesign((prev) => ({ ...prev, primaryColor: e.target.value }))}
                          className="w-12 h-10 p-1 border rounded"
                        />
                        <Input
                          type="text"
                          value={design.primaryColor}
                          onChange={(e) => setDesign((prev) => ({ ...prev, primaryColor: e.target.value }))}
                          className="flex-1 h-10 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Cor de Fundo</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={design.backgroundColor}
                          onChange={(e) => setDesign((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                          className="w-12 h-10 p-1 border rounded"
                        />
                        <Input
                          type="text"
                          value={design.backgroundColor}
                          onChange={(e) => setDesign((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                          className="flex-1 h-10 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Cor do Texto</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={design.textColor}
                          onChange={(e) => setDesign((prev) => ({ ...prev, textColor: e.target.value }))}
                          className="w-12 h-10 p-1 border rounded"
                        />
                        <Input
                          type="text"
                          value={design.textColor}
                          onChange={(e) => setDesign((prev) => ({ ...prev, textColor: e.target.value }))}
                          className="flex-1 h-10 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Arredondamento das Bordas</Label>
                      <Input
                        type="number"
                        value={design.borderRadius}
                        onChange={(e) => setDesign((prev) => ({ ...prev, borderRadius: Number(e.target.value) }))}
                        className="text-sm"
                        min="0"
                        max="20"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Cabeçalho</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Título</Label>
                      <Input
                        value={design.title}
                        onChange={(e) => setDesign((prev) => ({ ...prev, title: e.target.value }))}
                        className="text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Descrição</Label>
                      <Textarea
                        value={design.description}
                        onChange={(e) => setDesign((prev) => ({ ...prev, description: e.target.value }))}
                        className="text-sm"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Texto do Botão</Label>
                      <Input
                        value={design.submitButtonText}
                        onChange={(e) => setDesign((prev) => ({ ...prev, submitButtonText: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="messages" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Mensagem de Sucesso</CardTitle>
                    <p className="text-xs text-gray-600">
                      Personalize a mensagem exibida após a geração do certificado
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Editor de Mensagem (HTML)</Label>
                      <Textarea
                        value={design.successMessage}
                        onChange={(e) => setDesign((prev) => ({ ...prev, successMessage: e.target.value }))}
                        className="min-h-[120px] text-sm font-mono"
                        placeholder="<p>Parabéns! Seu certificado foi gerado com sucesso. Você pode baixá-lo clicando no botão abaixo.</p>"
                      />
                      <p className="text-xs text-gray-500">
                        Use HTML para formatar o texto. Esta mensagem será exibida na tela de sucesso junto com o botão
                        de download do certificado.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Special Offers Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Ofertas Especiais</CardTitle>
                    <p className="text-xs text-gray-600">Adicione ofertas que aparecerão após a mensagem de sucesso</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Título da Oferta</Label>
                          <Input
                            value={newOffer.title || ""}
                            onChange={(e) => setNewOffer((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="Ex: Curso Avançado"
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Preço</Label>
                          <Input
                            value={newOffer.price || ""}
                            onChange={(e) => handlePriceChange(e.target.value)}
                            placeholder="R$ 0,00"
                            className="text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Descrição</Label>
                        <Textarea
                          value={newOffer.description || ""}
                          onChange={(e) => setNewOffer((prev) => ({ ...prev, description: e.target.value }))}
                          placeholder="Descrição da oferta..."
                          className="text-sm"
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Texto do Preço</Label>
                          <Input
                            value={newOffer.priceText || ""}
                            onChange={(e) => setNewOffer((prev) => ({ ...prev, priceText: e.target.value }))}
                            placeholder="por apenas"
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Texto do Botão</Label>
                          <Input
                            value={newOffer.buttonText || ""}
                            onChange={(e) => setNewOffer((prev) => ({ ...prev, buttonText: e.target.value }))}
                            placeholder="Comprar Agora"
                            className="text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">URL do Botão</Label>
                        <Input
                          value={newOffer.buttonUrl || ""}
                          onChange={(e) => setNewOffer((prev) => ({ ...prev, buttonUrl: e.target.value }))}
                          placeholder="https://exemplo.com/comprar"
                          className="text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Imagem da Oferta</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            value={newOffer.image || ""}
                            onChange={(e) => setNewOffer((prev) => ({ ...prev, image: e.target.value }))}
                            placeholder="URL da imagem ou deixe vazio para usar placeholder"
                            className="text-sm flex-1"
                          />
                          <Button size="sm" variant="outline" className="px-3 bg-transparent">
                            <Upload className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                          Recomendado: imagem quadrada (1:1) com pelo menos 200x200px
                        </p>
                      </div>

                      <Button onClick={addSpecialOffer} className="w-full text-sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Oferta
                      </Button>
                    </div>

                    {/* Lista de Ofertas Adicionadas */}
                    {design.specialOffers.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">
                          Ofertas Adicionadas ({design.specialOffers.length})
                        </Label>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {design.specialOffers.map((offer) => (
                            <div
                              key={offer.id}
                              className="flex items-center space-x-3 p-3 border rounded-lg bg-gray-50"
                            >
                              <img
                                src={offer.image || "/placeholder.svg"}
                                alt={offer.title}
                                className="w-12 h-12 object-cover rounded flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{offer.title}</p>
                                <p className="text-xs text-gray-600">{offer.price}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeSpecialOffer(offer.id)}
                                className="h-8 w-8 p-0 flex-shrink-0"
                              >
                                <X className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="email" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Envio Automático de Email</CardTitle>
                    <p className="text-xs text-gray-600">
                      Envie o certificado por email automaticamente após a emissão.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={design.emailConfig.enabled}
                        onCheckedChange={(checked) =>
                          setDesign((prev) => ({
                            ...prev,
                            emailConfig: { ...prev.emailConfig, enabled: checked },
                          }))
                        }
                      />
                      <Label className="text-xs">Ativar envio automático</Label>
                    </div>

                    {design.emailConfig.enabled && (
                      <div className="space-y-4 pt-4 border-t">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Conteúdo do Email</CardTitle>
                            <p className="text-xs text-gray-600">
                              Configure o conteúdo do email que será enviado automaticamente com o certificado
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Nome do Remetente</Label>
                                <Input
                                  value={design.emailConfig.senderName}
                                  onChange={(e) =>
                                    setDesign((prev) => ({
                                      ...prev,
                                      emailConfig: { ...prev.emailConfig, senderName: e.target.value },
                                    }))
                                  }
                                  placeholder="Ex: Sua Empresa"
                                  className="text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Email do Remetente</Label>
                                <Input
                                  type="email"
                                  value={design.emailConfig.senderEmail}
                                  onChange={(e) =>
                                    setDesign((prev) => ({
                                      ...prev,
                                      emailConfig: { ...prev.emailConfig, senderEmail: e.target.value },
                                    }))
                                  }
                                  placeholder="contato@therapist.international"
                                  className="text-sm"
                                />
                                <p className="text-xs text-gray-500">Use um email do domínio therapist.international</p>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Assunto do Email</Label>
                              <Input
                                value={design.emailConfig.subject}
                                onChange={(e) =>
                                  setDesign((prev) => ({
                                    ...prev,
                                    emailConfig: { ...prev.emailConfig, subject: e.target.value },
                                  }))
                                }
                                placeholder="Seu certificado de conclusão"
                                className="text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Corpo do Email (aceita HTML)</Label>
                              <Textarea
                                value={design.emailConfig.body}
                                onChange={(e) =>
                                  setDesign((prev) => ({
                                    ...prev,
                                    emailConfig: { ...prev.emailConfig, body: e.target.value },
                                  }))
                                }
                                className="min-h-[150px] text-sm font-mono"
                                rows={8}
                                placeholder="Olá {{nome}},&#10;&#10;Parabéns! Seu certificado está pronto.&#10;&#10;Acesse: {{certificate_link}}"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium">Tags Disponíveis</Label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {allPlaceholders.map((p) => (
                                  <Badge
                                    key={p.tag}
                                    variant="secondary"
                                    className="cursor-pointer"
                                    title={`Clique para copiar: ${p.description}`}
                                    onClick={() => {
                                      navigator.clipboard.writeText(p.tag)
                                      toast({ title: "Copiado!", description: `${p.tag} copiado.` })
                                    }}
                                  >
                                    {p.tag} <Copy className="h-3 w-3 ml-1.5" />
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Sistema de Email Nativo
                            </CardTitle>
                            <p className="text-xs text-gray-600">
                              Sistema integrado usando Resend API com domínio therapist.international
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex items-center justify-center p-6 bg-green-50 rounded-lg border border-green-200">
                              <div className="text-center">
                                <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto mb-3">
                                  <Check className="h-6 w-6 text-green-600" />
                                </div>
                                <p className="text-sm font-medium text-green-800">Sistema Configurado</p>
                                <p className="text-xs text-green-600 mt-1">
                                  Emails serão enviados automaticamente via therapist.international
                                </p>
                              </div>
                            </div>

                            <div className="pt-2">
                              <Button
                                variant="outline"
                                onClick={handleTestEmail}
                                disabled={isTestingSmtp || !design.emailConfig.senderEmail}
                                className="w-full text-sm bg-transparent"
                              >
                                {isTestingSmtp ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4 mr-2" />
                                )}
                                {isTestingSmtp ? "Enviando..." : "Testar Envio de Email"}
                              </Button>
                              <p className="text-xs text-gray-500 mt-2 text-center">
                                Enviará um email de teste para verificar se o sistema está funcionando
                              </p>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Logs de Emissão de Certificado
                            </CardTitle>
                            <p className="text-xs text-gray-600">
                              Monitore em tempo real as tentativas de emissão de certificado
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={startListeningCertificateLogs}
                                disabled={isListeningLogs}
                                className="flex-1 bg-transparent"
                              >
                                {isListeningLogs ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4 mr-2" />
                                )}
                                {isListeningLogs ? "Monitorando..." : "Iniciar Monitoramento"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={clearCertificateLogs}
                                disabled={certificateLogs.length === 0}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="bg-black text-green-400 p-3 rounded-lg font-mono text-xs max-h-60 overflow-y-auto">
                              {certificateLogs.length === 0 ? (
                                <div className="text-gray-500">
                                  {isListeningLogs
                                    ? "Aguardando logs..."
                                    : "Clique em 'Iniciar Monitoramento' para ver os logs"}
                                </div>
                              ) : (
                                certificateLogs.map((log, index) => (
                                  <div key={index} className="mb-1">
                                    {log}
                                  </div>
                                ))
                              )}
                            </div>

                            <p className="text-xs text-gray-500">
                              {isListeningLogs
                                ? "Monitoramento ativo por 5 minutos"
                                : "Logs mostram tentativas de emissão de certificado"}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="footer" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Rodapé do Formulário</CardTitle>
                    <p className="text-xs text-gray-600">Configure o rodapé exibido no formulário de emissão</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={design.footerEnabled}
                        onCheckedChange={(checked) => setDesign((prev) => ({ ...prev, footerEnabled: checked }))}
                      />
                      <Label className="text-xs">Exibir rodapé</Label>
                    </div>

                    {design.footerEnabled && (
                      <div className="space-y-2">
                        <Label className="text-xs">Texto do Rodapé</Label>
                        <Textarea
                          value={design.footerText}
                          onChange={(e) => setDesign((prev) => ({ ...prev, footerText: e.target.value }))}
                          className="text-sm"
                          rows={2}
                          placeholder="Powered by CertGen • Certificados digitais profissionais"
                        />
                        <p className="text-xs text-gray-500">
                          Este texto aparecerá na parte inferior do formulário de emissão.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>

      {/* Main Area - Preview */}
      <div className="flex-1 overflow-auto bg-gray-100">
        <div className="p-8">
          {showPreview ? (
            <div>
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Preview do Formulário</h2>
                <p className="text-gray-600">Veja como o formulário aparecerá para os usuários</p>
              </div>
              {renderPreview()}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Eye className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Preview do Formulário</h3>
                <p className="text-gray-500 mb-4">
                  Clique no botão "Preview" na barra lateral para visualizar como o formulário ficará.
                </p>
                <Button onClick={() => setShowPreview(true)} variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  Visualizar Preview
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Sub-component for adding/editing fields
function FieldEditor({
  onSubmit,
  onCancel,
  initialData,
  getUnusedPlaceholders,
}: {
  onSubmit: (data: FormField) => void
  onCancel: () => void
  initialData: FormField | null
  getUnusedPlaceholders: (type: "text" | "image") => Array<{ id: string; label: string }>
}) {
  const emptyField: Omit<FormField, "id"> = {
    type: "text",
    label: "",
    description: "",
    placeholder: "",
    required: false,
    options: [],
    placeholderId: undefined,
  }
  const [field, setField] = useState(initialData || { ...emptyField, id: "" })
  const [newOption, setNewOption] = useState("")
  const isEditing = !!initialData

  useEffect(() => {
    setField(initialData || { ...emptyField, id: `field_${Date.now()}` })
  }, [initialData])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const dataToSubmit = { ...field }
    if (dataToSubmit.placeholderId === "none") {
      dataToSubmit.placeholderId = undefined
    }
    onSubmit(dataToSubmit)
    if (!isEditing) {
      setField({ ...emptyField, id: `field_${Date.now()}` })
    }
  }

  const availableTextPlaceholders = getUnusedPlaceholders("text")
  const availableImagePlaceholders = getUnusedPlaceholders("image")

  return (
    <Card id="form-designer-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{isEditing ? "Editar Campo" : "Adicionar Campo Manual"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Tipo do Campo</Label>
            <Select
              value={field.type}
              onValueChange={(value) => setField((prev) => ({ ...prev, type: value as FormField["type"] }))}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="image">Imagem 3x4</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="tel">Telefone</SelectItem>
                <SelectItem value="date">Data</SelectItem>
                <SelectItem value="number">Número</SelectItem>
                <SelectItem value="textarea">Texto Longo</SelectItem>
                <SelectItem value="select">Lista Suspensa</SelectItem>
                <SelectItem value="checkbox">Checkbox</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Pergunta (Rótulo)</Label>
            <Input
              value={field.label || ""}
              onChange={(e) => setField((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="Ex: Nome completo"
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Descrição (Opcional)</Label>
            <Textarea
              value={field.description || ""}
              onChange={(e) => setField((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Instruções ou texto de ajuda para o usuário"
              className="text-sm"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Texto de ajuda (dentro do campo)</Label>
            <Input
              value={field.placeholder || ""}
              onChange={(e) => setField((prev) => ({ ...prev, placeholder: e.target.value }))}
              placeholder="Texto que aparece dentro do campo"
              className="text-sm"
            />
          </div>

          {field.type === "text" && availableTextPlaceholders.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Ligar a uma Tag de Texto</Label>
              <Select
                value={field.placeholderId || "none"}
                onValueChange={(value) => setField((prev) => ({ ...prev, placeholderId: value }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecione uma tag para vincular" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {availableTextPlaceholders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label} ({`{{${p.id}}}`})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {field.type === "image" && availableImagePlaceholders.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Ligar a uma Tag de Imagem</Label>
              <Select
                value={field.placeholderId || "none"}
                onValueChange={(value) => setField((prev) => ({ ...prev, placeholderId: value }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecione uma tag de imagem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {availableImagePlaceholders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label} ({`{{${p.id}}}`})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {field.type === "select" && (
            <div className="space-y-2">
              <Label className="text-xs">Opções da Lista</Label>
              <div className="flex space-x-2">
                <Input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Nova opção"
                  className="text-sm flex-1"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (newOption.trim()) {
                        setField((prev) => ({
                          ...prev,
                          options: [...(prev.options || []), newOption.trim()],
                        }))
                        setNewOption("")
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (newOption.trim()) {
                      setField((prev) => ({
                        ...prev,
                        options: [...(prev.options || []), newOption.trim()],
                      }))
                      setNewOption("")
                    }
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto p-1">
                {field.options?.map((option, index) => (
                  <div key={index} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                    <span>{option}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setField((prev) => ({
                          ...prev,
                          options: prev.options?.filter((_, i) => i !== index),
                        }))
                      }}
                      className="h-4 w-4 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {field.type === "checkbox" && (
            <div className="space-y-2">
              <Label className="text-xs">Opções do Checkbox</Label>
              <div className="flex space-x-2">
                <Input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Nova opção de checkbox"
                  className="text-sm flex-1"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (newOption.trim()) {
                        setField((prev) => ({
                          ...prev,
                          options: [...(prev.options || []), newOption.trim()],
                        }))
                        setNewOption("")
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (newOption.trim()) {
                      setField((prev) => ({
                        ...prev,
                        options: [...(prev.options || []), newOption.trim()],
                      }))
                      setNewOption("")
                    }
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto p-1">
                {field.options?.map((option, index) => (
                  <div key={index} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                    <span>{option}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setField((prev) => ({
                          ...prev,
                          options: prev.options?.filter((_, i) => i !== index),
                        }))
                      }}
                      className="h-4 w-4 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                Cada opção será um checkbox separado com o rótulo principal acima.
              </p>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              checked={field.required || false}
              onCheckedChange={(checked) => setField((prev) => ({ ...prev, required: checked }))}
            />
            <Label className="text-xs">Campo obrigatório</Label>
          </div>

          <div className="flex gap-2">
            {isEditing && (
              <Button type="button" variant="outline" onClick={onCancel} className="w-full text-sm bg-transparent">
                Cancelar
              </Button>
            )}
            <Button type="submit" className="w-full text-sm">
              {isEditing ? (
                <>
                  <Save className="h-4 w-4 mr-2" /> Salvar Alterações
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Campo
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

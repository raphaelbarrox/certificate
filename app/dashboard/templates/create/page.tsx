"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfessionalCertificateEditor } from "@/components/professional-certificate-editor"
import FormDesigner from "@/components/form-designer"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/auth-provider"
import { generatePublicLinkId } from "@/lib/certificate-generator"
import { Save, Settings, Palette, FileText, LinkIcon, ArrowLeft, Upload, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Image from "next/image"

// Define a partial template type for creation state
interface PartialTemplate {
  title?: string
  description?: string
  template_data?: any
  form_design?: any
  public_link_id?: string
  is_active?: boolean
  folder_id?: string | null
  placeholders?: Array<{ id: string; label: string }>
  thumbnail_url?: string | null
}

export default function CreateTemplatePage() {
  const [template, setTemplate] = useState<PartialTemplate>({
    title: "Novo Template Sem Título",
    description: "",
    is_active: true,
    template_data: null,
    form_design: null,
    placeholders: [],
    thumbnail_url: null,
  })
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("info")
  const [folders, setFolders] = useState<any[]>([])
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    loadFolders()
  }, [user])

  const loadFolders = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase.from("folders").select("id, name").eq("user_id", user.id)
      if (error) {
        // Ignore if table doesn't exist
        if (!error.message.includes('relation "public.folders" does not exist')) {
          throw error
        }
      } else {
        setFolders(data || [])
      }
    } catch (error) {
      console.error("Erro ao carregar pastas:", error)
    }
  }

  const handleThumbnailUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Por favor, selecione uma imagem.", variant: "destructive" })
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "A imagem deve ter no máximo 2MB.", variant: "destructive" })
      return
    }

    setUploadingThumbnail(true)
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `thumbnails/${fileName}`

      const { error: uploadError } = await supabase.storage.from("templates").upload(filePath, file)

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from("templates").getPublicUrl(filePath)

      setTemplate({ ...template, thumbnail_url: publicUrl })
      toast({ title: "Thumbnail carregado!", description: "A imagem foi salva com sucesso." })
    } catch (error) {
      console.error("Erro ao fazer upload:", error)
      toast({ title: "Erro no upload", description: "Não foi possível carregar a imagem.", variant: "destructive" })
    } finally {
      setUploadingThumbnail(false)
    }
  }

  const removeThumbnail = () => {
    setTemplate({ ...template, thumbnail_url: null })
    toast({ title: "Thumbnail removido" })
  }

  const handleSave = async () => {
    if (!template.title?.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" })
      setActiveTab("info")
      return
    }
    if (!template.template_data) {
      toast({
        title: "Design obrigatório",
        description: "Crie o design do certificado primeiro.",
        variant: "destructive",
      })
      setActiveTab("design")
      return
    }
    if (!user) {
      toast({ title: "Sessão expirada", variant: "destructive" })
      router.push("/auth/login")
      return
    }

    setSaving(true)
    try {
      const publicLinkId = generatePublicLinkId()
      const finalTemplateData = {
        user_id: user.id,
        title: template.title,
        description: template.description,
        template_data: template.template_data,
        form_design: template.form_design,
        placeholders: template.template_data.placeholders || [],
        public_link_id: publicLinkId,
        is_active: template.is_active,
        folder_id: template.folder_id,
        thumbnail_url: template.thumbnail_url,
      }

      const { error } = await supabase.from("certificate_templates").insert(finalTemplateData)

      if (error) throw error

      toast({ title: "Template criado!", description: "Seu novo template foi salvo com sucesso." })
      router.push("/dashboard/templates")
    } catch (error) {
      console.error("Erro ao criar template:", error)
      toast({ title: "Erro ao criar template", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/templates")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Criar Novo Template</h1>
                <p className="text-gray-600">Siga os passos para configurar seu novo certificado</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar e Criar"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Informações
            </TabsTrigger>
            <TabsTrigger value="design" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Design do Certificado
            </TabsTrigger>
            <TabsTrigger value="form" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Formulário de Emissão
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-2" disabled>
              <LinkIcon className="h-4 w-4" />
              Link Público
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Template</Label>
                  <Input
                    value={template.title}
                    onChange={(e) => setTemplate({ ...template, title: e.target.value })}
                    placeholder="Ex: Certificado de Conclusão de Curso"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={template.description || ""}
                    onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                    placeholder="Descreva brevemente este template..."
                    rows={3}
                  />
                </div>

                {folders.length > 0 && (
                  <div className="space-y-2">
                    <Label>Pasta</Label>
                    <Select
                      value={template.folder_id || "none"}
                      onValueChange={(value) =>
                        setTemplate({ ...template, folder_id: value === "none" ? null : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma pasta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma (Raiz)</SelectItem>
                        {folders.map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>
                            {folder.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Thumbnail (Uso Interno)</Label>
                  <p className="text-sm text-gray-500">
                    Adicione uma imagem de visualização para identificar facilmente este template. Tamanho recomendado:
                    400x300px (proporção 4:3). Máximo: 2MB.
                  </p>

                  {template.thumbnail_url ? (
                    <div className="relative w-48 h-36 border rounded-lg overflow-hidden">
                      <Image
                        src={template.thumbnail_url || "/placeholder.svg"}
                        alt="Thumbnail do template"
                        fill
                        className="object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={removeThumbnail}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-2">Clique para adicionar uma imagem</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailUpload}
                        disabled={uploadingThumbnail}
                        className="hidden"
                        id="thumbnail-upload"
                      />
                      <label htmlFor="thumbnail-upload">
                        <Button variant="outline" disabled={uploadingThumbnail} asChild>
                          <span>{uploadingThumbnail ? "Carregando..." : "Selecionar Imagem"}</span>
                        </Button>
                      </label>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="design" className="mt-6">
            <div className="h-[calc(100vh-200px)]">
              <ProfessionalCertificateEditor
                initialTemplate={template.template_data}
                onSave={(designData) => {
                  setTemplate({ ...template, template_data: designData })
                  toast({
                    title: "Design salvo localmente!",
                    description: "Continue configurando e salve o template no final.",
                  })
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="form" className="mt-6">
            <div className="h-[calc(100vh-200px)]">
              <FormDesigner
                initialData={template.form_design}
                availablePlaceholders={template.template_data?.placeholders || []}
                onSave={(formData) => {
                  setTemplate({ ...template, form_design: formData })
                  toast({
                    title: "Formulário salvo localmente!",
                    description: "Continue configurando e salve o template no final.",
                  })
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="link" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Link Público de Emissão</CardTitle>
              </CardHeader>
              <CardContent className="text-center py-12">
                <p className="text-gray-600">Salve o template para gerar o link público de emissão.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

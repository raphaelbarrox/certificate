"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import ProfessionalCertificateEditor from "@/components/professional-certificate-editor"
import FormDesigner from "@/components/form-designer"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/auth-provider"
import { Save, Copy, Settings, Palette, FileText, LinkIcon, ExternalLink, ArrowLeft } from "lucide-react"

interface Template {
  id: string
  title: string
  description: string
  template_data: any
  form_design: any
  public_link_id: string
  is_active: boolean
  folder_id: string | null
  placeholders: Array<{ id: string; label: string }>
}

export default function EditTemplatePage({ params }: { params: { id: string } }) {
  const [template, setTemplate] = useState<Template | null>(null)
  const [folders, setFolders] = useState<any[]>([])
  const [isInitializing, setIsInitializing] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("design")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    if (user && !template) {
      loadTemplate()
      loadFolders()
    } else if (template) {
      setIsInitializing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, user])

  const loadTemplate = async () => {
    setIsInitializing(true)
    try {
      const { data, error } = await supabase.from("certificate_templates").select("*").eq("id", params.id).single()

      if (error) throw error

      setTemplate(data)
    } catch (error) {
      console.error("Erro ao carregar template:", error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar o template.",
        variant: "destructive",
      })
      router.push("/dashboard/templates")
    } finally {
      setIsInitializing(false)
    }
  }

  const loadFolders = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase.from("folders").select("id, name").eq("user_id", user.id)
      if (error) {
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

  const handleEditorStateChange = useCallback((editorData: any, hasChanges: boolean) => {
    console.log("[v0] Estado do editor alterado:", {
      hasChanges,
      elements: editorData.elements?.length || 0,
      placeholders: editorData.placeholders?.length || 0,
    })

    setTemplate((prev) => {
      if (!prev) return null

      // Evita re-render desnecessário se os dados são idênticos
      const currentDataString = JSON.stringify(prev.template_data)
      const newDataString = JSON.stringify(editorData)

      if (currentDataString === newDataString) {
        return prev
      }

      return {
        ...prev,
        template_data: editorData,
        placeholders: editorData.placeholders || [],
      }
    })

    setHasUnsavedChanges(hasChanges)
  }, [])

  const handleFormStateChange = useCallback((formData: any) => {
    setTemplate((prev) => {
      if (!prev) return null
      // Avoid re-render if data is identical
      if (JSON.stringify(prev.form_design) === JSON.stringify(formData)) {
        return prev
      }
      return { ...prev, form_design: formData }
    })
    setHasUnsavedChanges(true)
  }, [])

  const saveTemplate = async () => {
    if (!template) return

    setSaving(true)
    console.log("[v0] Iniciando salvamento no banco de dados:", {
      templateId: template.id,
      title: template.title,
      elementsCount: template.template_data?.elements?.length || 0,
      placeholdersCount: template.placeholders?.length || 0,
      dataSize: `${(JSON.stringify(template.template_data).length / 1024).toFixed(2)}KB`,
    })

    try {
      if (!template.title?.trim()) {
        throw new Error("O título do template é obrigatório.")
      }

      if (!template.template_data?.elements?.length) {
        throw new Error("O template deve ter pelo menos um elemento.")
      }

      const updateData = {
        title: template.title.trim(),
        description: template.description?.trim() || null,
        template_data: template.template_data,
        form_design: template.form_design,
        is_active: template.is_active,
        folder_id: template.folder_id,
        placeholders: template.placeholders || [],
        updated_at: new Date().toISOString(),
      }

      console.log("[v0] Enviando dados para Supabase...")

      const { error } = await supabase.from("certificate_templates").update(updateData).eq("id", template.id)

      if (error) {
        console.error("[v0] Erro do Supabase:", error)
        throw error
      }

      const localStorageKey = `editor-state-${template.id}`
      try {
        localStorage.removeItem(localStorageKey)
        console.log("[v0] localStorage limpo após salvamento bem-sucedido")
      } catch (storageError) {
        console.warn("[v0] Erro ao limpar localStorage:", storageError)
      }

      await loadTemplate()

      console.log("[v0] Template salvo com sucesso no banco de dados")

      toast({
        title: "✅ Salvo com Sucesso!",
        description: "Todas as alterações foram salvas e sincronizadas.",
      })

      setHasUnsavedChanges(false)
    } catch (error) {
      console.error("[v0] Erro completo ao salvar:", error)

      let errorMessage = "Não foi possível salvar o template."
      let errorDescription = "Tente novamente em alguns instantes."

      if (error.message?.includes("network") || error.message?.includes("fetch")) {
        errorMessage = "Erro de Conexão"
        errorDescription = "Verifique sua internet e tente novamente. Suas alterações estão salvas localmente."
      } else if (error.message?.includes("permission") || error.code === "42501") {
        errorMessage = "Sem Permissão"
        errorDescription = "Você não tem permissão para salvar este template. Verifique se está logado."
      } else if (error.code === "PGRST116") {
        errorMessage = "Template Não Encontrado"
        errorDescription = "Este template pode ter sido excluído. Recarregue a página."
      } else if (error.message?.includes("título")) {
        errorMessage = "Dados Inválidos"
        errorDescription = error.message
      } else if (error.message?.includes("elementos")) {
        errorMessage = "Template Vazio"
        errorDescription = error.message
      }

      toast({
        title: errorMessage,
        description: errorDescription,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const copyPublicLink = () => {
    if (!template) return

    const publicUrl = `${window.location.origin}/issue/${template.public_link_id}`
    navigator.clipboard.writeText(publicUrl)
    toast({
      title: "Link copiado!",
      description: "O link público foi copiado para a área de transferência.",
    })
  }

  const openPublicLink = () => {
    if (!template) return

    const publicUrl = `${window.location.origin}/issue/${template.public_link_id}`
    window.open(publicUrl, "_blank")
  }

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando editor...</p>
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Template não encontrado</p>
          <Button onClick={() => router.push("/dashboard/templates")}>Voltar para Templates</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/templates")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-gray-900 truncate">{template.title}</h1>
              </div>
              <Badge variant={template.is_active ? "default" : "secondary"} className="flex-shrink-0">
                {template.is_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              {hasUnsavedChanges && !saving && (
                <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded-md whitespace-nowrap">
                  Alterações não salvas
                </span>
              )}
              <Button variant="outline" size="sm" onClick={copyPublicLink}>
                <Copy className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Copiar Link</span>
              </Button>
              <Button variant="outline" size="sm" onClick={openPublicLink}>
                <ExternalLink className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Abrir Link</span>
              </Button>
              <Button onClick={saveTemplate} disabled={saving || !hasUnsavedChanges}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-2">
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
            <TabsTrigger value="link" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Link Público
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Informações do Template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Template</Label>
                  <Input
                    value={template.title}
                    onChange={(e) => {
                      setTemplate({ ...template, title: e.target.value })
                      setHasUnsavedChanges(true)
                    }}
                    placeholder="Nome do template"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={template.description || ""}
                    onChange={(e) => {
                      setTemplate({ ...template, description: e.target.value })
                      setHasUnsavedChanges(true)
                    }}
                    placeholder="Descrição detalhada do template"
                    rows={4}
                  />
                </div>

                {folders.length > 0 && (
                  <div className="space-y-2">
                    <Label>Pasta</Label>
                    <Select
                      value={template.folder_id || "none"}
                      onValueChange={(value) => {
                        setTemplate({ ...template, folder_id: value === "none" ? null : value })
                        setHasUnsavedChanges(true)
                      }}
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

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">Status do Template</h3>
                    <p className="text-sm text-gray-600">
                      {template.is_active ? "Template ativo e disponível para emissão" : "Template inativo"}
                    </p>
                  </div>
                  <Switch
                    checked={template.is_active}
                    onCheckedChange={(checked) => {
                      setTemplate({ ...template, is_active: checked })
                      setHasUnsavedChanges(true)
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="design" className="mt-4">
            <div className="h-[calc(100vh-180px)]">
              <ProfessionalCertificateEditor
                key={`cert-${template.id}`}
                templateId={params.id}
                initialTemplate={template.template_data}
                onStateChange={handleEditorStateChange}
              />
            </div>
          </TabsContent>

          <TabsContent value="form" className="mt-4">
            <div className="h-[calc(100vh-160px)]">
              <FormDesigner
                key={`form-${template.id}`}
                initialData={template.form_design}
                availablePlaceholders={template.template_data?.placeholders || template.placeholders || []}
                onStateChange={handleFormStateChange}
                templateId={params.id}
              />
            </div>
          </TabsContent>

          <TabsContent value="link" className="mt-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Link Público de Emissão</CardTitle>
                <p className="text-sm text-gray-600">
                  Compartilhe este link para que outras pessoas possam solicitar certificados
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>URL Pública</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/issue/${
                        template.public_link_id
                      }`}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" onClick={copyPublicLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={openPublicLink}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">Como usar o link público:</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>• Compartilhe este link com as pessoas que devem receber certificados</p>
                    <p>• Elas preencherão o formulário personalizado que você configurou</p>
                    <p>• O certificado será gerado automaticamente com os dados fornecidos</p>
                    <p>• O certificado poderá ser baixado imediatamente após a geração</p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <h4 className="font-medium text-blue-900">Dica</h4>
                      <p className="text-sm text-blue-800">
                        Certifique-se de configurar o formulário de emissão na aba "Formulário de Emissão" antes de
                        compartilhar o link público.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

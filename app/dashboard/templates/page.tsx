"use client"

import { Label } from "@/components/ui/label"

import { useEffect, useState, useCallback, useMemo, type DragEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Plus,
  Edit,
  Trash2,
  Copy,
  MoreHorizontal,
  FolderIcon,
  Search,
  LayoutGrid,
  List,
  Home,
  ChevronRight,
  LinkIcon,
  FileText,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/hooks/use-toast"
import DashboardLayout from "@/components/dashboard-layout"
import CreateFolderDialog from "@/components/create-folder-dialog"
import { generatePublicLinkId } from "@/lib/certificate-generator"

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

function useSessionStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue
    try {
      const item = window.sessionStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading sessionStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(key, JSON.stringify(valueToStore))
        }
      } catch (error) {
        console.warn(`Error setting sessionStorage key "${key}":`, error)
      }
    },
    [key, storedValue],
  )

  return [storedValue, setValue] as const
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [currentFolder, setCurrentFolder] = useState<any>(null)
  const [view, setView] = useSessionStorage<"grid" | "list">("templates-view", "grid")
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false)
  const [foldersEnabled, setFoldersEnabled] = useState(false)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [templatesCache, setTemplatesCache] = useState<Map<string, any[]>>(new Map())

  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()

  const fetchData = useCallback(
    async (userId: string, forceRefresh = false) => {
      const cacheKey = currentFolder ? currentFolder.id : "root"

      // Check cache first unless force refresh
      if (!forceRefresh && templatesCache.has(cacheKey)) {
        setTemplates(templatesCache.get(cacheKey) || [])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        // Fetch templates
        const templatesQuery = supabase
          .from("certificate_templates")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })

        if (currentFolder) {
          templatesQuery.eq("folder_id", currentFolder.id)
        } else {
          // When in root, fetch templates without a folder_id
          const { error: folderTableError } = await supabase.from("folders").select("id").limit(1)
          if (!folderTableError) {
            templatesQuery.is("folder_id", null)
          }
        }

        const templatesRes = await templatesQuery
        if (templatesRes.error) throw templatesRes.error

        const fetchedTemplates = templatesRes.data || []
        setTemplates(fetchedTemplates)

        setTemplatesCache((prev) => new Map(prev).set(cacheKey, fetchedTemplates))

        // Fetch folders, but only if not inside a folder view and not already loaded
        if (!currentFolder && folders.length === 0) {
          try {
            const foldersRes = await supabase
              .from("folders")
              .select("*")
              .eq("user_id", userId)
              .order("name", { ascending: true })

            if (foldersRes.error) {
              if (foldersRes.error.message.includes('relation "public.folders" does not exist')) {
                setFoldersEnabled(false)
                setFolders([])
              } else {
                throw foldersRes.error
              }
            } else {
              setFolders(foldersRes.data || [])
              setFoldersEnabled(true)
            }
          } catch (folderError) {
            console.warn("Could not fetch folders:", folderError)
            setFoldersEnabled(false)
            setFolders([])
          }
        }
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          title: "Erro ao carregar dados",
          description: "Verifique se todas as tabelas do banco foram criadas corretamente.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    },
    [currentFolder, templatesCache, folders.length, toast],
  )

  useEffect(() => {
    if (user) {
      fetchData(user.id)
    }
  }, [user, currentFolder, fetchData])

  const handleDuplicate = useCallback(
    async (templateId: string) => {
      const original = templates.find((t) => t.id === templateId)
      if (!original) return

      const { id, created_at, updated_at, public_link_id, ...rest } = original
      const newTemplate = {
        ...rest,
        title: `${original.title} (Cópia)`,
        public_link_id: generatePublicLinkId(),
        is_active: false,
      }

      try {
        const { data, error } = await supabase.from("certificate_templates").insert(newTemplate).select().single()
        if (error) throw error

        const updatedTemplates = [data, ...templates]
        setTemplates(updatedTemplates)

        const cacheKey = currentFolder ? currentFolder.id : "root"
        setTemplatesCache((prev) => new Map(prev).set(cacheKey, updatedTemplates))

        toast({ title: "Template duplicado!" })
      } catch (error) {
        toast({ title: "Erro ao duplicar", variant: "destructive" })
      }
    },
    [templates, currentFolder, toast],
  )

  const handleCopyLink = useCallback(
    (publicLinkId: string) => {
      const url = `${window.location.origin}/issue/${publicLinkId}`
      navigator.clipboard.writeText(url)
      toast({
        title: "Link copiado!",
        description: "O link público foi copiado para a área de transferência.",
      })
    },
    [toast],
  )

  const toggleTemplateStatus = useCallback(
    async (templateId: string, currentStatus: boolean) => {
      try {
        const { error } = await supabase
          .from("certificate_templates")
          .update({ is_active: !currentStatus })
          .eq("id", templateId)
        if (error) throw error

        const updatedTemplates = templates.map((t) => (t.id === templateId ? { ...t, is_active: !currentStatus } : t))
        setTemplates(updatedTemplates)

        const cacheKey = currentFolder ? currentFolder.id : "root"
        setTemplatesCache((prev) => new Map(prev).set(cacheKey, updatedTemplates))

        toast({ title: "Status atualizado" })
      } catch (error) {
        toast({ title: "Erro ao atualizar status", variant: "destructive" })
      }
    },
    [templates, currentFolder, toast],
  )

  const deleteTemplate = useCallback(
    async (templateId: string) => {
      if (!confirm("Tem certeza? Esta ação não pode ser desfeita.")) return
      try {
        const { error } = await supabase.from("certificate_templates").delete().eq("id", templateId)
        if (error) throw error

        const updatedTemplates = templates.filter((t) => t.id !== templateId)
        setTemplates(updatedTemplates)

        const cacheKey = currentFolder ? currentFolder.id : "root"
        setTemplatesCache((prev) => new Map(prev).set(cacheKey, updatedTemplates))

        toast({ title: "Template excluído" })
      } catch (error) {
        toast({ title: "Erro ao excluir", variant: "destructive" })
      }
    },
    [templates, currentFolder, toast],
  )

  const deleteFolder = async (folderId: string) => {
    if (
      !confirm(
        "Tem certeza que deseja excluir esta pasta? Os templates dentro dela não serão excluídos, apenas movidos para a raiz.",
      )
    )
      return

    try {
      // First, move all templates in this folder to root (folder_id = null)
      const { error: moveError } = await supabase
        .from("certificate_templates")
        .update({ folder_id: null })
        .eq("folder_id", folderId)

      if (moveError) throw moveError

      // Then delete the folder
      const { error: deleteError } = await supabase.from("folders").delete().eq("id", folderId)

      if (deleteError) throw deleteError

      setFolders(folders.filter((f) => f.id !== folderId))
      setTemplatesCache(new Map())
      toast({ title: "Pasta excluída", description: "Os templates foram movidos para a raiz." })
    } catch (error) {
      toast({ title: "Erro ao excluir pasta", variant: "destructive" })
    }
  }

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>, folderId: string) => {
      e.preventDefault()
      const templateId = e.dataTransfer.getData("templateId")
      setDragOverFolderId(null)

      if (!templateId || !folderId) return

      try {
        const { error } = await supabase
          .from("certificate_templates")
          .update({ folder_id: folderId })
          .eq("id", templateId)

        if (error) throw error

        const updatedTemplates = templates.filter((t) => t.id !== templateId)
        setTemplates(updatedTemplates)

        const cacheKey = currentFolder ? currentFolder.id : "root"
        setTemplatesCache((prev) => new Map(prev).set(cacheKey, updatedTemplates))

        toast({
          title: "Template movido!",
          description: "O template foi movido para a pasta.",
        })
      } catch (error) {
        toast({ title: "Erro ao mover template", variant: "destructive" })
      }
    },
    [templates, currentFolder, toast],
  )

  const filteredItems = useMemo(() => {
    const lowerSearchTerm = debouncedSearchTerm.toLowerCase()
    const filteredFolders = foldersEnabled ? folders.filter((f) => f.name.toLowerCase().includes(lowerSearchTerm)) : []
    const filteredTemplates = templates.filter((t) => t.title.toLowerCase().includes(lowerSearchTerm))
    return { filteredFolders, filteredTemplates }
  }, [debouncedSearchTerm, foldersEnabled, folders, templates])

  const { filteredFolders, filteredTemplates } = filteredItems

  const renderTemplateCard = useCallback(
    (template: any) => (
      <div
        key={template.id}
        className="border rounded-lg shadow-sm bg-white flex flex-col transition-transform hover:-translate-y-1"
        draggable="true"
        onDragStart={(e) => e.dataTransfer.setData("templateId", template.id)}
      >
        <Link
          href={`/dashboard/templates/edit/${template.id}`}
          className="block aspect-video bg-gray-100 rounded-t-lg relative overflow-hidden group"
        >
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <FileText className="h-16 w-16 text-blue-400" />
          </div>
        </Link>
        <div className="p-4 flex-grow flex flex-col">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold truncate flex-1 pr-2">{template.title}</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => router.push(`/dashboard/templates/edit/${template.id}`)}>
                  <Edit className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleDuplicate(template.id)}>
                  <Copy className="h-4 w-4 mr-2" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleCopyLink(template.public_link_id)}>
                  <LinkIcon className="h-4 w-4 mr-2" /> Copiar Link
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => deleteTemplate(template.id)} className="text-red-500">
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(template.created_at).toLocaleDateString("pt-BR")} • {template.placeholders?.length || 0} campos
          </p>
          <div className="flex-grow" />
          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Switch
                checked={template.is_active}
                onCheckedChange={() => toggleTemplateStatus(template.id, template.is_active)}
                id={`active-${template.id}`}
              />
              <Label htmlFor={`active-${template.id}`} className="text-sm">
                Ativo
              </Label>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Editar"
                onClick={() => router.push(`/dashboard/templates/edit/${template.id}`)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Duplicar"
                onClick={() => handleDuplicate(template.id)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Copiar Link Público"
                onClick={() => handleCopyLink(template.public_link_id)}
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    ),
    [router, handleDuplicate, handleCopyLink, toggleTemplateStatus, deleteTemplate],
  )

  const renderTemplateRow = useCallback(
    (template: any) => (
      <div
        key={template.id}
        className="flex items-center p-2 border-b hover:bg-gray-50"
        draggable="true"
        onDragStart={(e) => e.dataTransfer.setData("templateId", template.id)}
      >
        <div className="w-16 h-10 bg-gray-100 rounded-md relative overflow-hidden mr-4 flex-shrink-0">
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <FileText className="h-6 w-6 text-blue-400" />
          </div>
        </div>
        <div className="flex-grow font-medium truncate">{template.title}</div>
        <div className="w-32 text-sm text-gray-500">{new Date(template.created_at).toLocaleDateString("pt-BR")}</div>
        <div className="w-24">
          <Switch
            checked={template.is_active}
            onCheckedChange={() => toggleTemplateStatus(template.id, template.is_active)}
          />
        </div>
        <div className="w-24 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => router.push(`/dashboard/templates/edit/${template.id}`)}>
                <Edit className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleDuplicate(template.id)}>
                <Copy className="h-4 w-4 mr-2" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleCopyLink(template.public_link_id)}>
                <LinkIcon className="h-4 w-4 mr-2" /> Copiar Link
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => deleteTemplate(template.id)} className="text-red-500">
                <Trash2 className="h-4 w-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    ),
    [router, handleDuplicate, handleCopyLink, toggleTemplateStatus, deleteTemplate],
  )

  const handleFolderNavigation = useCallback((folder: any) => {
    setCurrentFolder(folder)
    // Clear search when navigating to folder
    setSearchTerm("")
  }, [])

  const handleBackToRoot = useCallback(() => {
    setCurrentFolder(null)
    setSearchTerm("")
  }, [])

  return (
    <DashboardLayout>
      {foldersEnabled && (
        <CreateFolderDialog
          open={isFolderDialogOpen}
          onOpenChange={setIsFolderDialogOpen}
          onFolderCreated={() => {
            if (user) {
              setTemplatesCache(new Map())
              fetchData(user.id, true)
            }
          }}
        />
      )}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meus Templates</h1>
          {foldersEnabled && (
            <div className="flex items-center text-sm text-gray-500 mt-2">
              <button onClick={handleBackToRoot} className="hover:underline flex items-center">
                <Home className="h-4 w-4 mr-1" /> Início
              </button>
              {currentFolder && (
                <>
                  <ChevronRight className="h-4 w-4 mx-1" />
                  <span className="font-medium text-gray-700">{currentFolder.name}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={foldersEnabled ? "Buscar em templates e pastas..." : "Buscar templates..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center rounded-md border bg-white">
              <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" onClick={() => setView("grid")}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" onClick={() => setView("list")}>
                <List className="h-4 w-4" />
              </Button>
            </div>
            {foldersEnabled && (
              <Button variant="outline" onClick={() => setIsFolderDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nova Pasta
              </Button>
            )}
            <Link href="/dashboard/templates/create">
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Novo Template
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Carregando templates...</p>
          </div>
        ) : (
          <>
            {foldersEnabled && !currentFolder && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Pastas</h2>
                {filteredFolders.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {filteredFolders.map((folder) => (
                      <div
                        key={folder.id}
                        onDrop={(e) => handleDrop(e, folder.id)}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setDragOverFolderId(folder.id)
                        }}
                        onDragLeave={() => setDragOverFolderId(null)}
                        className={`border rounded-lg transition-all relative group ${
                          dragOverFolderId === folder.id ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white"
                        }`}
                      >
                        <button
                          onClick={() => handleFolderNavigation(folder)}
                          className="flex items-center p-4 w-full h-full text-left"
                        >
                          <FolderIcon className="h-5 w-5 mr-3" style={{ color: folder.color }} />
                          <span className="font-medium truncate">{folder.name}</span>
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => deleteFolder(folder.id)} className="text-red-500">
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir Pasta
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Nenhuma pasta encontrada.</p>
                )}
              </div>
            )}

            <div>
              <h2 className="text-xl font-semibold my-4">
                {currentFolder
                  ? `Templates em ${currentFolder.name}`
                  : foldersEnabled
                    ? "Templates sem pasta"
                    : "Templates"}
              </h2>
              {filteredTemplates.length > 0 ? (
                view === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map(renderTemplateCard)}
                  </div>
                ) : (
                  <div className="bg-white border rounded-lg">
                    <div className="flex items-center p-2 border-b bg-gray-50 text-xs text-gray-500 font-medium">
                      <div className="w-16 mr-4"></div>
                      <div className="flex-grow">Título</div>
                      <div className="w-32">Criação</div>
                      <div className="w-24">Status</div>
                      <div className="w-24 text-right">Ações</div>
                    </div>
                    {filteredTemplates.map(renderTemplateRow)}
                  </div>
                )
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500 mb-4">
                    {debouncedSearchTerm ? "Nenhum template encontrado para sua busca." : "Nenhum template encontrado."}
                  </p>
                  {!debouncedSearchTerm && (
                    <Link href="/dashboard/templates/create">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" /> Criar seu primeiro template
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

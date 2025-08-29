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
import { createClient } from "@/lib/supabase/client"
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

const TEMPLATES_PER_PAGE = 20

const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 2 * 60 * 1000 // 2 minutos

function getCachedData(key: string) {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  if (cached) {
    cache.delete(key)
  }
  return null
}

function setCachedData(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() })
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
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  const [currentPage, setCurrentPage] = useState(0)
  const [hasMoreTemplates, setHasMoreTemplates] = useState(true)

  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()

  const supabase = useMemo(() => createClient(), [])

  const loadData = useCallback(
    async (userId: string, forceRefresh = false, page = 0) => {
      const folderKey = currentFolder ? currentFolder.id : "root"
      const templatesKey = `templates-${folderKey}`
      const foldersKey = "folders"

      console.log(`[v0] LOAD START: folder=${folderKey}, page=${page}, force=${forceRefresh}`)

      // Check cache first
      if (!forceRefresh && page === 0) {
        const cachedTemplates = getCachedData(templatesKey)
        const cachedFolders = !currentFolder ? getCachedData(foldersKey) : null

        if (cachedTemplates) {
          console.log(`[v0] Using cached templates: ${cachedTemplates.length} items`)
          setTemplates(cachedTemplates)
          setHasMoreTemplates(cachedTemplates.length === TEMPLATES_PER_PAGE)
        }

        if (cachedFolders && !currentFolder) {
          console.log(`[v0] Using cached folders: ${cachedFolders.length} items`)
          setFolders(cachedFolders)
          setFoldersEnabled(cachedFolders.length > 0)
        }

        if (cachedTemplates && (currentFolder || cachedFolders)) {
          setLoading(false)
          return
        }
      }

      if (page === 0) {
        setLoading(true)
      }

      try {
        const offset = page * TEMPLATES_PER_PAGE

        const promises = []

        // Templates query
        console.log(`[v0] Fetching templates for folder: ${folderKey}`)
        const templatesQuery = supabase
          .from("certificate_templates")
          .select("id, title, description, is_active, created_at, public_link_id, folder_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range(offset, offset + TEMPLATES_PER_PAGE - 1)

        if (currentFolder) {
          templatesQuery.eq("folder_id", currentFolder.id)
        } else {
          templatesQuery.is("folder_id", null)
        }

        promises.push(templatesQuery)

        if (!currentFolder) {
          console.log(`[v0] Fetching folders - always attempt when not in specific folder`)

          // Try folders table first
          const foldersQuery1 = supabase
            .from("folders")
            .select("id, name, color")
            .eq("user_id", userId)
            .order("name", { ascending: true })

          promises.push(foldersQuery1)
        }

        const results = await Promise.allSettled(promises)

        // Process templates result
        const templatesResult = results[0]
        if (templatesResult.status === "fulfilled") {
          const { data: templatesData, error: templatesError } = templatesResult.value

          if (templatesError) {
            console.error("[v0] Templates query error:", templatesError)
            throw templatesError
          }

          console.log(`[v0] Templates loaded: ${templatesData?.length || 0} items`)

          if (page === 0) {
            setTemplates(templatesData || [])
            setCachedData(templatesKey, templatesData || [])
          } else {
            const newTemplates = [...templates, ...(templatesData || [])]
            setTemplates(newTemplates)
            setCachedData(templatesKey, newTemplates)
          }

          setHasMoreTemplates((templatesData?.length || 0) === TEMPLATES_PER_PAGE)
        } else {
          console.error("[v0] Templates query failed:", templatesResult.reason)
          throw templatesResult.reason
        }

        if (!currentFolder && results.length > 1) {
          const foldersResult = results[1]
          let foldersData = null
          let foldersError = null

          if (foldersResult.status === "fulfilled") {
            foldersData = foldersResult.value.data
            foldersError = foldersResult.value.error
          } else {
            foldersError = foldersResult.reason
          }

          if (foldersError) {
            console.log("[v0] Folders table error, trying template_folders:", foldersError)
            // Fallback to template_folders
            try {
              const result = await supabase
                .from("template_folders")
                .select("id, name, color")
                .eq("user_id", userId)
                .order("name", { ascending: true })

              foldersData = result.data
              foldersError = result.error

              if (foldersError) {
                console.error("[v0] template_folders query error:", foldersError)
              } else {
                console.log(`[v0] Folders loaded from template_folders: ${foldersData?.length || 0} items`)
              }
            } catch (fallbackError) {
              console.error("[v0] Fallback folders query failed:", fallbackError)
              foldersError = fallbackError
            }
          } else {
            console.log(`[v0] Folders loaded from folders table: ${foldersData?.length || 0} items`)
          }

          if (!foldersError) {
            setFolders(foldersData || [])
            setFoldersEnabled((foldersData?.length || 0) > 0)
            setCachedData(foldersKey, foldersData || [])
            console.log(
              `[v0] Final folders state: ${foldersData?.length || 0} folders, enabled: ${(foldersData?.length || 0) > 0}`,
            )
          } else {
            console.error("[v0] All folders queries failed:", foldersError)
            setFolders([])
            setFoldersEnabled(false)
            setCachedData(foldersKey, [])
          }
        }
      } catch (error) {
        console.error("[v0] Load data error:", error)
        toast({
          title: "Erro ao carregar dados",
          description: "Tente recarregar a página.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
        console.log(`[v0] Load complete: folder=${folderKey}`)
      }
    },
    [currentFolder, supabase, toast], // Removido templates das dependências
  )

  useEffect(() => {
    if (user) {
      console.log(`[v0] User effect: Loading data for user ${user.id}`)
      setCurrentPage(0)
      loadData(user.id)
    }
  }, [user, currentFolder?.id, loadData])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedFolderId = sessionStorage.getItem("currentFolderId")
      const savedFolderName = sessionStorage.getItem("currentFolderName")

      if (savedFolderId && savedFolderName && !currentFolder) {
        // Restaurar pasta atual após retorno do editor
        setCurrentFolder({ id: savedFolderId, name: savedFolderName })
        // Limpar sessionStorage após uso
        sessionStorage.removeItem("currentFolderId")
        sessionStorage.removeItem("currentFolderName")
      }
    }
  }, [currentFolder])

  const handleFolderNavigation = useCallback((folder: any) => {
    console.log(`[v0] Navigating to folder: ${folder.name}`)
    setCurrentFolder(folder)
    setCurrentPage(0)
    setSearchTerm("")
  }, [])

  const loadMoreTemplates = useCallback(() => {
    if (user && hasMoreTemplates && !loading) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      loadData(user.id, false, nextPage)
    }
  }, [user, hasMoreTemplates, loading, currentPage, loadData])

  const handleDuplicate = useCallback(
    async (templateId: string) => {
      console.log(`[v0] DUPLICATE START: template=${templateId}`)

      setDuplicatingId(templateId)

      if (!user) {
        console.error("[v0] Duplicate error: No user found")
        toast({ title: "Erro: usuário não encontrado", variant: "destructive" })
        setDuplicatingId(null)
        return
      }

      try {
        const { data: originalData, error: fetchError } = await supabase
          .from("certificate_templates")
          .select("*")
          .eq("id", templateId)
          .eq("user_id", user.id)
          .single()

        if (fetchError) {
          console.error("[v0] Duplicate fetch error:", fetchError)
          if (fetchError.code === "PGRST116") {
            throw new Error("Template não encontrado ou você não tem permissão para acessá-lo")
          }
          throw fetchError
        }

        if (!originalData) {
          console.error("[v0] Duplicate error: Template not found")
          toast({ title: "Template não encontrado", variant: "destructive" })
          setDuplicatingId(null)
          return
        }

        console.log(`[v0] DUPLICATE ORIGINAL: Found template "${originalData.title}"`)

        const { id, created_at, updated_at, public_link_id, ...rest } = originalData
        const newTemplate = {
          ...rest,
          title: `${originalData.title} (Cópia)`,
          public_link_id: generatePublicLinkId(),
          is_active: false,
          user_id: user.id, // Explicitamente definir user_id para RLS
        }

        console.log(`[v0] DUPLICATE NEW TEMPLATE: Creating copy with title "${newTemplate.title}"`)

        const { data, error } = await supabase.from("certificate_templates").insert(newTemplate).select().single()

        if (error) {
          console.error("[v0] Duplicate insert error:", error)

          if (error.code === "42501" || error.message.includes("row-level security")) {
            throw new Error("Sem permissão para criar template. Verifique se está logado corretamente.")
          } else if (error.code === "23505") {
            throw new Error("Erro de duplicação: dados conflitantes. Tente novamente.")
          } else if (error.message.includes("violates not-null constraint")) {
            throw new Error("Dados obrigatórios em falta. Template original pode estar corrompido.")
          }

          throw error
        }

        console.log(`[v0] DUPLICATE SUCCESS: ${data.id}`)

        const updatedTemplates = [data, ...templates]
        setTemplates(updatedTemplates)

        const cacheKey = `templates-${currentFolder ? currentFolder.id : "root"}`
        setCachedData(cacheKey, updatedTemplates)

        toast({
          title: "✅ Template duplicado com sucesso!",
          description: `"${data.title}" foi criado e está pronto para edição.`,
        })
      } catch (error: any) {
        console.error("[v0] Duplicate error:", error.message || error)

        let errorMessage = "Erro ao duplicar template"
        let errorDescription = "Tente novamente em alguns instantes."

        if (error.message?.includes("permissão") || error.message?.includes("row-level security")) {
          errorMessage = "Sem Permissão"
          errorDescription = "Você não tem permissão para duplicar este template. Faça login novamente."
        } else if (error.message?.includes("não encontrado")) {
          errorMessage = "Template Não Encontrado"
          errorDescription = error.message
        } else if (error.message?.includes("conflitantes")) {
          errorMessage = "Erro de Duplicação"
          errorDescription = error.message
        } else if (error.message?.includes("corrompido")) {
          errorMessage = "Template Corrompido"
          errorDescription = error.message
        }

        toast({
          title: errorMessage,
          description: errorDescription,
          variant: "destructive",
        })
      } finally {
        setDuplicatingId(null)
      }
    },
    [templates, currentFolder, toast, supabase, user],
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
      // Optimistic update
      const updatedTemplates = templates.map((t) => (t.id === templateId ? { ...t, is_active: !currentStatus } : t))
      setTemplates(updatedTemplates)

      try {
        const { error } = await supabase
          .from("certificate_templates")
          .update({ is_active: !currentStatus })
          .eq("id", templateId)
        if (error) throw error

        const cacheKey = `templates-${currentFolder ? currentFolder.id : "root"}`
        cache.delete(cacheKey)

        toast({ title: "Status atualizado" })
      } catch (error) {
        console.error("[v0] Toggle status error:", error)
        // Revert optimistic update on error
        setTemplates(templates)
        toast({ title: "Erro ao atualizar status", variant: "destructive" })
      }
    },
    [templates, currentFolder, toast, supabase],
  )

  const deleteTemplate = useCallback(
    async (templateId: string) => {
      if (!confirm("Tem certeza? Esta ação não pode ser desfeita.")) return
      try {
        const { error } = await supabase.from("certificate_templates").delete().eq("id", templateId)
        if (error) throw error

        const updatedTemplates = templates.filter((t) => t.id !== templateId)
        setTemplates(updatedTemplates)

        const cacheKey = `templates-${currentFolder ? currentFolder.id : "root"}`
        cache.delete(cacheKey)

        toast({ title: "Template excluído" })
      } catch (error) {
        console.error("[v0] Delete template error:", error)
        toast({ title: "Erro ao excluir", variant: "destructive" })
      }
    },
    [templates, currentFolder, toast, supabase],
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
        .eq("id", folderId)

      if (moveError) throw moveError

      let deleteSuccess = false

      // Try folders table first
      const { error: deleteError1 } = await supabase.from("folders").delete().eq("id", folderId)
      if (!deleteError1) {
        deleteSuccess = true
        console.log("[v0] Deleted folder from 'folders' table")
      } else {
        console.log("[v0] Failed to delete from 'folders' table, trying template_folders:", deleteError1)

        // Fallback to template_folders
        const { error: deleteError2 } = await supabase.from("template_folders").delete().eq("id", folderId)
        if (!deleteError2) {
          deleteSuccess = true
          console.log("[v0] Deleted folder from 'template_folders' table")
        } else {
          console.error("[v0] Failed to delete from both tables:", deleteError2)
          throw deleteError2
        }
      }

      if (deleteSuccess) {
        setFolders(folders.filter((f) => f.id !== folderId))

        cache.delete("folders")
        cache.delete(`templates-${folderId}`)

        toast({ title: "Pasta excluída", description: "Os templates foram movidos para a raiz." })
      }
    } catch (error) {
      console.error("[v0] Error deleting folder:", error)
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

        const currentCacheKey = `templates-${currentFolder ? currentFolder.id : "root"}`
        const targetCacheKey = `templates-${folderId}`
        cache.delete(currentCacheKey)
        cache.delete(targetCacheKey)

        toast({
          title: "Template movido!",
          description: "O template foi movido para a pasta.",
        })
      } catch (error) {
        console.error("[v0] Move template error:", error)
        toast({ title: "Erro ao mover template", variant: "destructive" })
      }
    },
    [templates, currentFolder, toast, supabase],
  )

  const navigateToTemplate = useCallback(
    (templateId: string, folderId?: string | null) => {
      const params = new URLSearchParams()
      if (folderId) {
        params.set("returnToFolder", folderId)
      }
      const url = `/dashboard/templates/edit/${templateId}${params.toString() ? `?${params.toString()}` : ""}`
      router.push(url)
    },
    [router],
  )

  const createTemplateUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (currentFolder) {
      params.set("fromFolder", currentFolder.id)
    }
    return `/dashboard/templates/create${params.toString() ? `?${params.toString()}` : ""}`
  }, [currentFolder])

  const filteredItems = useMemo(() => {
    const lowerSearchTerm = debouncedSearchTerm.toLowerCase()

    if (!lowerSearchTerm) {
      return { filteredFolders: folders, filteredTemplates: templates }
    }

    const filteredFolders = foldersEnabled ? folders.filter((f) => f.name.toLowerCase().includes(lowerSearchTerm)) : []
    const filteredTemplates = templates.filter(
      (t) => t.title.toLowerCase().includes(lowerSearchTerm) || t.description?.toLowerCase().includes(lowerSearchTerm),
    )

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
        <button
          onClick={() => navigateToTemplate(template.id, template.folder_id)}
          className="block aspect-video bg-gray-100 rounded-t-lg relative overflow-hidden group"
        >
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <FileText className="h-16 w-16 text-blue-400" />
          </div>
        </button>
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
                <DropdownMenuItem onSelect={() => navigateToTemplate(template.id, template.folder_id)}>
                  <Edit className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => handleDuplicate(template.id)}
                  disabled={duplicatingId === template.id}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {duplicatingId === template.id ? "Duplicando..." : "Duplicar"}
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
                onClick={() => navigateToTemplate(template.id, template.folder_id)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Duplicar"
                onClick={() => handleDuplicate(template.id)}
                disabled={duplicatingId === template.id}
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
    [navigateToTemplate, handleDuplicate, handleCopyLink, toggleTemplateStatus, deleteTemplate, duplicatingId],
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
              <DropdownMenuItem onSelect={() => navigateToTemplate(template.id, template.folder_id)}>
                <Edit className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleDuplicate(template.id)} disabled={duplicatingId === template.id}>
                <Copy className="h-4 w-4 mr-2" />
                {duplicatingId === template.id ? "Duplicando..." : "Duplicar"}
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
    [navigateToTemplate, handleDuplicate, handleCopyLink, toggleTemplateStatus, deleteTemplate, duplicatingId],
  )

  const handleBackToRoot = useCallback(() => {
    setCurrentFolder(null)
    setCurrentPage(0)
    setSearchTerm("")
  }, [])

  const renderFolderSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border rounded-lg bg-white animate-pulse">
          <div className="flex items-center p-4">
            <div className="h-5 w-5 bg-gray-200 rounded mr-3"></div>
            <div className="h-4 bg-gray-200 rounded flex-1"></div>
          </div>
        </div>
      ))}
    </div>
  )

  const renderTemplateSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border rounded-lg bg-white animate-pulse">
          <div className="aspect-video bg-gray-200 rounded-t-lg"></div>
          <div className="p-4 space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <DashboardLayout>
      {foldersEnabled && (
        <CreateFolderDialog
          open={isFolderDialogOpen}
          onOpenChange={setIsFolderDialogOpen}
          onFolderCreated={() => {
            if (user) {
              cache.delete("folders")
              loadData(user.id, true)
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
            <Link href={createTemplateUrl}>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Novo Template
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="space-y-8">
            {!currentFolder && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Pastas</h2>
                {renderFolderSkeleton()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold mb-4">Templates</h2>
              {renderTemplateSkeleton()}
            </div>
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
                        className={`border rounded-lg transition-all relative group hover:shadow-md ${
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
                <>
                  {view === "grid" ? (
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
                  )}

                  {hasMoreTemplates && !debouncedSearchTerm && (
                    <div className="text-center mt-6">
                      <Button variant="outline" onClick={loadMoreTemplates} disabled={loading}>
                        {loading ? "Carregando..." : "Carregar mais templates"}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500 mb-4">
                    {debouncedSearchTerm ? "Nenhum template encontrado para sua busca." : "Nenhum template encontrado."}
                  </p>
                  {!debouncedSearchTerm && (
                    <Link href={createTemplateUrl}>
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

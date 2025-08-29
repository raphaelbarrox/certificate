"use client"

import { Label } from "@/components/ui/label"

import { useEffect, useState, useCallback, useMemo, useRef, type DragEvent } from "react"
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
const FOLDERS_PER_PAGE = 15

const globalCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 2 * 60 * 1000 // 2 minutos para cache mais agressivo

function getCachedData(key: string) {
  const cached = globalCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  globalCache.delete(key)
  return null
}

function setCachedData(key: string, data: any) {
  globalCache.set(key, { data, timestamp: Date.now() })
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([])
  const [folders, setFolders] = useState<any[]>([])
  const [currentFolder, setCurrentFolder] = useState<any>(null)
  const [view, setView] = useSessionStorage<"grid" | "list">("templates-view", "grid")
  const [loading, setLoading] = useState(true)
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false)
  const [foldersEnabled, setFoldersEnabled] = useState(false)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)

  const templatesCache = useRef<Map<string, any[]>>(new Map())
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMoreTemplates, setHasMoreTemplates] = useState(true)

  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()

  const supabase = useMemo(() => createClient(), [])

  const prefetchFolderData = useCallback(
    async (folderId: string, userId: string) => {
      const cacheKey = `folder-${folderId}`
      if (getCachedData(cacheKey)) return

      try {
        console.log(`[v0] Prefetching folder: ${folderId}`)

        // Query otimizada com apenas campos essenciais
        const { data, error } = await supabase
          .from("certificate_templates")
          .select("id, title, is_active, created_at, public_link_id, folder_id")
          .eq("user_id", userId)
          .eq("folder_id", folderId)
          .order("created_at", { ascending: false })
          .limit(TEMPLATES_PER_PAGE)

        if (!error && data) {
          setCachedData(cacheKey, data)
          templatesCache.current.set(folderId, data)
          console.log(`[v0] Prefetched ${data.length} templates for folder ${folderId}`)
        }
      } catch (error) {
        console.error(`[v0] Prefetch failed for folder ${folderId}:`, error)
      }
    },
    [supabase],
  )

  const fetchData = useCallback(
    async (userId: string, forceRefresh = false, page = 0) => {
      const cacheKey = currentFolder ? currentFolder.id : "root"
      const offset = page * TEMPLATES_PER_PAGE

      console.log(`[v0] Fetching data - folder: ${cacheKey}, page: ${page}, forceRefresh: ${forceRefresh}`)

      // Verificar cache primeiro para carregamento instantâneo
      if (!forceRefresh && page === 0) {
        const cachedTemplates = getCachedData(`templates-${cacheKey}`)
        const cachedFolders = getCachedData("folders")

        if (cachedTemplates) {
          console.log(`[v0] Using cached templates for ${cacheKey}`)
          setTemplates(cachedTemplates)
          setHasMoreTemplates(cachedTemplates.length === TEMPLATES_PER_PAGE)
        }

        if (cachedFolders && !currentFolder) {
          console.log(`[v0] Using cached folders`)
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
        setTemplatesLoading(true)
        if (!currentFolder) setFoldersLoading(true)
      }

      try {
        const queries: Promise<any>[] = []

        // Query otimizada para templates com apenas campos necessários
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

        queries.push(templatesQuery)

        // Carregar folders apenas se necessário e em paralelo
        if (!currentFolder && (folders.length === 0 || forceRefresh)) {
          // Tentar ambas as tabelas em paralelo
          queries.push(
            supabase
              .from("folders")
              .select("id, name, color")
              .eq("user_id", userId)
              .order("name", { ascending: true })
              .limit(FOLDERS_PER_PAGE),
          )

          queries.push(
            supabase
              .from("template_folders")
              .select("id, name, color")
              .eq("user_id", userId)
              .order("name", { ascending: true })
              .limit(FOLDERS_PER_PAGE),
          )
        }

        const results = await Promise.allSettled(queries)

        // Processar templates
        const templatesResult = results[0]
        if (templatesResult.status === "fulfilled" && !templatesResult.value.error) {
          const fetchedTemplates = templatesResult.value.data || []
          const hasMore = fetchedTemplates.length === TEMPLATES_PER_PAGE

          if (page === 0) {
            setTemplates(fetchedTemplates)
            setCachedData(`templates-${cacheKey}`, fetchedTemplates)
          } else {
            const newTemplates = [...templates, ...fetchedTemplates]
            setTemplates(newTemplates)
            setCachedData(`templates-${cacheKey}`, newTemplates)
          }

          setHasMoreTemplates(hasMore)
          templatesCache.current.set(cacheKey, fetchedTemplates)

          console.log(`[v0] Loaded ${fetchedTemplates.length} templates for ${cacheKey}`)
        }

        // Processar folders se necessário
        if (results.length > 1) {
          let foldersData: any[] = []

          // Tentar resultado da tabela 'folders' primeiro
          const foldersResult = results[1]
          if (foldersResult.status === "fulfilled" && !foldersResult.value.error) {
            foldersData = foldersResult.value.data || []
            console.log(`[v0] Loaded ${foldersData.length} folders from 'folders' table`)
          } else if (results.length > 2) {
            // Fallback para 'template_folders'
            const templateFoldersResult = results[2]
            if (templateFoldersResult.status === "fulfilled" && !templateFoldersResult.value.error) {
              foldersData = templateFoldersResult.value.data || []
              console.log(`[v0] Loaded ${foldersData.length} folders from 'template_folders' table`)
            }
          }

          if (foldersData.length > 0) {
            setFolders(foldersData)
            setFoldersEnabled(true)
            setCachedData("folders", foldersData)

            const prefetchPromises = foldersData.map((folder: any) => prefetchFolderData(folder.id, userId))
            Promise.all(prefetchPromises).then(() => {
              console.log(`[v0] Completed prefetch for ${prefetchPromises.length} folders`)
            })
          } else {
            setFoldersEnabled(false)
            setFolders([])
          }
        }
      } catch (error) {
        console.error("[v0] Error loading data:", error)
        toast({
          title: "Erro ao carregar dados",
          description: "Tente recarregar a página.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
        setTemplatesLoading(false)
        setFoldersLoading(false)
      }
    },
    [currentFolder, supabase, toast, prefetchFolderData, templates],
  )

  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false)

  const loadMoreTemplates = useCallback(() => {
    if (user && hasMoreTemplates && !loading) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      fetchData(user.id, false, nextPage)
    }
  }, [user, hasMoreTemplates, loading, currentPage, fetchData])

  useEffect(() => {
    if (user) {
      setCurrentPage(0)
      fetchData(user.id)
    }
  }, [user, currentFolder]) // Removendo fetchData das dependências

  const handleFolderNavigation = useCallback(
    (folder: any) => {
      console.log(`[v0] Navigating to folder: ${folder.name}`)

      // Verificar cache primeiro para navegação instantânea
      const cached = templatesCache.current.get(folder.id) || getCachedData(`folder-${folder.id}`)
      if (cached) {
        console.log(`[v0] Instant navigation using cached data for: ${folder.name}`)
        setTemplates(cached)
        setHasMoreTemplates(cached.length === TEMPLATES_PER_PAGE)
        setCurrentFolder(folder)
        setCurrentPage(0)
        setSearchTerm("")
        return
      }

      // Carregamento com loading state se não tiver cache
      setCurrentFolder(folder)
      setCurrentPage(0)
      setSearchTerm("")
      setTemplatesLoading(true)

      // Carregar dados imediatamente
      if (user) {
        fetchData(user.id, false, 0)
      }
    },
    [user, fetchData],
  )

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
        globalCache.delete(`templates-${cacheKey}`)
        const cached = templatesCache.current.get(cacheKey)
        if (cached) {
          templatesCache.current.set(cacheKey, {
            ...cached,
            data: [data, ...cached.data],
          })
        }

        toast({ title: "Template duplicado!" })
      } catch (error) {
        toast({ title: "Erro ao duplicar", variant: "destructive" })
      }
    },
    [templates, currentFolder, toast, supabase],
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

        const cacheKey = currentFolder ? currentFolder.id : "root"
        globalCache.delete(`templates-${cacheKey}`)
        const cached = templatesCache.current.get(cacheKey)
        if (cached) {
          templatesCache.current.set(cacheKey, {
            ...cached,
            data: cached.data.map((t) => (t.id === templateId ? { ...t, is_active: !currentStatus } : t)),
          })
        }

        toast({ title: "Status atualizado" })
      } catch (error) {
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

        const cacheKey = currentFolder ? currentFolder.id : "root"
        globalCache.delete(`templates-${cacheKey}`)
        const cached = templatesCache.current.get(cacheKey)
        if (cached) {
          templatesCache.current.set(cacheKey, {
            ...cached,
            data: cached.data.filter((t) => t.id !== templateId),
          })
        }

        toast({ title: "Template excluído" })
      } catch (error) {
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
        .eq("folder_id", folderId)

      if (moveError) throw moveError

      let deleteSuccess = false

      // Tentar deletar da tabela 'folders' primeiro
      const { error: deleteError1 } = await supabase.from("folders").delete().eq("id", folderId)
      if (!deleteError1) {
        deleteSuccess = true
        console.log("[v0] Deleted folder from 'folders' table")
      } else {
        console.log("[v0] Failed to delete from 'folders' table:", deleteError1)

        // Se falhar, tentar deletar da tabela 'template_folders'
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

        globalCache.delete("folders")
        globalCache.delete(`templates-${folderId}`)
        templatesCache.current.clear()

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

        const currentCacheKey = currentFolder ? currentFolder.id : "root"
        globalCache.delete(`templates-${currentCacheKey}`)
        globalCache.delete(`templates-${folderId}`)

        templatesCache.current.delete(currentCacheKey)
        templatesCache.current.delete(folderId)

        toast({
          title: "Template movido!",
          description: "O template foi movido para a pasta.",
        })
      } catch (error) {
        toast({ title: "Erro ao mover template", variant: "destructive" })
      }
    },
    [templates, currentFolder, toast, supabase],
  )

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
              globalCache.delete("folders")
              templatesCache.current.clear()
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

        {loading && currentPage === 0 ? (
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
                {foldersLoading ? (
                  renderFolderSkeleton()
                ) : filteredFolders.length > 0 ? (
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
                        onMouseEnter={() => {
                          if (user && !templatesCache.current.has(folder.id)) {
                            prefetchFolderData(folder.id, user.id)
                          }
                        }}
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
              {templatesLoading && currentPage === 0 ? (
                renderTemplateSkeleton()
              ) : filteredTemplates.length > 0 ? (
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

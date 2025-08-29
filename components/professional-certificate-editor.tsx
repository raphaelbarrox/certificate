"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Type,
  ImageIcon,
  Trash2,
  Plus,
  Upload,
  Eye,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Layers,
  Tag,
  Palette,
  Move,
  QrCode,
  Mail,
  CalendarDays,
  Hash,
  Loader,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CertificateElement {
  id: string
  type: "text" | "placeholder" | "image" | "image-placeholder" | "qrcode"
  content: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontWeight: "normal" | "bold"
  fontStyle: "normal" | "italic"
  textDecoration: "none" | "underline"
  color: string
  backgroundColor: string
  textAlign: "left" | "center" | "right"
  rotation: number
  opacity: number
  borderWidth: number
  borderColor: string
  borderRadius: number
  placeholderId?: string
  imageUrl?: string
  zIndex: number
}

interface ProfessionalEditorProps {
  templateId: string
  onStateChange: (template: any, hasUnsavedChanges: boolean) => void
  initialTemplate?: {
    elements?: CertificateElement[]
    backgroundImage?: string
    backgroundColor?: string
    placeholders?: Array<{ id: string; label: string; type?: "text" | "image" }>
    canvasSize?: { width: number; height: number }
    // Legacy support
    background_image?: string
    background_color?: string
    canvas_width?: number
    canvas_height?: number
  }
}

const FONT_FAMILIES = [
  { label: "Helvetica", value: "helvetica" },
  { label: "Helvetica Bold", value: "helvetica-bold" },
  { label: "Helvetica Oblique", value: "helvetica-oblique" },
  { label: "Helvetica Bold Oblique", value: "helvetica-boldoblique" },
  { label: "Times Roman", value: "times-roman" },
  { label: "Times Bold", value: "times-bold" },
  { label: "Times Italic", value: "times-italic" },
  { label: "Times Bold Italic", value: "times-bolditalic" },
  { label: "Courier", value: "courier" },
  { label: "Courier Bold", value: "courier-bold" },
  { label: "Courier Oblique", value: "courier-oblique" },
  { label: "Courier Bold Oblique", value: "courier-boldoblique" },
  { label: "Symbol", value: "symbol" },
  { label: "ZapfDingbats", value: "zapfdingbats" },
]

export function ProfessionalCertificateEditor({ onStateChange, initialTemplate, templateId }: ProfessionalEditorProps) {
  const [elements, setElements] = useState<CertificateElement[]>([])
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)
  const [backgroundColor, setBackgroundColor] = useState("#ffffff")
  const [placeholders, setPlaceholders] = useState<Array<{ id: string; label: string; type?: "text" | "image" }>>([])
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 850 })
  const [newPlaceholder, setNewPlaceholder] = useState({ id: "", label: "" })
  const [newImagePlaceholder, setNewImagePlaceholder] = useState({ id: "", label: "" })

  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string>("")
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showPreview, setShowPreview] = useState(false)
  const [zoom, setZoom] = useState(0.8)
  const [isInitialized, setIsInitialized] = useState(false)

  const localStorageKey = `editor-state-${templateId}`
  const [lastSavedState, setLastSavedState] = useState<string>("")
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved")

  const canvasRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const measurementDivRef = useRef<HTMLDivElement | null>(null)
  const { toast } = useToast()

  // Setup a single measurement div to avoid creating/destroying elements on each check
  useEffect(() => {
    const div = document.createElement("div")
    Object.assign(div.style, {
      position: "absolute",
      visibility: "hidden",
      left: "-9999px",
      whiteSpace: "pre-wrap",
      wordWrap: "break-word",
      boxSizing: "border-box",
      lineHeight: "normal",
    })
    document.body.appendChild(div)
    measurementDivRef.current = div

    return () => {
      if (measurementDivRef.current) {
        document.body.removeChild(measurementDivRef.current)
      }
    }
  }, [])

  // Initialization: Load from localStorage or initialTemplate
  useEffect(() => {
    if (isInitialized) return

    const savedStateJSON = localStorage.getItem(localStorageKey)
    let restored = false
    if (savedStateJSON) {
      try {
        const savedState = JSON.parse(savedStateJSON)
        setElements(savedState.elements || [])
        setBackgroundImage(savedState.backgroundImage || null)
        setBackgroundColor(savedState.backgroundColor || "#ffffff")
        setPlaceholders(savedState.placeholders || [])
        setCanvasSize(savedState.canvasSize || { width: 1200, height: 850 })
        restored = true
        console.log("Editor state restored from localStorage.")
      } catch (e) {
        console.error("Failed to parse saved state, using initial template.", e)
        localStorage.removeItem(localStorageKey) // Clear corrupted data
      }
    }

    if (!restored && initialTemplate) {
      setElements(initialTemplate.elements || [])
      setBackgroundImage(initialTemplate.background_image || initialTemplate.backgroundImage || null)
      setBackgroundColor(initialTemplate.background_color || initialTemplate.backgroundColor || "#ffffff")
      setPlaceholders(
        initialTemplate.placeholders?.map((p) => ({ id: p.id, label: p.label, type: p.type || "text" })) || [],
      )
      setCanvasSize(
        initialTemplate.canvasSize || {
          width: initialTemplate.canvas_width || 1200,
          height: initialTemplate.canvas_height || 850,
        },
      )
    }

    setIsInitialized(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplate, localStorageKey, isInitialized])

  const hasRealChanges = useCallback(
    (currentState: any) => {
      const currentStateString = JSON.stringify({
        elements: currentState.elements?.sort((a: any, b: any) => a.id.localeCompare(b.id)),
        backgroundImage: currentState.backgroundImage,
        backgroundColor: currentState.backgroundColor,
        placeholders: currentState.placeholders?.sort((a: any, b: any) => a.id.localeCompare(b.id)),
        canvasSize: currentState.canvasSize,
      })

      return currentStateString !== lastSavedState
    },
    [lastSavedState],
  )

  useEffect(() => {
    if (!isInitialized) return

    const currentState = {
      elements: elements.sort((a, b) => a.zIndex - b.zIndex),
      backgroundImage,
      backgroundColor,
      placeholders,
      canvasSize,
    }

    // Só processa se houver mudanças reais
    if (!hasRealChanges(currentState)) {
      return
    }

    setSaveStatus("unsaved")

    // Debounce inteligente: 2 segundos para mudanças normais, 5 segundos para mudanças grandes
    const stateSize = JSON.stringify(currentState).length
    const debounceTime = stateSize > 100000 ? 5000 : 2000 // 100KB threshold

    const handler = setTimeout(async () => {
      setSaveStatus("saving")

      try {
        const stateString = JSON.stringify(currentState)
        const currentSize = new Blob([stateString]).size

        console.log("[v0] Iniciando autosave:", {
          size: `${(currentSize / 1024).toFixed(2)}KB`,
          elements: elements.length,
          hasBackground: !!backgroundImage,
        })

        if (currentSize > 3 * 1024 * 1024) {
          // 3MB limit
          console.log("[v0] Estado grande detectado, limpando dados antigos")

          // Limpar estados antigos de outros templates
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith("editor-state-") && key !== localStorageKey) {
              localStorage.removeItem(key)
            }
          })

          // Limpar outros dados desnecessários
          Object.keys(localStorage).forEach((key) => {
            if (key.includes("formData-") || key.includes("formPreviews-")) {
              const keyAge = Date.now() - Number.parseInt(key.split("-").pop() || "0")
              if (keyAge > 7 * 24 * 60 * 60 * 1000) {
                // 7 dias
                localStorage.removeItem(key)
              }
            }
          })
        }

        // Tentar salvar no localStorage
        try {
          localStorage.setItem(localStorageKey, stateString)
          setLastSavedState(
            JSON.stringify({
              elements: currentState.elements?.sort((a: any, b: any) => a.id.localeCompare(b.id)),
              backgroundImage: currentState.backgroundImage,
              backgroundColor: currentState.backgroundColor,
              placeholders: currentState.placeholders?.sort((a: any, b: any) => a.id.localeCompare(b.id)),
              canvasSize: currentState.canvasSize,
            }),
          )

          console.log("[v0] Autosave local concluído com sucesso")
          setSaveStatus("saved")
        } catch (storageError) {
          console.error("[v0] Erro no localStorage:", storageError)

          if (storageError.name === "QuotaExceededError") {
            try {
              // Limpar TUDO exceto o estado atual
              const currentData = localStorage.getItem(localStorageKey)
              localStorage.clear()
              if (currentData) {
                localStorage.setItem(localStorageKey, currentData)
              }

              // Tentar salvar novamente
              localStorage.setItem(localStorageKey, stateString)
              setLastSavedState(
                JSON.stringify({
                  elements: currentState.elements?.sort((a: any, b: any) => a.id.localeCompare(b.id)),
                  backgroundImage: currentState.backgroundImage,
                  backgroundColor: currentState.backgroundColor,
                  placeholders: currentState.placeholders?.sort((a: any, b: any) => a.id.localeCompare(b.id)),
                  canvasSize: currentState.canvasSize,
                }),
              )

              console.log("[v0] Recuperação de quota bem-sucedida")
              setSaveStatus("saved")

              toast({
                title: "Espaço Liberado",
                description: "Dados antigos foram removidos. Suas alterações estão seguras.",
              })
            } catch (retryError) {
              console.error("[v0] Falha na recuperação:", retryError)
              setSaveStatus("unsaved")

              toast({
                title: "Aviso de Armazenamento",
                description: "Espaço local limitado. Salve no banco de dados regularmente.",
                variant: "destructive",
              })
            }
          } else {
            setSaveStatus("unsaved")
            console.error("[v0] Erro inesperado no localStorage:", storageError)
          }
        }

        try {
          onStateChange(currentState, true)
        } catch (parentError) {
          console.warn("[v0] Erro ao notificar componente pai:", parentError)
          // Não falhar o autosave por causa disso
        }
      } catch (error) {
        console.error("[v0] Erro geral no autosave:", error)
        setSaveStatus("unsaved")
      }
    }, debounceTime)

    return () => {
      clearTimeout(handler)
    }
  }, [
    elements,
    backgroundImage,
    backgroundColor,
    placeholders,
    canvasSize,
    localStorageKey,
    onStateChange,
    isInitialized,
    hasRealChanges,
    lastSavedState,
    toast,
  ])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === "unsaved") {
        e.preventDefault()
        e.returnValue = "Você tem alterações não salvas. Deseja realmente sair?"
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && saveStatus === "unsaved") {
        // Força um save rápido quando a página fica oculta
        const currentState = {
          elements: elements.sort((a, b) => a.zIndex - b.zIndex),
          backgroundImage,
          backgroundColor,
          placeholders,
          canvasSize,
        }

        try {
          localStorage.setItem(localStorageKey, JSON.stringify(currentState))
          console.log("[v0] Save de emergência realizado")
        } catch (error) {
          console.error("[v0] Falha no save de emergência:", error)
        }
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [saveStatus, elements, backgroundImage, backgroundColor, placeholders, canvasSize, localStorageKey])

  // Auto-height calculation for text elements
  useEffect(() => {
    if (!isInitialized || !measurementDivRef.current) return

    const tempDiv = measurementDivRef.current
    let hasChanges = false
    const updatedElements = elements.map((el) => {
      if (el.type === "text" || el.type === "placeholder") {
        Object.assign(tempDiv.style, {
          width: `${el.width}px`,
          fontSize: `${el.fontSize}px`,
          fontFamily: el.fontFamily,
          fontWeight: el.fontWeight,
          fontStyle: el.fontStyle,
          // FIX: Set line-height to match the 'leading-tight' class (1.25) used for rendering.
          // This ensures the measurement div has the same text flow as the visible element.
          lineHeight: "1.25",
        })
        // Use innerText, which combined with 'white-space: pre-wrap' correctly handles newlines.
        // Use a non-breaking space as a fallback for empty content to ensure at least one line's height is measured.
        tempDiv.innerText = el.content || "\u00A0"

        // FIX: Calculate the new height using scrollHeight, which gives the total height of the content,
        // and add a small buffer (4px) as a safety margin to prevent clipping of character descenders (like 'g', 'y').
        const newHeight = tempDiv.scrollHeight + 4

        // Check if the height has changed beyond a small tolerance to avoid unnecessary re-renders.
        if (Math.abs(el.height - newHeight) > 1) {
          hasChanges = true
          return { ...el, height: newHeight }
        }
      }
      return el
    })

    if (hasChanges) {
      setElements(updatedElements)
    }
    // This dependency array ensures the effect runs whenever a property that affects text height changes.
  }, [
    elements.map(
      (el) => `${el.id}-${el.content}-${el.width}-${el.fontSize}-${el.fontFamily}-${el.fontWeight}-${el.fontStyle}`,
    ),
    isInitialized,
  ])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setZoom(0.5)
      } else if (window.innerWidth < 1440) {
        setZoom(0.7)
      } else {
        setZoom(0.8)
      }
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, elementId: string, handle?: string) => {
      e.preventDefault()
      e.stopPropagation()
      const element = elements.find((el) => el.id === elementId)
      if (!element) return
      setSelectedElement(elementId)
      if (handle) {
        setIsResizing(true)
        setResizeHandle(handle)
      } else {
        setIsDragging(true)
      }
      const rect = e.currentTarget.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    },
    [elements],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!selectedElement || !canvasRef.current) return
      const element = elements.find((el) => el.id === selectedElement)
      if (!element) return
      const canvasRect = canvasRef.current.getBoundingClientRect()
      const mouseX = (e.clientX - canvasRect.left) / zoom
      const mouseY = (e.clientY - canvasRect.top) / zoom

      if (isDragging) {
        const newX = mouseX - dragOffset.x / zoom
        const newY = mouseY - dragOffset.y / zoom
        setElements((prev) =>
          prev.map((el) =>
            el.id === selectedElement
              ? {
                  ...el,
                  x: Math.max(0, Math.min(newX, canvasSize.width - el.width)),
                  y: Math.max(0, Math.min(newY, canvasSize.height - el.height)),
                }
              : el,
          ),
        )
      } else if (isResizing && resizeHandle) {
        const startX = element.x
        const startY = element.y
        const startWidth = element.width
        const startHeight = element.height
        let newWidth = startWidth
        let newHeight = startHeight
        let newX = startX
        let newY = startY

        switch (resizeHandle) {
          case "e": // East handle for text
            newWidth = Math.max(20, mouseX - startX)
            break
          case "w": // West handle for text
            newWidth = Math.max(20, startX + startWidth - mouseX)
            newX = mouseX
            break
          case "se":
            newWidth = Math.max(20, mouseX - startX)
            newHeight = Math.max(20, mouseY - startY)
            break
          case "sw":
            newWidth = Math.max(20, startX + startWidth - mouseX)
            newHeight = Math.max(20, mouseY - startY)
            newX = mouseX
            break
          case "ne":
            newWidth = Math.max(20, mouseX - startX)
            newHeight = Math.max(20, startY + startHeight - mouseY)
            newY = mouseY
            break
          case "nw":
            newWidth = Math.max(20, startX + startWidth - mouseX)
            newHeight = Math.max(20, startY + startHeight - mouseY)
            newX = mouseX
            newY = mouseY
            break
        }

        if (newX + newWidth > canvasSize.width) newWidth = canvasSize.width - newX
        if (newY + newHeight > canvasSize.height) newHeight = canvasSize.height - newY

        setElements((prev) =>
          prev.map((el) =>
            el.id === selectedElement
              ? {
                  ...el,
                  x: Math.max(0, newX),
                  y: Math.max(0, newY),
                  width: newWidth,
                  height: newHeight, // For text, this will be recalculated by the useEffect
                }
              : el,
          ),
        )
      }
    },
    [isDragging, isResizing, selectedElement, dragOffset, zoom, canvasSize, resizeHandle, elements],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setResizeHandle("")
  }, [])

  const addTextElement = () => {
    const newElement: CertificateElement = {
      id: `text_${Date.now()}`,
      type: "text",
      content: "Clique para editar",
      x: 100,
      y: 200,
      width: 300,
      height: 50, // Initial height, will be auto-adjusted
      fontSize: 18,
      fontFamily: "helvetica",
      fontWeight: "normal",
      fontStyle: "normal",
      textDecoration: "none",
      color: "#000000",
      backgroundColor: "transparent",
      textAlign: "left",
      rotation: 0,
      opacity: 1,
      borderWidth: 0,
      borderColor: "#000000",
      borderRadius: 0,
      zIndex: elements.length + 1,
    }
    setElements((prev) => [...prev, newElement])
    setSelectedElement(newElement.id)
  }

  const addQrCodeElement = () => {
    if (elements.some((el) => el.type === "qrcode")) {
      toast({
        title: "Aviso",
        description: "Só é permitido um QR Code por template.",
        variant: "default",
      })
      return
    }
    const newElement: CertificateElement = {
      id: `qrcode_${Date.now()}`,
      type: "qrcode",
      content: "QR Code de Verificação",
      x: canvasSize.width - 170,
      y: canvasSize.height - 170,
      width: 120,
      height: 120,
      fontSize: 16,
      fontFamily: "Arial",
      fontWeight: "normal",
      fontStyle: "normal",
      textDecoration: "none",
      color: "#000000",
      backgroundColor: "transparent",
      textAlign: "center",
      rotation: 0,
      opacity: 1,
      borderWidth: 0,
      borderColor: "#000000",
      borderRadius: 0,
      zIndex: elements.length + 1,
    }
    setElements((prev) => [...prev, newElement])
    setSelectedElement(newElement.id)
  }

  const addPlaceholderElement = (placeholderId: string) => {
    const placeholder = placeholders.find((p) => p.id === placeholderId)
    if (!placeholder) return
    const newElement: CertificateElement = {
      id: `placeholder_${Date.now()}`,
      type: "placeholder",
      content: `{{${placeholderId}}}`,
      x: 100,
      y: 300,
      width: 300,
      height: 50, // Initial height, will be auto-adjusted
      fontSize: 18,
      fontFamily: "helvetica",
      fontWeight: "normal",
      fontStyle: "normal",
      textDecoration: "none",
      color: "#000000",
      backgroundColor: "transparent",
      textAlign: "left",
      rotation: 0,
      opacity: 1,
      borderWidth: 0,
      borderColor: "#000000",
      borderRadius: 0,
      placeholderId,
      zIndex: elements.length + 1,
    }
    setElements((prev) => [...prev, newElement])
    setSelectedElement(newElement.id)
  }

  const addDynamicElement = (type: "email" | "issue_date" | "certificate_id") => {
    let content = ""
    let placeholderId = ""

    switch (type) {
      case "email":
        content = "{{default_email}}"
        placeholderId = "default_email"
        break
      case "issue_date":
        content = "{{issue_date}}"
        placeholderId = "issue_date"
        break
      case "certificate_id":
        content = "{{certificate_id}}"
        placeholderId = "certificate_id"
        break
    }

    const newElement: CertificateElement = {
      id: `placeholder_${Date.now()}`,
      type: "placeholder",
      content: content,
      x: 100,
      y: 300,
      width: 300,
      height: 50, // Initial height, will be auto-adjusted
      fontSize: 18,
      fontFamily: "helvetica",
      fontWeight: "normal",
      fontStyle: "normal",
      textDecoration: "none",
      color: "#000000",
      backgroundColor: "transparent",
      textAlign: "left",
      rotation: 0,
      opacity: 1,
      borderWidth: 0,
      borderColor: "#000000",
      borderRadius: 0,
      placeholderId: placeholderId,
      zIndex: elements.length + 1,
    }
    setElements((prev) => [...prev, newElement])
    setSelectedElement(newElement.id)
  }

  const addImageElement = () => {
    imageInputRef.current?.click()
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    console.log("[v0] Upload de imagem iniciado:", {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024).toFixed(2)}KB`,
    })

    if (!file.type.startsWith("image/")) {
      console.error("[v0] Tipo de arquivo inválido:", file.type)
      toast({
        title: "Erro de Formato",
        description: `Formato ${file.type} não suportado. Use PNG, JPG, GIF ou WebP.`,
        variant: "destructive",
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      toast({
        title: "Arquivo Muito Grande",
        description: "A imagem deve ter no máximo 10MB. Comprima a imagem e tente novamente.",
        variant: "destructive",
      })
      return
    }

    const reader = new FileReader()

    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      console.log("[v0] Imagem carregada com sucesso:", {
        dataUrlLength: imageUrl.length,
        type: file.type,
      })

      const newElement: CertificateElement = {
        id: `image_${Date.now()}`,
        type: "image",
        content: "",
        x: 100,
        y: 100,
        width: 200,
        height: 150,
        fontSize: 16,
        fontFamily: "Arial",
        fontWeight: "normal",
        fontStyle: "normal",
        textDecoration: "none",
        color: "#000000",
        backgroundColor: "transparent",
        textAlign: "left",
        rotation: 0,
        opacity: 1,
        borderWidth: 0,
        borderColor: "#000000",
        borderRadius: 0,
        imageUrl,
        zIndex: elements.length + 1,
      }
      setElements((prev) => [...prev, newElement])
      setSelectedElement(newElement.id)
    }
    reader.readAsDataURL(file)
  }

  const updateSelectedElement = (updates: Partial<CertificateElement>) => {
    if (!selectedElement) return
    setElements((prev) => prev.map((el) => (el.id === selectedElement ? { ...el, ...updates } : el)))
  }

  const deleteSelectedElement = () => {
    if (!selectedElement) return
    setElements((prev) => prev.filter((el) => el.id !== selectedElement))
    setSelectedElement(null)
  }

  const duplicateSelectedElement = () => {
    if (!selectedElement) return
    const element = elements.find((el) => el.id === selectedElement)
    if (!element) return
    const newElement = {
      ...element,
      id: `${element.type}_${Date.now()}`,
      x: element.x + 20,
      y: element.y + 20,
      zIndex: elements.length + 1,
    }
    setElements((prev) => [...prev, newElement])
    setSelectedElement(newElement.id)
  }

  const moveElementLayer = (direction: "up" | "down") => {
    if (!selectedElement) return
    setElements((prev) => {
      const element = prev.find((el) => el.id === selectedElement)
      if (!element) return prev
      const newZIndex = direction === "up" ? element.zIndex + 1 : Math.max(1, element.zIndex - 1)
      return prev.map((el) => (el.id === selectedElement ? { ...el, zIndex: newZIndex } : el))
    })
  }

  const addNewPlaceholder = () => {
    if (!newPlaceholder.id || !newPlaceholder.label) {
      toast({
        title: "Erro",
        description: "Preencha o ID e o rótulo do placeholder.",
        variant: "destructive",
      })
      return
    }
    if (placeholders.some((p) => p.id === newPlaceholder.id)) {
      toast({
        title: "Erro",
        description: "Já existe um placeholder com este ID.",
        variant: "destructive",
      })
      return
    }
    setPlaceholders((prev) => [...prev, { ...newPlaceholder, type: "text" }])
    setNewPlaceholder({ id: "", label: "" })
    toast({
      title: "Placeholder adicionado!",
      description: `Placeholder "${newPlaceholder.label}" criado com sucesso.`,
    })
  }

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma imagem válida.",
        variant: "destructive",
      })
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      setBackgroundImage(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const generatePreviewData = () => {
    const previewData: Record<string, string> = {}
    placeholders.forEach((p) => {
      previewData[p.id] = `[${p.label}]`
    })
    previewData["default_email"] = "[email@exemplo.com]"
    previewData["issue_date"] = new Date().toLocaleDateString("pt-BR")
    previewData["certificate_id"] = "[ID-CERTIFICADO-123]"
    return previewData
  }

  const renderElement = (element: CertificateElement, isPreview = false) => {
    let displayContent = element.content
    if (element.type === "placeholder" && isPreview) {
      const previewData = generatePreviewData()
      displayContent = previewData[element.placeholderId || ""] || `[${element.placeholderId}]`
    }
    const isSelected = selectedElement === element.id && !isPreview
    const isTextElement = element.type === "text" || element.type === "placeholder"

    const elementStyle: React.CSSProperties = {
      position: "absolute",
      left: element.x * zoom,
      top: element.y * zoom,
      width: element.width * zoom,
      height: element.height * zoom,
      fontSize: element.fontSize * zoom,
      fontFamily: element.fontFamily,
      fontWeight: element.fontWeight,
      fontStyle: element.fontStyle,
      textDecoration: element.textDecoration,
      color: element.color,
      backgroundColor: element.backgroundColor === "transparent" ? "transparent" : element.backgroundColor,
      textAlign: element.textAlign,
      transform: `rotate(${element.rotation}deg)`,
      opacity: element.opacity,
      border: element.borderWidth > 0 ? `${element.borderWidth}px solid ${element.borderColor}` : "none",
      borderRadius: element.borderRadius,
      zIndex: element.zIndex,
      cursor: isPreview ? "default" : "move",
      userSelect: "none",
      boxSizing: "border-box",
      overflow: "hidden",
      wordWrap: "break-word",
      whiteSpace: isTextElement ? "pre-wrap" : "normal",
    }

    if (element.type === "qrcode" && !isPreview) {
      return (
        <div
          key={element.id}
          className={`absolute cursor-move select-none flex items-center justify-center flex-col p-2 ${
            isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""
          } hover:ring-1 hover:ring-gray-300 bg-gray-50`}
          style={{ ...elementStyle, borderStyle: "dashed", borderColor: "#6b7280" }}
          onMouseDown={(e) => handleMouseDown(e, element.id)}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedElement(element.id)
          }}
        >
          <QrCode className="w-1/2 h-1/2 text-gray-500" />
          <span className="text-xs text-center mt-2 text-gray-600">QR Code</span>
          {isSelected && (
            <>
              <div
                className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white cursor-se-resize rounded-full shadow-md"
                onMouseDown={(e) => handleMouseDown(e, element.id, "se")}
              />
              <div
                className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white cursor-ne-resize rounded-full shadow-md"
                onMouseDown={(e) => handleMouseDown(e, element.id, "ne")}
              />
              <div
                className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white cursor-nw-resize rounded-full shadow-md"
                onMouseDown={(e) => handleMouseDown(e, element.id, "nw")}
              />
              <div
                className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white cursor-sw-resize rounded-full shadow-md"
                onMouseDown={(e) => handleMouseDown(e, element.id, "sw")}
              />
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-2 py-1 rounded text-xs cursor-move flex items-center gap-1">
                <Move className="w-3 h-3" />
                Mover
              </div>
            </>
          )}
        </div>
      )
    }

    if (element.type === "image-placeholder" && !isPreview) {
      return (
        <div
          key={element.id}
          className={`absolute cursor-move select-none flex items-center justify-center flex-col p-2 ${
            isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""
          } hover:ring-1 hover:ring-gray-300`}
          style={{ ...elementStyle, borderStyle: "dashed" }}
          onMouseDown={(e) => handleMouseDown(e, element.id)}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedElement(element.id)
          }}
        >
          <ImageIcon className="w-1/3 h-1/3 text-gray-400" />
          <span className="text-xs text-center mt-2 text-gray-500">{element.content}</span>
          <Badge className="absolute top-2 right-2 text-xs bg-gray-200 text-gray-700">Imagem 3x4</Badge>
          {isSelected && (
            <>
              <div
                className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white cursor-se-resize rounded-full shadow-md"
                onMouseDown={(e) => handleMouseDown(e, element.id, "se")}
              />
              <div
                className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white cursor-ne-resize rounded-full shadow-md"
                onMouseDown={(e) => handleMouseDown(e, element.id, "ne")}
              />
              <div
                className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white cursor-nw-resize rounded-full shadow-md"
                onMouseDown={(e) => handleMouseDown(e, element.id, "nw")}
              />
              <div
                className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white cursor-sw-resize rounded-full shadow-md"
                onMouseDown={(e) => handleMouseDown(e, element.id, "sw")}
              />
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-2 py-1 rounded text-xs cursor-move flex items-center gap-1">
                <Move className="w-3 h-3" />
                Mover
              </div>
            </>
          )}
        </div>
      )
    }

    return (
      <div
        key={element.id}
        className={`${isSelected ? "ring-2 ring-blue-500" : ""} ${isPreview ? "" : "hover:ring-1 hover:ring-gray-300"}`}
        style={elementStyle}
        onMouseDown={isPreview ? undefined : (e) => handleMouseDown(e, element.id)}
        onClick={
          isPreview
            ? undefined
            : (e) => {
                e.stopPropagation()
                setSelectedElement(element.id)
              }
        }
      >
        {element.type === "image" && element.imageUrl ? (
          <img
            src={element.imageUrl || "/placeholder.svg"}
            alt="Element"
            className="w-full h-full object-cover"
            style={{ borderRadius: element.borderRadius }}
            draggable={false}
          />
        ) : (
          <div
            className="w-full h-full leading-tight"
            onDoubleClick={
              isPreview
                ? undefined
                : (e) => {
                    e.stopPropagation()
                    const newContent = prompt("Editar texto:", element.content)
                    if (newContent !== null) {
                      setElements((prev) =>
                        prev.map((el) => (el.id === element.id ? { ...el, content: newContent } : el)),
                      )
                    }
                  }
            }
            style={{ cursor: isPreview ? "default" : "text" }}
          >
            {displayContent}
          </div>
        )}
        {element.type === "placeholder" && !isPreview && (
          <Badge className="absolute -top-8 left-0 text-xs bg-blue-100 text-blue-800 pointer-events-none">
            {placeholders.find((p) => p.id === element.placeholderId)?.label || element.content}
          </Badge>
        )}
        {isSelected && !isPreview && (
          <>
            {isTextElement ? (
              <>
                <div
                  className="absolute top-1/2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white cursor-e-resize rounded-full shadow-md -translate-y-1/2"
                  onMouseDown={(e) => handleMouseDown(e, element.id, "e")}
                />
                <div
                  className="absolute top-1/2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white cursor-w-resize rounded-full shadow-md -translate-y-1/2"
                  onMouseDown={(e) => handleMouseDown(e, element.id, "w")}
                />
              </>
            ) : (
              <>
                <div
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white cursor-se-resize rounded-full shadow-md"
                  onMouseDown={(e) => handleMouseDown(e, element.id, "se")}
                />
                <div
                  className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white cursor-ne-resize rounded-full shadow-md"
                  onMouseDown={(e) => handleMouseDown(e, element.id, "ne")}
                />
                <div
                  className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white cursor-nw-resize rounded-full shadow-md"
                  onMouseDown={(e) => handleMouseDown(e, element.id, "nw")}
                />
                <div
                  className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white cursor-sw-resize rounded-full shadow-md"
                  onMouseDown={(e) => handleMouseDown(e, element.id, "sw")}
                />
              </>
            )}
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-2 py-1 rounded text-xs cursor-move flex items-center gap-1">
              <Move className="w-3 h-3" />
              Mover
            </div>
          </>
        )}
      </div>
    )
  }

  const selectedElementData = elements.find((el) => el.id === selectedElement)

  const addImagePlaceholder = () => {
    if (!newImagePlaceholder.id || !newImagePlaceholder.label) {
      toast({
        title: "Erro",
        description: "Preencha o ID e o rótulo do placeholder de imagem.",
        variant: "destructive",
      })
      return
    }
    const placeholderId = newImagePlaceholder.id.toLowerCase().replace(/\s/g, "_")
    if (placeholders.some((p) => p.id === placeholderId)) {
      toast({
        title: "Erro",
        description: "Já existe um placeholder com este ID.",
        variant: "destructive",
      })
      return
    }
    setPlaceholders((prev) => [...prev, { ...newImagePlaceholder, id: placeholderId, type: "image" }])
    const newElement: CertificateElement = {
      id: `img_placeholder_${Date.now()}`,
      type: "image-placeholder",
      content: newImagePlaceholder.label,
      x: 150,
      y: 150,
      width: 150,
      height: 200,
      fontSize: 16,
      fontFamily: "Arial",
      fontWeight: "normal",
      fontStyle: "normal",
      textDecoration: "none",
      color: "#9ca3af",
      backgroundColor: "#f3f4f6",
      textAlign: "center",
      rotation: 0,
      opacity: 1,
      borderWidth: 2,
      borderColor: "#d1d5db",
      borderRadius: 8,
      placeholderId: placeholderId,
      zIndex: elements.length + 1,
    }
    setElements((prev) => [...prev, newElement])
    setSelectedElement(newElement.id)
    setNewImagePlaceholder({ id: "", label: "" })
    toast({
      title: "Placeholder de Imagem Adicionado!",
      description: `Use a tag {{${placeholderId}}} no formulário.`,
    })
  }

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden relative">
      {/* Sidebar Esquerda - Ferramentas */}
      <div className="w-[400px] bg-white border-r flex flex-col flex-shrink-0">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Editor Profissional</h2>
          <p className="text-sm text-gray-600">Crie certificados incríveis</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">
            <Tabs defaultValue="elements" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="elements" className="text-xs">
                  <Plus className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="design" className="text-xs">
                  <Palette className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="layers" className="text-xs">
                  <Layers className="h-3 w-3" />
                </TabsTrigger>
              </TabsList>
              <TabsContent value="elements" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Adicionar Elementos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      onClick={addTextElement}
                      variant="outline"
                      className="w-full justify-start text-sm bg-transparent hover:bg-blue-50"
                    >
                      <Type className="h-4 w-4 mr-2" />
                      Texto
                    </Button>
                    <Button
                      onClick={addImageElement}
                      variant="outline"
                      className="w-full justify-start text-sm bg-transparent hover:bg-blue-50"
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Imagem (Estática)
                    </Button>
                    <Button
                      onClick={addQrCodeElement}
                      variant="outline"
                      className="w-full justify-start text-sm bg-transparent hover:bg-blue-50"
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      QR Code (Link de Verificação)
                    </Button>
                    <Button
                      onClick={() => addDynamicElement("email")}
                      variant="outline"
                      className="w-full justify-start text-sm bg-transparent hover:bg-blue-50"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Email (Dinâmico)
                    </Button>
                    <Button
                      onClick={() => addDynamicElement("issue_date")}
                      variant="outline"
                      className="w-full justify-start text-sm bg-transparent hover:bg-blue-50"
                    >
                      <CalendarDays className="h-4 w-4 mr-2" />
                      Data de Emissão (Dinâmico)
                    </Button>
                    <Button
                      onClick={() => addDynamicElement("certificate_id")}
                      variant="outline"
                      className="w-full justify-start text-sm bg-transparent hover:bg-blue-50"
                    >
                      <Hash className="h-4 w-4 mr-2" />
                      ID do Certificado (Dinâmico)
                    </Button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Separator className="my-3" />
                    <div className="p-3 border rounded-lg bg-gray-50 space-y-2">
                      <Label className="text-sm font-medium text-gray-600">Imagem do Usuário (3x4)</Label>
                      <Input
                        placeholder="ID da Imagem (ex: foto_aluno)"
                        value={newImagePlaceholder.id}
                        onChange={(e) => setNewImagePlaceholder((prev) => ({ ...prev, id: e.target.value }))}
                        className="h-8 text-xs font-mono"
                      />
                      <Input
                        placeholder="Rótulo (ex: Foto 3x4)"
                        value={newImagePlaceholder.label}
                        onChange={(e) => setNewImagePlaceholder((prev) => ({ ...prev, label: e.target.value }))}
                        className="h-8 text-xs"
                      />
                      <Button onClick={addImagePlaceholder} size="sm" className="w-full text-xs">
                        <Plus className="h-3 w-3 mr-2" />
                        Adicionar Placeholder de Imagem
                      </Button>
                    </div>
                    <Separator className="my-3" />
                    <div className="space-y-4">
                      <Label className="text-sm font-medium text-gray-600">TAGs</Label>
                      <div className="p-3 border rounded-lg bg-gray-50 space-y-2">
                        <Input
                          placeholder="ID da Tag (ex: student_name)"
                          value={newPlaceholder.id}
                          onChange={(e) =>
                            setNewPlaceholder((prev) => ({
                              ...prev,
                              id: e.target.value.toLowerCase().replace(/\s/g, "_"),
                            }))
                          }
                          className="h-8 text-xs font-mono"
                        />
                        <Input
                          placeholder="Rótulo da Tag (ex: Nome do Aluno)"
                          value={newPlaceholder.label}
                          onChange={(e) => setNewPlaceholder((prev) => ({ ...prev, label: e.target.value }))}
                          className="h-8 text-xs"
                        />
                        <Button onClick={addNewPlaceholder} size="sm" className="w-full text-xs">
                          <Plus className="h-3 w-3 mr-2" />
                          Criar Nova Tag
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {placeholders.length > 0 ? (
                          placeholders
                            .filter((p) => p.type !== "image")
                            .map((placeholder) => (
                              <div
                                key={placeholder.id}
                                className="flex items-center justify-between p-2 border rounded-md hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{placeholder.label}</p>
                                  <p className="text-xs text-gray-500 font-mono truncate">
                                    {"{{"}
                                    {placeholder.id}
                                    {"}}"}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => addPlaceholderElement(placeholder.id)}
                                    className="h-7 w-7 p-0"
                                    title="Adicionar ao certificado"
                                  >
                                    <Plus className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (confirm(`Excluir tag "${placeholder.label}"?`)) {
                                        setPlaceholders((prev) => prev.filter((p) => p.id !== placeholder.id))
                                      }
                                    }}
                                    className="h-7 w-7 p-0"
                                    title="Excluir tag"
                                  >
                                    <Trash2 className="h-3 w-3 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                            ))
                        ) : (
                          <p className="text-xs text-center text-gray-500 py-4">Nenhuma tag criada ainda.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="design" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Fundo do Certificado</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Cor de Fundo</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="w-12 h-10 p-1 border rounded"
                        />
                        <Input
                          type="text"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="flex-1 h-10 text-sm"
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Imagem de Fundo</Label>
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        className="w-full text-xs"
                      >
                        <Upload className="h-3 w-3 mr-2" />
                        Upload Imagem
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleBackgroundUpload}
                        className="hidden"
                      />
                      {backgroundImage && (
                        <Button
                          onClick={() => setBackgroundImage(null)}
                          variant="destructive"
                          size="sm"
                          className="w-full text-xs"
                        >
                          Remover Imagem
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Tamanho do Certificado (px)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="canvas-width" className="text-xs font-normal text-gray-500">
                            Largura
                          </Label>
                          <Input
                            id="canvas-width"
                            type="number"
                            value={canvasSize.width}
                            onChange={(e) =>
                              setCanvasSize((prev) => ({ ...prev, width: Number(e.target.value) || 1200 }))
                            }
                            className="h-8 text-sm"
                            placeholder="Largura"
                          />
                        </div>
                        <div>
                          <Label htmlFor="canvas-height" className="text-xs font-normal text-gray-500">
                            Altura
                          </Label>
                          <Input
                            id="canvas-height"
                            type="number"
                            value={canvasSize.height}
                            onChange={(e) =>
                              setCanvasSize((prev) => ({ ...prev, height: Number(e.target.value) || 850 }))
                            }
                            className="h-8 text-sm"
                            placeholder="Altura"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Zoom do Editor</Label>
                      <Slider
                        value={[zoom]}
                        onValueChange={([value]) => setZoom(value)}
                        min={0.3}
                        max={1.2}
                        step={0.1}
                        className="w-full"
                      />
                      <div className="text-xs text-gray-500 text-center">{Math.round(zoom * 100)}%</div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="layers" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Camadas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {elements
                        .sort((a, b) => b.zIndex - a.zIndex)
                        .map((element) => (
                          <div
                            key={element.id}
                            className={`flex items-center justify-between p-2 rounded text-xs cursor-grab active:cursor-grabbing transition-colors ${
                              selectedElement === element.id
                                ? "bg-blue-100 border border-blue-300"
                                : "bg-gray-50 hover:bg-gray-100"
                            }`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", element.id)
                              e.dataTransfer.effectAllowed = "move"
                            }}
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.dataTransfer.dropEffect = "move"
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              const draggedElementId = e.dataTransfer.getData("text/plain")
                              const draggedElement = elements.find((el) => el.id === draggedElementId)
                              const targetElement = element
                              if (draggedElement && draggedElement.id !== targetElement.id) {
                                setElements((prev) =>
                                  prev.map((el) => {
                                    if (el.id === draggedElement.id) return { ...el, zIndex: targetElement.zIndex }
                                    if (el.id === targetElement.id) return { ...el, zIndex: draggedElement.zIndex }
                                    return el
                                  }),
                                )
                              }
                            }}
                            onClick={() => setSelectedElement(element.id)}
                          >
                            <div className="flex items-center space-x-2">
                              {element.type === "text" && <Type className="h-3 w-3" />}
                              {element.type === "placeholder" && <Tag className="h-3 w-3" />}
                              {element.type === "image" && <ImageIcon className="h-3 w-3" />}
                              {element.type === "image-placeholder" && <ImageIcon className="h-3 w-3" />}
                              {element.type === "qrcode" && <QrCode className="h-3 w-3" />}
                              <span className="truncate max-w-[120px]">
                                {element.type === "qrcode"
                                  ? "QR Code"
                                  : element.type === "placeholder"
                                    ? placeholders.find((p) => p.id === element.placeholderId)?.label || element.content
                                    : element.content || "Imagem"}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Badge variant="outline" className="text-xs">
                                {element.zIndex}
                              </Badge>
                              <div className="w-4 h-4 flex items-center justify-center cursor-grab active:cursor-grabbing">
                                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                <div className="w-1 h-1 bg-gray-400 rounded-full ml-0.5"></div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>

      {/* Área Principal */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b p-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold">Editor de Certificado</h1>
            <Badge variant="outline" className="text-xs">
              {canvasSize.width} x {canvasSize.height}px
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {elements.length} elementos
            </Badge>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? "Voltar ao Editor" : "Visualizar Preview"}
            </Button>
          </div>
        </div>
        {!showPreview && (
          <div className="bg-gray-50 border-b p-2 flex items-center space-x-2 overflow-x-auto">
            <div className="flex items-center space-x-1">
              <Button
                size="sm"
                variant={selectedElementData?.fontWeight === "bold" ? "default" : "outline"}
                onClick={() =>
                  updateSelectedElement({
                    fontWeight: selectedElementData?.fontWeight === "bold" ? "normal" : "bold",
                  })
                }
                disabled={!selectedElementData}
              >
                <Bold className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant={selectedElementData?.fontStyle === "italic" ? "default" : "outline"}
                onClick={() =>
                  updateSelectedElement({
                    fontStyle: selectedElementData?.fontStyle === "italic" ? "normal" : "italic",
                  })
                }
                disabled={!selectedElementData}
              >
                <Italic className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant={selectedElementData?.textDecoration === "underline" ? "default" : "outline"}
                onClick={() =>
                  updateSelectedElement({
                    textDecoration: selectedElementData?.textDecoration === "underline" ? "none" : "underline",
                  })
                }
                disabled={!selectedElementData}
              >
                <Underline className="h-3 w-3" />
              </Button>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center space-x-1">
              <Button
                size="sm"
                variant={selectedElementData?.textAlign === "left" ? "default" : "outline"}
                onClick={() => updateSelectedElement({ textAlign: "left" })}
                disabled={!selectedElementData}
              >
                <AlignLeft className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant={selectedElementData?.textAlign === "center" ? "default" : "outline"}
                onClick={() => updateSelectedElement({ textAlign: "center" })}
                disabled={!selectedElementData}
              >
                <AlignCenter className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant={selectedElementData?.textAlign === "right" ? "default" : "outline"}
                onClick={() => updateSelectedElement({ textAlign: "right" })}
                disabled={!selectedElementData}
              >
                <AlignRight className="h-3 w-3" />
              </Button>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center space-x-2">
              <Input
                type="color"
                value={selectedElementData?.color || "#000000"}
                onChange={(e) => updateSelectedElement({ color: e.target.value })}
                className="w-8 h-8 p-0 border-0"
                title="Cor do texto"
                disabled={!selectedElementData}
              />
              <Input
                type="number"
                value={selectedElementData?.fontSize || 18}
                onChange={(e) => updateSelectedElement({ fontSize: Number(e.target.value) })}
                className="w-16 h-8 text-xs"
                min="8"
                max="72"
                disabled={!selectedElementData}
              />
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center space-x-1">
              <Button
                size="sm"
                variant="outline"
                onClick={duplicateSelectedElement}
                title="Duplicar"
                disabled={!selectedElementData}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => moveElementLayer("up")}
                title="Trazer para frente"
                disabled={!selectedElementData}
              >
                ↑
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => moveElementLayer("down")}
                title="Enviar para trás"
                disabled={!selectedElementData}
              >
                ↓
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={deleteSelectedElement}
                title="Excluir"
                disabled={!selectedElementData}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div className="flex justify-center">
            <div
              ref={canvasRef}
              className="relative bg-white shadow-lg border"
              style={{
                width: canvasSize.width * zoom,
                height: canvasSize.height * zoom,
                backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
                backgroundColor: backgroundImage ? undefined : backgroundColor,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={() => setSelectedElement(null)}
            >
              {!showPreview && (
                <div
                  className="absolute inset-0 opacity-5 pointer-events-none"
                  style={{
                    backgroundImage: `
  linear-gradient(to right, #000 1px, transparent 1px),
  linear-gradient(to bottom, #000 1px, transparent 1px)
`,
                    backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                  }}
                />
              )}
              {elements.sort((a, b) => a.zIndex - b.zIndex).map((element) => renderElement(element, showPreview))}
              {!showPreview && (
                <div className="absolute bottom-2 left-2 text-xs text-gray-400 pointer-events-none bg-white px-2 py-1 rounded shadow">
                  Certificado A4 • {Math.round(zoom * 100)}% • {canvasSize.width}x{canvasSize.height}px
                </div>
              )}
              {elements.length === 0 && !showPreview && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Type className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Comece criando seu certificado</p>
                    <p className="text-sm">Adicione textos, imagens e placeholders</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Direita - Propriedades */}
      <div className="w-[320px] flex-shrink-0 bg-white border-l">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">Propriedades</h3>
            <p className="text-xs text-gray-600 truncate">
              {selectedElementData?.type === "text" && "Elemento de Texto"}
              {selectedElementData?.type === "placeholder" && "Placeholder Dinâmico"}
              {selectedElementData?.type === "image" && "Elemento de Imagem"}
              {selectedElementData?.type === "image-placeholder" && "Placeholder de Imagem"}
              {selectedElementData?.type === "qrcode" && "Elemento QR Code"}
              {!selectedElementData && "Nenhum elemento selecionado"}
            </p>
          </div>
        </div>
        {selectedElementData && (
          <ScrollArea className="h-[calc(100%-65px)]">
            <div className="p-4 space-y-4">
              {selectedElementData.type !== "image" && (
                <div className="space-y-2">
                  <Label className="text-xs">Conteúdo</Label>
                  <Input
                    value={selectedElementData.content}
                    onChange={(e) => updateSelectedElement({ content: e.target.value })}
                    disabled={
                      selectedElementData.type === "placeholder" || selectedElementData.type === "image-placeholder"
                    }
                    className="text-sm"
                    placeholder="Digite o texto..."
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Posição X</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedElementData.x)}
                    onChange={(e) => updateSelectedElement({ x: Number(e.target.value) })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Posição Y</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedElementData.y)}
                    onChange={(e) => updateSelectedElement({ y: Number(e.target.value) })}
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Largura</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedElementData.width)}
                    onChange={(e) => updateSelectedElement({ width: Math.max(20, Number(e.target.value)) })}
                    className="text-sm"
                    min="20"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Altura</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedElementData.height)}
                    onChange={(e) => updateSelectedElement({ height: Math.max(20, Number(e.target.value)) })}
                    className="text-sm"
                    min="20"
                    disabled={selectedElementData.type === "text" || selectedElementData.type === "placeholder"}
                  />
                </div>
              </div>
              {selectedElementData.type !== "image" && selectedElementData.type !== "image-placeholder" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs">Fonte</Label>
                    <Select
                      value={selectedElementData.fontFamily}
                      onValueChange={(value) => updateSelectedElement({ fontFamily: value })}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_FAMILIES.map((font) => (
                          <SelectItem key={font.value} value={font.value}>
                            {font.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tamanho da Fonte</Label>
                    <Slider
                      value={[selectedElementData.fontSize]}
                      onValueChange={([value]) => updateSelectedElement({ fontSize: value })}
                      min={8}
                      max={72}
                      step={1}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 text-center">{selectedElementData.fontSize}px</div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label className="text-xs">Opacidade</Label>
                <Slider
                  value={[selectedElementData.opacity]}
                  onValueChange={([value]) => updateSelectedElement({ opacity: value })}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 text-center">
                  {Math.round(selectedElementData.opacity * 100)}%
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Rotação</Label>
                <Slider
                  value={[selectedElementData.rotation]}
                  onValueChange={([value]) => updateSelectedElement({ rotation: value })}
                  min={-180}
                  max={180}
                  step={1}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 text-center">{selectedElementData.rotation}°</div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Cor de Fundo</Label>
                <div className="flex space-x-2">
                  <Input
                    type="color"
                    value={
                      selectedElementData.backgroundColor === "transparent"
                        ? "#ffffff"
                        : selectedElementData.backgroundColor
                    }
                    onChange={(e) => updateSelectedElement({ backgroundColor: e.target.value })}
                    className="w-12 h-8 p-0"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateSelectedElement({ backgroundColor: "transparent" })}
                    className="text-xs flex-1"
                  >
                    Transparente
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Borda</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Espessura"
                    value={selectedElementData.borderWidth}
                    onChange={(e) => updateSelectedElement({ borderWidth: Number(e.target.value) })}
                    className="text-sm"
                    min="0"
                  />
                  <Input
                    type="color"
                    value={selectedElementData.borderColor}
                    onChange={(e) => updateSelectedElement({ borderColor: e.target.value })}
                    className="h-8 p-0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Borda Arredondada</Label>
                <Slider
                  value={[selectedElementData.borderRadius]}
                  onValueChange={([value]) => updateSelectedElement({ borderRadius: value })}
                  min={0}
                  max={50}
                  step={1}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 text-center">{selectedElementData.borderRadius}px</div>
              </div>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}

export default ProfessionalCertificateEditor

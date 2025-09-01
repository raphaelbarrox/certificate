"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Type, ImageIcon, Plus, Upload, Eye, QrCode, Loader } from "lucide-react"
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

  const validateState = useCallback((state: any): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (!state.elements || !Array.isArray(state.elements)) {
      errors.push("Elementos inválidos ou ausentes")
    }

    if (state.elements?.length === 0) {
      errors.push("Template deve ter pelo menos um elemento")
    }

    // Validar cada elemento
    state.elements?.forEach((element: any, index: number) => {
      if (!element.id || !element.type) {
        errors.push(`Elemento ${index + 1} tem dados inválidos`)
      }
      if (typeof element.x !== "number" || typeof element.y !== "number") {
        errors.push(`Elemento ${index + 1} tem posição inválida`)
      }
      if (element.type === "placeholder" && !element.placeholderId) {
        errors.push(`Elemento ${index + 1} é um placeholder sem ID`)
      }
    })

    if (
      !state.canvasSize ||
      typeof state.canvasSize.width !== "number" ||
      typeof state.canvasSize.height !== "number"
    ) {
      errors.push("Tamanho do canvas inválido")
    }

    return { isValid: errors.length === 0, errors }
  }, [])

  const createBackup = useCallback(
    (state: any, reason: string) => {
      try {
        const backupKey = `editor-backup-${templateId}-${Date.now()}`
        const backupData = {
          state,
          timestamp: Date.now(),
          reason,
          version: "1.0",
        }

        localStorage.setItem(backupKey, JSON.stringify(backupData))

        // Manter apenas os 3 backups mais recentes
        const allKeys = Object.keys(localStorage).filter((key) => key.startsWith(`editor-backup-${templateId}-`))
        if (allKeys.length > 3) {
          allKeys
            .sort()
            .slice(0, -3)
            .forEach((key) => localStorage.removeItem(key))
        }

        console.log("[v0] Backup criado:", { reason, key: backupKey })
      } catch (error) {
        console.warn("[v0] Falha ao criar backup:", error)
      }
    },
    [templateId],
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

    // Validar estado antes de processar
    const validation = validateState(currentState)
    if (!validation.isValid) {
      console.error("[v0] Estado inválido detectado:", validation.errors)
      toast({
        title: "Dados Inválidos Detectados",
        description: "Alguns elementos podem estar corrompidos. Verifique o template.",
        variant: "destructive",
      })
      return
    }

    // Só processa se houver mudanças reais
    if (!hasRealChanges(currentState)) {
      return
    }

    setSaveStatus("unsaved")

    // Debounce inteligente baseado no tamanho e complexidade
    const stateString = JSON.stringify(currentState)
    const stateSize = stateString.length
    const complexity = elements.length + (backgroundImage ? 1 : 0) + placeholders.length

    // Algoritmo de debounce adaptativo
    let debounceTime = 2000 // Base: 2 segundos
    if (stateSize > 100000) debounceTime = 4000 // Estados grandes: 4 segundos
    if (complexity > 20) debounceTime += 1000 // Templates complexos: +1 segundo
    if (stateSize > 500000) debounceTime = 8000 // Estados muito grandes: 8 segundos

    const handler = setTimeout(async () => {
      setSaveStatus("saving")

      try {
        const currentSize = new Blob([stateString]).size

        console.log("[v0] Iniciando autosave avançado:", {
          size: `${(currentSize / 1024).toFixed(2)}KB`,
          elements: elements.length,
          placeholders: placeholders.length,
          complexity,
          debounceUsed: `${debounceTime}ms`,
        })

        // Criar backup antes de mudanças críticas
        if (currentSize > 1024 * 1024) {
          // 1MB
          createBackup(currentState, "large-state-backup")
        }

        // Gerenciamento inteligente de espaço
        if (currentSize > 3 * 1024 * 1024) {
          // 3MB limit
          console.log("[v0] Estado crítico detectado, iniciando limpeza inteligente")

          // Estratégia de limpeza em camadas
          const cleanupStrategies = [
            // Nível 1: Limpar outros templates
            () => {
              Object.keys(localStorage).forEach((key) => {
                if (key.startsWith("editor-state-") && key !== localStorageKey) {
                  localStorage.removeItem(key)
                }
              })
            },
            // Nível 2: Limpar dados temporários antigos
            () => {
              Object.keys(localStorage).forEach((key) => {
                if (key.includes("formData-") || key.includes("formPreviews-") || key.includes("temp-")) {
                  const keyAge = Date.now() - (Number.parseInt(key.split("-").pop() || "0") || 0)
                  if (keyAge > 24 * 60 * 60 * 1000) {
                    // 24 horas
                    localStorage.removeItem(key)
                  }
                }
              })
            },
            // Nível 3: Limpar backups antigos
            () => {
              Object.keys(localStorage).forEach((key) => {
                if (key.startsWith("editor-backup-")) {
                  const keyAge = Date.now() - (Number.parseInt(key.split("-").pop() || "0") || 0)
                  if (keyAge > 7 * 24 * 60 * 60 * 1000) {
                    // 7 dias
                    localStorage.removeItem(key)
                  }
                }
              })
            },
          ]

          // Executar estratégias até ter espaço suficiente
          for (const strategy of cleanupStrategies) {
            try {
              strategy()
              // Testar se agora consegue salvar
              localStorage.setItem(`test-${Date.now()}`, stateString)
              localStorage.removeItem(`test-${Date.now()}`)
              break // Sucesso, parar limpeza
            } catch (testError) {
              continue // Tentar próxima estratégia
            }
          }
        }

        // Tentar salvar com recuperação automática
        let saveAttempts = 0
        const maxAttempts = 3

        while (saveAttempts < maxAttempts) {
          try {
            localStorage.setItem(localStorageKey, stateString)

            // Verificar integridade do que foi salvo
            const savedData = localStorage.getItem(localStorageKey)
            if (savedData && JSON.parse(savedData)) {
              setLastSavedState(
                JSON.stringify({
                  elements: currentState.elements?.sort((a: any, b: any) => a.id.localeCompare(b.id)),
                  backgroundImage: currentState.backgroundImage,
                  backgroundColor: currentState.backgroundColor,
                  placeholders: currentState.placeholders?.sort((a: any, b: any) => a.id.localeCompare(b.id)),
                  canvasSize: currentState.canvasSize,
                }),
              )

              console.log("[v0] Autosave concluído com sucesso na tentativa", saveAttempts + 1)
              setSaveStatus("saved")
              break
            } else {
              throw new Error("Dados salvos estão corrompidos")
            }
          } catch (storageError: any) {
            saveAttempts++
            console.error(`[v0] Tentativa ${saveAttempts} falhou:`, storageError)

            if (storageError.name === "QuotaExceededError") {
              if (saveAttempts === maxAttempts) {
                // Última tentativa: limpeza drástica
                try {
                  const currentData = localStorage.getItem(localStorageKey)
                  const backups = Object.keys(localStorage)
                    .filter((key) => key.startsWith(`editor-backup-${templateId}-`))
                    .map((key) => ({ key, data: localStorage.getItem(key) }))

                  localStorage.clear()

                  // Restaurar apenas dados essenciais
                  if (currentData) localStorage.setItem(localStorageKey, currentData)
                  backups.slice(-1).forEach((backup) => {
                    // Manter apenas 1 backup
                    if (backup.data) localStorage.setItem(backup.key, backup.data)
                  })

                  // Tentar salvar novamente
                  localStorage.setItem(localStorageKey, stateString)
                  setSaveStatus("saved")

                  toast({
                    title: "Espaço Crítico Liberado",
                    description: "Dados antigos foram removidos. Template salvo com sucesso.",
                  })
                  break
                } catch (criticalError) {
                  console.error("[v0] Falha crítica na recuperação:", criticalError)
                  setSaveStatus("unsaved")

                  toast({
                    title: "Erro Crítico de Armazenamento",
                    description: "Salve no banco de dados IMEDIATAMENTE. Dados podem ser perdidos.",
                    variant: "destructive",
                  })
                  break
                }
              } else {
                // Tentar limpeza incremental
                const keysToRemove = Object.keys(localStorage)
                  .filter(
                    (key) =>
                      !key.startsWith(`editor-state-${templateId}`) && !key.startsWith(`editor-backup-${templateId}`),
                  )
                  .slice(0, 10) // Remover 10 chaves por vez

                keysToRemove.forEach((key) => localStorage.removeItem(key))

                // Aguardar um pouco antes da próxima tentativa
                await new Promise((resolve) => setTimeout(resolve, 100))
              }
            } else {
              // Outros tipos de erro
              if (saveAttempts === maxAttempts) {
                setSaveStatus("unsaved")
                console.error("[v0] Erro persistente no localStorage:", storageError)

                toast({
                  title: "Erro de Salvamento Local",
                  description: "Falha ao salvar localmente. Use 'Salvar' para salvar no banco.",
                  variant: "destructive",
                })
              }
            }
          }
        }

        // Notificar componente pai sobre mudanças
        try {
          onStateChange(currentState, saveStatus !== "saved")
        } catch (parentError) {
          console.warn("[v0] Erro ao notificar componente pai:", parentError)
          // Não falhar o autosave por causa disso
        }
      } catch (error) {
        console.error("[v0] Erro geral no autosave:", error)
        setSaveStatus("unsaved")

        // Tentar criar backup de emergência
        createBackup(currentState, "autosave-failure")

        toast({
          title: "Erro no Salvamento Automático",
          description: "Backup de emergência criado. Salve manualmente no banco.",
          variant: "destructive",
        })
      }
    }, debounceTime)

    return () => clearTimeout(handler)
  }, [
    elements,
    backgroundImage,
    backgroundColor,
    placeholders,
    canvasSize,
    isInitialized,
    localStorageKey,
    hasRealChanges,
    onStateChange,
    validateState,
    createBackup,
    toast,
  ])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === "unsaved") {
        // Criar backup de emergência
        const emergencyState = {
          elements: elements.sort((a, b) => a.zIndex - b.zIndex),
          backgroundImage,
          backgroundColor,
          placeholders,
          canvasSize,
        }

        createBackup(emergencyState, "before-unload-emergency")

        e.preventDefault()
        e.returnValue = "Você tem alterações não salvas. Deseja realmente sair?"
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && saveStatus === "unsaved") {
        // Save de emergência mais robusto
        const emergencyState = {
          elements: elements.sort((a, b) => a.zIndex - b.zIndex),
          backgroundImage,
          backgroundColor,
          placeholders,
          canvasSize,
        }

        try {
          // Tentar salvar no slot principal
          localStorage.setItem(localStorageKey, JSON.stringify(emergencyState))
          console.log("[v0] Save de emergência realizado no slot principal")
        } catch (error) {
          try {
            // Fallback: salvar como backup de emergência
            createBackup(emergencyState, "visibility-change-emergency")
            console.log("[v0] Save de emergência realizado como backup")
          } catch (backupError) {
            console.error("[v0] Falha completa no save de emergência:", backupError)
          }
        }
      }
    }

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        // Verificar se há backups mais recentes que o estado atual
        try {
          const backupKeys = Object.keys(localStorage)
            .filter((key) => key.startsWith(`editor-backup-${templateId}-`))
            .sort()

          if (backupKeys.length > 0) {
            const latestBackupKey = backupKeys[backupKeys.length - 1]
            const backupData = JSON.parse(localStorage.getItem(latestBackupKey) || "{}")

            if (backupData.timestamp && backupData.state) {
              const currentStateTime = Date.now() - 60000 // Considerar estado atual como 1 minuto atrás

              if (backupData.timestamp > currentStateTime && saveStatus === "unsaved") {
                console.log("[v0] Backup mais recente detectado, oferecendo recuperação")

                // Aqui você poderia mostrar um modal perguntando se quer recuperar
                // Por enquanto, apenas log
                toast({
                  title: "Backup Disponível",
                  description: "Detectamos um backup mais recente. Verifique se seus dados estão corretos.",
                })
              }
            }
          }
        } catch (error) {
          console.warn("[v0] Erro ao verificar backups:", error)
        }
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [
    saveStatus,
    elements,
    backgroundImage,
    backgroundColor,
    placeholders,
    canvasSize,
    localStorageKey,
    templateId,
    createBackup,
    toast,
  ])

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
    const calculateOptimalZoom = () => {
      // Larguras fixas das barras laterais
      const leftSidebarWidth = 400
      const rightSidebarWidth = 320
      const padding = 32 // 16px de cada lado

      // Espaço disponível para o canvas
      const availableWidth = window.innerWidth - leftSidebarWidth - rightSidebarWidth - padding
      const availableHeight = window.innerHeight - 200 // Reserva espaço para header e toolbar

      // Calcula zoom baseado nas dimensões do canvas
      const zoomByWidth = availableWidth / canvasSize.width
      const zoomByHeight = availableHeight / canvasSize.height

      // Usa o menor zoom para garantir que tudo caiba
      const optimalZoom = Math.min(zoomByWidth, zoomByHeight, 1.2) // Máximo 120%

      // Zoom mínimo de 30% para manter usabilidade
      const finalZoom = Math.max(optimalZoom, 0.3)

      console.log("[v0] Auto-zoom calculado:", {
        availableWidth,
        availableHeight,
        canvasSize,
        zoomByWidth,
        zoomByHeight,
        finalZoom,
      })

      setZoom(finalZoom)
    }

    // Calcula zoom inicial
    calculateOptimalZoom()

    // Recalcula no resize da janela
    const handleResize = () => {
      calculateOptimalZoom()
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [canvasSize])

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
      height: 50,
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
      cursor: isPreview ? "default" : "move",
      zIndex: element.zIndex,
      display: "flex",
      alignItems: "center",
      justifyContent:
        element.textAlign === "center" ? "center" : element.textAlign === "right" ? "flex-end" : "flex-start",
      padding: "4px",
      boxSizing: "border-box",
      wordWrap: "break-word",
      overflow: "hidden",
    }

    if (element.type === "qrcode") {
      return (
        <div
          key={element.id}
          style={elementStyle}
          onMouseDown={(e) => !isPreview && handleMouseDown(e, element.id)}
          className={`${isSelected ? "ring-2 ring-blue-500" : ""} ${isPreview ? "" : "hover:ring-1 hover:ring-gray-300"}`}
        >
          <div className="w-full h-full bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-600">
            QR Code
          </div>
          {isSelected && !isPreview && (
            <>
              <div
                className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 cursor-nw-resize"
                onMouseDown={(e) => handleMouseDown(e, element.id, "nw")}
              />
              <div
                className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 cursor-ne-resize"
                onMouseDown={(e) => handleMouseDown(e, element.id, "ne")}
              />
              <div
                className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 cursor-sw-resize"
                onMouseDown={(e) => handleMouseDown(e, element.id, "sw")}
              />
              <div
                className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 cursor-se-resize"
                onMouseDown={(e) => handleMouseDown(e, element.id, "se")}
              />
            </>
          )}
        </div>
      )
    }

    if (element.type === "image-placeholder") {
      return (
        <div
          key={element.id}
          style={elementStyle}
          onMouseDown={(e) => !isPreview && handleMouseDown(e, element.id)}
          className={`${isSelected ? "ring-2 ring-blue-500" : ""} ${isPreview ? "" : "hover:ring-1 hover:ring-gray-300"}`}
        >
          <div className="w-full h-full flex flex-col items-center justify-center text-center">
            <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-xs text-gray-600">{displayContent}</span>
          </div>
          {isSelected && !isPreview && (
            <>
              <div
                className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 cursor-nw-resize"
                onMouseDown={(e) => handleMouseDown(e, element.id, "nw")}
              />
              <div
                className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 cursor-ne-resize"
                onMouseDown={(e) => handleMouseDown(e, element.id, "ne")}
              />
              <div
                className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 cursor-sw-resize"
                onMouseDown={(e) => handleMouseDown(e, element.id, "sw")}
              />
              <div
                className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 cursor-se-resize"
                onMouseDown={(e) => handleMouseDown(e, element.id, "se")}
              />
            </>
          )}
        </div>
      )
    }

    return (
      <div
        key={element.id}
        style={elementStyle}
        onMouseDown={(e) => !isPreview && handleMouseDown(e, element.id)}
        className={`${isSelected ? "ring-2 ring-blue-500" : ""} ${isPreview ? "" : "hover:ring-1 hover:ring-gray-300"} leading-tight whitespace-pre-wrap`}
        contentEditable={!isPreview && isSelected}
        suppressContentEditableWarning={true}
        onBlur={(e) => {
          if (!isPreview && isSelected) {
            const newContent = e.currentTarget.textContent || ""
            setElements((prev) => prev.map((el) => (el.id === element.id ? { ...el, content: newContent } : el)))
          }
        }}
      >
        {displayContent}
        {isSelected && !isPreview && isTextElement && (
          <>
            <div
              className="absolute top-1/2 -left-1 w-2 h-4 bg-blue-500 cursor-w-resize -translate-y-1/2"
              onMouseDown={(e) => handleMouseDown(e, element.id, "w")}
            />
            <div
              className="absolute top-1/2 -right-1 w-2 h-4 bg-blue-500 cursor-e-resize -translate-y-1/2"
              onMouseDown={(e) => handleMouseDown(e, element.id, "e")}
            />
          </>
        )}
        {isSelected && !isPreview && !isTextElement && (
          <>
            <div
              className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 cursor-nw-resize"
              onMouseDown={(e) => handleMouseDown(e, element.id, "nw")}
            />
            <div
              className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 cursor-ne-resize"
              onMouseDown={(e) => handleMouseDown(e, element.id, "ne")}
            />
            <div
              className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 cursor-sw-resize"
              onMouseDown={(e) => handleMouseDown(e, element.id, "sw")}
            />
            <div
              className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 cursor-se-resize"
              onMouseDown={(e) => handleMouseDown(e, element.id, "se")}
            />
          </>
        )}
      </div>
    )
  }

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-[400px] bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold mb-4">Editor Profissional</h2>
          <div className="text-sm text-gray-600 mb-2">Crie certificados incríveis com elementos personalizados</div>
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <Badge variant="outline" className="text-xs">
              {saveStatus === "saved" ? "✓ Salvo" : saveStatus === "saving" ? "Salvando..." : "⚠ Não salvo"}
            </Badge>
            <span>•</span>
            <span>{elements.length} elementos</span>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Add Elements Section */}
            <div>
              <h3 className="font-medium mb-3">Adicionar Elementos</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addTextElement}
                  className="w-full justify-start bg-transparent"
                >
                  <Type className="h-4 w-4 mr-2" />
                  Texto
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full justify-start"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Imagem (Estática)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addQrCodeElement}
                  className="w-full justify-start bg-transparent"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  QR Code (Link de Verificação)
                </Button>
              </div>
            </div>

            {/* TAGs Section */}
            <div>
              <h3 className="font-medium mb-3">TAGs</h3>
              <div className="space-y-2">
                <Input
                  placeholder="ID da Tag (ex: student_name)"
                  value={newPlaceholder.id}
                  onChange={(e) => setNewPlaceholder({ ...newPlaceholder, id: e.target.value })}
                />
                <Input
                  placeholder="Rótulo da Tag (ex: Nome do Aluno)"
                  value={newPlaceholder.label}
                  onChange={(e) => setNewPlaceholder({ ...newPlaceholder, label: e.target.value })}
                />
                <Button onClick={addNewPlaceholder} size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar TAG
                </Button>
              </div>

              {placeholders.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Label className="text-sm font-medium">TAGs Disponíveis:</Label>
                  {placeholders.map((placeholder) => (
                    <div key={placeholder.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="font-mono text-xs text-blue-600">{"{{" + placeholder.id + "}}"}</div>
                        <div className="text-xs text-gray-600">{placeholder.label}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addPlaceholderElement(placeholder.id)}
                        className="text-xs"
                      >
                        Usar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Background Section */}
            <div>
              <h3 className="font-medium mb-3">Fundo do Certificado</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Cor de Fundo</Label>
                  <Input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-full h-10"
                  />
                </div>
                <div>
                  <Label className="text-sm">Imagem de Fundo</Label>
                  <Button variant="outline" onClick={() => imageInputRef.current?.click()} className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    {backgroundImage ? "Alterar Imagem" : "Adicionar Imagem"}
                  </Button>
                  {backgroundImage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBackgroundImage(null)}
                      className="w-full mt-1 text-red-600"
                    >
                      Remover Imagem
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Canvas Settings */}
            <div>
              <h3 className="font-medium mb-3">Configurações do Canvas</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Largura (px)</Label>
                  <Input
                    type="number"
                    value={canvasSize.width}
                    onChange={(e) => setCanvasSize({ ...canvasSize, width: Number.parseInt(e.target.value) || 1200 })}
                  />
                </div>
                <div>
                  <Label className="text-sm">Altura (px)</Label>
                  <Input
                    type="number"
                    value={canvasSize.height}
                    onChange={(e) => setCanvasSize({ ...canvasSize, height: Number.parseInt(e.target.value) || 850 })}
                  />
                </div>
                <div>
                  <Label className="text-sm">Zoom: {Math.round(zoom * 100)}%</Label>
                  <Slider
                    value={[zoom]}
                    onValueChange={([value]) => setZoom(value)}
                    min={0.1}
                    max={2}
                    step={0.1}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b p-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="font-medium">Editor de Certificado</h3>
            <Badge variant="outline">
              {canvasSize.width} x {canvasSize.height}px
            </Badge>
            <Badge variant="outline">{elements.length} elementos</Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant={showPreview ? "default" : "outline"}
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? "Editar" : "Visualizar Preview"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white p-4 flex items-center justify-center">
          <div
            ref={canvasRef}
            className="relative bg-white shadow-lg"
            style={{
              width: canvasSize.width * zoom,
              height: canvasSize.height * zoom,
              backgroundColor: backgroundColor,
              backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedElement(null)
              }
            }}
          >
            {elements.sort((a, b) => a.zIndex - b.zIndex).map((element) => renderElement(element, showPreview))}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-[320px] bg-white border-l flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-medium">
            {selectedElement ? "Configurações do Elemento" : "Nenhum Elemento Selecionado"}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {selectedElement
              ? "Ajuste as propriedades do elemento selecionado"
              : "Selecione um elemento para editar suas propriedades."}
          </p>
        </div>

        <ScrollArea className="flex-1">
          {selectedElement ? (
            <div className="p-4 space-y-4">
              {/* Element properties will be rendered here */}
              <div className="text-center text-gray-500 text-sm">Propriedades do elemento em desenvolvimento</div>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">
              Selecione um elemento para editar suas propriedades.
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          // Handle static image upload
          const file = e.target.files?.[0]
          if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
              const imageUrl = event.target?.result as string
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
                textAlign: "center",
                rotation: 0,
                opacity: 1,
                borderWidth: 0,
                borderColor: "#000000",
                borderRadius: 0,
                imageUrl: imageUrl,
                zIndex: elements.length + 1,
              }
              setElements((prev) => [...prev, newElement])
              setSelectedElement(newElement.id)
            }
            reader.readAsDataURL(file)
          }
        }}
      />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} />
    </div>
  )
}

export default ProfessionalCertificateEditor

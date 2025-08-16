"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ImageIcon, Type, AlignCenter, AlignLeft, AlignRight, Trash2 } from "lucide-react"
import type { CertificateTemplate } from "@/lib/types"

interface Element {
  id: string
  type: "text" | "image"
  x: number
  y: number
  width: number
  height: number
  text?: string
  font?: string
  fontSize?: number
  color?: string
  textAlign?: "left" | "center" | "right"
  imageUrl?: string
  fontWeight?: "normal" | "bold"
  fontStyle?: "normal" | "italic"
}

interface VisualCertificateEditorProps {
  template: Partial<CertificateTemplate>
  onTemplateChange: (template: Partial<CertificateTemplate>) => void
}

const FONT_FAMILIES = [
  { label: "Helvetica", value: "helvetica" },
  { label: "Times New Roman", value: "times" },
  { label: "Courier New", value: "courier" },
]

export default function VisualCertificateEditor({ template, onTemplateChange }: VisualCertificateEditorProps) {
  const [elements, setElements] = useState<Element[]>(template.template_data?.elements || [])
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [canvasSize, setCanvasSize] = useState({
    width: template.template_data?.canvasWidth || 960,
    height: template.template_data?.canvasHeight || 540,
  })
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>(template.template_data?.backgroundImage)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const getLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    if (!text) return [""]
    const words = text.split(" ")
    const lines = []
    let currentLine = words[0] || ""

    for (let i = 1; i < words.length; i++) {
      const word = words[i]
      const width = ctx.measureText(currentLine + " " + word).width
      if (width < maxWidth) {
        currentLine += " " + word
      } else {
        lines.push(currentLine)
        currentLine = word
      }
    }
    lines.push(currentLine)
    return lines
  }

  const updateTemplate = useCallback(
    (updatedFields: Partial<CertificateTemplate["template_data"]>) => {
      onTemplateChange({
        ...template,
        template_data: {
          ...template.template_data,
          canvasWidth: canvasSize.width,
          canvasHeight: canvasSize.height,
          backgroundImage,
          elements,
          ...updatedFields,
        },
      })
    },
    [onTemplateChange, template, canvasSize, backgroundImage, elements],
  )

  useEffect(() => {
    updateTemplate({ elements })
  }, [elements, updateTemplate])

  const drawElements = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      elements.forEach((el) => {
        if (el.type === "text") {
          ctx.font = `${el.fontWeight || "normal"} ${el.fontStyle || "normal"} ${el.fontSize || 16}px ${
            el.font || "helvetica"
          }`
          ctx.fillStyle = el.color || "#000000"
          ctx.textAlign = el.textAlign || "left"
          const xPos =
            el.textAlign === "center" ? el.x + el.width / 2 : el.textAlign === "right" ? el.x + el.width : el.x
          ctx.textBaseline = "top"

          const lines = getLines(ctx, el.text || "", el.width)
          const lineHeight = (el.fontSize || 16) * 1.2
          const textHeight = lines.length * lineHeight
          const startY = el.y + (el.height - textHeight) / 2

          lines.forEach((line, i) => {
            ctx.fillText(line, xPos, startY + i * lineHeight)
          })
        } else if (el.type === "image" && el.imageUrl) {
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.src = el.imageUrl
          img.onload = () => {
            // Redraw canvas after image loads to ensure correct layering
            const canvas = canvasRef.current
            if (!canvas) return
            const redrawCtx = canvas.getContext("2d")
            if (!redrawCtx) return
            redrawCtx.clearRect(0, 0, canvas.width, canvas.height)
            if (backgroundImage) {
              const bgImg = new Image()
              bgImg.crossOrigin = "anonymous"
              bgImg.src = backgroundImage
              bgImg.onload = () => {
                redrawCtx.drawImage(bgImg, 0, 0, canvas.width, canvas.height)
                drawElements(redrawCtx)
              }
            } else {
              redrawCtx.fillStyle = "#f0f0f0"
              redrawCtx.fillRect(0, 0, canvas.width, canvas.height)
              drawElements(redrawCtx)
            }
          }
          ctx.drawImage(img, el.x, el.y, el.width, el.height)
        }

        if (el.id === selectedElementId) {
          ctx.strokeStyle = "#007bff"
          ctx.lineWidth = 2
          ctx.strokeRect(el.x, el.y, el.width, el.height)
        }
      })
    },
    [elements, selectedElementId, backgroundImage],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (backgroundImage) {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = backgroundImage
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        drawElements(ctx)
      }
      img.onerror = () => {
        // If background fails, draw fallback and elements
        ctx.fillStyle = "#f0f0f0"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        drawElements(ctx)
      }
    } else {
      ctx.fillStyle = "#f0f0f0"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      drawElements(ctx)
    }
  }, [elements, canvasSize, backgroundImage, drawElements])

  const addElement = (type: "text" | "image") => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")

    const defaultText = "Novo Texto"
    const defaultFontSize = 24
    const defaultWidth = 200
    const defaultFont = "helvetica"
    let initialHeight = type === "text" ? 50 : 100

    if (type === "text" && ctx) {
      ctx.font = `normal normal ${defaultFontSize}px ${defaultFont}`
      const lines = getLines(ctx, defaultText, defaultWidth)
      const lineHeight = defaultFontSize * 1.2
      initialHeight = Math.max(lines.length * lineHeight, lineHeight)
    }

    const newElement: Element = {
      id: Date.now().toString(),
      type,
      x: 50,
      y: 50,
      width: type === "text" ? defaultWidth : 100,
      height: initialHeight,
      text: type === "text" ? defaultText : undefined,
      font: defaultFont,
      fontSize: defaultFontSize,
      color: "#000000",
      textAlign: "left",
      fontWeight: "normal",
      fontStyle: "normal",
      imageUrl: type === "image" ? "/placeholder.svg?width=100&height=100" : undefined,
    }
    setElements([...elements, newElement])
    setSelectedElementId(newElement.id)
  }

  const updateElement = (props: Partial<Element>) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")

    setElements(
      elements.map((el) => {
        if (el.id === selectedElementId) {
          const updatedEl = { ...el, ...props }

          if (updatedEl.type === "text" && ctx) {
            const needsHeightRecalc =
              "text" in props ||
              "fontSize" in props ||
              "width" in props ||
              "font" in props ||
              "fontWeight" in props ||
              "fontStyle" in props
            if (needsHeightRecalc) {
              ctx.font = `${updatedEl.fontWeight || "normal"} ${updatedEl.fontStyle || "normal"} ${
                updatedEl.fontSize || 16
              }px ${updatedEl.font || "helvetica"}`
              const lines = getLines(ctx, updatedEl.text || "", updatedEl.width)
              const lineHeight = (updatedEl.fontSize || 16) * 1.2
              updatedEl.height = Math.max(lines.length * lineHeight, lineHeight)
            }
          }
          return updatedEl
        }
        return el
      }),
    )
  }

  const deleteElement = () => {
    if (selectedElementId) {
      setElements(elements.filter((el) => el.id !== selectedElementId))
      setSelectedElementId(null)
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Find clicked element from top to bottom
    const clickedElement = [...elements]
      .reverse()
      .find((el) => x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height)

    if (clickedElement) {
      setSelectedElementId(clickedElement.id)
      setIsDragging(true)
      setDragStart({ x: x - clickedElement.x, y: y - clickedElement.y })
    } else {
      setSelectedElementId(null)
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && selectedElementId) {
      const rect = canvasRef.current!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      updateElement({ x: x - dragStart.x, y: y - dragStart.y })
    }
  }

  const handleCanvasMouseUp = () => {
    setIsDragging(false)
  }

  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        setBackgroundImage(dataUrl)
        updateTemplate({ backgroundImage: dataUrl })
      }
      reader.readAsDataURL(file)
    }
  }

  const selectedElement = elements.find((el) => el.id === selectedElementId)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <div className="flex gap-2 mb-4">
          <Button onClick={() => addElement("text")} variant="outline">
            <Type className="mr-2 h-4 w-4" /> Adicionar Texto
          </Button>
          <Button onClick={() => addElement("image")} variant="outline">
            <ImageIcon className="mr-2 h-4 w-4" /> Adicionar Imagem
          </Button>
        </div>
        <div className="bg-gray-200 p-2 inline-block overflow-auto">
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="border border-gray-400"
            style={{
              width: canvasSize.width,
              height: canvasSize.height,
              maxWidth: "100%",
              maxHeight: "calc(100vh - 200px)",
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Propriedades</h3>
        <div className="space-y-4">
          <div>
            <Label>Fundo do Certificado</Label>
            <Input type="file" accept="image/*" onChange={handleBackgroundImageUpload} />
          </div>
          <div>
            <Label>Largura do Canvas (px)</Label>
            <Input
              type="number"
              value={canvasSize.width}
              onChange={(e) => setCanvasSize({ ...canvasSize, width: Number.parseInt(e.target.value) })}
            />
          </div>
          <div>
            <Label>Altura do Canvas (px)</Label>
            <Input
              type="number"
              value={canvasSize.height}
              onChange={(e) => setCanvasSize({ ...canvasSize, height: Number.parseInt(e.target.value) })}
            />
          </div>
        </div>

        {selectedElement && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-md font-semibold">
                Elemento: {selectedElement.type === "text" ? "Texto" : "Imagem"}
              </h4>
              <Button onClick={deleteElement} variant="destructive" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              {selectedElement.type === "text" && (
                <>
                  <div>
                    <Label>Conteúdo</Label>
                    <Input
                      value={selectedElement.text || ""}
                      onChange={(e) => updateElement({ text: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Fonte</Label>
                    <Select
                      value={selectedElement.font || "helvetica"}
                      onValueChange={(value) => updateElement({ font: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a font" />
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
                  <div>
                    <Label>Tamanho da Fonte</Label>
                    <Input
                      type="number"
                      value={selectedElement.fontSize || 16}
                      onChange={(e) => updateElement({ fontSize: Number.parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Cor</Label>
                    <Input
                      type="color"
                      value={selectedElement.color || "#000000"}
                      onChange={(e) => updateElement({ color: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Alinhamento</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={selectedElement.textAlign === "left" ? "secondary" : "outline"}
                        size="icon"
                        onClick={() => updateElement({ textAlign: "left" })}
                      >
                        <AlignLeft />
                      </Button>
                      <Button
                        variant={selectedElement.textAlign === "center" ? "secondary" : "outline"}
                        size="icon"
                        onClick={() => updateElement({ textAlign: "center" })}
                      >
                        <AlignCenter />
                      </Button>
                      <Button
                        variant={selectedElement.textAlign === "right" ? "secondary" : "outline"}
                        size="icon"
                        onClick={() => updateElement({ textAlign: "right" })}
                      >
                        <AlignRight />
                      </Button>
                    </div>
                  </div>
                </>
              )}
              {selectedElement.type === "image" && (
                <div>
                  <Label>URL da Imagem</Label>
                  <Input
                    value={selectedElement.imageUrl || ""}
                    onChange={(e) => updateElement({ imageUrl: e.target.value })}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Largura</Label>
                  <Input
                    type="number"
                    value={selectedElement.width}
                    onChange={(e) => updateElement({ width: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Altura</Label>
                  <Input
                    type="number"
                    value={selectedElement.height}
                    onChange={(e) => updateElement({ height: Number(e.target.value) })}
                    disabled={selectedElement.type === "text"}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Stage, Layer, Text, Image as KonvaImage, Transformer } from "react-konva"
import useImage from "use-image"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ElementData {
  id: string
  type: "text" | "image" | "placeholder"
  x: number
  y: number
  width: number
  height: number
  text?: string
  fontSize?: number
  fontFamily?: string
  fill?: string
  image?: string
  placeholderName?: string
}

const ProfessionalCertificateEditor = () => {
  const [elements, setElements] = useState<ElementData[]>([])
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [imageURL, setImageURL] = useState<string | null>(null)
  const stageRef = useRef<any>(null)

  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(600)

  const handleAddText = () => {
    const newElement: ElementData = {
      id: crypto.randomUUID(),
      type: "text",
      x: 50,
      y: 50,
      width: 200,
      height: 50,
      text: "Novo Texto",
      fontSize: 20,
      fontFamily: "Arial",
      fill: "black",
    }
    setElements([...elements, newElement])
  }

  const handleAddImage = () => {
    if (imageURL) {
      const newElement: ElementData = {
        id: crypto.randomUUID(),
        type: "image",
        x: 50,
        y: 50,
        width: 200,
        height: 150,
        image: imageURL,
      }
      setElements([...elements, newElement])
    } else {
      alert("Por favor, adicione uma URL de imagem.")
    }
  }

  const handleAddPlaceholder = () => {
    const newElement: ElementData = {
      id: crypto.randomUUID(),
      type: "placeholder",
      x: 50,
      y: 50,
      width: 200,
      height: 50,
      placeholderName: "Nome Completo",
      fontSize: 20,
      fontFamily: "Arial",
      fill: "black",
    }
    setElements([...elements, newElement])
  }

  const handleElementChange = (id: string, changes: Partial<ElementData>) => {
    setElements(elements.map((element) => (element.id === id ? { ...element, ...changes } : element)))
  }

  const handleStageClick = (e: any) => {
    if (e.target === e.target.getStage()) {
      setSelectedElementId(null)
    }
  }

  const handleElementClick = (id: string) => {
    setSelectedElementId(id)
  }

  const selectedElementData = elements.find((element) => element.id === selectedElementId) || ({} as ElementData)

  return (
    <div className="flex h-screen">
      <div className="w-full">
        <div className="p-4">
          <div className="flex gap-2">
            <Button onClick={handleAddText}>Adicionar Texto</Button>
            <Button onClick={handleAddImage}>Adicionar Imagem</Button>
            <Button onClick={handleAddPlaceholder}>Adicionar Placeholder</Button>
          </div>
        </div>
        <Stage
          width={width}
          height={height}
          style={{ border: "1px solid gray", margin: "0 auto", display: "block" }}
          onClick={handleStageClick}
          ref={stageRef}
        >
          <Layer>
            {elements.map((element) => {
              if (element.type === "text") {
                return (
                  <Text
                    key={element.id}
                    x={element.x}
                    y={element.y}
                    text={element.text || ""}
                    fontSize={element.fontSize}
                    fontFamily={element.fontFamily}
                    fill={element.fill}
                    draggable
                    onClick={() => handleElementClick(element.id)}
                    onDragEnd={(e) => {
                      handleElementChange(element.id, { x: e.target.x(), y: e.target.y() })
                    }}
                    onTransformEnd={(e) => {
                      const node = e.target
                      handleElementChange(element.id, {
                        x: node.x(),
                        y: node.y(),
                        width: node.width() * node.scaleX(),
                        height: node.height() * node.scaleY(),
                      })
                    }}
                  />
                )
              }

              if (element.type === "image") {
                return (
                  <ImageElement
                    key={element.id}
                    element={element}
                    isSelected={element.id === selectedElementId}
                    onSelect={() => handleElementClick(element.id)}
                    onChange={(changes: Partial<ElementData>) => handleElementChange(element.id, changes)}
                  />
                )
              }

              if (element.type === "placeholder") {
                return (
                  <Text
                    key={element.id}
                    x={element.x}
                    y={element.y}
                    text={`{{${element.placeholderName}}}`}
                    fontSize={element.fontSize}
                    fontFamily={element.fontFamily}
                    fill={element.fill}
                    draggable
                    onClick={() => handleElementClick(element.id)}
                    onDragEnd={(e) => {
                      handleElementChange(element.id, { x: e.target.x(), y: e.target.y() })
                    }}
                    onTransformEnd={(e) => {
                      const node = e.target
                      handleElementChange(element.id, {
                        x: node.x(),
                        y: node.y(),
                        width: node.width() * node.scaleX(),
                        height: node.height() * node.scaleY(),
                      })
                    }}
                  />
                )
              }

              return null
            })}
          </Layer>
        </Stage>
      </div>

      <div className="w-80 bg-white border-l flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Propriedades</h3>
          <p className="text-xs text-gray-600">
            {selectedElementData.type === "text" && "Elemento de Texto"}
            {selectedElementData.type === "placeholder" && "Placeholder Dinâmico"}
            {selectedElementData.type === "image" && "Elemento de Imagem"}
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {selectedElementData.type === "text" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="text">Texto</Label>
                  <Input
                    id="text"
                    value={selectedElementData.text || ""}
                    onChange={(e) => handleElementChange(selectedElementId as string, { text: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fontSize">Tamanho da Fonte</Label>
                  <Input
                    id="fontSize"
                    type="number"
                    value={selectedElementData.fontSize?.toString() || ""}
                    onChange={(e) =>
                      handleElementChange(selectedElementId as string, { fontSize: Number.parseInt(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fontFamily">Fonte</Label>
                  <Input
                    id="fontFamily"
                    value={selectedElementData.fontFamily || ""}
                    onChange={(e) => handleElementChange(selectedElementId as string, { fontFamily: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fill">Cor</Label>
                  <Input
                    id="fill"
                    value={selectedElementData.fill || ""}
                    onChange={(e) => handleElementChange(selectedElementId as string, { fill: e.target.value })}
                  />
                </div>
              </>
            )}

            {selectedElementData.type === "image" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="imageURL">URL da Imagem</Label>
                  <Input
                    id="imageURL"
                    value={selectedElementData.image || ""}
                    onChange={(e) => handleElementChange(selectedElementId as string, { image: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="width">Largura</Label>
                  <Input
                    id="width"
                    type="number"
                    value={selectedElementData.width?.toString() || ""}
                    onChange={(e) =>
                      handleElementChange(selectedElementId as string, { width: Number.parseInt(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Altura</Label>
                  <Input
                    id="height"
                    type="number"
                    value={selectedElementData.height?.toString() || ""}
                    onChange={(e) =>
                      handleElementChange(selectedElementId as string, { height: Number.parseInt(e.target.value) })
                    }
                  />
                </div>
              </>
            )}

            {selectedElementData.type === "placeholder" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="placeholderName">Nome do Placeholder</Label>
                  <Input
                    id="placeholderName"
                    value={selectedElementData.placeholderName || ""}
                    onChange={(e) =>
                      handleElementChange(selectedElementId as string, { placeholderName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fontSize">Tamanho da Fonte</Label>
                  <Input
                    id="fontSize"
                    type="number"
                    value={selectedElementData.fontSize?.toString() || ""}
                    onChange={(e) =>
                      handleElementChange(selectedElementId as string, { fontSize: Number.parseInt(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fontFamily">Fonte</Label>
                  <Input
                    id="fontFamily"
                    value={selectedElementData.fontFamily || ""}
                    onChange={(e) => handleElementChange(selectedElementId as string, { fontFamily: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fill">Cor</Label>
                  <Input
                    id="fill"
                    value={selectedElementData.fill || ""}
                    onChange={(e) => handleElementChange(selectedElementId as string, { fill: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

interface ImageElementProps {
  element: ElementData
  isSelected: boolean
  onSelect: () => void
  onChange: (changes: Partial<ElementData>) => void
}

const ImageElement: React.FC<ImageElementProps> = ({ element, isSelected, onSelect, onChange }) => {
  const [image] = useImage(element.image || "")
  const transformerRef = useRef<any>(null)

  useEffect(() => {
    if (isSelected && transformerRef.current) {
      transformerRef.current.nodes([transformerRef.current.node()])
      transformerRef.current.getLayer().batchDraw()
    }
  }, [isSelected])

  return (
    <>
      <KonvaImage
        image={image}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        draggable
        onClick={onSelect}
        onDragEnd={(e) => {
          onChange({ x: e.target.x(), y: e.target.y() })
        }}
        onTransformEnd={(e) => {
          const node = e.target
          onChange({
            x: node.x(),
            y: node.y(),
            width: node.width() * node.scaleX(),
            height: node.height() * node.scaleY(),
          })
        }}
      />
      {isSelected && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox
            }
            return newBox
          }}
        />
      )}
    </>
  )
}

export default ProfessionalCertificateEditor

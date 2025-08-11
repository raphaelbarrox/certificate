"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useAuth } from "./auth-provider"

interface CreateFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFolderCreated: () => void
}

const colors = ["#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#f97316", "#ef4444", "#64748b", "#6366f1"]

export default function CreateFolderDialog({ open, onOpenChange, onFolderCreated }: CreateFolderDialogProps) {
  const [name, setName] = useState("")
  const [selectedColor, setSelectedColor] = useState(colors[0])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()

  const handleCreateFolder = async () => {
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", description: "Por favor, dê um nome para a pasta.", variant: "destructive" })
      return
    }
    if (!user) {
      toast({ title: "Erro de autenticação", description: "Faça login para criar uma pasta.", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.from("folders").insert({
        name: name.trim(),
        color: selectedColor,
        user_id: user.id,
      })

      if (error) throw error

      toast({ title: "Pasta criada!", description: `A pasta "${name}" foi criada com sucesso.` })
      onFolderCreated()
      onOpenChange(false)
      setName("")
      setSelectedColor(colors[0])
    } catch (error) {
      console.error("Error creating folder:", error)
      toast({ title: "Erro ao criar pasta", description: "Tente novamente.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Nova Pasta</DialogTitle>
          <DialogDescription>Dê um nome e escolha uma cor para sua nova pasta.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Nome
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="Ex: Cursos de Marketing"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Cor</Label>
            <div className="col-span-3 flex space-x-2">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 ${
                    selectedColor === color ? "ring-2 ring-offset-2 ring-blue-500" : ""
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreateFolder} disabled={loading}>
            {loading ? "Criando..." : "Criar Pasta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

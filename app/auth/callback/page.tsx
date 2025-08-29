"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function AuthCallback() {
  const [processing, setProcessing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const supabase = createClient()
        console.log("[v0] Processando callback de autenticação...")

        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error("[v0] Erro durante callback:", error)
          setError("Erro na autenticação")
          setTimeout(() => {
            window.location.href = "/auth/login?error=callback_error"
          }, 2000)
          return
        }

        if (data.session?.user) {
          console.log("[v0] Callback bem-sucedido, redirecionando:", data.session.user.id)

          setTimeout(() => {
            window.location.href = "/dashboard"
          }, 500)
        } else {
          console.log("[v0] Nenhuma sessão encontrada no callback")
          setTimeout(() => {
            window.location.href = "/auth/login"
          }, 1000)
        }
      } catch (error) {
        console.error("[v0] Erro inesperado no callback:", error)
        setError("Erro inesperado")
        setTimeout(() => {
          window.location.href = "/auth/login?error=unexpected_error"
        }, 2000)
      } finally {
        setProcessing(false)
      }
    }

    handleAuthCallback()
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">❌</div>
          <p className="text-gray-600">{error}</p>
          <p className="text-sm text-gray-500 mt-2">Redirecionando...</p>
        </div>
      </div>
    )
  }

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processando autenticação...</p>
          <p className="text-sm text-gray-500 mt-2">Aguarde...</p>
        </div>
      </div>
    )
  }

  return null
}

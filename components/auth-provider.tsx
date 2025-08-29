"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshSession: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const supabase = useMemo(() => createClient(), [])

  const refreshSession = useCallback(async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        console.error("[v0] Erro ao obter sessão:", error)
        setUser(null)
        return
      }

      console.log("[v0] Sessão atualizada:", session?.user?.id || "sem usuário")
      setUser(session?.user ?? null)
    } catch (error) {
      console.error("[v0] Erro inesperado ao atualizar sessão:", error)
      setUser(null)
    }
  }, [supabase])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      window.location.href = "/auth/login"
    } catch (error) {
      console.error("[v0] Erro ao fazer logout:", error)
    }
  }, [supabase])

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (!mounted) return

        if (error) {
          console.error("[v0] Erro na inicialização:", error)
          setUser(null)
        } else {
          console.log("[v0] Sessão inicial:", session?.user?.id || "sem usuário")
          setUser(session?.user ?? null)
        }
      } catch (error) {
        console.error("[v0] Erro inesperado na inicialização:", error)
        if (mounted) setUser(null)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log("[v0] Mudança de estado auth:", event, session?.user?.id || "sem usuário")

      if (event === "SIGNED_OUT") {
        setUser(null)
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        setUser(session?.user ?? null)
      }

      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const contextValue = useMemo(
    () => ({
      user,
      loading,
      signOut,
      refreshSession,
    }),
    [user, loading, signOut, refreshSession],
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

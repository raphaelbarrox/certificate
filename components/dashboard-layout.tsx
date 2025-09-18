"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, FileText, Award, LogOut, User } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { LoadingSpinner } from "@/components/loading-spinner"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Carregando dashboard..." />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-sm border-r border-gray-200">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900">Certificados</h1>
        </div>

        <nav className="mt-6" role="navigation" aria-label="Menu principal">
          <div className="px-3">
            <Link
              href="/dashboard"
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Ir para dashboard"
            >
              <LayoutDashboard className="mr-3 h-5 w-5" aria-hidden="true" />
              Dashboard
            </Link>

            <Link
              href="/dashboard/templates"
              className="flex items-center px-3 py-2 mt-1 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Gerenciar templates"
            >
              <FileText className="mr-3 h-5 w-5" aria-hidden="true" />
              Templates
            </Link>

            <Link
              href="/dashboard/certificates"
              className="flex items-center px-3 py-2 mt-1 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Ver certificados emitidos"
            >
              <Award className="mr-3 h-5 w-5" aria-hidden="true" />
              Certificados
            </Link>
          </div>
        </nav>

        {/* User section */}
        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <User className="h-8 w-8 text-gray-400" aria-hidden="true" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate" title={user.email}>
                {user.email}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="ml-2" aria-label="Fazer logout">
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <main className="p-8" role="main">
          {children}
        </main>
      </div>
    </div>
  )
}

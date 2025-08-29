"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, FileText, Award, LogOut, User } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await signOut()
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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

        <nav className="mt-6">
          <div className="px-3">
            <Link
              href="/dashboard"
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900"
            >
              <LayoutDashboard className="mr-3 h-5 w-5" />
              Dashboard
            </Link>

            <Link
              href="/dashboard/templates"
              className="flex items-center px-3 py-2 mt-1 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900"
            >
              <FileText className="mr-3 h-5 w-5" />
              Templates
            </Link>

            <Link
              href="/dashboard/certificates"
              className="flex items-center px-3 py-2 mt-1 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900"
            >
              <Award className="mr-3 h-5 w-5" />
              Certificados
            </Link>
          </div>
        </nav>

        {/* User section */}
        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <User className="h-8 w-8 text-gray-400" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="ml-2">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <main className="p-8">{children}</main>
      </div>
    </div>
  )
}

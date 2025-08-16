"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Award, Search, Calendar, User, Hash, Download, LinkIcon } from "lucide-react"
import Link from "next/link"

interface IssuedCertificate {
  id: string
  certificate_number: string
  recipient_data: any
  recipient_email: string | null
  issued_at: string
  certificate_templates: {
    title: string
  }
}

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [certificates, setCertificates] = useState<IssuedCertificate[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState("")

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError("Digite um código de certificado ou email para pesquisar")
      return
    }

    setLoading(true)
    setError("")
    setSearched(true)

    try {
      const response = await fetch(`/api/search-certificates?q=${encodeURIComponent(searchTerm.trim())}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro na pesquisa")
      }

      setCertificates(data.certificates || [])
    } catch (error) {
      console.error("Error searching certificates:", error)
      setError("Erro ao pesquisar certificados. Tente novamente.")
      setCertificates([])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pesquisar Certificados</h1>
          <p className="text-gray-600">
            Digite o código exato do certificado ou email exato para encontrar seus certificados
          </p>
        </div>

        {/* Search Card */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Digite o código exato do certificado ou email exato..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={loading || !searchTerm.trim()} className="sm:w-auto w-full">
                {loading ? "Pesquisando..." : "Pesquisar"}
              </Button>
            </div>
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          </CardContent>
        </Card>

        {/* Results */}
        {searched && (
          <div className="space-y-6">
            {loading ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Buscando...</p>
                </CardContent>
              </Card>
            ) : certificates.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Award className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum certificado encontrado</h3>
                  <p className="text-gray-600">
                    Verifique se o código ou email estão exatamente corretos e tente novamente.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Resultados da Pesquisa</h2>
                  <Badge variant="outline" className="text-sm">
                    {certificates.length}{" "}
                    {certificates.length === 1 ? "certificado encontrado" : "certificados encontrados"}
                  </Badge>
                </div>

                <div className="space-y-4">
                  {certificates.map((certificate) => (
                    <Card key={certificate.id} className="hover:shadow-md transition-shadow duration-200">
                      <CardContent className="p-6">
                        {/* Header with title and certificate number */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                          <div className="flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                              <Badge variant="secondary" className="text-sm font-medium w-fit">
                                {certificate.certificate_templates.title}
                              </Badge>
                              <Badge variant="outline" className="text-xs font-mono w-fit">
                                <Hash className="h-3 w-3 mr-1" />
                                {certificate.certificate_number}
                              </Badge>
                            </div>
                          </div>

                          {/* Action buttons - positioned at top right on desktop */}
                          <div className="flex flex-col sm:flex-row gap-2 sm:ml-4 flex-shrink-0">
                            <Button asChild size="sm" className="w-full sm:w-auto">
                              <a href={`/api/certificates/${certificate.id}/download`}>
                                <Download className="h-4 w-4 mr-2" />
                                Baixar Certificado
                              </a>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto bg-transparent">
                              <Link href={`/certificates/${certificate.certificate_number}`}>
                                <LinkIcon className="h-4 w-4 mr-2" />
                                Ver Página
                              </Link>
                            </Button>
                          </div>
                        </div>

                        {/* Certificate details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                          {Object.entries(certificate.recipient_data).map(([key, value]) => {
                            // Skip displaying image URLs as they are too long
                            if (
                              key.toLowerCase().includes("imagem") ||
                              (typeof value === "string" && value.startsWith("http") && value.length > 50)
                            ) {
                              return null
                            }

                            return (
                              <div key={key} className="flex items-start gap-2 text-sm">
                                <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <span className="font-medium text-gray-700 capitalize">
                                    {key.replace(/_/g, " ")}:
                                  </span>
                                  <span className="ml-2 text-gray-600 break-words">
                                    {value ? String(value) : "N/A"}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Issue date */}
                        <div className="flex items-center gap-2 text-sm text-gray-500 pt-3 border-t border-gray-100">
                          <Calendar className="h-4 w-4" />
                          <span>Emitido em {new Date(certificate.issued_at).toLocaleString("pt-BR")}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

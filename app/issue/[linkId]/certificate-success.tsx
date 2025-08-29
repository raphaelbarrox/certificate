"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, CheckCircle, Search, Edit, User } from "lucide-react"
import Link from "next/link"

interface IssuedCertificate {
  id: string
  certificate_number: string
  pdf_url: string
}

interface SpecialOffer {
  id: string
  image: string
  title: string
  description: string
  price: string
  priceText: string
  buttonText: string
  buttonUrl: string
}

interface FormDesign {
  primaryColor: string
  backgroundColor: string
  textColor: string
  borderRadius: number
  showLogo: boolean
  logoUrl?: string
  title: string
  description: string
  submitButtonText: string
  successMessage: string
  specialOffers: SpecialOffer[]
  footerEnabled: boolean
  footerText: string
}

interface CertificateSuccessProps {
  issuedCertificate: IssuedCertificate
  design: FormDesign
  onEdit: () => void
  error?: string | null
}

export function CertificateSuccess({ issuedCertificate, design, onEdit, error }: CertificateSuccessProps) {
  return (
    <div
      className="rounded-lg shadow-lg overflow-hidden w-full"
      style={{
        backgroundColor: design.backgroundColor,
        color: design.textColor,
        borderRadius: `${design.borderRadius}px`,
      }}
    >
      <Card>
        <CardContent className="text-center p-6 md:py-8">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <CheckCircle className="w-12 h-12 md:w-16 md:h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl md:text-2xl font-bold text-green-700 mb-2">Certificado Emitido!</h2>
          <div
            className="prose prose-sm max-w-none text-center mx-auto mb-4 [&_a]:text-blue-600 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: design.successMessage }}
          />
          <p className="text-gray-600 mb-4 text-sm md:text-base">
            Número: <strong>{issuedCertificate.certificate_number}</strong>
          </p>
          <div className="flex flex-col gap-3">
            <a
              href={issuedCertificate.pdf_url}
              download={`certificado-${issuedCertificate.certificate_number}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button size="lg" style={{ backgroundColor: design.primaryColor }} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Baixar Certificado
              </Button>
            </a>
            <Button
              variant="outline"
              size="lg"
              className="w-full bg-transparent"
              style={{
                borderColor: design.primaryColor,
                color: design.primaryColor,
              }}
              onClick={onEdit}
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar Informações
            </Button>
            <Link href={`/certificates/${issuedCertificate.certificate_number}`} className="block">
              <Button
                variant="outline"
                size="lg"
                className="w-full bg-transparent"
                style={{
                  borderColor: design.primaryColor,
                  color: design.primaryColor,
                }}
              >
                <User className="w-4 h-4 mr-2" />
                Ver Página Pessoal
              </Button>
            </Link>
            <Link href="/search" className="block">
              <Button
                variant="outline"
                size="lg"
                className="w-full bg-transparent"
                style={{
                  borderColor: design.primaryColor,
                  color: design.primaryColor,
                }}
              >
                <Search className="w-4 h-4 mr-2" />
                Pesquisar Outro Certificado
              </Button>
            </Link>
          </div>

          {/* Special Offers Section */}
          {design.specialOffers && design.specialOffers.length > 0 && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-lg font-bold text-gray-800 mb-6 text-left">Ofertas Especiais:</h3>
              <div className="space-y-4">
                {design.specialOffers.map((offer) => (
                  <div
                    key={offer.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
                  >
                    <div className="flex items-center p-4 gap-4">
                      {/* Image */}
                      <div className="flex-shrink-0">
                        <img
                          src={offer.image || "/placeholder.svg"}
                          alt={offer.title}
                          className="w-24 h-24 md:w-28 md:h-28 object-cover rounded-lg border border-gray-100"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-left">
                          <h4 className="text-lg md:text-xl font-bold text-gray-900 mb-2 leading-tight">
                            {offer.title}
                          </h4>
                          {offer.description && (
                            <p className="text-sm md:text-base text-gray-600 mb-3 leading-relaxed">
                              {offer.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="text-left">
                              <span className="text-sm text-gray-500 block">{offer.priceText}</span>
                              <span className="text-2xl md:text-3xl font-bold text-green-600">{offer.price}</span>
                            </div>
                            <a
                              href={offer.buttonUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0"
                            >
                              <Button
                                size="lg"
                                style={{ backgroundColor: design.primaryColor }}
                                className="text-white font-semibold px-6 py-3 hover:opacity-90 transition-opacity"
                              >
                                {offer.buttonText}
                              </Button>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

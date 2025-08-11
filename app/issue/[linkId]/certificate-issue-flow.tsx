"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { CertificateIssueForm } from "./certificate-issue-form"
import { CertificateSuccess } from "./certificate-success"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import useLocalStorage from "@/hooks/use-local-storage"
import { applyCpfMask, unmask } from "@/lib/masks"

type FlowState = "pre-check" | "form" | "success"

interface IssuedCertificate {
  id: string
  certificate_number: string
  pdf_url: string
  recipient_data: Record<string, any>
}

export function CertificateIssueFlow({ linkId }: { linkId: string }) {
  const [template, setTemplate] = useState<any | null>(null)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true)
  const [templateError, setTemplateError] = useState<string | null>(null)

  const [flowState, setFlowState] = useLocalStorage<FlowState>(`flowState-${linkId}`, "pre-check")
  const [cpf, setCpf] = useLocalStorage<string>(`userCpf-${linkId}`, "")
  const [dob, setDob] = useLocalStorage<string>(`userDob-${linkId}`, "")
  const [issuedCertificate, setIssuedCertificate] = useLocalStorage<IssuedCertificate | null>(
    `issuedCertificate-${linkId}`,
    null,
  )
  const [isChecking, setIsChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        setIsLoadingTemplate(true)
        setTemplateError(null)
        const response = await fetch(`/api/templates/public/${linkId}`)
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Template não encontrado ou inativo.")
        }
        const data = await response.json()
        setTemplate(data)
      } catch (err) {
        setTemplateError(err instanceof Error ? err.message : "Erro ao carregar o template.")
      } finally {
        setIsLoadingTemplate(false)
      }
    }
    fetchTemplate()
  }, [linkId])

  const handleCheckSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!template) return

    setIsChecking(true)
    setCheckError(null)

    try {
      const response = await fetch("/api/check-certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: template.id, cpf: unmask(cpf), dob }),
      })

      if (response.ok) {
        const data = await response.json()
        setIssuedCertificate(data)
        setFlowState("success")
      } else {
        setIssuedCertificate(null)
        setFlowState("form")
      }
    } catch (err) {
      setCheckError("Ocorreu um erro ao verificar seus dados. Tente novamente.")
    } finally {
      setIsChecking(false)
    }
  }

  const handleSuccess = (certificate: IssuedCertificate) => {
    setIssuedCertificate(certificate)
    setFlowState("success")
  }

  const handleEdit = () => {
    setFlowState("form")
  }

  const handleCancelEdit = () => {
    if (issuedCertificate) {
      setFlowState("success")
    }
  }

  if (isLoadingTemplate) {
    return (
      <Card>
        <CardContent className="p-8 text-center flex flex-col items-center justify-center h-64">
          <Loader2 className="w-8 h-8 mb-4 animate-spin text-gray-500" />
          <p className="text-gray-600">Carregando informações do certificado...</p>
        </CardContent>
      </Card>
    )
  }

  if (templateError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{templateError}</AlertDescription>
      </Alert>
    )
  }

  if (!template) {
    return null // ou uma mensagem de fallback
  }

  const design = template.form_design?.design || {
    primaryColor: "#3b82f6",
    backgroundColor: "#ffffff",
    textColor: "#1f2937",
    borderRadius: 8,
    successMessage: "Parabéns! Seu certificado foi gerado com sucesso. Você pode baixá-lo clicando no botão abaixo.",
    specialOffers: [],
  }

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{template.title}</h1>
        {template.description && <p className="text-gray-600">{template.description}</p>}
      </div>

      {flowState === "success" && issuedCertificate ? (
        <CertificateSuccess issuedCertificate={issuedCertificate} design={design} onEdit={handleEdit} />
      ) : flowState === "form" ? (
        <CertificateIssueForm
          template={template}
          onSuccess={handleSuccess}
          prefilledCpf={unmask(cpf)}
          prefilledDob={dob}
          certificateToUpdate={issuedCertificate}
          onCancelEdit={handleCancelEdit}
        />
      ) : (
        <Card
          className="w-full"
          style={{
            backgroundColor: design.backgroundColor,
            color: design.textColor,
            borderRadius: `${design.borderRadius}px`,
          }}
        >
          <form onSubmit={handleCheckSubmit}>
            <CardContent className="p-6 md:p-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">Verificar Emissão</h2>
                <p className="text-gray-600" style={{ color: design.textColor, opacity: 0.8 }}>
                  Informe seus dados para continuar.
                </p>
              </div>
              <div className="space-y-4">
                {checkError && (
                  <Alert variant="destructive">
                    <AlertDescription>{checkError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="cpf-check">CPF</Label>
                  <Input
                    id="cpf-check"
                    type="text"
                    value={applyCpfMask(cpf)}
                    onChange={(e) => setCpf(unmask(e.target.value))}
                    required
                    placeholder="000.000.000-00"
                    style={{ borderRadius: `${design.borderRadius}px` }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob-check">Data de Nascimento</Label>
                  <Input
                    id="dob-check"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    required
                    style={{ borderRadius: `${design.borderRadius}px` }}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isChecking || !cpf || !dob}
                  className="w-full text-white"
                  size="lg"
                  style={{
                    backgroundColor: design.primaryColor,
                    borderRadius: `${design.borderRadius}px`,
                  }}
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Continuar"
                  )}
                </Button>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-gray-500" style={{ color: design.textColor, opacity: 0.7 }}>
                ⚠️ Caso não seja aluno, ou realize reembolso, chargeback, qualquer certificado gerado será
                automaticamente invalidado. Em caso de dúvida, suporte: Contact@therapist.international (atendimento 24h
                a 48h úteis).
              </p>
            </CardFooter>
          </form>
        </Card>
      )}
    </>
  )
}

import { EmailTestDashboard } from "@/components/email-test-dashboard"

export default function EmailTestPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Teste de Sistema de Email</h1>
        <p className="text-muted-foreground mt-2">
          Teste e valide suas configurações de email antes de ativar o envio automático de certificados
        </p>
      </div>

      <EmailTestDashboard />
    </div>
  )
}

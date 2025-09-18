import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Award, Users, Zap, Shield } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Award className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">CertGen</span>
          </div>
          <div className="space-x-4">
            <Link href="/search">
              <Button variant="ghost">Pesquisar Certificados</Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link href="/auth/register">
              <Button>Começar Grátis</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Crie e Emita
            <span className="text-blue-600"> Certificados</span>
            <br />
            de Forma Simples
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Plataforma moderna para criar modelos de certificados personalizados e compartilhar links para emissão
            automática. Perfeito para cursos, eventos e treinamentos.
          </p>
          <div className="space-x-4">
            <Link href="/auth/register">
              <Button size="lg" className="px-8 py-3">
                Começar Agora
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="px-8 py-3 bg-transparent">
                Ver Recursos
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Recursos Poderosos</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card>
              <CardHeader>
                <Award className="h-12 w-12 text-blue-600 mb-4" />
                <CardTitle>Templates Personalizados</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Crie modelos únicos com placeholders personalizáveis para qualquer tipo de certificado.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="h-12 w-12 text-green-600 mb-4" />
                <CardTitle>Emissão Automática</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Compartilhe links públicos para que outros possam emitir certificados automaticamente.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-12 w-12 text-purple-600 mb-4" />
                <CardTitle>Gestão Completa</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Dashboard completo para gerenciar templates, visualizar emissões e controlar acesso.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-12 w-12 text-red-600 mb-4" />
                <CardTitle>Seguro e Confiável</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Certificados com numeração única e sistema seguro de autenticação e armazenamento.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-blue-600 text-white">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Pronto para Começar?</h2>
          <p className="text-xl mb-8 opacity-90">Crie sua conta gratuita e comece a emitir certificados em minutos.</p>
          <Link href="/auth/register">
            <Button size="lg" variant="secondary" className="px-8 py-3">
              Criar Conta Grátis
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Award className="h-6 w-6" />
            <span className="text-xl font-bold">CertGen</span>
          </div>
          <p className="text-gray-400">© 2024 CertGen. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}

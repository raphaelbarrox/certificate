import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (data.user) {
      // Redirect server-side para garantir que a sessão seja mantida
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    return NextResponse.json({ error: "Login falhou" }, { status: 400 })
  } catch (error) {
    console.error("[v0] Erro na API de login:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

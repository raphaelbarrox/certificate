import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[v0] Configuração do Supabase incompleta:", {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
    })
    throw new Error("Configuração do Supabase incompleta")
  }

  console.log("[v0] Inicializando cliente Supabase SSR:", {
    url: supabaseUrl?.substring(0, 30) + "...",
    keyLength: supabaseAnonKey?.length,
  })

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

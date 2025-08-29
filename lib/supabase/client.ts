import { createBrowserClient } from "@supabase/ssr"

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!client) {
    console.log("[v0] Inicializando cliente Supabase:", {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + "...",
      keyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
    })

    client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  }

  return client
}

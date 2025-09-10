import { createClient } from "./supabase/client"

// Cliente principal usando SSR
export const supabase = createClient()

// Listener para mudanças de autenticação
supabase.auth.onAuthStateChange((event, session) => {
  console.log("[v0] Auth state changed:", event, session?.user?.id)
})

export const createServerClient = async () => {
  const { createClient: createServerClientFn } = await import("./supabase/server")
  return createServerClientFn()
}

// Tipos do banco de dados
export type Database = {
  public: {
    Tables: {
      folders: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color: string
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["folders"]["Row"]>
      }
      certificate_templates: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          template_data: any
          placeholders: any
          is_active: boolean
          public_link_id: string
          created_at: string
          updated_at: string
          folder_id: string | null
          form_design: {
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
            specialOffers: any[]
            footerEnabled: boolean
            footerText: string
            emailConfig?: {
              enabled: boolean
              senderName: string
              senderEmail: string
              subject: string
              body: string
              smtp: {
                host: string
                port: number
                user: string
                pass: string
                secure: boolean
              }
            }
          } | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          template_data: any
          placeholders: any
          is_active?: boolean
          public_link_id: string
          created_at?: string
          updated_at?: string
          folder_id?: string | null
          form_design?: {
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
            specialOffers: any[]
            footerEnabled: boolean
            footerText: string
            emailConfig?: {
              enabled: boolean
              senderName: string
              senderEmail: string
              subject: string
              body: string
              smtp: {
                host: string
                port: number
                user: string
                pass: string
                secure: boolean
              }
            }
          } | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          template_data?: any
          placeholders?: any
          is_active?: boolean
          public_link_id?: string
          created_at?: string
          updated_at?: string
          folder_id?: string | null
          form_design?: {
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
            specialOffers: any[]
            footerEnabled: boolean
            footerText: string
            emailConfig?: {
              enabled: boolean
              senderName: string
              senderEmail: string
              subject: string
              body: string
              smtp: {
                host: string
                port: number
                user: string
                pass: string
                secure: boolean
              }
            }
          } | null
        }
      }
      issued_certificates: {
        Row: {
          id: string
          template_id: string
          recipient_data: any
          recipient_email: string | null
          certificate_number: string
          issued_at: string
          photo_url: string | null
          pdf_url: string | null
        }
        Insert: {
          id?: string
          template_id: string
          recipient_data: any
          recipient_email?: string | null
          certificate_number: string
          issued_at?: string
          photo_url?: string | null
          pdf_url?: string | null
        }
        Update: {
          id?: string
          template_id?: string
          recipient_data?: any
          recipient_email?: string | null
          certificate_number?: string
          issued_at?: string
          photo_url?: string | null
          pdf_url?: string | null
        }
      }
    }
  }
}

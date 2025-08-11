import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: Request, { params }: { params: { linkId: string } }) {
  try {
    const { data: template, error } = await supabase
      .from("certificate_templates")
      .select("id, title, description, form_design, is_active")
      .eq("public_link_id", params.linkId)
      .eq("is_active", true)
      .single()

    if (error || !template) {
      return NextResponse.json({ error: "Template not found or not active" }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error("Error fetching public template:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = createClient()

  try {
    const { action } = await request.json()

    if (action === "check_orphaned") {
      // Get all PDF URLs from database
      const { data: certificates, error: dbError } = await supabase
        .from("issued_certificates")
        .select("pdf_url")
        .not("pdf_url", "is", null)

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`)
      }

      // Get all files from storage bucket
      const { data: files, error: storageError } = await supabase.storage
        .from("generated-certificates")
        .list("public", { limit: 1000 })

      if (storageError) {
        throw new Error(`Storage error: ${storageError.message}`)
      }

      const dbPdfPaths = new Set(
        certificates.map((cert) => cert.pdf_url?.split("/generated-certificates/")[1]).filter(Boolean),
      )

      const storagePdfPaths = files?.map((file) => `public/${file.name}`) || []

      const orphanedFiles = storagePdfPaths.filter((path) => !dbPdfPaths.has(path))

      return NextResponse.json({
        success: true,
        orphaned_count: orphanedFiles.length,
        orphaned_files: orphanedFiles,
        total_storage_files: storagePdfPaths.length,
        total_db_references: dbPdfPaths.size,
      })
    }

    if (action === "cleanup_orphaned") {
      const { files_to_delete } = await request.json()

      if (!Array.isArray(files_to_delete) || files_to_delete.length === 0) {
        return NextResponse.json({ error: "No files specified for deletion" }, { status: 400 })
      }

      const { data, error } = await supabase.storage.from("generated-certificates").remove(files_to_delete)

      if (error) {
        throw new Error(`Failed to delete files: ${error.message}`)
      }

      // Log cleanup operation
      await supabase.from("storage_cleanup_log").insert({
        cleanup_type: "orphaned_pdfs_removal",
        details: `Removed ${files_to_delete.length} orphaned PDF files`,
        files_removed: files_to_delete.length,
      })

      return NextResponse.json({
        success: true,
        deleted_count: files_to_delete.length,
        deleted_files: files_to_delete,
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Storage cleanup error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function GET() {
  const supabase = createClient()

  try {
    const { data: storageStats, error } = await supabase.rpc("get_storage_usage_by_template")

    if (error) {
      throw new Error(`Failed to get storage stats: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      storage_usage: storageStats,
    })
  } catch (error) {
    console.error("Storage stats error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

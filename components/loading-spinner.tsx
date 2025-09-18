import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
  text?: string
}

export function LoadingSpinner({ size = "md", className, text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  }

  return (
    <div className={cn("flex items-center justify-center", className)} role="status" aria-label={text || "Carregando"}>
      <Loader2 className={cn("animate-spin text-blue-600", sizeClasses[size])} />
      {text && <span className="ml-2 text-sm text-gray-600">{text}</span>}
      <span className="sr-only">{text || "Carregando..."}</span>
    </div>
  )
}

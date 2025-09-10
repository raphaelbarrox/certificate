export interface ImageOptimizationOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: "jpeg" | "webp" | "png"
}

export class ImageOptimizer {
  static async compressImage(file: File, options: ImageOptimizationOptions = {}): Promise<File> {
    const { maxWidth = 1920, maxHeight = 1080, quality = 0.8, format = "jpeg" } = options

    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()

      img.onload = () => {
        let { width, height } = img
        const aspectRatio = width / height

        if (width > maxWidth) {
          width = maxWidth
          height = width / aspectRatio
        }
        if (height > maxHeight) {
          height = maxHeight
          width = height * aspectRatio
        }

        canvas.width = width
        canvas.height = height

        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to compress image"))
              return
            }

            const compressedFile = new File([blob], file.name, {
              type: `image/${format}`,
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          },
          `image/${format}`,
          quality,
        )
      }

      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = URL.createObjectURL(file)
    })
  }

  static validateImageFile(file: File): { valid: boolean; error?: string } {
    if (!file.type.startsWith("image/")) {
      return { valid: false, error: "Arquivo deve ser uma imagem" }
    }

    const maxSize = 2 * 1024 * 1024 // 2MB limit
    if (file.size > maxSize) {
      return { valid: false, error: "Imagem deve ter no máximo 2MB" }
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: "Formato não suportado. Use JPEG, PNG ou WebP" }
    }

    return { valid: true }
  }
}

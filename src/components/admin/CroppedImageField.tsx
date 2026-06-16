import { useRef, useState } from "react"
import { ImagePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { api, assetUrl } from "@/lib/api"
import type { UploadKind } from "@/lib/api"
import { fileToDataUrl } from "@/lib/crop"
import { cn } from "@/lib/utils"
import { ImageCropDialog } from "./ImageCropDialog"

interface CroppedImageFieldProps {
  label: string
  /** Carpeta destino en public/uploads (creatures | leaders | maps). */
  kind: UploadKind
  /** Relación ancho/alto del recorte. */
  aspect: number
  /** "round" para tokens circulares (criaturas y líderes). */
  shape?: "rect" | "round"
  /** URL pública actual (/public/uploads/...), o null. */
  value: string | null
  onChange: (url: string | null) => void
}

/**
 * Campo de imagen de los mantenedores: elegir archivo → editor de recorte →
 * subida al backend → URL pública en el formulario.
 */
export function CroppedImageField({
  label,
  kind,
  aspect,
  shape = "rect",
  value,
  onChange,
}: CroppedImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingSrc, setPendingSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      setPendingSrc(await fileToDataUrl(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo")
    }
  }

  async function handleCropped(blob: Blob) {
    const { url } = await api.upload(kind, blob)
    onChange(url)
    setPendingSrc(null)
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={assetUrl(value)}
            alt={label}
            className={cn(
              "border-border size-16 border object-cover",
              shape === "round" ? "rounded-full" : "rounded-md",
            )}
          />
        ) : (
          <div
            className={cn(
              "border-border text-muted-foreground flex size-16 items-center justify-center border border-dashed",
              shape === "round" ? "rounded-full" : "rounded-md",
            )}
          >
            <ImagePlus className="size-5" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            {value ? "Reemplazar imagen" : "Subir imagen"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
            >
              <X className="size-4" /> Quitar
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <ImageCropDialog
        open={pendingSrc !== null}
        imageSrc={pendingSrc}
        aspect={aspect}
        shape={shape}
        title={`Recortar ${label.toLowerCase()}`}
        onCancel={() => setPendingSrc(null)}
        onConfirm={handleCropped}
      />
    </div>
  )
}

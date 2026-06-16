import { useState } from "react"
import Cropper from "react-easy-crop"
import type { Area } from "react-easy-crop"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { cropToBlob } from "@/lib/crop"

interface ImageCropDialogProps {
  open: boolean
  /** Data-URL o URL de la imagen original a recortar. */
  imageSrc: string | null
  /** Relación ancho/alto del recorte (1 para tokens, cols/rows para mapas). */
  aspect: number
  /** "round" recorta un token circular (con transparencia fuera del círculo). */
  shape?: "rect" | "round"
  title: string
  onCancel: () => void
  onConfirm: (blob: Blob) => Promise<void>
}

/** Editor de recorte (react-easy-crop): zoom + arrastre, confirma un PNG. */
export function ImageCropDialog({
  open,
  imageSrc,
  aspect,
  shape = "rect",
  title,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!imageSrc || !areaPixels) return
    setSaving(true)
    setError(null)
    try {
      const blob = await cropToBlob(imageSrc, areaPixels, {
        circular: shape === "round",
      })
      await onConfirm(blob)
      setZoom(1)
      setCrop({ x: 0, y: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el recorte")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Arrastra para encuadrar y usa el control para acercar la imagen.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted relative h-80 w-full overflow-hidden rounded-md">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={shape}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, pixels) => setAreaPixels(pixels)}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">Zoom</span>
          <Slider
            value={[zoom]}
            min={1}
            max={4}
            step={0.05}
            onValueChange={([value]) => setZoom(value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || !areaPixels}>
            {saving ? "Guardando…" : "Recortar y subir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

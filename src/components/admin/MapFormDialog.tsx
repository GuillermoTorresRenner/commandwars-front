import { useState } from "react"
import type { FormEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import type { GameMapDto } from "@/lib/api"
import { CroppedImageField } from "./CroppedImageField"

interface MapFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Mapa a editar, o null para crear. */
  initial: GameMapDto | null
  onSaved: () => void
}

interface FormState {
  name: string
  description: string
  cols: number
  rows: number
  cellSize: number
  image: string | null
}

const EMPTY: FormState = {
  name: "",
  description: "",
  cols: 13,
  rows: 9,
  cellSize: 64,
  image: null,
}

export function MapFormDialog({ open, onOpenChange, initial, onSaved }: MapFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar mapa" : "Nuevo mapa"}</DialogTitle>
          <DialogDescription>
            La imagen es decorado: la grilla lógica es la verdad del juego. El recorte
            de la imagen usa la proporción columnas/filas.
          </DialogDescription>
        </DialogHeader>
        {/* El contenido del Dialog se desmonta al cerrar, así el formulario
            siempre se monta fresco con el estado inicial correcto. */}
        <MapForm
          key={initial?.id ?? "new"}
          initial={initial}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  )
}

interface MapFormProps {
  initial: GameMapDto | null
  onClose: () => void
  onSaved: () => void
}

function MapForm({ initial, onClose, onSaved }: MapFormProps) {
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          name: initial.name,
          description: initial.description ?? "",
          cols: initial.cols,
          rows: initial.rows,
          cellSize: initial.cellSize,
          image: initial.image,
        }
      : EMPTY,
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    const payload = {
      name: form.name,
      description: form.description.trim() === "" ? null : form.description,
      cols: form.cols,
      rows: form.rows,
      cellSize: form.cellSize,
      image: form.image,
    }
    try {
      if (initial) await api.maps.update(initial.id, payload)
      else await api.maps.create(payload)
      onClose()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el mapa")
    } finally {
      setSaving(false)
    }
  }

  // El recorte de la imagen respeta la proporción de la grilla (cols/rows),
  // para que la imagen calce 1:1 con la cuadrícula lógica.
  const aspect = form.rows > 0 ? form.cols / form.rows : 1

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="map-name">Nombre</Label>
            <Input
              id="map-name"
              required
              minLength={2}
              maxLength={80}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="map-description">Descripción (opcional)</Label>
            <Textarea
              id="map-description"
              rows={2}
              maxLength={500}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="map-cols">Columnas</Label>
              <Input
                id="map-cols"
                type="number"
                required
                min={1}
                max={200}
                value={form.cols}
                onChange={(e) => set("cols", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="map-rows">Filas</Label>
              <Input
                id="map-rows"
                type="number"
                required
                min={1}
                max={200}
                value={form.rows}
                onChange={(e) => set("rows", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="map-cellsize">Celda (px)</Label>
              <Input
                id="map-cellsize"
                type="number"
                required
                min={8}
                max={512}
                value={form.cellSize}
                onChange={(e) => set("cellSize", Number(e.target.value))}
              />
            </div>
          </div>

          <CroppedImageField
            label="Imagen del mapa"
            kind="maps"
            aspect={aspect}
            value={form.image}
            onChange={(url) => set("image", url)}
          />

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear mapa"}
        </Button>
      </DialogFooter>
    </form>
  )
}

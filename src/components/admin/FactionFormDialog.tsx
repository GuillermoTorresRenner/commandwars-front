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
import type { Faction } from "@/lib/api"

interface FactionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Categoría a la que pertenece la facción (contexto del botón "+"). */
  categoryId: string
  /** Facción a editar, o null para crear. */
  initial: Faction | null
  onSaved: () => void
}

export function FactionFormDialog({
  open,
  onOpenChange,
  categoryId,
  initial,
  onSaved,
}: FactionFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar facción" : "Nueva facción"}</DialogTitle>
          <DialogDescription>
            La facción vive dentro de su categoría y se compone de líderes y criaturas.
          </DialogDescription>
        </DialogHeader>
        <FactionForm
          key={initial?.id ?? "new"}
          categoryId={categoryId}
          initial={initial}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  )
}

function FactionForm({
  categoryId,
  initial,
  onClose,
  onSaved,
}: {
  categoryId: string
  initial: Faction | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [tagline, setTagline] = useState(initial?.tagline ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [color, setColor] = useState(initial?.color ?? "#c2410c")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    const payload = {
      categoryId,
      name,
      tagline: tagline.trim() === "" ? null : tagline,
      description: description.trim() === "" ? null : description,
      color,
    }
    try {
      if (initial) await api.factions.update(initial.id, payload)
      else await api.factions.create(payload)
      onClose()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la facción")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="faction-name">Nombre</Label>
        <Input
          id="faction-name"
          required
          minLength={2}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="faction-tagline">Lema (opcional)</Label>
        <Input
          id="faction-tagline"
          maxLength={120}
          placeholder="El bosque recuerda."
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="faction-description">Descripción (opcional)</Label>
        <Textarea
          id="faction-description"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="faction-color">Color temático</Label>
        <div className="flex items-center gap-3">
          <input
            id="faction-color"
            type="color"
            className="border-border size-9 cursor-pointer rounded-md border bg-transparent p-1"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
          <Input
            aria-label="Color en hex"
            className="w-32 font-mono"
            pattern="^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
      </div>
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
          {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear facción"}
        </Button>
      </DialogFooter>
    </form>
  )
}

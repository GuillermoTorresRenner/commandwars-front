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
import type { Category } from "@/lib/api"

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Categoría a editar, o null para crear. */
  initial: Category | null
  onSaved: () => void
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: CategoryFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>
            La ambientación que agrupa facciones (p. ej. fantasía medieval, espacial,
            guerra antigua).
          </DialogDescription>
        </DialogHeader>
        <CategoryForm
          key={initial?.id ?? "new"}
          initial={initial}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  )
}

function CategoryForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Category | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    const payload = {
      name,
      description: description.trim() === "" ? null : description,
    }
    try {
      if (initial) await api.categories.update(initial.id, payload)
      else await api.categories.create(payload)
      onClose()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la categoría")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category-name">Nombre</Label>
        <Input
          id="category-name"
          required
          minLength={2}
          maxLength={60}
          placeholder="Fantasía medieval"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category-description">Descripción (opcional)</Label>
        <Textarea
          id="category-description"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
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
          {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear categoría"}
        </Button>
      </DialogFooter>
    </form>
  )
}

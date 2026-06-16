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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api, CREATURE_ATTRIBUTES } from "@/lib/api"
import type { OrderCard } from "@/lib/api"
import { EffectSpecBuilder } from "./EffectSpecBuilder"

interface OrderCardFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Facción dueña del deck (contexto del botón "+"). */
  factionId: string
  /** Carta a editar, o null para crear. */
  initial: OrderCard | null
  onSaved: () => void
}

export function OrderCardFormDialog({
  open,
  onOpenChange,
  factionId,
  initial,
  onSaved,
}: OrderCardFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar carta" : "Nueva carta de orden"}</DialogTitle>
          <DialogDescription>Define los atributos de la carta: acción, requisitos y efectos data-driven.</DialogDescription>
        </DialogHeader>
        <OrderCardForm
          key={initial?.id ?? "new"}
          factionId={factionId}
          initial={initial}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  )
}

function OrderCardForm({
  factionId,
  initial,
  onClose,
  onSaved,
}: {
  factionId: string
  initial: OrderCard | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [copies, setCopies] = useState(initial?.copies ?? 1)
  const [actionType, setActionType] = useState(initial?.actionType ?? "standard")
  const [requiredLevel, setRequiredLevel] = useState(initial?.requiredLevel ?? 0)
  const [requiredAttribute, setRequiredAttribute] = useState(initial?.requiredAttribute ?? null)
  const [requiredKeyword, setRequiredKeyword] = useState(initial?.requiredKeyword ?? "")
  const [attachText, setAttachText] = useState(initial?.attachText ?? "")
  const [effects, setEffects] = useState((initial?.effects as any) ?? [])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    const payload = {
      factionId,
      name,
      description: description.trim() === "" ? null : description,
      copies,
      actionType,
      requiredLevel,
      requiredAttribute: requiredAttribute || null,
      requiredKeyword: requiredKeyword.trim() === "" ? null : requiredKeyword,
      attachText: attachText.trim() === "" ? null : attachText,
      effects,
    }
    try {
      if (initial) await api.orderCards.update(initial.id, payload)
      else await api.orderCards.create(payload)
      onClose()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la carta")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
      <div className="space-y-2">
        <Label htmlFor="card-name">Nombre</Label>
        <Input
          id="card-name"
          required
          minLength={2}
          maxLength={80}
          placeholder="Muro de llamas"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="card-description">Descripción (opcional)</Label>
        <Textarea
          id="card-description"
          rows={2}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="card-copies">Copias en el deck</Label>
        <Input
          id="card-copies"
          type="number"
          required
          min={1}
          max={20}
          value={copies}
          onChange={(e) => setCopies(Number(e.target.value))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="action-type">Tipo de acción</Label>
        <Select value={actionType} onValueChange={setActionType}>
          <SelectTrigger id="action-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Estándar (agota)</SelectItem>
            <SelectItem value="minor">Menor (no agota)</SelectItem>
            <SelectItem value="immediate">Inmediata (respuesta, agota)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="required-level">Nivel mínimo</Label>
        <Input
          id="required-level"
          type="number"
          min={0}
          max={10}
          value={requiredLevel}
          onChange={(e) => setRequiredLevel(Number(e.target.value))}
        />
        <p className="text-muted-foreground text-xs">0 = sin requisito</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="required-attribute">Atributo requerido (opcional)</Label>
        <Select
          value={requiredAttribute ?? "none"}
          onValueChange={(val) => setRequiredAttribute(val === "none" ? null : val)}
        >
          <SelectTrigger id="required-attribute">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin requisito</SelectItem>
            {CREATURE_ATTRIBUTES.map((attr) => (
              <SelectItem key={attr} value={attr}>
                {attr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="required-keyword">Keyword requerida (opcional)</Label>
        <Input
          id="required-keyword"
          maxLength={50}
          placeholder="p. ej. 'humanoide'"
          value={requiredKeyword}
          onChange={(e) => setRequiredKeyword(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="attach-text">Texto de adjudicación (opcional)</Label>
        <Textarea
          id="attach-text"
          rows={2}
          maxLength={200}
          placeholder="Texto que aparece en la criatura cuando se adjunta"
          value={attachText}
          onChange={(e) => setAttachText(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Efectos</Label>
        <EffectSpecBuilder value={effects} onChange={setEffects} />
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
          {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear carta"}
        </Button>
      </DialogFooter>
    </form>
  )
}

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
import { api } from "@/lib/api"
import type { Leader } from "@/lib/api"
import { CroppedImageField } from "./CroppedImageField"
import { EffectSpecBuilder } from "./EffectSpecBuilder"

interface LeaderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Facción a la que pertenece el líder (contexto del botón "+"). */
  factionId: string
  /** Líder a editar, o null para crear. */
  initial: Leader | null
  onSaved: () => void
}

export function LeaderFormDialog({
  open,
  onOpenChange,
  factionId,
  initial,
  onSaved,
}: LeaderFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar líder" : "Nuevo líder"}</DialogTitle>
          <DialogDescription>
            El líder/comandante fija la Moral y el Liderazgo iniciales, el tamaño de
            las manos de cartas, y tiene un poder continuo sobre la batalla.
          </DialogDescription>
        </DialogHeader>
        <LeaderForm
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

function LeaderForm({
  factionId,
  initial,
  onClose,
  onSaved,
}: {
  factionId: string
  initial: Leader | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [powerLabel, setPowerLabel] = useState(initial?.powerLabel ?? "")
  const [powerText, setPowerText] = useState(initial?.powerText ?? "")
  const [powerType, setPowerType] = useState(initial?.powerType ?? "passive")
  const [powerTrigger, setPowerTrigger] = useState(initial?.powerTrigger ?? "")
  const [powerActionType, setPowerActionType] = useState(initial?.powerActionType ?? "")
  const [powerEffects, setPowerEffects] = useState((initial?.powerEffects as any) ?? [])
  const [startingMorale, setStartingMorale] = useState(initial?.startingMorale ?? 10)
  const [startingLeadership, setStartingLeadership] = useState(
    initial?.startingLeadership ?? 5,
  )
  const [orderHand, setOrderHand] = useState(initial?.orderHand ?? 3)
  const [creatureHand, setCreatureHand] = useState(initial?.creatureHand ?? 4)
  const [token, setToken] = useState<string | null>(initial?.token ?? null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    const payload = {
      factionId,
      name,
      powerLabel,
      powerText,
      powerType,
      powerTrigger: powerTrigger.trim() === "" ? null : powerTrigger,
      powerActionType: powerActionType.trim() === "" ? null : powerActionType,
      powerEffects,
      startingMorale,
      startingLeadership,
      orderHand,
      creatureHand,
      token,
    }
    try {
      if (initial) await api.leaders.update(initial.id, payload)
      else await api.leaders.create(payload)
      onClose()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el líder")
    } finally {
      setSaving(false)
    }
  }

  const numberField = (
    id: string,
    label: string,
    value: number,
    setValue: (n: number) => void,
    min: number,
    max: number,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        required
        min={min}
        max={max}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="leader-name">Nombre</Label>
        <Input
          id="leader-name"
          required
          minLength={2}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {numberField("leader-morale", "Moral inicial", startingMorale, setStartingMorale, 1, 30)}
        {numberField(
          "leader-leadership",
          "Liderazgo inicial",
          startingLeadership,
          setStartingLeadership,
          1,
          20,
        )}
        {numberField("leader-order-hand", "Mano de órdenes", orderHand, setOrderHand, 1, 10)}
        {numberField(
          "leader-creature-hand",
          "Mano de criaturas",
          creatureHand,
          setCreatureHand,
          1,
          10,
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="leader-power-label">Nombre del poder</Label>
        <Input
          id="leader-power-label"
          required
          minLength={2}
          maxLength={60}
          placeholder="Savia vieja"
          value={powerLabel}
          onChange={(e) => setPowerLabel(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="leader-power-text">Descripción del poder</Label>
        <Textarea
          id="leader-power-text"
          required
          minLength={2}
          maxLength={300}
          rows={2}
          placeholder="Tus criaturas curan 1 HP al inicio de cada ronda."
          value={powerText}
          onChange={(e) => setPowerText(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="power-type">Tipo del poder</Label>
        <Select value={powerType} onValueChange={setPowerType}>
          <SelectTrigger id="power-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="passive">Pasivo (siempre activo)</SelectItem>
            <SelectItem value="active">Activo (acción en turno)</SelectItem>
            <SelectItem value="triggered">Disparado (cuando ocurre algo)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {powerType === "triggered" && (
        <div className="space-y-2">
          <Label htmlFor="power-trigger">Trigger (cuándo se activa)</Label>
          <Input
            id="power-trigger"
            maxLength={50}
            placeholder="p. ej. on_turn_start"
            value={powerTrigger}
            onChange={(e) => setPowerTrigger(e.target.value)}
          />
        </div>
      )}

      {powerType === "active" && (
        <div className="space-y-2">
          <Label htmlFor="power-action">Tipo de acción</Label>
          <Select value={powerActionType} onValueChange={setPowerActionType}>
            <SelectTrigger id="power-action">
              <SelectValue placeholder="Selecciona..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Completa (agota)</SelectItem>
              <SelectItem value="swift">Veloz (no agota)</SelectItem>
              <SelectItem value="defense">Defensa (respuesta, agota)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Efectos del poder (opcional)</Label>
        <EffectSpecBuilder value={powerEffects} onChange={setPowerEffects} />
      </div>

      <CroppedImageField
        label="Token"
        kind="leaders"
        aspect={1}
        shape="round"
        value={token}
        onChange={setToken}
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
          {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear líder"}
        </Button>
      </DialogFooter>
    </form>
  )
}

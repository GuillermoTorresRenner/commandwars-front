import { useState } from "react"
import type { FormEvent } from "react"
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api, ATTRIBUTE_LABELS, CREATURE_ATTRIBUTES } from "@/lib/api"
import type { Creature, CreatureAbility, CreatureAttribute } from "@/lib/api"
import { cn } from "@/lib/utils"
import { CroppedImageField } from "./CroppedImageField"
import { EffectSpecBuilder } from "./EffectSpecBuilder"

interface CreatureFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Facción a la que pertenece la criatura (contexto del botón "+"). */
  factionId: string
  /** Criatura a editar, o null para crear. */
  initial: Creature | null
  onSaved: () => void
}

export function CreatureFormDialog({
  open,
  onOpenChange,
  factionId,
  initial,
  onSaved,
}: CreatureFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar criatura" : "Nueva criatura"}</DialogTitle>
          <DialogDescription>
            Carta de criatura: nivel, HP, velocidad, daños, palabras clave y
            atributos que habilitan cartas de orden. El token circular se dibuja
            en el mapa.
          </DialogDescription>
        </DialogHeader>
        <CreatureForm
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

/** Un poder de criatura con efectos opcionales del sistema data-driven. */
interface PowerEntry {
  label: string
  text: string
  effects: unknown[]
  expanded: boolean
}

interface FormState {
  name: string
  level: number
  hp: number
  speed: number
  meleeDamage: number
  hasRanged: boolean
  rangedDamage: number
  rangedDistance: number
  gridSize: number
  copies: number
  keywordsText: string
  attributes: CreatureAttribute[]
  powers: PowerEntry[]
  token: string | null
}

function abilityToPowerEntry(a: CreatureAbility): PowerEntry {
  const raw = a as unknown as Record<string, unknown>
  return {
    label: a.label,
    text: a.text,
    effects: Array.isArray(raw.effects) ? (raw.effects as unknown[]) : [],
    expanded: false,
  }
}

function toFormState(creature: Creature): FormState {
  return {
    name: creature.name,
    level: creature.level,
    hp: creature.hp,
    speed: creature.speed,
    meleeDamage: creature.meleeDamage,
    hasRanged: creature.rangedDamage !== null,
    rangedDamage: creature.rangedDamage ?? 1,
    rangedDistance: creature.rangedDistance ?? 4,
    gridSize: creature.gridSize,
    copies: creature.copies,
    keywordsText: (creature.keywords ?? []).join(", "),
    attributes: creature.attributes ?? [],
    powers: (creature.powers ?? []).map(abilityToPowerEntry),
    token: creature.token,
  }
}

const EMPTY: FormState = {
  name: "",
  level: 1,
  hp: 5,
  speed: 5,
  meleeDamage: 1,
  hasRanged: false,
  rangedDamage: 1,
  rangedDistance: 4,
  gridSize: 1,
  copies: 1,
  keywordsText: "",
  attributes: [],
  powers: [],
  token: null,
}

function CreatureForm({
  factionId,
  initial,
  onClose,
  onSaved,
}: {
  factionId: string
  initial: Creature | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(() =>
    initial ? toFormState(initial) : EMPTY,
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleAttribute(attribute: CreatureAttribute) {
    setForm((current) => ({
      ...current,
      attributes: current.attributes.includes(attribute)
        ? current.attributes.filter((a) => a !== attribute)
        : [...current.attributes, attribute],
    }))
  }

  function addPower() {
    const idx = form.powers.length + 1
    setForm((current) => ({
      ...current,
      powers: [
        ...current.powers,
        { label: "", text: "", effects: [], expanded: true },
      ],
    }))
  }

  function removePower(idx: number) {
    setForm((current) => ({
      ...current,
      powers: current.powers.filter((_, i) => i !== idx),
    }))
  }

  function updatePower<K extends keyof PowerEntry>(idx: number, key: K, value: PowerEntry[K]) {
    setForm((current) => {
      const updated = [...current.powers]
      updated[idx] = { ...updated[idx], [key]: value }
      return { ...current, powers: updated }
    })
  }

  function togglePowerExpanded(idx: number) {
    setForm((current) => {
      const updated = [...current.powers]
      updated[idx] = { ...updated[idx], expanded: !updated[idx].expanded }
      return { ...current, powers: updated }
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const powers: CreatureAbility[] | null = form.powers.length
      ? form.powers.map(({ label, text, effects }) => ({
          key: label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
          label,
          text,
          ...(effects.length ? { effects } : {}),
        }) as CreatureAbility)
      : null

    const keywords = form.keywordsText
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean)

    const payload = {
      factionId,
      name: form.name,
      level: form.level,
      hp: form.hp,
      speed: form.speed,
      meleeDamage: form.meleeDamage,
      rangedDamage: form.hasRanged ? form.rangedDamage : null,
      rangedDistance: form.hasRanged ? form.rangedDistance : null,
      gridSize: form.gridSize,
      copies: form.copies,
      keywords: keywords.length ? keywords : null,
      attributes: form.attributes.length ? form.attributes : null,
      powers,
      token: form.token,
    }

    setSaving(true)
    try {
      if (initial) await api.creatures.update(initial.id, payload)
      else await api.creatures.create(payload)
      onClose()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la criatura")
    } finally {
      setSaving(false)
    }
  }

  const numberField = (
    label: string,
    key: "level" | "hp" | "speed" | "meleeDamage",
    min: number,
    max: number,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        required
        min={min}
        max={max}
        value={form[key]}
        onChange={(e) => set(key, Number(e.target.value))}
      />
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            required
            minLength={2}
            maxLength={60}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Tamaño en el mapa</Label>
          <Select
            value={String(form.gridSize)}
            onValueChange={(value) => set("gridSize", Number(value))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 celda (1×1)</SelectItem>
              <SelectItem value="2">4 celdas (2×2)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {numberField("Nivel", "level", 1, 10)}
        {numberField("HP", "hp", 1, 99)}
        {numberField("Velocidad", "speed", 1, 20)}
        {numberField("Daño cuerpo a cuerpo", "meleeDamage", 0, 20)}
        <div className="space-y-2">
          <Label htmlFor="copies">Copias en la banda</Label>
          <Input
            id="copies"
            type="number"
            required
            min={1}
            max={20}
            value={form.copies}
            onChange={(e) => set("copies", Number(e.target.value))}
          />
          <p className="text-muted-foreground text-xs">
            Cuántas figuras de esta criatura trae la facción.
          </p>
        </div>
      </div>

      <div className="border-border space-y-3 rounded-lg border p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="accent-primary size-4"
            checked={form.hasRanged}
            onChange={(e) => set("hasRanged", e.target.checked)}
          />
          Tiene ataque a distancia
        </label>
        {form.hasRanged && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rangedDamage">Daño a distancia</Label>
              <Input
                id="rangedDamage"
                type="number"
                required
                min={1}
                max={20}
                value={form.rangedDamage}
                onChange={(e) => set("rangedDamage", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rangedDistance">Alcance (celdas)</Label>
              <Input
                id="rangedDistance"
                type="number"
                required
                min={1}
                max={30}
                value={form.rangedDistance}
                onChange={(e) => set("rangedDistance", Number(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Atributos (habilitan cartas de orden)</Label>
        <div className="flex flex-wrap gap-1.5">
          {CREATURE_ATTRIBUTES.map((attribute) => {
            const active = form.attributes.includes(attribute)
            return (
              <button
                key={attribute}
                type="button"
                aria-pressed={active}
                onClick={() => toggleAttribute(attribute)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/15 text-primary font-medium"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {ATTRIBUTE_LABELS[attribute]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="keywords">Palabras clave (separadas por coma)</Label>
        <Input
          id="keywords"
          placeholder="humanoide, bestia, elemental…"
          value={form.keywordsText}
          onChange={(e) => set("keywordsText", e.target.value)}
        />
      </div>

      <CroppedImageField
        label="Token"
        kind="creatures"
        aspect={1}
        shape="round"
        value={form.token}
        onChange={(url) => set("token", url)}
      />

      {/* ── Poderes especiales ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Poderes especiales</Label>
          <Button type="button" size="sm" variant="outline" onClick={addPower}>
            <Plus className="size-3.5" /> Añadir poder
          </Button>
        </div>

        {form.powers.length === 0 && (
          <p className="text-muted-foreground text-sm py-2 text-center border border-dashed rounded-lg">
            Sin poderes. Esta criatura usa solo sus stats base.
          </p>
        )}

        {form.powers.map((power, idx) => (
          <div key={idx} className="rounded-lg border bg-muted/20">
            {/* Cabecera del poder (siempre visible) */}
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => togglePowerExpanded(idx)}
                className="flex items-center gap-1.5 flex-1 min-w-0 text-left hover:text-foreground transition-colors"
              >
                {power.expanded
                  ? <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
                  : <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />}
                <span className="text-sm font-medium truncate">
                  {power.label || <span className="text-muted-foreground italic">Poder sin nombre</span>}
                </span>
                {power.effects.length > 0 && (
                  <span className="shrink-0 rounded-full bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 font-medium">
                    {power.effects.length} efecto{power.effects.length !== 1 ? "s" : ""}
                  </span>
                )}
              </button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removePower(idx)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

            {/* Cuerpo expandido */}
            {power.expanded && (
              <div className="px-3 pb-3 space-y-3 border-t border-border/40 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre del poder</Label>
                  <Input
                    required
                    placeholder="Guardia, Furia Ígnea…"
                    value={power.label}
                    onChange={(e) => updatePower(idx, "label", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Descripción</Label>
                  <Textarea
                    required
                    rows={2}
                    placeholder="Describe qué hace el poder en términos de juego."
                    value={power.text}
                    onChange={(e) => updatePower(idx, "text", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Efectos del motor (opcional)</Label>
                  <EffectSpecBuilder
                    value={power.effects as Parameters<typeof EffectSpecBuilder>[0]["value"]}
                    onChange={(effects) => updatePower(idx, "effects", effects)}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
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
          {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear criatura"}
        </Button>
      </DialogFooter>
    </form>
  )
}

import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ── Tipos (espejo de game.types.ts del backend) ───────────────────────────────

type EffectDuration = 'instant' | 'end_of_turn' | 'start_of_next_turn' | 'until_removed' | 'permanent'
type ConditionKind = 'dazed' | 'immobilized' | 'slowed' | 'poisoned' | 'flying' | 'burrowing' | 'immune_hazard'
type EffectTarget =
  | 'self' | 'actor' | 'target_unit' | 'target_enemy' | 'target_ally'
  | 'adjacent_enemies' | 'adjacent_allies' | 'all_enemies' | 'all_allies'
  | 'all_units' | 'player_self' | 'player_opponent'
type TriggerKind =
  | 'immediate' | 'on_turn_start' | 'on_turn_end' | 'on_death'
  | 'on_deal_damage' | 'on_receive_damage' | 'on_collect_treasure' | 'on_deploy' | 'passive'

type EffectOp =
  | { op: 'damage';                amount: number }
  | { op: 'heal';                  amount: number }
  | { op: 'modify_speed';          delta: number; duration: EffectDuration }
  | { op: 'modify_melee';          delta: number; duration: EffectDuration }
  | { op: 'modify_ranged';         delta: number; duration: EffectDuration }
  | { op: 'modify_range';          delta: number; duration: EffectDuration }
  | { op: 'modify_incoming_damage';delta: number; duration: EffectDuration }
  | { op: 'set_condition';         condition: ConditionKind; duration: EffectDuration }
  | { op: 'clear_condition';       condition: ConditionKind }
  | { op: 'tap' }
  | { op: 'untap' }
  | { op: 'shift';                 distance: number }
  | { op: 'slide';                 distance: number }
  | { op: 'draw_cards';            deck: 'order' | 'creature'; count: number }
  | { op: 'discard_cards';         deck: 'order' | 'creature'; count: number; who: 'self' | 'opponent' }
  | { op: 'modify_morale';         delta: number }
  | { op: 'modify_leadership';     delta: number }
  | { op: 'grant_attribute';       attribute: string; duration: EffectDuration }

type ConditionCheck =
  | { check: 'if_adjacent_ally' }
  | { check: 'if_adjacent_enemy' }
  | { check: 'if_hp_below';         threshold: number }
  | { check: 'if_unit_has_keyword'; keyword: string }
  | { check: 'if_tapped' }
  | { check: 'if_untapped' }

export interface EffectSpec {
  trigger: TriggerKind
  target: EffectTarget
  ops: EffectOp[]
  cost?: EffectOp[]
  condition?: ConditionCheck
}

export interface EffectSpecBuilderProps {
  value: EffectSpec[]
  onChange: (effects: EffectSpec[]) => void
}

// ── Labels ────────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerKind, string> = {
  immediate:           'Inmediato (al jugar)',
  on_turn_start:       'Al inicio del turno',
  on_turn_end:         'Al fin del turno',
  on_death:            'Al morir esta criatura',
  on_deal_damage:      'Al hacer daño',
  on_receive_damage:   'Al recibir daño',
  on_collect_treasure: 'Al recoger tesoro',
  on_deploy:           'Al desplegarse',
  passive:             'Pasivo (siempre activo)',
}

const TARGET_LABELS: Record<EffectTarget, string> = {
  self:             'Esta criatura (portadora del efecto)',
  actor:            'Criatura que jugó la carta',
  target_unit:      'Unidad elegida por el jugador',
  target_enemy:     'Enemigo elegido por el jugador',
  target_ally:      'Aliado elegido por el jugador',
  adjacent_enemies: 'Enemigos adyacentes al actor',
  adjacent_allies:  'Aliados adyacentes al actor',
  all_enemies:      'Todos los enemigos en el tablero',
  all_allies:       'Todos los aliados en el tablero',
  all_units:        'Todas las unidades',
  player_self:      'Jugador activo (Moral / Liderazgo)',
  player_opponent:  'Jugador rival (Moral / Liderazgo)',
}

const DURATION_LABELS: Record<EffectDuration, string> = {
  instant:            'Instantánea (una vez)',
  end_of_turn:        'Hasta fin de turno',
  start_of_next_turn: 'Hasta inicio del próximo turno',
  until_removed:      'Adjuntada (hasta que se elimine)',
  permanent:          'Permanente',
}

const CONDITION_KIND_LABELS: Record<ConditionKind, string> = {
  dazed:        'Aturdida — solo mover O atacar',
  immobilized:  'Inmovilizada — no puede moverse',
  slowed:       'Ralentizada — velocidad 2',
  poisoned:     'Envenenada — daño al inicio del turno',
  flying:       'Volando — ignora terreno y enemigos',
  burrowing:    'Excavando — ignora todo incluyendo muros',
  immune_hazard:'Inmune a terreno peligroso',
}

const CONDITION_CHECK_LABELS: Record<ConditionCheck['check'], string> = {
  if_adjacent_ally:      'Adyacente a un aliado',
  if_adjacent_enemy:     'Adyacente a un enemigo',
  if_hp_below:           'HP por debajo de umbral',
  if_unit_has_keyword:   'La unidad tiene una palabra clave',
  if_tapped:             'La criatura está agotada',
  if_untapped:           'La criatura NO está agotada',
}

const ATTRIBUTE_OPTIONS = [
  { value: 'strength',     label: 'Fuerza' },
  { value: 'dexterity',    label: 'Destreza' },
  { value: 'constitution', label: 'Constitución' },
  { value: 'intelligence', label: 'Inteligencia' },
  { value: 'wisdom',       label: 'Sabiduría' },
  { value: 'charisma',     label: 'Carisma' },
]

const OP_GROUPS: { group: string; ops: { value: string; label: string }[] }[] = [
  {
    group: 'Daño y curación',
    ops: [
      { value: 'damage',                label: 'Infligir daño (HP)' },
      { value: 'heal',                  label: 'Curar (HP)' },
      { value: 'modify_incoming_damage',label: 'Modificar daño entrante (protección / vulnerabilidad)' },
    ],
  },
  {
    group: 'Modificar stats',
    ops: [
      { value: 'modify_speed',      label: 'Modificar Velocidad' },
      { value: 'modify_melee',      label: 'Modificar Daño cuerpo a cuerpo' },
      { value: 'modify_ranged',     label: 'Modificar Daño a distancia' },
      { value: 'modify_range',      label: 'Modificar Alcance de ataque' },
      { value: 'modify_morale',     label: 'Modificar Moral del jugador' },
      { value: 'modify_leadership', label: 'Modificar Liderazgo del jugador' },
    ],
  },
  {
    group: 'Condiciones de estado',
    ops: [
      { value: 'set_condition',   label: 'Aplicar condición' },
      { value: 'clear_condition', label: 'Eliminar condición' },
    ],
  },
  {
    group: 'Movimiento en el mapa',
    ops: [
      { value: 'shift', label: 'Desplazar (shift) — el controlador elige dirección' },
      { value: 'slide', label: 'Empujar/arrastrar (slide) — el actor elige dirección' },
    ],
  },
  {
    group: 'Cartas',
    ops: [
      { value: 'draw_cards',      label: 'Robar cartas' },
      { value: 'discard_cards',   label: 'Descartar cartas' },
      { value: 'grant_attribute', label: 'Conceder atributo (habilita inspiraciones)' },
    ],
  },
  {
    group: 'Estado de la criatura',
    ops: [
      { value: 'tap',   label: 'Agotar criatura (tap)' },
      { value: 'untap', label: 'Desagotar criatura (untap)' },
    ],
  },
]

function defaultOp(op: string): EffectOp {
  switch (op) {
    case 'damage':                return { op: 'damage',                amount: 1 }
    case 'heal':                  return { op: 'heal',                  amount: 1 }
    case 'modify_speed':          return { op: 'modify_speed',          delta: 1,  duration: 'end_of_turn' }
    case 'modify_melee':          return { op: 'modify_melee',          delta: 1,  duration: 'end_of_turn' }
    case 'modify_ranged':         return { op: 'modify_ranged',         delta: 1,  duration: 'end_of_turn' }
    case 'modify_range':          return { op: 'modify_range',          delta: 1,  duration: 'end_of_turn' }
    case 'modify_incoming_damage':return { op: 'modify_incoming_damage',delta: -2, duration: 'end_of_turn' }
    case 'set_condition':         return { op: 'set_condition',         condition: 'dazed', duration: 'end_of_turn' }
    case 'clear_condition':       return { op: 'clear_condition',       condition: 'dazed' }
    case 'tap':                   return { op: 'tap' }
    case 'untap':                 return { op: 'untap' }
    case 'shift':                 return { op: 'shift',                 distance: 1 }
    case 'slide':                 return { op: 'slide',                 distance: 1 }
    case 'draw_cards':            return { op: 'draw_cards',            deck: 'order', count: 1 }
    case 'discard_cards':         return { op: 'discard_cards',         deck: 'order', count: 1, who: 'self' }
    case 'modify_morale':         return { op: 'modify_morale',         delta: 1 }
    case 'modify_leadership':     return { op: 'modify_leadership',     delta: 1 }
    case 'grant_attribute':       return { op: 'grant_attribute',       attribute: 'strength', duration: 'end_of_turn' }
    default:                      return { op: 'damage',                amount: 1 }
  }
}

function defaultCheck(check: string): ConditionCheck {
  switch (check) {
    case 'if_adjacent_ally':    return { check: 'if_adjacent_ally' }
    case 'if_adjacent_enemy':   return { check: 'if_adjacent_enemy' }
    case 'if_hp_below':         return { check: 'if_hp_below', threshold: 50 }
    case 'if_unit_has_keyword': return { check: 'if_unit_has_keyword', keyword: '' }
    case 'if_tapped':           return { check: 'if_tapped' }
    case 'if_untapped':         return { check: 'if_untapped' }
    default:                    return { check: 'if_adjacent_ally' }
  }
}

function opSummary(op: EffectOp): string {
  switch (op.op) {
    case 'damage':                return `Daño ${op.amount}`
    case 'heal':                  return `Curar ${op.amount}`
    case 'modify_speed':          return `Vel ${op.delta > 0 ? '+' : ''}${op.delta}`
    case 'modify_melee':          return `CaC ${op.delta > 0 ? '+' : ''}${op.delta}`
    case 'modify_ranged':         return `Dist ${op.delta > 0 ? '+' : ''}${op.delta}`
    case 'modify_range':          return `Alcance ${op.delta > 0 ? '+' : ''}${op.delta}`
    case 'modify_incoming_damage':return `Armadura ${op.delta > 0 ? '+' : ''}${op.delta}`
    case 'modify_morale':         return `Moral ${op.delta > 0 ? '+' : ''}${op.delta}`
    case 'modify_leadership':     return `Lid. ${op.delta > 0 ? '+' : ''}${op.delta}`
    case 'set_condition':         return `+${CONDITION_KIND_LABELS[op.condition].split(' ')[0]}`
    case 'clear_condition':       return `−${CONDITION_KIND_LABELS[op.condition].split(' ')[0]}`
    case 'tap':                   return 'Agotar'
    case 'untap':                 return 'Desagotar'
    case 'shift':                 return `Desp. ${op.distance}`
    case 'slide':                 return `Empuj. ${op.distance}`
    case 'draw_cards':            return `Robar ${op.count}`
    case 'discard_cards':         return `Desc. ${op.count}`
    case 'grant_attribute':       return `+${op.attribute}`
    default:                      return (op as EffectOp).op
  }
}

function conditionCheckSummary(c: ConditionCheck): string {
  switch (c.check) {
    case 'if_adjacent_ally':    return 'Si adyacente a aliado'
    case 'if_adjacent_enemy':   return 'Si adyacente a enemigo'
    case 'if_hp_below':         return `Si HP < ${c.threshold}%`
    case 'if_unit_has_keyword': return `Si tiene keyword "${c.keyword}"`
    case 'if_tapped':           return 'Si está agotada'
    case 'if_untapped':         return 'Si NO está agotada'
  }
}

// ── Editor de una op ──────────────────────────────────────────────────────────

function OpEditor({ op, onChange, onRemove, label }: {
  op: EffectOp; onChange: (next: EffectOp) => void; onRemove: () => void; label?: string
}) {
  const num = (lbl: string, field: string, value: number, min?: number) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{lbl}</Label>
      <Input type="number" min={min} value={value} className="h-7 text-xs"
        onChange={(e) => onChange({ ...op, [field]: Number(e.target.value) } as EffectOp)} />
    </div>
  )

  const dur = (value: EffectDuration) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Duración</Label>
      <Select value={value} onValueChange={(v) => onChange({ ...op, duration: v as EffectDuration } as EffectOp)}>
        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.entries(DURATION_LABELS) as [EffectDuration, string][]).map(([k, l]) => (
            <SelectItem key={k} value={k} className="text-xs">{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const cond = (value: ConditionKind) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Condición</Label>
      <Select value={value} onValueChange={(v) => onChange({ ...op, condition: v as ConditionKind } as EffectOp)}>
        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.entries(CONDITION_KIND_LABELS) as [ConditionKind, string][]).map(([k, l]) => (
            <SelectItem key={k} value={k} className="text-xs">{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const renderParams = () => {
    switch (op.op) {
      case 'damage':
      case 'heal':
        return num('Cantidad', 'amount', op.amount, 1)
      case 'modify_speed':
      case 'modify_melee':
      case 'modify_ranged':
      case 'modify_range':
        return <div className="grid grid-cols-2 gap-2">{num('Δ (−=reducir)', 'delta', op.delta)}{dur(op.duration)}</div>
      case 'modify_incoming_damage':
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">{num('Δ (−=protección, +=vulnerab.)', 'delta', op.delta)}{dur(op.duration)}</div>
            <p className="text-[10px] text-muted-foreground">Ej: −2 = absorbe 2 puntos de daño por ataque.</p>
          </div>
        )
      case 'modify_morale':
      case 'modify_leadership':
        return num('Δ (−=reducir)', 'delta', op.delta)
      case 'set_condition':
        return <div className="grid grid-cols-2 gap-2">{cond(op.condition)}{dur(op.duration)}</div>
      case 'clear_condition':
        return cond(op.condition)
      case 'shift':
      case 'slide':
        return num('Celdas', 'distance', op.distance, 1)
      case 'draw_cards':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mazo</Label>
              <Select value={op.deck} onValueChange={(v) => onChange({ ...op, deck: v as 'order' | 'creature' })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="order" className="text-xs">Inspiraciones</SelectItem>
                  <SelectItem value="creature" className="text-xs">Cartas de criatura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {num('Cantidad', 'count', op.count, 1)}
          </div>
        )
      case 'discard_cards':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mazo</Label>
              <Select value={op.deck} onValueChange={(v) => onChange({ ...op, deck: v as 'order' | 'creature' })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="order" className="text-xs">Inspiraciones</SelectItem>
                  <SelectItem value="creature" className="text-xs">Cartas de criatura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">¿Quién?</Label>
              <Select value={op.who} onValueChange={(v) => onChange({ ...op, who: v as 'self' | 'opponent' })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="self" className="text-xs">Jugador activo</SelectItem>
                  <SelectItem value="opponent" className="text-xs">El rival</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {num('Cantidad', 'count', op.count, 1)}
          </div>
        )
      case 'grant_attribute':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Atributo</Label>
              <Select value={op.attribute} onValueChange={(v) => onChange({ ...op, attribute: v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ATTRIBUTE_OPTIONS.map(({ value, label: lbl }) => (
                    <SelectItem key={value} value={value} className="text-xs">{lbl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dur(op.duration)}
          </div>
        )
      case 'tap':
      case 'untap':
        return <p className="text-xs text-muted-foreground italic">Sin parámetros adicionales.</p>
      default:
        return null
    }
  }

  return (
    <div className="rounded-md border border-border/60 bg-background p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        {label && <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">{label}</span>}
        <Select value={op.op} onValueChange={(v) => onChange(defaultOp(v))}>
          <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {OP_GROUPS.map(({ group, ops }) => (
              <div key={group}>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{group}</div>
                {ops.map(({ value, label: lbl }) => (
                  <SelectItem key={value} value={value} className="text-xs pl-4">{lbl}</SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="icon-sm" variant="ghost"
          className="shrink-0 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {renderParams()}
    </div>
  )
}

// ── Editor de lista de ops (reutilizado para ops y cost) ──────────────────────

function OpListEditor({ ops, onChange, emptyText }: {
  ops: EffectOp[]; onChange: (ops: EffectOp[]) => void; emptyText: string
}) {
  return (
    <div className="space-y-2">
      {ops.length === 0 && (
        <p className="text-xs text-muted-foreground italic">{emptyText}</p>
      )}
      {ops.map((op, i) => (
        <OpEditor key={i} op={op}
          onChange={(next) => { const u = [...ops]; u[i] = next; onChange(u) }}
          onRemove={() => onChange(ops.filter((_, j) => j !== i))}
        />
      ))}
      <Button type="button" size="sm" variant="ghost" className="h-6 text-xs px-2 w-full border border-dashed border-border/60"
        onClick={() => onChange([...ops, defaultOp('damage')])}>
        <Plus className="size-3" /> Añadir operación
      </Button>
    </div>
  )
}

// ── Editor de condición estructural ──────────────────────────────────────────

function ConditionCheckEditor({ value, onChange, onRemove }: {
  value: ConditionCheck; onChange: (c: ConditionCheck) => void; onRemove: () => void
}) {
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide shrink-0">Si…</span>
        <Select value={value.check} onValueChange={(v) => onChange(defaultCheck(v))}>
          <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.entries(CONDITION_CHECK_LABELS) as [ConditionCheck['check'], string][]).map(([k, l]) => (
              <SelectItem key={k} value={k} className="text-xs">{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="icon-sm" variant="ghost"
          className="shrink-0 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {value.check === 'if_hp_below' && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Umbral (% del HP máximo)</Label>
          <div className="flex items-center gap-2">
            <Input type="number" min={1} max={99} value={value.threshold} className="h-7 text-xs w-20"
              onChange={(e) => onChange({ check: 'if_hp_below', threshold: Number(e.target.value) })} />
            <span className="text-xs text-muted-foreground">% — ej. 50 = menos de la mitad del HP</span>
          </div>
        </div>
      )}
      {value.check === 'if_unit_has_keyword' && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Palabra clave</Label>
          <Input value={value.keyword} placeholder="bestia, elemental, humanoide…" className="h-7 text-xs"
            onChange={(e) => onChange({ check: 'if_unit_has_keyword', keyword: e.target.value })} />
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function EffectSpecBuilder({ value, onChange }: EffectSpecBuilderProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  function addEffect() {
    const next: EffectSpec = { trigger: 'immediate', target: 'target_enemy', ops: [] }
    onChange([...value, next])
    setExpandedIdx(value.length)
  }

  function removeEffect(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
    setExpandedIdx((prev) => prev === idx ? null : prev !== null && prev > idx ? prev - 1 : prev)
  }

  function update(idx: number, patch: Partial<EffectSpec>) {
    const updated = [...value]
    updated[idx] = { ...updated[idx], ...patch }
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={addEffect} variant="outline" size="sm" className="w-full">
        <Plus className="size-3.5" /> Añadir efecto
      </Button>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">Sin efectos definidos.</p>
      )}

      {value.map((effect, idx) => {
        const isOpen = expandedIdx === idx
        return (
          <Card key={idx} className="overflow-hidden">
            {/* Cabecera */}
            <button type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
              onClick={() => setExpandedIdx(isOpen ? null : idx)}
            >
              {isOpen ? <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />}
              <span className="text-xs flex-1 min-w-0 space-x-1">
                <span className="text-muted-foreground">{TRIGGER_LABELS[effect.trigger]}</span>
                <span className="text-muted-foreground/40">→</span>
                <span>{TARGET_LABELS[effect.target].split(' ')[0]}</span>
                {effect.condition && (
                  <span className="text-amber-500/80 text-[10px]">({conditionCheckSummary(effect.condition)})</span>
                )}
              </span>
              <div className="flex gap-1 flex-wrap shrink-0">
                {effect.cost && effect.cost.length > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/40 text-destructive/70">
                    Coste: {effect.cost.map(opSummary).join(', ')}
                  </Badge>
                )}
                {effect.ops.map((op, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{opSummary(op)}</Badge>
                ))}
              </div>
              <Button type="button" size="icon-sm" variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-destructive ml-1"
                onClick={(e) => { e.stopPropagation(); removeEffect(idx) }}>
                <Trash2 className="size-3.5" />
              </Button>
            </button>

            {/* Cuerpo */}
            {isOpen && (
              <div className="border-t border-border/40 px-3 py-3 space-y-4">

                {/* Trigger + Target */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Cuándo</Label>
                    <Select value={effect.trigger} onValueChange={(v) => update(idx, { trigger: v as TriggerKind })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(TRIGGER_LABELS) as [TriggerKind, string][]).map(([k, l]) => (
                          <SelectItem key={k} value={k} className="text-xs">{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">A quién afecta</Label>
                    <Select value={effect.target} onValueChange={(v) => update(idx, { target: v as EffectTarget })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(TARGET_LABELS) as [EffectTarget, string][]).map(([k, l]) => (
                          <SelectItem key={k} value={k} className="text-xs">{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Condición estructural */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Condición (solo si…)</Label>
                    {!effect.condition && (
                      <Button type="button" size="sm" variant="ghost" className="h-6 text-xs px-2"
                        onClick={() => update(idx, { condition: defaultCheck('if_adjacent_ally') })}>
                        <Plus className="size-3" /> Añadir condición
                      </Button>
                    )}
                  </div>
                  {effect.condition && (
                    <ConditionCheckEditor
                      value={effect.condition}
                      onChange={(c) => update(idx, { condition: c })}
                      onRemove={() => update(idx, { condition: undefined })}
                    />
                  )}
                  {!effect.condition && (
                    <p className="text-xs text-muted-foreground italic">El efecto se aplica siempre que se active el trigger.</p>
                  )}
                </div>

                {/* Coste */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Coste (se paga antes del efecto)</Label>
                  <OpListEditor
                    ops={effect.cost ?? []}
                    onChange={(cost) => update(idx, { cost: cost.length ? cost : undefined })}
                    emptyText="Sin coste — el efecto es gratuito."
                  />
                </div>

                {/* Operaciones del efecto */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Operaciones del efecto</Label>
                  <OpListEditor
                    ops={effect.ops}
                    onChange={(ops) => update(idx, { ops })}
                    emptyText="Sin operaciones — el efecto no hará nada."
                  />
                </div>

              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

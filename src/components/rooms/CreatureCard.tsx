import { Crosshair, Footprints, Heart, Swords, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { assetUrl } from "@/lib/api"
import type { CreatureSnapshot, GameUnit } from "@/lib/api"
import { cn } from "@/lib/utils"

// Abreviaturas de atributos en español
const ATTR_ABBR: Record<string, string> = {
  strength: "FUE",
  dexterity: "DES",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "SAB",
  charisma: "CAR",
}

interface CreatureCardProps {
  snap: CreatureSnapshot
  unit?: GameUnit
  /** Si true, se muestra en modo compacto (tooltip flotante). */
  compact?: boolean
}

export function CreatureCard({ snap, unit, compact = false }: CreatureCardProps) {
  const currentHp = unit ? snap.hp - unit.damage : snap.hp
  const hpPct = Math.max(0, Math.min(100, (currentHp / snap.hp) * 100))
  const hpColor =
    hpPct > 60 ? "#22c55e" : hpPct > 30 ? "#f59e0b" : "#ef4444"

  const tokenUrl = assetUrl(snap.token)

  // keywords / attributes / powers pueden no estar en el snapshot si viene de
  // una versión antigua de la API — se defiende con fallbacks vacíos.
  const keywords: string[] = (snap as CreatureSnapshotExtended).keywords ?? []
  const attributes: string[] = (snap as CreatureSnapshotExtended).attributes ?? []
  const powers: Array<{ key: string; label: string; text: string }> =
    (snap as CreatureSnapshotExtended).powers ?? []

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden",
        compact ? "w-56" : "w-72",
      )}
    >
      {/* Cabecera con color de facción */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ backgroundColor: snap.factionColor }}
      >
        <span
          className={cn(
            "font-semibold leading-tight text-white drop-shadow",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {snap.name}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {snap.gridSize === 2 && (
            <Badge
              className="py-0 px-1 text-[10px] leading-4 bg-black/30 text-white border-0"
            >
              2×2
            </Badge>
          )}
          <Badge className="py-0 px-1.5 text-[10px] leading-4 bg-black/30 text-white border-0">
            Nv.{snap.level}
          </Badge>
        </div>
      </div>

      {/* Imagen del token */}
      <div className="flex justify-center py-2" style={{ backgroundColor: snap.factionColor + "22" }}>
        <div
          className={cn(
            "rounded-full overflow-hidden border-2 border-white/30 flex items-center justify-center bg-black/20",
            compact ? "size-16" : "size-24",
          )}
          style={{ backgroundColor: snap.factionColor }}
        >
          {tokenUrl ? (
            <img
              src={tokenUrl}
              alt={snap.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className={cn(
                "font-bold text-white drop-shadow select-none",
                compact ? "text-2xl" : "text-4xl",
              )}
            >
              {snap.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Cuerpo de la carta */}
      <div className={cn("flex flex-col gap-2 px-3", compact ? "py-2" : "py-3")}>
        {/* Stats de combate */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {/* HP */}
          <span className="flex items-center gap-0.5">
            <Heart className="size-3 text-red-400 shrink-0" />
            {unit ? (
              <span>
                <span className="text-foreground font-semibold">{currentHp}</span>
                <span className="text-muted-foreground">/{snap.hp}</span>
              </span>
            ) : (
              <span className="text-foreground font-semibold">{snap.hp}</span>
            )}
          </span>
          {/* Velocidad */}
          <span className="flex items-center gap-0.5">
            <Footprints className="size-3 text-sky-400 shrink-0" />
            <span className="text-foreground font-semibold">{snap.speed}</span>
          </span>
          {/* Melé */}
          <span className="flex items-center gap-0.5">
            <Swords className="size-3 text-orange-400 shrink-0" />
            <span className="text-foreground font-semibold">{snap.meleeDamage}</span>
          </span>
          {/* Distancia */}
          {snap.rangedDamage !== null && (
            <span className="flex items-center gap-0.5">
              <Crosshair className="size-3 text-violet-400 shrink-0" />
              <span className="text-foreground font-semibold">
                {snap.rangedDamage}@{snap.rangedDistance}
              </span>
            </span>
          )}
        </div>

        {/* Barra de HP (solo cuando hay unidad con daño) */}
        {unit && unit.damage > 0 && (
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${hpPct}%`, backgroundColor: hpColor }}
            />
          </div>
        )}

        {/* Keywords */}
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {keywords.map((kw) => (
              <Badge
                key={kw}
                variant="secondary"
                className="py-0 px-1.5 text-[10px] leading-4 capitalize"
              >
                {kw}
              </Badge>
            ))}
          </div>
        )}

        {/* Atributos */}
        {attributes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {attributes.map((attr) => (
              <Badge
                key={attr}
                variant="outline"
                className="py-0 px-1.5 text-[10px] leading-4 font-semibold"
                style={{ borderColor: snap.factionColor + "80", color: snap.factionColor }}
              >
                {ATTR_ABBR[attr] ?? attr.slice(0, 3).toUpperCase()}
              </Badge>
            ))}
          </div>
        )}

        {/* Poderes */}
        {powers.length > 0 && (
          <>
            <div className="border-t border-border" />
            <div className={cn("space-y-1.5", compact ? "text-[10px]" : "text-xs")}>
              {powers.map((p) => (
                <div key={p.key}>
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Zap className="size-3 text-amber-400 shrink-0" />
                    {p.label}
                  </span>
                  <p className="text-muted-foreground leading-snug pl-4">{p.text}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Tipo auxiliar para acceder a los campos opcionales que aún no están
// declarados en la interfaz pública de CreatureSnapshot (se añadirán cuando
// el motor de reglas los propague desde el backend).
type CreatureSnapshotExtended = Omit<CreatureSnapshot, "keywords"> & {
  keywords?: string[]
  attributes?: string[]
  powers?: Array<{ key: string; label: string; text: string }>
}

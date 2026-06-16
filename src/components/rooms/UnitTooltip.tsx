import type { CreatureSnapshot, GameUnit } from "@/lib/api"
import { CreatureCard } from "./CreatureCard"

interface UnitTooltipProps {
  snap: CreatureSnapshot | null
  unit?: GameUnit
  /** Posición en píxeles relativa al contenedor del Stage. */
  x: number
  y: number
  /** Ancho del Stage para no salirse por la derecha. */
  stageWidth: number
  stageHeight: number
}

export function UnitTooltip({
  snap,
  unit,
  x,
  y,
  stageWidth,
  stageHeight,
}: UnitTooltipProps) {
  if (!snap) return null

  // Si el puntero está en la mitad derecha o inferior, mostrar a la izquierda/arriba
  const showLeft = x > stageWidth * 0.6
  const showAbove = y > stageHeight * 0.6

  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: showLeft ? undefined : x + 8,
        right: showLeft ? stageWidth - x + 8 : undefined,
        top: showAbove ? undefined : y + 8,
        bottom: showAbove ? stageHeight - y + 8 : undefined,
      }}
    >
      <CreatureCard snap={snap} unit={unit} compact />
    </div>
  )
}

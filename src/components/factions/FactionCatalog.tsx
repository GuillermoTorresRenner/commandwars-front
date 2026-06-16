import { useEffect, useState } from "react"
import { Crosshair, Crown, Footprints, Heart, Swords } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { api, assetUrl, ATTRIBUTE_LABELS } from "@/lib/api"
import type { Creature, Faction, Leader } from "@/lib/api"

/** Catálogo de facciones (líderes + tropas) leído de la API (contenido data-driven). */
export function FactionCatalog() {
  const [factions, setFactions] = useState<Faction[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.factions
      .list()
      .then((data) => {
        if (!cancelled) setFactions(data)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "No se pudieron cargar las facciones")
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>
  }

  if (!factions) {
    return <p className="text-muted-foreground text-sm">Cargando facciones…</p>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {factions.map((faction) => (
        <Card key={faction.id} className="overflow-hidden pt-0 shadow-md">
          {/* Franja con el color temático de la facción (dato, no token de tema). */}
          <div className="h-1.5 w-full" style={{ backgroundColor: faction.color }} />
          <CardHeader className="pt-5">
            <div className="flex flex-wrap items-center gap-3">
              <span
                aria-hidden
                className="size-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: faction.color }}
              />
              <CardTitle className="font-heading text-xl">{faction.name}</CardTitle>
              {faction.category && (
                <Badge variant="outline">{faction.category.name}</Badge>
              )}
            </div>
            {faction.tagline && (
              <CardDescription className="italic">“{faction.tagline}”</CardDescription>
            )}
            {faction.description && (
              <CardDescription>{faction.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {faction.leaders.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-muted-foreground inline-flex items-center gap-1.5 text-sm font-medium">
                  <Crown className="text-primary size-4" /> Líderes
                </h4>
                {faction.leaders.map((leader) => (
                  <LeaderRow key={leader.id} leader={leader} factionColor={faction.color} />
                ))}
              </div>
            )}
            <div className="space-y-2">
              <h4 className="text-muted-foreground inline-flex items-center gap-1.5 text-sm font-medium">
                <Swords className="size-4" /> Criaturas
              </h4>
              {faction.creatures.map((creature) => (
                <CreatureRow
                  key={creature.id}
                  creature={creature}
                  factionColor={faction.color}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function Token({
  src,
  name,
  color,
}: {
  src: string | null
  name: string
  color: string
}) {
  if (src) {
    return (
      <img
        src={assetUrl(src)}
        alt=""
        className="border-border size-9 shrink-0 rounded-full border object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 22%, transparent)`,
        color,
      }}
    >
      {name.charAt(0)}
    </span>
  )
}

function LeaderRow({ leader, factionColor }: { leader: Leader; factionColor: string }) {
  return (
    <div className="border-border/70 hover:bg-muted/50 rounded-lg border p-3 transition-colors">
      <div className="flex flex-wrap items-center gap-2">
        <Token src={leader.token} name={leader.name} color={factionColor} />
        <Crown aria-label="Líder" className="text-primary size-4 shrink-0" />
        <span className="font-medium">{leader.name}</span>
        <Badge variant="default">Moral {leader.startingMorale}</Badge>
        <Badge variant="outline">Liderazgo {leader.startingLeadership}</Badge>
        <Badge variant="outline">Mano {leader.orderHand}/{leader.creatureHand}</Badge>
      </div>
      <p className="mt-2 text-sm">
        <span className="text-primary font-medium">{leader.powerLabel}:</span>{" "}
        <span className="text-muted-foreground">{leader.powerText}</span>
      </p>
    </div>
  )
}

function CreatureRow({
  creature,
  factionColor,
}: {
  creature: Creature
  factionColor: string
}) {
  return (
    <div className="border-border/70 hover:bg-muted/50 rounded-lg border p-3 transition-colors">
      <div className="flex flex-wrap items-center gap-2">
        <Token src={creature.token} name={creature.name} color={factionColor} />
        <span className="font-medium">{creature.name}</span>
        <Badge variant="secondary">Nivel {creature.level}</Badge>
        {creature.copies > 1 && <Badge variant="default">×{creature.copies}</Badge>}
        {creature.gridSize === 2 && <Badge variant="outline">2×2</Badge>}
        {(creature.keywords ?? []).map((keyword) => (
          <Badge key={keyword} variant="outline">
            {keyword}
          </Badge>
        ))}
      </div>
      <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1">
          <Heart className="size-3.5" /> {creature.hp} HP
        </span>
        <span className="inline-flex items-center gap-1">
          <Swords className="size-3.5" /> Melé {creature.meleeDamage}
        </span>
        {creature.rangedDamage !== null && (
          <span className="inline-flex items-center gap-1">
            <Crosshair className="size-3.5" /> Distancia {creature.rangedDamage} (
            {creature.rangedDistance} celdas)
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Footprints className="size-3.5" /> Velocidad {creature.speed}
        </span>
      </div>
      {(creature.attributes ?? []).length > 0 && (
        <p className="text-muted-foreground mt-1.5 text-xs">
          Atributos:{" "}
          {(creature.attributes ?? []).map((a) => ATTRIBUTE_LABELS[a]).join(", ")}
        </p>
      )}
      {creature.powers && creature.powers.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {creature.powers.map((power) => (
            <li key={power.key}>
              <span className="text-primary font-medium">{power.label}:</span>{" "}
              <span className="text-muted-foreground">{power.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

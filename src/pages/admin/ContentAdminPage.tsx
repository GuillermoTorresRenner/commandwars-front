import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDown,
  Crosshair,
  Crown,
  Download,
  Footprints,
  Heart,
  Pencil,
  Plus,
  ScrollText,
  Search,
  Swords,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { CategoryFormDialog } from "@/components/admin/CategoryFormDialog"
import { CreatureFormDialog } from "@/components/admin/CreatureFormDialog"
import { FactionFormDialog } from "@/components/admin/FactionFormDialog"
import { LeaderFormDialog } from "@/components/admin/LeaderFormDialog"
import { InspirationCardFormDialog } from "@/components/admin/InspirationCardFormDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api, assetUrl } from "@/lib/api"
import type { Category, Creature, Faction, Leader, OrderCard } from "@/lib/api"
import { cn } from "@/lib/utils"

// ── Utilidades ──────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Búsqueda ────────────────────────────────────────────────────────────

/** Normaliza para comparar sin acentos ni mayúsculas. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  return fields.some((field) => field && normalize(field).includes(query))
}

interface FilteredFaction {
  faction: Faction
  leaders: Leader[]
  creatures: Creature[]
  orderCards: OrderCard[]
}

interface FilteredCategory {
  category: Category
  factions: FilteredFaction[]
}

/**
 * Filtra el árbol: un match en un nivel muestra ese nodo completo; un match
 * en un hijo muestra a sus ancestros con solo los hijos que coinciden.
 */
function filterTree(categories: Category[], rawQuery: string): FilteredCategory[] {
  const query = normalize(rawQuery.trim())
  const fullFaction = (faction: Faction): FilteredFaction => ({
    faction,
    leaders: faction.leaders,
    creatures: faction.creatures,
    orderCards: faction.orderCards,
  })

  if (!query) {
    return categories.map((category) => ({
      category,
      factions: category.factions.map(fullFaction),
    }))
  }

  const result: FilteredCategory[] = []
  for (const category of categories) {
    if (matches(query, category.name, category.description)) {
      result.push({ category, factions: category.factions.map(fullFaction) })
      continue
    }

    const factions: FilteredFaction[] = []
    for (const faction of category.factions) {
      if (matches(query, faction.name, faction.tagline, faction.description)) {
        factions.push(fullFaction(faction))
        continue
      }
      const leaders = faction.leaders.filter((leader) =>
        matches(query, leader.name, leader.powerLabel),
      )
      const creatures = faction.creatures.filter((creature) =>
        matches(query, creature.name),
      )
      const orderCards = faction.orderCards.filter((card) =>
        matches(query, card.name, card.description),
      )
      if (leaders.length > 0 || creatures.length > 0 || orderCards.length > 0) {
        factions.push({ faction, leaders, creatures, orderCards })
      }
    }
    if (factions.length > 0) {
      result.push({ category, factions })
    }
  }
  return result
}

// ── Página ──────────────────────────────────────────────────────────────

/**
 * Mantenedor del contenido data-driven en cards jerárquicas colapsables:
 * categoría → facciones → líderes + criaturas, con buscador transversal.
 */
export function ContentAdminPage() {
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [collapsedFactions, setCollapsedFactions] = useState<Set<string>>(new Set())
  const importFactionRef = useRef<HTMLInputElement>(null)
  const [importingForCategory, setImportingForCategory] = useState<string | null>(null)

  const [categoryForm, setCategoryForm] = useState<{
    open: boolean
    initial: Category | null
  }>({ open: false, initial: null })
  const [factionForm, setFactionForm] = useState<{
    open: boolean
    categoryId: string
    initial: Faction | null
  }>({ open: false, categoryId: "", initial: null })
  const [leaderForm, setLeaderForm] = useState<{
    open: boolean
    factionId: string
    initial: Leader | null
  }>({ open: false, factionId: "", initial: null })
  const [creatureForm, setCreatureForm] = useState<{
    open: boolean
    factionId: string
    initial: Creature | null
  }>({ open: false, factionId: "", initial: null })
  const [inspirationCardForm, setInspirationCardForm] = useState<{
    open: boolean
    factionId: string
    initial: OrderCard | null
  }>({ open: false, factionId: "", initial: null })

  const reload = useCallback(() => {
    api.categories
      .list()
      .then((data) => {
        setCategories(data)
        setError(null)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "No se pudo cargar el contenido"),
      )
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const filtered = useMemo(
    () => (categories ? filterTree(categories, query) : null),
    [categories, query],
  )
  // Con búsqueda activa los resultados se muestran expandidos (la búsqueda manda).
  const searching = query.trim() !== ""

  function toggle(set: Set<string>, id: string): Set<string> {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  async function handleExportFaction(faction: Faction) {
    try {
      const blob = await api.exportFaction(faction.id)
      downloadBlob(blob, `faction-${faction.name.replace(/\s+/g, "_")}.json`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar la facción")
    }
  }

  async function handleImportFaction(file: File, categoryId: string) {
    try {
      await api.importFaction(file, categoryId)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar la facción")
    }
  }

  async function handleDelete(
    kind: "categoría" | "facción" | "líder" | "criatura" | "carta",
    name: string,
    remove: () => Promise<unknown>,
  ) {
    if (!confirm(`¿Eliminar ${kind} "${name}"?`)) return
    try {
      await remove()
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar")
    }
  }

  return (
    <section className="space-y-6">
      {/* Input oculto para seleccionar JSON de facción a importar */}
      <input
        ref={importFactionRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && importingForCategory) {
            void handleImportFaction(file, importingForCategory)
          }
          e.target.value = ""
          setImportingForCategory(null)
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold">Contenido</h2>
        <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
          <div className="relative w-full max-w-xs">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              type="search"
              placeholder="Buscar categoría, facción, líder, criatura…"
              className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                onClick={() => setQuery("")}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button onClick={() => setCategoryForm({ open: true, initial: null })}>
            <Plus className="size-4" /> <span className="hidden sm:inline">Nueva categoría</span>
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {!filtered ? (
        <p className="text-muted-foreground text-sm">Cargando contenido…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {searching ? `Sin resultados para “${query.trim()}”.` : "Sin categorías aún."}
        </p>
      ) : (
        filtered.map(({ category, factions }) => {
          const expanded = searching || !collapsedCategories.has(category.id)
          return (
            <Card key={category.id} className="shadow-md">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    className="group flex min-w-0 flex-1 items-start gap-2 text-left"
                    onClick={() =>
                      setCollapsedCategories((s) => toggle(s, category.id))
                    }
                  >
                    <ChevronDown
                      className={cn(
                        "text-muted-foreground group-hover:text-foreground mt-1 size-4 shrink-0 transition-transform",
                        !expanded && "-rotate-90",
                      )}
                    />
                    <span className="min-w-0 space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <CardTitle className="font-heading text-lg">
                          {category.name}
                        </CardTitle>
                        <Badge variant="secondary">
                          {category.factions.length}{" "}
                          {category.factions.length === 1 ? "facción" : "facciones"}
                        </Badge>
                      </span>
                      {category.description && (
                        <CardDescription>{category.description}</CardDescription>
                      )}
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      title="Importar facción desde JSON"
                      onClick={() => {
                        setImportingForCategory(category.id)
                        importFactionRef.current?.click()
                      }}
                    >
                      <Upload className="size-4" /> <span className="hidden sm:inline">Importar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFactionForm({ open: true, categoryId: category.id, initial: null })
                      }
                    >
                      <Plus className="size-4" /> Facción
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ${category.name}`}
                      onClick={() => setCategoryForm({ open: true, initial: category })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Eliminar ${category.name}`}
                      onClick={() =>
                        void handleDelete("categoría", category.name, () =>
                          api.categories.remove(category.id),
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {expanded && (
                <CardContent className="space-y-5">
                  {factions.length === 0 && (
                    <p className="text-muted-foreground text-sm">
                      Sin facciones aún. Crea la primera con el botón “Facción”.
                    </p>
                  )}
                  {factions.map(({ faction, leaders, creatures, orderCards }) => (
                    <FactionBlock
                      key={faction.id}
                      faction={faction}
                      leaders={leaders}
                      creatures={creatures}
                      orderCards={orderCards}
                      expanded={searching || !collapsedFactions.has(faction.id)}
                      onToggle={() =>
                        setCollapsedFactions((s) => toggle(s, faction.id))
                      }
                      onEdit={() =>
                        setFactionForm({
                          open: true,
                          categoryId: category.id,
                          initial: faction,
                        })
                      }
                      onDelete={() =>
                        void handleDelete("facción", faction.name, () =>
                          api.factions.remove(faction.id),
                        )
                      }
                      onExport={() => void handleExportFaction(faction)}
                      onAddLeader={() =>
                        setLeaderForm({ open: true, factionId: faction.id, initial: null })
                      }
                      onEditLeader={(leader) =>
                        setLeaderForm({ open: true, factionId: faction.id, initial: leader })
                      }
                      onDeleteLeader={(leader) =>
                        void handleDelete("líder", leader.name, () =>
                          api.leaders.remove(leader.id),
                        )
                      }
                      onAddCreature={() =>
                        setCreatureForm({ open: true, factionId: faction.id, initial: null })
                      }
                      onEditCreature={(creature) =>
                        setCreatureForm({
                          open: true,
                          factionId: faction.id,
                          initial: creature,
                        })
                      }
                      onDeleteCreature={(creature) =>
                        void handleDelete("criatura", creature.name, () =>
                          api.creatures.remove(creature.id),
                        )
                      }
                      onAddInspirationCard={() =>
                        setInspirationCardForm({ open: true, factionId: faction.id, initial: null })
                      }
                      onEditInspirationCard={(card) =>
                        setInspirationCardForm({ open: true, factionId: faction.id, initial: card })
                      }
                      onDeleteInspirationCard={(card) =>
                        void handleDelete("carta", card.name, () =>
                          api.orderCards.remove(card.id),
                        )
                      }
                    />
                  ))}
                </CardContent>
              )}
            </Card>
          )
        })
      )}

      <CategoryFormDialog
        open={categoryForm.open}
        onOpenChange={(open) => setCategoryForm((s) => ({ ...s, open }))}
        initial={categoryForm.initial}
        onSaved={reload}
      />
      <FactionFormDialog
        open={factionForm.open}
        onOpenChange={(open) => setFactionForm((s) => ({ ...s, open }))}
        categoryId={factionForm.categoryId}
        initial={factionForm.initial}
        onSaved={reload}
      />
      <LeaderFormDialog
        open={leaderForm.open}
        onOpenChange={(open) => setLeaderForm((s) => ({ ...s, open }))}
        factionId={leaderForm.factionId}
        initial={leaderForm.initial}
        onSaved={reload}
      />
      <CreatureFormDialog
        open={creatureForm.open}
        onOpenChange={(open) => setCreatureForm((s) => ({ ...s, open }))}
        factionId={creatureForm.factionId}
        initial={creatureForm.initial}
        onSaved={reload}
      />
      <InspirationCardFormDialog
        open={inspirationCardForm.open}
        onOpenChange={(open) => setInspirationCardForm((s) => ({ ...s, open }))}
        factionId={inspirationCardForm.factionId}
        initial={inspirationCardForm.initial}
        onSaved={reload}
      />
    </section>
  )
}

// ── Cards internas ──────────────────────────────────────────────────────

interface FactionBlockProps {
  faction: Faction
  /** Hijos ya filtrados por el buscador. */
  leaders: Leader[]
  creatures: Creature[]
  orderCards: OrderCard[]
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onExport: () => void
  onAddLeader: () => void
  onEditLeader: (leader: Leader) => void
  onDeleteLeader: (leader: Leader) => void
  onAddCreature: () => void
  onEditCreature: (creature: Creature) => void
  onDeleteCreature: (creature: Creature) => void
  onAddInspirationCard: () => void
  onEditInspirationCard: (card: OrderCard) => void
  onDeleteInspirationCard: (card: OrderCard) => void
}

function FactionBlock({
  faction,
  leaders,
  creatures,
  orderCards,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onExport,
  onAddLeader,
  onEditLeader,
  onDeleteLeader,
  onAddCreature,
  onEditCreature,
  onDeleteCreature,
  onAddInspirationCard,
  onEditInspirationCard,
  onDeleteInspirationCard,
}: FactionBlockProps) {
  return (
    <div
      className="bg-card/60 rounded-xl border p-4 shadow-sm"
      style={{ borderLeft: `4px solid ${faction.color}` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          aria-expanded={expanded}
          className="group flex min-w-0 flex-1 items-start gap-2 text-left"
          onClick={onToggle}
        >
          <ChevronDown
            className={cn(
              "text-muted-foreground group-hover:text-foreground mt-1 size-4 shrink-0 transition-transform",
              !expanded && "-rotate-90",
            )}
          />
          <span className="min-w-0 space-y-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span
                aria-hidden
                className="size-3 rounded-full"
                style={{ backgroundColor: faction.color }}
              />
              <h3 className="font-heading text-base font-semibold">{faction.name}</h3>
              <Badge variant="secondary">
                <Crown className="size-3" /> {faction.leaders.length}
              </Badge>
              <Badge variant="secondary">
                <Swords className="size-3" />{" "}
                {faction.creatures.reduce((sum, c) => sum + c.copies, 0)}
              </Badge>
              <Badge variant="secondary">
                <ScrollText className="size-3" />{" "}
                {faction.orderCards.reduce((sum, c) => sum + c.copies, 0)}
              </Badge>
            </span>
            {faction.tagline && (
              <span className="text-muted-foreground block text-sm italic">
                “{faction.tagline}”
              </span>
            )}
          </span>
        </button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={`Exportar ${faction.name} como JSON`} title="Exportar como JSON" onClick={onExport}>
            <Download className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${faction.name}`} onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${faction.name}`} onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-muted-foreground inline-flex items-center gap-1.5 text-sm font-medium">
                <Crown className="text-primary size-4" /> Líderes
              </h4>
              <Button variant="outline" size="sm" onClick={onAddLeader}>
                <Plus className="size-4" /> Líder
              </Button>
            </div>
            {leaders.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {faction.leaders.length === 0
                  ? "Sin líderes. Una facción necesita al menos uno para jugarse."
                  : "Ningún líder coincide con la búsqueda."}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {leaders.map((leader) => (
                  <LeaderCard
                    key={leader.id}
                    leader={leader}
                    factionColor={faction.color}
                    onEdit={() => onEditLeader(leader)}
                    onDelete={() => onDeleteLeader(leader)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-muted-foreground inline-flex items-center gap-1.5 text-sm font-medium">
                <Swords className="size-4" /> Criaturas
              </h4>
              <Button variant="outline" size="sm" onClick={onAddCreature}>
                <Plus className="size-4" /> Criatura
              </Button>
            </div>
            {creatures.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {faction.creatures.length === 0
                  ? "Sin criaturas aún."
                  : "Ninguna criatura coincide con la búsqueda."}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {creatures.map((creature) => (
                  <CreatureCard
                    key={creature.id}
                    creature={creature}
                    factionColor={faction.color}
                    onEdit={() => onEditCreature(creature)}
                    onDelete={() => onDeleteCreature(creature)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-muted-foreground inline-flex items-center gap-1.5 text-sm font-medium">
                <ScrollText className="size-4" /> Deck de inspiraciones
              </h4>
              <Button variant="outline" size="sm" onClick={onAddInspirationCard}>
                <Plus className="size-4" /> Inspiración
              </Button>
            </div>
            {orderCards.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {faction.orderCards.length === 0
                  ? "Deck vacío. Agrega inspiraciones (atributos transitorios por ahora)."
                  : "Ninguna inspiración coincide con la búsqueda."}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {orderCards.map((card) => (
                  <InspirationCardItem
                    key={card.id}
                    card={card}
                    onEdit={() => onEditInspirationCard(card)}
                    onDelete={() => onDeleteInspirationCard(card)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function InspirationCardItem({
  card,
  onEdit,
  onDelete,
}: {
  card: OrderCard
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-card hover:bg-muted/40 rounded-lg border p-3 shadow-sm transition-colors">
      <div className="flex items-start gap-2">
        <ScrollText className="text-primary mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium">{card.name}</span>
        {card.copies > 1 && (
          <Badge variant="default" className="shrink-0">
            ×{card.copies}
          </Badge>
        )}
        <div className="flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${card.name}`} onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${card.name}`} onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {card.description && (
        <p className="text-muted-foreground mt-1.5 line-clamp-3 text-sm">{card.description}</p>
      )}
    </div>
  )
}

/** Token circular con placeholder de inicial en el color de la facción. */
function TokenAvatar({
  src,
  name,
  color,
  size = "size-12",
}: {
  src: string | null
  name: string
  color: string
  size?: string
}) {
  if (src) {
    return (
      <img
        src={assetUrl(src)}
        alt=""
        className={`${size} border-border shrink-0 rounded-full border object-cover`}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={`${size} flex shrink-0 items-center justify-center rounded-full text-base font-semibold`}
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 22%, transparent)`,
        color,
      }}
    >
      {name.charAt(0)}
    </span>
  )
}

function LeaderCard({
  leader,
  factionColor,
  onEdit,
  onDelete,
}: {
  leader: Leader
  factionColor: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-card hover:bg-muted/40 rounded-lg border p-3 shadow-sm transition-colors">
      <div className="flex items-start gap-3">
        <TokenAvatar src={leader.token} name={leader.name} color={factionColor} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <Crown className="text-primary size-4 shrink-0" />
            <span className="truncate font-medium">{leader.name}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">Moral {leader.startingMorale}</Badge>
            <Badge variant="secondary">Liderazgo {leader.startingLeadership}</Badge>
            <Badge variant="outline">Órdenes {leader.orderHand}</Badge>
            <Badge variant="outline">Criaturas {leader.creatureHand}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${leader.name}`} onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${leader.name}`} onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <p className="mt-2 text-sm">
        <span className="text-primary font-medium">{leader.powerLabel}:</span>{" "}
        <span className="text-muted-foreground">{leader.powerText}</span>
      </p>
    </div>
  )
}

function CreatureCard({
  creature,
  factionColor,
  onEdit,
  onDelete,
}: {
  creature: Creature
  factionColor: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-card hover:bg-muted/40 rounded-lg border p-3 shadow-sm transition-colors">
      <div className="flex items-start gap-3">
        <TokenAvatar src={creature.token} name={creature.name} color={factionColor} />
        <div className="min-w-0 flex-1 space-y-1">
          <span className="block truncate font-medium">{creature.name}</span>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">Nivel {creature.level}</Badge>
            {creature.copies > 1 && <Badge variant="default">×{creature.copies}</Badge>}
            {creature.gridSize === 2 && <Badge variant="outline">2×2</Badge>}
            {(creature.keywords ?? []).map((keyword) => (
              <Badge key={keyword} variant="outline">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${creature.name}`} onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${creature.name}`} onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1">
          <Heart className="size-3.5" /> {creature.hp}
        </span>
        <span className="inline-flex items-center gap-1">
          <Swords className="size-3.5" /> {creature.meleeDamage}
        </span>
        {creature.rangedDamage !== null && (
          <span className="inline-flex items-center gap-1">
            <Crosshair className="size-3.5" /> {creature.rangedDamage}@
            {creature.rangedDistance}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Footprints className="size-3.5" /> {creature.speed}
        </span>
      </div>
    </div>
  )
}

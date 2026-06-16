/**
 * GameBoard — tablero de partida fullscreen.
 *
 * Interacción:
 *   - Click izquierdo: seleccionar unidad / colocar en zona de despliegue
 *   - Click izquierdo en celda verde: mover la unidad seleccionada
 *   - Movimiento por etapas: cada "mover aquí" descuenta el movimiento gastado
 *     y recalcula el rango con el presupuesto restante. Se puede mover varias
 *     veces hasta agotar la velocidad.
 *   - Click en carta (criatura/orden): abre modal con ficha completa
 *   - Zoom 100%–200% con rueda/botones. Pan con click izquierdo sobre el fondo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crown,
  Flag,
  Hand,
  Heart,
  Info,
  Minus,
  MousePointer2,
  Plus,
  RotateCcw,
  Skull,
  Trophy,
  Zap,
} from "lucide-react"
import {
  Circle,
  Group,
  Layer,
  Image as KonvaImage,
  Line,
  Rect,
  Stage,
  Text,
} from "react-konva"
import { TerrainLayer, WallLayer } from "@/components/board/terrain-sprites"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useImage } from "@/hooks/use-image"
import { assetUrl } from "@/lib/api"
import type {
  CreatureSnapshot,
  GameAction,
  GameState,
  GameTreasure,
  GameUnit,
  GraveEntry,
  InspirationCardSnapshot,
  PendingAttack,
  PlayerSide,
} from "@/lib/api"
import { movementRange, spaceDistanceBetween, unitsAdjacent } from "@/game/range"
import { TERRAINS } from "@/lib/terrain"
import { cn } from "@/lib/utils"
import { UnitTooltip } from "./UnitTooltip"

// ── Tipos ────────────────────────────────────────────────────────────────────

/**
 * Estado de selección activa para movimiento por etapas.
 * Solo guarda el uid; el rango se calcula directo del GameUnit.movementSpent
 * que viene del servidor después de cada move.
 */
interface MoveSelection {
  uid: string
}

interface DamageFloater {
  id: number
  uid: string
  label: string
  kind: "dmg-hit" | "dmg-death" | "dmg-heal"
  x: number
  y: number
}

type ActiveMode =
  | { kind: "idle" }
  | { kind: "deploy"; creatureId: string }
  | { kind: "attack"; uid: string; attackMode: "melee" | "ranged" }
  | { kind: "playCard"; uid: string; cardId: string }

/** Modal de ficha completa (criatura o inspiración) */
type CardModal =
  | { kind: "creature"; snap: CreatureSnapshot; unit?: GameUnit }
  | { kind: "order"; card: InspirationCardSnapshot; factionColor: string }

interface GameBoardProps {
  state: GameState
  mySide: PlayerSide
  mapImage: string | null
  sendAction: (action: GameAction) => void
  myDeploySide?: "A" | "B"
}

// ── Constantes ───────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  setup: "Despliegue inicial",
  activate: "Activación",
  deploy: "Despliegue",
  finished: "Fin de partida",
}

const ZOOM_MIN = 1.0   // no se puede ver "más pequeño" que 100%
const ZOOM_MAX = 2.0   // máximo 200%
const ZOOM_STEP = 0.1
const SIDE_W_MIN = 200
const SIDE_W_MAX = 420
const SIDE_W_DEFAULT = 260

// ── Helper puro: ¿la unidad puede hacer alguna acción? ───────────────────────
function unitCanAct(unit: GameUnit, isMyTurn: boolean, phase: string): boolean {
  if (!isMyTurn || phase !== "activate") return false
  if (unit.tapped) return false
  return !unit.moved || !unit.attacked
}

// ── Helpers de acceso seguro ─────────────────────────────────────────────────

function getInspirationCatalog(s: GameState): Record<string, InspirationCardSnapshot> {
  return (s as unknown as Record<string, unknown>).orderCatalog as Record<string, InspirationCardSnapshot> ?? {}
}
function getInspirationHand(s: GameState, side: PlayerSide): string[] {
  return ((s.players[side] as unknown as Record<string, unknown>).orderHand ?? []) as string[]
}
function getInspirationDiscard(s: GameState, side: PlayerSide): string[] {
  return ((s.players[side] as unknown as Record<string, unknown>).orderDiscard ?? []) as string[]
}
function getTreasureRemaining(t: GameTreasure): number {
  return (t as unknown as Record<string, unknown>).remaining as number ?? (t.collected ? 0 : 1)
}
function getTreasureValue(t: GameTreasure): number {
  return (t as unknown as Record<string, unknown>).value as number ?? 1
}
function getPendingAttack(s: GameState): PendingAttack | null {
  return (s as unknown as Record<string, unknown>).pendingAttack as PendingAttack | null ?? null
}

// Velocidad real este turno (1 si empieza adyacente a enemigo)
function effectiveSpeed(state: GameState, unit: GameUnit): number {
  const startAdjacent = state.units.some(
    (other) => other.owner !== unit.owner && unitsAdjacent(state, unit, other),
  )
  return startAdjacent ? 1 : state.catalog[unit.creatureId].speed
}

// ── Hook: tamaño del contenedor ──────────────────────────────────────────────

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 800, h: 600 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ w: Math.max(200, width), h: Math.max(200, height) })
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return size
}

// ── Componente principal ─────────────────────────────────────────────────────

export function GameBoard({ state, mySide, mapImage, sendAction }: GameBoardProps) {
  // Layout
  const [sideOpen, setSideOpen] = useState(true)
  const [sideW, setSideW] = useState(SIDE_W_DEFAULT)
  const [logOpen, setLogOpen] = useState(false)
  const [cardModal, setCardModal] = useState<CardModal | null>(null)
  const [inspirationModalUid, setInspirationModalUid] = useState<string | null>(null)

  // Interacción
  const [mode, setMode] = useState<ActiveMode>({ kind: "idle" })
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [moveSelection, setMoveSelection] = useState<MoveSelection | null>(null)
  const [tooltip, setTooltip] = useState<{ snap: CreatureSnapshot; unit: GameUnit; x: number; y: number } | null>(null)
  const [terrainTooltip, setTerrainTooltip] = useState<{ label: string; description: string; fill: string; x: number; y: number } | null>(null)
  // Modal de fin de turno: se muestra cuando todas las unidades han actuado
  const [endTurnModalOpen, setEndTurnModalOpen] = useState(false)
  // Modal de despliegue: seleccionar criatura para colocar en el mapa
  const [deployModalOpen, setDeployModalOpen] = useState(false)
  // Modal de leyenda de terrenos
  const [terrainLegendOpen, setTerrainLegendOpen] = useState(false)
  // Modal carta de inspiración robada al inicio del turno
  const [drawnCardModal, setDrawnCardModal] = useState<string | null>(null)

  // Notificaciones de combate: entradas del log nuevas mientras NO es tu turno
  const [combatToasts, setCombatToasts] = useState<{ id: number; text: string }[]>([])
  const lastLogEntry = useRef<string | null>(null)
  const toastCounter = useRef(0)

  // Floaters de daño sobre el canvas
  const [damageFloaters, setDamageFloaters] = useState<DamageFloater[]>([])
  const floaterCounter = useRef(0)
  const prevUnits = useRef<Map<string, { damage: number; x: number; y: number; gridSize: number }>>(new Map())

  // Animación de impacto: uids con efecto de sacudón + flash rojo
  const [hitUids, setHitUids] = useState<Set<string>>(new Set())
  const [healUids, setHealUids] = useState<Set<string>>(new Set())

  // Zoom + pan
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  // Modo pan forzado (botón Hand activo): el click izquierdo siempre hace pan
  const [panMode, setPanMode] = useState(false)
  // Pan con click izquierdo sobre fondo vacío
  const isPanning = useRef(false)
  const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const didPan = useRef(false)  // distingue pan de click

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const stageContainerRef = useRef<HTMLDivElement>(null)
  const containerSize = useContainerSize(mapContainerRef)

  // Drag-to-resize del panel lateral
  const handleResizeDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = sideW
    const onMove = (ev: MouseEvent) => {
      // Panel está a la izquierda: mover derecha = agrandar
      const delta = ev.clientX - startX
      setSideW(Math.min(SIDE_W_MAX, Math.max(SIDE_W_MIN, startW + delta)))
    }
    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }, [sideW])

  const image = useImage(assetUrl(mapImage) ?? "")

  // Tamaño natural del mapa (a zoom=1 llena el contenedor)
  const baseCell = Math.max(
    6,
    Math.floor(Math.min(containerSize.w / state.map.cols, containerSize.h / state.map.rows)),
  )
  const cell = baseCell
  const boardW = cell * state.map.cols
  const boardH = cell * state.map.rows

  const myTurn = state.turn === mySide && state.winner === null
  const me = state.players[mySide]
  const opp = state.players[mySide === "host" ? "guest" : "host"]
  const oppSide: PlayerSide = mySide === "host" ? "guest" : "host"
  const myZone = mySide === "host" ? "deployA" : "deployB"
  const selected = state.units.find((u) => u.uid === selectedUid) ?? null

  const orderCatalog = getInspirationCatalog(state)
  const myOrderHand = getInspirationHand(state, mySide)
  const myOrderDiscard = getInspirationDiscard(state, mySide)
  const oppOrderDiscard = getInspirationDiscard(state, oppSide)
  const graveyard: GraveEntry[] = (state as unknown as Record<string, unknown>).graveyard as GraveEntry[] ?? []
  const pendingAttack = getPendingAttack(state)
  // Soy el defensor si hay un ataque pendiente y el turno es mío (el motor me lo cedió)
  const amDefender = pendingAttack !== null && state.turn === mySide
  const myTargetUnit = amDefender ? state.units.find((u) => u.uid === pendingAttack.targetUid) ?? null : null

  const deployedLevels = state.units
    .filter((u) => u.owner === mySide)
    .reduce((sum, u) => sum + state.catalog[u.creatureId].level, 0)

  const canDeployNow = myTurn &&
    ((state.phase === "setup" && !state.setupDone[mySide]) || state.phase === "deploy")

  const collectedTreasures = useMemo(
    () => new Set(state.treasures.filter((t) => t.collected).map((t) => `${t.x},${t.y}`)),
    [state.treasures],
  )

  // Índice de celda → metadata de terreno para tooltip (solo terrenos "interesantes")
  const terrainIndex = useMemo(() => {
    const TOOLTIP_TERRAINS = new Set(["difficult", "hazardous", "obstacle", "wall", "magic", "treasure"])
    const idx = new Map<string, { label: string; description: string; fill: string }>()
    for (const cell of state.map.cells) {
      if (!TOOLTIP_TERRAINS.has(cell.t)) continue
      const meta = TERRAINS.find((t) => t.key === cell.t)
      if (meta) idx.set(`${cell.x},${cell.y}`, { label: meta.label, description: meta.description, fill: meta.fill })
    }
    return idx
  }, [state.map.cells])

  // Rango de movimiento activo (resaltado verde).
  // Una unidad no puede mover si: ya agotó el movimiento, ya atacó, o está agotada
  // (atacó, recogió tesoro o jugó carta standard).
  const moveRangeDisplay = useMemo((): Map<string, number> => {
    if (!selected || !myTurn || state.phase !== "activate") return new Map()
    if (selected.moved || selected.attacked || selected.tapped) return new Map()
    return movementRange(state, selected)
  }, [selected, state, myTurn])

  const deployCells = useMemo(() => {
    if (!canDeployNow || mode.kind !== "deploy") return new Set<string>()
    return new Set(state.map.cells.filter((c) => c.t === myZone).map((c) => `${c.x},${c.y}`))
  }, [canDeployNow, mode, state.map.cells, myZone])

  const gridLines = useMemo(() => {
    const lines: number[][] = []
    for (let x = 0; x <= state.map.cols; x++) lines.push([x * cell, 0, x * cell, boardH])
    for (let y = 0; y <= state.map.rows; y++) lines.push([0, y * cell, boardW, y * cell])
    return lines
  }, [state.map.cols, state.map.rows, cell, boardW, boardH])

  // Limpiar moveSelection cuando la unidad agota su movimiento o cambia el turno
  useEffect(() => {
    if (!moveSelection) return
    const unit = state.units.find((u) => u.uid === moveSelection.uid)
    if (!unit || unit.moved || state.phase !== "activate" || !myTurn) {
      setMoveSelection(null)
    }
  }, [state, moveSelection, myTurn])

  // Mostrar notificaciones de combate cuando llegan entradas nuevas en state.log
  // Se muestra siempre que haya entradas nuevas (independientemente del turno)
  useEffect(() => {
    if (!state.log || state.log.length === 0) return
    const newest = state.log[0]
    if (newest === lastLogEntry.current) return
    // Detectar cuántas entradas nuevas hay desde la última vista
    const prevIdx = lastLogEntry.current
      ? state.log.indexOf(lastLogEntry.current)
      : state.log.length
    const newEntries = prevIdx > 0 ? state.log.slice(0, prevIdx) : [newest]
    lastLogEntry.current = newest
    // Solo mostrar entradas de combate/acción (ignorar ruido de fase)
    const combatKeywords = ["ataca", "dispara", "recibe", "usa la", "muere", "tesoro", "destrui"]
    const toShow = newEntries.filter((e) =>
      combatKeywords.some((kw) => e.toLowerCase().includes(kw)),
    )
    if (toShow.length === 0) return
    const now = Date.now()
    const fresh = toShow.map((text, i) => ({ id: now + i, text }))
    setCombatToasts((prev) => [...fresh, ...prev].slice(0, 5))
  }, [state.log])

  // ── Floaters de daño: detectar cambios de HP entre estados ─────────────────
  useEffect(() => {
    const fresh: DamageFloater[] = []
    const hitQueue: string[] = []
    const healQueue: string[] = []
    const now = Date.now()

    for (const unit of state.units) {
      const snap = state.catalog[unit.creatureId]
      const gridSize = snap?.gridSize ?? 1
      // Centro del token en coords del Stage
      const cx = (unit.x + gridSize / 2) * cell
      const cy = unit.y * cell

      const prev = prevUnits.current.get(unit.uid)
      if (prev !== undefined && unit.damage !== prev.damage) {
        const delta = unit.damage - prev.damage
        if (delta > 0) {
          fresh.push({ id: now + floaterCounter.current++, uid: unit.uid, label: `-${delta}`, kind: "dmg-hit", x: cx, y: cy })
          hitQueue.push(unit.uid)
        } else {
          fresh.push({ id: now + floaterCounter.current++, uid: unit.uid, label: `+${-delta}`, kind: "dmg-heal", x: cx, y: cy })
          healQueue.push(unit.uid)
        }
      }
      prevUnits.current.set(unit.uid, { damage: unit.damage, x: unit.x, y: unit.y, gridSize })
    }

    // Detectar unidades que desaparecieron (murieron)
    for (const [uid, prev] of prevUnits.current.entries()) {
      const stillAlive = state.units.some((u) => u.uid === uid)
      if (!stillAlive) {
        const cx = (prev.x + prev.gridSize / 2) * cell
        const cy = prev.y * cell
        fresh.push({ id: now + floaterCounter.current++, uid, label: "💀", kind: "dmg-death", x: cx, y: cy })
        hitQueue.push(uid)
        prevUnits.current.delete(uid)
      }
    }

    if (fresh.length > 0) {
      setDamageFloaters((prev) => [...prev, ...fresh])
      const ids = fresh.map((f) => f.id)
      setTimeout(() => { setDamageFloaters((prev) => prev.filter((f) => !ids.includes(f.id))) }, 1200)
    }
    if (hitQueue.length > 0) {
      setHitUids((prev) => new Set([...prev, ...hitQueue]))
      setTimeout(() => { setHitUids((prev) => { const n = new Set(prev); hitQueue.forEach((u) => n.delete(u)); return n }) }, 500)
    }
    if (healQueue.length > 0) {
      setHealUids((prev) => new Set([...prev, ...healQueue]))
      setTimeout(() => { setHealUids((prev) => { const n = new Set(prev); healQueue.forEach((u) => n.delete(u)); return n }) }, 500)
    }
  }, [state.units, state.catalog, cell])

  // ── Helpers de acciones disponibles ─────────────────────────────────────

  // Bloquea el cambio de unidad solo si ya comprometió una acción (movió) y aún puede atacar.
  // Si no ha hecho nada todavía, se puede cambiar libremente.
  function unitHasRemainingActions(unit: GameUnit): boolean {
    if (!myTurn || state.phase !== "activate" || unit.tapped) return false
    return unit.moved && !unit.attacked
  }

  // Todas mis unidades han terminado — recalculado con todos los valores frescos
  const allMyUnitsDone = useMemo(() => {
    if (!myTurn || state.phase !== "activate") return false
    const myUnits = state.units.filter((u) => u.owner === mySide)
    if (myUnits.length === 0) return false
    return myUnits.every((u) => !unitCanAct(u, myTurn, state.phase))
  }, [state.units, state.phase, mySide, myTurn])

  // Abrir el modal cuando todas las unidades terminan
  // Usamos una ref para evitar re-abrir si el usuario lo cerró manualmente
  const prevAllDone = useRef(false)
  useEffect(() => {
    if (allMyUnitsDone && !prevAllDone.current) {
      setEndTurnModalOpen(true)
    }
    prevAllDone.current = allMyUnitsDone
  }, [allMyUnitsDone])

  // Detectar carta de inspiración robada al inicio del turno.
  // prevDrawnCard evita mostrar el mismo modal dos veces aunque el estado llegue duplicado.
  // No reseteamos el ref cuando drawn es null para evitar race conditions con el servidor.
  const prevDrawnCard = useRef<string | null>(null)
  useEffect(() => {
    const drawn = state.lastDrawnOrderCard
    if (drawn && drawn.side === mySide && drawn.cardId !== prevDrawnCard.current) {
      prevDrawnCard.current = drawn.cardId
      setDrawnCardModal(drawn.cardId)
    }
  }, [state.lastDrawnOrderCard, mySide])

  // ── Zoom ─────────────────────────────────────────────────────────────────

  // Pan centrado para un zoom dado: centra el eje si el mapa cabe, si no va a 0
  const centeredPan = useCallback((z: number): { x: number; y: number } => {
    const cw = containerSize.w
    const ch = containerSize.h
    return {
      x: boardW * z < cw ? (cw - boardW * z) / 2 / z : 0,
      y: boardH * z < ch ? (ch - boardH * z) / 2 / z : 0,
    }
  }, [boardW, boardH, containerSize])

  // Clampea pan: centra si el mapa cabe, limita bordes si no cabe
  const clampPan = useCallback((px: number, py: number, z: number): { x: number; y: number } => {
    const cw = containerSize.w
    const ch = containerSize.h
    const scaledW = boardW * z
    const scaledH = boardH * z
    const cx = scaledW <= cw ? (cw - scaledW) / 2 / z : Math.min(0, Math.max(-(scaledW - cw) / z, px))
    const cy = scaledH <= ch ? (ch - scaledH) / 2 / z : Math.min(0, Math.max(-(scaledH - ch) / z, py))
    return { x: cx, y: cy }
  }, [boardW, boardH, containerSize])

  const applyZoom = useCallback((next: number, currentZoom: number, currentPan: { x: number; y: number }, focalX?: number, focalY?: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
    // focal point en coords del canvas (sin zoom); fallback: centro del contenedor
    const fx = focalX ?? containerSize.w / 2 / currentZoom
    const fy = focalY ?? containerSize.h / 2 / currentZoom
    // mantener el punto focal fijo al cambiar el zoom
    const nx = fx - (fx - currentPan.x) * (clamped / currentZoom)
    const ny = fy - (fy - currentPan.y) * (clamped / currentZoom)
    setZoom(clamped)
    setPan(clampPan(nx, ny, clamped))
  }, [containerSize, clampPan])

  // Centrar el mapa cuando el contenedor tenga sus dimensiones reales (primer render)
  const didInitCenter = useRef(false)
  useEffect(() => {
    if (didInitCenter.current) return
    if (containerSize.w > 200 && containerSize.h > 200 && boardW > 0 && boardH > 0) {
      didInitCenter.current = true
      setPan(centeredPan(1))
    }
  }, [containerSize, boardW, boardH, centeredPan])

  const resetView = useCallback(() => {
    setZoom(1)
    setPan(centeredPan(1))
  }, [centeredPan])

  // Rueda del ratón → zoom centrado en el cursor
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = stageContainerRef.current?.getBoundingClientRect()
    if (!rect) return
    // Punto focal en coordenadas del canvas (antes del zoom)
    const focalX = (e.clientX - rect.left) / zoom
    const focalY = (e.clientY - rect.top) / zoom
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
    applyZoom(zoom + delta, zoom, pan, focalX, focalY)
  }, [zoom, pan, applyZoom])

  // Pan con click izquierdo sobre fondo vacío (mousedown en contenedor)
  const handleMapMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      isPanning.current = panMode  // en panMode arranca de inmediato
      panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
      didPan.current = panMode
    }
  }, [pan, panMode])

  const handleMapMouseMove = useCallback((e: React.MouseEvent) => {
    if (e.buttons !== 1) return
    const dx = e.clientX - panStart.current.mx
    const dy = e.clientY - panStart.current.my
    if (!isPanning.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      isPanning.current = true
    }
    if (isPanning.current) {
      didPan.current = true
      const nx = panStart.current.px + dx / zoom
      const ny = panStart.current.py + dy / zoom
      setPan(clampPan(nx, ny, zoom))
    }
  }, [zoom, clampPan])

  const handleMapMouseUp = useCallback(() => {
    isPanning.current = false
  }, [])

  // ── Helpers de celda ─────────────────────────────────────────────────────

  function unitAtCell(cx: number, cy: number): GameUnit | null {
    return state.units.find((u) => {
      const s = state.catalog[u.creatureId]?.gridSize ?? 1
      return cx >= u.x && cx < u.x + s && cy >= u.y && cy < u.y + s
    }) ?? null
  }

  function treasureAtCell(cx: number, cy: number): GameTreasure | null {
    return state.treasures.find((t) => !t.collected && t.x === cx && t.y === cy) ?? null
  }

  // ── Click izquierdo ──────────────────────────────────────────────────────

  const handleStageClick = useCallback((stageX: number, stageY: number) => {
    if (didPan.current) { didPan.current = false; return }
    if (panMode) return  // en modo pan el click izquierdo no selecciona

    const cx = Math.floor(stageX / cell)
    const cy = Math.floor(stageY / cell)
    const clickedUnit = unitAtCell(cx, cy)

    // Modo despliegue: click en zona válida despliega
    if (mode.kind === "deploy" && deployCells.has(`${cx},${cy}`)) {
      sendAction({ type: "deploy", creatureId: mode.creatureId, x: cx, y: cy })
      setMode({ kind: "idle" })
      return
    }

    // Modo ataque: click en enemigo ataca
    if (mode.kind === "attack" && clickedUnit && clickedUnit.owner !== mySide) {
      sendAction({ type: "attack", uid: mode.uid, targetUid: clickedUnit.uid, mode: mode.attackMode })
      setMode({ kind: "idle" })
      return
    }

    // Click izquierdo en celda del rango de movimiento → mover
    if (selected && myTurn && state.phase === "activate" && !clickedUnit &&
        !selected.moved && !selected.attacked && !selected.tapped &&
        moveRangeDisplay.has(`${cx},${cy}`)) {
      sendAction({ type: "move", uid: selected.uid, x: cx, y: cy })
      setMoveSelection({ uid: selected.uid })
      return
    }

    // Click en propia unidad → seleccionar (o deseleccionar)
    if (clickedUnit?.owner === mySide) {
      if (clickedUnit.uid === selectedUid) {
        // Clic en la propia unidad seleccionada → deseleccionar siempre
        setSelectedUid(null)
        setMoveSelection(null)
        setMode({ kind: "idle" })
      } else {
        // Cambiar a otra unidad: bloquear silenciosamente si la actual tiene acciones pendientes
        if (selected && unitHasRemainingActions(selected)) {
          return  // bloqueo silencioso — el botón "Terminar turno de X" es la salida
        }
        setSelectedUid(clickedUnit.uid)
        setMoveSelection(null)
        setMode({ kind: "idle" })
      }
      return
    }

    // Click en celda vacía → deseleccionar (solo si no tiene acciones pendientes)
    if (selected && unitHasRemainingActions(selected)) {
      return  // bloqueo silencioso
    }
    setSelectedUid(null)
    setMoveSelection(null)
    setMode({ kind: "idle" })
  }, [panMode, cell, mode, deployCells, mySide, selectedUid, sendAction, selected, state, myTurn, moveRangeDisplay])

  // ── Render ───────────────────────────────────────────────────────────────

  const inMoveMode = !!(selected && myTurn && state.phase === "activate" && !selected.moved)
  const contextLabel = (() => {
    if (mode.kind === "attack") return `Clic en enemigo para ${mode.attackMode === "melee" ? "atacar" : "disparar"}.`
    if (mode.kind === "deploy") return "Clic en tu zona de despliegue (violeta)."
    if (mode.kind === "playCard") return "Carta lista — clic en criatura actora para usar."
    if (selected && unitHasRemainingActions(selected)) {
      const snap = state.catalog[selected.creatureId]
      return `${snap?.name ?? "Unidad"} ya movió — ataca, usa carta o termina su turno para cambiar de unidad.`
    }
    if (inMoveMode && selected) {
      const baseSpeed = effectiveSpeed(state, selected)
      const remaining = baseSpeed - (selected.movementSpent ?? 0)
      const snap = state.catalog[selected.creatureId]
      if (remaining > 0) {
        const trabaStr = baseSpeed === 1 && state.units.some(
          (other) => other.owner !== selected.owner && unitsAdjacent(state, selected, other),
        ) ? " (trabada)" : ""
        return `${snap?.name ?? "Unidad"}${trabaStr}: ${remaining} pts restantes. Clic en celda verde para mover.`
      }
    }
    return null
  })()

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full bg-background overflow-hidden">

        {/* Barra de herramientas del tablero (navbar) */}
        <div className="shrink-0 border-b border-border/40 bg-card/60 backdrop-blur-sm flex items-center gap-1 px-2 py-1 z-40">
          {/* Toggle panel lateral */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSideOpen((v) => !v)}
                className="size-7 rounded-md border border-border/60 bg-background hover:bg-muted flex items-center justify-center transition-colors"
              >
                {sideOpen ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{sideOpen ? "Ocultar panel" : "Mostrar panel"}</TooltipContent>
          </Tooltip>
          <div className="w-px h-4 bg-border/60 mx-0.5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => applyZoom(zoom + ZOOM_STEP, zoom, pan)}
                disabled={zoom >= ZOOM_MAX}
                className="size-7 rounded-md border border-border/60 bg-background hover:bg-muted flex items-center justify-center transition-colors disabled:opacity-30"
              >
                <Plus className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Zoom +</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => applyZoom(zoom - ZOOM_STEP, zoom, pan)}
                disabled={zoom <= ZOOM_MIN}
                className="size-7 rounded-md border border-border/60 bg-background hover:bg-muted flex items-center justify-center transition-colors disabled:opacity-30"
              >
                <Minus className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Zoom −</TooltipContent>
          </Tooltip>
          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={resetView}
                className="size-7 rounded-md border border-border/60 bg-background hover:bg-muted flex items-center justify-center transition-colors"
              >
                <RotateCcw className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Restablecer vista (100%)</TooltipContent>
          </Tooltip>
          <div className="w-px h-4 bg-border/60 mx-0.5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setPanMode((v) => !v)}
                className={cn(
                  "size-7 rounded-md border flex items-center justify-center transition-colors",
                  panMode
                    ? "bg-primary/20 border-primary/60 text-primary"
                    : "border-border/60 bg-background hover:bg-muted",
                )}
              >
                {panMode ? <Hand className="size-3.5" /> : <MousePointer2 className="size-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{panMode ? "Modo pan activo — clic para desactivar" : "Activar modo pan"}</TooltipContent>
          </Tooltip>
          <div className="w-px h-4 bg-border/60 mx-0.5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTerrainLegendOpen(true)}
                className="size-7 rounded-md border border-border/60 bg-background hover:bg-muted flex items-center justify-center transition-colors"
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Leyenda de terrenos</TooltipContent>
          </Tooltip>
          {/* Separador y banner victoria en la misma barra */}
          {state.winner !== null && (
            <>
              <div className="w-px h-4 bg-border/60 mx-1" />
              <Trophy className="text-primary size-3.5 shrink-0" />
              <p className="font-semibold text-xs text-primary">
                {state.winner === "draw" ? "¡Empate!" : `Victoria de ${state.players[state.winner].factionName}`}
              </p>
            </>
          )}
        </div>

        {/* Modal de fin de turno: aparece cuando todas las unidades han actuado */}
        <Dialog open={endTurnModalOpen} onOpenChange={setEndTurnModalOpen}>
          <DialogContent className="max-w-sm" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Flag className="size-4 text-primary" /> Turno completado
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Todas tus criaturas han actuado. ¿Qué deseas hacer?
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <Button
                className="w-full"
                disabled={me.hand.length === 0}
                onClick={() => {
                  setEndTurnModalOpen(false)
                  sendAction({ type: "endPhase" })
                  setDeployModalOpen(true)
                }}
              >
                <ChevronRight className="size-4" /> Ir a fase de despliegue
                {me.hand.length === 0 && <span className="ml-1 text-xs opacity-60">(sin reservas)</span>}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setEndTurnModalOpen(false)
                  sendAction({ type: "endTurn" })
                }}
              >
                <Flag className="size-4" /> Terminar turno directamente
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de despliegue: seleccionar criatura de la reserva */}
        {deployModalOpen && myTurn && (
          <DeployModal
            me={me}
            state={state}
            deployedLevels={deployedLevels}
            onSelect={(creatureId) => {
              setDeployModalOpen(false)
              setMode({ kind: "deploy", creatureId })
            }}
            onEndTurn={() => {
              setDeployModalOpen(false)
              sendAction({ type: "endTurn" })
            }}
            onClose={() => setDeployModalOpen(false)}
          />
        )}

        {/* Modal de leyenda de terrenos */}
        <TerrainLegendModal open={terrainLegendOpen} onClose={() => setTerrainLegendOpen(false)} />

        {/* Cuerpo principal — panel lateral fijo a la izquierda desplaza el mapa */}
        <div className="flex-1 overflow-hidden flex bg-[#080d14]">

          {/* ══ PANEL LATERAL IZQUIERDO ══ */}
          <div
            className={cn(
              "shrink-0 flex flex-col border-r border-border/60 bg-card overflow-hidden transition-all duration-300",
              sideOpen ? "" : "w-0 border-r-0",
            )}
            style={{ width: sideOpen ? sideW : 0 }}
          >
            {sideOpen && (
              <>
                <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
                  <SidePanel
                    state={state} mySide={mySide} me={me} opp={opp} oppSide={oppSide}
                    selected={selected}
                    canDeployNow={canDeployNow} deployedLevels={deployedLevels}
                    mode={mode} setMode={setMode}
                    moveSelection={moveSelection}
                    graveyard={graveyard}
                    orderCatalog={orderCatalog}
                    myOrderHand={myOrderHand}
                    myOrderDiscard={myOrderDiscard}
                    oppOrderDiscard={oppOrderDiscard}
                    pendingAttack={pendingAttack}
                    amDefender={amDefender}
                    onOpenLog={() => setLogOpen(true)}
                    onOpenCard={setCardModal}
                    onSelectUnit={(uid) => {
                      if (selected && unitHasRemainingActions(selected) && uid !== selected.uid) return
                      setSelectedUid(uid); setMoveSelection(null); setMode({ kind: "idle" })
                    }}
                    onOpenInspiration={() => setInspirationModalUid(
                      amDefender && pendingAttack ? pendingAttack.targetUid : (selected?.uid ?? null)
                    )}
                    onDone={() => { setSelectedUid(null); setMoveSelection(null); setMode({ kind: "idle" }) }}
                    onOpenDeploy={() => setDeployModalOpen(true)}
                    sendAction={sendAction}
                  />
                </div>
                {/* Handle de redimensionado — borde derecho del panel */}
                <div
                  onMouseDown={handleResizeDrag}
                  className="absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors"
                  style={{ left: sideW - 2 }}
                />
              </>
            )}
          </div>

          {/* ══ ÁREA DEL MAPA ══ */}
          <div className="flex-1 relative bg-[#080d14] overflow-hidden">

          {/* ══ ÁREA DEL MAPA — con margen para que el canvas respire ══ */}
          <div
            ref={mapContainerRef}
            className="absolute inset-3 rounded-xl overflow-hidden bg-[#0e1624] shadow-2xl ring-1 ring-white/5"
            onWheel={handleWheel}
            onMouseDown={handleMapMouseDown}
            onMouseMove={handleMapMouseMove}
            onMouseUp={handleMapMouseUp}
            onMouseLeave={handleMapMouseUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* ReactionBanner movido fuera del mapa — ver más abajo */}

            {/* Barra de contexto — overlay sobre el mapa, no afecta el layout */}
            {contextLabel && !amDefender && (
              <div className="absolute top-0 left-0 right-0 z-30 bg-black/50 backdrop-blur-sm flex items-center justify-between gap-3 px-4 py-1.5 text-xs pointer-events-auto">
                <span className="text-white/90">{contextLabel}</span>
                <button className="text-white/60 hover:text-white underline shrink-0"
                  onClick={() => { setMode({ kind: "idle" }); setMoveSelection(null) }}>
                  Cancelar
                </button>
              </div>
            )}

            {/* Notificaciones de combate flotantes (esquina superior derecha) */}
            {combatToasts.length > 0 && (
              <div className="absolute top-10 right-3 z-40 flex flex-col gap-1.5 pointer-events-none max-w-xs">
                {combatToasts.map((toast) => (
                  <CombatToast
                    key={toast.id}
                    text={toast.text}
                    onDismiss={() => setCombatToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  />
                ))}
              </div>
            )}

            {/* Stage Konva escalado con CSS transform */}
            <div
              ref={stageContainerRef}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                transformOrigin: "0 0",
                transform: `translate(${pan.x * zoom}px, ${pan.y * zoom}px) scale(${zoom})`,
                width: boardW,
                height: boardH,
                cursor: isPanning.current ? "grabbing" : panMode ? "grab" : "default",
              }}
            >
              <Stage
                width={boardW}
                height={boardH}
                style={{ display: "block" }}
                onClick={(e) => {
                  const pos = e.target.getStage()?.getPointerPosition()
                  if (!pos) return
                  handleStageClick(pos.x, pos.y)
                }}
                onContextMenu={(e) => e.evt.preventDefault()}
                onMouseMove={(e) => {
                  if (isPanning.current) return
                  const pos = e.target.getStage()?.getPointerPosition()
                  if (!pos) return
                  const cx = Math.floor(pos.x / cell)
                  const cy = Math.floor(pos.y / cell)
                  const hovered = state.units.find((u) => {
                    const s = state.catalog[u.creatureId]?.gridSize ?? 1
                    return cx >= u.x && cx < u.x + s && cy >= u.y && cy < u.y + s
                  })
                  if (hovered) {
                    setTooltip({ snap: state.catalog[hovered.creatureId], unit: hovered, x: pos.x, y: pos.y })
                    setTerrainTooltip(null)
                  } else {
                    setTooltip(null)
                    const meta = terrainIndex.get(`${cx},${cy}`)
                    if (meta) setTerrainTooltip({ ...meta, x: pos.x, y: pos.y })
                    else setTerrainTooltip(null)
                  }
                }}
                onMouseLeave={() => { setTooltip(null); setTerrainTooltip(null) }}
              >
                <Layer listening={false}>
                  {image ? <KonvaImage image={image} width={boardW} height={boardH} /> : <Rect width={boardW} height={boardH} fill="#1e293b" />}
                  <TerrainLayer cells={state.map.cells} cols={state.map.cols} rows={state.map.rows} cell={cell} collectedTreasures={collectedTreasures} />
                  {gridLines.map((pts, i) => <Line key={i} points={pts} stroke="rgba(255,255,255,0.09)" strokeWidth={1} />)}
                  <WallLayer walls={state.map.walls ?? []} cols={state.map.cols} rows={state.map.rows} cell={cell} />
                  {/* Rango de movimiento */}
                  {[...moveRangeDisplay.keys()].map((key) => {
                    const [x, y] = key.split(",").map(Number)
                    return <Rect key={`mv-${key}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="rgba(34,197,94,0.28)" stroke="rgba(34,197,94,0.6)" strokeWidth={1} />
                  })}
                  {/* Zona de despliegue */}
                  {mode.kind === "deploy" && [...deployCells].map((key) => {
                    const [x, y] = key.split(",").map(Number)
                    return <Rect key={`dp-${key}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="rgba(99,102,241,0.26)" stroke="rgba(99,102,241,0.6)" strokeWidth={1} />
                  })}
                  {/* Cargas restantes — solo si el tesoro fue revelado al pisarlo */}
                  {state.treasures.filter(t => !t.collected && t.revealed).map((t, i) => {
                    const rem = getTreasureRemaining(t)
                    const val = getTreasureValue(t)
                    if (val <= 1) return null   // 1 carga: el cofre ya lo representa
                    const pct = rem / val
                    const color = pct > 0.6 ? "#fbbf24" : pct > 0.3 ? "#fb923c" : "#f87171"
                    return (
                      <Group key={`tc-${i}`} listening={false}>
                        <Rect
                          x={t.x * cell + cell * 0.55} y={t.y * cell + cell * 0.04}
                          width={cell * 0.38} height={cell * 0.32}
                          fill="rgba(0,0,0,0.72)" cornerRadius={cell * 0.06}
                        />
                        <Text
                          x={t.x * cell + cell * 0.55} y={t.y * cell + cell * 0.06}
                          width={cell * 0.38} align="center"
                          text={`×${rem}`}
                          fontSize={Math.max(7, cell * 0.22)} fill={color} fontStyle="bold"
                        />
                      </Group>
                    )
                  })}
                </Layer>
                <Layer>
                  {state.units.map((unit) => (
                    <UnitToken key={unit.uid} unit={unit} snap={state.catalog[unit.creatureId]} cell={cell}
                      mine={unit.owner === mySide}
                      selected={unit.uid === selectedUid}
                      hasMoveBudget={!!moveSelection && moveSelection.uid === unit.uid}
                      onClick={() => {
                        if (unit.owner === mySide) {
                          if (unit.uid === selectedUid) {
                            setSelectedUid(null); setMoveSelection(null); setMode({ kind: "idle" })
                          } else {
                            if (selected && unitHasRemainingActions(selected)) return
                            setSelectedUid(unit.uid); setMoveSelection(null); setMode({ kind: "idle" })
                          }
                        }
                      }}
                    />
                  ))}
                </Layer>
              </Stage>

              {/* Tooltip hover criatura */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <UnitTooltip snap={tooltip?.snap ?? null} unit={tooltip?.unit} x={tooltip?.x ?? 0} y={tooltip?.y ?? 0} stageWidth={boardW} stageHeight={boardH} />
              </div>

              {/* Tooltip hover terreno */}
              {terrainTooltip && (
                <div
                  style={{
                    position: "absolute",
                    pointerEvents: "none",
                    left: Math.min(terrainTooltip.x + 12, boardW - 180),
                    top: Math.max(terrainTooltip.y - 48, 4),
                    zIndex: 50,
                  }}
                  className="rounded-md border border-white/10 bg-black/80 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-sm"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block size-3 shrink-0 rounded-sm border border-white/20"
                      style={{ background: terrainTooltip.fill }}
                    />
                    <span className="font-semibold text-white">{terrainTooltip.label}</span>
                  </div>
                  <p className="mt-0.5 text-white/70 leading-snug max-w-[170px]">{terrainTooltip.description}</p>
                </div>
              )}

              {/* Overlays de impacto: flash rojo/verde + sacudón sobre el token */}
              {state.units.map((unit) => {
                const snap = state.catalog[unit.creatureId]
                const gs = snap?.gridSize ?? 1
                const size = gs * cell
                const cx = unit.x * cell + size / 2
                const cy = unit.y * cell + size / 2
                const isHit  = hitUids.has(unit.uid)
                const isHeal = healUids.has(unit.uid)
                if (!isHit && !isHeal) return null
                return (
                  <div
                    key={`impact-${unit.uid}`}
                    className={isHit ? "token-hit-overlay" : "token-heal-overlay"}
                    style={{ left: cx, top: cy, width: size, height: size }}
                  />
                )
              })}

              {/* Floaters de daño — coordenadas en espacio del Stage (antes del transform CSS) */}
              {damageFloaters.map((f) => (
                <div
                  key={f.id}
                  className={`damage-floater ${f.kind}`}
                  style={{
                    left: f.x,
                    top: f.y,
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  {f.label}
                </div>
              ))}
            </div>

            {/* (controles de zoom movidos fuera del mapa — ver overlay abajo) */}

            {/* Dimensiones del mapa */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-[10px] text-white/25 pointer-events-none select-none">
              {state.map.cols}×{state.map.rows}
            </div>
          </div>{/* fin área del mapa (inset-3) */}

          </div>{/* fin área del mapa (flex-1 relativo) */}

        </div>{/* fin contenedor principal (flex) */}
      </div>

      {/* ── Registro de acciones ── */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="size-4" /> Registro de acciones
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-72 pr-3">
            <ul className="space-y-1">
              {state.log.map((entry, i) => (
                <li key={i} className={cn("text-xs leading-relaxed border-l-2 pl-2 py-0.5",
                  i === 0 ? "border-primary text-foreground" : "border-border text-muted-foreground")}>
                  {entry}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Modal de carta completa ── */}
      {cardModal && (
        <CardDetailModal modal={cardModal} onClose={() => setCardModal(null)} />
      )}

      {/* ── Modal carta de inspiración robada al inicio del turno ── */}
      {drawnCardModal && (() => {
        const snap = orderCatalog[drawnCardModal]
        if (!snap) return null
        return (
          <DrawnCardModal
            snap={snap}
            onClose={() => setDrawnCardModal(null)}
          />
        )
      })()}

      {/* ── Tapete de inspiraciones ── */}
      {inspirationModalUid && (
        <InspirationTapete
          uid={inspirationModalUid}
          state={state}
          myOrderHand={myOrderHand}
          orderCatalog={orderCatalog}
          onPlay={(cardId) => {
            sendAction({ type: "playCard" as GameAction["type"], uid: inspirationModalUid, cardId } as GameAction)
            setInspirationModalUid(null)
          }}
          onClose={() => setInspirationModalUid(null)}
        />
      )}

      {/* ── Banner de reacción al ataque — esquina inferior derecha, no tapa el mapa ── */}
      {amDefender && pendingAttack && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-auto w-[480px] max-w-[calc(100vw-3rem)]">
          <ReactionBanner
            pa={pendingAttack}
            state={state}
            mySide={mySide}
            myOrderHand={myOrderHand}
            orderCatalog={orderCatalog}
            onTake={() => sendAction({ type: "resolveAttack", decision: "take" })}
            onCower={() => sendAction({ type: "resolveAttack", decision: "cower" })}
            onOpenInspiration={() => setInspirationModalUid(pendingAttack.targetUid)}
          />
        </div>
      )}
    </TooltipProvider>
  )
}

// ── Panel lateral derecho ────────────────────────────────────────────────────

function SidePanel({
  state, mySide, me, opp, oppSide, selected,
  canDeployNow, deployedLevels, mode, setMode, moveSelection,
  graveyard, orderCatalog, myOrderHand, myOrderDiscard, oppOrderDiscard,
  pendingAttack, amDefender,
  onOpenLog, onOpenCard, onSelectUnit, onOpenInspiration, onDone, onOpenDeploy, sendAction,
}: {
  state: GameState; mySide: PlayerSide; oppSide: PlayerSide
  me: GameState["players"][PlayerSide]; opp: GameState["players"][PlayerSide]
  selected: GameUnit | null
  canDeployNow: boolean; deployedLevels: number
  mode: ActiveMode; setMode: (m: ActiveMode) => void
  moveSelection: MoveSelection | null
  graveyard: GraveEntry[]
  orderCatalog: Record<string, InspirationCardSnapshot>
  myOrderHand: string[]; myOrderDiscard: string[]; oppOrderDiscard: string[]
  pendingAttack: PendingAttack | null; amDefender: boolean
  onOpenLog: () => void
  onOpenCard: (m: CardModal) => void
  onSelectUnit: (uid: string) => void
  onOpenInspiration: () => void
  onDone: () => void
  onOpenDeploy: () => void
  sendAction: (a: GameAction) => void
}) {
  const myTurn = state.turn === mySide && state.winner === null
  const myUnits = state.units.filter((u) => u.owner === mySide)
  const oppUnits = state.units.filter((u) => u.owner === oppSide)
  const myGrave = graveyard.filter((g) => g.owner === mySide)
  const oppGrave = graveyard.filter((g) => g.owner === oppSide)

  type Tab = "batalla" | "criaturas" | "inspiraciones"
  const [tab, setTab] = useState<Tab>("batalla")

  // Auto-cambiar a "criaturas" en fase de despliegue para facilitar el deploy
  useEffect(() => {
    if ((state.phase === "setup" || state.phase === "deploy") && canDeployNow) {
      setTab("criaturas")
    }
  }, [state.phase, canDeployNow])

  // Auto-cambiar a "batalla" al seleccionar una unidad
  useEffect(() => {
    if (selected) setTab("batalla")
  }, [selected?.uid])

  // Auto-cambiar a la pestaña "batalla" cuando hay un ataque pendiente para responder
  useEffect(() => {
    if (amDefender) setTab("batalla")
  }, [amDefender])

  const TABS: { id: Tab; label: string }[] = [
    { id: "batalla",       label: "Batalla" },
    { id: "criaturas",     label: "Criaturas" },
    { id: "inspiraciones", label: "Inspiración" },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">

      {/* ── Cabecera: indicador de turno ── */}
      <div className="shrink-0 px-3 pt-2.5 pb-2 border-b border-border">
        <div className={cn(
          "rounded-lg border px-2.5 py-1.5 flex items-center justify-between",
          amDefender ? "border-red-500/60 bg-red-950/30" :
          myTurn ? "border-primary/50 bg-primary/5" : "border-border",
        )}>
          <p className={cn("text-xs font-bold",
            amDefender ? "text-red-400" :
            myTurn ? "text-primary" : "text-muted-foreground")}>
            {amDefender ? "⚔ ¡Debes reaccionar!" :
             pendingAttack && !amDefender ? "⏳ Rival reaccionando…" :
             myTurn ? "Tu turno" : `Turno de ${opp.factionName}`}
          </p>
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] text-muted-foreground">R{state.round}</p>
            <PhaseDots phase={state.phase} />
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="shrink-0 flex border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-semibold transition-colors",
              tab === t.id
                ? "text-foreground border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Cuerpo scrollable ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hidden">

        {/* ══════════════════════════════════════════════
            TAB: BATALLA
           ══════════════════════════════════════════════ */}
        {tab === "batalla" && (
          <div className="py-2 space-y-2 px-3">

            {/* Comandantes con recursos integrados */}
            <div className="space-y-1.5">
              <CommanderCard player={me} isMe />
              <CommanderCard player={opp} isMe={false} />
            </div>

            {/* Si soy el defensor, mostrar indicador en el panel lateral */}
            {amDefender && pendingAttack ? (() => {
              const targetUnit = state.units.find((u) => u.uid === pendingAttack.targetUid)
              const attackerUnit = state.units.find((u) => u.uid === pendingAttack.attackerUid)
              if (!targetUnit) return null
              const targetSnap = state.catalog[targetUnit.creatureId]
              const attackerSnap = attackerUnit ? state.catalog[attackerUnit.creatureId] : null
              return (
                <div className="rounded-lg border border-red-500/50 bg-red-950/20 px-2.5 py-2 flex items-center gap-2 animate-pulse-slow">
                  <span className="text-red-400 text-sm shrink-0">⚔</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-red-300 truncate">¡BAJO ATAQUE!</p>
                    <p className="text-[9px] text-red-300/60 truncate">
                      {attackerSnap?.name ?? "Enemigo"} → {targetSnap.name} · {pendingAttack.damage} daño
                    </p>
                  </div>
                  <p className="text-[9px] text-red-400/60 shrink-0">Ver abajo ↘</p>
                </div>
              )
            })() : selected ? (
              <SelectedUnitCard
                unit={selected}
                snap={state.catalog[selected.creatureId]}
                state={state}
                mySide={mySide}
                myTurn={myTurn}
                mode={mode}
                setMode={setMode}
                myOrderHand={myOrderHand}
                orderCatalog={orderCatalog}
                onShowCard={() => onOpenCard({ kind: "creature", snap: state.catalog[selected.creatureId], unit: selected })}
                onOpenInspiration={onOpenInspiration}
                onDone={onDone}
                sendAction={sendAction}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border/50 px-3 py-4 text-center">
                <p className="text-[10px] text-muted-foreground/50">Selecciona una criatura propia</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: CRIATURAS
           ══════════════════════════════════════════════ */}
        {tab === "criaturas" && (
          <div className="py-2 space-y-3 px-3">

            {/* Mis criaturas en tablero */}
            {myUnits.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-semibold text-green-400/80 uppercase tracking-wider">
                  Mis tropas en tablero ({myUnits.length})
                </p>
                {myUnits.map((unit) => {
                  const snap = state.catalog[unit.creatureId]
                  const hp = snap.hp - unit.damage
                  const hpPct = Math.max(0, (hp / snap.hp) * 100)
                  const hpColor = hpPct > 60 ? "#22c55e" : hpPct > 30 ? "#f59e0b" : "#ef4444"
                  const isSelected = selected?.uid === unit.uid
                  return (
                    <div
                      key={unit.uid}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors",
                        isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/30",
                      )}
                      onClick={() => { onSelectUnit(unit.uid); onOpenCard({ kind: "creature", snap, unit }) }}
                    >
                      <div className="size-7 shrink-0 rounded-full overflow-hidden border border-white/10"
                        style={{ backgroundColor: snap.factionColor }}>
                        {snap.token && <img src={snap.token} className="size-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium leading-tight truncate">{snap.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
                          </div>
                          <span className="text-[9px] tabular-nums shrink-0" style={{ color: hpColor }}>{hp}/{snap.hp}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        {unit.tapped && <span className="text-[8px] text-amber-400/80">agot.</span>}
                        {unit.moved && <span className="text-[8px] text-blue-400/80">mov.</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Criaturas rivales en tablero */}
            {oppUnits.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-semibold text-red-400/70 uppercase tracking-wider">
                  Tropas rivales ({oppUnits.length})
                </p>
                {oppUnits.map((unit) => {
                  const snap = state.catalog[unit.creatureId]
                  const hp = snap.hp - unit.damage
                  const hpPct = Math.max(0, (hp / snap.hp) * 100)
                  const hpColor = hpPct > 60 ? "#22c55e" : hpPct > 30 ? "#f59e0b" : "#ef4444"
                  return (
                    <div
                      key={unit.uid}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => onOpenCard({ kind: "creature", snap, unit })}
                    >
                      <div className="size-7 shrink-0 rounded-full overflow-hidden border border-red-900/40"
                        style={{ backgroundColor: snap.factionColor }}>
                        {snap.token && <img src={snap.token} className="size-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium leading-tight truncate text-muted-foreground">{snap.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
                          </div>
                          <span className="text-[9px] tabular-nums shrink-0" style={{ color: hpColor }}>{hp}/{snap.hp}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Mano propia (desplegables) */}
            {me.hand.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-semibold text-blue-400/80 uppercase tracking-wider flex justify-between">
                  <span>En reserva</span>
                  {canDeployNow && <span className="font-normal normal-case text-muted-foreground/60">{deployedLevels}/{me.leadership} niv.</span>}
                </p>
                {me.hand.map((cid, i) => {
                  const snap = state.catalog[cid]
                  const active = mode.kind === "deploy" && mode.creatureId === cid
                  const fits = canDeployNow && deployedLevels + snap.level <= me.leadership
                  return (
                    <div
                      key={`${cid}-${i}`}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                        canDeployNow ? (fits ? "cursor-pointer hover:bg-muted/30" : "opacity-40 cursor-not-allowed") : "opacity-60",
                        active && "bg-primary/10 ring-1 ring-primary/30",
                      )}
                      onClick={() => {
                        if (!canDeployNow || !fits) return
                        setMode(active ? { kind: "idle" } : { kind: "deploy", creatureId: cid })
                      }}
                    >
                      <div className="size-7 shrink-0 rounded-full overflow-hidden border border-white/10"
                        style={{ backgroundColor: snap.factionColor }}>
                        {snap.token && <img src={snap.token} className="size-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium leading-tight truncate">{snap.name}</p>
                        <p className="text-[9px] text-muted-foreground">Nv {snap.level} · {snap.hp} HP</p>
                      </div>
                      {active && <span className="text-[9px] text-primary shrink-0">activa</span>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Mazo + cementerio propio */}
            {(me.deck.length > 0 || myGrave.length > 0) && (
              <div className="space-y-1">
                {me.deck.length > 0 && (
                  <p className="text-[9px] text-muted-foreground/50 text-center">
                    {me.deck.length} en el mazo
                  </p>
                )}
                {myGrave.length > 0 && (
                  <>
                    <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider">☠ Destruidas</p>
                    {myGrave.map((g, i) => {
                      const snap = state.catalog[g.creatureId]
                      return (
                        <div key={i} className="flex items-center gap-1.5 px-1 opacity-50">
                          <div className="size-5 shrink-0 rounded-full overflow-hidden border border-white/10 grayscale"
                            style={{ backgroundColor: snap?.factionColor }}>
                            {snap?.token && <img src={snap.token} className="size-full object-cover" />}
                          </div>
                          <span className="text-[9px] text-muted-foreground truncate">{snap?.name ?? g.creatureId}</span>
                          <span className="text-[8px] text-muted-foreground/40 shrink-0 ml-auto">R{g.round}</span>
                        </div>
                      )
                    })}
                  </>
                )}
                {oppGrave.length > 0 && (
                  <>
                    <p className="text-[9px] font-semibold text-red-400/50 uppercase tracking-wider mt-1">☠ Rivales destruidas</p>
                    {oppGrave.map((g, i) => {
                      const snap = state.catalog[g.creatureId]
                      return (
                        <div key={i} className="flex items-center gap-1.5 px-1 opacity-50">
                          <div className="size-5 shrink-0 rounded-full overflow-hidden border border-red-900/30 grayscale"
                            style={{ backgroundColor: snap?.factionColor }}>
                            {snap?.token && <img src={snap.token} className="size-full object-cover" />}
                          </div>
                          <span className="text-[9px] text-muted-foreground truncate">{snap?.name ?? g.creatureId}</span>
                          <span className="text-[8px] text-muted-foreground/40 shrink-0 ml-auto">R{g.round}</span>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: INSPIRACIONES
           ══════════════════════════════════════════════ */}
        {tab === "inspiraciones" && (
          <div className="py-2 px-3 space-y-3">
            {/* Mano propia */}
            <div className="space-y-1">
              <p className="text-[9px] font-semibold text-primary/80 uppercase tracking-wider flex justify-between">
                <span>Mi mano</span>
                <span className="font-normal normal-case text-muted-foreground/60">{myOrderHand.length}/{me.orderHandSize} · mazo {me.orderDeck.length}</span>
              </p>
              {myOrderHand.length === 0 ? (
                <p className="text-[9px] text-muted-foreground/40 text-center py-2">Sin cartas en reserva</p>
              ) : (
                <>
                  {myOrderHand.map((cardId, i) => {
                    const card = orderCatalog[cardId]
                    if (!card) return null
                    return (
                      <div key={`${cardId}-${i}`} className="rounded-lg border border-border/40 px-2 py-1.5 bg-muted/10 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[10px] font-medium leading-tight">{card.name}</span>
                          <span className={cn(
                            "text-[8px] rounded px-1 py-0.5 shrink-0",
                            card.minor ? "bg-blue-500/15 text-blue-400" : "bg-amber-500/15 text-amber-400",
                          )}>
                            {card.minor ? "veloz" : "acción"}
                          </span>
                        </div>
                        {card.description && (
                          <p className="text-[9px] text-muted-foreground/70 leading-tight mt-0.5 line-clamp-2">{card.description}</p>
                        )}
                      </div>
                    )
                  })}
                  <button
                    onClick={onOpenInspiration}
                    className="w-full text-[10px] text-primary/70 hover:text-primary flex items-center justify-center gap-1 py-1.5 rounded border border-primary/20 hover:border-primary/40 transition-colors"
                  >
                    🃏 Usar inspiración
                  </button>
                </>
              )}
            </div>

            {/* Descartes */}
            {(myOrderDiscard.length > 0 || oppOrderDiscard.length > 0) && (
              <div className="space-y-1">
                <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Descartadas</p>
                {myOrderDiscard.length > 0 && (
                  <p className="text-[9px] text-muted-foreground/50">Mías: {myOrderDiscard.map((id) => orderCatalog[id]?.name ?? id).join(", ")}</p>
                )}
                {oppOrderDiscard.length > 0 && (
                  <p className="text-[9px] text-muted-foreground/40">Rival: {oppOrderDiscard.map((id) => orderCatalog[id]?.name ?? id).join(", ")}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Pie: botones de fase ── */}
      <div className="shrink-0 border-t border-border px-3 py-2 space-y-2">
        {myTurn && state.phase === "setup" && !state.setupDone[mySide] && (
          <Button size="sm" className="w-full h-8 text-xs" onClick={() => sendAction({ type: "endSetup" })}>
            <Flag className="size-3" /> Terminar despliegue
          </Button>
        )}
        {myTurn && state.phase === "deploy" && (
          <div className="flex gap-1.5">
            {me.hand.length > 0 && (
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={onOpenDeploy}>
                <ChevronRight className="size-3" /> Desplegar
              </Button>
            )}
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => sendAction({ type: "endTurn" })}>
              <Flag className="size-3" /> Terminar turno
            </Button>
          </div>
        )}
        {!myTurn && state.winner === null && (
          <div className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
            <span className="animate-pulse text-primary text-xs">●</span> Esperando al rival…
          </div>
        )}
        <button className="w-full text-[11px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5" onClick={onOpenLog}>
          <BookOpen className="size-3" /> Ver registro
        </button>
      </div>
    </div>
  )
}

// ── Tarjeta de comandante ─────────────────────────────────────────────────────

function CommanderCard({ player, isMe }: { player: GameState["players"][PlayerSide]; isMe: boolean }) {
  const moralePct = Math.max(0, Math.min(100, (player.morale / 15) * 100))
  const moraleColor = moralePct > 50 ? "#22c55e" : moralePct > 25 ? "#f59e0b" : "#ef4444"
  return (
    <div className={cn(
      "rounded-lg border px-2.5 py-2 space-y-1.5",
      isMe ? "border-primary/30 bg-primary/5" : "border-border bg-muted/10",
    )}>
      {/* Fila superior: token + nombre + badge */}
      <div className="flex items-center gap-2">
        <div
          className={cn("size-9 shrink-0 rounded-full overflow-hidden border-2", isMe ? "border-primary/50" : "border-border/60")}
          style={{ backgroundColor: player.factionColor }}
        >
          {player.leaderToken
            ? <img src={player.leaderToken} className="size-full object-cover" />
            : <div className="size-full flex items-center justify-center"><Crown className="size-3.5 text-white/60" /></div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className={cn("text-[10px] font-bold truncate leading-tight", isMe ? "text-foreground" : "text-muted-foreground")}>
              {player.leaderName}
            </p>
            {isMe && <span className="text-[8px] text-primary/60 shrink-0">tú</span>}
          </div>
          <p className="text-[9px] text-muted-foreground/60 truncate">{player.factionName}</p>
        </div>
        {/* Capacidades máximas */}
        <div className="shrink-0 flex flex-col items-end gap-0.5">
          <span className="text-[9px] text-muted-foreground/60">🐾 {player.creatureHandSize}</span>
          <span className="text-[9px] text-muted-foreground/60">🃏 {player.orderHandSize}</span>
        </div>
      </div>

      {/* Fila inferior: Liderazgo + Moral con barra */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-[10px]">
          <Crown className="size-2.5 text-primary/70" />
          <span className="text-muted-foreground">Lder</span>
          <span className="font-bold tabular-nums">{player.leadership}</span>
        </div>
        <div className="flex-1 flex items-center gap-1.5">
          <Heart className="size-2.5 shrink-0" style={{ color: moraleColor }} />
          <span className="text-[10px] font-bold tabular-nums" style={{ color: moraleColor }}>{player.morale}</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${moralePct}%`, backgroundColor: moraleColor }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Panel inferior ───────────────────────────────────────────────────────────

function BottomPanel({
  state, mySide, oppSide, graveyard,
  myOrderHand, myOrderDiscard, oppOrderDiscard, orderCatalog,
  canDeployNow, deployedLevels, mode, setMode, selected, sendAction, onOpenCard,
  onOpenInspiration,
}: {
  state: GameState; mySide: PlayerSide; oppSide: PlayerSide
  graveyard: GraveEntry[]
  myOrderHand: string[]; myOrderDiscard: string[]; oppOrderDiscard: string[]
  orderCatalog: Record<string, InspirationCardSnapshot>
  canDeployNow: boolean; deployedLevels: number
  mode: ActiveMode; setMode: (m: ActiveMode) => void
  selected: GameUnit | null; sendAction: (a: GameAction) => void
  onOpenCard: (m: CardModal) => void
  onOpenInspiration: () => void
}) {
  const me = state.players[mySide]
  const opp = state.players[oppSide]
  const myUnits = state.units.filter(u => u.owner === mySide)
  const myGrave = graveyard.filter(g => g.owner === mySide)
  const oppGrave = graveyard.filter(g => g.owner === oppSide)
  const hasGrave = myGrave.length > 0 || oppGrave.length > 0
  const hasOrders = myOrderHand.length > 0 || myOrderDiscard.length > 0 || oppOrderDiscard.length > 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Cabecera con etiquetas de sección ── */}
      <div className="shrink-0 flex items-center gap-0 px-3 pt-1.5 pb-0.5 border-b border-border/50">
        {/* Criaturas en tablero */}
        <SectionLabel color="text-green-400">
          En tablero <b>{myUnits.length}</b>
        </SectionLabel>
        {me.hand.length > 0 && (
          <>
            <Divider />
            <SectionLabel color="text-blue-400">
              Mano <b>{me.hand.length}</b>
              {canDeployNow && <span className="ml-1 opacity-70">· {deployedLevels}/{me.leadership} niv.</span>}
            </SectionLabel>
          </>
        )}
        {me.deck.length > 0 && (
          <span className="ml-2 text-[9px] text-muted-foreground/50">mazo {me.deck.length}</span>
        )}
        {hasGrave && (
          <>
            <Divider />
            <SectionLabel color="text-muted-foreground">
              ☠ <b>{myGrave.length}</b>
              {oppGrave.length > 0 && <span className="opacity-60"> rival <b>{oppGrave.length}</b></span>}
            </SectionLabel>
          </>
        )}
        {hasOrders && (
          <>
            <div className="mx-2 self-stretch w-px bg-border" />
            <button
              onClick={onOpenInspiration}
              disabled={myOrderHand.length === 0}
              className="flex items-center gap-1.5 text-[11px] font-medium text-primary/80 hover:text-primary disabled:opacity-40 disabled:cursor-default transition-colors px-1 rounded"
            >
              🃏 Inspiraciones <b>{myOrderHand.length}</b>
              {myOrderDiscard.length > 0 && <span className="opacity-60">· desc. {myOrderDiscard.length}</span>}
            </button>
          </>
        )}
      </div>

      {/* ── Fila de cartas ── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hidden px-2 pb-1.5">
        <div className="flex gap-1.5 h-full items-center pt-1">

          {/* Criaturas desplegadas */}
          {myUnits.map(unit => (
            <MiniCreatureCard key={unit.uid} snap={state.catalog[unit.creatureId]} unit={unit}
              label="tablero" labelColor="bg-green-900/40 text-green-400"
              onClick={() => {}}
              onShowCard={() => onOpenCard({ kind: "creature", snap: state.catalog[unit.creatureId], unit })}
            />
          ))}

          {/* Separador tablero → mano */}
          {myUnits.length > 0 && me.hand.length > 0 && <VerticalDivider />}

          {/* Criaturas en mano */}
          {me.hand.map((cid, i) => {
            const snap = state.catalog[cid]
            const active = mode.kind === "deploy" && mode.creatureId === cid
            const fits = canDeployNow && deployedLevels + snap.level <= me.leadership
            return (
              <MiniCreatureCard key={`h-${cid}-${i}`} snap={snap}
                label="mano" labelColor="bg-blue-900/40 text-blue-400"
                dimmed={canDeployNow && !fits} highlighted={active}
                onClick={() => { if (!canDeployNow) return; setMode(active ? { kind: "idle" } : { kind: "deploy", creatureId: cid }) }}
                onShowCard={() => onOpenCard({ kind: "creature", snap })}
              />
            )
          })}

          {/* Separador mano → cementerio */}
          {hasGrave && <VerticalDivider icon={<Skull className="size-2.5 text-muted-foreground/40" />} />}

          {/* Cementerio propio */}
          {myGrave.map((g, i) => (
            <MiniCreatureCard key={`mg-${i}`} snap={state.catalog[g.creatureId]}
              label={`R${g.round}`} labelColor="bg-muted/40 text-muted-foreground" dead
              onClick={() => {}}
              onShowCard={() => onOpenCard({ kind: "creature", snap: state.catalog[g.creatureId] })}
            />
          ))}

          {/* Cementerio rival */}
          {oppGrave.length > 0 && (
            <>
              {myGrave.length > 0 && <div className="self-stretch w-px bg-border/30 mx-0.5 shrink-0" />}
              {oppGrave.map((g, i) => (
                <MiniCreatureCard key={`og-${i}`} snap={state.catalog[g.creatureId]}
                  label={`R${g.round}`} labelColor="bg-muted/40 text-muted-foreground" dead factionColor={opp.factionColor}
                  onClick={() => {}}
                  onShowCard={() => onOpenCard({ kind: "creature", snap: state.catalog[g.creatureId] })}
                />
              ))}
            </>
          )}


        </div>
      </div>
    </div>
  )
}

// Micro componentes auxiliares del BottomPanel

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className={cn("text-[9px] font-medium leading-none shrink-0", color)}>{children}</span>
}

function Divider() {
  return <span className="mx-1.5 text-[9px] text-border select-none shrink-0">·</span>
}

function VerticalDivider({ icon }: { icon?: React.ReactNode }) {
  if (icon) {
    return (
      <div className="flex flex-col items-center self-stretch justify-center px-0.5 shrink-0">
        <div className="w-px flex-1 bg-border/40" />
        <div className="my-0.5">{icon}</div>
        <div className="w-px flex-1 bg-border/40" />
      </div>
    )
  }
  return <div className="self-stretch w-px bg-border/40 mx-0.5 shrink-0" />
}

// ── Modal de ficha completa ──────────────────────────────────────────────────

function CardDetailModal({ modal, onClose }: { modal: CardModal; onClose: () => void }) {
  if (modal.kind === "creature") {
    const { snap, unit } = modal
    const hp = unit ? snap.hp - unit.damage : snap.hp
    const hpPct = Math.max(0, (hp / snap.hp) * 100)
    const hpColor = hpPct > 60 ? "#22c55e" : hpPct > 30 ? "#f59e0b" : "#ef4444"
    const keywords: string[] = Array.isArray(snap.keywords) ? snap.keywords : []
    const attributes: string[] = Array.isArray(snap.attributes) ? snap.attributes : []
    const powers: Array<{ key: string; label: string; text: string }> = Array.isArray(snap.powers) ? snap.powers : []
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="sr-only">{snap.name}</DialogTitle>
          </DialogHeader>
          {/* Cabecera de la carta */}
          <div className="rounded-xl overflow-hidden border border-border">
            {/* Banner de color de facción */}
            <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: snap.factionColor + "33", borderBottom: `2px solid ${snap.factionColor}` }}>
              <div className="size-14 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: snap.factionColor }}>
                <CreatureTokenImg snap={snap} size={56} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base leading-tight">{snap.name}</h3>
                <p className="text-xs text-muted-foreground">Nivel {snap.level}</p>
                {unit && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
                    </div>
                    <span className="text-[10px] tabular-nums" style={{ color: hpColor }}>{hp}/{snap.hp}</span>
                  </div>
                )}
              </div>
            </div>
            {/* Stats */}
            <div className="grid grid-cols-4 divide-x divide-border bg-muted/20">
              {[
                { label: "HP", val: snap.hp },
                { label: "VEL", val: snap.speed },
                { label: "⚔", val: snap.meleeDamage },
                { label: snap.rangedDamage !== null ? "🏹" : "—", val: snap.rangedDamage !== null ? `${snap.rangedDamage}@${snap.rangedDistance}` : "—" },
              ].map(({ label, val }) => (
                <div key={label} className="flex flex-col items-center py-2 px-1">
                  <span className="text-[9px] text-muted-foreground uppercase">{label}</span>
                  <span className="text-sm font-bold">{val}</span>
                </div>
              ))}
            </div>
            {/* Keywords + atributos */}
            <div className="px-3 py-2 flex flex-wrap gap-1">
              {keywords.map((kw) => <Badge key={kw} variant="secondary" className="text-[9px] py-0 px-1.5">{kw}</Badge>)}
              {attributes.map((at) => <Badge key={at} variant="outline" className="text-[9px] py-0 px-1.5 capitalize">{at.slice(0, 3).toUpperCase()}</Badge>)}
            </div>
            {/* Poderes */}
            {powers.length > 0 && (
              <div className="px-3 pb-3 space-y-1.5">
                {powers.map((p) => (
                  <div key={p.key} className="bg-muted/30 rounded-lg px-2.5 py-2">
                    <p className="text-[11px] font-semibold flex items-center gap-1">
                      <Zap className="size-3 text-primary" /> {p.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{p.text}</p>
                  </div>
                ))}
              </div>
            )}
            {/* Estado si está en partida */}
            {unit && (
              <div className="px-3 pb-3 flex flex-wrap gap-1">
                {unit.tapped && <Badge variant="secondary" className="text-[9px]">Agotada</Badge>}
                {unit.moved && <Badge variant="secondary" className="text-[9px]">Movió</Badge>}
                {unit.attacked && <Badge variant="secondary" className="text-[9px]">Atacó</Badge>}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Carta de orden
  const { card, factionColor } = modal
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-xs" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="sr-only">{card.name}</DialogTitle>
        </DialogHeader>
        <div className="rounded-xl overflow-hidden border border-border">
          <div className="px-4 py-3 text-white" style={{ backgroundColor: factionColor }}>
            <h3 className="font-bold text-base leading-tight">{card.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {card.minor && <Badge className="text-[9px] py-0 px-1.5 bg-white/20 text-white border-white/30">Veloz</Badge>}
              {card.requiredLevel > 0 && <span className="text-[10px] opacity-80">Nv ≥ {card.requiredLevel}</span>}
              {card.requiredAttribute && <span className="text-[10px] opacity-80 capitalize">{card.requiredAttribute}</span>}
            </div>
          </div>
          <div className="px-4 py-3 space-y-2 bg-card">
            <p className="text-sm leading-relaxed">{card.description || <span className="text-muted-foreground italic">Sin descripción.</span>}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {card.minor && <Badge variant="outline" className="text-[9px]">Acción veloz — no agota</Badge>}
              {!card.minor && <Badge variant="outline" className="text-[9px]">Acción completa — agota la criatura</Badge>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Indicador de fase ────────────────────────────────────────────────────────

function PhaseDots({ phase }: { phase: string }) {
  const steps = ["activate", "deploy"]
  if (phase === "setup" || phase === "finished") {
    return <Badge variant="secondary" className="text-[9px] py-0 px-1">{phase === "setup" ? "Setup" : "Fin"}</Badge>
  }
  return (
    <div className="flex gap-1 items-center">
      {steps.map((s) => (
        <div key={s} className={cn("size-1.5 rounded-full transition-colors", phase === s ? "bg-primary" : "bg-muted")} />
      ))}
    </div>
  )
}

// ── Tarjeta de jugador compacta ──────────────────────────────────────────────

function CompactPlayerRow({ player, isMe, label }: {
  player: { factionColor: string; morale: number; leadership: number }
  isMe: boolean; label: string
}) {
  const moralePct = Math.max(0, Math.min(100, (player.morale / 15) * 100))
  const moraleColor = moralePct > 50 ? "#22c55e" : moralePct > 25 ? "#f59e0b" : "#ef4444"
  return (
    <div className={cn("flex items-center gap-2 rounded px-2 py-1.5", isMe ? "bg-primary/5" : "bg-muted/20")}>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: player.factionColor }} />
      <span className="text-[11px] font-medium truncate flex-1 min-w-0">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
        <span className="text-muted-foreground">Lder <b className="text-foreground">{player.leadership}</b></span>
        <div className="flex items-center gap-0.5">
          <Heart className="size-2.5 text-red-400" />
          <b className="text-foreground">{player.morale}</b>
          <div className="w-10 h-1 rounded-full bg-muted overflow-hidden ml-0.5">
            <div className="h-full rounded-full" style={{ width: `${moralePct}%`, backgroundColor: moraleColor }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card de criatura seleccionada con botones de acción ──────────────────────

function SelectedUnitCard({
  unit, snap, state, mySide, myTurn, mode, setMode,
  myOrderHand, orderCatalog,
  onShowCard, onOpenInspiration, onDone, sendAction,
}: {
  unit: GameUnit; snap: CreatureSnapshot
  state: GameState; mySide: PlayerSide; myTurn: boolean
  mode: ActiveMode; setMode: (m: ActiveMode) => void
  myOrderHand: string[]; orderCatalog: Record<string, InspirationCardSnapshot>
  onShowCard: () => void
  onOpenInspiration: () => void
  onDone: () => void
  sendAction: (a: GameAction) => void
}) {
  const [confirmPass, setConfirmPass] = useState(false)

  const hp = snap.hp - unit.damage
  const hpPct = Math.max(0, (hp / snap.hp) * 100)
  const hpColor = hpPct > 60 ? "#22c55e" : hpPct > 30 ? "#f59e0b" : "#ef4444"

  const inActivate = myTurn && state.phase === "activate"
  const canMove    = inActivate && !unit.moved && !unit.attacked && !unit.tapped
  const canAttack  = inActivate && !unit.tapped && !unit.attacked
  const canRanged  = canAttack && snap.rangedDamage !== null
  const isOnTreasure = state.treasures.some((t) => !t.collected && t.x === unit.x && t.y === unit.y)
  const canCollect = inActivate && !unit.tapped && isOnTreasure
  const playable   = myOrderHand.filter((id) => { const c = orderCatalog[id]; return c && !(unit.tapped && !c.minor) })
  const canInspire = inActivate && playable.length > 0
  const hasRemainingActions = inActivate && !unit.tapped && (!unit.moved || (!unit.attacked && !unit.tapped))

  const inMoveMode   = mode.kind === "idle" && canMove
  const inMeleeMode  = mode.kind === "attack" && mode.uid === unit.uid && mode.attackMode === "melee"
  const inRangedMode = mode.kind === "attack" && mode.uid === unit.uid && mode.attackMode === "ranged"

  return (
    <div className="rounded-lg border bg-muted/10 overflow-hidden" style={{ borderLeftColor: snap.factionColor, borderLeftWidth: 3, borderLeftStyle: "solid", borderColor: "transparent" }}>
      {/* Cabecera: nombre + HP */}
      <button type="button" onClick={onShowCard}
        className="w-full flex items-center justify-between px-2.5 pt-2 pb-1 hover:bg-muted/20 transition-colors gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 shrink-0 rounded-full overflow-hidden border border-white/15" style={{ backgroundColor: snap.factionColor }}>
            {snap.token && <img src={snap.token} className="size-full object-cover" />}
          </div>
          <p className="text-[11px] font-semibold truncate">{snap.name}</p>
        </div>
        <span className="text-[10px] tabular-nums shrink-0" style={{ color: hpColor }}>{hp}/{snap.hp} HP</span>
      </button>

      {/* Barra HP */}
      <div className="mx-2.5 mb-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
      </div>

      {/* Stats rápidos */}
      <div className="px-2.5 pb-1.5 flex items-center gap-2 text-[9px] text-muted-foreground/70">
        <span>Nv{snap.level}</span>
        <span>⚔{snap.meleeDamage}</span>
        {snap.rangedDamage !== null && <span>🏹{snap.rangedDamage}@{snap.rangedDistance}</span>}
        <span>👟{snap.speed}</span>
        {unit.tapped   && <span className="text-amber-400/80 ml-auto">agotada</span>}
        {unit.moved    && !unit.tapped && <span className="text-blue-400/80 ml-auto">movió</span>}
        {unit.attacked && !unit.tapped && <span className="text-red-400/80 ml-auto">atacó</span>}
      </div>

      {/* Indicadores de estado de acción */}
      {inActivate && (
        <div className="px-2.5 pb-1 flex items-center gap-2">
          {/* Indicador movimiento */}
          <div className={cn(
            "flex items-center gap-1 text-[9px] rounded-full px-2 py-0.5 border font-medium",
            canMove
              ? "bg-green-500/15 border-green-500/40 text-green-400"
              : "bg-muted/20 border-border/30 text-muted-foreground/40 line-through"
          )}>
            <span>👟</span> MOV
          </div>
          {/* Indicador acción */}
          <div className={cn(
            "flex items-center gap-1 text-[9px] rounded-full px-2 py-0.5 border font-medium",
            canAttack
              ? "bg-red-500/15 border-red-500/40 text-red-400"
              : "bg-muted/20 border-border/30 text-muted-foreground/40 line-through"
          )}>
            <span>⚔</span> ACT
          </div>
          {unit.tapped && <span className="text-[9px] text-amber-400/70 ml-auto">agotada</span>}
        </div>
      )}

      {/* Grupo: Movimiento */}
      {inActivate && (
        <div className="px-2 pb-1">
          <p className="text-[8px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-1">Movimiento</p>
          <button
            disabled={!canMove}
            onClick={() => {
              // El movimiento se hace con click en el mapa cuando hay rango resaltado
              // Este botón es solo indicador
            }}
            className={cn(
              "w-full rounded px-2 py-1.5 text-[10px] font-medium transition-colors border text-left",
              canMove
                ? "bg-green-500/10 border-green-500/40 text-green-400"
                : "border-border/30 text-muted-foreground/30 cursor-not-allowed",
            )}
          >
            🏃 Mover — clic en zona verde del mapa
          </button>
        </div>
      )}

      {/* Grupo: Acciones */}
      {inActivate && (
        <div className="px-2 pb-2">
          <p className="text-[8px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-1">Acción</p>
          <div className="grid grid-cols-2 gap-1">
            <button
              disabled={!canAttack}
              onClick={() => setMode(inMeleeMode ? { kind: "idle" } : { kind: "attack", uid: unit.uid, attackMode: "melee" })}
              className={cn(
                "rounded px-2 py-1.5 text-[10px] font-medium transition-colors border",
                inMeleeMode
                  ? "bg-red-500/25 border-red-500/60 text-red-300"
                  : canAttack
                    ? "bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20"
                    : "border-border/30 text-muted-foreground/30 cursor-not-allowed",
              )}
            >
              ⚔ Melé
            </button>
            <button
              disabled={!canAttack || !canRanged}
              onClick={() => canRanged && setMode(inRangedMode ? { kind: "idle" } : { kind: "attack", uid: unit.uid, attackMode: "ranged" })}
              className={cn(
                "rounded px-2 py-1.5 text-[10px] font-medium transition-colors border",
                inRangedMode
                  ? "bg-orange-500/25 border-orange-500/60 text-orange-300"
                  : canRanged
                    ? "bg-orange-500/10 border-orange-500/40 text-orange-400 hover:bg-orange-500/20"
                    : "border-border/30 text-muted-foreground/30 cursor-not-allowed",
              )}
            >
              🏹 Disparar
            </button>
            <button
              disabled={!canCollect}
              onClick={() => sendAction({ type: "collect", uid: unit.uid })}
              className={cn(
                "rounded px-2 py-1.5 text-[10px] font-medium transition-colors border",
                canCollect
                  ? "bg-yellow-500/10 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/20"
                  : "border-border/30 text-muted-foreground/30 cursor-not-allowed",
              )}
            >
              💰 Recoger tesoro
            </button>
            <button
              disabled={!canInspire}
              onClick={onOpenInspiration}
              className={cn(
                "rounded px-2 py-1.5 text-[10px] font-medium transition-colors border",
                canInspire
                  ? "bg-purple-500/10 border-purple-500/40 text-purple-400 hover:bg-purple-500/20"
                  : "border-border/30 text-muted-foreground/30 cursor-not-allowed",
              )}
            >
              🃏 Inspiración {canInspire ? `(${playable.length})` : ""}
            </button>
          </div>
        </div>
      )}

      {/* Botón "Terminar turno de [nombre]" con confirmación inline */}
      {inActivate && (
        <div className="px-2 pb-2">
          {confirmPass ? (
            <div className="rounded border border-amber-500/40 bg-amber-950/30 px-2 py-2 space-y-2">
              <p className="text-[10px] text-amber-300 leading-snug">
                {snap.name} no podrá hacer más acciones este turno.
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setConfirmPass(false)}
                  className="flex-1 rounded px-2 py-1 text-[10px] border border-border/50 text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setConfirmPass(false)
                    sendAction({ type: "passUnit", uid: unit.uid })
                    onDone()
                  }}
                  className="flex-1 rounded px-2 py-1 text-[10px] bg-amber-600/30 border border-amber-500/60 text-amber-300 hover:bg-amber-600/50 font-semibold transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmPass(true)}
              className="w-full rounded px-2 py-1.5 text-[10px] font-medium border border-border/40 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
            >
              ✓ Terminar turno de {snap.name}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Info de criatura seleccionada ────────────────────────────────────────────

function SelectedUnitInfo({ unit, snap, moveSelection, onShowCard }: {
  unit: GameUnit; snap: CreatureSnapshot
  moveSelection: MoveSelection | null
  onShowCard: () => void
}) {
  const hp = snap.hp - unit.damage
  const hpPct = Math.max(0, (hp / snap.hp) * 100)
  const hpColor = hpPct > 60 ? "#22c55e" : hpPct > 30 ? "#f59e0b" : "#ef4444"
  const movRemaining = null
  return (
    <button type="button" onClick={onShowCard} className="w-full text-left rounded-lg border bg-muted/20 px-2.5 py-2 space-y-1.5 hover:border-primary/40 transition-colors"
      style={{ borderLeftColor: snap.factionColor, borderLeftWidth: 3, borderColor: "transparent", borderLeftStyle: "solid" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold truncate">{snap.name}</p>
        <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{hp}/{snap.hp} HP</span>
      </div>
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Nv{snap.level} · ⚔{snap.meleeDamage}
        {snap.rangedDamage !== null && ` · 🏹${snap.rangedDamage}@${snap.rangedDistance}`}
        {movRemaining !== null && ` · 👟${movRemaining} rest.`}
        {unit.tapped && " · agotada"}{unit.moved && !movRemaining && " · movió"}{unit.attacked && " · atacó"}
      </p>
      <p className="text-[9px] text-muted-foreground/50 italic">Clic aquí para ver ficha</p>
    </button>
  )
}

// ── Mini carta de criatura ───────────────────────────────────────────────────

function MiniCreatureCard({ snap, unit, label, labelColor, dead, dimmed, highlighted, factionColor: overrideColor, onClick, onShowCard }: {
  snap: CreatureSnapshot; unit?: GameUnit; label: string; labelColor: string
  dead?: boolean; dimmed?: boolean; highlighted?: boolean; factionColor?: string
  onClick: () => void; onShowCard: () => void
}) {
  const color = overrideColor ?? snap.factionColor
  const hp = unit ? snap.hp - unit.damage : snap.hp
  const hpPct = Math.max(0, (hp / snap.hp) * 100)
  const hpColor = hpPct > 60 ? "#22c55e" : hpPct > 30 ? "#f59e0b" : "#ef4444"
  return (
    <div className={cn("shrink-0 w-14 rounded-lg border flex flex-col overflow-hidden transition-all",
      highlighted ? "border-primary shadow-md bg-primary/10" : "border-border bg-card",
      dimmed && "opacity-40", dead && "opacity-50 grayscale")}>
      {/* Área del token: click izquierdo = seleccionar/desplegar, click derecho = ficha */}
      <button type="button" onClick={onClick} onContextMenu={(e) => { e.preventDefault(); onShowCard() }}
        className="relative h-10 flex items-center justify-center hover:brightness-110 transition-all"
        style={{ backgroundColor: color + "33" }}>
        <div className="size-8 rounded-full overflow-hidden border border-white/20" style={{ backgroundColor: color }}>
          <CreatureTokenImg snap={{ ...snap, factionColor: color }} size={32} />
        </div>
        {dead && <Skull className="absolute bottom-0.5 right-0.5 size-2.5 text-muted-foreground" />}
        {unit?.tapped && <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-amber-400" />}
      </button>
      {unit && (
        <div className="h-0.5 w-full bg-muted">
          <div className="h-full" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
        </div>
      )}
      {/* Etiqueta: click izquierdo abre ficha */}
      <button type="button" onClick={onShowCard}
        className={cn("text-[9px] text-center py-0.5 px-0.5 leading-tight font-medium w-full hover:brightness-125", labelColor)}>
        {label}
      </button>
    </div>
  )
}

// ── Mini carta de orden ──────────────────────────────────────────────────────

function MiniOrderCard({ card, factionColor, active, dimmed, onClick, onConfirm, onShowCard }: {
  card: InspirationCardSnapshot; factionColor: string; active: boolean; dimmed: boolean
  onClick: () => void; onConfirm?: () => void; onShowCard: () => void
}) {
  return (
    <div className={cn("shrink-0 w-20 rounded-lg border flex flex-col overflow-hidden transition-all",
      active ? "border-primary shadow-md" : "border-border hover:border-primary/40",
      dimmed && "opacity-40")}>
      {/* Cabecera con nombre: click = seleccionar, clic derecho = ficha */}
      <button type="button" onClick={onClick} onContextMenu={(e) => { e.preventDefault(); onShowCard() }}
        className="flex-1 text-left">
        <div className="px-1.5 py-1 text-white text-[9px] font-semibold leading-tight line-clamp-2" style={{ backgroundColor: factionColor }}>
          {card.name}{card.minor ? <span className="opacity-70"> V</span> : null}
        </div>
        <div className="px-1.5 py-1 text-[9px] text-muted-foreground leading-tight line-clamp-3 bg-card">
          {card.description}
        </div>
        {(card.requiredLevel > 0 || card.requiredAttribute) && (
          <div className="px-1.5 py-0.5 border-t border-border text-[8px] text-muted-foreground bg-card">
            {card.requiredLevel > 0 && `Nv≥${card.requiredLevel} `}
            {card.requiredAttribute && card.requiredAttribute.slice(0, 3).toUpperCase()}
          </div>
        )}
      </button>
      {/* Botón "ver ficha" pequeño */}
      <button type="button" onClick={onShowCard}
        className="bg-muted/30 text-[8px] text-muted-foreground py-0.5 hover:bg-muted text-center transition-colors">
        ver
      </button>
      {active && onConfirm && (
        <button type="button" onClick={onConfirm}
          className="bg-primary text-primary-foreground text-[9px] py-0.5 font-semibold text-center hover:bg-primary/80 transition-colors">
          Usar
        </button>
      )}
    </div>
  )
}

// ── Pila de descarte ─────────────────────────────────────────────────────────

function DiscardPile({ count, cards, catalog, factionColor, label, onClickCard }: {
  count: number; cards: string[]; catalog: Record<string, InspirationCardSnapshot>
  factionColor: string; label?: string
  onClickCard: (card: InspirationCardSnapshot) => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="shrink-0 w-12 rounded-lg border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-0.5 cursor-default h-16">
          <div className="size-5 rounded flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: factionColor + "99" }}>{count}</div>
          <span className="text-[8px] text-muted-foreground">{label ?? "desc."}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-52 p-2">
        <p className="font-semibold text-xs mb-1.5">{label ? `Descarte ${label}` : "Mis descartadas"}</p>
        <ul className="space-y-0.5 max-h-40 overflow-y-auto">
          {cards.map((id, i) => {
            const card = catalog[id]
            return (
              <li key={`${id}-${i}`}>
                <button type="button" onClick={() => card && onClickCard(card)}
                  className="text-[10px] text-left hover:text-primary transition-colors w-full">
                  {card?.name ?? id}
                </button>
              </li>
            )
          })}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

// ── Token imagen de criatura ─────────────────────────────────────────────────

function CreatureTokenImg({ snap, size }: { snap: CreatureSnapshot; size: number }) {
  const url = assetUrl(snap.token)
  if (url) return <img src={url} alt={snap.name} className="w-full h-full object-cover" />
  return (
    <span className="flex items-center justify-center w-full h-full font-bold text-white select-none"
      style={{ fontSize: size * 0.38 }}>
      {snap.name.charAt(0).toUpperCase()}
    </span>
  )
}

// ── Banner de reacción al ataque (defensor) ───────────────────────────────────

function ReactionBanner({
  pa, state, mySide, myOrderHand, orderCatalog,
  onTake, onCower, onOpenInspiration,
}: {
  pa: PendingAttack; state: GameState; mySide: PlayerSide
  myOrderHand: string[]; orderCatalog: Record<string, InspirationCardSnapshot>
  onTake: () => void; onCower: () => void; onOpenInspiration: () => void
}) {
  const attacker = state.units.find((u) => u.uid === pa.attackerUid)
  const target   = state.units.find((u) => u.uid === pa.targetUid)
  const attackerSnap = attacker ? state.catalog[attacker.creatureId] : null
  const targetSnap   = target   ? state.catalog[target.creatureId]   : null
  const hasDefenseCards = myOrderHand.length > 0

  return (
    <div className="rounded-xl bg-gradient-to-br from-red-950/97 to-red-900/95 backdrop-blur-md border border-red-500/50 shadow-2xl shadow-red-950/60 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-red-500/25">
        <div className="shrink-0 size-9 rounded-full bg-red-600/40 border border-red-500/60 flex items-center justify-center">
          <span className="text-lg">{pa.mode === "melee" ? "⚔" : "🏹"}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-200 leading-tight">
            ¡{attackerSnap?.name ?? "Enemigo"} ataca a {targetSnap?.name ?? "tu criatura"}!
          </p>
          <p className="text-[11px] text-red-300/70 mt-0.5">
            {pa.damage} de daño entrante · ¿Cómo reaccionas?
          </p>
        </div>
      </div>
      {/* Botones de respuesta */}
      <div className="flex gap-2 px-4 py-3">
        <button
          onClick={onTake}
          className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold bg-slate-700/80 border border-slate-500/60 text-slate-200 hover:bg-slate-600 transition-colors text-center"
        >
          <span className="block text-base leading-none mb-1">🛡</span>
          Aguantar
          <span className="block text-red-400 text-[10px] mt-0.5">−{pa.damage} HP</span>
        </button>
        <button
          onClick={onCower}
          className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold bg-yellow-900/60 border border-yellow-600/60 text-yellow-200 hover:bg-yellow-800/60 transition-colors text-center"
        >
          <span className="block text-base leading-none mb-1">🏳</span>
          Acobardarse
          <span className="block text-yellow-400 text-[10px] mt-0.5">−{pa.damage} Moral</span>
        </button>
        {hasDefenseCards && (
          <button
            onClick={onOpenInspiration}
            className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold bg-purple-900/60 border border-purple-600/60 text-purple-200 hover:bg-purple-800/60 transition-colors text-center"
          >
            <span className="block text-base leading-none mb-1">🃏</span>
            Inspiración
            <span className="block text-purple-400 text-[10px] mt-0.5">{myOrderHand.length} cartas</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Notificación de combate ───────────────────────────────────────────────────

// ── Modal carta de inspiración robada ────────────────────────────────────────

function DrawnCardModal({ snap, onClose }: { snap: InspirationCardSnapshot; onClose: () => void }) {
  const actionBadge =
    snap.actionType === "swift"   ? { label: "Acción menor",  cls: "bg-blue-900/60 border-blue-500/50 text-blue-200" } :
    snap.actionType === "defense" ? { label: "Defensa",       cls: "bg-slate-700/60 border-slate-500/50 text-slate-200" } :
                                    { label: "Acción estándar", cls: "bg-amber-900/60 border-amber-500/50 text-amber-200" }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
      {/* Fondo semitransparente */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Tarjeta */}
      <div className="relative w-72 animate-in zoom-in-95 fade-in duration-200 rounded-2xl border border-purple-500/40 bg-gradient-to-b from-purple-950/97 to-slate-900/97 shadow-2xl shadow-purple-950/60 overflow-hidden">
        {/* Cabecera */}
        <div className="bg-purple-900/40 border-b border-purple-500/25 px-4 pt-4 pb-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-purple-400/80 mb-1">Nueva inspiración</p>
          <div className="text-2xl mb-2">🃏</div>
          <h3 className="text-base font-bold text-white leading-snug">{snap.name}</h3>
          <span className={`inline-block mt-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${actionBadge.cls}`}>
            {actionBadge.label}
          </span>
        </div>

        {/* Cuerpo */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs text-white/80 leading-relaxed text-center">{snap.description}</p>

          {(snap.requiredAttribute || snap.requiredKeyword || snap.requiredLevel > 0) && (
            <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 space-y-1 text-[10px] text-white/60">
              {snap.requiredLevel > 0 && (
                <p>Nivel mínimo de la criatura actora: <span className="text-white/80 font-semibold">{snap.requiredLevel}</span></p>
              )}
              {snap.requiredAttribute && (
                <p>Atributo requerido: <span className="text-white/80 font-semibold capitalize">{snap.requiredAttribute}</span></p>
              )}
              {snap.requiredKeyword && (
                <p>Keyword requerida: <span className="text-white/80 font-semibold capitalize">{snap.requiredKeyword}</span></p>
              )}
            </div>
          )}
        </div>

        {/* Botón cerrar */}
        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-purple-700/50 hover:bg-purple-600/60 border border-purple-500/40 text-white text-sm font-semibold py-2 transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Notificación de combate ───────────────────────────────────────────────────

function CombatToast({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <div className="flex items-start gap-2 rounded-lg bg-black/80 backdrop-blur-sm border border-amber-500/40 px-3 py-2 shadow-xl animate-in slide-in-from-right-4 fade-in duration-200">
      <Zap className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
      <span className="text-xs text-white/90 leading-relaxed">{text}</span>
    </div>
  )
}

// ── Token Konva (unidad en el mapa) ──────────────────────────────────────────

function UnitToken({ unit, snap, cell, mine, selected, hasMoveBudget, onClick }: {
  unit: GameUnit; snap: CreatureSnapshot; cell: number
  mine: boolean; selected: boolean; hasMoveBudget: boolean; onClick: () => void
}) {
  const tokenImage = useImage(assetUrl(snap.token) ?? "")
  const sizePx = snap.gridSize * cell
  const radius = sizePx / 2 - 2
  const cx = unit.x * cell + sizePx / 2
  const cy = unit.y * cell + sizePx / 2
  const hpRatio = Math.max(0, (snap.hp - unit.damage) / snap.hp)
  const hpColor = hpRatio > 0.6 ? "#22c55e" : hpRatio > 0.3 ? "#f59e0b" : "#ef4444"
  return (
    <Group x={cx} y={cy} opacity={unit.tapped ? 0.55 : 1} onClick={onClick} onTap={onClick}>
      {/* Anillo de selección */}
      {selected && <Circle radius={radius + 4} stroke="#f59e0b" strokeWidth={2.5} fill="rgba(245,158,11,0.10)" />}
      {/* Indicador de movimiento restante */}
      {hasMoveBudget && !selected && <Circle radius={radius + 3} stroke="rgba(34,197,94,0.6)" strokeWidth={1.5} fill="transparent" dash={[3, 3]} />}
      <Circle radius={radius} fill={snap.factionColor}
        stroke={mine ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.6)"} strokeWidth={mine ? 2 : 1.5}
        shadowColor="rgba(0,0,0,0.5)" shadowBlur={4} shadowOffsetY={1} />
      {tokenImage ? (
        <Group clipFunc={(ctx) => { ctx.arc(0, 0, radius - 2, 0, Math.PI * 2, false) }}>
          <KonvaImage image={tokenImage} x={-radius + 2} y={-radius + 2} width={(radius - 2) * 2} height={(radius - 2) * 2} />
        </Group>
      ) : (
        <Text text={snap.name.charAt(0).toUpperCase()} fontSize={Math.max(10, radius * 0.9)} fontStyle="bold"
          fill="rgba(255,255,255,0.9)" x={-radius} y={-radius * 0.45} width={radius * 2} align="center" />
      )}
      <Rect x={-radius} y={radius - 3} width={radius * 2} height={3} fill="rgba(0,0,0,0.6)" cornerRadius={1.5} />
      <Rect x={-radius} y={radius - 3} width={radius * 2 * hpRatio} height={3} fill={hpColor} cornerRadius={1.5} />
    </Group>
  )
}

// ── Leyenda de terrenos ───────────────────────────────────────────────────────

function TerrainLegendModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Terrenos ocupables (excluir deployA/deployB de la leyenda de batalla)
  const battleTerrains = TERRAINS.filter(
    (t) => t.key !== "deployA" && t.key !== "deployB" && t.key !== "magic",
  )

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Info className="size-4 text-primary" /> Leyenda de terrenos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Paredes — sección separada */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Paredes (bordes de celda)
            </p>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Muestra visual: línea gruesa oscura */}
                <div className="size-9 shrink-0 rounded border border-border/50 bg-muted/20 flex items-center justify-center overflow-hidden">
                  <div className="w-full h-full relative flex items-center">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-700" />
                    <div className="ml-3 size-5 rounded-full bg-green-700/60 border border-green-500/40" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">Pared</p>
                  <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                    Pintada sobre el <strong>borde</strong> de una celda. Bloquea el tránsito entre dos celdas adyacentes y la línea de visión. Las unidades <strong>no pueden cruzarla</strong>.
                  </p>
                </div>
                <span className="text-[9px] shrink-0 rounded px-1.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 font-medium">
                  Impasable
                </span>
              </div>
            </div>
          </div>

          {/* Terrenos de celda */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Terrenos de celda
            </p>
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/50">
              {battleTerrains.map((t) => {
                const passable = t.key !== "wall"
                const badge =
                  t.key === "wall"      ? { label: "Impasable",  cls: "bg-red-500/15 text-red-400 border-red-500/30" }
                  : t.key === "obstacle" ? { label: "Ocupable",   cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
                  :                        { label: "Ocupable",   cls: "bg-green-500/15 text-green-400 border-green-500/30" }

                const extras: string[] = []
                if (t.key === "difficult")  extras.push("+1 mov.")
                if (t.key === "hazardous")  extras.push("+1 mov.", "daño al entrar")
                if (t.key === "obstacle")   extras.push("+1 mov.", "cobertura", "bloquea visión")
                if (t.key === "wall")       extras.push("bloquea visión")
                if (t.key === "treasure")   extras.push("+1 Moral al recoger")

                return (
                  <div key={t.key} className="flex items-center gap-3 px-3 py-2.5">
                    {/* Muestra de color */}
                    <div
                      className="size-9 shrink-0 rounded border border-white/10"
                      style={{ backgroundColor: t.fill }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{t.label}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {extras.map((e) => (
                          <span key={e} className="text-[9px] text-muted-foreground bg-muted/40 rounded px-1 py-0.5">
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className={cn(
                      "text-[9px] shrink-0 rounded px-1.5 py-0.5 border font-medium",
                      badge.cls,
                    )}>
                      {badge.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Nota de cobertura */}
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
            💡 <strong>Cobertura:</strong> las unidades en obstáculos o detrás de paredes son más difíciles de disparar (reglas de LoS — próximamente).
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal de despliegue ───────────────────────────────────────────────────────

function DeployModal({
  me, state, deployedLevels, onSelect, onEndTurn, onClose,
}: {
  me: GameState["players"][PlayerSide]
  state: GameState
  deployedLevels: number
  onSelect: (creatureId: string) => void
  onEndTurn: () => void
  onClose: () => void
}) {
  const available = me.hand.map((cid) => ({ cid, snap: state.catalog[cid] })).filter((x) => !!x.snap)
  const remaining = me.leadership - deployedLevels

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChevronRight className="size-4 text-primary" /> Fase de despliegue
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Liderazgo disponible: <span className="font-bold text-foreground">{remaining}</span> de {me.leadership}.
          Selecciona una criatura para colocarla en tu zona.
        </p>

        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {available.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">Sin criaturas en reserva.</p>
          ) : (
            available.map(({ cid, snap }) => {
              const fits = snap.level <= remaining
              return (
                <button
                  key={cid}
                  disabled={!fits}
                  onClick={() => onSelect(cid)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    fits
                      ? "border-border hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
                      : "border-border/30 opacity-40 cursor-not-allowed",
                  )}
                >
                  <div
                    className="size-10 shrink-0 rounded-full overflow-hidden border-2 border-white/15"
                    style={{ backgroundColor: snap.factionColor }}
                  >
                    <CreatureTokenImg snap={snap} size={40} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight truncate">{snap.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Nv {snap.level} · {snap.hp} HP · ⚔{snap.meleeDamage}
                      {snap.rangedDamage !== null && ` · 🏹${snap.rangedDamage}`}
                      {snap.gridSize > 1 && ` · ${snap.gridSize}×${snap.gridSize}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={cn(
                      "text-xs font-bold rounded px-1.5 py-0.5",
                      fits ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground",
                    )}>
                      Nv {snap.level}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={onEndTurn}>
            <Flag className="size-3.5" /> Saltar y terminar turno
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Tapete de inspiraciones ───────────────────────────────────────────────────

function InspirationTapete({
  uid, state, myOrderHand, orderCatalog, onPlay, onClose,
}: {
  uid: string
  state: GameState
  myOrderHand: string[]
  orderCatalog: Record<string, InspirationCardSnapshot>
  onPlay: (cardId: string) => void
  onClose: () => void
}) {
  const actor = state.units.find(u => u.uid === uid)
  const actorSnap = actor ? state.catalog[actor.creatureId] : null

  const cards = myOrderHand.map((cardId, idx) => ({ cardId, idx, card: orderCatalog[cardId] }))
    .filter(({ card }) => !!card)

  const canPlayCard = (card: InspirationCardSnapshot) => {
    if (!actor) return false
    // Cartas standard (no minor) requieren que la unidad no esté agotada
    return !(actor.tapped && !card.minor)
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl w-full" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🃏 Inspiraciones
            {actorSnap && (
              <span className="text-sm font-normal text-muted-foreground">
                — usando <span className="text-foreground font-medium">{actorSnap.name}</span>
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {cards.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center">Sin cartas de inspiración en mano.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto py-1 pr-1">
            {cards.map(({ cardId, idx, card }) => {
              const playable = canPlayCard(card)
              return (
                <button
                  key={`${cardId}-${idx}`}
                  disabled={!playable}
                  onClick={() => onPlay(cardId)}
                  className={cn(
                    "text-left rounded-xl border p-3 flex flex-col gap-2 transition-all",
                    playable
                      ? "border-border hover:border-primary hover:bg-primary/5 cursor-pointer"
                      : "border-border/40 opacity-40 cursor-not-allowed",
                  )}
                >
                  {/* Cabecera */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm leading-tight">{card.name}</span>
                    <div className="flex gap-1 shrink-0">
                      {card.minor
                        ? <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded px-1.5 py-0.5">Veloz</span>
                        : <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">Acción</span>
                      }
                    </div>
                  </div>
                  {/* Descripción */}
                  <p className="text-xs text-muted-foreground leading-snug line-clamp-3">
                    {card.description ?? "Sin descripción."}
                  </p>
                  {/* Nota de coste */}
                  <p className="text-[10px] text-muted-foreground/60 mt-auto">
                    {card.minor ? "No agota la unidad" : "Agota la unidad al jugar"}
                  </p>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { useMemo, useRef, useState, useCallback, useEffect } from "react"
import {
  ArrowLeft, Save, Trash2, Eraser,
  Waves, Flame, Trees, Shield, Wand2, Gem,
  Grid2x2, Minus, BrickWall,
  ChevronLeft, ChevronRight, Paintbrush,
  Plus, RotateCcw, Hand, MousePointer2, Square,
  Undo2, Redo2, Copy, Scissors, Clipboard,
  DoorOpen,
} from "lucide-react"
import type Konva from "konva"
import { Layer, Image as KonvaImage, Line, Rect, Stage } from "react-konva"
import { useNavigate, useParams } from "react-router"
import { TerrainLayer, WallLayer } from "@/components/board/terrain-sprites"
import { MAGIC_BLOCK_DEFAULT, MAGIC_BLOCK_SIZES, TERRAIN_FILL } from "@/lib/terrain"
import type { MagicBlockSize } from "@/lib/terrain"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { AlertBanner } from "@/components/ui/alert-banner"
import { useImage } from "@/hooks/use-image"
import { api, assetUrl } from "@/lib/api"
import type { CellTerrain, GameMapDto, MapCell, MapWall } from "@/lib/api"
import { cn } from "@/lib/utils"

// ── Tipos ─────────────────────────────────────────────────────────────────

type Brush = CellTerrain | "normal" | "wall" | "wall-eraser" | "select" | "room"

type ToolDef = {
  brush: Brush
  label: string
  hint: string
  icon: React.ReactNode
  swatch: string
}

type ToolGroup = {
  label: string
  tools: ToolDef[]
}

// Variantes de diseño por terreno (3 por tipo). El usuario elige cuál pincel
// de sprite usará; la variante se guarda en cellVariants (por posición de celda
// se elige automáticamente, pero este estado controla cuál es la "familia" activa).
// Por ahora se usa como metadato visual de preferencia del editor (no persiste en BD).

// ── Definición de herramientas ────────────────────────────────────────────

const TOOL_GROUPS: ToolGroup[] = [
  {
    label: "Terrenos",
    tools: [
      { brush: "select",    label: "Selección",     hint: "Arrastra para seleccionar un área rectangular", icon: <MousePointer2 className="size-4" />, swatch: "transparent" },
      { brush: "normal",    label: "Goma",          hint: "Elimina el terreno y las paredes de borde de la celda",          icon: <Eraser className="size-4" />,   swatch: "transparent" },
      { brush: "difficult", label: "Difícil",        hint: "+1 de movimiento (agua, barro, pantano)",    icon: <Waves className="size-4" />,    swatch: "rgba(59,130,246,0.6)" },
      { brush: "hazardous", label: "Peligroso",      hint: "Difícil + daño al entrar",                  icon: <Flame className="size-4" />,    swatch: "rgba(239,68,68,0.6)" },
      { brush: "obstacle",  label: "Obstáculo",      hint: "Difícil + cobertura + bloquea LoS",         icon: <Trees className="size-4" />,    swatch: "rgba(139,92,246,0.6)" },
      { brush: "wall",      label: "Zona sólida",    hint: "Pinta zona intransitable (paredes/rocas/edificios). Úsalo sobre las zonas negras del arte del mapa.", icon: <Shield className="size-4" />,   swatch: "rgba(30,30,46,0.9)" },
      { brush: "magic",     label: "Círculo",        hint: "Círculo mágico 2×2 / 3×3 / 4×4",           icon: <Wand2 className="size-4" />,    swatch: "rgba(34,211,238,0.45)" },
      { brush: "treasure",  label: "Tesoro",         hint: "Cofre: recogerlo da +1 Moral",              icon: <Gem className="size-4" />,      swatch: "rgba(234,179,8,0.75)" },
    ],
  },
  {
    label: "Zonas",
    tools: [
      { brush: "deployA",   label: "Zona A",         hint: "Zona de despliegue jugador A (forma libre)", icon: <span className="size-4 flex items-center justify-center text-[11px] font-bold leading-none">A</span>, swatch: "rgba(34,197,94,0.55)" },
      { brush: "deployB",   label: "Zona B",         hint: "Zona de despliegue jugador B (forma libre)", icon: <span className="size-4 flex items-center justify-center text-[11px] font-bold leading-none">B</span>, swatch: "rgba(59,130,246,0.55)" },
    ],
  },
  {
    label: "Paredes",
    tools: [
      { brush: "wall",      label: "Pared borde",    hint: "Línea en el borde de una celda. Marca automáticamente la celda como zona sólida (intransitable).", icon: <BrickWall className="size-4" />,   swatch: "#52525b" },
      { brush: "room" as Brush, label: "Habitación", hint: "Arrastra para dibujar un rectángulo cerrado con paredes de borde", icon: <DoorOpen className="size-4" />, swatch: "#52525b" },
    ],
  },
]

// Lookup plano brush→def
const TOOL_BY_KEY: Record<string, ToolDef> = {}
for (const g of TOOL_GROUPS) for (const t of g.tools) TOOL_BY_KEY[`${g.label}/${t.brush}`] = t

// Variantes de sprites por tipo de terreno
const TERRAIN_VARIANTS: Partial<Record<CellTerrain, string[]>> = {
  difficult: ["Agua",   "Barro",  "Pantano"],
  hazardous: ["Fuego",  "Ácido",  "Calavera"],
  obstacle:  ["Árbol",  "Roca",   "Matorral"],
}

// Convierte rgba(r,g,b,a) al hex más cercano (#rrggbb) para inputs de color
function rgbaToHex(rgba: string): string {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return rgba.startsWith("#") ? rgba : "#888888"
  const toHex = (n: number) => n.toString(16).padStart(2, "0")
  return `#${toHex(Number(m[1]))}${toHex(Number(m[2]))}${toHex(Number(m[3]))}`
}

// ── Constantes de layout ──────────────────────────────────────────────────

const MAX_STAGE_W  = 860
const MAX_STAGE_H  = 640
const WALL_SNAP_TH = 0.25
const ZOOM_MIN  = 1.0
const ZOOM_MAX  = 2.0
const ZOOM_STEP = 0.10

// ── Helpers ───────────────────────────────────────────────────────────────

function cellKey(x: number, y: number) { return `${x},${y}` }
function wallKey(w: Pick<MapWall, "x" | "y" | "side">) { return `${w.x},${w.y},${w.side}` }

function detectWallSnap(
  px: number, py: number, cell: number, cols: number, rows: number,
): Pick<MapWall, "x" | "y" | "side"> | null {
  const fx = (px / cell) % 1
  const fy = (py / cell) % 1
  const cx = Math.floor(px / cell)
  const cy = Math.floor(py / cell)
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return null
  const dL = fx, dR = 1 - fx, dT = fy, dB = 1 - fy
  const min = Math.min(dL, dR, dT, dB)
  if (min > WALL_SNAP_TH) return null
  if (min === dT) return { x: cx, y: cy, side: "N" }
  if (min === dB) return { x: cx, y: cy, side: "S" }
  if (min === dL) return { x: cx, y: cy, side: "W" }
  return { x: cx, y: cy, side: "E" }
}

function snapForAxis(
  snap: Pick<MapWall, "x" | "y" | "side"> | null,
  axis: "free" | "H" | "V",
): Pick<MapWall, "x" | "y" | "side"> | null {
  if (!snap || axis === "free") return snap
  if (axis === "H" && (snap.side === "N" || snap.side === "S")) return snap
  if (axis === "V" && (snap.side === "E" || snap.side === "W")) return snap
  // Forzar el lado más cercano dentro del eje permitido
  return null
}

// ── Historial ─────────────────────────────────────────────────────────────

type Snapshot = { cells: Map<string, CellTerrain>; walls: Map<string, MapWall> }

const MAX_HISTORY = 60

// ── Selección ─────────────────────────────────────────────────────────────

type Selection = { x0: number; y0: number; x1: number; y1: number } | null

type ClipboardData = { cells: { dx: number; dy: number; t: CellTerrain }[]; walls: { dx: number; dy: number; side: MapWall["side"]; thickness: number }[] }

// ── Menú contextual ───────────────────────────────────────────────────────

type CtxMenu = {
  screenX: number
  screenY: number
  cellX: number
  cellY: number
  terrain: CellTerrain | null
}

// ── Página ────────────────────────────────────────────────────────────────

export function MapCellsEditorPage() {
  const { id } = useParams<{ id: string }>()
  const [map, setMap] = useState<GameMapDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    api.maps.get(id)
      .then((d) => { if (!cancelled) setMap(d) })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar") })
    return () => { cancelled = true }
  }, [id])

  if (error) return <p className="text-destructive text-sm">{error}</p>
  if (!map)  return <p className="text-muted-foreground text-sm">Cargando mapa…</p>
  return <MapCellsEditor map={map} />
}

// ── Editor ────────────────────────────────────────────────────────────────

function MapCellsEditor({ map }: { map: GameMapDto }) {
  const [cols, setCols]   = useState(map.cols)
  const [rows, setRows]   = useState(map.rows)
  const [cells, setCells] = useState<Map<string, CellTerrain>>(
    () => new Map((map.cells ?? []).map((c) => [cellKey(c.x, c.y), c.t])),
  )
  const [walls, setWalls] = useState<Map<string, MapWall>>(
    () => new Map((map.walls ?? []).map((w) => [wallKey(w), w])),
  )

  // Historial de undo/redo
  const historyPast   = useRef<Snapshot[]>([])
  const historyFuture = useRef<Snapshot[]>([])
  const [historyState, setHistoryState] = useState({ past: 0, future: 0 })

  // Selección rectangular y portapapeles interno
  const [selection, setSelection]     = useState<Selection>(null)
  const [clipboard, setClipboard]     = useState<ClipboardData | null>(null)
  const selStart = useRef<{ x: number; y: number } | null>(null)
  const isSelecting = useRef(false)

  // Habitación (room draft)
  const [roomDraft, setRoomDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const roomStart = useRef<{ x: number; y: number } | null>(null)
  const isDrawingRoom = useRef(false)

  // Draft de línea de paredes: preview mientras se arrastra, se confirma al soltar
  const [wallLineDraft, setWallLineDraft] = useState<{ sx: number; sy: number; tx: number; ty: number; side: MapWall["side"] } | null>(null)
  const wallLineStart = useRef<{ cx: number; cy: number; side: MapWall["side"] } | null>(null)

  // Herramienta activa
  const [brush, setBrush]       = useState<Brush>("difficult")
  const [activeKey, setActiveKey] = useState("Terrenos/difficult")
  // "cell" = muro relleno de celda | "edge" = pared de borde | "edge-eraser" = borrar borde
  const [wallMode, setWallMode] = useState<"cell" | "edge" | "edge-eraser">("cell")
  // Eje forzado al trazar paredes de borde: "free" = snap libre, "H" = solo horizontales (N/S), "V" = solo verticales (E/W)
  const [wallAxis, setWallAxis] = useState<"free" | "H" | "V">("free")
  const isEdgeWall = wallMode === "edge" || wallMode === "edge-eraser"

  // Variante de sprite activa por tipo de terreno
  const [spriteVariants, setSpriteVariants] = useState<Partial<Record<CellTerrain, 0 | 1 | 2>>>({})

  // Opciones del editor
  const [magicSize, setMagicSize]       = useState<MagicBlockSize>(MAGIC_BLOCK_DEFAULT)
  const [wallThickness, setWallThickness] = useState(0.30)
  const [gridColor, setGridColor]         = useState("rgba(255,255,255,0.22)")
  const [wallFill, setWallFill]           = useState("#000000")
  // Colores personalizados por tipo de terreno (sobreescriben los defaults de TERRAIN_FILL)
  const [terrainColors, setTerrainColors] = useState<Partial<Record<CellTerrain, string>>>({})
  function setTerrainColor(t: CellTerrain, color: string) {
    setTerrainColors((prev) => ({ ...prev, [t]: color }))
  }

  // Mostrar overlay gris de celdas sólidas (solo en el editor, para depuración)
  const [showWallCells, setShowWallCells] = useState(true)

  // Estado UI
  const [toolbarOpen, setToolbarOpen]       = useState(false)
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [dirty, setDirty]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  // Diálogos de confirmación
  const [confirmClearAll,  setConfirmClearAll]  = useState(false)
  const [confirmClearWalls, setConfirmClearWalls] = useState(false)

  const navigate = useNavigate()
  const [leaveOpen, setLeaveOpen] = useState(false)

  function handleBack() {
    if (dirty) { setLeaveOpen(true) } else { navigate("/admin/maps") }
  }

  // Cierre de pestaña / recarga con cambios sin guardar
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault() }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  // Mantener la ref de walls sincronizada con el estado (para eraseTerrain)
  useEffect(() => { wallsRef.current = walls }, [walls])

  // Zoom / pan
  const [zoom, setZoom]       = useState(1)
  const [pan, setPan]         = useState({ x: 0, y: 0 })
  const [panMode, setPanMode] = useState(false)
  const isPanning   = useRef(false)
  const panStart    = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  const painting  = useRef(false)
  const [wallHover, setWallHover] = useState<Pick<MapWall, "x" | "y" | "side"> | null>(null)
  const stageRef       = useRef<Konva.Stage | null>(null)
  const canvasWrapRef  = useRef<HTMLDivElement>(null)

  const image = useImage(assetUrl(map.image) ?? "")

  // ── Centrar el mapa al montar ─────────────────────────────────────────
  useEffect(() => {
    const el = canvasWrapRef.current
    if (!el) return
    const center = () => {
      const { clientWidth: w, clientHeight: h } = el
      if (w === 0 || h === 0) return
      setPan({
        x: (w / zoom - stageWidth)  / 2,
        y: (h / zoom - stageHeight) / 2,
      })
    }
    // Esperar un frame para que el layout fixed haya calculado dimensiones
    const id = requestAnimationFrame(center)
    return () => cancelAnimationFrame(id)
  // Solo al montar; stageWidth/stageHeight son constantes derivadas de props
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Atajos de teclado ─────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignorar si el foco está en un input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return

      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl) {
        if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo() }
        if ((e.key === "y") || (e.key === "z" && e.shiftKey)) { e.preventDefault(); redo() }
        if (e.key === "c") { e.preventDefault(); copySelection() }
        if (e.key === "x") { e.preventDefault(); cutSelection() }
        if (e.key === "v") { e.preventDefault(); pasteSelection() }
        return
      }
      // Supr / Backspace → borrar selección si existe, o activar goma
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        if (selection) {
          cutSelection()
        } else {
          activateTool("normal", "Terrenos")
        }
      }
      // Escape → deseleccionar
      if (e.key === "Escape") { setSelection(null) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  // Las funciones se recrean cuando cambia cells/walls/selection/clipboard — eslint lo ignora
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, walls, selection, clipboard])

  const cell        = Math.max(6, Math.floor(Math.min(MAX_STAGE_W / cols, MAX_STAGE_H / rows)))
  const stageWidth  = cell * cols
  const stageHeight = cell * rows

  // ── Historial ─────────────────────────────────────────────────────────

  function pushHistory(c: Map<string, CellTerrain>, w: Map<string, MapWall>) {
    historyPast.current = [...historyPast.current.slice(-MAX_HISTORY + 1), { cells: new Map(c), walls: new Map(w) }]
    historyFuture.current = []
    setHistoryState({ past: historyPast.current.length, future: 0 })
  }

  function undo() {
    const snap = historyPast.current.pop()
    if (!snap) return
    historyFuture.current = [{ cells: new Map(cells), walls: new Map(walls) }, ...historyFuture.current.slice(0, MAX_HISTORY - 1)]
    setCells(snap.cells)
    setWalls(snap.walls)
    setDirty(true)
    setHistoryState({ past: historyPast.current.length, future: historyFuture.current.length })
  }

  function redo() {
    const snap = historyFuture.current.shift()
    if (!snap) return
    historyPast.current = [...historyPast.current.slice(-MAX_HISTORY + 1), { cells: new Map(cells), walls: new Map(walls) }]
    setCells(snap.cells)
    setWalls(snap.walls)
    setDirty(true)
    setHistoryState({ past: historyPast.current.length, future: historyFuture.current.length })
  }

  // ── Selección ─────────────────────────────────────────────────────────

  function normalSel(s: Selection): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (!s) return null
    return { minX: Math.min(s.x0, s.x1), minY: Math.min(s.y0, s.y1), maxX: Math.max(s.x0, s.x1), maxY: Math.max(s.y0, s.y1) }
  }

  function copySelection() {
    const r = normalSel(selection)
    if (!r) return
    const selectedCells = [...cells.entries()]
      .filter(([k]) => { const [x, y] = k.split(",").map(Number); return x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY })
      .map(([k, t]) => { const [x, y] = k.split(",").map(Number); return { dx: x - r.minX, dy: y - r.minY, t } })
    const selectedWalls = [...walls.values()]
      .filter((w) => w.x >= r.minX && w.x <= r.maxX && w.y >= r.minY && w.y <= r.maxY)
      .map((w) => ({ dx: w.x - r.minX, dy: w.y - r.minY, side: w.side, thickness: w.thickness }))
    setClipboard({ cells: selectedCells, walls: selectedWalls })
  }

  function cutSelection() {
    const r = normalSel(selection)
    if (!r) return
    copySelection()
    pushHistory(cells, walls)
    setCells((cur) => {
      const next = new Map(cur)
      for (let x = r.minX; x <= r.maxX; x++) for (let y = r.minY; y <= r.maxY; y++) next.delete(cellKey(x, y))
      return next
    })
    setWalls((cur) => {
      const next = new Map(cur)
      for (const w of walls.values()) if (w.x >= r.minX && w.x <= r.maxX && w.y >= r.minY && w.y <= r.maxY) next.delete(wallKey(w))
      return next
    })
    setSelection(null)
    setDirty(true)
  }

  function pasteSelection() {
    if (!clipboard) return
    const ox = selection ? Math.min(selection.x0, selection.x1) : 0
    const oy = selection ? Math.min(selection.y0, selection.y1) : 0
    pushHistory(cells, walls)
    setCells((cur) => {
      const next = new Map(cur)
      for (const { dx, dy, t } of clipboard.cells) {
        const px = ox + dx, py = oy + dy
        if (px >= 0 && py >= 0 && px < cols && py < rows) next.set(cellKey(px, py), t)
      }
      return next
    })
    setWalls((cur) => {
      const next = new Map(cur)
      for (const { dx, dy, side, thickness } of clipboard.walls) {
        const wx = ox + dx, wy = oy + dy
        if (wx >= 0 && wy >= 0 && wx < cols && wy < rows) {
          const w: MapWall = { x: wx, y: wy, side, thickness }
          next.set(wallKey(w), w)
        }
      }
      return next
    })
    setDirty(true)
  }

  // ── Activar herramienta ────────────────────────────────────────────────

  function activateTool(b: Brush, group: string) {
    setBrush(b)
    setActiveKey(`${group}/${b}`)
    setWallMode(group === "Paredes" ? (b === "wall-eraser" ? "edge-eraser" : "edge") : "cell")
    setCtxMenu(null)
    if (b !== "select") setSelection(null)
  }

  // ── Zoom / pan ────────────────────────────────────────────────────────

  const clampPan = useCallback((x: number, y: number, z: number) => {
    const wrapW = canvasWrapRef.current?.clientWidth  ?? stageWidth
    const wrapH = canvasWrapRef.current?.clientHeight ?? stageHeight
    const scaledW = stageWidth  * z
    const scaledH = stageHeight * z
    // Si el mapa cabe en el eje, permitir cualquier posición entre borde izq y centrado
    const maxX = scaledW < wrapW ? (wrapW - scaledW) / z : 0
    const maxY = scaledH < wrapH ? (wrapH - scaledH) / z : 0
    const minX = scaledW < wrapW ? 0 : (wrapW / z - stageWidth)
    const minY = scaledH < wrapH ? 0 : (wrapH / z - stageHeight)
    return {
      x: Math.max(Math.min(minX, maxX), Math.min(Math.max(minX, maxX), x)),
      y: Math.max(Math.min(minY, maxY), Math.min(Math.max(minY, maxY), y)),
    }
  }, [stageWidth, stageHeight])

  const applyZoom = useCallback((next: number, focalX?: number, focalY?: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
    setZoom((prevZ) => {
      setPan((prevP) => {
        const fx = focalX ?? (canvasWrapRef.current?.clientWidth  ?? stageWidth)  / 2 / prevZ
        const fy = focalY ?? (canvasWrapRef.current?.clientHeight ?? stageHeight) / 2 / prevZ
        const nx = fx - (fx - prevP.x) * (clamped / prevZ)
        const ny = fy - (fy - prevP.y) * (clamped / prevZ)
        return clampPan(nx, ny, clamped)
      })
      return clamped
    })
  }, [clampPan, stageWidth, stageHeight])

  const resetView = useCallback(() => {
    const el = canvasWrapRef.current
    setZoom(1)
    if (el) {
      setPan({
        x: (el.clientWidth  - stageWidth)  / 2,
        y: (el.clientHeight - stageHeight) / 2,
      })
    } else {
      setPan({ x: 0, y: 0 })
    }
  }, [stageWidth, stageHeight])

  // ── Wheel nativo: bloquea scroll de página sobre el canvas (sin zoom) ──
  useEffect(() => {
    const el = canvasWrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); e.stopPropagation() }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  // Pan con mouse (espacio + arrastrar, o panMode activo)
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (panMode || e.altKey) {
      isPanning.current = true
      panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
    }
  }, [pan, panMode])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current || e.buttons !== 1) return
    const dx = (e.clientX - panStart.current.mx) / zoom
    const dy = (e.clientY - panStart.current.my) / zoom
    setPan(clampPan(panStart.current.px + dx, panStart.current.py + dy, zoom))
  }, [zoom, clampPan])

  const handleCanvasMouseUp = useCallback(() => {
    isPanning.current = false
  }, [])

  // ── Operaciones ───────────────────────────────────────────────────────

  // Ref que expone el mapa de walls más reciente sin crear dependencias de closure.
  // Se actualiza síncronamente dentro de cada setWalls para que eraseTerrain lo lea.
  const wallsRef = useRef<Map<string, MapWall>>(walls)

  const eraseTerrain = useCallback((x: number, y: number) => {
    const SIDES: MapWall["side"][] = ["N", "S", "E", "W"]
    // Al borrar (x,y): eliminar los edges de los vecinos que apuntan hacia (x,y)
    // (son los que causaron que (x,y) quedara marcada como wall).
    // Un edge "W en (x+1,y)" apunta hacia (x,y) — su vecino bloqueado es (x,y).
    const inboundEdges: Pick<MapWall, "x" | "y" | "side">[] = [
      { x, y: y - 1, side: "S" }, // vecino norte con pared S → bloquea (x,y)
      { x, y: y + 1, side: "N" }, // vecino sur con pared N → bloquea (x,y)
      { x: x - 1, y, side: "E" }, // vecino oeste con pared E → bloquea (x,y)
      { x: x + 1, y, side: "W" }, // vecino este con pared W → bloquea (x,y)
    ]
    // También borrar los edges propios de (x,y) (por si los tiene)
    const allEdgeKeys = [
      ...SIDES.map((s) => wallKey({ x, y, side: s })),
      ...inboundEdges.map((e) => wallKey(e)),
    ]
    const hasAny = allEdgeKeys.some((k) => wallsRef.current.has(k))
    let newWalls = wallsRef.current
    if (hasAny) {
      newWalls = new Map(wallsRef.current)
      allEdgeKeys.forEach((k) => newWalls.delete(k))
      wallsRef.current = newWalls
      setWalls(newWalls)
    }

    setCells((cur) => {
      const next = new Map(cur)
      const existing = next.get(cellKey(x, y))
      if (existing === "magic") {
        let ax = x, ay = y
        while (next.get(cellKey(ax - 1, ay)) === "magic") ax--
        while (next.get(cellKey(ax, ay - 1)) === "magic") ay--
        let sz = 1
        while (next.get(cellKey(ax + sz, ay)) === "magic" && next.get(cellKey(ax, ay + sz)) === "magic") sz++
        for (let dx = 0; dx < sz; dx++) for (let dy = 0; dy < sz; dy++) next.delete(cellKey(ax + dx, ay + dy))
      } else if (existing !== undefined) {
        next.delete(cellKey(x, y))
      }
      return next
    })
    setDirty(true)
  }, [])

  const setTerrain = useCallback((x: number, y: number, t: CellTerrain) => {
    const key = cellKey(x, y)
    setCells((cur) => {
      if (cur.get(key) === t) return cur
      const next = new Map(cur)
      next.set(key, t)
      return next
    })
    setDirty(true)
  }, [])

  const paintCell = useCallback((x: number, y: number) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return
    // La goma siempre actúa (borra celda + edges), independientemente del wallMode
    if (brush === "normal") { eraseTerrain(x, y); return }
    if (isEdgeWall || brush === "magic") return
    setTerrain(x, y, brush as CellTerrain)
  }, [brush, cols, rows, isEdgeWall, eraseTerrain, setTerrain])

  const placeMagic = useCallback((x: number, y: number, c: Map<string, CellTerrain>, w: Map<string, MapWall>) => {
    const s = magicSize
    if (cols < s || rows < s) { setError(`La grilla debe ser al menos ${s}×${s}`); return }
    const ax = Math.max(0, Math.min(x, cols - s))
    const ay = Math.max(0, Math.min(y, rows - s))
    pushHistory(c, w)
    setCells((cur) => {
      const next = new Map(cur)
      for (let dx = 0; dx < s; dx++) for (let dy = 0; dy < s; dy++) next.set(cellKey(ax + dx, ay + dy), "magic")
      return next
    })
    setError(null)
    setDirty(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, rows, magicSize])

  const paintWall = useCallback((snap: Pick<MapWall, "x" | "y" | "side">) => {
    const key = wallKey(snap)
    const SIDES: MapWall["side"][] = ["N", "S", "E", "W"]

    // La celda bloqueada es la propia celda dueña del edge.
    // Ej: pared N en (x,y) → borde superior de (x,y), grosor hacia adentro → bloquea (x,y).
    const blockedCell: { x: number; y: number } = { x: snap.x, y: snap.y }

    const inBoundsCell = (c: { x: number; y: number }) =>
      c.x >= 0 && c.y >= 0 && c.x < cols && c.y < rows

    // La clave de edge "espejo": el mismo borde visto desde la celda bloqueada.
    // Ej: si la pared es W en (x,y), el espejo es E en (x-1,y).
    const mirrorSnap: Pick<MapWall, "x" | "y" | "side"> = {
      x: blockedCell.x,
      y: blockedCell.y,
      side: snap.side === "N" ? "S" : snap.side === "S" ? "N" : snap.side === "E" ? "W" : "E",
    }

    // Una celda bloqueada deja de serlo cuando no tiene ningún edge (propio o espejo) apuntándola.
    function shouldStillBeWall(c: { x: number; y: number }, wallMap: Map<string, MapWall>): boolean {
      // Edges propios de la celda
      if (SIDES.some((s) => wallMap.has(wallKey({ x: c.x, y: c.y, side: s })))) return true
      // Edges de vecinos que apuntan hacia esta celda (edges espejo entrantes)
      const inbound: Pick<MapWall, "x" | "y" | "side">[] = [
        { x: c.x, y: c.y - 1, side: "S" },
        { x: c.x, y: c.y + 1, side: "N" },
        { x: c.x - 1, y: c.y, side: "E" },
        { x: c.x + 1, y: c.y, side: "W" },
      ]
      return inbound.some((e) => wallMap.has(wallKey(e)))
    }

    if (wallMode === "edge-eraser") {
      if (!wallsRef.current.has(key)) return
      const nW = new Map(wallsRef.current)
      nW.delete(key)
      const mk = wallKey(mirrorSnap)
      if (nW.has(mk)) nW.delete(mk)
      wallsRef.current = nW
      setWalls(nW)
      if (inBoundsCell(blockedCell)) {
        const ck = cellKey(blockedCell.x, blockedCell.y)
        setCells((curC) => {
          if (curC.get(ck) !== "wall") return curC
          if (shouldStillBeWall(blockedCell, nW)) return curC
          const nC = new Map(curC)
          nC.delete(ck)
          return nC
        })
      }
    } else if (wallMode === "edge") {
      const ex = wallsRef.current.get(key)
      if (ex && ex.thickness === wallThickness) return
      const nW = new Map(wallsRef.current)
      nW.set(key, { ...snap, thickness: wallThickness })
      wallsRef.current = nW
      setWalls(nW)
      if (inBoundsCell(blockedCell)) {
        const ck = cellKey(blockedCell.x, blockedCell.y)
        setCells((curC) => {
          if (curC.get(ck) === "wall") return curC
          const nC = new Map(curC)
          nC.set(ck, "wall")
          return nC
        })
      }
    }
    setDirty(true)
  }, [wallMode, wallThickness, cols, rows])

  // ── Menú contextual ───────────────────────────────────────────────────

  function openCtxMenu(e: React.MouseEvent, stage: Konva.Stage | null) {
    e.preventDefault()
    const pos = stage?.getPointerPosition()
    if (!pos) return
    const cx = Math.floor(pos.x / cell)
    const cy = Math.floor(pos.y / cell)
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return
    const terrain = cells.get(cellKey(cx, cy)) ?? null
    setCtxMenu({ screenX: e.clientX, screenY: e.clientY, cellX: cx, cellY: cy, terrain })
  }

  // ── Eventos Stage ────────────────────────────────────────────────────

  function getPointer(stage: Konva.Stage | null) {
    const pos = stage?.getPointerPosition()
    return pos ? pos : null
  }

  function handleDown(e: Parameters<NonNullable<Parameters<typeof Stage>[0]["onMouseDown"]>>[0]) {
    if (e.evt.button === 2) return  // clic derecho → ctx menu
    const pos = getPointer(e.target.getStage())
    if (!pos) return
    const cx = Math.floor(pos.x / cell)
    const cy = Math.floor(pos.y / cell)

    if (brush === "room") {
      isDrawingRoom.current = true
      roomStart.current = { x: cx, y: cy }
      setRoomDraft({ x0: cx, y0: cy, x1: cx, y1: cy })
      return
    }

    if (brush === "select") {
      isSelecting.current = true
      selStart.current = { x: cx, y: cy }
      setSelection({ x0: cx, y0: cy, x1: cx, y1: cy })
      return
    }

    // Primer toque del gesto: empujar al historial
    pushHistory(cells, walls)
    painting.current = true

    if (isEdgeWall) {
      const snap = snapForAxis(detectWallSnap(pos.x, pos.y, cell, cols, rows), wallAxis)
      if (snap) {
        wallLineStart.current = { cx: snap.x, cy: snap.y, side: snap.side }
        setWallLineDraft({ sx: snap.x, sy: snap.y, tx: snap.x, ty: snap.y, side: snap.side })
      }
    } else if (brush === "magic") {
      // placeMagic ya empujará su propio historial; cancelamos el que acabamos de empujar
      historyPast.current.pop()
      placeMagic(cx, cy, cells, walls)
    } else {
      paintCell(cx, cy)
    }
  }

  function handleMove(e: Parameters<NonNullable<Parameters<typeof Stage>[0]["onMouseMove"]>>[0]) {
    const pos = getPointer(e.target.getStage())
    if (!pos) return
    const cx = Math.floor(pos.x / cell)
    const cy = Math.floor(pos.y / cell)

    if (isDrawingRoom.current && roomStart.current) {
      setRoomDraft({ x0: roomStart.current.x, y0: roomStart.current.y, x1: cx, y1: cy })
      return
    }

    if (isSelecting.current && selStart.current) {
      setSelection({ x0: selStart.current.x, y0: selStart.current.y, x1: cx, y1: cy })
      return
    }

    if (isEdgeWall) {
      const snap = snapForAxis(detectWallSnap(pos.x, pos.y, cell, cols, rows), wallAxis)
      if (painting.current && wallLineStart.current) {
        const { cx: sx, cy: sy, side } = wallLineStart.current
        const tx = (side === "N" || side === "S") ? sx : cx
        const ty = (side === "N" || side === "S") ? cy : sy
        setWallLineDraft({ sx, sy, tx, ty, side })
        setWallHover(null)
      } else {
        setWallHover(snap)
      }
    } else {
      setWallHover(null)
      if (painting.current && brush !== "magic") {
        paintCell(cx, cy)
      }
    }
  }

  function handleUp() {
    painting.current = false
    isSelecting.current = false
    // Confirmar línea de paredes al soltar
    if (wallLineStart.current && wallLineDraft) {
      const { sx, sy, tx, ty, side } = wallLineDraft
      pushHistory(cells, walls)

      // Construir lista de snaps de la línea
      const lineSnaps: Pick<MapWall, "x" | "y" | "side">[] = []
      if (side === "N" || side === "S") {
        const minY = Math.min(sy, ty); const maxY = Math.max(sy, ty)
        for (let r = minY; r <= maxY; r++) lineSnaps.push({ x: sx, y: r, side })
      } else {
        const minX = Math.min(sx, tx); const maxX = Math.max(sx, tx)
        for (let c = minX; c <= maxX; c++) lineSnaps.push({ x: c, y: sy, side })
      }

      // La celda bloqueada es siempre la celda dueña del edge
      function blockedFor(s: Pick<MapWall, "x" | "y" | "side">) {
        return { x: s.x, y: s.y }
      }

      const nW = new Map(wallsRef.current)
      for (const s of lineSnaps) {
        const w = { ...s, thickness: wallThickness }
        if (wallMode === "edge-eraser") nW.delete(wallKey(s)); else nW.set(wallKey(s), w)
      }
      wallsRef.current = nW
      setWalls(nW)

      setCells((curC) => {
        const nC = new Map(curC)
        for (const s of lineSnaps) {
          const bc = blockedFor(s)
          if (bc.x < 0 || bc.y < 0 || bc.x >= cols || bc.y >= rows) continue
          const ck = cellKey(bc.x, bc.y)
          if (wallMode === "edge-eraser") {
            // Solo quitar wall si ya no hay ningún edge apuntando a esa celda
            const hasAny = ["N","S","E","W"].some((sd) => nW.has(wallKey({ x: bc.x, y: bc.y, side: sd as MapWall["side"] })))
              || [{ x: bc.x, y: bc.y-1, side:"S" }, { x: bc.x, y: bc.y+1, side:"N" },
                  { x: bc.x-1, y: bc.y, side:"E" }, { x: bc.x+1, y: bc.y, side:"W" }]
                  .some((e) => nW.has(wallKey(e as Pick<MapWall,"x"|"y"|"side">)))
            if (!hasAny) nC.delete(ck)
          } else {
            nC.set(ck, "wall")
          }
        }
        return nC
      })

      setDirty(true)
    }
    wallLineStart.current = null
    setWallLineDraft(null)
    if (isDrawingRoom.current && roomDraft) {
      isDrawingRoom.current = false
      const minX = Math.min(roomDraft.x0, roomDraft.x1)
      const minY = Math.min(roomDraft.y0, roomDraft.y1)
      const maxX = Math.max(roomDraft.x0, roomDraft.x1)
      const maxY = Math.max(roomDraft.y0, roomDraft.y1)
      pushHistory(cells, walls)
      const nW = new Map(wallsRef.current)
      const roomWallSnaps: Pick<MapWall, "x"|"y"|"side">[] = []
      for (let x = minX; x <= maxX; x++) {
        roomWallSnaps.push({ x, y: minY, side: "N" })
        roomWallSnaps.push({ x, y: maxY, side: "S" })
      }
      for (let y = minY; y <= maxY; y++) {
        roomWallSnaps.push({ x: minX, y, side: "W" })
        roomWallSnaps.push({ x: maxX, y, side: "E" })
      }
      for (const s of roomWallSnaps) nW.set(wallKey(s), { ...s, thickness: wallThickness })
      wallsRef.current = nW
      setWalls(nW)
      setCells((curC) => {
        const nC = new Map(curC)
        for (const s of roomWallSnaps) {
          if (s.x >= 0 && s.y >= 0 && s.x < cols && s.y < rows) nC.set(cellKey(s.x, s.y), "wall")
        }
        return nC
      })
      setRoomDraft(null)
      setDirty(true)
      return
    }
    isDrawingRoom.current = false
  }

  // ── Guardar ──────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true); setError(null)
    const cp: MapCell[] = [...cells.entries()]
      .map(([k, t]) => { const [x, y] = k.split(",").map(Number); return { x, y, t } })
      .filter(({ x, y }) => x < cols && y < rows)
    const wp: MapWall[] = [...walls.values()].filter((w) => w.x >= 0 && w.y >= 0 && w.x < cols && w.y < rows)

    if (!cp.some((c) => c.t === "deployA") || !cp.some((c) => c.t === "deployB")) {
      setError("El mapa necesita las dos zonas de despliegue (A y B)"); setSaving(false); return
    }
    const tc = cp.filter((c) => c.t === "treasure").length
    if (tc < 6) { setError(`El mapa necesita al menos 6 tesoros (hay ${tc})`); setSaving(false); return }

    try {
      await api.maps.update(map.id, { cols, rows, cells: cp, walls: wp })
      setDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar")
    } finally { setSaving(false) }
  }

  // ── Perímetro ─────────────────────────────────────────────────────────

  function placePerimeter() {
    pushHistory(cells, walls)
    const perimSnaps: Pick<MapWall, "x"|"y"|"side">[] = []
    for (let x = 0; x < cols; x++) {
      perimSnaps.push({ x, y: 0, side: "N" })
      perimSnaps.push({ x, y: rows - 1, side: "S" })
    }
    for (let y = 0; y < rows; y++) {
      perimSnaps.push({ x: 0, y, side: "W" })
      perimSnaps.push({ x: cols - 1, y, side: "E" })
    }
    const nW = new Map(wallsRef.current)
    for (const s of perimSnaps) nW.set(wallKey(s), { ...s, thickness: wallThickness })
    wallsRef.current = nW
    setWalls(nW)
    setCells((curC) => {
      const nC = new Map(curC)
      for (const s of perimSnaps) {
        if (s.x >= 0 && s.y >= 0 && s.x < cols && s.y < rows) nC.set(cellKey(s.x, s.y), "wall")
      }
      return nC
    })
    setDirty(true)
  }

  // ── Conteos ──────────────────────────────────────────────────────────

  const inBounds = useCallback((k: string) => {
    const [x, y] = k.split(",").map(Number); return x < cols && y < rows
  }, [cols, rows])

  const paintedCount   = useMemo(() => [...cells.keys()].filter(inBounds).length, [cells, inBounds])
  const blockedCount   = useMemo(() => [...cells.entries()].filter(([k, t]) => inBounds(k) && t === "wall").length, [cells, inBounds])
  const wallCount      = useMemo(() => [...walls.values()].filter((w) => w.x < cols && w.y < rows).length, [walls, cols, rows])
  const treasureCount = useMemo(() => [...cells.entries()].filter(([k, t]) => inBounds(k) && t === "treasure").length, [cells, inBounds])
  const hasA          = useMemo(() => [...cells.values()].includes("deployA"), [cells])
  const hasB          = useMemo(() => [...cells.values()].includes("deployB"), [cells])

  const gridLines = useMemo(() => {
    const lines: number[][] = []
    for (let x = 0; x <= cols; x++) lines.push([x * cell, 0, x * cell, stageHeight])
    for (let y = 0; y <= rows; y++) lines.push([0, y * cell, stageWidth, y * cell])
    return lines
  }, [cols, rows, cell, stageWidth, stageHeight])

  const wallsArray  = useMemo(() => [...walls.values()], [walls])
  const cellsArray  = useMemo(() =>
    [...cells.entries()].map(([k, t]) => { const [x, y] = k.split(",").map(Number); return { x, y, t } as const }),
    [cells])
  const hoverWalls: MapWall[] = wallHover
    ? [{ ...wallHover, thickness: wallMode === "edge-eraser" ? (walls.get(wallKey(wallHover))?.thickness ?? wallThickness) : wallThickness }]
    : []

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <section
      className="fixed inset-x-0 bottom-0 flex flex-col gap-3 bg-background p-4"
      style={{ top: "57px" }}
      onClick={() => setCtxMenu(null)}
    >

      {/* Topbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleBack}>
            <ArrowLeft className="size-4" /> Mapas
          </Button>
          <h2 className="font-heading text-xl font-semibold">{map.name}</h2>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary">{cols}×{rows}</Badge>
            <Badge variant="outline">{paintedCount} celdas</Badge>
            {wallCount > 0 && <Badge variant="outline">{wallCount} paredes</Badge>}
            {blockedCount > 0 && <Badge variant="outline" className="bg-zinc-700/60 text-zinc-200 border-zinc-500">{blockedCount} bloqueadas</Badge>}
            <Badge variant={treasureCount >= 6 ? "outline" : "destructive"}>{treasureCount}/6 ☆</Badge>
            <Badge variant={hasA ? "outline" : "destructive"}>A {hasA ? "✓" : "✗"}</Badge>
            <Badge variant={hasB ? "outline" : "destructive"}>B {hasB ? "✓" : "✗"}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5">
            <Button variant="ghost" size="icon" className="size-7"
              title="Deshacer (Ctrl+Z)" disabled={historyState.past === 0}
              onClick={undo}>
              <Undo2 className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7"
              title="Rehacer (Ctrl+Y)" disabled={historyState.future === 0}
              onClick={redo}>
              <Redo2 className="size-3.5" />
            </Button>
          </div>
          {/* Copy / Cut / Paste */}
          <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5">
            <Button variant="ghost" size="icon" className="size-7"
              title="Copiar selección (Ctrl+C)" disabled={!selection}
              onClick={copySelection}>
              <Copy className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7"
              title="Cortar selección (Ctrl+X)" disabled={!selection}
              onClick={cutSelection}>
              <Scissors className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7"
              title="Pegar (Ctrl+V)" disabled={!clipboard}
              onClick={pasteSelection}>
              <Clipboard className="size-3.5" />
            </Button>
          </div>
          <div className="w-px h-5 bg-border" />
          {dirty && <span className="text-muted-foreground text-sm">Sin guardar</span>}
          <Button onClick={() => void handleSave()} disabled={saving || !dirty}>
            <Save className="size-4" /> {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      <AlertBanner message={error} onDismiss={() => setError(null)} />

      {/* Diálogos de confirmación */}
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="¿Salir sin guardar?"
        description="Tienes cambios sin guardar. Si sales ahora se perderán."
        confirmLabel="Salir sin guardar"
        cancelLabel="Quedarme"
        variant="destructive"
        onConfirm={() => navigate("/admin/maps")}
      />
      <ConfirmDialog
        open={confirmClearAll} onOpenChange={setConfirmClearAll}
        title="¿Vaciar todo el mapa?"
        description="Se borrarán todas las celdas y paredes. Esta acción se puede deshacer con Ctrl+Z."
        confirmLabel="Vaciar" cancelLabel="Cancelar"
        onConfirm={() => { pushHistory(cells, walls); setCells(new Map()); setWalls(new Map()); setDirty(true) }}
      />
      <ConfirmDialog
        open={confirmClearWalls} onOpenChange={setConfirmClearWalls}
        title="¿Borrar todas las paredes?"
        description="Se eliminarán todas las paredes de borde del mapa. Esta acción se puede deshacer con Ctrl+Z."
        confirmLabel="Borrar paredes" cancelLabel="Cancelar"
        onConfirm={() => {
          pushHistory(cells, walls)
          const nW = new Map<string, MapWall>()
          wallsRef.current = nW
          setWalls(nW)
          setCells((cur) => {
            const nC = new Map(cur)
            for (const [k, t] of cur) { if (t === "wall") nC.delete(k) }
            return nC
          })
          setDirty(true)
        }}
      />

      {/* Área principal: toolbar | canvas (el panel derecho flota sobre el canvas) */}
      <div className="flex gap-0 flex-1 min-h-0 relative">

        {/* ── Toolbar izquierda (plegable) ── */}
        <div className={cn(
          "flex flex-col bg-card border border-border border-r-0 rounded-l-xl overflow-hidden shrink-0 transition-all duration-200",
          toolbarOpen ? "w-36" : "w-12",
        )}>
          {/* Botón plegar/desplegar */}
          <button
            onClick={() => setToolbarOpen((v) => !v)}
            className="flex items-center justify-center h-8 border-b border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
            title={toolbarOpen ? "Contraer panel" : "Expandir panel"}
          >
            {toolbarOpen
              ? <ChevronLeft className="size-3.5" />
              : <ChevronRight className="size-3.5" />}
          </button>

          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {TOOL_GROUPS.map((group, gi) => (
              <div key={gi}>
                {/* Separador de grupo */}
                {gi > 0 && <div className="h-px bg-border" />}

                {/* Cabecera de grupo */}
                <div className={cn(
                  "px-3 pt-3 pb-1",
                  toolbarOpen ? "block" : "hidden",
                )}>
                  <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-[0.15em] block">
                    {group.label}
                  </span>
                </div>
                {!toolbarOpen && gi > 0 && <div className="h-2" />}

                {group.tools.map((tool) => {
                  const key = `${group.label}/${tool.brush}`
                  const isActive = activeKey === key
                  return (
                    <button
                      key={key}
                      title={`${tool.label} — ${tool.hint}`}
                      onClick={() => activateTool(tool.brush, group.label)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors relative group",
                        toolbarOpen ? "justify-start" : "justify-center",
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      {/* Pastilla de color — borde izquierdo */}
                      <span
                        className="absolute left-0 top-1 bottom-1 w-0.75 rounded-r-full transition-opacity"
                        style={{
                          background: tool.swatch === "transparent" ? "transparent" : tool.swatch,
                          opacity: isActive ? 1 : 0.5,
                        }}
                      />
                      <span className="shrink-0">{tool.icon}</span>
                      {toolbarOpen && (
                        <span className="text-xs font-medium leading-none truncate">{tool.label}</span>
                      )}
                      {/* Tooltip cuando está contraído */}
                      {!toolbarOpen && (
                        <span className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md bg-popover border border-border px-2 py-1 text-xs shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="font-semibold">{tool.label}</span>
                          <span className="text-muted-foreground block text-[10px]">{tool.hint}</span>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Apariencia de grilla — solo cuando toolbar está abierto */}
          {toolbarOpen && (
            <div className="border-t border-border shrink-0 px-3 py-3 space-y-2">
              <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-[0.15em] block">
                Apariencia
              </span>
              <div className="space-y-1.5">
                <span className="text-[10px] text-muted-foreground block">Grilla</span>
                <div className="flex gap-1 flex-wrap">
                  {GRID_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      title={p.label}
                      onClick={() => setGridColor(p.value)}
                      className={cn(
                        "size-5 rounded border transition-all",
                        gridColor === p.value ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50",
                      )}
                      style={{ background: p.value === "rgba(0,0,0,0)" ? "repeating-conic-gradient(#444 0% 25%, #222 0% 50%) 0/6px 6px" : p.value }}
                    />
                  ))}
                  <input type="color"
                    title="Color personalizado de grilla"
                    value={gridColor.startsWith("rgba") ? "#ffffff" : gridColor}
                    onChange={(e) => setGridColor(e.target.value)}
                    className="size-5 cursor-pointer rounded border border-border bg-transparent p-0" />
                </div>
              </div>
            </div>
          )}

          {/* Botón limpiar al pie */}
          <div className="border-t border-border shrink-0">
            <button
              title="Limpiar todo el mapa"
              onClick={() => {
                if (cells.size === 0 && walls.size === 0) return
                setConfirmClearAll(true)
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
                toolbarOpen ? "justify-start" : "justify-center",
              )}
            >
              <Trash2 className="size-4 shrink-0" />
              {toolbarOpen && <span className="text-xs font-medium">Limpiar todo</span>}
            </button>
          </div>
        </div>

        {/* ── Canvas ── */}
        <div
          ref={canvasWrapRef}
          className="flex-1 bg-zinc-950 border border-border overflow-hidden relative select-none"
          style={{ cursor: panMode ? (isPanning.current ? "grabbing" : "grab") : brush === "select" ? "default" : "crosshair" }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onContextMenu={(e) => { if (!panMode) openCtxMenu(e, stageRef.current) }}
        >
          {/* Stage con transform CSS — misma técnica que GameBoard */}
          <div
            style={{
              position: "absolute",
              top: 0, left: 0,
              transformOrigin: "0 0",
              transform: `translate(${pan.x * zoom}px, ${pan.y * zoom}px) scale(${zoom})`,
              width: stageWidth,
              height: stageHeight,
            }}
          >
            <Stage
              ref={stageRef}
              width={stageWidth} height={stageHeight}
              style={{ display: "block" }}
              onMouseDown={(e) => { if (!panMode) handleDown(e) }}
              onMouseMove={(e) => { if (!panMode) handleMove(e) }}
              onMouseUp={handleUp}
              onMouseLeave={() => { painting.current = false; setWallHover(null) }}
              onTouchStart={(e) => {
                painting.current = true
                const pos = e.target.getStage()?.getPointerPosition()
                if (!pos) return
                if (isEdgeWall) { const s = detectWallSnap(pos.x, pos.y, cell, cols, rows); if (s) paintWall(s) }
                else if (brush === "magic") placeMagic(Math.floor(pos.x / cell), Math.floor(pos.y / cell), cells, walls)
                else paintCell(Math.floor(pos.x / cell), Math.floor(pos.y / cell))
              }}
              onTouchMove={(e) => {
                const pos = e.target.getStage()?.getPointerPosition()
                if (!pos || !painting.current) return
                if (isEdgeWall) { const s = detectWallSnap(pos.x, pos.y, cell, cols, rows); if (s) paintWall(s) }
                else if (brush !== "magic") paintCell(Math.floor(pos.x / cell), Math.floor(pos.y / cell))
              }}
              onTouchEnd={handleUp}
            >
              <Layer listening={false}>
                {image
                  ? <KonvaImage image={image} width={stageWidth} height={stageHeight} />
                  : <Rect width={stageWidth} height={stageHeight} fill="#18181b" />
                }
                <TerrainLayer
                  cells={showWallCells ? cellsArray.filter((c) => c.t !== "wall") : cellsArray}
                  cols={cols} rows={rows} cell={cell}
                  spriteVariants={spriteVariants} terrainColors={terrainColors} />
                {/* Overlay de celdas bloqueadas — visible sobre cualquier fondo */}
                {showWallCells && Array.from(cells.entries())
                  .filter(([, t]) => t === "wall")
                  .map(([k]) => {
                    const [cx, cy] = k.split(",").map(Number)
                    return (
                      <Rect
                        key={`wc-${k}`}
                        x={cx * cell} y={cy * cell}
                        width={cell} height={cell}
                        fill="rgba(0,0,0,0.55)"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth={1}
                        listening={false}
                      />
                    )
                  })
                }
                {gridLines.map((pts, i) => (
                  <Line key={i} points={pts} stroke={gridColor} strokeWidth={0.5} />
                ))}
                <WallLayer walls={wallsArray} cols={cols} rows={rows} cell={cell} fill={wallFill} />
                {wallHover && (
                  <WallLayer walls={hoverWalls} cols={cols} rows={rows} cell={cell}
                    fill={wallMode === "edge-eraser" ? "rgba(239,68,68,0.75)" : "rgba(255,255,255,0.55)"} />
                )}
                {selection && (() => {
                  const minX = Math.min(selection.x0, selection.x1)
                  const minY = Math.min(selection.y0, selection.y1)
                  const maxX = Math.max(selection.x0, selection.x1)
                  const maxY = Math.max(selection.y0, selection.y1)
                  return (
                    <Rect
                      x={minX * cell} y={minY * cell}
                      width={(maxX - minX + 1) * cell} height={(maxY - minY + 1) * cell}
                      fill="rgba(96,165,250,0.12)"
                      stroke="#60a5fa" strokeWidth={2}
                      dash={[6, 3]} listening={false}
                    />
                  )
                })()}
                {wallLineDraft && (() => {
                  const { sx, sy, tx, ty, side } = wallLineDraft
                  const draftWalls: MapWall[] = []
                  if (side === "N" || side === "S") {
                    const minY = Math.min(sy, ty); const maxY = Math.max(sy, ty)
                    for (let r = minY; r <= maxY; r++) draftWalls.push({ x: sx, y: r, side, thickness: wallThickness })
                  } else {
                    const minX = Math.min(sx, tx); const maxX = Math.max(sx, tx)
                    for (let c = minX; c <= maxX; c++) draftWalls.push({ x: c, y: sy, side, thickness: wallThickness })
                  }
                  return (
                    <WallLayer walls={draftWalls} cols={cols} rows={rows} cell={cell}
                      fill={wallMode === "edge-eraser" ? "rgba(239,68,68,0.75)" : "rgba(251,146,60,0.85)"} />
                  )
                })()}
                {roomDraft && (() => {
                  const minX = Math.min(roomDraft.x0, roomDraft.x1)
                  const minY = Math.min(roomDraft.y0, roomDraft.y1)
                  const maxX = Math.max(roomDraft.x0, roomDraft.x1)
                  const maxY = Math.max(roomDraft.y0, roomDraft.y1)
                  return (
                    <Rect
                      x={minX * cell} y={minY * cell}
                      width={(maxX - minX + 1) * cell} height={(maxY - minY + 1) * cell}
                      fill="rgba(251,146,60,0.08)"
                      stroke="#fb923c" strokeWidth={2}
                      dash={[6, 3]} listening={false}
                    />
                  )
                })()}
              </Layer>
            </Stage>
          </div>

          {/* Controles de zoom — esquina inferior izquierda (libre del panel flotante) */}
          <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-1">
            <button
              title="Acercar (+)"
              disabled={zoom >= ZOOM_MAX}
              onClick={() => applyZoom(zoom + ZOOM_STEP)}
              className="size-7 flex items-center justify-center rounded-md bg-black/50 border border-white/20 backdrop-blur text-white/80 hover:bg-black/70 disabled:opacity-30 transition-colors"
            >
              <Plus className="size-3.5" />
            </button>
            <button
              title={`${Math.round(zoom * 100)}% — clic para restablecer`}
              onClick={resetView}
              className="h-7 px-1.5 flex items-center justify-center rounded-md bg-black/50 border border-white/20 backdrop-blur text-white/80 hover:bg-black/70 transition-colors text-[11px] font-mono tabular-nums"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              title="Alejar (−)"
              disabled={zoom <= ZOOM_MIN}
              onClick={() => applyZoom(zoom - ZOOM_STEP)}
              className="size-7 flex items-center justify-center rounded-md bg-black/50 border border-white/20 backdrop-blur text-white/80 hover:bg-black/70 disabled:opacity-30 transition-colors"
            >
              <Minus className="size-3.5" />
            </button>
            <div className="h-px bg-white/15 my-0.5" />
            <button
              title="Restablecer vista"
              onClick={resetView}
              className="size-7 flex items-center justify-center rounded-md bg-black/50 border border-white/20 backdrop-blur text-white/80 hover:bg-black/70 transition-colors"
            >
              <RotateCcw className="size-3.5" />
            </button>
            <button
              title={panMode ? "Desactivar modo pan (Alt+arrastrar siempre disponible)" : "Activar modo pan"}
              onClick={() => setPanMode((v) => !v)}
              className={cn(
                "size-7 flex items-center justify-center rounded-md border backdrop-blur transition-colors",
                panMode
                  ? "bg-primary/70 border-primary text-white"
                  : "bg-black/50 border-white/20 text-white/80 hover:bg-black/70",
              )}
            >
              {panMode ? <Hand className="size-3.5" /> : <MousePointer2 className="size-3.5" />}
            </button>
          </div>

          {/* Indicador de zoom cuando no es 100% */}
          {zoom !== 1 && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <span className="bg-black/50 border border-white/15 backdrop-blur rounded px-2 py-0.5 text-[10px] text-white/60 font-mono">
                {Math.round(zoom * 100)}% · Alt+arrastrar para pan
              </span>
            </div>
          )}

        </div>

        {/* ── Panel de propiedades derecho ── */}
        <div className="shrink-0 flex self-stretch">
          <PropertiesPanel
            open={propertiesOpen} onToggle={() => setPropertiesOpen((v) => !v)}
            activeKey={activeKey}
            brush={brush}
            wallMode={wallMode}
            wallAxis={wallAxis} setWallAxis={setWallAxis}
            magicSize={magicSize}
            setMagicSize={setMagicSize}
            wallThickness={wallThickness}
            setWallThickness={setWallThickness}
            wallCount={wallCount}
            onDeleteWalls={() => setConfirmClearWalls(true)}
            cols={cols} rows={rows}
            onCols={(v) => { setCols(v); setDirty(true) }}
            onRows={(v) => { setRows(v); setDirty(true) }}
            wallFill={wallFill} setWallFill={setWallFill}
            spriteVariants={spriteVariants} setSpriteVariants={setSpriteVariants}
            terrainColors={terrainColors} setTerrainColor={setTerrainColor}
            onPlacePerimeter={placePerimeter}
            showWallCells={showWallCells} setShowWallCells={setShowWallCells}
          />
        </div>

        {/* ── Menú contextual ── */}
        {ctxMenu && (
          <ContextMenu
            menu={ctxMenu}
            onClose={() => setCtxMenu(null)}
            onSetTerrain={(t) => { pushHistory(cells, walls); setTerrain(ctxMenu.cellX, ctxMenu.cellY, t); setCtxMenu(null) }}
            onErase={() => { pushHistory(cells, walls); eraseTerrain(ctxMenu.cellX, ctxMenu.cellY); setCtxMenu(null) }}
            onActivateBrush={(b, g) => { activateTool(b, g); setCtxMenu(null) }}
            onAddWall={(x, y, side) => {
              pushHistory(cells, walls)
              const w: MapWall = { x, y, side, thickness: wallThickness }
              setWalls((cur) => { const n = new Map(cur); n.set(wallKey(w), w); return n })
              setDirty(true)
            }}
          />
        )}
      </div>
    </section>
  )
}

// ── Menú contextual ───────────────────────────────────────────────────────

function ContextMenu({
  menu, onClose, onSetTerrain, onErase, onActivateBrush, onAddWall,
}: {
  menu: CtxMenu
  onClose: () => void
  onSetTerrain: (t: CellTerrain) => void
  onErase: () => void
  onActivateBrush: (b: Brush, g: string) => void
  onAddWall: (x: number, y: number, side: MapWall["side"]) => void
}) {
  const current = menu.terrain
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Posicionar para no salirse de pantalla
  const style: React.CSSProperties = {
    position: "fixed",
    left: menu.screenX,
    top: menu.screenY,
    zIndex: 9999,
  }

  const terrainItems: { t: CellTerrain; label: string; color: string }[] = [
    { t: "difficult",  label: "Difícil",   color: "rgba(59,130,246,0.6)" },
    { t: "hazardous",  label: "Peligroso",  color: "rgba(239,68,68,0.6)" },
    { t: "obstacle",   label: "Obstáculo",  color: "rgba(139,92,246,0.6)" },
    { t: "magic",      label: "Círculo",    color: "rgba(34,211,238,0.5)" },
    { t: "treasure",   label: "Tesoro",     color: "rgba(234,179,8,0.75)" },
    { t: "deployA",    label: "Zona A",     color: "rgba(34,197,94,0.6)" },
    { t: "deployB",    label: "Zona B",     color: "rgba(59,130,246,0.6)" },
  ]

  return (
    <div
      ref={ref}
      style={style}
      onClick={(e) => e.stopPropagation()}
      className="min-w-45 rounded-lg border border-border bg-popover shadow-xl text-sm overflow-hidden"
    >
      {/* Cabecera */}
      <div className="px-3 py-1.5 border-b border-border bg-muted/30">
        <p className="text-[11px] font-semibold text-muted-foreground">
          Celda ({menu.cellX}, {menu.cellY})
          {current && <span className="ml-1 text-foreground">· {current}</span>}
        </p>
      </div>

      {/* Acciones de celda */}
      <div className="p-1">
        {current && (
          <button
            onClick={onErase}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-destructive/10 hover:text-destructive text-left transition-colors"
          >
            <Eraser className="size-3.5 shrink-0" />
            <span>Borrar terreno</span>
          </button>
        )}

        <div className="h-px bg-border my-1" />
        <p className="text-[10px] text-muted-foreground px-2 mb-1 uppercase tracking-widest">Pintar celda</p>

        {terrainItems.map(({ t, label, color }) => (
          <button
            key={t}
            onClick={() => onSetTerrain(t)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-left transition-colors",
              current === t && "bg-primary/10 text-primary",
            )}
          >
            <span className="size-3 rounded-sm shrink-0" style={{ background: color }} />
            <span>{label}</span>
            {current === t && <span className="ml-auto text-primary text-xs">✓</span>}
          </button>
        ))}

        <div className="h-px bg-border my-1" />
        <p className="text-[10px] text-muted-foreground px-2 mb-1 uppercase tracking-widest">Paredes de borde</p>
        {(["N","S","E","W"] as MapWall["side"][]).map((side) => (
          <button key={side}
            onClick={() => { onAddWall(menu.cellX, menu.cellY, side); onClose() }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-left transition-colors"
          >
            <span className="size-3 rounded-sm shrink-0 bg-zinc-800 border border-zinc-600" />
            <span>Pared {side === "N" ? "Norte" : side === "S" ? "Sur" : side === "E" ? "Este" : "Oeste"}</span>
          </button>
        ))}

        <div className="h-px bg-border my-1" />
        <p className="text-[10px] text-muted-foreground px-2 mb-1 uppercase tracking-widest">Activar pincel</p>
        <button
          onClick={() => onActivateBrush("normal", "Terrenos")}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-left transition-colors"
        >
          <Eraser className="size-3.5 shrink-0 text-muted-foreground" />
          <span>Seleccionar Goma</span>
        </button>
      </div>
    </div>
  )
}

// ── Panel de propiedades ──────────────────────────────────────────────────

// Colores rápidos para la grilla
const GRID_PRESETS = [
  { label: "Blanco suave", value: "rgba(255,255,255,0.22)" },
  { label: "Azul táctico", value: "rgba(96,165,250,0.35)" },
  { label: "Verde militar", value: "rgba(74,222,128,0.3)" },
  { label: "Rojo alarma",  value: "rgba(248,113,113,0.35)" },
  { label: "Invisible",    value: "rgba(0,0,0,0)" },
]

const WALL_PRESETS = [
  { label: "Negro",    value: "#000000" },
  { label: "Gris",     value: "#52525b" },
  { label: "Marrón",  value: "#78350f" },
  { label: "Piedra",   value: "#4b5563" },
]

function PropertiesPanel({
  open, onToggle,
  activeKey, brush, wallMode, wallAxis, setWallAxis,
  magicSize, setMagicSize,
  wallThickness, setWallThickness,
  wallCount, onDeleteWalls,
  cols, rows, onCols, onRows,
  wallFill, setWallFill,
  spriteVariants, setSpriteVariants,
  terrainColors, setTerrainColor,
  onPlacePerimeter,
  showWallCells, setShowWallCells,
}: {
  open: boolean; onToggle: () => void
  activeKey: string
  brush: Brush
  wallMode: "cell" | "edge" | "edge-eraser"
  wallAxis: "free" | "H" | "V"; setWallAxis: (a: "free" | "H" | "V") => void
  magicSize: MagicBlockSize; setMagicSize: (s: MagicBlockSize) => void
  wallThickness: number; setWallThickness: (v: number) => void
  wallCount: number; onDeleteWalls: () => void
  cols: number; rows: number; onCols: (v: number) => void; onRows: (v: number) => void
  wallFill: string; setWallFill: (c: string) => void
  spriteVariants: Partial<Record<CellTerrain, 0 | 1 | 2>>
  setSpriteVariants: (fn: (prev: Partial<Record<CellTerrain, 0 | 1 | 2>>) => Partial<Record<CellTerrain, 0 | 1 | 2>>) => void
  terrainColors: Partial<Record<CellTerrain, string>>
  setTerrainColor: (t: CellTerrain, color: string) => void
  onPlacePerimeter: () => void
  showWallCells: boolean; setShowWallCells: (v: boolean) => void
}) {
  const tool = TOOL_BY_KEY[activeKey]
  const isEdge = wallMode === "edge" || wallMode === "edge-eraser"
  const variants = TERRAIN_VARIANTS[brush as CellTerrain]
  const currentVariant = spriteVariants[brush as CellTerrain] ?? 0

  return (
    <div className={cn(
      "flex flex-col bg-card border border-border border-l-0 rounded-r-xl overflow-hidden transition-all duration-200 h-full",
      open ? "w-52" : "w-12",
    )}>

      {/* Botón plegar/desplegar */}
      <button
        onClick={onToggle}
        title={open ? "Contraer opciones" : `Opciones — ${tool?.label ?? ""}`}
        className="flex items-center justify-center h-8 border-b border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
      >
        {open ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
      </button>

      {/* Icono de la herramienta activa cuando está contraído */}
      {!open && (
        <div className="flex-1 flex flex-col items-center gap-2 pt-3 overflow-hidden group/collapsed">
          <span
            title={`${tool?.label ?? "—"} — ${tool?.hint ?? ""}`}
            className="size-7 rounded flex items-center justify-center text-muted-foreground"
            style={{ background: tool?.swatch && tool.swatch !== "transparent" ? tool.swatch : "transparent",
                     border: "1px solid color-mix(in srgb, currentColor 15%, transparent)" }}
          >
            {tool?.icon}
          </span>
        </div>
      )}

      {open && <>
      {/* Cabecera: herramienta activa */}
      <div className="px-3 pt-3 pb-2.5 border-b border-border">
        <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1.5">Herramienta activa</p>
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 size-6 rounded flex items-center justify-center shrink-0 text-foreground"
            style={{ background: tool?.swatch && tool.swatch !== "transparent" ? tool.swatch : "transparent",
                     border: "1px solid color-mix(in srgb, currentColor 20%, transparent)" }}
          >
            {tool?.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">{tool?.label ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{tool?.hint}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* Variantes de sprite */}
        {variants && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Paintbrush className="size-3" /> Variante de diseño
            </Label>
            <div className="grid grid-cols-3 gap-1">
              {variants.map((name, i) => (
                <button
                  key={i}
                  onClick={() => setSpriteVariants((prev) => ({ ...prev, [brush]: i as 0 | 1 | 2 }))}
                  className={cn(
                    "rounded-md border py-1.5 text-[11px] font-medium transition-colors",
                    currentVariant === i
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Fija qué tipo de sprite se usa para este terreno. En el mapa cada celda toma una variante automáticamente según su posición.
            </p>
          </div>
        )}

        {/* Círculo mágico: tamaño */}
        {brush === "magic" && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tamaño del bloque</Label>
            <div className="flex gap-1">
              {MAGIC_BLOCK_SIZES.map((s) => (
                <Button key={s} type="button" size="sm" className="flex-1 h-8 text-xs"
                  variant={magicSize === s ? "default" : "outline"}
                  onClick={() => setMagicSize(s)}>
                  {s}×{s}
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">Un clic coloca el bloque. No arrastra.</p>
          </div>
        )}

        {/* Zonas de despliegue */}
        {(brush === "deployA" || brush === "deployB") && (
          <div className="rounded-lg border border-border p-2.5 bg-muted/20 space-y-1.5">
            <p className="text-xs font-semibold">Zona de forma libre</p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Arrastra para pintar cualquier forma. Usa la goma para corregir celdas individuales.
            </p>
          </div>
        )}

        {/* Muro relleno de celda */}
        {brush === "wall" && !isEdge && (
          <div className="rounded-lg border border-border p-2.5 bg-muted/20 space-y-1">
            <p className="text-xs font-semibold">Muro de celda completa</p>
            <p className="text-[11px] text-muted-foreground">
              Rellena la celda completa. Para paredes sobre bordes entre celdas, usa el grupo "Paredes".
            </p>
          </div>
        )}

        {/* Paredes de borde */}
        {isEdge && (
          <div className="space-y-3">
            {wallMode === "edge" && (
              <>
                {/* Eje de trazado */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Dirección</Label>
                  <div className="flex gap-1">
                    {(["free", "H", "V"] as const).map((a) => (
                      <button key={a}
                        onClick={() => setWallAxis(a)}
                        className={cn(
                          "flex-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors",
                          wallAxis === a
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50",
                        )}
                      >
                        {a === "free" ? "Libre" : a === "H" ? "━ Horiz." : "┃ Vert."}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Grosor</Label>
                    <span className="text-xs font-mono tabular-nums">{Math.round(wallThickness * 100)}%</span>
                  </div>
                  <Slider min={10} max={90} step={5}
                    value={[Math.round(wallThickness * 100)]}
                    onValueChange={([v]) => setWallThickness(v / 100)} />
                  <p className="text-[10px] text-muted-foreground">
                    Acerca el cursor al borde de una celda para ver el snap visual.
                  </p>
                </div>
                {/* Color de pared de borde */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Shield className="size-3" /> Color
                  </Label>
                  <div className="flex gap-1 flex-wrap">
                    {WALL_PRESETS.map((p) => (
                      <button key={p.value} title={p.label} onClick={() => setWallFill(p.value)}
                        className={cn("size-5 rounded border transition-all", wallFill === p.value ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50")}
                        style={{ background: p.value }} />
                    ))}
                    <input type="color" value={wallFill} title="Color personalizado"
                      onChange={(e) => setWallFill(e.target.value)}
                      className="size-5 cursor-pointer rounded border border-border bg-transparent p-0" />
                  </div>
                </div>
                {/* Switch: mostrar celdas sólidas */}
                <button
                  onClick={() => setShowWallCells(!showWallCells)}
                  className="flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full"
                  title="Mostrar/ocultar el overlay de celdas que quedarán bloqueadas por las paredes"
                >
                  <span className={cn(
                    "relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors",
                    showWallCells ? "bg-primary border-primary" : "bg-muted border-border",
                  )}>
                    <span className={cn(
                      "absolute top-0.5 size-3 rounded-full bg-white shadow transition-transform",
                      showWallCells ? "translate-x-3" : "translate-x-0.5",
                    )} />
                  </span>
                  Mostrar celdas bloqueadas
                </button>
                {/* Perímetro */}
                {activeKey !== "Paredes/room" && (
                  <Button variant="outline" size="sm" className="w-full text-xs gap-1.5" onClick={onPlacePerimeter}>
                    <Square className="size-3.5" /> Perímetro completo
                  </Button>
                )}
              </>
            )}
            {wallMode === "edge-eraser" && (
              <p className="text-[11px] text-muted-foreground">
                Clic sobre una pared existente para eliminarla.
              </p>
            )}
            {wallCount > 0 && (
              <Button variant="outline" size="sm"
                className="w-full text-xs text-destructive hover:text-destructive border-destructive/30"
                onClick={onDeleteWalls}>
                <Trash2 className="size-3.5" /> Borrar todas ({wallCount})
              </Button>
            )}
          </div>
        )}

        {/* Goma */}
        {brush === "normal" && (
          <p className="text-[11px] text-muted-foreground">
            Clic o arrastra para borrar. Sobre un bloque mágico, elimina el bloque entero.
          </p>
        )}

        {/* ── Color del terreno activo ── */}
        {(brush !== "normal" && brush !== "wall-eraser" && !isEdge) && (() => {
          const terrain = brush as CellTerrain
          const defaultColor = TERRAIN_FILL[terrain] ?? "#888"
          const currentColor = terrainColors[terrain] ?? defaultColor
          return (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Paintbrush className="size-3" /> Color del terreno
              </Label>
              <div className="flex items-center gap-2">
                <input type="color"
                  value={currentColor.startsWith("rgba") ? rgbaToHex(currentColor) : currentColor}
                  onChange={(e) => setTerrainColor(terrain, e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent" />
                <span className="text-[10px] text-muted-foreground font-mono flex-1 truncate">{currentColor}</span>
                {terrainColors[terrain] && (
                  <button
                    title="Restablecer color por defecto"
                    onClick={() => setTerrainColor(terrain, defaultColor)}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="size-3" />
                  </button>
                )}
              </div>
              <div className="h-3 rounded" style={{ background: currentColor }} />
            </div>
          )
        })()}

        {/* ── Color de paredes (muro celda completa) ── */}
        {brush === "wall" && !isEdge && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Shield className="size-3" /> Color del muro
            </Label>
            <div className="flex items-center gap-2">
              <input type="color"
                value={terrainColors["wall"] ?? rgbaToHex(TERRAIN_FILL["wall"])}
                onChange={(e) => setTerrainColor("wall", e.target.value)}
                className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent" />
              <span className="text-[10px] text-muted-foreground font-mono flex-1 truncate">{terrainColors["wall"] ?? TERRAIN_FILL["wall"]}</span>
              {terrainColors["wall"] && (
                <button title="Restablecer" onClick={() => setTerrainColor("wall", TERRAIN_FILL["wall"])}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  <RotateCcw className="size-3" />
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Tamaño de grilla — pie fijo */}
      <div className="border-t border-border px-3 py-2.5 space-y-2 shrink-0">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Grid2x2 className="size-3" /> Dimensiones
        </Label>
        <div className="flex items-center gap-1.5">
          <Input aria-label="Columnas" type="number" min={1} max={200} className="h-7 text-xs w-16 px-2"
            value={cols} onChange={(e) => onCols(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} />
          <span className="text-muted-foreground text-xs">×</span>
          <Input aria-label="Filas" type="number" min={1} max={200} className="h-7 text-xs w-16 px-2"
            value={rows} onChange={(e) => onRows(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">celdas</span>
        </div>
      </div>
      </>}
    </div>
  )
}

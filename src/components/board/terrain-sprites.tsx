import { Circle, Group, Image as KonvaImage, Line, Rect, Text } from "react-konva"
import { useImage } from "@/hooks/use-image"
import type { CellTerrain, MapCell, MapWall } from "@/lib/api"
import { MAGIC_CIRCLE_DATA_URI, TERRAIN_FILL } from "@/lib/terrain"

// ── Cofre ─────────────────────────────────────────────────────────────────

export function ChestSprite({ px, py, cell }: { px: number; py: number; cell: number }) {
  return (
    <Group x={px} y={py} listening={false}>
      <Rect x={cell * 0.14} y={cell * 0.34} width={cell * 0.72} height={cell * 0.46}
        fill="#8b5a2b" stroke="#4a2e12" strokeWidth={Math.max(1, cell * 0.04)} cornerRadius={cell * 0.06} />
      <Rect x={cell * 0.14} y={cell * 0.18} width={cell * 0.72} height={cell * 0.22}
        fill="#a96f36" stroke="#4a2e12" strokeWidth={Math.max(1, cell * 0.04)} cornerRadius={cell * 0.08} />
      <Line points={[cell * 0.14, cell * 0.4, cell * 0.86, cell * 0.4]}
        stroke="#4a2e12" strokeWidth={Math.max(1, cell * 0.04)} />
      <Rect x={cell * 0.43} y={cell * 0.36} width={cell * 0.14} height={cell * 0.18}
        fill="#fbbf24" stroke="#92400e" strokeWidth={1} cornerRadius={cell * 0.03} />
    </Group>
  )
}

// ── Obstáculo: 3 variantes (árbol / roca / matorral) ─────────────────────

function TreeSprite({ px, py, cell }: { px: number; py: number; cell: number }) {
  const cx = px + cell * 0.5
  const cy = py + cell * 0.5
  const r = cell * 0.28
  const sw = Math.max(1, cell * 0.05)
  return (
    <Group listening={false}>
      <Rect x={cx - cell * 0.06} y={cy + r * 0.45} width={cell * 0.12} height={cell * 0.24}
        fill="#6b4226" strokeWidth={0} />
      <Circle x={cx} y={cy} radius={r} fill="#166534" stroke="#14532d" strokeWidth={sw} />
      <Circle x={cx - r * 0.6} y={cy + r * 0.35} radius={r * 0.6} fill="#15803d" strokeWidth={0} />
      <Circle x={cx + r * 0.6} y={cy + r * 0.35} radius={r * 0.6} fill="#15803d" strokeWidth={0} />
      <Circle x={cx - r * 0.22} y={cy - r * 0.28} radius={r * 0.18} fill="rgba(255,255,255,0.14)" strokeWidth={0} />
    </Group>
  )
}

function RockSprite({ px, py, cell }: { px: number; py: number; cell: number }) {
  const cx = px + cell * 0.5
  const cy = py + cell * 0.54
  const rx = cell * 0.33
  const ry = cell * 0.24
  const sw = Math.max(1, cell * 0.04)
  return (
    <Group listening={false}>
      {/* Sombra */}
      <Circle x={cx + cell * 0.04} y={cy + ry * 0.6} radius={rx * 0.7}
        fill="rgba(0,0,0,0.18)" strokeWidth={0} scaleY={0.35} />
      {/* Roca principal */}
      <Line points={[
        cx - rx, cy + ry,
        cx - rx * 0.9, cy - ry * 0.2,
        cx - rx * 0.3, cy - ry,
        cx + rx * 0.4, cy - ry,
        cx + rx, cy - ry * 0.1,
        cx + rx * 0.85, cy + ry,
      ]} closed fill="#71717a" stroke="#3f3f46" strokeWidth={sw} tension={0.3} listening={false} />
      {/* Roca pequeña derecha */}
      <Line points={[
        cx + rx * 0.35, cy + ry,
        cx + rx * 0.32, cy + ry * 0.3,
        cx + rx * 0.7,  cy + ry * 0.25,
        cx + rx * 0.82, cy + ry,
      ]} closed fill="#a1a1aa" stroke="#52525b" strokeWidth={Math.max(1, sw * 0.7)} tension={0.3} listening={false} />
      {/* Brillo */}
      <Line points={[cx - rx * 0.55, cy - ry * 0.55, cx - rx * 0.15, cy - ry * 0.75]}
        stroke="rgba(255,255,255,0.28)" strokeWidth={Math.max(1, cell * 0.03)} lineCap="round" />
    </Group>
  )
}

function BushSprite({ px, py, cell }: { px: number; py: number; cell: number }) {
  const cx = px + cell * 0.5
  const cy = py + cell * 0.58
  const r = cell * 0.2
  return (
    <Group listening={false}>
      <Circle x={cx} y={cy} radius={r * 1.1} fill="#4d7c0f" strokeWidth={0} />
      <Circle x={cx - r * 0.9} y={cy + r * 0.1} radius={r * 0.85} fill="#65a30d" strokeWidth={0} />
      <Circle x={cx + r * 0.9} y={cy + r * 0.1} radius={r * 0.85} fill="#65a30d" strokeWidth={0} />
      <Circle x={cx - r * 0.45} y={cy - r * 0.7} radius={r * 0.75} fill="#4d7c0f" strokeWidth={0} />
      <Circle x={cx + r * 0.45} y={cy - r * 0.7} radius={r * 0.75} fill="#4d7c0f" strokeWidth={0} />
      <Circle x={cx} y={cy - r * 1.0} radius={r * 0.8} fill="#3f6212" strokeWidth={0} />
      <Circle x={cx - r * 0.3} y={cy - r * 0.4} radius={r * 0.22} fill="rgba(255,255,255,0.12)" strokeWidth={0} />
    </Group>
  )
}

/** Elige variante 0/1/2 según posición de la celda para dar variedad sin aleatoriedad. */
export function ObstacleSprite({ px, py, cell, variant }: { px: number; py: number; cell: number; variant: 0 | 1 | 2 }) {
  if (variant === 1) return <RockSprite px={px} py={py} cell={cell} />
  if (variant === 2) return <BushSprite px={px} py={py} cell={cell} />
  return <TreeSprite px={px} py={py} cell={cell} />
}

// ── Difícil: 3 variantes (agua / barro / pantano) ─────────────────────────

function WaterSprite({ px, py, cell }: { px: number; py: number; cell: number }) {
  const sw = Math.max(1, cell * 0.04)
  const wave = (ox: number, oy: number, w: number) => {
    const y0 = py + cell * oy
    return [
      px + cell * ox, y0,
      px + cell * (ox + w * 0.25), y0 - cell * 0.045,
      px + cell * (ox + w * 0.5),  y0,
      px + cell * (ox + w * 0.75), y0 + cell * 0.045,
      px + cell * (ox + w),        y0,
    ]
  }
  return (
    <Group listening={false}>
      <Rect x={px} y={py} width={cell} height={cell} fill="rgba(30,100,200,0.22)" strokeWidth={0} />
      <Line points={wave(0.1, 0.32, 0.36)} stroke="#3b82f6" strokeWidth={sw} tension={0.5} lineCap="round" />
      <Line points={wave(0.54, 0.32, 0.36)} stroke="#3b82f6" strokeWidth={sw} tension={0.5} lineCap="round" />
      <Line points={wave(0.1, 0.52, 0.36)} stroke="#60a5fa" strokeWidth={sw} tension={0.5} lineCap="round" />
      <Line points={wave(0.54, 0.52, 0.36)} stroke="#60a5fa" strokeWidth={sw} tension={0.5} lineCap="round" />
      <Line points={wave(0.1, 0.72, 0.36)} stroke="#3b82f6" strokeWidth={sw} tension={0.5} lineCap="round" />
      <Line points={wave(0.54, 0.72, 0.36)} stroke="#3b82f6" strokeWidth={sw} tension={0.5} lineCap="round" />
    </Group>
  )
}

function MudSprite({ px, py, cell }: { px: number; py: number; cell: number }) {
  const sw = Math.max(1, cell * 0.035)
  // Huellas de bota en barro
  const boot = (bx: number, by: number, angle: number) => {
    const cx = px + cell * bx
    const cy = py + cell * by
    const w = cell * 0.16
    const h = cell * 0.26
    return (
      <Group key={`${bx},${by}`} x={cx} y={cy} rotation={angle} offsetX={w / 2} offsetY={h / 2} listening={false}>
        <Rect x={0} y={0} width={w} height={h} fill="#92400e" strokeWidth={0} cornerRadius={w * 0.4} />
        <Rect x={w * 0.1} y={h * 0.55} width={w * 0.8} height={h * 0.3} fill="#78350f" strokeWidth={0} cornerRadius={w * 0.2} />
      </Group>
    )
  }
  return (
    <Group listening={false}>
      <Rect x={px} y={py} width={cell} height={cell} fill="rgba(120,85,45,0.38)" strokeWidth={0} />
      {/* Charcos */}
      <Circle x={px + cell * 0.3} y={py + cell * 0.35} radius={cell * 0.14}
        fill="rgba(80,55,25,0.45)" strokeWidth={sw} stroke="rgba(60,40,15,0.5)" />
      <Circle x={px + cell * 0.68} y={py + cell * 0.62} radius={cell * 0.1}
        fill="rgba(80,55,25,0.4)" strokeWidth={0} />
      {boot(0.28, 0.62, -18)}
      {boot(0.64, 0.3, 15)}
    </Group>
  )
}

function SwampSprite({ px, py, cell }: { px: number; py: number; cell: number }) {
  const cx = px + cell * 0.5
  const sw = Math.max(1, cell * 0.035)
  return (
    <Group listening={false}>
      <Rect x={px} y={py} width={cell} height={cell} fill="rgba(30,80,50,0.35)" strokeWidth={0} />
      {/* Agua oscura */}
      <Circle x={cx} y={py + cell * 0.6} radius={cell * 0.28}
        fill="rgba(15,60,30,0.55)" strokeWidth={0} />
      {/* Juncos */}
      {[0.28, 0.44, 0.62, 0.76].map((bx, i) => (
        <Group key={i} listening={false}>
          <Line
            points={[px + cell * bx, py + cell * 0.85, px + cell * (bx - 0.03 + (i % 2) * 0.04), py + cell * 0.28]}
            stroke="#15803d" strokeWidth={sw} lineCap="round"
          />
          {/* Espiga */}
          <Rect x={px + cell * (bx - 0.025 + (i % 2) * 0.04)} y={py + cell * 0.2}
            width={cell * 0.05} height={cell * 0.14}
            fill="#854d0e" strokeWidth={0} cornerRadius={cell * 0.02} />
        </Group>
      ))}
    </Group>
  )
}

export function DifficultSprite({ px, py, cell, variant, fill }: { px: number; py: number; cell: number; variant: 0 | 1 | 2; fill?: string }) {
  return (
    <Group listening={false}>
      {fill && <Rect x={px} y={py} width={cell} height={cell} fill={fill} strokeWidth={0} />}
      {variant === 1 ? <MudSprite px={px} py={py} cell={cell} /> : variant === 2 ? <SwampSprite px={px} py={py} cell={cell} /> : <WaterSprite px={px} py={py} cell={cell} />}
    </Group>
  )
}

// ── Peligroso: 3 variantes (fuego / ácido / calavera) ────────────────────

function FireSprite({ px, py, cell }: { px: number; py: number; cell: number }) {
  const cx = px + cell * 0.5
  const bot = py + cell * 0.84
  const h = cell * 0.58
  const sw = Math.max(1, cell * 0.03)
  const flame = (dx: number, scale: number, color: string, key: string) => {
    const x0 = cx + dx * cell
    return (
      <Line key={key}
        points={[
          x0, bot,
          x0 - cell * 0.11 * scale, bot - h * 0.48 * scale,
          x0 - cell * 0.03 * scale, bot - h * 0.73 * scale,
          x0,                        bot - h * scale,
          x0 + cell * 0.03 * scale, bot - h * 0.73 * scale,
          x0 + cell * 0.11 * scale, bot - h * 0.48 * scale,
          x0, bot,
        ]}
        closed fill={color} stroke="transparent" strokeWidth={sw} tension={0.4} listening={false}
      />
    )
  }
  return (
    <Group listening={false}>
      <Rect x={px} y={py} width={cell} height={cell} fill="rgba(239,68,68,0.13)" strokeWidth={0} />
      {flame(-0.2, 0.68, "rgba(251,146,60,0.85)", "l")}
      {flame(0.2, 0.64, "rgba(252,165,30,0.85)", "r")}
      {flame(0, 1, "rgba(239,68,68,0.92)", "c")}
      <Circle x={cx} y={bot - h * 0.33} radius={cell * 0.07} fill="rgba(254,240,138,0.9)" strokeWidth={0} />
    </Group>
  )
}

function AcidSprite({ px, py, cell }: { px: number; py: number; cell: number }) {
  const sw = Math.max(1, cell * 0.035)
  return (
    <Group listening={false}>
      <Rect x={px} y={py} width={cell} height={cell} fill="rgba(132,204,22,0.18)" strokeWidth={0} />
      {/* Charco ácido */}
      <Circle x={px + cell * 0.5} y={py + cell * 0.55} radius={cell * 0.3}
        fill="rgba(101,163,13,0.55)" stroke="rgba(163,230,53,0.7)" strokeWidth={sw} />
      {/* Burbujas */}
      {[
        { bx: 0.38, by: 0.48, r: 0.06 },
        { bx: 0.58, by: 0.42, r: 0.045 },
        { bx: 0.5,  by: 0.35, r: 0.035 },
        { bx: 0.44, by: 0.62, r: 0.04 },
        { bx: 0.6,  by: 0.6,  r: 0.055 },
      ].map(({ bx, by, r }, i) => (
        <Circle key={i}
          x={px + cell * bx} y={py + cell * by} radius={cell * r}
          fill="rgba(190,242,100,0.5)" strokeWidth={0} />
      ))}
      {/* Vapor */}
      <Line points={[px + cell * 0.38, py + cell * 0.28, px + cell * 0.33, py + cell * 0.12]}
        stroke="rgba(163,230,53,0.4)" strokeWidth={sw} lineCap="round" />
      <Line points={[px + cell * 0.56, py + cell * 0.25, px + cell * 0.6, py + cell * 0.09]}
        stroke="rgba(163,230,53,0.4)" strokeWidth={sw} lineCap="round" />
    </Group>
  )
}

function SkullSprite({ px, py, cell }: { px: number; py: number; cell: number }) {
  const cx = px + cell * 0.5
  const cy = py + cell * 0.44
  const r = cell * 0.24
  const sw = Math.max(1, cell * 0.04)
  return (
    <Group listening={false}>
      <Rect x={px} y={py} width={cell} height={cell} fill="rgba(239,68,68,0.12)" strokeWidth={0} />
      {/* Cráneo */}
      <Circle x={cx} y={cy} radius={r} fill="#d4d4d8" stroke="#71717a" strokeWidth={sw} />
      {/* Mandíbula */}
      <Rect x={cx - r * 0.55} y={cy + r * 0.55} width={r * 1.1} height={r * 0.55}
        fill="#d4d4d8" stroke="#71717a" strokeWidth={sw * 0.8} cornerRadius={r * 0.1} />
      {/* Dientes */}
      {[-0.32, -0.08, 0.16].map((dx, i) => (
        <Rect key={i}
          x={cx + r * dx} y={cy + r * 0.85} width={r * 0.2} height={r * 0.3}
          fill="#fafafa" stroke="#a1a1aa" strokeWidth={1} />
      ))}
      {/* Cuencas oculares */}
      <Circle x={cx - r * 0.34} y={cy - r * 0.05} radius={r * 0.22} fill="#3f3f46" strokeWidth={0} />
      <Circle x={cx + r * 0.34} y={cy - r * 0.05} radius={r * 0.22} fill="#3f3f46" strokeWidth={0} />
      {/* Nariz */}
      <Line points={[cx - r * 0.1, cy + r * 0.28, cx, cy + r * 0.2, cx + r * 0.1, cy + r * 0.28]}
        stroke="#71717a" strokeWidth={sw * 0.8} lineCap="round" />
    </Group>
  )
}

export function HazardousSprite({ px, py, cell, variant, fill }: { px: number; py: number; cell: number; variant: 0 | 1 | 2; fill?: string }) {
  return (
    <Group listening={false}>
      {fill && <Rect x={px} y={py} width={cell} height={cell} fill={fill} strokeWidth={0} />}
      {variant === 1 ? <AcidSprite px={px} py={py} cell={cell} /> : variant === 2 ? <SkullSprite px={px} py={py} cell={cell} /> : <FireSprite px={px} py={py} cell={cell} />}
    </Group>
  )
}

// ── Zona de despliegue ────────────────────────────────────────────────────

export function DeployZoneSprite({
  px, py, w, h, cell, label, color,
}: {
  px: number; py: number; w: number; h: number; cell: number
  label: string; color: string
}) {
  const fontSize = Math.max(9, Math.min(cell * 1.2, w * 0.16))
  return (
    <Group listening={false}>
      <Rect x={px + 1} y={py + 1} width={w - 2} height={h - 2}
        fill="transparent" stroke={color}
        strokeWidth={Math.max(2, cell * 0.1)}
        dash={[cell * 0.28, cell * 0.14]}
        cornerRadius={cell * 0.1}
      />
      <Text
        x={px} y={py + h / 2 - fontSize * 0.6}
        width={w} align="center"
        text={label} fontSize={fontSize} fontStyle="bold"
        fill={color} listening={false}
      />
    </Group>
  )
}

// ── Círculo mágico ─────────────────────────────────────────────────────────

function MagicCircleSprite({ px, py, sizePx }: { px: number; py: number; sizePx: number }) {
  const image = useImage(MAGIC_CIRCLE_DATA_URI)
  if (!image) return null
  return <KonvaImage image={image} x={px} y={py} width={sizePx} height={sizePx} listening={false} />
}

/** Anclas de bloques mágicos: celdas magic sin magic arriba ni a la izquierda, con su tamaño real. */
function magicAnchors(cells: MapCell[]): { x: number; y: number; size: number }[] {
  const magic = new Set(cells.filter((c) => c.t === "magic").map((c) => `${c.x},${c.y}`))
  return cells
    .filter((c) => c.t === "magic" && !magic.has(`${c.x - 1},${c.y}`) && !magic.has(`${c.x},${c.y - 1}`))
    .map((c) => {
      let size = 1
      while (magic.has(`${c.x + size},${c.y}`) && magic.has(`${c.x},${c.y + size}`)) size++
      return { x: c.x, y: c.y, size }
    })
}

// ── Bloques de zona de despliegue ──────────────────────────────────────────

function deployBlocks(cells: MapCell[], t: "deployA" | "deployB"): { x: number; y: number; w: number; h: number }[] {
  const set = new Set(cells.filter((c) => c.t === t).map((c) => `${c.x},${c.y}`))
  const blocks: { x: number; y: number; w: number; h: number }[] = []
  const seen = new Set<string>()
  for (const c of cells) {
    if (c.t !== t || seen.has(`${c.x},${c.y}`)) continue
    if (set.has(`${c.x - 1},${c.y}`) || set.has(`${c.x},${c.y - 1}`)) continue
    let w = 1
    while (set.has(`${c.x + w},${c.y}`)) w++
    let h = 1
    while (set.has(`${c.x},${c.y + h}`)) h++
    blocks.push({ x: c.x, y: c.y, w, h })
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) seen.add(`${c.x + dx},${c.y + dy}`)
  }
  return blocks
}

// ── TerrainLayer ───────────────────────────────────────────────────────────

interface TerrainLayerProps {
  cells: MapCell[]
  cols: number
  rows: number
  cell: number
  collectedTreasures?: Set<string>
  /** Variante de sprite preferida por tipo de terreno (0/1/2). Cuando está ausente
   *  la variante se calcula automáticamente por posición de celda. */
  spriteVariants?: Partial<Record<CellTerrain, 0 | 1 | 2>>
  /** Colores personalizados por tipo de terreno; sobreescriben TERRAIN_FILL. */
  terrainColors?: Partial<Record<CellTerrain, string>>
}

export function TerrainLayer({ cells, cols, rows, cell, collectedTreasures, spriteVariants, terrainColors }: TerrainLayerProps) {
  // Deduplicar por posición: si la BD guardó duplicados, la última ocurrencia gana
  const seen = new Set<string>()
  const unique = cells.filter((c) => {
    const k = `${c.x},${c.y}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const visible = unique.filter((c) => c.x < cols && c.y < rows)
  const deployABlocks = deployBlocks(visible, "deployA")
  const deployBBlocks = deployBlocks(visible, "deployB")

  function fillFor(t: CellTerrain): string {
    return terrainColors?.[t] ?? TERRAIN_FILL[t]
  }

  return (
    <>
      {visible.map((c) => {
        const key = `${c.x},${c.y}`
        // Si hay variante forzada para este tipo, úsala; si no, varía por posición
        const autoVariant = ((c.x * 3 + c.y * 7) % 3) as 0 | 1 | 2
        const variant = spriteVariants?.[c.t as CellTerrain] ?? autoVariant

        if (c.t === "treasure") {
          if (collectedTreasures?.has(key)) return null
          return <ChestSprite key={key} px={c.x * cell} py={c.y * cell} cell={cell} />
        }
        if (c.t === "deployA" || c.t === "deployB") {
          return (
            <Rect key={key} x={c.x * cell} y={c.y * cell} width={cell} height={cell}
              fill={fillFor(c.t)} listening={false} />
          )
        }
        if (c.t === "obstacle") {
          return (
            <Group key={key} listening={false}>
              <Rect x={c.x * cell} y={c.y * cell} width={cell} height={cell}
                fill={fillFor("obstacle")} strokeWidth={0} />
              <ObstacleSprite px={c.x * cell} py={c.y * cell} cell={cell} variant={variant} />
            </Group>
          )
        }
        if (c.t === "difficult") {
          return <DifficultSprite key={key} px={c.x * cell} py={c.y * cell} cell={cell} variant={variant} fill={fillFor("difficult")} />
        }
        if (c.t === "hazardous") {
          return <HazardousSprite key={key} px={c.x * cell} py={c.y * cell} cell={cell} variant={variant} fill={fillFor("hazardous")} />
        }
        return (
          <Rect key={key} x={c.x * cell} y={c.y * cell} width={cell} height={cell}
            fill={fillFor(c.t as CellTerrain)} listening={false} />
        )
      })}

      {deployABlocks.map((b) => (
        <DeployZoneSprite key={`dA-${b.x},${b.y}`}
          px={b.x * cell} py={b.y * cell} w={b.w * cell} h={b.h * cell}
          cell={cell} label="ZONA A" color="#16a34a" />
      ))}
      {deployBBlocks.map((b) => (
        <DeployZoneSprite key={`dB-${b.x},${b.y}`}
          px={b.x * cell} py={b.y * cell} w={b.w * cell} h={b.h * cell}
          cell={cell} label="ZONA B" color="#2563eb" />
      ))}

      {magicAnchors(visible).map((anchor) => (
        <MagicCircleSprite key={`magic-${anchor.x},${anchor.y}`}
          px={anchor.x * cell} py={anchor.y * cell} sizePx={cell * anchor.size} />
      ))}
    </>
  )
}

// ── Paredes ───────────────────────────────────────────────────────────────

const WALL_FILL = "#000000"

function wallRect(w: MapWall, cell: number): { x: number; y: number; width: number; height: number } {
  const px = w.x * cell
  const py = w.y * cell
  const th = Math.round(w.thickness * cell)
  switch (w.side) {
    case "N": return { x: px,             y: py,             width: cell, height: th   }
    case "S": return { x: px,             y: py + cell - th, width: cell, height: th   }
    case "E": return { x: px + cell - th, y: py,             width: th,   height: cell }
    case "W": return { x: px,             y: py,             width: th,   height: cell }
  }
}

interface WallLayerProps {
  walls: MapWall[]
  cols: number
  rows: number
  cell: number
  fill?: string
}

export function WallLayer({ walls, cols, rows, cell, fill = WALL_FILL }: WallLayerProps) {
  const visible = walls.filter((w) => w.x >= 0 && w.y >= 0 && w.x < cols && w.y < rows)
  return (
    <>
      {visible.map((w) => {
        const rect = wallRect(w, cell)
        return (
          <Rect key={`wall-${w.x},${w.y},${w.side}`}
            x={rect.x} y={rect.y} width={rect.width} height={rect.height}
            fill={fill} listening={false} />
        )
      })}
    </>
  )
}

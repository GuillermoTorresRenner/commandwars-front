/**
 * Rango de movimiento para RESALTAR celdas en el cliente (solo UX).
 * ⚠️ Réplica de backend/src/game/game.engine.ts — la autoridad SIEMPRE es el
 * servidor (toda acción se valida allí). Mantener ambas en sincronía.
 */
import type { CellTerrain, GameState, GameUnit, MapWall } from "@/lib/api"

const SLOWING: CellTerrain[] = ["difficult", "hazardous", "obstacle"]

// ── Índice de paredes ─────────────────────────────────────────────────────

function buildWallIndex(walls: MapWall[]): Set<string> {
  const set = new Set<string>()
  for (const w of walls) {
    let nx: number, ny: number
    switch (w.side) {
      case "N": nx = w.x; ny = w.y - 1; break
      case "S": nx = w.x; ny = w.y + 1; break
      case "E": nx = w.x + 1; ny = w.y; break
      case "W": nx = w.x - 1; ny = w.y; break
    }
    const [ax, ay, bx, by] =
      w.x < nx || (w.x === nx && w.y <= ny)
        ? [w.x, w.y, nx, ny]
        : [nx, ny, w.x, w.y]
    set.add(`${ax},${ay}|${bx},${by}`)
  }
  return set
}

function wallBlocks(index: Set<string>, ax: number, ay: number, bx: number, by: number): boolean {
  const [x1, y1, x2, y2] =
    ax < bx || (ax === bx && ay <= by) ? [ax, ay, bx, by] : [bx, by, ax, ay]
  return index.has(`${x1},${y1}|${x2},${y2}`)
}

function isCellEnclosedByWalls(
  index: Set<string>,
  x: number,
  y: number,
  cols: number,
  rows: number,
): boolean {
  const N = y === 0        || wallBlocks(index, x, y, x, y - 1)
  const S = y === rows - 1 || wallBlocks(index, x, y, x, y + 1)
  const W = x === 0        || wallBlocks(index, x, y, x - 1, y)
  const E = x === cols - 1 || wallBlocks(index, x, y, x + 1, y)
  return N && S && W && E
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

function footprint(x: number, y: number, size: number): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = []
  for (let dx = 0; dx < size; dx++) {
    for (let dy = 0; dy < size; dy++) cells.push({ x: x + dx, y: y + dy })
  }
  return cells
}

function spaceDistance(
  ax: number,
  ay: number,
  asize: number,
  bx: number,
  by: number,
  bsize: number,
): number {
  const dx = Math.max(bx - (ax + asize - 1), ax - (bx + bsize - 1), 0)
  const dy = Math.max(by - (ay + asize - 1), ay - (by + bsize - 1), 0)
  return Math.max(dx, dy)
}

export function unitSize(state: GameState, unit: GameUnit): number {
  return state.catalog[unit.creatureId].gridSize
}

export function unitsAdjacent(state: GameState, a: GameUnit, b: GameUnit): boolean {
  return spaceDistance(a.x, a.y, unitSize(state, a), b.x, b.y, unitSize(state, b)) === 1
}

export function spaceDistanceBetween(state: GameState, a: GameUnit, b: GameUnit): number {
  return spaceDistance(a.x, a.y, unitSize(state, a), b.x, b.y, unitSize(state, b))
}

export function movementRange(state: GameState, unit: GameUnit): Map<string, number> {
  const terrain = new Map(state.map.cells.map((c) => [cellKey(c.x, c.y), c.t]))
  const wallIndex = buildWallIndex(state.map.walls ?? [])
  const size = unitSize(state, unit)
  const startAdjacent = state.units.some(
    (other) => other.owner !== unit.owner && unitsAdjacent(state, unit, other),
  )
  const baseSpeed = startAdjacent ? 1 : state.catalog[unit.creatureId].speed
  // Descontar lo ya gastado en etapas previas (movementSpent viene del servidor)
  const speed = Math.max(0, baseSpeed - (unit.movementSpent ?? 0))

  const { cols, rows } = state.map
  const isWall = (x: number, y: number) =>
    terrain.get(cellKey(x, y)) === "wall" ||
    isCellEnclosedByWalls(wallIndex, x, y, cols, rows)

  const canOccupy = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x + size > cols || y + size > rows) return false
    for (const c of footprint(x, y, size)) if (isWall(c.x, c.y)) return false
    for (const other of state.units) {
      if (other.uid === unit.uid) continue
      if (
        other.owner !== unit.owner &&
        spaceDistance(x, y, size, other.x, other.y, unitSize(state, other)) === 0
      ) {
        return false
      }
    }
    return true
  }

  const entryCost = (x: number, y: number): number =>
    footprint(x, y, size).some((c) =>
      SLOWING.includes(terrain.get(cellKey(c.x, c.y)) as CellTerrain),
    )
      ? 2
      : 1

  const adjacentEnemyAt = (x: number, y: number): boolean =>
    state.units.some(
      (other) =>
        other.owner !== unit.owner &&
        spaceDistance(x, y, size, other.x, other.y, unitSize(state, other)) === 1,
    )

  const best = new Map<string, number>([[cellKey(unit.x, unit.y), 0]])
  const queue = [{ x: unit.x, y: unit.y, cost: 0 }]

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost)
    const current = queue.shift()!
    if (best.get(cellKey(current.x, current.y))! < current.cost) continue
    if (current.cost > 0 && adjacentEnemyAt(current.x, current.y)) continue

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue
        const nx = current.x + dx
        const ny = current.y + dy
        if (!canOccupy(nx, ny)) continue
        if (dx !== 0 && dy !== 0) {
          if (!canOccupy(current.x + dx, current.y) || !canOccupy(current.x, current.y + dy)) {
            continue
          }
        }
        // Sin cruzar aristas bloqueadas por paredes
        if (wallIndex.size > 0) {
          let blocked = false
          if (dx !== 0 && dy === 0) {
            for (let sy = 0; sy < size && !blocked; sy++) {
              if (wallBlocks(wallIndex, current.x + (dx > 0 ? size - 1 : 0), current.y + sy,
                             current.x + (dx > 0 ? size : -1), current.y + sy)) blocked = true
            }
          } else if (dx === 0 && dy !== 0) {
            for (let sx = 0; sx < size && !blocked; sx++) {
              if (wallBlocks(wallIndex, current.x + sx, current.y + (dy > 0 ? size - 1 : 0),
                             current.x + sx, current.y + (dy > 0 ? size : -1))) blocked = true
            }
          } else {
            for (let sy = 0; sy < size && !blocked; sy++) {
              if (wallBlocks(wallIndex, current.x + (dx > 0 ? size - 1 : 0), current.y + sy,
                             current.x + (dx > 0 ? size : -1), current.y + sy)) blocked = true
            }
            for (let sx = 0; sx < size && !blocked; sx++) {
              if (wallBlocks(wallIndex, current.x + sx, current.y + (dy > 0 ? size - 1 : 0),
                             current.x + sx, current.y + (dy > 0 ? size : -1))) blocked = true
            }
          }
          if (blocked) continue
        }
        const cost = current.cost + entryCost(nx, ny)
        if (cost > speed) continue
        const key = cellKey(nx, ny)
        if ((best.get(key) ?? Infinity) <= cost) continue
        best.set(key, cost)
        queue.push({ x: nx, y: ny, cost })
      }
    }
  }

  const result = new Map<string, number>()
  for (const [key, cost] of best) {
    if (cost === 0) continue
    const [x, y] = key.split(",").map(Number)
    const overlaps = state.units.some(
      (other) =>
        other.uid !== unit.uid &&
        spaceDistance(x, y, size, other.x, other.y, unitSize(state, other)) === 0,
    )
    if (!overlaps) result.set(key, cost)
  }
  return result
}

import type { CellTerrain } from "./api"

/**
 * Paleta y metadatos de los terrenos del reglamento. Compartida por el editor
 * de celdas y el tablero de las salas. El canvas no puede leer los tokens CSS
 * del tema (§7 de CLAUDE.md), por eso los colores viven aquí.
 */
export const TERRAINS: {
  key: CellTerrain
  label: string
  fill: string
  description: string
}[] = [
  {
    key: "difficult",
    label: "Terreno difícil",
    fill: "rgba(245, 158, 11, 0.5)",
    description: "Cuesta +1 de movimiento",
  },
  {
    key: "hazardous",
    label: "Terreno peligroso",
    fill: "rgba(239, 68, 68, 0.5)",
    description: "Difícil y daña al entrar/terminar",
  },
  {
    key: "obstacle",
    label: "Obstáculo",
    fill: "rgba(139, 92, 246, 0.55)",
    description: "Difícil, bloquea visión y da cobertura",
  },
  {
    key: "wall",
    label: "Muro (colisión)",
    fill: "rgba(15, 23, 42, 0.75)",
    description: "Intransitable y bloquea visión",
  },
  {
    key: "magic",
    label: "Círculo mágico",
    fill: "rgba(34, 211, 238, 0.18)",
    description: "Bloque de 2×2, 3×3 o 4×4 con imagen del círculo",
  },
  {
    key: "treasure",
    label: "Tesoro",
    fill: "rgba(234, 179, 8, 0.7)",
    description: "Cofre: recogerlo da +1 Moral",
  },
  {
    key: "deployA",
    label: "Despliegue A",
    fill: "rgba(34, 197, 94, 0.45)",
    description: "Rectángulo 4×8 del jugador 1 (obligatorio)",
  },
  {
    key: "deployB",
    label: "Despliegue B",
    fill: "rgba(59, 130, 246, 0.45)",
    description: "Rectángulo 4×8 del jugador 2 (obligatorio)",
  },
]

export const TERRAIN_FILL: Record<CellTerrain, string> = Object.fromEntries(
  TERRAINS.map((terrain) => [terrain.key, terrain.fill]),
) as Record<CellTerrain, string>

export type MagicBlockSize = 2 | 3 | 4
export const MAGIC_BLOCK_SIZES: MagicBlockSize[] = [2, 3, 4]
/** Tamaño por defecto del círculo mágico */
export const MAGIC_BLOCK_DEFAULT: MagicBlockSize = 4
/** Dimensiones (en celdas) del rectángulo de zona de despliegue (obligatorio). */
export const DEPLOY_BLOCK = { w: 4, h: 8 }

/**
 * Imagen del círculo mágico (SVG generado). ⚠️ Placeholder visual: más
 * adelante se reemplazará por arte propio subido como imagen.
 */
const MAGIC_CIRCLE_SVG = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
  <circle cx='50' cy='50' r='47' fill='rgba(34,211,238,0.12)' stroke='#22d3ee' stroke-width='2'/>
  <circle cx='50' cy='50' r='38' fill='none' stroke='#22d3ee' stroke-width='1.5' stroke-dasharray='7 5'/>
  <circle cx='50' cy='50' r='26' fill='none' stroke='#67e8f9' stroke-width='1'/>
  <path d='M50 12 L59 37 L85 37 L64 53 L72 80 L50 64 L28 80 L36 53 L15 37 L41 37 Z'
        fill='none' stroke='#a5f3fc' stroke-width='2'/>
  <circle cx='50' cy='50' r='4' fill='#cffafe'/>
</svg>`
export const MAGIC_CIRCLE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(MAGIC_CIRCLE_SVG)}`

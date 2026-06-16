/**
 * Paleta del lienzo del tablero (Konva).
 *
 * El canvas no puede leer los tokens CSS de `src/index.css`, así que los colores
 * de render del juego se centralizan AQUÍ (única fuente para el tablero). Los
 * estilos del DOM/HUD siguen usando los tokens de Tailwind/shadcn. Ver CLAUDE.md §7.
 */
export const BOARD_COLORS = {
  gridLine: 'rgba(255, 255, 255, 0.12)',
  reachableFill: 'rgba(96, 165, 250, 0.32)',
  reachableStroke: 'rgba(96, 165, 250, 0.9)',
  hoverStroke: 'rgba(250, 250, 250, 0.95)',
  costText: '#f8fafc',
  unitFill: '#fbbf24',
  unitStroke: '#1f2937',
} as const;

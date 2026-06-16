/**
 * Capa LÓGICA del tablero (la "verdad" del juego), desacoplada de la imagen.
 *
 * El mapa visible es una imagen; esta cuadrícula define la jugabilidad por celda
 * (colisiones, costo de movimiento, efectos de terreno). El render solo traduce
 * coordenadas de celda <-> píxeles. Ver CLAUDE.md §4.
 */

export type TerrainEffect =
  | 'none' // terreno normal
  | 'difficult' // cuesta más entrar (moveCost > 1)
  | 'water' // intransitable
  | 'wall' // intransitable
  | 'damage'; // transitable pero dañino

export interface Cell {
  x: number;
  y: number;
  /** Intransitable (colisión): no se puede entrar ni atravesar. */
  blocked: boolean;
  /** Puntos de movimiento que cuesta ENTRAR en la celda (1 = normal). */
  moveCost: number;
  /** Efecto de terreno (informativo / a futuro aplica reglas). */
  effect: TerrainEffect;
}

export interface GameMap {
  id: string;
  name: string;
  /** URL o data-URI de la imagen de fondo (en producción: arte propio / Tiled). */
  image: string;
  cols: number;
  rows: number;
  /** Tamaño en píxeles de cada celda (para traducir celda <-> píxeles). */
  cellSize: number;
  /** Metadatos por celda. Longitud = cols * rows, indexado por (y * cols + x). */
  cells: Cell[];
}

export interface Coord {
  x: number;
  y: number;
}

/** Clave estable de una celda para usar en Map/Set. */
export const cellKey = (x: number, y: number): string => `${x},${y}`;

/** Parsea una clave de celda de vuelta a coordenadas. */
export const parseCellKey = (key: string): Coord => {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
};

/** Devuelve la celda en (x, y) o undefined si está fuera del mapa. */
export const getCell = (
  map: GameMap,
  x: number,
  y: number,
): Cell | undefined => {
  if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return undefined;
  return map.cells[y * map.cols + x];
};

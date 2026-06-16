/**
 * Pathfinding sobre la cuadrícula lógica.
 *
 * IMPORTANTE: son dos problemas distintos (CLAUDE.md §4):
 *  - Rango de movimiento ("¿qué celdas alcanzo con N puntos?") -> flood-fill
 *    ponderado (Dijkstra). Es lo que implementa este módulo.
 *  - Ruta a un destino ("¿cómo llego a esta celda?") -> A* (se añadirá luego,
 *    p. ej. con easystar.js).
 */

import type { Coord, GameMap } from './types';
import { cellKey, getCell } from './types';

/** Movimiento ortogonal (4 direcciones), típico de tácticos en cuadrícula. */
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Calcula todas las celdas alcanzables desde `start` gastando como máximo
 * `budget` puntos de movimiento, respetando colisiones y costo de terreno.
 *
 * El costo de una celda es el de ENTRAR en ella (su `moveCost`); la celda de
 * origen no se incluye en el resultado.
 *
 * @returns Map de claveCelda -> costo mínimo acumulado para llegar (<= budget).
 */
export function computeMovementRange(
  map: GameMap,
  start: Coord,
  budget: number,
): Map<string, number> {
  const best = new Map<string, number>();
  best.set(cellKey(start.x, start.y), 0);

  // Dijkstra con frontera simple (los costos son pequeños y la grilla chica).
  const frontier: Array<Coord & { cost: number }> = [{ ...start, cost: 0 }];
  const settled = new Set<string>();

  while (frontier.length > 0) {
    // Extrae el nodo de menor costo acumulado.
    let minIndex = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].cost < frontier[minIndex].cost) minIndex = i;
    }
    const current = frontier.splice(minIndex, 1)[0];
    const currentKey = cellKey(current.x, current.y);
    if (settled.has(currentKey)) continue;
    settled.add(currentKey);

    for (const [dx, dy] of DIRECTIONS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const neighbor = getCell(map, nx, ny);
      if (!neighbor || neighbor.blocked) continue;

      const nextCost = current.cost + neighbor.moveCost;
      if (nextCost > budget) continue;

      const neighborKey = cellKey(nx, ny);
      if (nextCost < (best.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
        best.set(neighborKey, nextCost);
        frontier.push({ x: nx, y: ny, cost: nextCost });
      }
    }
  }

  // El origen no forma parte del "rango de movimiento".
  best.delete(cellKey(start.x, start.y));
  return best;
}

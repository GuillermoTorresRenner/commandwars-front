/**
 * Mapa de prueba para el spike de la fase 1.
 *
 * NOTA: aquí la imagen de fondo se genera (un SVG con un color por celda según
 * el terreno) solo para que el spike sea visual y autocontenido. En producción
 * la imagen será arte propio e independiente, y los metadatos por celda vendrán
 * de un editor (p. ej. Tiled) o de la base de datos. Ver CLAUDE.md §4.
 */

import type { Cell, GameMap, TerrainEffect } from './types';

/** Color de relleno por tipo de terreno (solo para la imagen de prueba). */
const TERRAIN_FILL: Record<TerrainEffect, string> = {
  none: '#5d7a4f', // pasto
  difficult: '#8a7a3f', // barro / pasto alto (cuesta más)
  water: '#3f6f8a', // agua (intransitable)
  wall: '#3a3a40', // muro / roca (intransitable)
  damage: '#8a3f3f', // lava / pinches (daño)
};

function buildMapImage(
  cells: Cell[],
  cols: number,
  rows: number,
  cellSize: number,
): string {
  const width = cols * cellSize;
  const height = rows * cellSize;
  const rects = cells
    .map(
      (c) =>
        `<rect x="${c.x * cellSize}" y="${c.y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${TERRAIN_FILL[c.effect]}"/>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Posición inicial de la unidad de prueba. */
export const SAMPLE_START = { x: 0, y: 4 };

export function buildSampleMap(): GameMap {
  const cols = 13;
  const rows = 9;
  const cellSize = 52;

  const cells: Cell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      cells.push({ x, y, blocked: false, moveCost: 1, effect: 'none' });
    }
  }

  const idx = (x: number, y: number) => y * cols + x;
  const set = (x: number, y: number, patch: Partial<Cell>) =>
    Object.assign(cells[idx(x, y)], patch);

  // Muros (intransitables)
  for (let y = 1; y <= 3; y++) set(6, y, { blocked: true, effect: 'wall' });
  for (const x of [5, 6, 7]) set(x, 5, { blocked: true, effect: 'wall' });
  for (const x of [10, 11]) set(x, 7, { blocked: true, effect: 'wall' });

  // Agua (intransitable)
  for (const [x, y] of [
    [10, 1],
    [11, 1],
    [10, 2],
    [11, 2],
  ]) {
    set(x, y, { blocked: true, effect: 'water' });
  }

  // Terreno difícil (cuesta 2 entrar)
  for (const [x, y] of [
    [2, 1],
    [3, 1],
    [2, 2],
    [3, 2],
    [2, 6],
    [3, 6],
  ]) {
    set(x, y, { moveCost: 2, effect: 'difficult' });
  }

  // Terreno de daño (transitable, costo normal)
  for (const [x, y] of [
    [8, 4],
    [9, 4],
    [9, 5],
    [10, 5],
  ]) {
    set(x, y, { moveCost: 1, effect: 'damage' });
  }

  const image = buildMapImage(cells, cols, rows, cellSize);
  return { id: 'sample', name: 'Mapa de prueba', image, cols, rows, cellSize, cells };
}

/** Etiquetas legibles por tipo de terreno (para la leyenda del HUD). */
export const TERRAIN_LABELS: Record<TerrainEffect, string> = {
  none: 'Normal',
  difficult: 'Difícil (x2)',
  water: 'Agua (bloquea)',
  wall: 'Muro (bloquea)',
  damage: 'Daño',
};

export { TERRAIN_FILL };

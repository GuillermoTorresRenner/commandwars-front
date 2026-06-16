import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { computeMovementRange } from '@/game/grid/pathfinding';
import {
  buildSampleMap,
  SAMPLE_START,
  TERRAIN_FILL,
  TERRAIN_LABELS,
} from '@/game/grid/sampleMap';
import type { Coord, TerrainEffect } from '@/game/grid/types';
import { cellKey, getCell } from '@/game/grid/types';
import { Board } from './Board';

const TERRAIN_ORDER: TerrainEffect[] = [
  'none',
  'difficult',
  'damage',
  'water',
  'wall',
];

export function BoardDemo() {
  const map = useMemo(buildSampleMap, []);
  const [unit, setUnit] = useState<Coord>(SAMPLE_START);
  const [budget, setBudget] = useState(6);
  const [hovered, setHovered] = useState<Coord | null>(null);

  const range = useMemo(
    () => computeMovementRange(map, unit, budget),
    [map, unit, budget],
  );

  const handleCellClick = (cell: Coord) => {
    if (range.has(cellKey(cell.x, cell.y))) {
      setUnit(cell);
    }
  };

  const hoveredCell = hovered ? getCell(map, hovered.x, hovered.y) : undefined;
  const hoveredCost = hovered ? range.get(cellKey(hovered.x, hovered.y)) : undefined;

  return (
    <div className="flex flex-col items-start gap-6 lg:flex-row">
      <div className="border-border overflow-hidden rounded-xl border shadow-lg">
        <Board
          map={map}
          unit={unit}
          range={range}
          hovered={hovered}
          onCellClick={handleCellClick}
          onCellHover={setHovered}
        />
      </div>

      <Card className="w-full lg:w-80">
        <CardHeader>
          <CardTitle>Tablero — Spike fase 1</CardTitle>
          <CardDescription>
            Imagen + cuadrícula lógica + rango de movimiento con costo de
            terreno. Hacé clic en una celda resaltada para mover la unidad.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Puntos de movimiento
              </span>
              <Badge variant="secondary">{budget}</Badge>
            </div>
            <Slider
              value={[budget]}
              min={1}
              max={12}
              step={1}
              onValueChange={(value) => setBudget(value[0])}
            />
          </div>

          <div className="text-sm">
            <span className="text-muted-foreground">Celdas alcanzables: </span>
            <span className="font-medium">{range.size}</span>
          </div>

          <div className="space-y-1.5 text-sm">
            <span className="text-muted-foreground">Bajo el cursor:</span>
            <div className="font-medium">
              {!hoveredCell && '—'}
              {hoveredCell && (
                <>
                  ({hoveredCell.x}, {hoveredCell.y}) ·{' '}
                  {TERRAIN_LABELS[hoveredCell.effect]}
                  {hoveredCost !== undefined && ` · costo ${hoveredCost}`}
                  {hoveredCell.blocked && ' · intransitable'}
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-muted-foreground text-sm">Leyenda</span>
            <ul className="grid grid-cols-1 gap-1.5">
              {TERRAIN_ORDER.map((terrain) => (
                <li key={terrain} className="flex items-center gap-2 text-sm">
                  <span
                    className="border-border inline-block size-4 rounded-sm border"
                    style={{ backgroundColor: TERRAIN_FILL[terrain] }}
                  />
                  {TERRAIN_LABELS[terrain]}
                </li>
              ))}
            </ul>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setUnit(SAMPLE_START)}
          >
            Reiniciar posición
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

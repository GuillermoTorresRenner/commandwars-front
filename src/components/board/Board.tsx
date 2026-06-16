import { Fragment } from 'react';
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
} from 'react-konva';

import type { Coord, GameMap } from '@/game/grid/types';
import { cellKey } from '@/game/grid/types';
import { useImage } from '@/hooks/use-image';
import { BOARD_COLORS } from './board-theme';

interface BoardProps {
  map: GameMap;
  /** Posición actual de la unidad. */
  unit: Coord;
  /** Celdas alcanzables: claveCelda -> costo acumulado. */
  range: Map<string, number>;
  /** Celda bajo el cursor (o null). */
  hovered: Coord | null;
  onCellClick: (cell: Coord) => void;
  onCellHover: (cell: Coord | null) => void;
}

export function Board({
  map,
  unit,
  range,
  hovered,
  onCellClick,
  onCellHover,
}: BoardProps) {
  const cs = map.cellSize;
  const width = map.cols * cs;
  const height = map.rows * cs;
  const image = useImage(map.image);

  const hoveredKey = hovered ? cellKey(hovered.x, hovered.y) : null;

  return (
    <Stage width={width} height={height}>
      {/* Capa estática: imagen del mapa + cuadrícula. */}
      <Layer listening={false}>
        {image && <KonvaImage image={image} width={width} height={height} />}

        {Array.from({ length: map.cols + 1 }, (_, i) => (
          <Line
            key={`v${i}`}
            points={[i * cs, 0, i * cs, height]}
            stroke={BOARD_COLORS.gridLine}
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: map.rows + 1 }, (_, j) => (
          <Line
            key={`h${j}`}
            points={[0, j * cs, width, j * cs]}
            stroke={BOARD_COLORS.gridLine}
            strokeWidth={1}
          />
        ))}
      </Layer>

      {/* Capa de resaltado: rango de movimiento + hover + unidad. */}
      <Layer listening={false}>
        {Array.from(range.entries()).map(([key, cost]) => {
          const [x, y] = key.split(',').map(Number);
          const isHovered = key === hoveredKey;
          return (
            <Fragment key={key}>
              <Rect
                x={x * cs}
                y={y * cs}
                width={cs}
                height={cs}
                fill={BOARD_COLORS.reachableFill}
                stroke={
                  isHovered
                    ? BOARD_COLORS.hoverStroke
                    : BOARD_COLORS.reachableStroke
                }
                strokeWidth={isHovered ? 3 : 1}
              />
              <Text
                x={x * cs}
                y={y * cs + cs - 16}
                width={cs}
                align="center"
                text={String(cost)}
                fontSize={13}
                fontStyle="bold"
                fill={BOARD_COLORS.costText}
              />
            </Fragment>
          );
        })}

        <Group>
          <Circle
            x={unit.x * cs + cs / 2}
            y={unit.y * cs + cs / 2}
            radius={cs * 0.32}
            fill={BOARD_COLORS.unitFill}
            stroke={BOARD_COLORS.unitStroke}
            strokeWidth={3}
          />
        </Group>
      </Layer>

      {/* Capa de interacción: una celda transparente por cada casilla. */}
      <Layer>
        {map.cells.map((cell) => (
          <Rect
            key={cellKey(cell.x, cell.y)}
            x={cell.x * cs}
            y={cell.y * cs}
            width={cs}
            height={cs}
            fill="transparent"
            onClick={() => onCellClick({ x: cell.x, y: cell.y })}
            onTap={() => onCellClick({ x: cell.x, y: cell.y })}
            onMouseEnter={() => onCellHover({ x: cell.x, y: cell.y })}
            onMouseLeave={() => onCellHover(null)}
          />
        ))}
      </Layer>
    </Stage>
  );
}

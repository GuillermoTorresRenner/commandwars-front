import { useMemo } from "react"
import { Layer, Image as KonvaImage, Line, Rect, Stage } from "react-konva"
import { TerrainLayer, WallLayer } from "@/components/board/terrain-sprites"
import { useImage } from "@/hooks/use-image"
import { assetUrl } from "@/lib/api"
import type { GameMapDto, MapCell, MapWall } from "@/lib/api"

type BoardMap = Pick<GameMapDto, "image" | "cols" | "rows" | "cells" | "walls">

interface MapBoardProps {
  map: BoardMap
  maxWidth?: number
  maxHeight?: number
}

/**
 * Tablero de solo lectura: imagen del mapa + grilla + terrenos + paredes.
 * Lo usa la sala (tablero virtual).
 */
export function MapBoard({ map, maxWidth = 900, maxHeight = 560 }: MapBoardProps) {
  const image = useImage(assetUrl(map.image) ?? "")
  const cell = Math.max(
    4,
    Math.floor(Math.min(maxWidth / map.cols, maxHeight / map.rows)),
  )
  const width = cell * map.cols
  const height = cell * map.rows

  const gridLines = useMemo(() => {
    const lines: number[][] = []
    for (let x = 0; x <= map.cols; x++) lines.push([x * cell, 0, x * cell, height])
    for (let y = 0; y <= map.rows; y++) lines.push([0, y * cell, width, y * cell])
    return lines
  }, [map.cols, map.rows, cell, width, height])

  const cells: MapCell[] = map.cells ?? []
  const walls: MapWall[] = map.walls ?? []

  return (
    <Stage width={width} height={height}>
      <Layer listening={false}>
        {image ? (
          <KonvaImage image={image} width={width} height={height} />
        ) : (
          <Rect width={width} height={height} fill="#3f3f46" />
        )}
        <TerrainLayer cells={cells} cols={map.cols} rows={map.rows} cell={cell} />
        {gridLines.map((points, index) => (
          <Line key={index} points={points} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
        ))}
        <WallLayer walls={walls} cols={map.cols} rows={map.rows} cell={cell} />
      </Layer>
    </Stage>
  )
}

import { useCallback, useEffect, useRef, useState } from "react"
import { Download, Grid3x3, Map as MapIcon, Paintbrush, Pencil, Plus, Trash2, Upload } from "lucide-react"
import { Link } from "react-router"
import { MapFormDialog } from "@/components/admin/MapFormDialog"
import { MapBoard } from "@/components/rooms/MapBoard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/lib/api"
import type { GameMapDto } from "@/lib/api"

/** Descarga un blob como archivo. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Mantenedor de mapas en cards: listado + alta/edición/borrado (solo admin). */
export function MapsAdminPage() {
  const [maps, setMaps] = useState<GameMapDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<GameMapDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GameMapDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(() => {
    api.maps
      .list()
      .then((mapList) => {
        setMaps(mapList)
        setError(null)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "No se pudieron cargar los mapas"),
      )
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.maps.remove(deleteTarget.id)
      setDeleteTarget(null)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar")
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  async function handleExport(map: GameMapDto) {
    try {
      const blob = await api.exportMap(map.id)
      downloadBlob(blob, `map-${map.name.replace(/\s+/g, "_")}.zip`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar")
    }
  }

  async function handleImport(file: File) {
    try {
      await api.importMap(file)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar")
    }
  }

  return (
    <TooltipProvider>
    <section className="space-y-4">
      {/* Input oculto para seleccionar ZIP de importación */}
      <input
        ref={importRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleImport(file)
          e.target.value = ""
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold">Mapas</h2>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => importRef.current?.click()}>
                <Upload className="size-4" /> Importar ZIP
              </Button>
            </TooltipTrigger>
            <TooltipContent>Importar mapa desde un ZIP exportado</TooltipContent>
          </Tooltip>
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" /> Nuevo mapa
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {!maps ? (
        <p className="text-muted-foreground text-sm">Cargando mapas…</p>
      ) : maps.length === 0 ? (
        <p className="text-muted-foreground text-sm">Sin mapas todavía.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {maps.map((map) => (
            <Card key={map.id} className="overflow-hidden pt-0 shadow-md">
              {map.cols && map.rows ? (
                <div className="aspect-video w-full overflow-hidden bg-zinc-950 flex items-center justify-center">
                  <MapBoard map={map} maxWidth={480} maxHeight={270} />
                </div>
              ) : (
                <div className="bg-muted text-muted-foreground flex aspect-video w-full items-center justify-center">
                  <MapIcon className="size-8" />
                </div>
              )}
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-heading truncate font-semibold">{map.name}</h3>
                  <div className="flex shrink-0 gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Exportar ${map.name}`} onClick={() => void handleExport(map)}>
                          <Download className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Exportar como ZIP</TooltipContent>
                    </Tooltip>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar celdas de ${map.name}`}
                      asChild
                    >
                      <Link to={`/admin/maps/${map.id}/edit`}>
                        <Paintbrush className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ${map.name}`}
                      onClick={() => {
                        setEditing(map)
                        setFormOpen(true)
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Eliminar ${map.name}`}
                      onClick={() => setDeleteTarget(map)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">
                    <Grid3x3 className="size-3.5" /> {map.cols}×{map.rows}
                  </Badge>
                  <Badge variant="outline">{map.cellSize}px/celda</Badge>
                </div>
                {map.description && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {map.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MapFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSaved={reload}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              Eliminar mapa
            </DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  ¿Eliminar <span className="font-semibold text-foreground">{deleteTarget.name}</span>?
                  {" "}Esta acción no se puede deshacer y las salas que lo usen quedarán sin mapa.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              <Trash2 className="size-4" />
              {deleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
    </TooltipProvider>
  )
}

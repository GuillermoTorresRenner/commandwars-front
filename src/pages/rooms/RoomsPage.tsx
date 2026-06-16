import { useCallback, useEffect, useState } from "react"
import type { FormEvent } from "react"
import { ArrowLeft, KeyRound, Plus, Swords, Trash2, Users } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/auth/auth-context"
import { api } from "@/lib/api"
import type { GameMapDto, GameRoom, RoomStatus } from "@/lib/api"

const STATUS_LABEL: Record<RoomStatus, string> = {
  LOBBY: "En lobby",
  PLAYING: "En juego",
  FINISHED: "Terminada",
}

/** Lista de salas del usuario + crear sala + unirse por código (?code=XXX). */
export function RoomsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [rooms, setRooms] = useState<GameRoom[] | null>(null)
  const [maps, setMaps] = useState<GameMapDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteRoom, setDeleteRoom] = useState<GameRoom | null>(null)
  const [deleting, setDeleting] = useState(false)
  // El código puede venir prellenado desde un email de invitación.
  const [joinCode, setJoinCode] = useState(searchParams.get("code") ?? "")
  const [joining, setJoining] = useState(false)

  const reload = useCallback(() => {
    Promise.all([api.rooms.list(), api.maps.list()])
      .then(([roomList, mapList]) => {
        setRooms(roomList)
        setMaps(mapList)
        setError(null)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "No se pudieron cargar las salas"),
      )
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function handleDelete() {
    if (!deleteRoom) return
    setDeleting(true)
    try {
      await api.rooms.leave(deleteRoom.id)
      setDeleteRoom(null)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la sala")
      setDeleteRoom(null)
    } finally {
      setDeleting(false)
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    setError(null)
    try {
      const room = await api.rooms.join(joinCode.trim().toUpperCase())
      navigate(`/rooms/${room.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar a la sala")
    } finally {
      setJoining(false)
    }
  }

  return (
    <main className="bg-background text-foreground min-h-svh">
      <header className="border-border/60 bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg shadow-sm">
              <Users className="size-5" />
            </div>
            <div>
              <h1 className="font-heading text-lg leading-tight font-bold tracking-tight">
                Partidas
              </h1>
              <p className="text-muted-foreground text-xs leading-tight">
                Tableros virtuales para 2 comandantes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Inicio</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="scene-backdrop min-h-[calc(100svh-57px)]">
        <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form onSubmit={handleJoin} className="flex items-center gap-2">
              <div className="relative">
                <KeyRound className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input
                  aria-label="Código de sala"
                  placeholder="Código (p. ej. K7QX2M)"
                  className="w-48 pl-8 font-mono uppercase"
                  maxLength={12}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                />
              </div>
              <Button type="submit" variant="outline" disabled={joining || !joinCode.trim()}>
                {joining ? "Entrando…" : "Unirme"}
              </Button>
            </form>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Nueva sala
            </Button>
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          {!rooms ? (
            <p className="text-muted-foreground text-sm">Cargando salas…</p>
          ) : rooms.length === 0 ? (
            <Card className="shadow-md">
              <CardContent className="text-muted-foreground py-10 text-center">
                No tienes salas todavía. Crea una e invita a un amigo por email o
                compártele el código.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => {
                const iAmHost = user?.id === room.hostId
                return (
                  <Card
                    key={room.id}
                    className="hover:border-primary/50 relative cursor-pointer shadow-md transition-colors"
                    onClick={() => navigate(`/rooms/${room.id}`)}
                  >
                    {iAmHost && (
                      <button
                        className="absolute top-3 right-3 z-10 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Eliminar sala"
                        onClick={(e) => { e.stopPropagation(); setDeleteRoom(room) }}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                    <CardHeader className={iAmHost ? "pr-10" : ""}>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="font-heading truncate text-lg">
                          {room.name}
                        </CardTitle>
                        <Badge variant={room.status === "PLAYING" ? "default" : "secondary"}>
                          {STATUS_LABEL[room.status]}
                        </Badge>
                      </div>
                      <CardDescription className="font-mono tracking-widest">
                        {room.code}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-muted-foreground space-y-1 text-sm">
                      <p className="inline-flex items-center gap-1.5">
                        <Swords className="size-4" /> {room.host.username}
                        {" vs "}
                        {room.guest?.username ?? "esperando oponente…"}
                      </p>
                      <p>Mapa: {room.map?.name ?? "sin elegir"}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <CreateRoomDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        maps={maps}
        onCreated={(room) => navigate(`/rooms/${room.id}`)}
      />

      {/* Modal confirmación eliminar sala */}
      <Dialog open={!!deleteRoom} onOpenChange={(open) => { if (!open) setDeleteRoom(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-destructive" />
              Eliminar sala
            </DialogTitle>
            <DialogDescription>
              {deleteRoom && (
                <>
                  ¿Eliminar <span className="font-semibold text-foreground">{deleteRoom.name}</span>?
                  {" "}Se cerrará la sala y se desconectará al otro jugador si está dentro.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteRoom(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              <Trash2 className="size-4" />
              {deleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function CreateRoomDialog({
  open,
  onOpenChange,
  maps,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  maps: GameMapDto[]
  onCreated: (room: GameRoom) => void
}) {
  const [name, setName] = useState("")
  const [mapId, setMapId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const room = await api.rooms.create({ name, mapId: mapId || null })
      onOpenChange(false)
      onCreated(room)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la sala")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva sala</DialogTitle>
          <DialogDescription>
            Crea el tablero virtual y luego invita a tu oponente con el código o por
            email.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room-name">Nombre de la sala</Label>
            <Input
              id="room-name"
              required
              minLength={2}
              maxLength={60}
              placeholder="Duelo en la cripta"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Mapa (puedes cambiarlo en el lobby)</Label>
            <Select value={mapId} onValueChange={setMapId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegir mapa" />
              </SelectTrigger>
              <SelectContent>
                {maps.map((map) => (
                  <SelectItem key={map.id} value={map.id}>
                    {map.name} ({map.cols}×{map.rows})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creando…" : "Crear sala"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

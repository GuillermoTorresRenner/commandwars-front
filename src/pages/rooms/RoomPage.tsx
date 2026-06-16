import { useCallback, useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  LogOut,
  Mail,
  Play,
  Swords,
  Users,
} from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"
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
import { GameBoard } from "@/components/rooms/GameBoard"
import { MapBoard } from "@/components/rooms/MapBoard"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/auth/auth-context"
import { api } from "@/lib/api"
import type { Faction, GameAction, GameMapDto, GameRoom, RoomState } from "@/lib/api"
import { getSocket } from "@/lib/socket"
import { cn } from "@/lib/utils"

/** Sala / tablero virtual: lobby en tiempo real y tablero al iniciar. */
export function RoomPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [presence, setPresence] = useState<string[]>([])
  const [factions, setFactions] = useState<Faction[]>([])
  const [maps, setMaps] = useState<GameMapDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Carga inicial por REST + catálogos.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([api.rooms.get(id), api.factions.list(), api.maps.list()])
      .then(([roomData, factionList, mapList]) => {
        if (cancelled) return
        setRoom(roomData)
        setFactions(factionList)
        setMaps(mapList)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "No se pudo cargar la sala")
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // Tiempo real: unirse al canal de la sala y escuchar estado/errores.
  useEffect(() => {
    if (!id) return
    const socket = getSocket()
    const onState = (state: RoomState) => {
      setRoom(state.room)
      setPresence(state.presence)
      setLiveError(null)
    }
    const onError = (payload: { message: string }) => setLiveError(payload.message)
    socket.on("room:state", onState)
    socket.on("room:error", onError)
    socket.emit("room:join", { roomId: id })
    // Si el socket se reconecta, vuelve a unirse al canal.
    const onConnect = () => socket.emit("room:join", { roomId: id })
    socket.on("connect", onConnect)
    return () => {
      socket.emit("room:leave", { roomId: id })
      socket.off("room:state", onState)
      socket.off("room:error", onError)
      socket.off("connect", onConnect)
    }
  }, [id])

  const isHost = room !== null && user !== null && room.hostId === user.id
  const myFactionId = room ? (isHost ? room.hostFactionId : room.guestFactionId) : null
  const myReady = room ? (isHost ? room.hostReady : room.guestReady) : false

  const send = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      getSocket().emit(event, { roomId: id, ...payload })
    },
    [id],
  )

  async function copyCode() {
    if (!room) return
    await navigator.clipboard.writeText(room.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleLeave() {
    if (!room) return
    await api.rooms.leave(room.id)
    navigate("/rooms")
  }

  const factionById = useMemo(
    () => new Map(factions.map((faction) => [faction.id, faction])),
    [factions],
  )

  if (error) {
    return (
      <main className="bg-background text-foreground flex min-h-svh flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" asChild>
          <Link to="/rooms">Volver a partidas</Link>
        </Button>
      </main>
    )
  }
  if (!room) {
    return (
      <main className="bg-background text-muted-foreground flex min-h-svh items-center justify-center">
        Cargando sala…
      </main>
    )
  }

  const isPlaying = room.status === "PLAYING" && !!room.gameState

  return (
    <main className={cn("bg-background text-foreground", isPlaying ? "h-svh flex flex-col overflow-hidden" : "min-h-svh")}>
      <header className={cn("border-border/60 bg-background/85 border-b backdrop-blur", isPlaying ? "shrink-0 z-40" : "sticky top-0 z-40")}>
        <div className={cn("flex items-center justify-between gap-4", isPlaying ? "px-3 py-1.5" : "mx-auto max-w-6xl px-6 py-3")}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg shadow-sm">
              <Users className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading truncate text-lg leading-tight font-bold tracking-tight">
                {room.name}
              </h1>
              <button
                type="button"
                onClick={() => void copyCode()}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-mono text-xs tracking-widest"
              >
                {room.code}
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              </button>
            </div>
            <Badge variant={room.status === "PLAYING" ? "default" : "secondary"}>
              {room.status === "PLAYING" ? "En juego" : "Lobby"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
              <Mail className="size-4" />
              <span className="hidden sm:inline">Invitar</span>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/rooms">
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Partidas</span>
              </Link>
            </Button>
            {!isHost && (
              <Button variant="outline" size="sm" onClick={() => setLeaveOpen(true)}>
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Salir</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Contenedor principal: fullscreen en PLAYING, normal en LOBBY */}
      <div className={cn(isPlaying ? "flex-1 overflow-hidden relative" : "scene-backdrop min-h-[calc(100svh-57px)]")}>
        {/* Error en vivo: flotante en partida, inline en lobby */}
        {liveError && (
          <p role="alert" className={cn("text-destructive text-sm", isPlaying ? "absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-destructive/10 border border-destructive/30 px-3 py-1 rounded-lg shadow" : "mx-auto max-w-6xl px-6 pt-4")}>
            {liveError}
          </p>
        )}

        {isPlaying && room.gameState ? (
          /* ── PARTIDA: GameBoard ocupa todo el contenedor ── */
          <GameBoard
            state={room.gameState}
            mySide={isHost ? "host" : "guest"}
            mapImage={room.map?.image ?? null}
            sendAction={(action: GameAction) =>
              getSocket().emit("game:action", { roomId: room.id, action })
            }
            myDeploySide={isHost ? (room.hostSide ?? "A") : (room.guestSide ?? "B")}
          />
        ) : (
        <div className="mx-auto max-w-6xl space-y-5 px-6 py-8">
          {!isPlaying && (
            <div className="grid gap-2 sm:grid-cols-2">
              <PlayerCard
                title="Anfitrión"
                member={room.host}
                online={presence.includes(room.hostId)}
                faction={room.hostFactionId ? factionById.get(room.hostFactionId) : undefined}
                ready={room.hostReady}
              />
              <PlayerCard
                title="Oponente"
                member={room.guest}
                online={room.guestId !== null && presence.includes(room.guestId)}
                faction={
                  room.guestFactionId ? factionById.get(room.guestFactionId) : undefined
                }
                ready={room.guestReady}
              />
            </div>
          )}

          {room.status === "LOBBY" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-base">Tu facción</CardTitle>
                  <CardDescription>
                    Elige con qué banda lucharás. Cambiarla te quita el "listo".
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2">
                    {factions.map((faction) => {
                      const active = myFactionId === faction.id
                      return (
                        <button
                          key={faction.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            send("room:selectFaction", {
                              factionId: active ? null : faction.id,
                            })
                          }
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                            active
                              ? "border-primary bg-primary/10"
                              : "border-border hover:bg-muted/50",
                          )}
                        >
                          <span
                            aria-hidden
                            className="size-3.5 shrink-0 rounded-full"
                            style={{ backgroundColor: faction.color }}
                          />
                          <span className="min-w-0">
                            <span className="block font-medium">{faction.name}</span>
                            {faction.tagline && (
                              <span className="text-muted-foreground block truncate text-xs italic">
                                “{faction.tagline}”
                              </span>
                            )}
                          </span>
                          {active && <Check className="text-primary ml-auto size-4" />}
                        </button>
                      )
                    })}
                  </div>
                  {/* Selector de zona de despliegue */}
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium">
                      Zona de despliegue
                    </p>
                    <div className="flex gap-2">
                      {(["A", "B"] as const).map((side) => {
                        const takenByOther = isHost
                          ? room.guestSide === side
                          : room.hostSide === side
                        const myCurrentSide = isHost ? room.hostSide : room.guestSide
                        return (
                          <Button
                            key={side}
                            variant={myCurrentSide === side ? "default" : "outline"}
                            size="sm"
                            disabled={takenByOther}
                            onClick={() =>
                              send("room:chooseSide", { side })
                            }
                            className="flex-1"
                          >
                            Zona {side}
                            {takenByOther ? " (ocupada)" : ""}
                          </Button>
                        )
                      })}
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    variant={myReady ? "outline" : "default"}
                    disabled={!myFactionId}
                    onClick={() => send("room:ready", { ready: !myReady })}
                  >
                    <Check className="size-4" />
                    {myReady ? "Quitar listo" : "¡Estoy listo!"}
                  </Button>
                  {isHost && (
                    <Button
                      className="w-full"
                      disabled={
                        !room.guestId ||
                        !room.hostReady ||
                        !room.guestReady ||
                        !room.mapId
                      }
                      onClick={() => send("room:start", {})}
                    >
                      <Play className="size-4" /> Iniciar batalla
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="text-base">Mapa</CardTitle>
                  <CardDescription>
                    {isHost
                      ? "Como anfitrión eliges el campo de batalla."
                      : "El anfitrión elige el campo de batalla."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isHost && (
                    <Select
                      value={room.mapId ?? ""}
                      onValueChange={(value) => send("room:setMap", { mapId: value })}
                    >
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
                  )}
                  {room.map ? (
                    <div className="border-border overflow-auto rounded-lg border">
                      <MapBoard map={room.map} maxWidth={520} maxHeight={340} />
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Sin mapa elegido aún.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Swords className="text-primary size-5" /> Campo de batalla
                </CardTitle>
                <CardDescription>Esta partida no tiene estado de juego.</CardDescription>
              </CardHeader>
              <CardContent>
                {room.map ? (
                  <div className="border-border w-fit max-w-full overflow-auto rounded-lg border">
                    <MapBoard map={room.map} maxWidth={920} maxHeight={600} />
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">La sala no tiene mapa.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        )}
      </div>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        roomId={room.id}
        code={room.code}
      />

      {/* Modal confirmación abandonar sala (solo invitado) */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="size-4 text-destructive" />
              Abandonar sala
            </DialogTitle>
            <DialogDescription>
              Saldrás de la sala. El anfitrión podrá invitar a otro jugador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => { setLeaveOpen(false); void handleLeave() }}
            >
              <LogOut className="size-4" />
              Salir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function PlayerCard({
  title,
  member,
  online,
  faction,
  ready,
}: {
  title: string
  member: { id: string; username: string } | null
  online: boolean
  faction: Faction | undefined
  ready: boolean
}) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 rounded-lg border px-3 py-2 bg-card transition-colors",
      ready ? "border-primary/40 bg-primary/5" : "border-border",
    )}>
      <div className="relative shrink-0">
        <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-full">
          {title === "Anfitrión" ? (
            <Crown className="text-primary size-4" />
          ) : (
            <Swords className="size-4" />
          )}
        </div>
        <span
          aria-label={online ? "conectado" : "desconectado"}
          className={cn(
            "border-card absolute -right-0.5 -bottom-0.5 size-2 rounded-full border",
            online ? "bg-green-500" : "bg-muted-foreground/40",
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-[10px] leading-none mb-0.5">{title}</p>
        <p className="truncate text-sm font-semibold leading-tight">
          {member?.username ?? <span className="text-muted-foreground font-normal italic text-xs">Esperando…</span>}
        </p>
        {faction && (
          <p className="text-muted-foreground flex items-center gap-1 truncate text-[10px] mt-0.5">
            <span aria-hidden className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: faction.color }} />
            {faction.name}
          </p>
        )}
      </div>
      {member && (
        <Badge variant={ready ? "default" : "secondary"} className="text-[10px] py-0 px-1.5 shrink-0">
          {ready ? "Listo" : "Prep."}
        </Badge>
      )}
    </div>
  )
}

function InviteDialog({
  open,
  onOpenChange,
  roomId,
  code,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomId: string
  code: string
}) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSending(true)
    setError(null)
    try {
      await api.rooms.invite(roomId, email)
      setSent(true)
      setEmail("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la invitación")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen)
        if (!isOpen) setSent(false)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar a un amigo</DialogTitle>
          <DialogDescription>
            Le enviaremos un correo con el código <b className="font-mono">{code}</b> y
            un enlace directo a la sala.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email del invitado</Label>
            <Input
              id="invite-email"
              type="email"
              required
              placeholder="amigo@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {sent && (
            <p className="text-primary text-sm">Invitación enviada ✔ Puedes enviar otra.</p>
          )}
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
              disabled={sending}
            >
              Cerrar
            </Button>
            <Button type="submit" disabled={sending}>
              <Mail className="size-4" /> {sending ? "Enviando…" : "Enviar invitación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

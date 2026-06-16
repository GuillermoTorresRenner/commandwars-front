/**
 * Cliente HTTP del backend. La URL base SIEMPRE viene del .env del frontend
 * (VITE_API_URL; plantilla en .env.example) — sin fallback hardcodeado, para
 * que un .env ausente falle de forma visible y no apuntando a un puerto viejo.
 * El token JWT se persiste en localStorage y se adjunta como Bearer.
 */

export const API_URL: string = (() => {
  const url = import.meta.env.VITE_API_URL as string | undefined
  if (!url) {
    throw new Error(
      "Falta VITE_API_URL: copia frontend/.env.example a frontend/.env y ajusta la URL de la API",
    )
  }
  return url.replace(/\/$/, "")
})()

const TOKEN_KEY = "command.token"

// ── Tipos espejo de la API (backend = fuente de la verdad) ──────────────

export type UserRole = "ADMIN" | "USER"

export interface PublicUser {
  id: string
  email: string
  username: string
  role: UserRole
  createdAt: string
}

export interface AuthResponse {
  token: string
  user: PublicUser
}

export interface CreatureAbility {
  key: string
  label: string
  text: string
}

/** Atributos del reglamento que habilitan cartas de orden. */
export const CREATURE_ATTRIBUTES = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const
export type CreatureAttribute = (typeof CREATURE_ATTRIBUTES)[number]

export const ATTRIBUTE_LABELS: Record<CreatureAttribute, string> = {
  strength: "Fuerza",
  dexterity: "Destreza",
  constitution: "Constitución",
  intelligence: "Inteligencia",
  wisdom: "Sabiduría",
  charisma: "Carisma",
}

/** Tropa según la "carta de criatura" del reglamento. */
export interface Creature {
  id: string
  factionId: string
  name: string
  level: number
  hp: number
  speed: number
  meleeDamage: number
  rangedDamage: number | null
  rangedDistance: number | null
  /** Lado en celdas: 1 (ocupa 1 celda) o 2 (2×2 = 4 celdas). */
  gridSize: number
  /** Copias de esta criatura en la banda (n figuras del mismo tipo). */
  copies: number
  keywords: string[] | null
  attributes: CreatureAttribute[] | null
  powers: CreatureAbility[] | null
  token: string | null
}

/**
 * Líder/comandante de una facción: define Moral y Liderazgo INICIALES,
 * el tamaño de las manos de cartas y un poder continuo o triggered.
 */
export interface Leader {
  id: string
  factionId: string
  name: string
  powerLabel: string
  powerText: string
  powerType: string
  powerTrigger: string | null
  powerActionType: string | null
  powerEffects: unknown // EffectSpec[] — el motor vive en el backend
  startingMorale: number
  startingLeadership: number
  orderHand: number
  creatureHand: number
  token: string | null
}

/**
 * Carta de inspiración del deck de una facción.
 */
export interface OrderCard {
  id: string
  factionId: string
  name: string
  description: string | null
  /** Copias de esta carta en el deck de órdenes. */
  copies: number
  actionType: 'full' | 'swift' | 'defense'
  requiredAttribute: string | null
  requiredKeyword: string | null
  requiredLevel: number
  effects: unknown // EffectSpec[] — el motor vive en el backend
  attachText: string | null
}

export interface CategorySummary {
  id: string
  name: string
  slug: string
}

export interface Faction {
  id: string
  categoryId: string
  slug: string
  name: string
  tagline: string | null
  description: string | null
  color: string
  category?: CategorySummary
  leaders: Leader[]
  creatures: Creature[]
  orderCards: OrderCard[]
}

/** Categoría/ambientación con su árbol completo (respuesta de /categories). */
export interface Category {
  id: string
  slug: string
  name: string
  description: string | null
  factions: Faction[]
}

/**
 * Terreno de una celda del mapa según el reglamento (las celdas ausentes son
 * terreno normal): difficult (difícil), hazardous (difícil+daño), obstacle
 * (difícil+bloquea visión+cobertura), wall (intransitable+bloquea visión),
 * magic (círculo mágico), treasure (tesoro), deployA/deployB (despliegue).
 */
export type CellTerrain =
  | "difficult"
  | "hazardous"
  | "obstacle"
  | "wall"
  | "magic"
  | "treasure"
  | "deployA"
  | "deployB"

/** Celda no-normal de la grilla lógica (almacenamiento sparse). */
export interface MapCell {
  x: number
  y: number
  t: CellTerrain
}

/**
 * Pared pintada sobre un borde de celda. Pertenece a la celda (x,y) y se
 * dibuja pegada al lado indicado hacia el interior. `thickness` es fracción
 * del tamaño de celda (0.10 – 0.90, pasos de 0.05).
 *
 * Bloqueo bidireccional de movimiento y LoS:
 *  N → entre (x,y-1) y (x,y)   S → entre (x,y) y (x,y+1)
 *  E → entre (x,y) y (x+1,y)   W → entre (x-1,y) y (x,y)
 */
export interface MapWall {
  x: number
  y: number
  side: "N" | "S" | "E" | "W"
  /** Fracción de celda (0.10 – 0.90). */
  thickness: number
}

export interface GameMapDto {
  id: string
  name: string
  description: string | null
  image: string | null
  cols: number
  rows: number
  cellSize: number
  cells: MapCell[] | null
  walls: MapWall[] | null
  createdAt: string
  updatedAt: string
}

// Payloads de escritura (espejo de los DTOs del backend).

export interface CategoryInput {
  name: string
  description?: string | null
}

export interface FactionInput {
  categoryId: string
  name: string
  tagline?: string | null
  description?: string | null
  color?: string
}

export interface LeaderInput {
  factionId: string
  name: string
  powerLabel: string
  powerText: string
  startingMorale: number
  startingLeadership: number
  orderHand?: number
  creatureHand?: number
  token?: string | null
}

export interface CreatureInput {
  factionId: string
  name: string
  level: number
  hp: number
  speed: number
  meleeDamage: number
  rangedDamage?: number | null
  rangedDistance?: number | null
  gridSize: number
  copies?: number
  keywords?: string[] | null
  attributes?: CreatureAttribute[] | null
  powers?: CreatureAbility[] | null
  token?: string | null
}

export interface InspirationCardInput {
  factionId: string
  name: string
  description?: string | null
  copies?: number
}

export interface MapInput {
  name: string
  description?: string | null
  image?: string | null
  cols: number
  rows: number
  cellSize?: number
  cells?: MapCell[] | null
  walls?: MapWall[] | null
}

export type UploadKind = "creatures" | "leaders" | "maps"

// ── Partida (espejo de backend/src/game/game.types.ts) ─────────────────

export type PlayerSide = "host" | "guest"
export type GamePhase = "setup" | "activate" | "deploy" | "finished"

export interface CreatureSnapshot {
  id: string
  name: string
  level: number
  hp: number
  speed: number
  meleeDamage: number
  rangedDamage: number | null
  rangedDistance: number | null
  gridSize: number
  token: string | null
  factionColor: string
  keywords: string[]
  attributes: string[]
  powers: Array<{ key: string; label: string; text: string }>
}

/** Snapshot de una inspiración (congelada al iniciar la partida). */
export interface InspirationCardSnapshot {
  id: string
  name: string
  description: string
  /** Atributo requerido de la criatura actora; null = cualquier criatura. */
  requiredAttribute: string | null
  /** Nivel mínimo de la criatura actora (0 = cualquier nivel). */
  requiredLevel: number
  /** true = acción veloz (se puede usar además de la acción completa). */
  minor: boolean
}

export interface GameUnit {
  uid: string
  creatureId: string
  owner: PlayerSide
  x: number
  y: number
  damage: number
  tapped: boolean
  /** Puntos de movimiento gastados este turno. */
  movementSpent: number
  /** true cuando el presupuesto se agotó o la unidad quedó adyacente a enemigo. */
  moved: boolean
  attacked: boolean
  hazardEntered: boolean
}

export interface PlayerGameState {
  factionId: string
  factionName: string
  factionColor: string
  leaderName: string
  leaderToken: string | null
  leaderPowerLabel: string
  leaderPowerText: string
  morale: number
  leadership: number
  deck: string[]
  hand: string[]
  creatureHandSize: number
  orderDeck: string[]
  orderHand: string[]
  orderDiscard: string[]
  orderHandSize: number
}

export interface GameTreasure {
  x: number
  y: number
  /** Valor total del tesoro (1-3). Oculto hasta que revealed === true. */
  value: number
  /** Tokens de Moral que aún quedan por recoger. */
  remaining: number
  collected: boolean
  /** true cuando una unidad pisó este tesoro por primera vez. */
  revealed: boolean
}

/** Criatura destruida (cementerio). */
export interface GraveEntry {
  creatureId: string
  owner: PlayerSide
  round: number
}

export interface PendingAttack {
  attackerUid: string
  targetUid: string
  damage: number
  mode: "melee" | "ranged"
  attackerSide: PlayerSide
}

export interface GameState {
  round: number
  turn: PlayerSide
  phase: GamePhase
  setupDone: Record<PlayerSide, boolean>
  players: Record<PlayerSide, PlayerGameState>
  units: GameUnit[]
  treasures: GameTreasure[]
  catalog: Record<string, CreatureSnapshot>
  /** Catálogo de inspiraciones (por id de carta). */
  orderCatalog: Record<string, InspirationCardSnapshot>
  /** Cementerio global de criaturas destruidas. */
  graveyard: GraveEntry[]
  map: { cols: number; rows: number; cells: MapCell[]; walls: MapWall[] }
  winner: PlayerSide | "draw" | null
  log: string[]
  /** Ataque pendiente de reacción del defensor. */
  pendingAttack: PendingAttack | null
  /** Carta de inspiración recién robada al inicio del turno. */
  lastDrawnOrderCard: { side: PlayerSide; cardId: string } | null
}

export type GameAction =
  | { type: "deploy"; creatureId: string; x: number; y: number }
  | { type: "endSetup" }
  | { type: "move"; uid: string; x: number; y: number }
  | { type: "attack"; uid: string; targetUid: string; mode: "melee" | "ranged" }
  | { type: "collect"; uid: string }
  | { type: "playCard"; uid: string; cardId: string }
  | { type: "resolveAttack"; decision: "take" | "cower" }
  | { type: "passUnit"; uid: string }
  | { type: "endPhase" }
  | { type: "endTurn" }

// ── Salas / tableros virtuales ──────────────────────────────────────────

export type RoomStatus = "LOBBY" | "PLAYING" | "FINISHED"

export interface RoomMember {
  id: string
  username: string
}

export interface GameRoom {
  id: string
  code: string
  name: string
  status: RoomStatus
  mapId: string | null
  map: Pick<GameMapDto, "id" | "name" | "image" | "cols" | "rows" | "cellSize" | "cells" | "walls"> | null
  hostId: string
  host: RoomMember
  guestId: string | null
  guest: RoomMember | null
  hostFactionId: string | null
  guestFactionId: string | null
  hostReady: boolean
  guestReady: boolean
  /** Lado de despliegue elegido: 'A' (deployA) o 'B' (deployB). */
  hostSide: 'A' | 'B' | null
  guestSide: 'A' | 'B' | null
  /** Estado de la partida (motor de reglas); null mientras está en LOBBY. */
  gameState: GameState | null
}

/** Estado en vivo que difunde el gateway WebSocket. */
export interface RoomState {
  room: GameRoom
  /** Ids de usuarios con al menos un socket conectado a la sala. */
  presence: string[]
}

// ── Token ───────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token === null) localStorage.removeItem(TOKEN_KEY)
  else localStorage.setItem(TOKEN_KEY, token)
}

// ── Transporte ──────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `Error ${response.status}`
  try {
    const body = (await response.json()) as { message?: string | string[] }
    if (body.message)
      message = Array.isArray(body.message) ? body.message.join(". ") : body.message
  } catch {
    // sin cuerpo JSON: se conserva el mensaje genérico
  }
  return new ApiError(response.status, message)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) throw await parseError(response)
  return (await response.json()) as T
}

/** CRUD genérico de un recurso del backend. */
function crud<T, TInput>(base: string) {
  return {
    list: () => request<T[]>(base),
    get: (id: string) => request<T>(`${base}/${id}`),
    create: (data: TInput) =>
      request<T>(base, { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<TInput>) =>
      request<T>(`${base}/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: string) =>
      request<{ deleted: boolean }>(`${base}/${id}`, { method: "DELETE" }),
  }
}

/** Convierte una ruta relativa del backend (/public/...) en URL absoluta. */
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (path.startsWith("http") || path.startsWith("data:") || path.startsWith("blob:")) return path
  return `${API_URL}${path}`
}

// ── Endpoints ───────────────────────────────────────────────────────────

export const api = {
  register(data: { email: string; username: string; password: string }) {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  login(data: { email: string; password: string }) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  me() {
    return request<PublicUser>("/auth/me")
  },

  forgotPassword(email: string) {
    return request<{ sent: boolean }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    })
  },

  resetPassword(token: string, password: string) {
    return request<{ reset: boolean }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    })
  },

  rooms: {
    list: () => request<GameRoom[]>("/rooms"),
    get: (id: string) => request<GameRoom>(`/rooms/${id}`),
    create: (data: { name: string; mapId?: string | null }) =>
      request<GameRoom>("/rooms", { method: "POST", body: JSON.stringify(data) }),
    join: (code: string) =>
      request<GameRoom>("/rooms/join", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    invite: (id: string, email: string) =>
      request<{ sent: boolean }>(`/rooms/${id}/invite`, {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    leave: (id: string) => request<unknown>(`/rooms/${id}`, { method: "DELETE" }),
  },

  categories: crud<Category, CategoryInput>("/categories"),
  factions: crud<Faction, FactionInput>("/factions"),
  leaders: crud<Leader, LeaderInput>("/leaders"),
  creatures: crud<Creature, CreatureInput>("/creatures"),
  orderCards: crud<OrderCard, InspirationCardInput>("/order-cards"),
  maps: crud<GameMapDto, MapInput>("/maps"),

  /** Descarga el JSON de exportación de una facción. */
  async exportFaction(id: string): Promise<Blob> {
    const token = getToken()
    const response = await fetch(`${API_URL}/factions/${id}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!response.ok) throw await parseError(response)
    return response.blob()
  },

  /** Importa una facción desde JSON. */
  async importFaction(file: File, categoryId: string): Promise<Faction> {
    const token = getToken()
    const formData = new FormData()
    formData.append("file", file)
    const response = await fetch(`${API_URL}/factions/import?categoryId=${encodeURIComponent(categoryId)}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!response.ok) throw await parseError(response)
    return (await response.json()) as Faction
  },

  /** Descarga el ZIP de exportación de un mapa. */
  async exportMap(id: string): Promise<Blob> {
    const token = getToken()
    const response = await fetch(`${API_URL}/maps/${id}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!response.ok) throw await parseError(response)
    return response.blob()
  },

  /** Importa un mapa desde un ZIP. */
  async importMap(file: File): Promise<GameMapDto> {
    const token = getToken()
    const formData = new FormData()
    formData.append("file", file)
    const response = await fetch(`${API_URL}/maps/import`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!response.ok) throw await parseError(response)
    return (await response.json()) as GameMapDto
  },

  /** Sube una imagen (ya recortada por el editor) y devuelve su URL pública. */
  async upload(kind: UploadKind, blob: Blob): Promise<{ url: string }> {
    const token = getToken()
    const formData = new FormData()
    formData.append("file", blob, "image.png")
    // Sin Content-Type explícito: el navegador define el boundary del multipart.
    const response = await fetch(`${API_URL}/uploads/${kind}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!response.ok) throw await parseError(response)
    return (await response.json()) as { url: string }
  },
}

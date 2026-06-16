import { io, Socket } from "socket.io-client"
import { API_URL, getToken } from "./api"

let socket: Socket | null = null

/**
 * Socket singleton autenticado con el JWT de la sesión (handshake `auth.token`).
 * Llamar tras login; `resetSocket()` al cerrar sesión.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      auth: { token: getToken() },
      transports: ["websocket"],
    })
  }
  return socket
}

export function resetSocket(): void {
  socket?.disconnect()
  socket = null
}

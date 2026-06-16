import { createContext, useContext } from "react"
import type { PublicUser } from "@/lib/api"

export interface AuthContextValue {
  /** Usuario autenticado, o null si no hay sesión. */
  user: PublicUser | null
  /** true mientras se valida el token persistido al cargar la app. */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  return value
}

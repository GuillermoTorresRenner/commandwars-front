import { Navigate, useLocation } from "react-router"
import type { ReactNode } from "react"
import { useAuth } from "./auth-context"

/** Envuelve rutas privadas: sin sesión redirige a /login (recordando el origen). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="bg-background text-muted-foreground flex min-h-svh items-center justify-center">
        Cargando sesión…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { api, getToken, setToken } from "@/lib/api"
import type { PublicUser } from "@/lib/api"
import { resetSocket } from "@/lib/socket"
import { AuthContext } from "./auth-context"
import type { AuthContextValue } from "./auth-context"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [loading, setLoading] = useState<boolean>(() => getToken() !== null)

  // Al cargar la app, si hay token persistido se valida contra /auth/me.
  useEffect(() => {
    if (getToken() === null) return
    let cancelled = false
    api
      .me()
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        if (!cancelled) setToken(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: logged } = await api.login({ email, password })
    setToken(token)
    setUser(logged)
  }, [])

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      const { token, user: created } = await api.register({ email, username, password })
      setToken(token)
      setUser(created)
    },
    [],
  )

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    resetSocket()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

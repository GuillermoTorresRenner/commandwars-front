import { useState } from "react"
import type { FormEvent } from "react"
import { Swords } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordStrength } from "@/components/password-strength"
import { ThemeToggle } from "@/components/theme-toggle"
import { api } from "@/lib/api"
import { isStrongPassword } from "@/lib/password"

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get("token") ?? ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!isStrongPassword(password)) {
      setError("La contraseña no cumple todos los criterios de seguridad")
      return
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden")
      return
    }
    setSubmitting(true)
    try {
      await api.resetPassword(token, password)
      navigate("/login", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo restablecer la contraseña")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="scene-backdrop bg-background text-foreground relative flex min-h-svh items-center justify-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="bg-primary text-primary-foreground ring-primary/25 flex size-14 items-center justify-center rounded-2xl shadow-lg ring-4">
            <Swords className="size-7" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Command</h1>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Nueva contraseña</CardTitle>
            <CardDescription>Define la nueva contraseña de tu cuenta.</CardDescription>
          </CardHeader>
          {!token ? (
            <CardContent className="space-y-3">
              <p className="text-destructive text-sm">
                Falta el token de restablecimiento. Abre el enlace desde el correo o
                solicita uno nuevo.
              </p>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/forgot-password">Solicitar enlace nuevo</Link>
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <PasswordStrength password={password} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Repetir contraseña</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                {error && (
                  <p role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                )}
              </CardContent>
              <CardFooter className="mt-6 flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Guardando…" : "Restablecer contraseña"}
                </Button>
                <p className="text-muted-foreground text-sm">
                  <Link
                    to="/login"
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    Volver a iniciar sesión
                  </Link>
                </p>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </main>
  )
}

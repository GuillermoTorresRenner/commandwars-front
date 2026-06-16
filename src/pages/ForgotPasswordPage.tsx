import { useState } from "react"
import type { FormEvent } from "react"
import { MailCheck, Swords } from "lucide-react"
import { Link } from "react-router"
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
import { ThemeToggle } from "@/components/theme-toggle"
import { api } from "@/lib/api"

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api.forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el correo")
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
            <CardTitle>Recuperar contraseña</CardTitle>
            <CardDescription>
              Te enviaremos un enlace para restablecerla por correo.
            </CardDescription>
          </CardHeader>
          {sent ? (
            <CardContent className="space-y-3 text-center">
              <MailCheck className="text-primary mx-auto size-10" />
              <p className="text-sm">
                Si existe una cuenta con <b>{email}</b>, recibirás un correo con el
                enlace (vence en 60 minutos). Revisa también el spam.
              </p>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/login">Volver a iniciar sesión</Link>
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email de tu cuenta</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="tu@correo.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                  {submitting ? "Enviando…" : "Enviar enlace"}
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

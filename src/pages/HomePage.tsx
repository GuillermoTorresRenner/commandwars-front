import { LogOut, Settings, Swords, Users } from "lucide-react"
import { Link } from "react-router"
import { FactionCatalog } from "@/components/factions/FactionCatalog"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/auth/auth-context"

export function HomePage() {
  const { user, logout } = useAuth()

  return (
    <main className="bg-background text-foreground min-h-svh">
      <header className="border-border/60 bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg shadow-sm">
              <Swords className="size-5" />
            </div>
            <div>
              <h1 className="font-heading text-lg leading-tight font-bold tracking-tight">
                Command
              </h1>
              <p className="text-muted-foreground text-xs leading-tight">
                Táctica por turnos · prototipo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              Comandante{" "}
              <span className="text-foreground font-medium">{user?.username}</span>
            </span>
            <ThemeToggle />
            <Button variant="outline" size="sm" asChild>
              <Link to="/rooms">
                <Users className="size-4" />
                <span className="hidden sm:inline">Partidas</span>
              </Link>
            </Button>
            {user?.role === "ADMIN" && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin">
                  <Settings className="size-4" />
                  <span className="hidden sm:inline">Mantenedores</span>
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="scene-backdrop">
        <div className="mx-auto max-w-6xl space-y-14 px-6 py-10">
          <section className="space-y-4 pb-10">
            <div className="space-y-1">
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                Facciones
              </h2>
              <p className="text-muted-foreground">
                Contenido data-driven servido por la API.
              </p>
            </div>
            <FactionCatalog />
          </section>
        </div>
      </div>
    </main>
  )
}

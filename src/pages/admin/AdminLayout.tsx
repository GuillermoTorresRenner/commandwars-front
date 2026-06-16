import { ArrowLeft, Settings } from "lucide-react"
import { Link, NavLink, Outlet } from "react-router"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/admin/content", label: "Contenido" },
  { to: "/admin/maps", label: "Mapas" },
]

/** Marco de los mantenedores (solo admin): navegación + contenido. */
export function AdminLayout() {
  return (
    <main className="bg-background text-foreground min-h-svh">
      <header className="border-border/60 bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg shadow-sm">
              <Settings className="size-5" />
            </div>
            <div>
              <h1 className="font-heading text-lg leading-tight font-bold tracking-tight">
                Mantenedores
              </h1>
              <p className="text-muted-foreground text-xs leading-tight">
                Contenido data-driven del juego
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Volver al juego</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="scene-backdrop min-h-[calc(100svh-57px)]">
        <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
          <nav className="bg-muted inline-flex items-center gap-1 rounded-lg p-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <Outlet />
        </div>
      </div>
    </main>
  )
}

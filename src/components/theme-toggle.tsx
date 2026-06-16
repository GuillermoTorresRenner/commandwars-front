import { useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { applyTheme, getStoredTheme, setStoredTheme } from "@/lib/theme"
import type { Theme } from "@/lib/theme"

/** Alterna entre modo oscuro (por defecto) y claro; persiste en localStorage. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    applyTheme(next)
    setStoredTheme(next)
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onClick={toggle}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

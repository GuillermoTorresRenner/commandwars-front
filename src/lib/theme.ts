/**
 * Tema claro/oscuro: la clase `.dark` en <html> activa los tokens oscuros
 * definidos en index.css (§7 de CLAUDE.md). Oscuro por defecto.
 */

export type Theme = "dark" | "light"

const THEME_KEY = "command.theme"

export function getStoredTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"
}

export function setStoredTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme)
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

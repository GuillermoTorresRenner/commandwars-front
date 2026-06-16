import { Check, X } from "lucide-react"
import { passwordChecks } from "@/lib/password"
import { cn } from "@/lib/utils"

/**
 * Indicadores en vivo de contraseña segura: barra de fuerza + checklist de
 * criterios (los mismos que exige el backend).
 */
export function PasswordStrength({ password }: { password: string }) {
  const checks = passwordChecks(password)
  const passed = checks.filter((check) => check.ok).length
  const ratio = passed / checks.length

  const strengthLabel =
    ratio === 1 ? "Fuerte" : ratio >= 0.6 ? "Media" : password ? "Débil" : ""
  const barColor =
    ratio === 1 ? "bg-primary" : ratio >= 0.6 ? "bg-yellow-500" : "bg-destructive"

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        {strengthLabel && (
          <span className="text-muted-foreground w-12 text-right text-xs">
            {strengthLabel}
          </span>
        )}
      </div>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {checks.map((check) => (
          <li
            key={check.key}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              check.ok ? "text-primary" : "text-muted-foreground",
            )}
          >
            {check.ok ? (
              <Check className="size-3.5 shrink-0" />
            ) : (
              <X className="size-3.5 shrink-0" />
            )}
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

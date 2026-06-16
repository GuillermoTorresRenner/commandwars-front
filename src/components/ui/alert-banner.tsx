import { X, AlertTriangle, Info, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

type AlertVariant = "error" | "warning" | "success" | "info"

const ICONS = {
  error:   <AlertTriangle className="size-4 shrink-0" />,
  warning: <AlertTriangle className="size-4 shrink-0" />,
  success: <CheckCircle2  className="size-4 shrink-0" />,
  info:    <Info          className="size-4 shrink-0" />,
}

const STYLES: Record<AlertVariant, string> = {
  error:   "bg-destructive/10 border-destructive/40 text-destructive",
  warning: "bg-amber-500/10 border-amber-500/40 text-amber-400",
  success: "bg-emerald-500/10 border-emerald-500/40 text-emerald-400",
  info:    "bg-primary/10 border-primary/40 text-primary",
}

/**
 * Banner de alerta inline reutilizable (no bloquea, no es modal).
 * Uso:
 *   <AlertBanner message={error} onDismiss={() => setError(null)} />
 *   <AlertBanner message={error} variant="warning" />
 */
export function AlertBanner({
  message, variant = "error", onDismiss,
}: {
  message: string | null
  variant?: AlertVariant
  onDismiss?: () => void
}) {
  if (!message) return null
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
        STYLES[variant],
      )}
    >
      {ICONS[variant]}
      <span className="flex-1 leading-snug">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-auto -mr-0.5 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

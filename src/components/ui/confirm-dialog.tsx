import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

/**
 * Diálogo de confirmación reutilizable.
 * Uso:
 *   <ConfirmDialog
 *     open={open} onOpenChange={setOpen}
 *     title="¿Borrar todo?" description="Esta acción no se puede deshacer."
 *     confirmLabel="Borrar" variant="destructive"
 *     onConfirm={() => doSomething()}
 *   />
 */
export function ConfirmDialog({
  open, onOpenChange,
  title, description,
  confirmLabel = "Confirmar",
  cancelLabel  = "Cancelar",
  variant = "destructive",
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "destructive" | "default"
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={() => { onOpenChange(false); onConfirm() }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

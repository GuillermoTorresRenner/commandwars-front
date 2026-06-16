/**
 * Criterios de contraseña segura — espejo de la política del backend
 * (src/auth/password.policy.ts): el formulario los muestra como indicadores.
 */

export interface PasswordCheck {
  key: string
  label: string
  ok: boolean
}

export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { key: "length", label: "Al menos 8 caracteres", ok: password.length >= 8 },
    { key: "upper", label: "Una mayúscula", ok: /[A-Z]/.test(password) },
    { key: "lower", label: "Una minúscula", ok: /[a-z]/.test(password) },
    { key: "digit", label: "Un número", ok: /\d/.test(password) },
    { key: "symbol", label: "Un símbolo (p. ej. @ # !)", ok: /[^A-Za-z0-9]/.test(password) },
  ]
}

export function isStrongPassword(password: string): boolean {
  return passwordChecks(password).every((check) => check.ok)
}

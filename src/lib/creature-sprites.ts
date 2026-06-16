/**
 * Sprites placeholder SVG para criaturas en modo esquemático.
 * Cada SVG es un círculo de 64×64 con una silueta esquemática y color temático.
 * Reemplazar por spritesheets reales en fase de arte.
 */

function svg(content: string, bg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="32" fill="${bg}"/>
      ${content}
    </svg>`,
  )}`
}

// ── Paletas ───────────────────────────────────────────────────────────────
const C = {
  ash:    "#1a0a00",  // fondo facción Ceniza
  ember:  "#ff6a00",  // acento naranja
  lava:   "#ff2200",  // acento rojo vivo
  gold:   "#ffd166",  // acento dorado
  forest: "#0d1f0d",  // fondo facción Raíz
  green:  "#4caf50",  // acento verde
  bark:   "#8d6e3f",  // marrón corteza
  mist:   "#b0c4de",  // azul niebla
  white:  "#ffffff",
  smoke:  "#aaaaaa",
}

// ── Primitivas SVG ────────────────────────────────────────────────────────

/** Humanoide simple: cabeza + cuerpo + brazos */
function humanoid(bodyColor: string, accentColor: string, detail = ""): string {
  return `
    <circle cx="32" cy="18" r="8" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1.5"/>
    <rect x="22" y="28" width="20" height="18" rx="3" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1.5"/>
    <rect x="14" y="28" width="8" height="14" rx="2" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1"/>
    <rect x="42" y="28" width="8" height="14" rx="2" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1"/>
    <rect x="24" y="46" width="7" height="12" rx="2" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1"/>
    <rect x="33" y="46" width="7" height="12" rx="2" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1"/>
    ${detail}
  `
}

/** Bestia cuadrúpeda: lobo/oso */
function quadruped(bodyColor: string, accentColor: string, detail = ""): string {
  return `
    <ellipse cx="32" cy="35" rx="18" ry="12" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1.5"/>
    <circle cx="46" cy="26" r="9" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1.5"/>
    <polygon points="46,17 42,10 48,10" fill="${accentColor}"/>
    <polygon points="52,17 48,10 54,10" fill="${accentColor}"/>
    <rect x="16" y="44" width="6" height="12" rx="2" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1"/>
    <rect x="24" y="44" width="6" height="12" rx="2" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1"/>
    <rect x="34" y="44" width="6" height="12" rx="2" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1"/>
    <rect x="42" y="44" width="6" height="12" rx="2" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1"/>
    ${detail}
  `
}

/** Elemental: forma irregular con núcleo brillante */
function elemental(coreColor: string, outerColor: string): string {
  return `
    <polygon points="32,6 42,20 56,22 46,36 50,52 32,44 14,52 18,36 8,22 22,20"
      fill="${outerColor}" stroke="${coreColor}" stroke-width="1.5" opacity="0.9"/>
    <circle cx="32" cy="30" r="10" fill="${coreColor}" opacity="0.95"/>
    <circle cx="32" cy="30" r="5" fill="white" opacity="0.6"/>
  `
}

/** Gigante (2×2): figura grande que ocupa más espacio */
function giant(bodyColor: string, accentColor: string): string {
  return `
    <circle cx="32" cy="16" r="10" fill="${bodyColor}" stroke="${accentColor}" stroke-width="2"/>
    <rect x="18" y="28" width="28" height="22" rx="4" fill="${bodyColor}" stroke="${accentColor}" stroke-width="2"/>
    <rect x="6"  y="26" width="12" height="20" rx="3" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1.5"/>
    <rect x="46" y="26" width="12" height="20" rx="3" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1.5"/>
    <rect x="20" y="50" width="10" height="12" rx="2" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1.5"/>
    <rect x="34" y="50" width="10" height="12" rx="2" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1.5"/>
    <circle cx="32" cy="16" r="4" fill="${accentColor}" opacity="0.8"/>
  `
}

/** Espíritu: forma etérea con aura */
function spirit(coreColor: string, auraColor: string): string {
  return `
    <ellipse cx="32" cy="30" rx="16" ry="22" fill="${auraColor}" opacity="0.3"/>
    <ellipse cx="32" cy="30" rx="10" ry="16" fill="${coreColor}" opacity="0.6"/>
    <circle cx="32" cy="22" r="7" fill="${coreColor}" opacity="0.9"/>
    <circle cx="29" cy="21" r="2" fill="white" opacity="0.9"/>
    <circle cx="35" cy="21" r="2" fill="white" opacity="0.9"/>
    <ellipse cx="32" cy="44" rx="8" ry="4" fill="${auraColor}" opacity="0.4"/>
  `
}

/** Constructo: forma geométrica rígida */
function construct(bodyColor: string, accentColor: string): string {
  return `
    <rect x="20" y="10" width="24" height="20" rx="2" fill="${bodyColor}" stroke="${accentColor}" stroke-width="2"/>
    <rect x="18" y="30" width="28" height="20" rx="2" fill="${bodyColor}" stroke="${accentColor}" stroke-width="2"/>
    <rect x="10" y="28" width="8"  height="16" rx="1" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1.5"/>
    <rect x="46" y="28" width="8"  height="16" rx="1" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1.5"/>
    <rect x="22" y="50" width="8"  height="12" rx="1" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1.5"/>
    <rect x="34" y="50" width="8"  height="12" rx="1" fill="${bodyColor}" stroke="${accentColor}" stroke-width="1.5"/>
    <circle cx="32" cy="20" r="5" fill="${accentColor}" opacity="0.9"/>
    <line x1="24" y1="20" x2="40" y2="20" stroke="${accentColor}" stroke-width="1.5"/>
  `
}

// ── Sprites por criatura ──────────────────────────────────────────────────

export const CREATURE_SPRITES: Record<string, string> = {
  // ── Cónclave de la Ceniza ─────────────────────────────────────────────

  // Líderes
  "Sahir, Voz del Rescoldo": svg(
    humanoid("#3d1a00", C.gold,
      `<polygon points="32,4 28,14 36,14" fill="${C.gold}"/>
       <line x1="32" y1="14" x2="32" y2="28" stroke="${C.gold}" stroke-width="2"/>`),
    C.ash,
  ),
  "Brasa Primordial": svg(
    elemental(C.lava, "#ff4500"),
    "#200500",
  ),

  // Tropa
  "Acólito de Ceniza": svg(
    humanoid("#5a2a00", C.ember,
      `<line x1="32" y1="10" x2="32" y2="6" stroke="${C.ember}" stroke-width="2"/>
       <circle cx="32" cy="5" r="3" fill="${C.ember}"/>`),
    C.ash,
  ),
  "Centella": svg(
    elemental("#ffdd00", "#ff8c00"),
    "#1a1000",
  ),
  "Guardia Ígneo": svg(
    humanoid("#5a2a00", C.lava,
      `<rect x="14" y="26" width="4" height="22" rx="1" fill="${C.lava}"/>
       <polygon points="14,26 18,26 16,20" fill="${C.lava}"/>`),
    C.ash,
  ),
  "Tejedora de Humo": svg(
    humanoid("#3a3a3a", C.smoke,
      `<ellipse cx="32" cy="32" rx="18" ry="8" fill="${C.smoke}" opacity="0.25"/>
       <ellipse cx="32" cy="24" rx="12" ry="5" fill="${C.smoke}" opacity="0.2"/>`),
    "#111111",
  ),
  "Coloso de Magma": svg(
    giant("#8b2200", C.lava),
    "#200500",
  ),
  "Heraldo de Ascuas": svg(
    humanoid("#4a1500", C.gold,
      `<polygon points="26,4 32,0 38,4 36,10 28,10" fill="${C.gold}" opacity="0.9"/>`),
    C.ash,
  ),
  "Quemador de Almas": svg(
    humanoid("#2a0a00", "#cc0000",
      `<circle cx="32" cy="18" r="10" fill="none" stroke="#cc0000" stroke-width="1" opacity="0.5"/>
       <circle cx="32" cy="18" r="13" fill="none" stroke="#cc0000" stroke-width="0.8" opacity="0.3"/>`),
    "#0d0000",
  ),

  // ── Clan Raíz Profunda ────────────────────────────────────────────────

  // Líderes
  "Vetusta, Matriarca del Bosque": svg(
    humanoid("#2d4a1e", C.green,
      `<line x1="20" y1="28" x2="10" y2="18" stroke="${C.bark}" stroke-width="3"/>
       <circle cx="10" cy="16" r="5" fill="${C.green}" opacity="0.8"/>
       <line x1="44" y1="28" x2="54" y2="18" stroke="${C.bark}" stroke-width="3"/>
       <circle cx="54" cy="16" r="5" fill="${C.green}" opacity="0.8"/>`),
    C.forest,
  ),
  "Guerrero Ancestral": svg(
    humanoid("#3d2800", C.bark,
      `<rect x="10" y="24" width="5" height="28" rx="1" fill="${C.bark}"/>
       <rect x="8"  y="24" width="9" height="6"  rx="1" fill="${C.bark}"/>`),
    C.forest,
  ),

  // Tropa
  "Explorador Zarzal": svg(
    humanoid("#2a3d1a", C.green,
      `<line x1="50" y1="18" x2="50" y2="48" stroke="${C.bark}" stroke-width="2"/>
       <line x1="46" y1="24" x2="54" y2="24" stroke="${C.green}" stroke-width="1.5"/>`),
    C.forest,
  ),
  "Lobo de Musgo": svg(
    quadruped("#2a4a1a", C.green),
    C.forest,
  ),
  "Centinela de Corteza": svg(
    construct("#4a3010", C.bark),
    C.forest,
  ),
  "Astado Brumoso": svg(
    quadruped("#1a3a2a", C.mist,
      `<line x1="46" y1="17" x2="40" y2="6"  stroke="${C.mist}" stroke-width="2"/>
       <line x1="46" y1="17" x2="52" y2="6"  stroke="${C.mist}" stroke-width="2"/>
       <line x1="40" y1="10" x2="36" y2="4"  stroke="${C.mist}" stroke-width="1.5"/>
       <line x1="52" y1="10" x2="56" y2="4"  stroke="${C.mist}" stroke-width="1.5"/>`),
    "#050f0a",
  ),
  "Espíritu del Claro": svg(
    spirit("#c8f0ff", "#6ab8d4"),
    "#020d14",
  ),
  "Druida Mayor": svg(
    humanoid("#1e3d10", C.green,
      `<line x1="14" y1="28" x2="6"  y2="20" stroke="${C.bark}" stroke-width="3"/>
       <circle cx="6"  cy="18" r="4" fill="${C.green}" opacity="0.9"/>
       <circle cx="6"  cy="14" r="2" fill="${C.green}"/>
       <circle cx="2"  cy="17" r="2" fill="${C.green}"/>
       <circle cx="10" cy="14" r="2" fill="${C.green}"/>`),
    C.forest,
  ),
  "Oso Petrificado": svg(
    quadruped("#3d2800", C.bark,
      `<rect x="10" y="30" width="4" height="6" rx="1" fill="${C.bark}" opacity="0.7"/>
       <rect x="16" y="28" width="4" height="6" rx="1" fill="${C.bark}" opacity="0.7"/>
       <rect x="44" y="28" width="4" height="6" rx="1" fill="${C.bark}" opacity="0.7"/>`),
    "#1a1000",
  ),
}

/** Devuelve el sprite SVG de una criatura por nombre, o el placeholder genérico. */
export function getCreatureSprite(name: string): string {
  return CREATURE_SPRITES[name] ?? PLACEHOLDER_TOKEN
}

/** Placeholder genérico (igual que el del seed). */
export const PLACEHOLDER_TOKEN =
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="32" fill="#27272a"/>
      <circle cx="32" cy="22" r="10" fill="#71717a"/>
      <ellipse cx="32" cy="52" rx="16" ry="12" fill="#71717a"/>
    </svg>`,
  )}`

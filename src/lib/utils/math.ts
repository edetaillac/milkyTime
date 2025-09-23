// ===========================
// Fonctions mathématiques utilitaires
// ===========================

/**
 * Contraint une valeur entre un minimum et un maximum
 */
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/**
 * Arrondit une valeur au pas le plus proche
 */
export const roundToStep = (v: number, step = 5) => Math.round(v / step) * step

/**
 * Calcule la médiane d'un tableau de nombres
 */
export const median = (arr: number[]) => {
  if (arr.length === 0) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

/**
 * Calcule la déviation absolue médiane (MAD)
 */
export const mad = (arr: number[]) => {
  if (arr.length === 0) return 0
  const m = median(arr)
  const dev = arr.map((x) => Math.abs(x - m))
  return median(dev)
}

/**
 * Calcule la moyenne tronquée (retire les valeurs extrêmes)
 */
export const trimmedMean = (arr: number[], trimRatio = 0.2) => {
  if (arr.length === 0) return 0
  const s = [...arr].sort((a, b) => a - b)
  const k = Math.floor(trimRatio * s.length)
  const trimmed = s.slice(k, s.length - k)
  const base = trimmed.length > 0 ? trimmed : s
  return base.reduce((a, b) => a + b, 0) / base.length
}

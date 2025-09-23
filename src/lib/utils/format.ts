// ===========================
// Fonctions de formatage utilitaires
// ===========================

/**
 * Retourne la variante de badge appropriée selon le côté
 */
export const sideBadgeVariant = (side: string) => {
  if (side === "left") return "default"
  if (side === "right") return "secondary"
  if (side === "bottle") return "outline"
  return "secondary"
}

/**
 * Formate un intervalle en minutes vers un format lisible (ex: "1h30", "45min")
 */
export const formatTimeInterval = (minutes: number) => {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`
}

/**
 * Formate les valeurs d'axes Y pour les graphiques d'intervalles
 */
export const formatYAxisInterval = (value: number) => {
  if (value < 60) return `${value}min`
  const hours = Math.floor(value / 60)
  const remainingMinutes = value % 60
  if (remainingMinutes === 0) return `${hours}h`
  return `${hours}h${remainingMinutes.toString().padStart(2, "0")}`
}

/**
 * Formate une date selon les options spécifiées
 */
export const formatDate = (d: Date, opts: Intl.DateTimeFormatOptions = {}) => 
  d.toLocaleDateString("en-US", opts)

/**
 * Formate une heure selon les options spécifiées
 */
export const formatTime = (d: Date, opts: Intl.DateTimeFormatOptions = {}) => 
  d.toLocaleTimeString("en-US", opts)

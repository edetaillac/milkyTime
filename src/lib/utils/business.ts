// ===========================
// Fonctions de logique métier
// ===========================

/**
 * Calcule l'intervalle en minutes entre deux dates
 */
export const calculateInterval = (current: Date, previous: Date) =>
  Math.round((current.getTime() - previous.getTime()) / (1000 * 60))

/**
 * Détermine le créneau horaire pour une heure donnée
 */
export const getCurrentTimeSlot = (hour: number) => {
  if (hour >= 7 && hour < 9) return "7-9"
  if (hour >= 9 && hour < 12) return "9-12"
  if (hour >= 12 && hour < 15) return "12-15"
  if (hour >= 15 && hour < 18) return "15-18"
  if (hour >= 18 && hour < 21) return "18-21"
  if (hour >= 21 || hour < 7) return "21-7"
  return "7-9"
}

/**
 * Adapte les paramètres de prédiction selon l'âge du bébé et les données disponibles
 */
export const getAdaptiveParams = (totalLogsCount: number, ageWeeks: number) => {
  // CLAMP_MAX évolutif selon l'âge
  let clampMax: number
  if (ageWeeks >= 24) clampMax = 300  // 5h après 6 mois
  else if (ageWeeks >= 12) clampMax = 240  // 4h après 3 mois
  else if (ageWeeks >= 4) clampMax = 180  // 3h après 1 mois
  else clampMax = 150  // 2h30 pour nouveau-nés

  // MIN_SAMPLES adaptatif selon les données disponibles
  let minSamplesSlot: number
  if (totalLogsCount < 30) minSamplesSlot = 2
  else if (totalLogsCount < 100) minSamplesSlot = 3
  else minSamplesSlot = 4

  // Fenêtre temporelle adaptative selon l'âge et les données
  const timeWindow = ageWeeks < 4 ? 48 : 
                     totalLogsCount < 100 ? 72 : 
                     96

  return { clampMax, minSamplesSlot, timeWindow }
}

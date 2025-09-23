// ===========================
// Constantes pour l'application de tracking des tétées
// ===========================

// ===========================
// Libellés & couleurs
// ===========================

export const sideLabels = { 
  left: "Left", 
  right: "Right", 
  bottle: "Bottle" 
} as const

export const sideColors = { 
  left: "#ec4899", 
  right: "#8b5cf6", 
  bottle: "#10b981" 
} as const

// ===========================
// Réglages prédiction
// ===========================

export const PREDICTION = {
  TIME_WINDOW_HOURS: 72,
  MAX_INTERVALS: 50,
  MIN_SAMPLES_PER_SLOT: 3,
  MIN_SAMPLES_DAY_NIGHT: 8,
  ENABLE_WEEKEND_SPLIT_AFTER_DAYS: 14,
  OUTLIER_TRIM_RATIO: 0.20,
  CLAMP_MIN: 20,
  CLAMP_MAX: 180,
} as const

// Largeur de la "fenêtre probable" autour de l'intervalle attendu
export const PROB_WINDOW = {
  MIN: 30,
  MAX: 90,
  FLOOR_RATIO: 0.25,
  MAD_SCALE: 1.4826,
} as const

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

// ===========================
// Timings & durées
// ===========================

export const TIMINGS = {
  CONFETTI_DURATION_MS: 3000,
  CONFETTI_PARTICLE_INTERVAL_MS: 250,
  CONFETTI_SCRIPT_RELOAD_DELAY_MS: 100,
  BEDTIME_LOOKBACK_MS: 35 * 24 * 60 * 60 * 1000,
  RECORDS_LOOKBACK_MS: 30 * 24 * 60 * 60 * 1000,
  DATA_SYNC_DELAY_MS: 100,
  RECORD_CHECK_DELAY_MS: 500,
  DATA_POLLING_INTERVAL_MS: 300_000,
  SCROLL_RETRY_DELAYS_MS: [100, 500, 1000] as const,
} as const

// Largeur de la "fenêtre probable" autour de l'intervalle attendu
export const PROB_WINDOW = {
  MIN: 30,
  MAX: 90,
  FLOOR_RATIO: 0.25,
  MAD_SCALE: 1.4826,
} as const

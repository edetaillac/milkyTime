// ===========================
// Export centralisé des fonctions utilitaires
// ===========================

// Fonctions mathématiques
export { clamp, roundToStep, median, mad, trimmedMean } from './math'

// Fonctions de formatage
export { sideBadgeVariant, formatTimeInterval, formatYAxisInterval, formatDate, formatTime } from './format'

// Fonctions pour les graphiques
export { getYAxisTicks, getEvolutionYDomain, getXAxisTicks } from './charts'

// Fonctions de logique métier
export { calculateInterval, getCurrentTimeSlot, getAdaptiveParams } from './business'

// Fonctions de dates (âge bébé, nuit/jour)
export { calculateBabyAgeWeeksFromBirthDate, formatBabyAgeFromBirthDate, isNightHour } from './date'

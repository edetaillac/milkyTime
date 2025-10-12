// ===========================
// Types et interfaces pour l'application de tracking des tétées
// ===========================

// User interface
export interface User {
  id: string
  username: string
  password: string
  babyBirthDate: string // Format: YYYY-MM-DD
}

// ===========================
// Types principaux
// ===========================

export interface FoodLog {
  id: string
  side: "left" | "right" | "bottle"
  timestamp: string
  created_at: string
}

export interface FoodLogWithInterval extends FoodLog {
  intervalMinutes?: number
}

export interface RecordBroken {
  type: "day" | "night"
  recordLevel: "bronze" | "silver" | "gold"
  newRecord: number
  oldRecord: number
  improvement: number
  beatenRecords: string[] // Tous les records battus ["bronze", "silver"]
}

// ===========================
// Types pour les données de graphiques
// ===========================

export interface DailyStatsData {
  date: string
  left: number
  right: number
  bottle: number
  total: number
  dayKey?: string
  count?: number
  totalTime?: number
  avgInterval?: number
  isWeekend?: boolean
}

export interface IntervalChartData {
  time: string
  interval: number
  isNight: boolean
  // Champs optionnels selon les sources de données
  count?: number
  hour?: number
  timestamp?: string
  date?: string
  dateChanged?: boolean
  fullDate?: Date
  index?: number
  numericTime?: number
  side?: "left" | "right" | "bottle"
  trendLine?: number
  originalInterval?: number
}

export interface WeeklyMedianData {
  weekStart: string
  weekEnd: string
  weekNumber: string
  ageWeekIndex?: number
  dayMedianInterval: number
  nightMedianInterval: number
  dayCount: number
  nightCount: number
  dayAvgInterval: number
  nightAvgInterval: number
  dayMinInterval: number
  nightMinInterval: number
  dayMaxInterval: number
  nightMaxInterval: number
  dayCV: number
  nightCV: number
  dayStdDev: number
  nightStdDev: number
}

export interface Last7DaysData {
  date: string
  dayMedianInterval: number
  nightMedianInterval: number
  dayCount: number
  nightCount: number
  dayAvgInterval: number
  nightAvgInterval: number
  dayMinInterval: number
  nightMinInterval: number
  dayMaxInterval: number
  nightMaxInterval: number
  dayCV: number
  nightCV: number
  dayStdDev: number
  nightStdDev: number
}

export interface ApproachingRecord {
  timeRemaining: number
  isNight: boolean
  recordInterval: number
  nextRecordRank: string
  isApproaching: boolean
  allRecordsBroken: boolean
  beatenRecords: string[]
}

export interface SmartAlerts {
  nextFeedingPrediction: number | null
  sideRecommendation: "left" | "right" | null
  reliabilityIndex?: number | null
  isClusterFeeding?: boolean
}

// ===========================
// Types pour les fonctions utilitaires
// ===========================

export interface ProcessedIntervalData {
  interval: number
  isNight: boolean
  timestamp: string
  date: string
  time: string
  side?: "left" | "right" | "bottle"
  hour?: number
  dateChanged?: boolean
  fullDate?: Date
  index?: number
  numericTime?: number
  trendLine?: number
  originalInterval?: number
}

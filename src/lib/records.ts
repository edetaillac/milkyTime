import { type FoodLogWithInterval, type ProcessedIntervalData } from "./types"

export function getMinRecordThreshold(babyAgeWeeks: number): number {
  if (babyAgeWeeks < 4) return 30
  if (babyAgeWeeks < 12) return 45
  return 60
}

export function getRecordIndicator(
  log: FoodLogWithInterval,
  records: { day: ProcessedIntervalData[]; night: ProcessedIntervalData[] },
): string | null {
  if (!log.intervalMinutes || log.intervalMinutes <= 0) return null

  // Search both day and night records — classification is already done upstream
  const dayIndex = records.day.findIndex(
    (r: ProcessedIntervalData) => r.timestamp === log.timestamp && r.interval === log.intervalMinutes,
  )
  const nightIndex = records.night.findIndex(
    (r: ProcessedIntervalData) => r.timestamp === log.timestamp && r.interval === log.intervalMinutes,
  )

  if (dayIndex === -1 && nightIndex === -1) return null

  const isNight = nightIndex !== -1
  const recordIndex = isNight ? nightIndex : dayIndex
  const timeEmoji = isNight ? "🌙" : "☀️"
  const rankEmoji = ["🥇", "🥈", "🥉"][recordIndex] || ""
  return timeEmoji + rankEmoji
}



import { type FoodLogWithInterval, type ProcessedIntervalData } from "./types"
import { type DayNightSchedule, isNightHourWithSchedule } from "./scheduleConfig"

export function getMinRecordThreshold(babyAgeWeeks: number): number {
  if (babyAgeWeeks < 4) return 30
  if (babyAgeWeeks < 12) return 45
  return 60
}

export function getRecordIndicator(
  log: FoodLogWithInterval,
  records: { day: ProcessedIntervalData[]; night: ProcessedIntervalData[] },
  schedule: DayNightSchedule
): string | null {
  if (!log.intervalMinutes || log.intervalMinutes <= 0) return null
  const d = new Date(log.timestamp)
  const isNight = isNightHourWithSchedule(d, schedule)
  const relevant = isNight ? records.night : records.day
  if (relevant.length === 0) return null
  const recordIndex = relevant.findIndex(
    (r: ProcessedIntervalData) => r.timestamp === log.timestamp && r.interval === log.intervalMinutes,
  )
  if (recordIndex === -1) return null
  const timeEmoji = isNight ? "🌙" : "☀️"
  const rankEmoji = ["🥇", "🥈", "🥉"][recordIndex] || ""
  return timeEmoji + rankEmoji
}



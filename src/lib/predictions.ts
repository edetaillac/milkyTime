import { type FoodLogWithInterval } from "./types"
import { PREDICTION, PROB_WINDOW } from "./constants"
import { clamp, trimmedMean, mad, median } from "./utils/math"
import { getCurrentTimeSlot, getAdaptiveParams } from "./utils/business"

export interface ComputePredictionsInput {
  logs: FoodLogWithInterval[]
  totalLogsCount: number
  calculateBabyAgeWeeks: () => number
  now?: Date
  timeSinceMinutes?: number
}

export interface ComputePredictionsOutput {
  nextFeedingPrediction: number
  sideRecommendation: null
  probWindowMinutes: number
  expectedIntervalMinutes: number
  isLikelyWindow: boolean
  reliabilityIndex: number
  isClusterFeeding: boolean
}

export function computePredictions(input: ComputePredictionsInput): ComputePredictionsOutput | null {
  const { logs, totalLogsCount, calculateBabyAgeWeeks, now: nowArg, timeSinceMinutes } = input
  if (!logs || logs.length === 0) return null

  const last = logs[0]
  const lastTime = new Date(last.timestamp)
  // Si timeSinceMinutes est fourni, on l'utilise pour éviter toute dérive liée à l'horloge
  const timeSince =
    typeof timeSinceMinutes === 'number'
      ? Math.max(0, Math.floor(timeSinceMinutes))
      : Math.floor(((nowArg ?? new Date()).getTime() - lastTime.getTime()) / (1000 * 60))
  const now = nowArg ?? new Date(lastTime.getTime() + timeSince * 60 * 1000)

  const winStart = new Date(now.getTime() - PREDICTION.TIME_WINDOW_HOURS * 60 * 60 * 1000)
  const asc = [...logs]
    .map((l) => ({ ...l }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const inWindow = asc.filter((l) => new Date(l.timestamp) >= winStart)
  const seq = inWindow.length >= 2 ? inWindow : asc

  const intervalsAll: number[] = []
  const intervalsBySlot: Record<string, number[]> = {
    "7-9": [],
    "9-12": [],
    "12-15": [],
    "15-18": [],
    "18-21": [],
    "21-7": [],
  }
  const dayIntervals: number[] = []
  const nightIntervals: number[] = []

  for (let i = 1; i < seq.length; i++) {
    const current = new Date(seq[i].timestamp)
    const prev = new Date(seq[i - 1].timestamp)
    if (isNaN(current.getTime()) || isNaN(prev.getTime())) continue
    const interval = Math.floor((current.getTime() - prev.getTime()) / (1000 * 60))
    if (interval < 1 || interval > 1440) continue
    intervalsAll.push(interval)
    const hour = current.getHours()
    const slot = getCurrentTimeSlot(hour)
    intervalsBySlot[slot].push(interval)
    const isNightFeeding = hour >= 22 || hour < 7
    if (isNightFeeding) nightIntervals.push(interval)
    else dayIntervals.push(interval)
  }

  const weeks = calculateBabyAgeWeeks()
  const ageDefaults =
    weeks <= 4
      ? { day: 90, night: 180 }
      : weeks <= 12
      ? { day: 120, night: 240 }
      : weeks <= 24
      ? { day: 150, night: 300 }
      : { day: 180, night: 360 }

  const curHour = now.getHours()
  const curSlot = getCurrentTimeSlot(curHour)
  const isNightNow = curHour >= 22 || curHour < 7

  const adaptiveParams = getAdaptiveParams(totalLogsCount, weeks)

  let chosenIntervals: number[] | null = null
  if (intervalsBySlot[curSlot].length >= adaptiveParams.minSamplesSlot) {
    chosenIntervals = intervalsBySlot[curSlot]
  }
  if (!chosenIntervals) {
    const pool = isNightNow ? nightIntervals : dayIntervals
    if (pool.length >= PREDICTION.MIN_SAMPLES_DAY_NIGHT) chosenIntervals = pool
  }
  if (!chosenIntervals) {
    if (intervalsAll.length >= 2) chosenIntervals = intervalsAll
    else chosenIntervals = []
  }

  let expectedInterval: number
  let reliabilityIndex = 0

  if (intervalsAll.length < 10) {
    expectedInterval = isNightNow ? 150 : 100
    reliabilityIndex = 10
  } else if (chosenIntervals.length > 0) {
    expectedInterval = trimmedMean(chosenIntervals, PREDICTION.OUTLIER_TRIM_RATIO)
    expectedInterval = clamp(Math.round(expectedInterval), PREDICTION.CLAMP_MIN, adaptiveParams.clampMax)
  } else {
    expectedInterval = isNightNow ? ageDefaults.night : ageDefaults.day
  }

  const isClusterTime = curHour >= 17 && curHour <= 21
  const eveningAvg = intervalsBySlot["18-21"].length > 5 ? median(intervalsBySlot["18-21"]) : null
  if (isClusterTime && eveningAvg && eveningAvg < expectedInterval * 0.7) {
    expectedInterval = eveningAvg
  }

  const recentFeedingsCount = logs.filter((l) => {
    const feedingTime = new Date(l.timestamp)
    const hoursSince = (now.getTime() - feedingTime.getTime()) / (1000 * 60 * 60)
    return hoursSince <= 3
  }).length
  const isActiveClusterFeeding = isClusterTime && recentFeedingsCount >= 3

  if (expectedInterval <= 0) {
    expectedInterval = isNightNow ? ageDefaults.night : ageDefaults.day
  }

  const sigmaRobust = mad(chosenIntervals) * PROB_WINDOW.MAD_SCALE
  const floorByRatio = expectedInterval * PROB_WINDOW.FLOOR_RATIO
  let windowWidth = Math.max(sigmaRobust, floorByRatio, PROB_WINDOW.MIN)
  windowWidth = clamp(windowWidth, PROB_WINDOW.MIN, PROB_WINDOW.MAX)

  if (chosenIntervals.length > 0) {
    const variance =
      chosenIntervals.reduce((sum, val) => sum + Math.pow(val - expectedInterval, 2), 0) / chosenIntervals.length
    const coefficientOfVariation = Math.sqrt(variance) / expectedInterval
    windowWidth = windowWidth * (1 + coefficientOfVariation * 0.5)
    windowWidth = clamp(windowWidth, PROB_WINDOW.MIN, PROB_WINDOW.MAX)
  }

  const nextFeedingPrediction = Math.max(0, expectedInterval - timeSince)
  const windowStart = expectedInterval - windowWidth / 2
  const windowEnd = expectedInterval + windowWidth / 2
  const likely = timeSince >= windowStart && timeSince <= windowEnd

  if (reliabilityIndex === 0 && chosenIntervals.length > 0) {
    const sampleFactor = Math.min(chosenIntervals.length / 10, 1) * 0.4
    const variance =
      chosenIntervals.reduce((sum, val) => sum + Math.pow(val - expectedInterval, 2), 0) / chosenIntervals.length
    const coefficientOfVariation = Math.sqrt(variance) / expectedInterval
    const regularityFactor = Math.max(0, 1 - coefficientOfVariation) * 0.4
    const recencyFactor = inWindow.length >= seq.length * 0.7 ? 0.2 : 0.1
    reliabilityIndex = Math.min(sampleFactor + regularityFactor + recencyFactor, 1)
  }

  return {
    nextFeedingPrediction,
    sideRecommendation: null,
    probWindowMinutes: Math.round(windowWidth * 10) / 10,
    expectedIntervalMinutes: Math.round(expectedInterval * 10) / 10,
    isLikelyWindow: likely,
    reliabilityIndex: Math.round(reliabilityIndex * 100),
    isClusterFeeding: isActiveClusterFeeding,
  }
}

// ===========================
// Helpers dérivés pour l'UI
// ===========================

export function getPredictionPointColor(
  timeSinceLast: number | null,
  expectedIntervalMinutes: number | null,
  probWindowMinutes: number | null,
): string {
  if (timeSinceLast === null || expectedIntervalMinutes === null || probWindowMinutes === null) return "#ef4444"
  const windowStart = expectedIntervalMinutes - probWindowMinutes / 2
  const windowEnd = expectedIntervalMinutes + probWindowMinutes / 2
  const inWindow = timeSinceLast >= windowStart && timeSinceLast <= windowEnd
  return inWindow ? "#3b82f6" : "#ef4444"
}

export function getStablePointPosition(timeSinceLast: number | null): number {
  if (timeSinceLast === null) return 0
  return Math.round(timeSinceLast)
}

export function getPredictionLegend(
  logs: { timestamp: string }[],
  expectedIntervalMinutes: number | null,
  probWindowMinutes: number | null,
): { start: string; end: string } {
  if (!logs.length || !expectedIntervalMinutes || !probWindowMinutes) return { start: "", end: "" }
  const lastFeedingTime = new Date(logs[0].timestamp)
  const startTime = new Date(
    lastFeedingTime.getTime() + (expectedIntervalMinutes - probWindowMinutes / 2) * 60 * 1000,
  )
  const endTime = new Date(
    lastFeedingTime.getTime() + (expectedIntervalMinutes + probWindowMinutes / 2) * 60 * 1000,
  )
  return {
    start: startTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    end: endTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  }
}



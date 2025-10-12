import { type FoodLog } from "./types"

const ANALYSIS_DAYS = 30
const MIN_SAMPLE_SIZE = 10
const MIN_BABY_AGE_WEEKS = 10
const NIGHT_GAP_MINUTES = 4 * 60
const EVENING_THRESHOLD_MINUTES = 17 * 60

const SUMMARY_BUCKETS = [
  { key: "before20", min: 0, max: 20 * 60 },
  { key: "20-21", min: 20 * 60, max: 21 * 60 },
  { key: "21-22", min: 21 * 60, max: 22 * 60 },
  { key: "after22", min: 22 * 60, max: Number.POSITIVE_INFINITY },
] as const

const EVENING_BUCKETS = [
  { key: "18-19", min: 18 * 60, max: 19 * 60 },
  { key: "19-20", min: 19 * 60, max: 20 * 60 },
  { key: "20-21", min: 20 * 60, max: 21 * 60 },
  { key: "21-22", min: 21 * 60, max: 22 * 60 },
  { key: "22-23", min: 22 * 60, max: 23 * 60 },
  { key: ">=23", min: 23 * 60, max: Number.POSITIVE_INFINITY },
] as const

export type BedtimeBucketKey = typeof SUMMARY_BUCKETS[number]["key"]
export type EveningBucketKey = typeof EVENING_BUCKETS[number]["key"]

export interface BedtimeBucketStats {
  total: number
  success: number
}

export interface BedtimePredictionInput {
  logs: FoodLog[]
  babyAgeWeeks: number
  now?: Date
  timezone?: string
}

export interface BedtimePredictionLearning {
  status: "too-young" | "learning" | "not-enough-data"
  sampleSize: number
  requiredSampleSize: number
  nightsRemaining: number
  analysisStart: Date
  analysisEnd: Date
  timezone: string
}

export interface BedtimePredictionReady {
  status: "ready"
  sampleSize: number
  analysisStart: Date
  analysisEnd: Date
  timezone: string
  windowStartMinutes: number
  windowEndMinutes: number
  medianMinutes: number
  reliability: number
  averageGapMinutes: number
  medianGapMinutes: number
  medianSincePrevMinutes?: number
  summaryBuckets: Record<BedtimeBucketKey, BedtimeBucketStats>
  eveningBuckets: Record<EveningBucketKey, BedtimeBucketStats>
  recentSamples: Array<{ localISO: string; gapMinutes: number; sincePrevMinutes?: number }>
}

export type BedtimePredictionResult = BedtimePredictionLearning | BedtimePredictionReady

export const BEDTIME_ANALYSIS_DAYS = ANALYSIS_DAYS
export const BEDTIME_MIN_SAMPLE_SIZE = MIN_SAMPLE_SIZE
export const BEDTIME_MIN_AGE_WEEKS = MIN_BABY_AGE_WEEKS
export const BEDTIME_MIN_GAP_MINUTES = NIGHT_GAP_MINUTES

interface ZonedInfo {
  dateKey: string
  minutesSinceMidnight: number
  isoLocal: string
  hour: number
  minute: number
}

const createZonedFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

const toZonedInfo = (date: Date, formatter: Intl.DateTimeFormat): ZonedInfo => {
  const parts = formatter.formatToParts(date)
  const lookup = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00"
  const year = lookup("year")
  const month = lookup("month")
  const day = lookup("day")
  const hour = lookup("hour")
  const minute = lookup("minute")
  const dateKey = `${year}-${month}-${day}`
  const minutesSinceMidnight = Number.parseInt(hour, 10) * 60 + Number.parseInt(minute, 10)
  const isoLocal = `${dateKey}T${hour}:${minute}`
  return {
    dateKey,
    minutesSinceMidnight,
    isoLocal,
    hour: Number.parseInt(hour, 10),
    minute: Number.parseInt(minute, 10),
  }
}

const median = (values: number[]) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

const percentile = (values: number[], p: number) => {
  if (values.length === 0) return 0
  if (p <= 0) return Math.min(...values)
  if (p >= 1) return Math.max(...values)
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (sorted.length - 1) * p
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  const weight = idx - lower
  if (upper >= sorted.length) return sorted[lower]
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

const average = (values: number[]) => {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function computeBedtimeWindow(input: BedtimePredictionInput): BedtimePredictionResult {
  const { logs, babyAgeWeeks, now = new Date(), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone } = input
  const analysisEnd = now
  const analysisStart = new Date(now.getTime() - ANALYSIS_DAYS * 24 * 60 * 60 * 1000)

  if (babyAgeWeeks < MIN_BABY_AGE_WEEKS) {
    return {
      status: "too-young",
      sampleSize: 0,
      requiredSampleSize: MIN_SAMPLE_SIZE,
      nightsRemaining: MIN_SAMPLE_SIZE,
      analysisStart,
      analysisEnd,
      timezone,
    }
  }

  const formatter = createZonedFormatter(timezone)
  const filtered = logs
    .map((log) => ({ ...log, date: new Date(log.timestamp) }))
    .filter((item) => !Number.isNaN(item.date.getTime()) && item.date >= analysisStart)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  if (filtered.length < 2) {
    return {
      status: "not-enough-data",
      sampleSize: 0,
      requiredSampleSize: MIN_SAMPLE_SIZE,
      nightsRemaining: MIN_SAMPLE_SIZE,
      analysisStart,
      analysisEnd,
      timezone,
    }
  }

  type WorkingEntry = {
    utcDate: Date
    zoned: ZonedInfo
    gapMinutes?: number
    sincePrevMinutes?: number
    nextZoned?: ZonedInfo
  }

  const working: WorkingEntry[] = filtered.map((item) => ({
    utcDate: item.date,
    zoned: toZonedInfo(item.date, formatter),
  }))

  for (let i = 0; i < working.length; i += 1) {
    const entry = working[i]
    const prev = working[i - 1]
    const next = working[i + 1]
    if (prev) {
      entry.sincePrevMinutes = Math.max(0, Math.round((entry.utcDate.getTime() - prev.utcDate.getTime()) / 60000))
    }
    if (next) {
      entry.nextZoned = toZonedInfo(next.utcDate, formatter)
      entry.gapMinutes = Math.max(0, Math.round((next.utcDate.getTime() - entry.utcDate.getTime()) / 60000))
    }
  }

  const summaryBuckets: Record<BedtimeBucketKey, BedtimeBucketStats> = SUMMARY_BUCKETS.reduce(
    (acc, bucket) => ({ ...acc, [bucket.key]: { total: 0, success: 0 } }),
    {} as Record<BedtimeBucketKey, BedtimeBucketStats>,
  )
  const eveningBuckets: Record<EveningBucketKey, BedtimeBucketStats> = EVENING_BUCKETS.reduce(
    (acc, bucket) => ({ ...acc, [bucket.key]: { total: 0, success: 0 } }),
    {} as Record<EveningBucketKey, BedtimeBucketStats>,
  )

  const candidates: Array<{ entry: WorkingEntry; gapMinutes: number }> = []

  const registerBucket = (minutes: number, qualifies: boolean) => {
    for (const bucket of SUMMARY_BUCKETS) {
      if (minutes >= bucket.min && minutes < bucket.max) {
        summaryBuckets[bucket.key].total += 1
        if (qualifies) summaryBuckets[bucket.key].success += 1
        break
      }
    }
    for (const bucket of EVENING_BUCKETS) {
      if (minutes >= bucket.min && minutes < bucket.max) {
        eveningBuckets[bucket.key].total += 1
        if (qualifies) eveningBuckets[bucket.key].success += 1
        break
      }
    }
  }

  for (const entry of working) {
    if (!entry.gapMinutes || !entry.nextZoned) {
      if (entry.zoned.minutesSinceMidnight >= EVENING_THRESHOLD_MINUTES) registerBucket(entry.zoned.minutesSinceMidnight, false)
      continue
    }
    const qualifiesGap = entry.gapMinutes >= NIGHT_GAP_MINUTES
    const crossesMidnight = entry.nextZoned.dateKey !== entry.zoned.dateKey
    const isEvening = entry.zoned.minutesSinceMidnight >= EVENING_THRESHOLD_MINUTES
    const qualifies = qualifiesGap && (isEvening || crossesMidnight)

    if (isEvening || qualifies) {
      registerBucket(entry.zoned.minutesSinceMidnight, qualifies)
    }

    if (qualifies) {
      candidates.push({ entry, gapMinutes: entry.gapMinutes })
    }
  }

  const sampleSize = candidates.length
  const nightsRemaining = Math.max(0, MIN_SAMPLE_SIZE - sampleSize)

  if (sampleSize < MIN_SAMPLE_SIZE) {
    return {
      status: "learning",
      sampleSize,
      requiredSampleSize: MIN_SAMPLE_SIZE,
      nightsRemaining,
      analysisStart,
      analysisEnd,
      timezone,
    }
  }

  const bedtimeMinutes = candidates.map((item) => item.entry.zoned.minutesSinceMidnight)
  const gapMinutes = candidates.map((item) => item.gapMinutes)
  const sincePrev = candidates
    .map((item) => item.entry.sincePrevMinutes)
    .filter((value): value is number => typeof value === "number")

  const q1 = percentile(bedtimeMinutes, 0.25)
  const q3 = percentile(bedtimeMinutes, 0.75)
  const iqr = q3 - q1
  const sampleFactor = Math.min(sampleSize / 20, 1)
  const spreadFactor = Math.max(0, 1 - iqr / 120)
  const reliability = Math.round((sampleFactor * 0.5 + spreadFactor * 0.5) * 100)

  const recentSamples = candidates.slice(-5).map((item) => ({
    localISO: item.entry.zoned.isoLocal,
    gapMinutes: item.gapMinutes,
    sincePrevMinutes: item.entry.sincePrevMinutes,
  }))

  return {
    status: "ready",
    sampleSize,
    analysisStart,
    analysisEnd,
    timezone,
    windowStartMinutes: Math.round(q1),
    windowEndMinutes: Math.round(q3),
    medianMinutes: Math.round(median(bedtimeMinutes)),
    reliability,
    averageGapMinutes: average(gapMinutes),
    medianGapMinutes: median(gapMinutes),
    medianSincePrevMinutes: sincePrev.length > 0 ? median(sincePrev) : undefined,
    summaryBuckets,
    eveningBuckets,
    recentSamples,
  }
}

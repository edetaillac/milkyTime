import {
  fetchLogsWithOptions as fetchLogsWithOptionsSupabase,
  fetchTodayCount as fetchTodayCountSupabase,
  fetchTotalLogsCount as fetchTotalLogsCountSupabase,
} from "../lib/supabase"
import {
  type DailyStatsData,
  type FoodLog,
  type Last7DaysData,
  type ProcessedIntervalData,
  type WeeklyMedianData,
  isNightHour,
} from "../lib"
import { type DayNightSchedule, isNightHourWithSchedule, getScheduleForAge } from "../lib/scheduleConfig"

type FetchOptions = {
  orderBy?: string
  ascending?: boolean
  limit?: number
  startDate?: Date
  endDate?: Date
}

type IntervalPeriod = "24h" | "48h" | "72h" | "7d"

// Constants removed - now using schedule parameter from scheduleConfig

const pad2 = (value: number) => value.toString().padStart(2, "0")

const isoDayKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

const frShortDayLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "2-digit" }).replace(/\.$/, "")

const buildDailySeries = (logs: FoodLog[], start: Date, end: Date): DailyStatsData[] => {
  const map: Record<string, { left: number; right: number; bottle: number }> = {}

  for (const log of logs) {
    const current = new Date(log.timestamp)
    const key = isoDayKey(current)
    if (!map[key]) {
      map[key] = { left: 0, right: 0, bottle: 0 }
    }
    map[key][log.side] += 1
  }

  const result: DailyStatsData[] = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const endCopy = new Date(end)
  endCopy.setHours(0, 0, 0, 0)

  while (cursor <= endCopy) {
    const key = isoDayKey(cursor)
    const buckets = map[key] ?? { left: 0, right: 0, bottle: 0 }
    result.push({
      dayKey: key,
      date: frShortDayLabel(cursor),
      left: buckets.left,
      right: buckets.right,
      bottle: buckets.bottle,
      total: buckets.left + buckets.right + buckets.bottle,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return result
}

const processIntervalData = (logs: FoodLog[], period: IntervalPeriod, schedule: DayNightSchedule): ProcessedIntervalData[] => {
  const sorted = logs
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const intervalData: ProcessedIntervalData[] = []

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index]
    const previous = sorted[index - 1]
    const currentDate = new Date(current.timestamp)
    const previousDate = new Date(previous.timestamp)

    const intervalMinutes = Math.round((currentDate.getTime() - previousDate.getTime()) / (1000 * 60))
    const dateChanged = currentDate.toDateString() !== previousDate.toDateString()

    let timeLabel: string
    if (period === "48h") {
      timeLabel = dateChanged
        ? `${currentDate.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })} ${currentDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
        : currentDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    } else {
      timeLabel = `${currentDate.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })} ${currentDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
    }

    intervalData.push({
      date: currentDate.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      time: timeLabel,
      interval: intervalMinutes,
      hour: currentDate.getHours(),
      isNight: isNightHourWithSchedule(currentDate, schedule),
      timestamp: current.timestamp,
      dateChanged,
      fullDate: currentDate,
      index: index - 1,
      numericTime: currentDate.getTime(),
      side: current.side,
    })
  }

  if (intervalData.length >= 2) {
    const n = intervalData.length
    const sumX = intervalData.reduce((sum, _point, idx) => sum + idx, 0)
    const sumY = intervalData.reduce((sum, point) => sum + point.interval, 0)
    const sumXY = intervalData.reduce((sum, point, idx) => sum + idx * point.interval, 0)
    const sumXX = intervalData.reduce((sum, _point, idx) => sum + idx * idx, 0)
    const denominator = n * sumXX - sumX * sumX

    if (denominator !== 0) {
      const slope = (n * sumXY - sumX * sumY) / denominator
      const intercept = (sumY - slope * sumX) / n
      intervalData.forEach((point, idx) => {
        point.trendLine = slope * idx + intercept
      })
    }
  }

  return intervalData
}

const getIntervalRangeStart = (period: IntervalPeriod) => {
  const start = new Date()
  switch (period) {
    case "24h":
      start.setDate(start.getDate() - 1)
      break
    case "72h":
      start.setDate(start.getDate() - 3)
      break
    case "7d":
      start.setDate(start.getDate() - 7)
      break
    default:
      break
  }
  return start
}

const getISOWeek = (date: Date) => {
  const clone = new Date(date.getTime())
  clone.setHours(0, 0, 0, 0)
  const dayOfWeek = clone.getDay()
  const daysToThursday = dayOfWeek === 0 ? 4 : 4 - dayOfWeek
  clone.setDate(clone.getDate() + daysToThursday)

  const yearStart = new Date(clone.getFullYear(), 0, 1)
  return Math.ceil((((clone.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

const getWeekStart = (date: Date) => {
  const weekStart = new Date(date)
  const dayOfWeek = weekStart.getDay()
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  weekStart.setDate(weekStart.getDate() - daysToSubtract)
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

export async function fetchLogsWithOptions(options: FetchOptions = {}, userId: string) {
  try {
    return await fetchLogsWithOptionsSupabase(options, userId)
  } catch (error) {
    console.error("Erreur Supabase (data retrieval):", error)
    throw error
  }
}

export async function fetchTodayCount(userId: string) {
  try {
    return await fetchTodayCountSupabase(userId)
  } catch (error) {
    console.error("Erreur Supabase (today count):", error)
    throw error
  }
}

export async function fetchTotalLogsCount(userId: string) {
  try {
    return await fetchTotalLogsCountSupabase(userId)
  } catch (error) {
    console.error("Erreur Supabase (total logs count):", error)
    throw error
  }
}

export async function fetchDailyStatsRange(userId: string, days: number): Promise<DailyStatsData[]> {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)

  const logs = await fetchLogsWithOptions({ startDate: start, orderBy: "timestamp", ascending: true }, userId)
  return buildDailySeries(logs as FoodLog[], start, end)
}

export async function fetchIntervalChartData(userId: string, period: IntervalPeriod, schedule: DayNightSchedule): Promise<ProcessedIntervalData[]> {
  const startDate = getIntervalRangeStart(period)
  const logs = await fetchLogsWithOptions({ startDate, orderBy: "timestamp", ascending: true }, userId)
  return processIntervalData(logs as FoodLog[], period, schedule)
}

export async function calculateWeeklyMedianData(userId: string, babyBirthDate?: string): Promise<WeeklyMedianData[]> {
  try {
    const twentyFourWeeksAgo = new Date()
    twentyFourWeeksAgo.setDate(twentyFourWeeksAgo.getDate() - 168)
    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999) // Include the entire current day

    const logs = await fetchLogsWithOptions(
      {
        startDate: twentyFourWeeksAgo,
        endDate,
        orderBy: "timestamp",
        ascending: false, // Get most recent logs first to avoid 1000-row limit
      },
      userId,
    )

    if (logs.length < 2) {
      return []
    }

    const sorted = logs
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const birthDate = (() => {
      if (!babyBirthDate) return null
      const parts = babyBirthDate.split("-")
      if (parts.length !== 3) return null
      const [year, month, day] = parts.map((part) => parseInt(part, 10))
      if ([year, month, day].some((value) => Number.isNaN(value))) return null
      const parsed = new Date(year, month - 1, day)
      if (Number.isNaN(parsed.getTime())) return null
      parsed.setHours(0, 0, 0, 0)
      return parsed
    })()

    const buildWeekInfo = (referenceDate: Date) => {
      if (birthDate) {
        const diffMs = referenceDate.getTime() - birthDate.getTime()
        if (diffMs >= 0) {
          const weekIndex = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
          const computedStart = new Date(birthDate)
          computedStart.setDate(computedStart.getDate() + weekIndex * 7)
          computedStart.setHours(0, 0, 0, 0)
          const computedEnd = new Date(computedStart)
          computedEnd.setDate(computedEnd.getDate() + 6)
          const computedEndCopy = new Date(computedEnd)
          computedEndCopy.setHours(23, 59, 59, 999)
          return {
            key: `birth-${weekIndex}`,
            weekStartDate: computedStart,
            weekEndDate: computedEndCopy,
            weekNumber: `W${(weekIndex + 1).toString().padStart(2, "0")}`,
            sortKey: computedStart.getTime(),
            ageWeekIndex: weekIndex,
          }
        }
      }

      const weekStart = getWeekStart(referenceDate)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const weekNumber = getISOWeek(weekStart)
      return {
        key: `${weekStart.getFullYear()}-${pad2(weekStart.getMonth() + 1)}-${pad2(weekStart.getDate())}`,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        weekNumber: `${weekStart.getFullYear()}W${weekNumber.toString().padStart(2, "0")}`,
        sortKey: weekStart.getTime(),
        ageWeekIndex: undefined,
      }
    }

    const weeklyData: Record<
      string,
      {
        day: number[]
        night: number[]
        feedingCount: number
        meta: {
          weekStartDate: Date
          weekEndDate: Date
          weekNumber: string
          sortKey: number
          ageWeekIndex?: number
        }
      }
    > = {}

    // First pass: create buckets for all weeks that have feedings
    for (let index = 0; index < sorted.length; index += 1) {
      const currentFeeding = sorted[index]
      const currentDate = new Date(currentFeeding.timestamp)
      const weekInfo = buildWeekInfo(currentDate)
      if (!weekInfo) {
        continue
      }

      // Ensure bucket exists for this week
      if (!weeklyData[weekInfo.key]) {
        weeklyData[weekInfo.key] = {
          day: [],
          night: [],
          feedingCount: 0,
          meta: {
            weekStartDate: weekInfo.weekStartDate,
            weekEndDate: weekInfo.weekEndDate,
            weekNumber: weekInfo.weekNumber,
            sortKey: weekInfo.sortKey,
            ageWeekIndex: weekInfo.ageWeekIndex,
          },
        }
      }

      // Count the feeding
      weeklyData[weekInfo.key].feedingCount += 1
    }

    // Second pass: calculate intervals between consecutive feedings
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const currentFeeding = sorted[index]
      const previousFeeding = sorted[index + 1]
      const currentDate = new Date(currentFeeding.timestamp)
      const previousDate = new Date(previousFeeding.timestamp)
      const weekInfo = buildWeekInfo(currentDate)

      if (!weekInfo) {
        continue
      }

      const interval = Math.round((currentDate.getTime() - previousDate.getTime()) / (1000 * 60))
      const bucket = weeklyData[weekInfo.key]

      if (bucket && interval > 0) {
        // Get the schedule for this specific week's age
        const weekAgeWeeks = weekInfo.ageWeekIndex ?? 0
        const weekSchedule = getScheduleForAge(weekAgeWeeks)

        // Un écart est "nuit" si le biberon précédent OU le biberon actuel est de nuit
        const isNightInterval = isNightHourWithSchedule(previousDate, weekSchedule) || isNightHourWithSchedule(currentDate, weekSchedule)

        if (isNightInterval) {
          bucket.night.push(interval)
        } else {
          bucket.day.push(interval)
        }
      }
    }

    const weeklyStats: WeeklyMedianData[] = Object.values(weeklyData)
      .filter((data) => data.feedingCount >= 1)
      .map((data) => {
        const dayIntervals = data.day.sort((a, b) => a - b)
        const nightIntervals = data.night.sort((a, b) => a - b)

        const getMedian = (values: number[]) => {
          if (values.length === 0) return 0
          const medianIndex = Math.floor(values.length / 2)
          return values.length % 2 === 0
            ? (values[medianIndex - 1] + values[medianIndex]) / 2
            : values[medianIndex]
        }

        const getAverage = (values: number[]) =>
          values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

        const getStdDev = (values: number[]) => {
          if (values.length <= 1) return 0
          const avg = getAverage(values)
          const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1)
          return Math.sqrt(variance)
        }

        const mapData = (values: number[]) => {
          const average = getAverage(values)
          const stdDev = getStdDev(values)
          const cv = average > 0 ? (stdDev / average) * 100 : 0
          return {
            median: getMedian(values),
            average: Math.round(average),
            min: values.length > 0 ? Math.min(...values) : 0,
            max: values.length > 0 ? Math.max(...values) : 0,
            cv: Math.round(cv * 10) / 10,
            stdDev: Math.round(stdDev),
          }
        }

        const dayStats = mapData(dayIntervals)
        const nightStats = mapData(nightIntervals)
        const { weekStartDate, weekEndDate, weekNumber, sortKey, ageWeekIndex } = data.meta

        return {
          weekStart: weekStartDate.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" }),
          weekEnd: weekEndDate.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" }),
          weekNumber,
          ageWeekIndex,
          dayMedianInterval: dayIntervals.length > 0 ? dayStats.median : 0,
          nightMedianInterval: nightIntervals.length > 0 ? nightStats.median : 0,
          dayCount: dayIntervals.length,
          nightCount: nightIntervals.length,
          dayAvgInterval: dayStats.average,
          nightAvgInterval: nightStats.average,
          dayMinInterval: dayStats.min,
          nightMinInterval: nightStats.min,
          dayMaxInterval: dayStats.max,
          nightMaxInterval: nightStats.max,
          dayCV: dayStats.cv,
          nightCV: nightStats.cv,
          dayStdDev: dayStats.stdDev,
          nightStdDev: nightStats.stdDev,
          sortKey,
        }
      })
      .sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0))
      .map(({ sortKey: _sortKey, ...rest }) => rest)

    return weeklyStats
  } catch (error) {
    console.error("Error calculating weekly median data:", error)
    return []
  }
}

export async function calculateLast7DaysMedianData(userId: string, schedule: DayNightSchedule): Promise<Last7DaysData[]> {
  try {
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const endDate = new Date()

    const logs = await fetchLogsWithOptions(
      {
        startDate: fourteenDaysAgo,
        endDate,
        orderBy: "timestamp",
        ascending: true,
      },
      userId,
    )

    if (logs.length < 2) {
      return []
    }

    const sorted = logs
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const dailyData: Record<
      string,
      {
        dayIntervals: number[]
        nightIntervals: number[]
        dayFeedings: number
        nightFeedings: number
      }
    > = {}

    for (let index = 0; index < sorted.length; index += 1) {
      const feeding = sorted[index]
      const feedingTime = new Date(feeding.timestamp)
      const isNight = isNightHourWithSchedule(feedingTime, schedule)

      const year = feedingTime.getFullYear()
      const month = feedingTime.getMonth()
      const day = feedingTime.getDate()
      const dateForStats = new Date(year, month, day)

      // If it's night feeding, it belongs to the next day's stats
      if (isNight && feedingTime.getHours() >= schedule.nightStartHour) {
        dateForStats.setDate(dateForStats.getDate() + 1)
      }

      const dateKey = `${dateForStats.getFullYear()}-${pad2(dateForStats.getMonth() + 1)}-${pad2(dateForStats.getDate())}`

      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { dayIntervals: [], nightIntervals: [], dayFeedings: 0, nightFeedings: 0 }
      }

      if (!isNight) {
        dailyData[dateKey].dayFeedings += 1
      } else {
        dailyData[dateKey].nightFeedings += 1
      }
    }

    for (let index = 0; index < sorted.length - 1; index += 1) {
      const current = sorted[index]
      const next = sorted[index + 1]
      const currentTime = new Date(current.timestamp)
      const nextTime = new Date(next.timestamp)
      const interval = (currentTime.getTime() - nextTime.getTime()) / (1000 * 60)

      // Un écart est "nuit" si le biberon précédent OU le biberon actuel est de nuit
      const isCurrentNight = isNightHourWithSchedule(currentTime, schedule)
      const isPreviousNight = isNightHourWithSchedule(nextTime, schedule)
      const isDay = !isCurrentNight && !isPreviousNight

      const year = currentTime.getFullYear()
      const month = currentTime.getMonth()
      const day = currentTime.getDate()
      const dateForStats = new Date(year, month, day)

      if (isCurrentNight && currentTime.getHours() >= schedule.nightStartHour) {
        dateForStats.setDate(dateForStats.getDate() + 1)
      }

      const dateKey = `${dateForStats.getFullYear()}-${pad2(dateForStats.getMonth() + 1)}-${pad2(dateForStats.getDate())}`

      if (dailyData[dateKey]) {
        if (isDay) {
          dailyData[dateKey].dayIntervals.push(interval)
        } else {
          dailyData[dateKey].nightIntervals.push(interval)
        }
      }
    }

    const stats: Last7DaysData[] = Object.entries(dailyData)
      .filter(([, data]) => data.dayIntervals.length >= 1 || data.nightIntervals.length >= 1)
      .map(([dateKey, data]) => {
        const buildStats = (values: number[]) => {
          const sortedValues = values.slice().sort((a, b) => a - b)
          const medianIndex = Math.floor(sortedValues.length / 2)
          const median =
            sortedValues.length > 0
              ? Math.round(
                  (sortedValues.length % 2 === 0
                    ? (sortedValues[medianIndex - 1] + sortedValues[medianIndex]) / 2
                    : sortedValues[medianIndex]) * 10,
                ) / 10
              : 0
          const average =
            sortedValues.length > 0
              ? Math.round((sortedValues.reduce((sum, value) => sum + value, 0) / sortedValues.length) * 10) / 10
              : 0
          const min =
            sortedValues.length > 0 ? Math.round(Math.min(...sortedValues) * 10) / 10 : 0
          const max =
            sortedValues.length > 0 ? Math.round(Math.max(...sortedValues) * 10) / 10 : 0
          const stdDev =
            sortedValues.length > 1
              ? Math.round(
                  Math.sqrt(
                    sortedValues.reduce(
                      (sum, value) => sum + (value - average) ** 2,
                      0,
                    ) / sortedValues.length,
                  ) * 10,
                ) / 10
              : 0
          const cv = average > 0 ? Math.round((stdDev / average) * 100 * 10) / 10 : 0
          return { median, average, min, max, stdDev, cv }
        }

        const dayStats = buildStats(data.dayIntervals)
        const nightStats = buildStats(data.nightIntervals)

        return {
          date: dateKey,
          dayMedianInterval: dayStats.average,
          nightMedianInterval: nightStats.average,
          dayCount: data.dayFeedings,
          nightCount: data.nightFeedings,
          dayAvgInterval: dayStats.average,
          nightAvgInterval: nightStats.average,
          dayMinInterval: dayStats.min,
          nightMinInterval: nightStats.min,
          dayMaxInterval: dayStats.max,
          nightMaxInterval: nightStats.max,
          dayCV: dayStats.cv,
          nightCV: nightStats.cv,
          dayStdDev: dayStats.stdDev,
          nightStdDev: nightStats.stdDev,
        }
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .filter((item) => {
        const itemDate = new Date(item.date)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        return itemDate >= sevenDaysAgo
      })

    return stats
  } catch (error) {
    console.error("Error calculating last 7 days data:", error)
    return []
  }
}

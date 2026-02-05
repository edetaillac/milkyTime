/**
 * Schedule Configuration Module
 *
 * Centralizes day/night schedule logic with age-based presets.
 * Automatically adjusts night start time based on baby's age:
 * - 0-3 months: Night starts at 21:00
 * - 3-6 months: Night starts at 20:00
 * - 6-12 months: Night starts at 19:30
 * - 12+ months: Night starts at 19:00
 */

export type DayNightSchedule = {
  dayStartHour: number
  dayStartMinute: number
  nightStartHour: number
  nightStartMinute: number
}

export type AgeBasedPreset = {
  minAgeWeeks: number
  maxAgeWeeks: number | null
  schedule: DayNightSchedule
  label: string
}

// Définition des presets par âge
const AGE_BASED_PRESETS: AgeBasedPreset[] = [
  {
    minAgeWeeks: 0,
    maxAgeWeeks: 12,  // 0-3 mois
    schedule: { dayStartHour: 7, dayStartMinute: 0, nightStartHour: 21, nightStartMinute: 0 },
    label: "0-3 mois"
  },
  {
    minAgeWeeks: 13,
    maxAgeWeeks: 24,  // 3-6 mois
    schedule: { dayStartHour: 7, dayStartMinute: 0, nightStartHour: 20, nightStartMinute: 0 },
    label: "3-6 mois"
  },
  {
    minAgeWeeks: 25,
    maxAgeWeeks: 52,  // 6-12 mois
    schedule: { dayStartHour: 7, dayStartMinute: 0, nightStartHour: 19, nightStartMinute: 30 },
    label: "6-12 mois"
  },
  {
    minAgeWeeks: 53,
    maxAgeWeeks: null,  // 12+ mois
    schedule: { dayStartHour: 7, dayStartMinute: 0, nightStartHour: 19, nightStartMinute: 0 },
    label: "12+ mois"
  }
]

/**
 * Retourne le schedule approprié pour un âge donné en semaines
 * @param ageWeeks - L'âge du bébé en semaines
 * @returns Le schedule jour/nuit correspondant
 */
export function getScheduleForAge(ageWeeks: number): DayNightSchedule {
  if (ageWeeks <= 0) {
    return AGE_BASED_PRESETS[0].schedule  // Default newborn
  }

  for (const preset of AGE_BASED_PRESETS) {
    if (ageWeeks >= preset.minAgeWeeks &&
        (preset.maxAgeWeeks === null || ageWeeks <= preset.maxAgeWeeks)) {
      return preset.schedule
    }
  }

  return AGE_BASED_PRESETS[AGE_BASED_PRESETS.length - 1].schedule
}

/**
 * Détermine si une heure donnée est "nuit" selon un schedule
 * La nuit s'étend de nightStart à dayStart (traverse minuit)
 * @param date - La date/heure à tester
 * @param schedule - Le schedule jour/nuit à utiliser
 * @returns true si l'heure est en période nuit
 */
export function isNightHourWithSchedule(date: Date, schedule: DayNightSchedule): boolean {
  const hour = date.getHours()
  const minute = date.getMinutes()
  const timeInMinutes = hour * 60 + minute

  const dayStart = schedule.dayStartHour * 60 + schedule.dayStartMinute
  const nightStart = schedule.nightStartHour * 60 + schedule.nightStartMinute

  // Night spans from nightStart to dayStart (wraps around midnight)
  return timeInMinutes >= nightStart || timeInMinutes < dayStart
}

/**
 * Calculate the percentage of an interval that occurs during day hours
 * Uses exact time calculation with day-by-day intersection logic
 * @param startDate - Start of the interval
 * @param endDate - End of the interval
 * @param schedule - The day/night schedule to use
 * @returns Percentage of interval during day hours (0-100)
 */
export function calculateDayPercentageExact(
  startDate: Date,
  endDate: Date,
  schedule: DayNightSchedule
): number {
  const startMs = startDate.getTime()
  const endMs = endDate.getTime()
  const totalDuration = endMs - startMs

  if (totalDuration <= 0) return 0

  let dayDuration = 0

  // Get day boundaries for each day touched by the interval
  const startDay = new Date(startDate)
  startDay.setHours(0, 0, 0, 0)

  const currentDay = new Date(startDay)

  while (currentDay.getTime() <= endMs) {
    // Calculate day start and end for this specific day
    const dayStart = new Date(currentDay)
    dayStart.setHours(
      schedule.dayStartHour,
      schedule.dayStartMinute,
      0,
      0
    )

    const dayEnd = new Date(currentDay)
    dayEnd.setHours(
      schedule.nightStartHour,
      schedule.nightStartMinute,
      0,
      0
    )

    // Calculate intersection with interval [startMs, endMs]
    const intersectionStart = Math.max(startMs, dayStart.getTime())
    const intersectionEnd = Math.min(endMs, dayEnd.getTime())

    if (intersectionEnd > intersectionStart) {
      dayDuration += intersectionEnd - intersectionStart
    }

    // Move to next day
    currentDay.setDate(currentDay.getDate() + 1)
  }

  return (dayDuration / totalDuration) * 100
}

/**
 * Classify an interval as day or night based on majority time
 * An interval is classified "day" if more than 50% of its duration occurs during day hours
 * In case of exact 50/50, defaults to night
 * @param startDate - Start of the interval
 * @param endDate - End of the interval
 * @param schedule - The day/night schedule to use
 * @returns true if interval is night, false if day
 */
export function isNightIntervalByMajority(
  startDate: Date,
  endDate: Date,
  schedule: DayNightSchedule
): boolean {
  const dayPercentage = calculateDayPercentageExact(
    startDate,
    endDate,
    schedule
  )

  // If exactly 50%, default to night
  // If >50% day, classify as day (return false)
  // If <50% day (i.e., >50% night), classify as night (return true)
  return dayPercentage <= 50
}

/**
 * Utilitaire pour récupérer tous les presets (pour UI future)
 * @returns Une copie du tableau des presets
 */
export function getAgeBasedPresets(): AgeBasedPreset[] {
  return [...AGE_BASED_PRESETS]
}

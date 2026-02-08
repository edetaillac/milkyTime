"use client"

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from "react"
import {
  type FoodLog,
  type FoodLogWithInterval,
  type RecordBroken,
  type DailyStatsData,
  type WeeklyMedianData,
  type Last7DaysData,
  type ApproachingRecord,
  type SmartAlerts,
  type ProcessedIntervalData,
  formatDate,
  formatTime,
  formatTimeInterval,
  calculateInterval,
  computePredictions,
  getPredictionPointColor,
  getStablePointPosition,
  getPredictionLegend,
  getRecordIndicator as getRecordIndicatorLib,
  getMinRecordThreshold,
  calculateBabyAgeWeeksFromBirthDate,
  formatBabyAgeFromBirthDate,
  isNightHour,
  TIMINGS,
} from "../lib"

interface WindowWithConfetti extends Window {
  confetti?: (options: Record<string, unknown>) => void
}
import { getScheduleForAge, isNightHourWithSchedule, type DayNightSchedule } from "../lib/scheduleConfig"
import { addLogEntry, updateLogTimestamp, deleteLogEntry } from "../lib/supabase"
import {
  fetchLogsWithOptions as fetchLogsWithOptionsService,
  fetchTodayCount as fetchTodayCountService,
  fetchTotalLogsCount as fetchTotalLogsCountService,
  fetchDailyStatsRange as fetchDailyStatsRangeService,
  fetchIntervalChartData as fetchIntervalChartDataService,
  calculateWeeklyMedianData as calculateWeeklyMedianDataService,
  calculateLast7DaysMedianData as calculateLast7DaysMedianDataService,
} from "../services/feedingService"

export function useFoodTracker() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [logs, setLogs] = useState<FoodLogWithInterval[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [todayCount, setTodayCount] = useState(0)
  const [totalLogsCount, setTotalLogsCount] = useState(0)

  // Évolution quotidienne par horizon
  const [dailyStats7d, setDailyStats7d] = useState<DailyStatsData[]>([])
  const [dailyStats30d, setDailyStats30d] = useState<DailyStatsData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<string>("")
  const [currentUserId, setCurrentUserId] = useState<string>("")
  const [babyBirthDate, setBabyBirthDate] = useState<string>("")
  const [lastFeedingSide, setLastFeedingSide] = useState<"left" | "right" | null>(null)
  const [timeSinceLast, setTimeSinceLast] = useState<number | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDate, setEditingDate] = useState<string>("")
  const [editingTime, setEditingTime] = useState<string>("")

  const [records, setRecords] = useState<{
    day: ProcessedIntervalData[]
    night: ProcessedIntervalData[]
  }>({ day: [], night: [] })

  const [approachingRecord, setApproachingRecord] = useState<ApproachingRecord | null>(null)

  const [intervalChartData24h, setIntervalChartData24h] = useState<ProcessedIntervalData[]>([])
  const [intervalChartData72h, setIntervalChartData72h] = useState<ProcessedIntervalData[]>([])
  const [intervalChartData7d, setIntervalChartData7d] = useState<ProcessedIntervalData[]>([])

  const [recordBroken, setRecordBroken] = useState<RecordBroken | null>(null)
  const [showRecordModal, setShowRecordModal] = useState(false)
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showPredictionInfo, setShowPredictionInfo] = useState(false)
  const [showBabyAgeInfo, setShowBabyAgeInfo] = useState(false)

  // Helper robuste: récupère un userId en priorité override > état > localStorage
  const getUserIdSafely = (override?: string) => {
    if (override && override.length > 0) return override
    if (currentUserId && currentUserId.length > 0) return currentUserId
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('diaper-user-id')
      if (stored && stored.length > 0) return stored
    }
    return ''
  }

  // Calculate baby age in weeks (via lib)
  const calculateBabyAgeWeeks = () => calculateBabyAgeWeeksFromBirthDate(babyBirthDate)

  // Format baby age with detailed weeks/months display (compatible with existing UI)
  const formatBabyAge = () => formatBabyAgeFromBirthDate(babyBirthDate)

  // Computed schedule based on current baby age
  const currentSchedule = useMemo<DayNightSchedule>(() => {
    const ageWeeks = calculateBabyAgeWeeksFromBirthDate(babyBirthDate)
    return getScheduleForAge(ageWeeks)
  }, [babyBirthDate])

  // Reload interval data when schedule changes (e.g., when babyBirthDate is loaded)
  useEffect(() => {
    if (currentUserId && babyBirthDate) {
      fetchIntervalChartData24h(currentUserId)
      fetchIntervalChartData72h(currentUserId)
      fetchIntervalChartData7d(currentUserId)
      calculateLast7DaysMedianData(currentUserId)
    }
  }, [currentSchedule, currentUserId])

  // Détection automatique jour/nuit avec paramètre d'URL
  const isNightTime = () => isNightHourWithSchedule(new Date(), currentSchedule)
  
  // Vérifier le paramètre d'URL pour forcer le thème
  const getInitialTheme = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const themeParam = urlParams.get('theme')
      if (themeParam === 'dark') return true
      if (themeParam === 'light') return false
    }
    return isNightTime()
  }

  const [isDarkMode, setIsDarkMode] = useState(getInitialTheme())

  // Intervalle médian par semaine
  const [weeklyMedianData, setWeeklyMedianData] = useState<WeeklyMedianData[]>([])
  // Intervalle médian des 7 derniers jours
  const [last7DaysData, setLast7DaysData] = useState<Last7DaysData[]>([])

  // Alerte smart + fenêtre probable (Option A : pas de record ici)
  const [smartAlerts, setSmartAlerts] = useState<SmartAlerts>({
    nextFeedingPrediction: null,
    sideRecommendation: null,
  })

  const [probWindowMinutes, setProbWindowMinutes] = useState<number | null>(null)
  const [expectedIntervalMinutes, setExpectedIntervalMinutes] = useState<number | null>(null)
  const [_isLikelyWindow, setIsLikelyWindow] = useState<boolean | null>(null)

  const [reliabilityIndex, setReliabilityIndex] = useState<number | null>(null)

  // ===========================
  // Confettis
  // ===========================
  const launchConfetti = () => {
    
    const win = window as WindowWithConfetti
    if (typeof window === "undefined" || !win.confetti) {
      const script = document.createElement("script")
      script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"
      script.async = true
      script.onload = () => {
        setTimeout(() => launchConfetti(), TIMINGS.CONFETTI_SCRIPT_RELOAD_DELAY_MS)
      }
      document.head.appendChild(script)
      return
    }
    const animationEnd = Date.now() + TIMINGS.CONFETTI_DURATION_MS
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }
    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()
      if (timeLeft <= 0) return clearInterval(interval)
      const particleCount = 50 * (timeLeft / TIMINGS.CONFETTI_DURATION_MS)
      ;[
        { x: Math.random() * 0.2 + 0.1, y: Math.random() - 0.2 },
        { x: Math.random() * 0.2 + 0.7, y: Math.random() - 0.2 },
      ].forEach((origin) => win.confetti?.({ ...defaults, particleCount, origin }))
    }, TIMINGS.CONFETTI_PARTICLE_INTERVAL_MS)
    setTimeout(() => clearInterval(interval), TIMINGS.CONFETTI_DURATION_MS)
  }

  // ===========================
  // Auth
  // ===========================
  const handleLogin = async (username: string, password: string) => {
    try {
      setAuthError(null)
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (response.ok && data.user) {
        const user = data.user
        
        // Nettoyer le localStorage avant de sauver les nouvelles données
        localStorage.clear()
        
        setIsAuthenticated(true)
        setCurrentUser(user.username)
        setCurrentUserId(user.id)
        setBabyBirthDate(user.babyBirthDate)
        setAuthError(null)
        localStorage.setItem("diaper-auth", "true")
        localStorage.setItem("diaper-user", user.username)
        localStorage.setItem("diaper-user-id", user.id)
        localStorage.setItem("diaper-baby-birth-date", user.babyBirthDate)
        
        const init = async () => {
          setLoading(true)
          await loadAllData(user.id) // Passer directement l'ID utilisateur
          setLoading(false)
        }
        init()
      } else {
        setAuthError(data.error || "Nom d'utilisateur ou mot de passe incorrect")
      }
    } catch (error) {
      console.error('Login error:', error)
      setAuthError("Erreur de connexion. Veuillez réessayer.")
    }
  }
  const handleLogout = () => {
    // Nettoyer complètement le localStorage
    localStorage.clear()
    
    setIsAuthenticated(false)
    setCurrentUser("")
    setCurrentUserId("")
    setBabyBirthDate("")
    setAuthError(null)
    setLogs([])
    setTodayCount(0)
    setDailyStats7d([])
    setDailyStats30d([])
    
    setError(null)
    setSuccess(null)
    setLastFeedingSide(null)
    setTimeSinceLast(null)
    setRecords({ day: [], night: [] })
    
    setIntervalChartData24h([])
    setIntervalChartData72h([])
    setIntervalChartData7d([])
    setEditingId(null)
    setEditingDate("")
    setEditingTime("")
    setApproachingRecord(null)
    setRecordBroken(null)
    setShowRecordModal(false)
    
    setDeleteConfirmId(null)

    setSmartAlerts({ nextFeedingPrediction: null, sideRecommendation: null })
    setProbWindowMinutes(null)
    setExpectedIntervalMinutes(null)
    setIsLikelyWindow(null)
    setReliabilityIndex(null)
  }

  // ===========================
  // Data fetchers
  // ===========================
  const fetchLogsWithOptions = async (
    options: { orderBy?: string; ascending?: boolean; limit?: number; startDate?: Date; endDate?: Date } = {},
    userId?: string
  ) => {
    const userIdToUse = getUserIdSafely(userId)
    if (!userIdToUse) {
      console.warn("currentUserId is not set, skipping fetchLogsWithOptions")
      return []
    }
    try {
      return await fetchLogsWithOptionsService(options, userIdToUse)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Erreur lors de data retrieval: ${message}`)
    }
  }

  const calculateIntervalsFromData = (data: FoodLog[]) => {
    const logsWithIntervals: FoodLogWithInterval[] = []
    const sorted = data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    for (let i = 0; i < sorted.length; i++) {
      const feeding = sorted[i]
      let intervalMinutes: number | undefined
      if (i < sorted.length - 1) {
        const prevFeeding = sorted[i + 1]
        intervalMinutes = calculateInterval(new Date(feeding.timestamp), new Date(prevFeeding.timestamp))
      }
      logsWithIntervals.push({ ...feeding, intervalMinutes })
    }
    return logsWithIntervals
  }

  // ===========================
  // Calculs mémorisés pour les performances
  // ===========================
  
  // Mémoisation des logs avec intervalles
  const logsWithIntervals = useMemo(() => {
    if (logs.length === 0) return []
    return calculateIntervalsFromData(logs)
  }, [logs])

  // Mémoisation du temps écoulé depuis la dernière tétée
  const timeSinceLastCalculated = useMemo(() => {
    if (logs.length === 0) return null
    const lastFeeding = logs[0]
    return calculateInterval(new Date(), new Date(lastFeeding.timestamp))
  }, [logs])

  const babyAgeWeeksValue = calculateBabyAgeWeeks()

  // Synchroniser timeSinceLast avec timeSinceLastCalculated pour que l'UI se mette à jour
  useEffect(() => {
    setTimeSinceLast(timeSinceLastCalculated)
  }, [timeSinceLastCalculated])

  // ===========================
  // Logique de recommandation de sein (alternance intelligente)
  // ===========================
  const suggestedSide: "left" | "right" = useMemo<"left" | "right">(() => {
    // Si pas de dernière tétée, commencer par le sein gauche
    if (!lastFeedingSide) return "left"
    
    // Alternance simple : gauche ↔ droite
    if (lastFeedingSide === "left") return "right"
    if (lastFeedingSide === "right") return "left"
    
    // Après un biberon, reprendre au sein gauche
    if (lastFeedingSide === "bottle") return "left"
    
    // Fallback sécurisé
    return "left"
  }, [lastFeedingSide])

  const fetchTotalLogsCount = async (userId?: string) => {
    const userIdToUse = getUserIdSafely(userId)
    if (!userIdToUse) {
      console.warn("currentUserId is not set, skipping fetchTotalLogsCount")
      return 0
    }
    
    try {
      return await fetchTotalLogsCountService(userIdToUse)
    } catch (e) {
      console.error("Error fetching total logs count:", e)
      return 0
    }
  }

  const fetchLogs = async (userId?: string) => {
    try {
      const data = await fetchLogsWithOptions({ limit: 20, orderBy: "timestamp", ascending: false }, userId)
      setLogs(data)

      // Récupérer aussi le total des logs pour les paramètres adaptatifs
      const totalCount = await fetchTotalLogsCount(userId)
      setTotalLogsCount(totalCount)

      // Mettre à jour le contexte de la dernière tétée
      if (data.length > 0) {
        const lastFeeding = data[0] // La plus récente grâce au tri descendant
        if (lastFeeding.side === "left" || lastFeeding.side === "right") {
        setLastFeedingSide(lastFeeding.side)
        } else {
          setLastFeedingSide(null)
        }
        setTimeSinceLast(calculateInterval(new Date(), new Date(lastFeeding.timestamp)))
      } else {
        // Reset si aucune tétée trouvée
        setLastFeedingSide(null)
        setTimeSinceLast(null)
      }
    } catch (e) {
      console.error("Error fetching logs:", e)
      setError("Error loading feedings")
    }
  }


  const fetchTodayCount = async (userId?: string) => {
    const userIdToUse = getUserIdSafely(userId)
    if (!userIdToUse) {
      console.warn("currentUserId is not set, skipping fetchTodayCount")
      setTodayCount(0)
      return
    }
    
    try {
      const count = await fetchTodayCountService(userIdToUse)
      setTodayCount(count)
    } catch (e) {
      console.error("Error fetching today count:", e)
    }
  }

  // Récupère et agrège sur "days" jours glissants (inclus aujourd'hui)
  const fetchDailyStatsRange = async (days: number, userId?: string) => {
    const userIdToUse = getUserIdSafely(userId)
    if (!userIdToUse) {
      console.warn("currentUserId is not set, skipping fetchDailyStatsRange")
      return []
    }
    return fetchDailyStatsRangeService(userIdToUse, days)
  }

  // ---- Interval charts ----
  const fetchIntervalChartData24h = async (userId?: string) => {
    const userIdToUse = getUserIdSafely(userId)
    if (!userIdToUse) {
      console.warn("currentUserId is not set, skipping fetchIntervalChartData24h")
      return
    }
    try {
      const data = await fetchIntervalChartDataService(userIdToUse, "24h", currentSchedule)
      setIntervalChartData24h(data)
    } catch (e) {
      console.error("Error fetching 24h interval data:", e)
    }
  }

  const fetchIntervalChartData72h = async (userId?: string) => {
    const userIdToUse = getUserIdSafely(userId)
    if (!userIdToUse) {
      console.warn("currentUserId is not set, skipping fetchIntervalChartData72h")
      return
    }
    try {
      const data = await fetchIntervalChartDataService(userIdToUse, "72h", currentSchedule)
      setIntervalChartData72h(data)
    } catch (e) {
      console.error("Error fetching 72h interval data:", e)
    }
  }

  const fetchIntervalChartData7d = async (userId?: string) => {
    const userIdToUse = getUserIdSafely(userId)
    if (!userIdToUse) {
      console.warn("currentUserId is not set, skipping fetchIntervalChartData7d")
      return
    }
    try {
      const data = await fetchIntervalChartDataService(userIdToUse, "7d", currentSchedule)
      setIntervalChartData7d(data)
    } catch (e) {
      console.error("Error fetching 7d interval data:", e)
    }
  }

  const calculateWeeklyMedianData = async (userId?: string) => {
    const userIdToUse = getUserIdSafely(userId)
    if (!userIdToUse) {
      console.warn("currentUserId is not set, skipping calculateWeeklyMedianData")
      setWeeklyMedianData([])
      return
    }
    try {
      const data = await calculateWeeklyMedianDataService(userIdToUse, babyBirthDate || undefined)
      setWeeklyMedianData(data)
    } catch (e) {
      console.error("Error calculating weekly median data:", e)
      setWeeklyMedianData([])
    }
  }

  const calculateLast7DaysMedianData = async (userId?: string) => {
    const userIdToUse = getUserIdSafely(userId)
    if (!userIdToUse) {
      console.warn("currentUserId is not set, skipping calculateLast7DaysMedianData")
      setLast7DaysData([])
      return
    }
    try {
      const data = await calculateLast7DaysMedianDataService(userIdToUse, currentSchedule)
      setLast7DaysData(data)
    } catch (e) {
      console.error("Error calculating last 7 days data:", e)
      setLast7DaysData([])
    }
  }

  // ===========================
  // Records
  // ===========================
  const validateRecordData = (
    records: Array<{ interval: number; isNight: boolean; timestamp: string; date: string; time: string }>,
  ) => records.filter((r) => r && r.interval > 0 && r.timestamp)

  const updateAndCheckRecords = async (isNewFeeding = false, newFeedingTimestamp?: string, userId?: string) => {
    try {
      // D'abord calculer les records EXISTANTS (avant la nouvelle tétée)
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - TIMINGS.RECORDS_LOOKBACK_MS)
      let data = await fetchLogsWithOptions({ startDate: thirtyDaysAgo, orderBy: "timestamp", ascending: true }, userId)
      
      // Si c'est une nouvelle tétée, exclure temporairement la nouvelle tétée du calcul des records existants
      if (isNewFeeding && newFeedingTimestamp) {
        // Normaliser les timestamps pour la comparaison
        const normalizedNewFeedingTimestamp = newFeedingTimestamp.replace("Z", "+00:00")
        
        data = data.filter((log) => {
          const normalizedLogTimestamp = log.timestamp.replace("Z", "+00:00")
          return normalizedLogTimestamp !== normalizedNewFeedingTimestamp
        })
        
      }
      
      const intervals: Array<{ interval: number; isNight: boolean; timestamp: string; date: string; time: string }> = []
      const sorted = data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      
      for (let i = 1; i < sorted.length; i++) {
        const cur = sorted[i]
        const prev = sorted[i - 1]
        const mins = calculateInterval(new Date(cur.timestamp), new Date(prev.timestamp))
        if (mins < 1 || mins > 1440) continue
        const d = new Date(cur.timestamp)
        const isNight = isNightHour(d)
        intervals.push({
          interval: mins,
          isNight,
          timestamp: cur.timestamp,
          date: formatDate(d, { day: "2-digit", month: "2-digit" }),
          time: formatTime(d, { hour: "2-digit", minute: "2-digit" }),
        })
      }
      
      const dayIntervals = intervals.filter((i) => !i.isNight).sort((a, b) => b.interval - a.interval)
      const nightIntervals = intervals.filter((i) => i.isNight).sort((a, b) => b.interval - a.interval)
      const newDay = validateRecordData(dayIntervals.slice(0, 3))
      const newNight = validateRecordData(nightIntervals.slice(0, 3))
      
      // Mettre à jour les records dans l'état
      setRecords({ day: newDay, night: newNight })

      // Ensuite vérifier si un nouveau record est battu
      if (isNewFeeding && newFeedingTimestamp) {
        // 1. Récupérer les 2 dernières tétées pour calculer l'intervalle
        const recentFeedings = await fetchLogsWithOptions({ limit: 2, orderBy: "timestamp", ascending: false })
        if (recentFeedings.length < 2) {
          return
        }
        
        // La première est la nouvelle tétée, la deuxième est la tétée précédente
        const lastFeedingTimestamp = recentFeedings[1].timestamp
        const currentInterval = calculateInterval(new Date(newFeedingTimestamp), new Date(lastFeedingTimestamp))

        // 2. Déterminer si c'est jour ou nuit
        const newFeedingTime = new Date(newFeedingTimestamp)
        const isNight = isNightHour(newFeedingTime)
        
        // 3. Utiliser les records fraîchement calculés
        const existingRecords = isNight ? newNight : newDay
        
        // 4. Vérifier si le nouvel intervalle bat un record existant
        let recordType: "bronze" | "silver" | "gold" | null = null
        let oldRecord = 0
        let beatenRecords: ("bronze" | "silver" | "gold")[] = []
        
        if (existingRecords.length === 0) {
          // Premier record : utiliser le seuil adaptatif
          const minRecordThreshold = getMinRecordThreshold(calculateBabyAgeWeeks())
          if (currentInterval >= minRecordThreshold) {
            recordType = "bronze"
            oldRecord = 0
            beatenRecords = ["bronze"]
          }
        } else {
          // Comparer avec les records existants (triés du plus grand au plus petit)
          const goldRecord = existingRecords[0]?.interval || 0 // 1er = Or
          const silverRecord = existingRecords[1]?.interval || 0 // 2ème = Argent  
          const bronzeRecord = existingRecords[2]?.interval || 0 // 3ème = Bronze

          // Détecter TOUS les records battus (supérieur ou égal pour un nouveau record)
          if (currentInterval >= bronzeRecord && bronzeRecord > 0) {
            beatenRecords.push("bronze")
          }
          if (currentInterval >= silverRecord && silverRecord > 0) {
            beatenRecords.push("silver")
          }
          if (currentInterval >= goldRecord && goldRecord > 0) {
            beatenRecords.push("gold")
          }
          
          // Prendre le meilleur record battu pour l'affichage
          if (beatenRecords.includes("gold")) {
            recordType = "gold"
            oldRecord = goldRecord
          } else if (beatenRecords.includes("silver")) {
            recordType = "silver"
            oldRecord = silverRecord
          } else if (beatenRecords.includes("bronze")) {
            recordType = "bronze"
            oldRecord = bronzeRecord
          }
        }
        
        // 5. Déclencher les confettis si on bat un record
        if (recordType) {
          const recordBrokenObject: RecordBroken = {
            type: isNight ? "night" : "day",
            recordLevel: recordType as "bronze" | "silver" | "gold",
            newRecord: currentInterval,
            oldRecord: oldRecord,
            improvement: currentInterval - oldRecord,
            beatenRecords: beatenRecords,
          }

          if (recordBrokenObject.type && recordBrokenObject.recordLevel) {
            setRecordBroken(recordBrokenObject)
            setShowRecordModal(true)
            launchConfetti()
          }
        }
      }
    } catch (e) {
      console.error("Error updating records:", e)
    }
  }

  const checkApproachingRecord = async () => {
    if (timeSinceLast === null || timeSinceLast <= 0) return setApproachingRecord(null)
    const now = new Date()
    const isNight = isNightHour(now)
    const relevant = isNight ? records.night : records.day
    if (relevant.length === 0) return setApproachingRecord(null)
    const ranks = ["🥇", "🥈", "🥉"]
    const chase = relevant.map((rec, i) => ({ ...rec, rank: ranks[i] }))
    // Trouver le prochain record à battre (le plus proche que vous n'avez pas encore battu)
    // On inverse l'ordre pour chercher du bronze vers l'or
    const nextTarget = chase
      .slice()
      .reverse()
      .find((r) => timeSinceLast !== null && timeSinceLast <= r.interval)
    const beaten = chase.filter((r) => timeSinceLast !== null && timeSinceLast >= r.interval).map((r) => r.rank)

    if (nextTarget) {
      const timeRemaining = nextTarget.interval - timeSinceLast
      const isApproaching = nextTarget.interval > 0 && timeSinceLast / nextTarget.interval >= 0.8
      setApproachingRecord({
        timeRemaining,
        isNight,
        recordInterval: nextTarget.interval,
        nextRecordRank: nextTarget.rank,
        isApproaching,
        allRecordsBroken: false,
        beatenRecords: beaten.reverse(),
      })
    } else if (beaten.length > 0) {
      setApproachingRecord({
        timeRemaining: 0,
        isNight,
        recordInterval: relevant[0].interval,
        nextRecordRank: "👑",
        isApproaching: false,
        allRecordsBroken: true,
        beatenRecords: beaten.reverse(),
      })
    } else {
      setApproachingRecord(null)
    }
  }

  // ===========================
  // Smart prediction + fenêtre probable (MÉMOISÉ)
  // ===========================
  
  // Mémoisation des prédictions intelligentes (extrait en lib)
  const smartAlertsCalculated = useMemo(() => {
    return computePredictions({
      logs,
      totalLogsCount,
      calculateBabyAgeWeeks,
      schedule: currentSchedule,
      timeSinceMinutes: timeSinceLastCalculated ?? undefined,
    })
  }, [logs, totalLogsCount, timeSinceLastCalculated, currentSchedule])

  // Couleur du point mémorisée pour éviter les re-rendus inutiles
  const predictionPointColor = useMemo(() => {
    return getPredictionPointColor(timeSinceLast, expectedIntervalMinutes, probWindowMinutes)
  }, [timeSinceLast, expectedIntervalMinutes, probWindowMinutes])

  // Position du point stabilisée pour éviter le scintillement
  const stablePointPosition = useMemo(() => {
    return getStablePointPosition(timeSinceLast)
  }, [timeSinceLast])

  // Légende mémorisée pour éviter les re-rendus
  const predictionLegend = useMemo(() => {
    return getPredictionLegend(logs, expectedIntervalMinutes, probWindowMinutes)
  }, [logs, expectedIntervalMinutes, probWindowMinutes])

  // Synchroniser les smart alerts avec les nouvelles données calculées
  useEffect(() => {
    if (smartAlertsCalculated) {
      setSmartAlerts({
        nextFeedingPrediction: smartAlertsCalculated.nextFeedingPrediction,
        sideRecommendation: smartAlertsCalculated.sideRecommendation,
        reliabilityIndex: smartAlertsCalculated.reliabilityIndex,
        isClusterFeeding: smartAlertsCalculated.isClusterFeeding,
      })
      setProbWindowMinutes(smartAlertsCalculated.probWindowMinutes)
      setExpectedIntervalMinutes(smartAlertsCalculated.expectedIntervalMinutes)
      setIsLikelyWindow(smartAlertsCalculated.isLikelyWindow)
      setReliabilityIndex(smartAlertsCalculated.reliabilityIndex)
    }
  }, [smartAlertsCalculated])

  // ===========================
  // Actions CRUD
  // ===========================
  const addLog = useCallback(async (side: "left" | "right" | "bottle") => {
    // Vérifier l'authentification via l'état React OU le localStorage
    const isAuthFromState = isAuthenticated
    const isAuthFromStorage = localStorage.getItem("diaper-auth") === "true"
    const isUserAuthenticated = isAuthFromState || isAuthFromStorage
    
    if (!isUserAuthenticated) {
      setError("User not connected")
      return
    }

    // Récupérer l'ID utilisateur depuis localStorage si currentUserId n'est pas encore défini
    const userIdToUse = currentUserId || localStorage.getItem("diaper-user-id")

    if (!userIdToUse) {
      setError("User not connected")
      return
    }
    
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      if (!side || (side !== "left" && side !== "right" && side !== "bottle")) throw new Error("Type invalide")
      const feedingTimestamp = new Date().toISOString()
      await addLogEntry({ side, timestamp: feedingTimestamp, userId: userIdToUse })
      setSuccess("Feeding saved!")

      // Mise à jour immédiate du côté pour la recommandation suivante (seins uniquement)
      if (side === "left" || side === "right") {
        setLastFeedingSide(side)
      }

      await loadAllDataWithRecordCheck(feedingTimestamp, userIdToUse)
    } catch (e: unknown) {
      console.error("Error adding log:", e)
      const errorMessage = e instanceof Error ? e.message : "Error saving feeding"
      setError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }, [])

  const addBatchLogs = useCallback(
    async (entries: Array<{ timestamp: string; side?: "left" | "right" | "bottle" }>) => {
      const isAuthFromState = isAuthenticated
      const isAuthFromStorage = typeof window !== "undefined" && localStorage.getItem("diaper-auth") === "true"
      const isUserAuthenticated = isAuthFromState || isAuthFromStorage

      if (!isUserAuthenticated) {
        setError("User not connected")
        return
      }

      const userIdToUse = currentUserId || (typeof window !== "undefined" ? localStorage.getItem("diaper-user-id") ?? "" : "")

      if (!userIdToUse) {
        setError("User not connected")
        return
      }

      if (!entries || entries.length === 0) {
        setError("No feedings to save")
        return
      }

      setSubmitting(true)
      setError(null)
      setSuccess(null)

      try {
        const sanitized = entries
          .filter((entry) => entry && entry.timestamp)
          .map((entry) => {
            const side = entry.side ?? "bottle"
            const timestamp = new Date(entry.timestamp)

            if (Number.isNaN(timestamp.getTime())) {
              throw new Error("Invalid date or time provided")
            }

            return { side, timestampIso: timestamp.toISOString() }
          })
          .sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime())

        if (sanitized.length === 0) {
          setError("No valid feedings to save")
          return
        }

        let lastSide: "left" | "right" | null = null
        for (const entry of sanitized) {
          await addLogEntry({ side: entry.side, timestamp: entry.timestampIso, userId: userIdToUse })
          if (entry.side === "left" || entry.side === "right") {
            lastSide = entry.side
          }
        }

        if (lastSide) {
          setLastFeedingSide(lastSide)
        }

        const latestTimestamp = sanitized[sanitized.length - 1]?.timestampIso
        const successMessage = sanitized.length === 1 ? "Feeding saved!" : `${sanitized.length} feedings saved!`
        setSuccess(successMessage)

        await loadAllDataWithRecordCheck(latestTimestamp, userIdToUse)
      } catch (error: unknown) {
        console.error("Error adding batch logs:", error)
        const errorMessage = error instanceof Error ? error.message : "Error saving feedings"
        setError(errorMessage)
      } finally {
        setSubmitting(false)
      }
    },
    [],
  )

  const startEditing = useCallback((log: FoodLog) => {
    setEditingId(log.id)
    const d = new Date(log.timestamp)
    setEditingDate(d.toISOString().split("T")[0])
    const h = d.getHours().toString().padStart(2, "0")
    const m = d.getMinutes().toString().padStart(2, "0")
    setEditingTime(`${h}:${m}`)
  }, [])
  
  const cancelEditing = useCallback(() => {
    setEditingId(null)
    setEditingDate("")
    setEditingTime("")
  }, [])
  const saveEdit = async (id: string) => {
    if (!currentUserId) {
      setError("User not connected")
      return
    }
    
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      if (!editingDate || !editingTime) throw new Error("Date et heure requises")
      const combined = new Date(`${editingDate}T${editingTime}`)
      if (isNaN(combined.getTime())) throw new Error("Date ou heure invalide")
      await updateLogTimestamp(id, combined.toISOString())
      setSuccess("Feeding modified!")
      await loadAllDataWithRecordCheck()
    } catch (e: unknown) {
      console.error("Error updating log:", e)
      setError(e instanceof Error ? e.message : "Error modifying feeding")
    } finally {
      setSubmitting(false)
      setEditingId(null)
      setEditingDate("")
      setEditingTime("")
    }
  }

  const confirmDelete = async (id: string) => {
    if (!currentUserId) {
      setError("User not connected")
      return
    }
    
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await deleteLogEntry(id)
      setSuccess("Feeding deleted!")
      await loadAllDataWithRecordCheck()
    } catch (e: unknown) {
      console.error("Error deleting log:", e)
      setError(e instanceof Error ? e.message : "Error deleting feeding")
    } finally {
      setSubmitting(false)
      setDeleteConfirmId(null)
    }
  }
  const deleteLog = (id: string) => setDeleteConfirmId(id)

  // ===========================
  // Chargement groupé
  // ===========================
  const loadAllData = async (userId?: string) => {
    // Protection contre les appels simultanés
    if (loading) return

    const userIdToUse = getUserIdSafely(userId)
    if (!userIdToUse) return
    
    setLoading(true)
    try {
      await Promise.all([
        fetchLogs(userIdToUse),
        fetchTodayCount(userIdToUse),
        // Daily stats multi-range
        fetchDailyStatsRange(7, userIdToUse).then(setDailyStats7d),
        fetchDailyStatsRange(30, userIdToUse).then(setDailyStats30d),
        // Intervals/timelines
        fetchIntervalChartData24h(userIdToUse),
        fetchIntervalChartData72h(userIdToUse),
        fetchIntervalChartData7d(userIdToUse),
        calculateWeeklyMedianData(userIdToUse),
        calculateLast7DaysMedianData(userIdToUse),
        updateAndCheckRecords(false, undefined, userIdToUse),

      ])
      // Smart alerts se mettent à jour automatiquement via useEffect
    } finally {
      setLoading(false)
    }
  }
  const loadAllDataWithRecordCheck = async (newFeedingTimestamp?: string, userId?: string) => {
    await fetchLogs(userId)

    // Délai pour s'assurer que la base est à jour
    await new Promise((resolve) => setTimeout(resolve, TIMINGS.DATA_SYNC_DELAY_MS))

    await Promise.all([
      fetchTodayCount(userId),
      fetchDailyStatsRange(7, userId).then(setDailyStats7d),
      fetchDailyStatsRange(30, userId).then(setDailyStats30d),
      fetchIntervalChartData24h(userId),
      fetchIntervalChartData72h(userId),
      fetchIntervalChartData7d(userId),
      calculateWeeklyMedianData(userId),
      calculateLast7DaysMedianData(userId),
    ])

    await updateAndCheckRecords(true, newFeedingTimestamp, userId)

    const recordCheckTimer = setTimeout(() => {
      checkApproachingRecord()
    }, TIMINGS.RECORD_CHECK_DELAY_MS)
    return () => {
      clearTimeout(recordCheckTimer)
    }
  }

  // ===========================
  // Effects
  // ===========================
  useEffect(() => {
    const savedAuth = localStorage.getItem("diaper-auth")
    const savedUser = localStorage.getItem("diaper-user")
    const savedUserId = localStorage.getItem("diaper-user-id")
    const savedBabyBirthDate = localStorage.getItem("diaper-baby-birth-date")
    
    if (savedAuth === "true" && savedUser && savedUserId) {
      setIsAuthenticated(true)
      setCurrentUser(savedUser)
      setCurrentUserId(savedUserId)
      if (savedBabyBirthDate) {
        setBabyBirthDate(savedBabyBirthDate)
      }
    }
  }, [])

  // Effect séparé pour charger les données quand currentUserId est défini
  useEffect(() => {
    if (isAuthenticated && currentUserId) {
      const init = async () => {
        setLoading(true)
        await loadAllData()
        setLoading(false)
      }
      init()
    }
  }, [isAuthenticated, currentUserId])

  useEffect(() => {
    if (!isAuthenticated) return
    // Pas de timers actifs pour éviter les scintillements
    return () => {
      // Cleanup si nécessaire
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const script = document.createElement("script")
      script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"
      script.async = true
      
      script.onload = () => {
      }
      
      script.onerror = () => {
        console.warn("Échec du chargement du script confetti")
      }
      
      document.head.appendChild(script)
      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script)
        }
      }
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated && logs.length > 0 && (records.day.length > 0 || records.night.length > 0)) {
      if (timeSinceLast !== null && timeSinceLast >= 0) {
        // Utiliser setTimeout pour éviter les boucles infinies
        const timer = setTimeout(() => {
          checkApproachingRecord()
          // calculateSmartAlerts() supprimé - synchronisation automatique
        }, 0)
        return () => clearTimeout(timer)
      }
    }
  }, [logs, records, isAuthenticated, timeSinceLast])

  // Polling automatique toutes les minutes pour mettre à jour les données - Optimisé
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(() => {
        // Éviter les rechargements inutiles si déjà en cours
        // Utiliser une référence pour éviter les redémarrages du polling
        loadAllData()
      }, TIMINGS.DATA_POLLING_INTERVAL_MS)
      
      return () => {
        clearInterval(interval)
      }
    }
  }, [isAuthenticated]) // Seulement isAuthenticated pour éviter les redémarrages fréquents

  // Scroll automatique vers l'ancre au chargement initial de la page
  useEffect(() => {
    if (typeof window !== 'undefined' && isAuthenticated && !loading) {
      const hash = window.location.hash
      if (hash) {
        // Fonction pour essayer le scroll
        const tryScroll = () => {
          const element = document.querySelector(hash)
          if (element) {
            // Scroll uniquement dans l'iframe, pas la page parente
            const container = document.documentElement || document.body
            const elementRect = element.getBoundingClientRect()
            const containerRect = container.getBoundingClientRect()
            
            const scrollTop = container.scrollTop + elementRect.top - containerRect.top - 20 // 20px de marge
            container.scrollTo({
              top: scrollTop,
              behavior: 'smooth'
            })
            return true
          }
          return false
        }
        
        const timers: ReturnType<typeof setTimeout>[] = []
        const [delay1, delay2, delay3] = TIMINGS.SCROLL_RETRY_DELAYS_MS

        timers.push(setTimeout(() => {
          if (!tryScroll()) {
            timers.push(setTimeout(() => {
              if (!tryScroll()) {
                timers.push(setTimeout(() => {
                  tryScroll()
                }, delay3))
              }
            }, delay2))
          }
        }, delay1))

        return () => timers.forEach(clearTimeout)
      }
    }
  }, [isAuthenticated, loading])

  // ===========================
  // UI helpers - Mémorisés pour éviter les recalculs
  // ===========================
  const formatTimestamp = useCallback((ts: string) =>
    new Date(ts).toLocaleString("en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), [])

  const formatTimeSinceLast = useCallback((m: number | null) => {
    if (m === null) return null
    if (m === 0) return "< 1 min"
    return formatTimeInterval(m)
  }, [])

  // Fonction helper pour les contentStyle des tooltips - Mémorisée
  const getTooltipContentStyle = useCallback((): CSSProperties => ({
    backgroundColor: isDarkMode ? "#1f2937" : "white",
    border: isDarkMode ? "1px solid #4b5563" : "1px solid #ccc",
    borderRadius: "6px",
    fontSize: "12px",
    color: isDarkMode ? "#f9fafb" : "#111827",
  }), [isDarkMode])

  // i18n minimal pour stabiliser les tests face aux traductions - Mémorisé
  const I18N = useMemo(() => ({
    fr: {
      pageTitle: "MilkyTime",
    },
    en: {
      pageTitle: "MilkyTime",
    },
  }), [])
  
  const currentLocale = "fr"
  const t = useCallback((key: string) => I18N[currentLocale]?.[key as keyof typeof I18N[typeof currentLocale]] ?? key, [I18N, currentLocale])

  // Fonction helper pour le seuil minimum des records selon l'âge - Mémorisée
  // Seuils déplacés en lib si besoin ultérieur

  // Fonction helper pour valider la cohérence des records
  // Mémoisation du côté suggéré (déjà optimisé plus haut)
  // const suggestedSide = useMemo(() => { ... }, [lastFeedingSide])

  // Mémoisation des indicateurs de records
  const getRecordIndicator = useCallback(
    (log: FoodLogWithInterval) => getRecordIndicatorLib(log, records, currentSchedule),
    [records, currentSchedule],
  )

  const wasInWindow =
    smartAlerts.nextFeedingPrediction !== null &&
    timeSinceLast !== null &&
    expectedIntervalMinutes !== null &&
    probWindowMinutes !== null &&
    timeSinceLast >= expectedIntervalMinutes - probWindowMinutes / 2

  const lastTextColor =
    smartAlerts.nextFeedingPrediction === null
      ? "text-muted-foreground"
      : wasInWindow
        ? isDarkMode
          ? "text-green-400"
          : "text-green-600"
        : isDarkMode
          ? "text-red-400"
          : "text-red-600"

  return {
    // Auth & session
    isAuthenticated,
    authError,
    handleLogin,
    handleLogout,

    // Loading flags
    loading,
    submitting,

    // User & baby context
    currentUser,
    calculateBabyAgeWeeks,
    formatBabyAge,
    currentSchedule,

    // Theme & UI state
    isDarkMode,
    setIsDarkMode,
    showPredictionInfo,
    setShowPredictionInfo,
    showRecordModal,
    setShowRecordModal,
    deleteConfirmId,
    setDeleteConfirmId,

    // Data sets
    logs,
    logsWithIntervals,
    todayCount,
    totalLogsCount,
    dailyStats7d,
    dailyStats30d,
    intervalChartData24h,
    intervalChartData72h,
    intervalChartData7d,
    weeklyMedianData,
    last7DaysData,
    records,

    // Alerts & derived metrics
    smartAlerts,
    probWindowMinutes,
    expectedIntervalMinutes,
    reliabilityIndex,
    approachingRecord,
    timeSinceLast,
    suggestedSide,
    wasInWindow,
    lastTextColor,
    predictionPointColor,
    stablePointPosition,
    predictionLegend,
    showBabyAgeInfo,
    setShowBabyAgeInfo,

    // Messages
    error,
    success,
    recordBroken,

    // Editing state
    editingId,
    editingDate,
    editingTime,
    setEditingDate,
    setEditingTime,

    // Helpers
    addLog,
    addBatchLogs,
    startEditing,
    cancelEditing,
    saveEdit,
    deleteLog,
    confirmDelete,
    formatTimestamp,
    formatTimeSinceLast,
    getTooltipContentStyle,
    getRecordIndicator,
    t,
  }
}

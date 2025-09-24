"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { HydrationWrapper } from "../src/components/HydrationWrapper"
import { createClient } from "@supabase/supabase-js"
import {
  // Types
  type User,
  type FoodLog,
  type FoodLogWithInterval,
  type RecordBroken,
  type DailyStatsData,
  type IntervalChartData,
  type WeeklyMedianData,
  type Last7DaysData,
  type ApproachingRecord,
  type SmartAlerts,
  type ProcessedIntervalData,
  // Constantes
  sideLabels,
  sideColors,
  // Utilitaires
  roundToStep,
  sideBadgeVariant,
  formatTimeInterval,
  formatYAxisInterval,
  formatDate,
  formatTime,
  getYAxisTicks,
  getEvolutionYDomain,
  getXAxisTicks,
  calculateInterval,
  
  computePredictions,
  getPredictionPointColor,
  getStablePointPosition,
  getPredictionLegend,
  getRecordIndicator as getRecordIndicatorLib,
  getMinRecordThreshold
} from "../src/lib"
import { AddFeedingPanel } from "../src/components/AddFeedingPanel"
import { TodayAndSmartCards } from "../src/components/TodayAndSmartCards"
import { fetchLogsWithOptions as fetchLogsWithOptionsSvc, fetchTodayCount as fetchTodayCountSvc, fetchTotalLogsCount as fetchTotalLogsCountSvc, addLogEntry, updateLogTimestamp, deleteLogEntry } from "../src/lib/supabase"
import { RecentFeedingsTable } from "../src/components/RecentFeedingsTable"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PredictionInfoDialog } from "../src/components/PredictionInfoDialog"
import { MonthlyRecords } from "../src/components/MonthlyRecords"
import { AppHeader } from "../src/components/AppHeader"
import { calculateBabyAgeWeeksFromBirthDate, formatBabyAgeFromBirthDate, isNightHour } from "../src/lib"
import { DeleteConfirmDialog } from "../src/components/DeleteConfirmDialog"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  ReferenceArea,
} from "recharts"
import {
  Calendar,
  Plus,
  LogOut,
  Trash2,
  Heart,
  Activity,
  Edit3,
  Check,
  X,
  Trophy,
  Star,
  Info,
  Sun,
  Moon,
  AlignHorizontalSpaceAround,
  Droplets,
  Circle,
} from "lucide-react"
import { LoginForm } from "@/components/login-form"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// Tooltip UI non utilisé ici

// ===========================
// Supabase
// ===========================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ===========================
// Auth simple
// ===========================

// Les utilisateurs sont maintenant récupérés via l'API route sécurisée
const USERS: User[] = [];

// ===========================
// Composant principal
// ===========================
export default function FoodTracker() {
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

  const [intervalChartData24h, setIntervalChartData24h] = useState<IntervalChartData[]>([])
  const [intervalChartData72h, setIntervalChartData72h] = useState<IntervalChartData[]>([])
  const [intervalChartData7d, setIntervalChartData7d] = useState<IntervalChartData[]>([])

  const [recordBroken, setRecordBroken] = useState<RecordBroken | null>(null)
  const [showRecordModal, setShowRecordModal] = useState(false)
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showPredictionInfo, setShowPredictionInfo] = useState(false)

  // ===========================
  // User utility functions (defined early to avoid hoisting issues)
  // ===========================
  
  // Get current user info (récupéré depuis l'état de l'application)
  const getCurrentUserInfo = () => {
    if (currentUserId && babyBirthDate) {
      return {
        id: currentUserId,
        username: currentUser,
        babyBirthDate: babyBirthDate
      }
    }
    return null
  }

  // Get baby birth date for current user
  const getBabyBirthDate = () => {
    const user = getCurrentUserInfo()
    if (!user || !user.babyBirthDate) return null
    return new Date(user.babyBirthDate)
  }

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

  // Détection automatique jour/nuit avec paramètre d'URL
  const isNightTime = () => isNightHour(new Date())
  
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
  const [isLikelyWindow, setIsLikelyWindow] = useState<boolean | null>(null)

  const [reliabilityIndex, setReliabilityIndex] = useState<number | null>(null)

  // ===========================
  // Confettis
  // ===========================
  const launchConfetti = () => {
    
    if (typeof window === "undefined" || !(window as any).confetti) {
      
      // SOLUTION 1: Recharger le script confetti
      const script = document.createElement("script")
      script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"
      script.async = true
      script.onload = () => {
        setTimeout(() => launchConfetti(), 100)
      }
      document.head.appendChild(script)
      return
    }
    const duration = 3000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }
    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()
      if (timeLeft <= 0) return clearInterval(interval)
      const particleCount = 50 * (timeLeft / duration)
      ;[
        { x: Math.random() * 0.2 + 0.1, y: Math.random() - 0.2 },
        { x: Math.random() * 0.2 + 0.7, y: Math.random() - 0.2 },
      ].forEach((origin) => (window as any).confetti({ ...defaults, particleCount, origin }))
    }, 250)
    setTimeout(() => clearInterval(interval), duration)
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
  const handleSupabaseError = (error: Error | { message: string }, operation: string) => {
    console.error(`Erreur Supabase (${operation}):`, error)
    throw new Error(`Erreur lors de ${operation}: ${error.message}`)
  }

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
      return await fetchLogsWithOptionsSvc(options, userIdToUse)
    } catch (error: any) {
      handleSupabaseError(error, "data retrieval")
      return []
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

  // Synchroniser timeSinceLast avec timeSinceLastCalculated pour que l'UI se mette à jour
  useEffect(() => {
    setTimeSinceLast(timeSinceLastCalculated)
  }, [timeSinceLastCalculated])

  // ===========================
  // Logique de recommandation de sein (alternance intelligente)
  // ===========================
  const suggestedSide = useMemo(() => {
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
      return await fetchTotalLogsCountSvc(userIdToUse)
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
      const count = await fetchTodayCountSvc(userIdToUse)
      setTodayCount(count)
    } catch (e) {
      console.error("Error fetching today count:", e)
    }
  }

  // ---------- Helpers dates pour l'agrégation quotidienne ----------
  const pad2 = (n: number) => n.toString().padStart(2, "0")
  const isoDayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  const frShortDayLabel = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }).replace(/\.$/, "")

  // Construit une série continue jour par jour [start..end] et y injecte les comptes {left,right}
  const buildDailySeries = (logs: FoodLog[], start: Date, end: Date) => {
    const map: Record<string, { left: number; right: number; bottle: number }> = {}

    for (const log of logs) {
      const d = new Date(log.timestamp)
      const key = isoDayKey(d)
      if (!map[key]) map[key] = { left: 0, right: 0, bottle: 0 }
      map[key][log.side]++
    }

    const res: Array<{ dayKey: string; date: string; left: number; right: number; bottle: number; total: number }> = []
    const cur = new Date(start)
    cur.setHours(0, 0, 0, 0)
    const endCopy = new Date(end)
    endCopy.setHours(0, 0, 0, 0)

    while (cur <= endCopy) {
      const key = isoDayKey(cur)
      const buckets = map[key] ?? { left: 0, right: 0, bottle: 0 }
      res.push({
        dayKey: key,
        date: frShortDayLabel(cur),
        left: buckets.left,
        right: buckets.right,
        bottle: buckets.bottle,
        total: buckets.left + buckets.right + buckets.bottle,
      })
      cur.setDate(cur.getDate() + 1)
    }
    return res
  }

  // Récupère et agrège sur "days" jours glissants (inclus aujourd'hui)
  const fetchDailyStatsRange = async (days: number, userId?: string) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - (days - 1))
    start.setHours(0, 0, 0, 0)
    const data = await fetchLogsWithOptions({ startDate: start, orderBy: "timestamp", ascending: true }, userId)
    return buildDailySeries(data as FoodLog[], start, end)
  }

  // ---- Interval charts ----
  const processIntervalData = (data: FoodLog[], period: string) => {
    const intervalData: ProcessedIntervalData[] = []
    const sorted = data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i]
      const prev = sorted[i - 1]
      const intervalMinutes = Math.round(
        (new Date(cur.timestamp).getTime() - new Date(prev.timestamp).getTime()) / (1000 * 60),
      )
      const date = new Date(cur.timestamp)
      const prevDate = i > 1 ? new Date(sorted[i - 1].timestamp) : null
      const dateChanged = !!(prevDate && date.toDateString() !== prevDate.toDateString())
      let timeLabel
      if (period === "48h") {
        timeLabel = dateChanged
          ? `${date.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })} ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
          : date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      } else {
        timeLabel = `${date.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })} ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
      }
      intervalData.push({
        date: date.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" }),
        time: timeLabel,
        interval: intervalMinutes,
        hour: date.getHours(),
        isNight: isNightHour(date),
        timestamp: cur.timestamp,
        dateChanged,
        fullDate: date,
        index: i - 1,
        numericTime: date.getTime(), // Ajout d'une valeur numérique pour l'axe X
        side: cur.side, // Ajouter le côté de la tétée
      })
    }
    if (intervalData.length >= 2) {
      const n = intervalData.length
      const sumX = intervalData.reduce((s, _, idx) => s + idx, 0)
      const sumY = intervalData.reduce((s, p) => s + p.interval, 0)
      const sumXY = intervalData.reduce((s, p, idx) => s + idx * p.interval, 0)
      const sumXX = intervalData.reduce((s, _, idx) => s + idx * idx, 0)
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
      const intercept = (sumY - slope * sumX) / n
      intervalData.forEach((p, idx) => (p.trendLine = slope * idx + intercept))
    }
    return intervalData
  }

  const fetchIntervalChartData24h = async (userId?: string) => {
    try {
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)
      const data = await fetchLogsWithOptions({ startDate: oneDayAgo, orderBy: "timestamp", ascending: true }, userId)
      setIntervalChartData24h(processIntervalData(data, "24h"))
    } catch (e) {
      console.error("Error fetching 24h interval data:", e)
    }
  }

  const fetchIntervalChartData72h = async (userId?: string) => {
    try {
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      const data = await fetchLogsWithOptions({ startDate: threeDaysAgo, orderBy: "timestamp", ascending: true }, userId)
      setIntervalChartData72h(processIntervalData(data, "72h"))
    } catch (e) {
      console.error("Error fetching 72h interval data:", e)
    }
  }

  const fetchIntervalChartData7d = async (userId?: string) => {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const data = await fetchLogsWithOptions({ startDate: sevenDaysAgo, orderBy: "timestamp", ascending: true }, userId)
      setIntervalChartData7d(processIntervalData(data, "7d"))
    } catch (e) {
      console.error("Error fetching 7d interval data:", e)
    }
  }

    // Calcul de l'intervalle médian par semaine
  const calculateWeeklyMedianData = async (userId?: string) => {
    try {
      const twelveWeeksAgo = new Date()
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84) // 12 semaines
      
      // Récupérer les données jusqu'à aujourd'hui (pas seulement depuis 12 semaines)
      const endDate = new Date()
      const data = await fetchLogsWithOptions({ 
        startDate: twelveWeeksAgo, 
        endDate: endDate,
        orderBy: "timestamp", 
        ascending: true 
      }, userId)
      
      if (data.length < 2) {
        setWeeklyMedianData([])
        return
      }

      // Trier les tétées de la plus récente à la moins récente
      const sorted = data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      
      // Fonction pour calculer le numéro de semaine ISO (lundi = début de semaine)
      const getISOWeek = (date: Date) => {
        const d = new Date(date.getTime())
        d.setHours(0, 0, 0, 0)
        
        // Trouver le jeudi de la semaine (4ème jour de la semaine ISO)
        const dayOfWeek = d.getDay() // 0 = dimanche, 1 = lundi, ..., 6 = samedi
        const daysToThursday = dayOfWeek === 0 ? 4 : 4 - dayOfWeek // Si dimanche, aller au jeudi suivant (+4)
        d.setDate(d.getDate() + daysToThursday)
        
        // 1er janvier de l'année
        const yearStart = new Date(d.getFullYear(), 0, 1)
        
        // Numéro de semaine ISO
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
        return weekNo
      }

      // Fonction pour calculer le début de semaine (lundi au dimanche)
      const getWeekStart = (date: Date) => {
        const weekStart = new Date(date)
        const dayOfWeek = weekStart.getDay() // 0 = dimanche, 1 = lundi, ..., 6 = samedi
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Si dimanche, soustraire 6 pour aller au lundi précédent
        weekStart.setDate(weekStart.getDate() - daysToSubtract)
        weekStart.setHours(0, 0, 0, 0)
        return weekStart
      }

      // Pour chaque tétée, calculer le numéro de semaine et l'écart avec la précédente
      const weeklyData: { [weekKey: string]: { day: number[], night: number[] } } = {}
      
      for (let i = 0; i < sorted.length; i++) {
        const currentFeeding = sorted[i]
        const currentDate = new Date(currentFeeding.timestamp)
        
        // Calculer le numéro de semaine
        const weekStart = getWeekStart(currentDate)
        const weekKey = `${weekStart.getFullYear()}-${(weekStart.getMonth() + 1).toString().padStart(2, '0')}-${weekStart.getDate().toString().padStart(2, '0')}`
        
        // Calculer l'écart avec la tétée précédente
        let interval = 0
        if (i < sorted.length - 1) {
          const previousFeeding = sorted[i + 1]
          const previousDate = new Date(previousFeeding.timestamp)
          interval = Math.round((currentDate.getTime() - previousDate.getTime()) / (1000 * 60))
        }
        
        // Déterminer si c'est jour ou nuit (22h-7h = nuit)
        const hour = currentDate.getHours()
        const isNight = isNightHour(currentDate)
        
        // Grouper par semaine et par période
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { day: [], night: [] }
        }
        if (interval > 0) { // Ne garder que les intervalles valides
          if (isNight) {
            weeklyData[weekKey].night.push(interval)
          } else {
            weeklyData[weekKey].day.push(interval)
          }
        }
      }

      // Calculer les statistiques par semaine (jour et nuit séparément)
      const weeklyStats: WeeklyMedianData[] = Object.entries(weeklyData)
        .filter(([_, data]) => data.day.length >= 1 || data.night.length >= 1) // Au moins 1 intervalle par semaine
        .map(([weekStart, data]) => {
          // Calculer les statistiques pour le jour
          const dayIntervals = data.day.sort((a, b) => a - b)
          const dayMedianIndex = Math.floor(dayIntervals.length / 2)
          const dayMedianInterval = dayIntervals.length % 2 === 0 
            ? (dayIntervals[dayMedianIndex - 1] + dayIntervals[dayMedianIndex]) / 2
            : dayIntervals[dayMedianIndex]
          
          const dayAvgInterval = dayIntervals.length > 0 ? dayIntervals.reduce((sum, interval) => sum + interval, 0) / dayIntervals.length : 0
          const dayMinInterval = dayIntervals.length > 0 ? Math.min(...dayIntervals) : 0
          const dayMaxInterval = dayIntervals.length > 0 ? Math.max(...dayIntervals) : 0
          
          // Calculer l'écart-type et coefficient de variation pour le jour
          const dayStdDev = dayIntervals.length > 1 ? Math.sqrt(dayIntervals.reduce((sum, interval) => sum + Math.pow(interval - dayAvgInterval, 2), 0) / (dayIntervals.length - 1)) : 0
          const dayCV = dayAvgInterval > 0 ? (dayStdDev / dayAvgInterval) * 100 : 0
          
          // Calculer les statistiques pour la nuit
          const nightIntervals = data.night.sort((a, b) => a - b)
          const nightMedianIndex = Math.floor(nightIntervals.length / 2)
          const nightMedianInterval = nightIntervals.length % 2 === 0 
            ? (nightIntervals[nightMedianIndex - 1] + nightIntervals[nightMedianIndex]) / 2
            : nightIntervals[nightMedianIndex]
          
          
          const nightAvgInterval = nightIntervals.length > 0 ? nightIntervals.reduce((sum, interval) => sum + interval, 0) / nightIntervals.length : 0
          const nightMinInterval = nightIntervals.length > 0 ? Math.min(...nightIntervals) : 0
          const nightMaxInterval = nightIntervals.length > 0 ? Math.max(...nightIntervals) : 0
          
          // Calculer l'écart-type et coefficient de variation pour la nuit
          const nightStdDev = nightIntervals.length > 1 ? Math.sqrt(nightIntervals.reduce((sum, interval) => sum + Math.pow(interval - nightAvgInterval, 2), 0) / (nightIntervals.length - 1)) : 0
          const nightCV = nightAvgInterval > 0 ? (nightStdDev / nightAvgInterval) * 100 : 0
          
          const weekStartDate = new Date(weekStart)
          const weekEndDate = new Date(weekStartDate)
          weekEndDate.setDate(weekEndDate.getDate() + 6)
          
          const weekNumber = getISOWeek(weekStartDate)
          const year = weekStartDate.getFullYear()
          
          const result = {
            weekStart: weekStartDate.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" }),
            weekEnd: weekEndDate.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" }),
            weekNumber: `${year}W${weekNumber.toString().padStart(2, '0')}`,
            dayMedianInterval: dayIntervals.length > 0 ? dayMedianInterval : 0,
            nightMedianInterval: nightIntervals.length > 0 ? nightMedianInterval : 0,
            dayCount: dayIntervals.length,
            nightCount: nightIntervals.length,
            dayAvgInterval: Math.round(dayAvgInterval),
            nightAvgInterval: Math.round(nightAvgInterval),
            dayMinInterval,
            nightMinInterval,
            dayMaxInterval,
            nightMaxInterval,
            dayCV: Math.round(dayCV * 10) / 10,
            nightCV: Math.round(nightCV * 10) / 10,
            dayStdDev: Math.round(dayStdDev),
            nightStdDev: Math.round(nightStdDev)
          }
          
          return result
                  })
        .sort((a, b) => {
          // Trier par numéro de semaine pour avoir l'ordre chronologique correct
          const weekA = parseInt(a.weekNumber.split('W')[1])
          const weekB = parseInt(b.weekNumber.split('W')[1])
          const yearA = parseInt(a.weekNumber.split('W')[0])
          const yearB = parseInt(b.weekNumber.split('W')[0])
          
          // Si même année, trier par numéro de semaine
          if (yearA === yearB) {
            return weekA - weekB
          }
          // Sinon trier par année
          return yearA - yearB
        })

      setWeeklyMedianData(weeklyStats)
    } catch (e) {
      console.error("Error calculating weekly median data:", e)
      setWeeklyMedianData([])
    }
  }

  // Calcul de l'intervalle médian des 7 derniers jours
  const calculateLast7DaysMedianData = async (userId?: string) => {
    try {
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14) // Récupérer 14 jours pour avoir plus de données
      
      // Récupérer les données des 14 derniers jours
      const endDate = new Date()
      const data = await fetchLogsWithOptions({ 
        startDate: fourteenDaysAgo, 
        endDate: endDate,
        orderBy: "timestamp", 
        ascending: true 
      }, userId)
      
      if (data.length < 2) {
        setLast7DaysData([])
        return
      }

      // Trier les tétées de la plus récente à la moins récente
      const sorted = data.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      // Grouper par jour - compter les tétées ET calculer les intervalles
      const dailyData: { [date: string]: { 
        dayIntervals: number[], 
        nightIntervals: number[], 
        dayFeedings: number, 
        nightFeedings: number 
      } } = {}
      
      // D'abord compter toutes les tétées par jour/nuit
      for (let i = 0; i < sorted.length; i++) {
        const feeding = sorted[i]
        const feedingTime = new Date(feeding.timestamp)
        const hour = feedingTime.getHours()
        const isDay = hour >= 7 && hour < 22
        
        // Attribution cohérente des tétées de nuit :
        // Nuit = 22h-6h59, toujours attribuée au jour qui SUIT
        // Ex: nuit du 20-21/09 → toutes les tétées comptées pour le 21/09
        
        // IMPORTANT: Utiliser l'heure locale pour les calculs de date, pas UTC
        const year = feedingTime.getFullYear()
        const month = feedingTime.getMonth()
        const day = feedingTime.getDate()
        let dateForStats = new Date(year, month, day) // Date locale sans heure
        
        if (hour >= 22) {
          // Nuit tardive (22h-23h59) : attribuer au jour suivant
          dateForStats.setDate(dateForStats.getDate() + 1)
        } else if (hour < 7) {
          // Nuit matinale (0h-6h59) : c'est la fin de la nuit précédente
          // Ex: 01:12 du 21/09 fait partie de la nuit du 20-21, donc reste au 21/09
          // Pas de changement de date nécessaire
        }
        
        const dateKey = `${dateForStats.getFullYear()}-${(dateForStats.getMonth()+1).toString().padStart(2,'0')}-${dateForStats.getDate().toString().padStart(2,'0')}`
        
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = { dayIntervals: [], nightIntervals: [], dayFeedings: 0, nightFeedings: 0 }
        }
        
        if (isDay) {
          dailyData[dateKey].dayFeedings++
        } else {
          dailyData[dateKey].nightFeedings++
        }
      }
      
      // Ensuite calculer les intervalles
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i]
        const next = sorted[i + 1]
        
        const currentTime = new Date(current.timestamp)
        const nextTime = new Date(next.timestamp)
        const interval = (currentTime.getTime() - nextTime.getTime()) / (1000 * 60) // en minutes
        
        // Déterminer si c'est jour ou nuit (7h-22h = jour, 22h-7h = nuit)
        const hour = currentTime.getHours()
        const isDay = hour >= 7 && hour < 22
        
        // Attribution cohérente des intervalles de nuit (même logique que pour les tétées)
        // Nuit = 22h-6h59, toujours attribuée au jour qui SUIT
        
        // IMPORTANT: Utiliser l'heure locale pour les calculs de date, pas UTC
        const year = currentTime.getFullYear()
        const month = currentTime.getMonth()
        const day = currentTime.getDate()
        let dateForStats = new Date(year, month, day) // Date locale sans heure
        
        if (hour >= 22) {
          // Nuit tardive (22h-23h59) : attribuer au jour suivant
          dateForStats.setDate(dateForStats.getDate() + 1)
        } else if (hour < 7) {
          // Nuit matinale (0h-6h59) : c'est la fin de la nuit précédente
          // Ex: 01:12 du 21/09 fait partie de la nuit du 20-21, donc reste au 21/09
          // Pas de changement de date nécessaire
        }
        
        const dateKey = `${dateForStats.getFullYear()}-${(dateForStats.getMonth()+1).toString().padStart(2,'0')}-${dateForStats.getDate().toString().padStart(2,'0')}`
        
        if (dailyData[dateKey]) {
          if (isDay) {
            dailyData[dateKey].dayIntervals.push(interval)
          } else {
            dailyData[dateKey].nightIntervals.push(interval)
          }
        }
      }

      // Calculer les statistiques par jour
      const last7DaysStats: Last7DaysData[] = Object.entries(dailyData)
        .filter(([_, data]) => data.dayIntervals.length >= 1 || data.nightIntervals.length >= 1)
        .map(([date, data]) => {
          // Calculer les statistiques pour le jour
          const dayIntervals = data.dayIntervals.sort((a, b) => a - b)
          const dayMedianIndex = Math.floor(dayIntervals.length / 2)
          const dayMedianInterval = dayIntervals.length > 0 ? 
            Math.round((dayIntervals.length % 2 === 0 ? 
              (dayIntervals[dayMedianIndex - 1] + dayIntervals[dayMedianIndex]) / 2 : 
              dayIntervals[dayMedianIndex]) * 10) / 10 : 0
          
          const dayAvgInterval = data.dayIntervals.length > 0 ? 
            Math.round((data.dayIntervals.reduce((sum, interval) => sum + interval, 0) / data.dayIntervals.length) * 10) / 10 : 0
          
          const dayMinInterval = data.dayIntervals.length > 0 ? Math.round(Math.min(...data.dayIntervals) * 10) / 10 : 0
          const dayMaxInterval = data.dayIntervals.length > 0 ? Math.round(Math.max(...data.dayIntervals) * 10) / 10 : 0
          
          const dayStdDev = data.dayIntervals.length > 1 ? 
            Math.round(Math.sqrt(data.dayIntervals.reduce((sum, interval) => sum + Math.pow(interval - dayAvgInterval, 2), 0) / data.dayIntervals.length) * 10) / 10 : 0
          
          const dayCV = dayAvgInterval > 0 ? Math.round((dayStdDev / dayAvgInterval) * 100 * 10) / 10 : 0

          // Calculer les statistiques pour la nuit
          const nightIntervals = data.nightIntervals.sort((a, b) => a - b)
          const nightMedianIndex = Math.floor(nightIntervals.length / 2)
          const nightMedianInterval = nightIntervals.length > 0 ? 
            Math.round((nightIntervals.length % 2 === 0 ? 
              (nightIntervals[nightMedianIndex - 1] + nightIntervals[nightMedianIndex]) / 2 : 
              nightIntervals[nightMedianIndex]) * 10) / 10 : 0
          
          const nightAvgInterval = data.nightIntervals.length > 0 ? 
            Math.round((data.nightIntervals.reduce((sum, interval) => sum + interval, 0) / data.nightIntervals.length) * 10) / 10 : 0
          
          const nightMinInterval = data.nightIntervals.length > 0 ? Math.round(Math.min(...data.nightIntervals) * 10) / 10 : 0
          const nightMaxInterval = data.nightIntervals.length > 0 ? Math.round(Math.max(...data.nightIntervals) * 10) / 10 : 0
          
          const nightStdDev = data.nightIntervals.length > 1 ? 
            Math.round(Math.sqrt(data.nightIntervals.reduce((sum, interval) => sum + Math.pow(interval - nightAvgInterval, 2), 0) / data.nightIntervals.length) * 10) / 10 : 0
          
          const nightCV = nightAvgInterval > 0 ? Math.round((nightStdDev / nightAvgInterval) * 100 * 10) / 10 : 0

          return {
            date,
            dayMedianInterval: dayAvgInterval, // Utiliser la moyenne pour les données quotidiennes
            nightMedianInterval: nightAvgInterval, // Utiliser la moyenne pour les données quotidiennes
            dayCount: data.dayFeedings, // Maintenant compte les tétées réelles
            nightCount: data.nightFeedings, // Maintenant compte les tétées réelles
            dayAvgInterval,
            nightAvgInterval,
            dayMinInterval,
            nightMinInterval,
            dayMaxInterval,
            nightMaxInterval,
            dayCV,
            nightCV,
            dayStdDev,
            nightStdDev
          }
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .filter((item) => {
          const itemDate = new Date(item.date)
          const sevenDaysAgo = new Date()
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
          return itemDate >= sevenDaysAgo
        })

      setLast7DaysData(last7DaysStats)
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
    console.log("🔄 UPDATEANDCHECKRECORDS DÉBUT:", { isNewFeeding, newFeedingTimestamp })
    try {
      // D'abord calculer les records EXISTANTS (avant la nouvelle tétée)
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      let data = await fetchLogsWithOptions({ startDate: thirtyDaysAgo, orderBy: "timestamp", ascending: true }, userId)
      
      // Si c'est une nouvelle tétée, exclure temporairement la nouvelle tétée du calcul des records existants
      if (isNewFeeding && newFeedingTimestamp) {
        const beforeFilter = data.length
        
        // Normaliser les timestamps pour la comparaison
        const normalizedNewFeedingTimestamp = newFeedingTimestamp.replace("Z", "+00:00")
        
        data = data.filter((log) => {
          const normalizedLogTimestamp = log.timestamp.replace("Z", "+00:00")
          return normalizedLogTimestamp !== normalizedNewFeedingTimestamp
        })
        
        const afterFilter = data.length
        console.log("🔍 FILTRAGE POUR RECORDS EXISTANTS:", {
          beforeFilter,
          afterFilter,
          newFeedingTimestamp,
          normalizedNewFeedingTimestamp,
          filteredOut: beforeFilter - afterFilter,
        })
        
        // Vérifier si le filtrage a fonctionné
        const foundNewFeeding = data.some((log) => {
          const normalizedLogTimestamp = log.timestamp.replace("Z", "+00:00")
          return normalizedLogTimestamp === normalizedNewFeedingTimestamp
        })
        console.log("🔍 VÉRIFICATION FILTRAGE:", {
          foundNewFeeding,
          shouldBeFalse: !foundNewFeeding,
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
      
      console.log("📊 RECORDS EXISTANTS CALCULÉS:", {
        dayRecords: newDay.map((r) => r.interval),
        nightRecords: newNight.map((r) => r.interval),
        isNewFeeding,
      })
      
      // Ensuite vérifier si un nouveau record est battu
      if (isNewFeeding && newFeedingTimestamp) {
        // 1. Récupérer les 2 dernières tétées pour calculer l'intervalle
        const recentFeedings = await fetchLogsWithOptions({ limit: 2, orderBy: "timestamp", ascending: false })
        if (recentFeedings.length === 0) {
          console.log("❌ AUCUNE TÉTÉE TROUVÉE")
          return
        }
        
        if (recentFeedings.length === 1) {
          console.log("❌ AUCUNE TÉTÉE PRÉCÉDENTE TROUVÉE (première tétée)")
          return
        }
        
        // La première est la nouvelle tétée, la deuxième est la tétée précédente
        const lastFeedingTimestamp = recentFeedings[1].timestamp
        const currentInterval = calculateInterval(new Date(newFeedingTimestamp), new Date(lastFeedingTimestamp))
        
        console.log("🔍 DIAGNOSTIC INTERVALLE:", {
          newFeedingTimestamp,
          lastFeedingTimestamp,
          currentInterval,
          areEqual: newFeedingTimestamp === lastFeedingTimestamp,
          recentFeedingsCount: recentFeedings.length,
          firstFeeding: recentFeedings[0]?.timestamp,
          secondFeeding: recentFeedings[1]?.timestamp,
        })
        
        // 2. Déterminer si c'est jour ou nuit
        const newFeedingTime = new Date(newFeedingTimestamp)
        const isNight = isNightHour(newFeedingTime)
        
        // 3. Utiliser les records fraîchement calculés
        const existingRecords = isNight ? newNight : newDay
        
        console.log("🔍 VÉRIFICATION RECORD OPTIMISÉE:", {
          currentInterval,
          isNight,
          existingRecords: existingRecords.map((r) => r.interval),
          recordsDay: records.day.map((r) => r.interval),
          recordsNight: records.night.map((r) => r.interval),
          newFeedingTimestamp,
          lastFeedingTimestamp,
          timeDiffMs: new Date(newFeedingTimestamp).getTime() - new Date(lastFeedingTimestamp).getTime(),
        })
        
        // Si les records sont vides, on ne peut pas faire de comparaison
        if (existingRecords.length === 0) {
          console.log("⚠️ RECORDS VIDES - Impossible de détecter un record")
          console.log("📊 État des records:", {
            dayRecords: records.day.length,
            nightRecords: records.night.length,
            isNight,
          })
        }
        
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
          
          console.log("🔍 COMPARAISON RECORDS EXISTANTS:", {
            currentInterval,
            goldRecord,
            silverRecord,
            bronzeRecord,
            isNight,
          })
          
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
          
          // Log détaillé pour diagnostiquer
          console.log("🔍 SÉLECTION RECORD:", {
            beatenRecords,
            goldRecord,
            silverRecord,
            bronzeRecord,
            selectedRecord: recordType,
            selectedOldRecord: oldRecord,
          })
        }
        
        // 5. Déclencher les confettis si on bat un record
        if (recordType) {
          console.log("🎯 RECORD DÉTECTÉ:", {
            type: isNight ? "night" : "day",
            recordLevel: recordType,
            newRecord: currentInterval,
            oldRecord: oldRecord,
            beatenRecords: beatenRecords,
            isNight: isNight,
          })
          
          const recordBrokenObject: RecordBroken = { 
            type: isNight ? "night" : "day", 
            recordLevel: recordType as "bronze" | "silver" | "gold",
            newRecord: currentInterval, 
            oldRecord: oldRecord, 
            improvement: currentInterval - oldRecord,
            beatenRecords: beatenRecords,
          }
          
          if (recordBrokenObject && recordBrokenObject.type && recordBrokenObject.recordLevel) {
            setRecordBroken(recordBrokenObject)
            setShowRecordModal(true)
            launchConfetti()
            console.log("✅ Record, modal et confettis déclenchés")
          } else {
            console.log("❌ Objet record invalide:", recordBrokenObject)
          }
        } else {
          console.log("❌ AUCUN RECORD DÉTECTÉ:", {
            currentInterval,
            isNight,
            existingRecords: existingRecords.map((r) => r.interval),
            recordType,
          })
        }
      }
      
      console.log("✅ UPDATEANDCHECKRECORDS TERMINÉ")
    } catch (e) {
      console.error("Error updating records:", e)
      console.log("❌ UPDATEANDCHECKRECORDS ERREUR:", e)
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
      .find((r: any) => timeSinceLast <= r.interval)
    const beaten = chase.filter((r: any) => timeSinceLast >= r.interval).map((r: any) => r.rank)

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
      timeSinceMinutes: timeSinceLastCalculated ?? undefined,
    })
  }, [logs, totalLogsCount, timeSinceLastCalculated])

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

  // Tick formatter mémorisé pour l'axe X
  const xAxisTickFormatter = useCallback(
    (value: number) => {
    if (!logs.length) return ""
    const lastFeedingTime = new Date(logs[0].timestamp)
    const tickTime = new Date(lastFeedingTime.getTime() + value * 60 * 1000)
    return tickTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    },
    [logs],
  )

  // ===========================
  // Actions CRUD
  // ===========================
  const addLog = useCallback(async (side: "left" | "right" | "bottle") => {
    // Vérifier l'authentification via l'état React OU le localStorage
    const isAuthFromState = isAuthenticated
    const isAuthFromStorage = localStorage.getItem("diaper-auth") === "true"
    const isUserAuthenticated = isAuthFromState || isAuthFromStorage
    
    if (!isUserAuthenticated) {
      console.error("❌ ERROR - User not authenticated in addLog!")
      setError("User not connected")
      return
    }
    
    // Récupérer l'ID utilisateur depuis localStorage si currentUserId n'est pas encore défini
    const userIdToUse = currentUserId || localStorage.getItem("diaper-user-id")
    
    if (!userIdToUse) {
      console.error("❌ ERROR - currentUserId is not set in addLog!")
      setError("User not connected")
      return
    }
    
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      if (!side || (side !== "left" && side !== "right" && side !== "bottle")) throw new Error("Type invalide")
      const feedingTimestamp = new Date().toISOString() // Timestamp de la nouvelle tétée
      console.log("➕ AJOUT TÉTÉE:", { side, feedingTimestamp })
      await addLogEntry({ side, timestamp: feedingTimestamp, userId: userIdToUse })
      
      console.log("✅ TÉTÉE INSÉRÉE AVEC SUCCÈS")
      setSuccess("Feeding saved!")
      
      // Mise à jour immédiate du côté pour la recommandation suivante (seins uniquement)
      if (side === "left" || side === "right") {
        setLastFeedingSide(side)
      }
      
      console.log("🔄 DÉBUT LOADALLDATAWITHRECORDCHECK")
      await loadAllDataWithRecordCheck(feedingTimestamp, userIdToUse) // Passer le vrai timestamp et l'ID utilisateur
      console.log("✅ LOADALLDATAWITHRECORDCHECK TERMINÉ")
    } catch (e: unknown) {
      console.error("Error adding log:", e)
      const errorMessage = e instanceof Error ? e.message : "Error saving feeding"
      setError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }, [])

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
    } catch (e: any) {
      console.error("Error updating log:", e)
      setError(e.message || "Error modifying feeding")
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
    } catch (e: any) {
      console.error("Error deleting log:", e)
      setError(e.message || "Error deleting feeding")
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
    if (loading) {
      console.log("⏳ loadAllData déjà en cours, ignoré")
      return
    }
    
    const userIdToUse = getUserIdSafely(userId)
    if (!userIdToUse) {
      console.error("❌ ERROR - currentUserId is not set in loadAllData!")
      return
    }
    
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
    console.log("🔄 LOADALLDATAWITHRECORDCHECK DÉBUT:", { newFeedingTimestamp })
    
    // FIX: Attendre que fetchLogs() soit terminé AVANT de vérifier les records
    console.log("📥 FETCH LOGS...")
    try {
      await fetchLogs(userId) // Attendre que les nouvelles données soient disponibles
      console.log("✅ FETCH LOGS TERMINÉ")
    } catch (error) {
      console.error("❌ ERREUR FETCH LOGS:", error)
      throw error
    }
    
    // FIX: Délai supplémentaire pour s'assurer que la base est à jour
    console.log("⏳ DÉLAI 100MS...")
    try {
      await new Promise((resolve) => setTimeout(resolve, 100))
      console.log("✅ DÉLAI TERMINÉ")
    } catch (error) {
      console.error("❌ ERREUR DÉLAI:", error)
      throw error
    }
    
    console.log("🔄 PROMISE.ALL DÉBUT...")
    try {
      // D'abord charger toutes les données (sans vérifier les records)
      await Promise.all([
        fetchTodayCount(userId).then(() => console.log("✅ fetchTodayCount terminé")),
        fetchDailyStatsRange(7, userId)
          .then(setDailyStats7d)
          .then(() => console.log("✅ fetchDailyStatsRange(7) terminé")),
        fetchDailyStatsRange(30, userId)
          .then(setDailyStats30d)
          .then(() => console.log("✅ fetchDailyStatsRange(30) terminé")),
        fetchIntervalChartData24h(userId).then(() => console.log("✅ fetchIntervalChartData24h terminé")),
        fetchIntervalChartData72h(userId).then(() => console.log("✅ fetchIntervalChartData72h terminé")),
        fetchIntervalChartData7d(userId).then(() => console.log("✅ fetchIntervalChartData7d terminé")),
        calculateWeeklyMedianData(userId).then(() => console.log("✅ calculateWeeklyMedianData terminé")),
        calculateLast7DaysMedianData(userId).then(() => console.log("✅ calculateLast7DaysMedianData terminé")),

      ])
      console.log("✅ PROMISE.ALL TERMINÉ")
      
      // Ensuite, calculer les records et vérifier s'il y en a un de battu
      console.log("🔄 CALCUL ET VÉRIFICATION DES RECORDS...")
      await updateAndCheckRecords(true, newFeedingTimestamp, userId)
      console.log("✅ CALCUL ET VÉRIFICATION DES RECORDS TERMINÉ")
    } catch (error) {
      console.error("❌ ERREUR PROMISE.ALL:", error)
      throw error
    }
    
    const recordCheckTimer = setTimeout(() => {
      console.log("⏰ TIMER CHECK APPROACHING RECORD")
      checkApproachingRecord()
      // calculateSmartAlerts() supprimé - synchronisation automatique
    }, 500)
    // Nettoyer le timer si la fonction est appelée plusieurs fois rapidement
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
      }, 300000) // 300 secondes = 5 minutes
      
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
        
        // Premier essai après un court délai
        const timer1 = setTimeout(() => {
          if (!tryScroll()) {
            // Deuxième essai après un délai plus long
            const timer2 = setTimeout(() => {
              if (!tryScroll()) {
                // Troisième essai après un délai encore plus long
                const timer3 = setTimeout(() => {
                  tryScroll()
                }, 1000)
                return () => clearTimeout(timer3)
              }
            }, 500)
            return () => clearTimeout(timer2)
          }
        }, 100)
        
        return () => clearTimeout(timer1)
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

  const formatPreciseTimeSince = useCallback((ts: string) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / (1000 * 60))
    return formatTimeInterval(diff)
  }, [])

  // Fonction helper pour les tooltips adaptatifs - Mémorisées
  const getTooltipStyle = useCallback(() =>
    isDarkMode ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-200 text-gray-900", [isDarkMode])
  
  // Fonction helper pour les contentStyle des tooltips - Mémorisée
  const getTooltipContentStyle = useCallback(() => ({
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
    (log: FoodLogWithInterval) => getRecordIndicatorLib(log, records),
    [records],
  )

  // ===========================
  // Render
  // ===========================
  if (!isAuthenticated) return <LoginForm onLogin={handleLogin} error={authError ?? undefined} />
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h1 data-testid="page-title" className="text-2xl font-bold flex items-center justify-center gap-2 mb-4">
              <img src="/logo_app.png" alt="Logo" className="h-8 w-8" />
              {t('pageTitle')}
            </h1>
            <p>Loading feeding tracking...</p>
          </div>
        </div>
      </div>
    )
  }

  // Utilisation de la version mémorisée
  // const suggestedSide = getSuggestedSide() // Remplacé par la version mémorisée plus haut
  // Logique améliorée : le bloc reste vert même après avoir dépassé la fenêtre
  const wasInWindow =
    smartAlerts.nextFeedingPrediction !== null &&
    timeSinceLast !== null && 
    expectedIntervalMinutes !== null && 
    probWindowMinutes !== null &&
    timeSinceLast >= expectedIntervalMinutes - probWindowMinutes / 2

  const todayCardColor =
    smartAlerts.nextFeedingPrediction === null
      ? ""
      : wasInWindow
        ? isDarkMode
          ? "bg-green-900/20 border-green-700"
          : "bg-green-50 border-green-200" // Vert si dans ou après la fenêtre
        : isDarkMode
          ? "bg-red-900/20 border-red-700"
          : "bg-red-50 border-red-200" // Rouge si jamais dans la fenêtre
  const lastTextColor =
    smartAlerts.nextFeedingPrediction === null
      ? "text-muted-foreground"
      : wasInWindow
        ? isDarkMode
          ? "text-green-400"
          : "text-green-600" // Vert si dans ou après la fenêtre
        : isDarkMode
          ? "text-red-400"
          : "text-red-600" // Rouge si jamais dans la fenêtre

  return (
    <HydrationWrapper>
    <div
      className={`min-h-screen ${
        isDarkMode 
          ? "dark bg-[#1a1a1a] text-gray-100" 
          : "bg-white text-gray-900"
      }`}
    >
      <div className="container mx-auto p-6 space-y-6">
      {/* Modal record */}
      <Dialog open={showRecordModal && recordBroken !== null} onOpenChange={setShowRecordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Trophy className="h-16 w-16 text-yellow-500 animate-bounce" />
                <Star className="h-6 w-6 text-yellow-400 absolute -top-1 -right-1 animate-spin" />
              </div>
            </div>
            <DialogTitle className="text-2xl font-bold text-center">🎉 NEW RECORD ! 🎉</DialogTitle>
            <DialogDescription className="text-center space-y-2">
              {recordBroken ? (
                <>
                  <div className="text-lg font-semibold text-primary">
                    {recordBroken.beatenRecords.length > 1 ? (
                      <>
                        {recordBroken.type === "day" ? "Day ☀️ records" : "Night 🌙 records"}{" "}
                        {recordBroken.beatenRecords
                          .map((r) => (r === "gold" ? "🥇" : r === "silver" ? "🥈" : "🥉"))
                          .join(" ")}{" "}
                        broken!
                      </>
                    ) : (
                      <>
                        {recordBroken.type === "day" ? "Day ☀️ record" : "Night 🌙 record"}{" "}
                        {recordBroken.recordLevel === "gold"
                          ? "🥇"
                          : recordBroken.recordLevel === "silver"
                            ? "🥈"
                            : "🥉"}{" "}
                        broken!
                      </>
                    )}
                  </div>
                  <div className="bg-gradient-to-r from-yellow-100 to-orange-100 p-4 rounded-lg">
                    <div className="text-3xl font-bold text-orange-600 mb-2">
                      {formatTimeInterval(recordBroken.newRecord)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {recordBroken.oldRecord > 0 ? (
                        <>
                          Old record : {formatTimeInterval(recordBroken.oldRecord)}
                          <br />
                          Improvement : +{formatTimeInterval(recordBroken.improvement)}
                        </>
                      ) : (
                        "First record established!"
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground">New Record loading...</div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-6">
            <Button
              onClick={() => setShowRecordModal(false)}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Fantastic !
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal delete confirm */}
      <DeleteConfirmDialog
        open={deleteConfirmId !== null}
        submitting={submitting}
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && confirmDelete(deleteConfirmId)}
      />

      {/* Header */}
      <AppHeader
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        currentUser={currentUser}
        onLogout={handleLogout}
        formatBabyAge={formatBabyAge}
        title={t('pageTitle')}
      />

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Add a feeding */}
      <AddFeedingPanel
        isDarkMode={isDarkMode}
        submitting={submitting}
        suggestedSide={suggestedSide}
        onAddFeeding={addLog}
      />

      {/* Cartes Aujourd'hui + Smart */}
      <TodayAndSmartCards
        isDarkMode={isDarkMode}
        wasInWindow={wasInWindow}
        todayCount={todayCount}
        timeSinceLast={timeSinceLast}
        lastTextColor={lastTextColor}
        setShowPredictionInfo={setShowPredictionInfo}
        reliabilityIndex={reliabilityIndex}
        totalLogsCount={totalLogsCount}
        logs={logs}
        expectedIntervalMinutes={expectedIntervalMinutes}
        smartAlerts={smartAlerts}
        probWindowMinutes={probWindowMinutes}
        stablePointPosition={stablePointPosition}
        predictionPointColor={predictionPointColor}
        predictionLegend={predictionLegend}
        approachingRecord={approachingRecord}
        calculateBabyAgeWeeks={calculateBabyAgeWeeks}
        formatTimeSinceLast={(m: number) => formatTimeSinceLast(m) ?? ""}
        formatTimeInterval={formatTimeInterval}
        roundToStep={roundToStep}
      />

      {/* Interval Evolution */}
        <Card className={`gap-2 ${isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"}`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <AlignHorizontalSpaceAround className="h-5 w-5" />
                Feeding Timeline
              </CardTitle>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-pink-500 rounded"></div>
                  <span>Left breast</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                  <span>Right breast</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Bottle</span>
                </div>
              </div>
          </CardHeader>
          <CardContent className="px-3 pt-0 pb-2">
              <div className="mt-1">
                <Tabs defaultValue="24h" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="24h">24h</TabsTrigger>
                    <TabsTrigger value="3d">3 days</TabsTrigger>
                    <TabsTrigger value="7d">7 days</TabsTrigger>
                  </TabsList>

                  <TabsContent value="24h" className="mt-2">
                    <div className="h-[280px] -mt-0.5 -mb-0.5">
                      {intervalChartData24h.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={intervalChartData24h}
                            margin={{ top: 8, right: 10, left: 0, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            {intervalChartData24h.length > 0 &&
                              (() => {
                                const rawStart = Math.min(...intervalChartData24h.map((d) => d.numericTime ?? 0))
                                const rawEnd = Math.max(...intervalChartData24h.map((d) => d.numericTime ?? 0))
                                const startAligned = new Date(rawStart); startAligned.setMinutes(0, 0, 0)
                                const endAligned = new Date(rawEnd); endAligned.setMinutes(0, 0, 0)
                                const startMs = startAligned.getTime()
                                const endMs = endAligned.getTime() + 60 * 60 * 1000
                                const zones = []
                                for (let time = startMs; time <= endMs; time += 60 * 60 * 1000) {
                                  const currentDate = new Date(time)
                                  const nextTime = Math.min(time + 60 * 60 * 1000, endMs)
                                  const isNight = isNightHour(currentDate)
                                  zones.push(
                                    <ReferenceArea
                                      key={`zone-${time}`}
                                      x1={time}
                                      x2={nextTime}
                                      fill={isNight ? "#cbd5e1" : "#fde68a"}
                                      fillOpacity={isNight ? 0.3 : 0.3}
                                    />,
                                  )
                                }
                                return zones
                              })()}
                            <XAxis
                              type="number"
                              dataKey="numericTime"
                              domain={["dataMin", "dataMax"]}
                              angle={-45}
                              textAnchor="end"
                              height={36}
                              tickMargin={4}
                              fontSize={10}
                              tick={{ fontSize: 10 }}
                              ticks={getXAxisTicks(intervalChartData24h)}
                              tickFormatter={(value: number) => {
                                const date = new Date(value)
                                const now = new Date()
                                const isToday = date.toDateString() === now.toDateString()
                                const isYesterday =
                                  date.toDateString() === new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString()
                                if (isToday) {
                                  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                                } else if (isYesterday) {
                                  return `Yesterday ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                                } else {
                                  return `${date.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })} ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                                }
                              }}
                            />
                            <YAxis 
                              tick={{ fontSize: 10 }} 
                              domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, dataMax + 30)]} 
                              tickFormatter={formatYAxisInterval}
                              ticks={getYAxisTicks(Math.max(...intervalChartData24h.map((d) => d.interval)))}
                              tickMargin={4}
                              padding={{ top: 2, bottom: 2 }}
                            />
                            <Tooltip
                              formatter={(v: any, name: any) =>
                                name === "Trend" ? [null, null] : [formatTimeInterval(v as number), "Deviation"]
                              }
                              labelFormatter={(label: any, payload: any) => {
                                if (payload && payload[0] && payload[0].payload) {
                                  const d = payload[0].payload
                                  const date = new Date(d.timestamp)
                                  return `${date.toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "2-digit" })} at ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                                }
                                return label
                              }}
                              contentStyle={getTooltipContentStyle()}
                            />
                            <Line
                              type="monotone"
                              dataKey="interval"
                              stroke="#8b5cf6"
                              strokeWidth={2}
                              dot={(props: any) => {
                                const { cx, cy, payload } = props
                                const sideKey = (payload.side ?? "bottle") as keyof typeof sideColors
                                const sideColor = payload.side ? sideColors[sideKey] : "#8b5cf6"
                                return (
                                  <circle
                                    key={`dot-${payload.timestamp}`}
                                    cx={cx}
                                    cy={cy}
                                    r={6}
                                    fill={sideColor}
                                    stroke="white"
                                    strokeWidth={2}
                                  />
                                )
                              }}
                              activeDot={{ r: 9, stroke: "white", strokeWidth: 2 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="trendLine"
                              stroke="#94a3b8"
                              strokeWidth={2}
                              strokeDasharray="8 4"
                              dot={false}
                              activeDot={false}
                              name="Trend"
                              opacity={0.6}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No feedings in 24h</p>
                            <p className="text-sm">At least 2 feedings are required</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="3d" className="mt-2">
                    <div className="h-[280px] -mt-0.5 -mb-0.5">
                      {intervalChartData72h.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                                              <LineChart
                          data={intervalChartData72h}
                        margin={{ top: 8, right: 10, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        
                        {/* Zones jour/nuit basées sur les timestamps réels */}
                        {intervalChartData72h.length > 0 &&
                          (() => {
                            const rawStart = Math.min(...intervalChartData72h.map((d) => d.numericTime ?? 0))
                            const rawEnd = Math.max(...intervalChartData72h.map((d) => d.numericTime ?? 0))
                            const startAligned = new Date(rawStart); startAligned.setMinutes(0, 0, 0)
                            const endAligned = new Date(rawEnd); endAligned.setMinutes(0, 0, 0)
                            const startMs = startAligned.getTime()
                            const endMs = endAligned.getTime() + 60 * 60 * 1000
                            const zones = []
                            for (let time = startMs; time <= endMs; time += 60 * 60 * 1000) {
                              const currentDate = new Date(time)
                              const nextTime = Math.min(time + 60 * 60 * 1000, endMs)
                              const isNight = isNightHour(currentDate)
                              zones.push(
                                <ReferenceArea
                                  key={`zone-${time}`}
                                  x1={time}
                                  x2={nextTime}
                                  fill={isNight ? "#cbd5e1" : "#fde68a"}
                                  fillOpacity={isNight ? 0.3 : 0.3}
                                  />,
                              )
                            }
                            return zones
                          })()}

                        <XAxis
                          type="number"
                          dataKey="numericTime"
                          domain={["dataMin", "dataMax"]}
                          angle={-45}
                          textAnchor="end"
                          height={36}
                          tickMargin={4}
                          fontSize={10}
                          tick={{ fontSize: 10 }}
                          ticks={getXAxisTicks(intervalChartData72h)}
                          tickFormatter={(value: number) => {
                            const date = new Date(value)
                            const now = new Date()
                            const isToday = date.toDateString() === now.toDateString()
                            const isYesterday =
                              date.toDateString() === new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString()
                            
                            if (isToday) {
                              return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                            } else if (isYesterday) {
                              return `Yesterday ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                            } else {
                              return `${date.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })} ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                            }
                          }}
                        />
                        <YAxis 
                          tick={{ fontSize: 10 }} 
                          domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, dataMax + 30)]} 
                          tickFormatter={formatYAxisInterval}
                          ticks={getYAxisTicks(Math.max(...intervalChartData72h.map((d) => d.interval)))}
                          tickMargin={4}
                          padding={{ top: 2, bottom: 2 }}
                        />
                        <Tooltip
                          formatter={(v: any, name: any) =>
                            name === "Trend" ? [null, null] : [formatTimeInterval(v as number), "Deviation"]
                          }
                          labelFormatter={(label: any, payload: any) => {
                            if (payload && payload[0] && payload[0].payload) {
                              const d = payload[0].payload
                              const date = new Date(d.timestamp)
                              return `${date.toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "2-digit" })} at ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                            }
                            return label
                          }}
                          contentStyle={getTooltipContentStyle()}
                        />

                        <Line
                          type="monotone"
                          dataKey="interval"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          
                          dot={(props: any) => {
                            const { cx, cy, payload } = props
                            const sideKey = (payload.side ?? "bottle") as keyof typeof sideColors
                            const sideColor = payload.side ? sideColors[sideKey] : "#8b5cf6"
                            const strokeColor = payload.side ? sideColors[sideKey] : "#7c3aed"
                            return (
                              <circle
                                key={`dot-${payload.timestamp}`}
                                cx={cx}
                                cy={cy}
                                r={4}
                                fill={sideColor}
                                stroke="white"
                                strokeWidth={2}
                              />
                            )
                          }}
                          activeDot={{ r: 6, stroke: "white", strokeWidth: 2 }}
                        />
                        
                        <Line
                          type="monotone"
                          dataKey="trendLine"
                          stroke="#94a3b8"
                          strokeWidth={2}
                          strokeDasharray="8 4"
                          dot={false}
                          activeDot={false}
                          name="Trend"
                          opacity={0.6}
                          
                        />
                        

                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No feedings in 72h</p>
                      <p className="text-sm">At least 2 feedings are required</p>
                      </div>
                    </div>
                  )}
                    </div>
                  </TabsContent>

                  <TabsContent value="7d" className="mt-2">
                    <div className="h-[280px] -mt-0.5 -mb-0.5">
                      {intervalChartData7d.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={intervalChartData7d}
                            margin={{ top: 8, right: 10, left: 0, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            {intervalChartData7d.length > 0 &&
                              (() => {
                                const rawStart = Math.min(...intervalChartData7d.map((d) => d.numericTime ?? 0))
                                const rawEnd = Math.max(...intervalChartData7d.map((d) => d.numericTime ?? 0))
                                const startAligned = new Date(rawStart); startAligned.setMinutes(0, 0, 0)
                                const endAligned = new Date(rawEnd); endAligned.setMinutes(0, 0, 0)
                                const startMs = startAligned.getTime()
                                const endMs = endAligned.getTime() + 60 * 60 * 1000
                                const zones = []
                                for (let time = startMs; time <= endMs; time += 60 * 60 * 1000) {
                                  const currentDate = new Date(time)
                                  const nextTime = Math.min(time + 60 * 60 * 1000, endMs)
                                  const isNight = isNightHour(currentDate)
                                  zones.push(
                                    <ReferenceArea
                                      key={`zone-${time}`}
                                      x1={time}
                                      x2={nextTime}
                                      fill={isNight ? "#cbd5e1" : "#fde68a"}
                                      fillOpacity={isNight ? 0.3 : 0.3}
                                    />,
                                  )
                                }
                                return zones
                              })()}
                            <XAxis
                              type="number"
                              dataKey="numericTime"
                              domain={["dataMin", "dataMax"]}
                              angle={-45}
                              textAnchor="end"
                              height={36}
                              tickMargin={4}
                              fontSize={10}
                              tick={{ fontSize: 10 }}
                              ticks={getXAxisTicks(intervalChartData7d)}
                              tickFormatter={(value: number) => {
                                const date = new Date(value)
                                const now = new Date()
                                const isToday = date.toDateString() === now.toDateString()
                                const isYesterday =
                                  date.toDateString() === new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString()
                                if (isToday) {
                                  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                                } else if (isYesterday) {
                                  return `Yesterday ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                                } else {
                                  return `${date.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })} ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                                }
                              }}
                            />
                            <YAxis
                              tick={{ fontSize: 10 }}
                              domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, dataMax + 30)]}
                              tickFormatter={formatYAxisInterval}
                              ticks={getYAxisTicks(Math.max(...intervalChartData7d.map((d) => d.interval)))}
                              tickMargin={4}
                              padding={{ top: 2, bottom: 2 }}
                            />
                            <Tooltip
                              formatter={(v: any, name: any) =>
                                name === "Trend" ? [null, null] : [formatTimeInterval(v as number), "Deviation"]
                              }
                              labelFormatter={(label: any, payload: any) => {
                                if (payload && payload[0] && payload[0].payload) {
                                  const d = payload[0].payload
                                  const date = new Date(d.timestamp)
                                  return `${date.toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "2-digit" })} at ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                                }
                                return label
                              }}
                              contentStyle={getTooltipContentStyle()}
                            />
                            <Line
                              type="monotone"
                              dataKey="interval"
                              stroke="#8b5cf6"
                              strokeWidth={2}
                              dot={(props: any) => {
                                const { cx, cy, payload } = props
                                const sideKey = (payload.side ?? "bottle") as keyof typeof sideColors
                                const sideColor = payload.side ? sideColors[sideKey] : "#8b5cf6"
                                return (
                                  <circle
                                    key={`dot-${payload.timestamp}`}
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={sideColor}
                                    stroke="white"
                                    strokeWidth={2}
                                  />
                                )
                              }}
                              activeDot={{ r: 6, stroke: "white", strokeWidth: 2 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="trendLine"
                              stroke="#94a3b8"
                              strokeWidth={2}
                              strokeDasharray="8 4"
                              dot={false}
                              activeDot={false}
                              name="Trend"
                              opacity={0.6}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No feedings in 7 days</p>
                            <p className="text-sm">At least 2 feedings are required</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
          </CardContent>
        </Card>

      {/* Intervalle médian par semaine */}
      <Card className={isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Interval Statistics
          </CardTitle>
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "#f59e0b" }}></div>
              <span>Day</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "#3b82f6" }}></div>
              <span>Night</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 pt-0 pb-2">
          <Tabs defaultValue="this-week" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="this-week">By days</TabsTrigger>
              <TabsTrigger value="by-week">By weeks</TabsTrigger>
            </TabsList>
            
            <TabsContent value="this-week" className="mt-1">
              <div className="h-[280px] -mt-0.5 -mb-0.5">
                {last7DaysData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={last7DaysData}
                      margin={{ top: 8, right: 10, left: 0, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        fontSize={10}
                        tick={{ fontSize: 10 }}
                        interval={0}
                        tickFormatter={(value: any) => {
                          const date = new Date(value)
                          return date.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' })
                        }}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 10 }}
                        domain={[0, (dataMax: number) => Math.max(180, dataMax + 30)]}
                        padding={{ top: 8, bottom: 0 }}
                        tickFormatter={(value: number) => {
                          if (value === 0) return "0min"
                          if (value === 30) return "30min"
                          if (value === 60) return "1h"
                          if (value === 90) return "1h30"
                          if (value === 120) return "2h"
                          if (value === 150) return "2h30"
                          if (value === 180) return "3h"
                          return formatYAxisInterval(value)
                        }}
                        ticks={[0, 30, 60, 90, 120, 150, 180]}
                      />
                      {/** Removed right Y axis (variability %) to give more plot width */}
                      <Tooltip
                        formatter={(value: any, name: any, props: any) => {
                          if (name === "☀️ Day") {
                            const data = props.payload
                            const roundedMedian = Math.round(value as number)
                            return [`${formatTimeInterval(roundedMedian)} (avg) - variability ${data.dayCV}%`, name]
                          } else if (name === "🌙 Night") {
                            const data = props.payload
                            const roundedMedian = Math.round(value as number)
                            return [`${formatTimeInterval(roundedMedian)} (avg) - variability ${data.nightCV}%`, name]
                          } else if (name === "Day variability %" || name === "Night variability %") {
                            return [null, null] // Masquer les lignes de variabilité séparées
                          } else {
                            return [formatTimeInterval(value as number), name]
                          }
                        }}
                        labelFormatter={(label: any, payload: any) => {
                          if (payload && payload[0] && payload[0].payload) {
                            const data = payload[0].payload
                            const totalCount = data.dayCount + data.nightCount
                            const date = new Date(data.date)
                            return (
                              <div>
                                <div>{`${date.toLocaleDateString('en-US')} (${totalCount} feedings)`}</div>
                                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                                  ☀️ Day: {data.dayCount} feedings • 🌙 Night: {data.nightCount} feedings
                                </div>
                              </div>
                            )
                          }
                          return ""
                        }}
                        contentStyle={getTooltipContentStyle()}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="dayMedianInterval"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ fill: "#f59e0b", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: "#f59e0b", strokeWidth: 2 }}
                        name="☀️ Day"
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="nightMedianInterval"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2 }}
                        name="🌙 Night"
                      />
                      {/** Variability lines removed from display; values remain available in tooltip via payload.dayCV/nightCV */}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Not enough data over 7 days</p>
                      <p className="text-xs mt-1">Need at least 2 feedings to calculate intervals</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="by-week" className="mt-1">
              <div className="h-[280px] -mt-0.5 -mb-0.5">
                {weeklyMedianData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={weeklyMedianData}
                      margin={{ top: 8, right: 10, left: 0, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="weekNumber"
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        fontSize={10}
                        tick={{ fontSize: 10 }}
                        interval={0}
                        tickFormatter={(value: any) => {
                          return value
                        }}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 10 }}
                        domain={[0, (dataMax: number) => Math.max(180, dataMax + 30)]}
                        padding={{ top: 8, bottom: 0 }}
                        tickFormatter={(value: number) => {
                          if (value === 0) return "0min"
                          if (value === 30) return "30min"
                          if (value === 60) return "1h"
                          if (value === 90) return "1h30"
                          if (value === 120) return "2h"
                          if (value === 150) return "2h30"
                          if (value === 180) return "3h"
                          return formatYAxisInterval(value)
                        }}
                        ticks={[0, 30, 60, 90, 120, 150, 180]}
                      />
                      {/** Removed right Y axis (variability %) to give more plot width */}
                      <Tooltip
                        formatter={(value: any, name: any, props: any) => {
                          if (name === "☀️ Day") {
                            const data = props.payload
                            const roundedMedian = Math.round(value as number)
                            return [`${formatTimeInterval(roundedMedian)} (median) - variability ${data.dayCV}%`, name]
                          } else if (name === "🌙 Night") {
                            const data = props.payload
                        return [`${formatTimeInterval(Math.round(value as number))} (median) - variability ${data.nightCV}%`, name]
                          } else if (name === "Day variability %" || name === "Night variability %") {
                            return [null, null] // Masquer les lignes de variabilité séparées
                          } else {
                            return [formatTimeInterval(value as number), name]
                          }
                        }}
                        labelFormatter={(label: any, payload: any) => {
                          if (payload && payload[0] && payload[0].payload) {
                            const data = payload[0].payload
                            const totalCount = data.dayCount + data.nightCount
                            return (
                              <div>
                                <div>{`Week from ${data.weekStart} to ${data.weekEnd} (${totalCount} feedings)`}</div>
                                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                                  ☀️ Day: {data.dayCount} feedings • 🌙 Night: {data.nightCount} feedings
                                </div>
                              </div>
                            )
                          }
                          return ""
                        }}
                        contentStyle={getTooltipContentStyle()}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="dayMedianInterval"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ fill: "#f59e0b", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: "#f59e0b", strokeWidth: 2 }}
                        name="☀️ Day"
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="nightMedianInterval"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2 }}
                        name="🌙 Night"
                      />
                      {/** Variability lines removed from display; values remain available in tooltip via payload.dayCV/nightCV */}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Not enough data over 12 weeks</p>
                      <p className="text-xs mt-1">Minimum 3 intervals per week</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Evolution */}
      <Card className={isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"}>
            <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              Evolution
            </CardTitle>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-pink-500 rounded"></div>
                <span>Left breast</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-500 rounded"></div>
                <span>Right breast</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Bottle</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 pt-0 pb-2">
            <Tabs defaultValue="7d" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="7d">7 days</TabsTrigger>
                <TabsTrigger value="30d">1&nbsp;month</TabsTrigger>
              </TabsList>

              {/* 7 jours */}
              <TabsContent value="7d" className="mt-1">
                <div className="h-[280px] -mt-0.5 -mb-0.5">
                  {dailyStats7d.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyStats7d}
                        margin={{ top: 2, right: 10, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} domain={getEvolutionYDomain} />
                        <Tooltip
                          formatter={(v: any, name: any) => {
                            const label = name === "left" ? "Left breast" : name === "right" ? "Right breast" : "Bottle"
                            return [v, label]
                          }}
                          labelFormatter={(label: any, payload: readonly any[]) => {
                            const p = payload?.[0]?.payload
                            return p ? `${p.date} — Total: ${p.total}` : ""
                          }}
                          contentStyle={getTooltipContentStyle()}
                        />
                        <Bar dataKey="left" stackId="tetees" fill={sideColors.left} />
                        <Bar dataKey="right" stackId="tetees" fill={sideColors.right} />
                        <Bar dataKey="bottle" stackId="tetees" fill={sideColors.bottle} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data available
                    </div>
                  )}
                </div>
              </TabsContent>


              {/* 30 jours */}
              <TabsContent value="30d" className="mt-1">
                <div className="h-[280px] -mt-0.5 -mb-0.5">
                  {dailyStats30d.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyStats30d}
                        margin={{ top: 2, right: 10, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} domain={getEvolutionYDomain} />
                        <Tooltip
                          formatter={(v: any, name: any) => {
                            const label = name === "left" ? "Left breast" : name === "right" ? "Right breast" : "Bottle"
                            return [v, label]
                          }}
                          labelFormatter={(label: any, payload: readonly any[]) => {
                            const p = payload?.[0]?.payload
                            return p ? `${p.date} — Total: ${p.total}` : ""
                          }}
                          contentStyle={getTooltipContentStyle()}
                        />
                        <Bar dataKey="left" stackId="tetees" fill={sideColors.left} />
                        <Bar dataKey="right" stackId="tetees" fill={sideColors.right} />
                        <Bar dataKey="bottle" stackId="tetees" fill={sideColors.bottle} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data available
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      {/* Records */}
      <MonthlyRecords
        isDarkMode={isDarkMode}
        records={records as any}
        formatTimeInterval={formatTimeInterval}
      />

      {/* Table récentes */}
      <RecentFeedingsTable
        isDarkMode={isDarkMode}
        logsWithIntervals={logsWithIntervals}
        editingId={editingId}
        editingDate={editingDate}
        editingTime={editingTime}
        startEditing={startEditing}
        cancelEditing={cancelEditing}
        saveEdit={saveEdit}
        deleteLog={deleteLog}
        formatTimestamp={formatTimestamp}
        sideLabels={sideLabels}
        sideBadgeVariant={sideBadgeVariant}
        formatTimeInterval={formatTimeInterval}
        getRecordIndicator={getRecordIndicator}
        onChangeEditingDate={setEditingDate}
        onChangeEditingTime={setEditingTime}
      />

      {/* Popup d'information sur les prédictions */}
      <PredictionInfoDialog
        open={showPredictionInfo}
        onOpenChange={setShowPredictionInfo}
        totalLogsCount={totalLogsCount}
        calculateBabyAgeWeeks={calculateBabyAgeWeeks}
      />
            </div>
            </div>
    </HydrationWrapper>
  )
}

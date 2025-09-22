"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
// User interface
interface User {
  id: string
  username: string
  password: string
  babyBirthDate: string // Format: YYYY-MM-DD
}



// Les utilisateurs sont maintenant récupérés via l'API route sécurisée
const USERS: User[] = [];

// ===========================
// Types
// ===========================
interface FoodLog {
  id: string
  side: "left" | "right" | "bottle"
  timestamp: string
  created_at: string
}

interface FoodLogWithInterval extends FoodLog {
  intervalMinutes?: number
}

interface RecordBroken {
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
interface DailyStatsData {
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
interface IntervalChartData {
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
// interface TimelineData {
//   timestamp: string
//   side: "left" | "right" | "bottle"
//   interval?: number
//   isRecord?: boolean
//   recordType?: "day" | "night"
// }
interface WeeklyMedianData {
  weekStart: string
  weekEnd: string
  weekNumber: string
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

interface Last7DaysData {
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

interface ApproachingRecord {
  timeRemaining: number
  isNight: boolean
  recordInterval: number
  nextRecordRank: string
  isApproaching: boolean
  allRecordsBroken: boolean
  beatenRecords: string[]
}

interface SmartAlerts {
  nextFeedingPrediction: number | null
  sideRecommendation: "left" | "right" | null
  reliabilityIndex?: number | null
  isClusterFeeding?: boolean
}

// ===========================
// Types pour les fonctions utilitaires
// ===========================
interface ProcessedIntervalData {
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

// ===========================
// Libellés & couleurs
// ===========================
  const sideLabels = { left: "Left", right: "Right", bottle: "Bottle" }
  const sideColors = { left: "#ec4899", right: "#8b5cf6", bottle: "#10b981" }

// ===========================
// Réglages prédiction
// ===========================
const PREDICTION = {
  TIME_WINDOW_HOURS: 72,
  MAX_INTERVALS: 50,
  MIN_SAMPLES_PER_SLOT: 3,
  MIN_SAMPLES_DAY_NIGHT: 8,
  ENABLE_WEEKEND_SPLIT_AFTER_DAYS: 14,
  OUTLIER_TRIM_RATIO: 0.20,
  CLAMP_MIN: 20,
  CLAMP_MAX: 180,
} as const

// Largeur de la "fenêtre probable" autour de l'intervalle attendu
const PROB_WINDOW = {
  MIN: 30,
  MAX: 90,
  FLOOR_RATIO: 0.25,
  MAD_SCALE: 1.4826,
} as const

// ===========================
// Helpers génériques
// ===========================
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const roundToStep = (v: number, step = 5) => Math.round(v / step) * step

const median = (arr: number[]) => {
  if (arr.length === 0) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

const mad = (arr: number[]) => {
  if (arr.length === 0) return 0
  const m = median(arr)
  const dev = arr.map((x) => Math.abs(x - m))
  return median(dev)
}

const trimmedMean = (arr: number[], trimRatio = 0.2) => {
  if (arr.length === 0) return 0
  const s = [...arr].sort((a, b) => a - b)
  const k = Math.floor(trimRatio * s.length)
  const trimmed = s.slice(k, s.length - k)
  const base = trimmed.length > 0 ? trimmed : s
  return base.reduce((a, b) => a + b, 0) / base.length
}

// ===========================
// Utilitaires format
// ===========================
const sideBadgeVariant = (side: string) => {
  if (side === "left") return "default"
  if (side === "right") return "secondary"
  if (side === "bottle") return "outline"
  return "secondary"
}
const formatTimeInterval = (minutes: number) => {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`
}

// Fonction pour formater les axes Y des graphiques d'intervalles
const formatYAxisInterval = (value: number) => {
  if (value < 60) return `${value}min`
  const hours = Math.floor(value / 60)
  const remainingMinutes = value % 60
  if (remainingMinutes === 0) return `${hours}h`
  return `${hours}h${remainingMinutes.toString().padStart(2, "0")}`
}

// Fonction pour calculer les graduations intermédiaires de l'axe Y
const getYAxisTicks = (dataMax: number) => {
  const ticks = [0]
  
  if (dataMax <= 60) {
    // Pour les intervalles courts (< 1h), graduations de 10min
    for (let i = 10; i <= dataMax; i += 10) {
      ticks.push(i)
    }
  } else if (dataMax <= 180) {
    // Pour les intervalles moyens (1-3h), graduations de 15min
    for (let i = 15; i <= dataMax; i += 15) {
      ticks.push(i)
    }
  } else {
    // Pour les intervalles longs (> 3h), graduations de 30min
    for (let i = 30; i <= dataMax; i += 30) {
      ticks.push(i)
    }
  }
  
  return ticks
}

// Fonction pour calculer le domaine Y du graphique Evolution avec marge intelligente
const getEvolutionYDomain = ([dataMin, dataMax]: [number, number]): [number, number] => {
  // Calculer l'échelle probable basée sur la valeur max
  let step = 1
  if (dataMax <= 10) step = 1
  else if (dataMax <= 20) step = 2
  else if (dataMax <= 50) step = 5
  else if (dataMax <= 100) step = 10
  else step = 20
  
  // Si l'échelle est de 4 en 4 ou 5 en 5, ajouter un échelon supplémentaire
  if (step === 4 || step === 5) {
    const nextTick = Math.ceil(dataMax / step) * step + step
    return [0, nextTick] as [number, number]
  }
  
  // Sinon, utiliser la marge standard de 10%
  return [0, Math.max(dataMax * 1.1, dataMax + 1)] as [number, number]
}

// Fonction pour générer les graduations X aux heures pleines
const getXAxisTicks = (data: any[]) => {
  if (data.length === 0) return []
  
  const startTime = Math.min(...data.map((d) => d.numericTime))
  const endTime = Math.max(...data.map((d) => d.numericTime))
  
  const ticks = []
  
  // Commencer à la première heure pleine après le début
  const startDate = new Date(startTime)
  const firstHour = new Date(startDate)
  firstHour.setMinutes(0, 0, 0)
  if (firstHour.getTime() < startTime) {
    firstHour.setHours(firstHour.getHours() + 1)
  }
  
  // Ajouter des ticks toutes les heures jusqu'à la fin
  for (let time = firstHour.getTime(); time <= endTime; time += 60 * 60 * 1000) {
    ticks.push(time)
  }
  
  // Limiter le nombre de ticks pour éviter l'encombrement
  if (ticks.length > 12) {
    // Prendre une graduation sur deux
    return ticks.filter((_, index) => index % 2 === 0)
  }
  
  return ticks
}
const formatDate = (d: Date, opts: Intl.DateTimeFormatOptions = {}) => d.toLocaleDateString("en-US", opts)
const formatTime = (d: Date, opts: Intl.DateTimeFormatOptions = {}) => d.toLocaleTimeString("en-US", opts)
const calculateInterval = (current: Date, previous: Date) =>
  Math.round((current.getTime() - previous.getTime()) / (1000 * 60))

const getCurrentTimeSlot = (hour: number) => {
  if (hour >= 7 && hour < 9) return "7-9"
  if (hour >= 9 && hour < 12) return "9-12"
  if (hour >= 12 && hour < 15) return "12-15"
  if (hour >= 15 && hour < 18) return "15-18"
  if (hour >= 18 && hour < 21) return "18-21"
  if (hour >= 21 || hour < 7) return "21-7"
  return "7-9"
}
// const isWeekend = (date: Date) => [0, 6].includes(date.getDay())

// Note: Ces fonctions ont été déplacées plus bas dans le code pour utiliser les données utilisateur

// ===========================
// Fonction pour adapter les paramètres selon l'âge et les données
// ===========================
const getAdaptiveParams = (totalLogsCount: number, ageWeeks: number) => {
  // CLAMP_MAX évolutif selon l'âge
  let clampMax: number
  if (ageWeeks >= 24) clampMax = 300  // 5h après 6 mois
  else if (ageWeeks >= 12) clampMax = 240  // 4h après 3 mois
  else if (ageWeeks >= 4) clampMax = 180  // 3h après 1 mois
  else clampMax = 150  // 2h30 pour nouveau-nés

  // MIN_SAMPLES adaptatif selon les données disponibles
  let minSamplesSlot: number
  if (totalLogsCount < 30) minSamplesSlot = 2
  else if (totalLogsCount < 100) minSamplesSlot = 3
  else minSamplesSlot = 4

  // Fenêtre temporelle adaptative selon l'âge et les données
  const timeWindow = ageWeeks < 4 ? 48 : 
                     totalLogsCount < 100 ? 72 : 
                     96

  return { clampMax, minSamplesSlot, timeWindow }
}

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

  // Calculate baby age in weeks
  const calculateBabyAgeWeeks = () => {
    const user = getCurrentUserInfo()
    if (!user || !user.babyBirthDate) return 0
    
    const birthDate = new Date(user.babyBirthDate)
    const today = new Date()
    const diffTime = Math.abs(today.getTime() - birthDate.getTime())
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7))
    
    return diffWeeks
  }

  // Format baby age with detailed weeks/months display (compatible with existing UI)
  const formatBabyAge = () => {
    const birthDate = getBabyBirthDate()
    if (!birthDate) return "Age undefined"
    
    const now = new Date()
    const diffMs = now.getTime() - birthDate.getTime()

    if (diffMs < 0) {
      const diffDays = Math.ceil(-diffMs / (1000 * 60 * 60 * 24))
      return `Born ${diffDays} day${diffDays > 1 ? "s" : ""} ago`
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      const remainingDays = diffDays % 7
      if (remainingDays === 0) {
        return `${weeks} semaine${weeks > 1 ? "s" : ""}`
      } else {
        return `${weeks} week${weeks > 1 ? "s" : ""} ${remainingDays} day${remainingDays > 1 ? "s" : ""}`
      }
    }

    // Calcul en mois et semaines
    const months = Math.floor(diffDays / 30.44)
    const remainingDaysAfterMonths = diffDays % 30.44
    const weeksAfterMonths = Math.floor(remainingDaysAfterMonths / 7)

    const remainingDaysAfterWeeks = Math.floor(remainingDaysAfterMonths % 7)
    
    if (weeksAfterMonths === 0 && remainingDaysAfterWeeks === 0) {
      return `${months} month${months > 1 ? "s" : ""}`
    } else if (remainingDaysAfterWeeks === 0) {
      return `${months} month${months > 1 ? "s" : ""} ${weeksAfterMonths} week${weeksAfterMonths > 1 ? "s" : ""}`
    } else {
      return `${months} month${months > 1 ? "s" : ""} ${weeksAfterMonths} week${weeksAfterMonths > 1 ? "s" : ""} ${remainingDaysAfterWeeks} day${remainingDaysAfterWeeks > 1 ? "s" : ""}`
    }
  }

  // Détection automatique jour/nuit avec paramètre d'URL
  const isNightTime = () => {
    const hour = new Date().getHours()
    return hour >= 22 || hour < 7
  }
  
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
    
    const { orderBy = "timestamp", ascending = false, limit, startDate, endDate } = options
    let query = supabase.from("food_logs").select("*").eq("user_id", userIdToUse)
    if (startDate) query = query.gte("timestamp", startDate.toISOString())
    if (endDate) query = query.lt("timestamp", endDate.toISOString())
    query = query.order(orderBy, { ascending })
    if (limit) query = query.limit(limit)
    const { data, error } = await query
    
    if (error) handleSupabaseError(error, "data retrieval")
    return data || []
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

  // Mémoisation du côté suggéré
  const suggestedSide = useMemo(() => {
    if (lastFeedingSide === "left") return "right"
    if (lastFeedingSide === "right") return "left"
    if (lastFeedingSide === "bottle") return "left" // Après un biberon, suggérer le sein gauche
    return "left"
  }, [lastFeedingSide])

  const fetchTotalLogsCount = async (userId?: string) => {
    const userIdToUse = getUserIdSafely(userId)
    if (!userIdToUse) {
      console.warn("currentUserId is not set, skipping fetchTotalLogsCount")
      return 0
    }
    
    try {
      const { count, error } = await supabase
        .from("food_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userIdToUse)
      if (error) handleSupabaseError(error, "total feeding count")
      return count || 0
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

      if (data.length > 0) {
        const lastFeeding = data[0] // Maintenant c'est vraiment la plus récente
        setLastFeedingSide(lastFeeding.side)
        setTimeSinceLast(calculateInterval(new Date(), new Date(lastFeeding.timestamp)))
      } else {
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
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const { count, error } = await supabase
        .from("food_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userIdToUse)
        .gte("timestamp", today.toISOString())
        .lt("timestamp", tomorrow.toISOString())
      if (error) handleSupabaseError(error, "feeding count")
      setTodayCount(count || 0)
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
        isNight: date.getHours() >= 22 || date.getHours() < 7,
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
        const isNight = hour >= 22 || hour < 7
        
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
        const isNight = d.getHours() >= 22 || d.getHours() < 7
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
        const isNight = newFeedingTime.getHours() >= 22 || newFeedingTime.getHours() < 7
        
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
          const minRecordThreshold = getMinRecordThreshold()
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
    const isNight = now.getHours() >= 22 || now.getHours() < 7
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
  
  // Mémoisation des prédictions intelligentes
  const smartAlertsCalculated = useMemo(() => {
    if (logs.length === 0) return null

    const last = logs[0]
    const lastTime = new Date(last.timestamp)
    const now = new Date()
    const timeSince = Math.floor((now.getTime() - lastTime.getTime()) / (1000 * 60))
    

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
      
      // Vérification des timestamps invalides (NÉCESSAIRE - protection contre corruption de données)
      if (isNaN(current.getTime()) || isNaN(prev.getTime())) {
        console.warn("Timestamp invalide détecté:", seq[i].timestamp, seq[i - 1].timestamp)
        continue
      }
      
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

    // Obtenir les paramètres adaptatifs
    const adaptiveParams = getAdaptiveParams(totalLogsCount, calculateBabyAgeWeeks())
    
    // Utiliser la fenêtre temporelle adaptative
    // La fenêtre temporelle est maintenant gérée par adaptiveParams.timeWindow
    
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
    
    // Mode "données insuffisantes" si moins de 10 intervalles au total
    if (intervalsAll.length < 10) {
      expectedInterval = isNightNow ? 150 : 100 // Valeurs par défaut universelles
      reliabilityIndex = 10 // Très faible
    } else if (chosenIntervals.length > 0) {
      expectedInterval = trimmedMean(chosenIntervals, PREDICTION.OUTLIER_TRIM_RATIO)
      expectedInterval = clamp(Math.round(expectedInterval), PREDICTION.CLAMP_MIN, adaptiveParams.clampMax)
    } else {
      expectedInterval = isNightNow ? ageDefaults.night : ageDefaults.day
    }
    
    // Détecter et gérer le cluster feeding
    const isClusterTime = curHour >= 17 && curHour <= 21
    const eveningAvg = intervalsBySlot["18-21"].length > 5 ? 
                       median(intervalsBySlot["18-21"]) : null
    
    if (isClusterTime && eveningAvg && eveningAvg < expectedInterval * 0.7) {
      expectedInterval = eveningAvg
    }
    
    // Ancienne logique simplifiée comme fallback
    const recentFeedingsCount = logs.filter(l => {
      const feedingTime = new Date(l.timestamp)
      const hoursSince = (now.getTime() - feedingTime.getTime()) / (1000 * 60 * 60)
      return hoursSince <= 3 // Dernières 3 heures
    }).length
    
    const isActiveClusterFeeding = isClusterTime && recentFeedingsCount >= 3

    // Vérification de cohérence (optionnel - log pour debugging)
    if (expectedInterval <= 0) {
      console.warn("Intervalle attendu invalide, utilisation des valeurs par défaut")
      expectedInterval = isNightNow ? ageDefaults.night : ageDefaults.day
    }

    const sigmaRobust = mad(chosenIntervals) * PROB_WINDOW.MAD_SCALE
    const floorByRatio = expectedInterval * PROB_WINDOW.FLOOR_RATIO
    let windowWidth = Math.max(sigmaRobust, floorByRatio, PROB_WINDOW.MIN)
    windowWidth = clamp(windowWidth, PROB_WINDOW.MIN, PROB_WINDOW.MAX)

    // Amélioration : fenêtre plus large pour les données variables
    if (chosenIntervals.length > 0) {
      const variance =
        chosenIntervals.reduce((sum, val) => sum + Math.pow(val - expectedInterval, 2), 0) / chosenIntervals.length
      const coefficientOfVariation = Math.sqrt(variance) / expectedInterval
      
      // Progression plus douce de la fenêtre selon la variabilité
      windowWidth = windowWidth * (1 + coefficientOfVariation * 0.5)
      windowWidth = clamp(windowWidth, PROB_WINDOW.MIN, PROB_WINDOW.MAX)
    }

    const nextFeedingPrediction = Math.max(0, expectedInterval - timeSince)
    
    // Calculer les bornes de la fenêtre de prédiction
    const windowStart = expectedInterval - windowWidth / 2
    const windowEnd = expectedInterval + windowWidth / 2
    
    // Vérifier si on est réellement dans la fenêtre temporelle
    // Rouge si derrière la fenêtre (il faut téter maintenant)
    // Vert si dans la fenêtre ou fenêtre dépassée (pas urgent)
    const likely = timeSince >= windowStart && timeSince <= windowEnd

    // Calcul de l'indice de fiabilité (seulement si pas déjà défini)
    if (reliabilityIndex === 0 && chosenIntervals.length > 0) {
      // Facteur 1: Nombre d'échantillons (max 40%)
      const sampleFactor = Math.min(chosenIntervals.length / 10, 1) * 0.4

      // Facteur 2: Régularité des données (max 40%)
      const variance =
        chosenIntervals.reduce((sum, val) => sum + Math.pow(val - expectedInterval, 2), 0) / chosenIntervals.length
      const coefficientOfVariation = Math.sqrt(variance) / expectedInterval
      const regularityFactor = Math.max(0, 1 - coefficientOfVariation) * 0.4

      // Facteur 3: Récence des données (max 20%)
      const recencyFactor = inWindow.length >= seq.length * 0.7 ? 0.2 : 0.1

      reliabilityIndex = Math.min(sampleFactor + regularityFactor + recencyFactor, 1)
    }

    return {
      nextFeedingPrediction,
      sideRecommendation: null,
      probWindowMinutes: Math.round(windowWidth * 10) / 10,
      expectedIntervalMinutes: Math.round(expectedInterval * 10) / 10,
      isLikelyWindow: likely,
      reliabilityIndex: Math.round(reliabilityIndex * 100), // Pourcentage
      isClusterFeeding: isActiveClusterFeeding
    }
  }, [logs, timeSinceLastCalculated])

  // Couleur du point mémorisée pour éviter les re-rendus inutiles
  const predictionPointColor = useMemo(() => {
    if (timeSinceLast === null || expectedIntervalMinutes === null || probWindowMinutes === null) return "#ef4444"
    // Utiliser la même logique que isLikelyWindow pour la cohérence
    const windowStart = expectedIntervalMinutes - probWindowMinutes / 2
    const windowEnd = expectedIntervalMinutes + probWindowMinutes / 2
    const inWindow = timeSinceLast >= windowStart && timeSinceLast <= windowEnd
    return inWindow ? "#3b82f6" : "#ef4444"
  }, [timeSinceLast, expectedIntervalMinutes, probWindowMinutes])

  // Position du point stabilisée pour éviter le scintillement
  const stablePointPosition = useMemo(() => {
    if (timeSinceLast === null) return 0
    // Arrondir à la minute pour éviter les micro-mouvements
    return Math.round(timeSinceLast)
  }, [timeSinceLast])

  // Légende mémorisée pour éviter les re-rendus
  const predictionLegend = useMemo(() => {
    if (!logs.length || !expectedIntervalMinutes || !probWindowMinutes) return { start: "", end: "" }
    
    const lastFeedingTime = new Date(logs[0].timestamp)
    const startTime = new Date(
      lastFeedingTime.getTime() + (expectedIntervalMinutes - probWindowMinutes / 2) * 60 * 1000,
    )
    const endTime = new Date(lastFeedingTime.getTime() + (expectedIntervalMinutes + probWindowMinutes / 2) * 60 * 1000)
    
    return {
      start: startTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      end: endTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    }
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
      
      const { error } = await supabase.from("food_logs").insert([{ side, timestamp: feedingTimestamp, user_id: userIdToUse }])
      if (error) {
        console.error("❌ ERREUR INSERT:", error)
        handleSupabaseError(error, "saving")
        return
      }
      
      console.log("✅ TÉTÉE INSÉRÉE AVEC SUCCÈS")
      setSuccess("Feeding saved!")
      
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
    setEditingTime(d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }))
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
      const { error } = await supabase.from("food_logs").update({ timestamp: combined.toISOString() }).eq("id", id).eq("user_id", currentUserId)
      if (error) handleSupabaseError(error, "modification")
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
      const { error } = await supabase.from("food_logs").delete().eq("id", id).eq("user_id", currentUserId)
      if (error) handleSupabaseError(error, "la suppression")
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
  const getMinRecordThreshold = useCallback(() => {
    const babyAge = calculateBabyAgeWeeks()
    if (babyAge < 4) return 30 // Nouveau-né
    if (babyAge < 12) return 45 // Petit bébé
    return 60 // Bébé plus âgé
  }, [])

  // Fonction helper pour valider la cohérence des records
  // Mémoisation du côté suggéré (déjà optimisé plus haut)
  // const suggestedSide = useMemo(() => { ... }, [lastFeedingSide])

  // Mémoisation des indicateurs de records
  const getRecordIndicator = useCallback(
    (log: FoodLogWithInterval) => {
    if (!log.intervalMinutes || log.intervalMinutes <= 0) return null
    const d = new Date(log.timestamp)
    const isNight = d.getHours() >= 22 || d.getHours() < 7
    const relevant = isNight ? records.night : records.day
    if (relevant.length === 0) return null
    const recordIndex = relevant.findIndex(
      (r: ProcessedIntervalData) => r.timestamp === log.timestamp && r.interval === log.intervalMinutes,
    )
    if (recordIndex === -1) return null
    const timeEmoji = isNight ? "🌙" : "☀️"
    const rankEmoji = ["🥇", "🥈", "🥉"][recordIndex] || ""
    return timeEmoji + rankEmoji
    },
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
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Confirm deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this feeding? This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setDeleteConfirmId(null)} variant="outline">
              Cancel
            </Button>
            <Button
              onClick={() => deleteConfirmId && confirmDelete(deleteConfirmId)}
              variant="destructive"
              disabled={submitting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="relative">
          <div className="flex items-center justify-center">
            <h1 data-testid="page-title" className="text-3xl font-bold flex items-center gap-2">
              <img src="/logo_app.png" alt="Logo" className="h-8 w-8" />
              {t('pageTitle')}
            </h1>
          </div>
          <div className="absolute top-0 left-0">
            <Button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              variant="outline" 
              size="sm" 
              className="px-2 sm:px-3 bg-transparent"
              title={isDarkMode ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              {isDarkMode ? <Sun className="h-3 w-3 sm:h-4 sm:w-4" /> : <Moon className="h-3 w-3 sm:h-4 sm:w-4" />}
            </Button>
          </div>
          <div className="absolute top-0 right-0 flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">Connected: {currentUser}</span>
            <Button onClick={handleLogout} variant="outline" size="sm" className="px-2 sm:px-3 bg-transparent">
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
            isDarkMode 
              ? "bg-blue-900/20" 
              : "bg-blue-50/80"
          }`}>
            <span className="text-sm">👶</span>
            <span className={`text-xs font-medium ${
              isDarkMode ? "text-blue-400" : "text-blue-600"
            }`}>{formatBabyAge()}</span>
          </div>
        </div>
      </div>

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

      {/* Quick Add */}
      <Card className={isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <Plus className="h-5 w-5" />
            Add a feeding
          </CardTitle>
          <p className={`text-xs italic ${isDarkMode ? "text-gray-400" : "text-gray-400"}`}>
            The highlighted breast indicates the recommended side for balanced feeding
          </p>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 py-0">
          <div className="flex flex-row flex-nowrap gap-3 sm:gap-6 items-stretch">
            {/* Breast Toggle */}
            <div className={`${isDarkMode ? "bg-gray-700" : "bg-gray-100"} rounded-2xl px-3 py-4 sm:px-4 sm:py-5 flex flex-col items-center gap-2 sm:gap-3 basis-2/3 flex-[2] min-w-0`}>
              <div className="flex gap-4 sm:gap-5 relative">
                {/* Left Breast */}
                <div className="flex flex-col items-center gap-1">
                  <div className="relative">
                    {suggestedSide === "left" && (
                      <div className="absolute inset-0 rounded-full bg-pink-300/80 animate-ping" style={{ width: '45px', height: '45px', top: '5.5px', left: '5.5px' }}></div>
                    )}
                    <div 
                      onClick={() => !submitting && addLog("left")}
                      className={`rounded-full cursor-pointer transition-all duration-300 flex items-center justify-center text-base sm:text-lg font-semibold relative border-3 ${
                        suggestedSide === "left"
                          ? "bg-pink-500 text-white border-pink-500 shadow-lg shadow-pink-500/30"
                          : `${isDarkMode ? "bg-gray-800 border-pink-500/70 text-pink-500 hover:bg-gray-700" : "bg-white border-pink-500/70 text-pink-500"} hover:scale-105 hover:shadow-md`
                      } ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
                      style={{ width: '56px', height: '56px' }}
                    >
                    <div className="flex items-baseline gap-0.5 leading-none">
                      <span className={`text-xl sm:text-2xl font-semibold ${suggestedSide === "left" ? "text-white" : "text-gray-400"}`}>L</span>
                      <span className={`text-[9px] sm:text-[10px] font-medium opacity-90 ${suggestedSide === "left" ? "text-white" : "text-gray-400"}`} style={{ transform: 'translateY(0.5px)' }}>eft</span>
                    </div>
                    </div>
                  </div>
                </div>
                {/* Right Breast */}
                <div className="flex flex-col items-center gap-1">
                  <div className="relative">
                    {suggestedSide === "right" && (
                      <div className="absolute inset-0 rounded-full bg-purple-300/80 animate-ping" style={{ width: '45px', height: '45px', top: '5.5px', left: '5.5px' }}></div>
                    )}
                    <div 
                      onClick={() => !submitting && addLog("right")}
                      className={`rounded-full cursor-pointer transition-all duration-300 flex items-center justify-center text-base sm:text-lg font-semibold relative border-3 ${
                        suggestedSide === "right"
                          ? "bg-purple-500 text-white border-purple-500 shadow-lg shadow-purple-500/30"
                          : `${isDarkMode ? "bg-gray-800 border-purple-500/70 text-purple-500 hover:bg-gray-700" : "bg-white border-purple-500/70 text-purple-500"} hover:scale-105 hover:shadow-md`
                    } ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
                      style={{ width: '56px', height: '56px' }}
                    >
                    <div className="flex items-baseline gap-0.5 leading-none">
                      <span className={`text-xl sm:text-2xl font-semibold ${suggestedSide === "right" ? "text-white" : "text-gray-400"}`}>R</span>
                      <span className={`text-[9px] sm:text-[10px] font-medium opacity-90 ${suggestedSide === "right" ? "text-white" : "text-gray-400"}`} style={{ transform: 'translateY(0.5px)' }}>ight</span>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
              <span className={`text-xs sm:text-sm ${isDarkMode ? "text-gray-300" : "text-gray-500"}`}>Breast</span>
            </div>

            {/* Bottle Option */}
            <div 
              onClick={() => !submitting && addLog("bottle")}
              className={`${isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"} rounded-2xl px-3 py-4 sm:px-4 sm:py-5 cursor-pointer transition-all duration-300 flex flex-col items-center gap-2 hover:-translate-y-0.5 basis-1/3 flex-[1] min-w-0 ${
                submitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <div className={`${isDarkMode ? "bg-green-900" : "bg-green-100"} rounded-full flex items-center justify-center text-xl sm:text-2xl transition-all duration-300`} style={{ width: '44px', height: '44px' }}>
                🍼
              </div>
              <span className={`text-xs sm:text-sm ${isDarkMode ? "text-gray-300" : "text-gray-500"}`}>Bottle</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cartes Aujourd'hui + Smart */}
      {/* Unified Today & Predictions Block */}
      <div 
        id="todayCard"
        data-testid="today-block"
        className={`rounded-2xl overflow-hidden shadow-sm transition-all duration-300 ${
          wasInWindow 
            ? isDarkMode 
              ? "bg-green-900/20" 
              : "bg-green-50"
            : isDarkMode 
              ? "bg-red-900/20" 
              : "bg-red-50"
        }`}
      >
        {/* Today Section - Top */}
        <div className={`p-5 flex justify-between items-center ${
          wasInWindow 
            ? isDarkMode 
              ? "bg-green-900/20" 
              : "bg-green-50"
            : isDarkMode 
              ? "bg-red-900/20" 
              : "bg-red-50"
        }`}>
          <div className="flex items-center gap-4">
            <Calendar className="h-5 w-5" />
            <div className="flex flex-col gap-0.5">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Today</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{todayCount}</span>
                <span className="text-sm text-muted-foreground">feedings</span>
              </div>
            </div>
          </div>
          {timeSinceLast !== null && (
            <div className={`text-xs font-medium ${lastTextColor}`}>
              last {formatTimeSinceLast(timeSinceLast)} ago
            </div>
          )}
        </div>

        {/* Predictions Section - Bottom */}
        <div className={`p-5 border-t ${isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"}`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Predictions</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPredictionInfo(true)}
                className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                title="How are predictions calculated?"
              >
                <Info className="h-3 w-3" />
              </Button>
            </div>
            {reliabilityIndex !== null && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Reliability: {reliabilityIndex}%</span>
                <div className={`w-2 h-2 rounded-full ${
                  reliabilityIndex >= 80 ? "bg-green-500" : reliabilityIndex >= 60 ? "bg-yellow-500" : "bg-red-500"
                }`}></div>
              </div>
            )}
          </div>

          {totalLogsCount < 30 && (
            <div className="text-amber-600 text-xs mb-4">
              🔄 Learning mode - {30 - totalLogsCount} more feedings for reliable predictions
            </div>
          )}

          <div className="flex items-center gap-5 mb-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
              wasInWindow 
                ? "bg-blue-100" 
                : "bg-amber-100"
            }`}>
              {wasInWindow ? "🔔" : "⏰"}
            </div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-1">
                Next at {(() => {
                  const lastFeedingTime = logs.length > 0 ? new Date(logs[0].timestamp) : new Date()
                  const interval = expectedIntervalMinutes ?? 0
                  const probableTime = new Date(lastFeedingTime.getTime() + interval * 60 * 1000)
                  return probableTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                })()}
              </div>
              <div className={`text-2xl font-semibold mb-1 ${
                wasInWindow 
                  ? isDarkMode ? "text-green-400" : "text-green-600"
                  : isDarkMode ? "text-red-400" : "text-red-600"
              }`}>
                {smartAlerts.nextFeedingPrediction !== null
                  ? smartAlerts.nextFeedingPrediction <= 5
                    ? "Now!"
                    : `In ${formatTimeInterval(roundToStep(Math.round(smartAlerts.nextFeedingPrediction)))}`
                  : "Not enough data"}
              </div>
              {probWindowMinutes !== null && (
                <div className="text-xs text-muted-foreground">
                  Window ≈ {Math.round(probWindowMinutes)}min
                </div>
              )}
            </div>
          </div>

          {/* Cluster feeding alert */}
          {smartAlerts?.isClusterFeeding && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 border border-purple-200 mb-4">
              <span className="text-purple-600 text-sm font-medium">
                🍇 Cluster feeding period detected
              </span>
            </div>
          )}

          {/* Prediction window graph - only show when in window */}
          {smartAlerts.nextFeedingPrediction !== null &&
            probWindowMinutes !== null &&
            expectedIntervalMinutes !== null &&
            timeSinceLast !== null &&
            wasInWindow && (
              <div
                data-testid="prediction-window"
                className={`p-3 rounded-lg ${isDarkMode ? "bg-gray-700 border border-gray-600" : "bg-gray-50 border border-gray-200"}`}
              >
                {/* Graphique simple avec zones */}
                <div className="h-[80px] mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={[{ time: expectedIntervalMinutes - 60 }, { time: expectedIntervalMinutes + 60 }]} 
                      margin={{ top: 10, right: 15, left: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      
                      {/* Zone de fenêtre probable (bleu) - centrée sur la tétée probable */}
                      <ReferenceArea
                          x1={expectedIntervalMinutes - probWindowMinutes / 2}
                          x2={expectedIntervalMinutes + probWindowMinutes / 2}
                        fill={isDarkMode ? "#60a5fa" : "#3b82f6"}
                        fillOpacity={isDarkMode ? 0.4 : 0.3}
                      />
                      
                      {/* Point qui change de couleur selon la position */}
                      <Line
                        type="monotone"
                        data={[{ time: stablePointPosition, value: 0.5 }]}
                        dataKey="value"
                        stroke="none"
                        dot={{ 
                          fill: predictionPointColor, 
                          strokeWidth: 2, 
                            r: 6,
                        }}
                        
                      />
                      
                      <XAxis
                        type="number"
                        dataKey="time"
                        domain={[expectedIntervalMinutes - 60, expectedIntervalMinutes + 60]}
                        tickFormatter={xAxisTickFormatter}
                          tick={{ fontSize: 11, fill: isDarkMode ? "#e5e7eb" : "#374151" }}
                      />
                      <YAxis hide />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Légende de la fenêtre */}
                  <div className={`flex justify-between text-xs mt-2 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                    <span>Start : {predictionLegend.start}</span>
                    <span>End : {predictionLegend.end}</span>
                </div>
              </div>
            )}

          {/* Alerts and Records */}
          {calculateBabyAgeWeeks() < 4 && (timeSinceLast ?? 0) > 180 && (
            <Alert className="mt-4 border-red-500">
              <AlertDescription className="text-red-600 text-xs font-semibold">
                ⚠️ More than 3h since last feeding
              </AlertDescription>
            </Alert>
          )}
          {approachingRecord && (
            <div className="text-xs mt-4 font-medium space-y-1">
              {approachingRecord.beatenRecords.length > 0 && !approachingRecord.allRecordsBroken && (
                <p className="text-green-600">
                  🎉 Record{approachingRecord.beatenRecords.length > 1 ? "s" : ""}{" "}
                  {approachingRecord.beatenRecords.join(", ")} beaten
                  {approachingRecord.beatenRecords.length > 1 ? "s" : ""} !
                </p>
              )}
              {approachingRecord.allRecordsBroken ? (
                <p className="text-purple-600 animate-pulse">
                  👑 ABSOLUTE {approachingRecord.isNight ? "NIGHT" : "DAY"} RECORD IN PROGRESS !
                </p>
              ) : (
                approachingRecord.isApproaching && (
                  <p className="text-amber-600 animate-pulse">
                    🔥 Only {approachingRecord.timeRemaining}min left for {approachingRecord.nextRecordRank} record{" "}
                    {approachingRecord.isNight ? "night" : "day"} ! ({formatTimeInterval(approachingRecord.recordInterval)})
                  </p>
                )
              )}
            </div>
          )}
        </div>
      </div>

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
                                const startTime = Math.min(...intervalChartData24h.map((d) => d.numericTime ?? 0))
                                const endTime = Math.max(...intervalChartData24h.map((d) => d.numericTime ?? 0))
                                const zones = []
                                for (let time = startTime; time < endTime; time += 60 * 60 * 1000) {
                                  const currentDate = new Date(time)
                                  const nextTime = Math.min(time + 60 * 60 * 1000, endTime)
                                  const hour = currentDate.getHours()
                                  const isNight = hour >= 22 || hour < 7
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
                            const startTime = Math.min(...intervalChartData72h.map((d) => d.numericTime ?? 0))
                            const endTime = Math.max(...intervalChartData72h.map((d) => d.numericTime ?? 0))
                          const zones = []
                          
                          // Créer des zones d'1 heure entre le début et la fin
                          for (let time = startTime; time < endTime; time += 60 * 60 * 1000) {
                            const currentDate = new Date(time)
                            const nextTime = Math.min(time + 60 * 60 * 1000, endTime)
                            const hour = currentDate.getHours()
                            const isNight = hour >= 22 || hour < 7
                            
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
                                const startTime = Math.min(...intervalChartData7d.map((d) => d.numericTime ?? 0))
                                const endTime = Math.max(...intervalChartData7d.map((d) => d.numericTime ?? 0))
                                const zones = []
                                for (let time = startTime; time < endTime; time += 60 * 60 * 1000) {
                                  const currentDate = new Date(time)
                                  const nextTime = Math.min(time + 60 * 60 * 1000, endTime)
                                  const hour = currentDate.getHours()
                                  const isNight = hour >= 22 || hour < 7
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
      <Card className={`gap-2 ${isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Monthly records
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pt-1 pb-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Day Records */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">☀️</span>
                <span className="text-sm font-medium text-amber-600">Day</span>
              </div>
              <div className="space-y-2">
                {records.day.length > 0 ? (
                  records.day.map((r: any, i: number) => (
                    <div 
                      key={`day-${i}`} 
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        i === 0 
                          ? isDarkMode 
                            ? "bg-gradient-to-r from-yellow-500/10 to-yellow-500/5" 
                            : "bg-gradient-to-r from-yellow-100 to-yellow-50"
                          : isDarkMode 
                            ? "bg-gray-700/50 hover:bg-gray-700" 
                            : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg w-6 text-center">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-sm font-medium ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                            {r.date}
                          </span>
                          <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                            {r.time}
                          </span>
                        </div>
                      </div>
                      <span className={`text-base font-semibold ${isDarkMode ? "text-gray-100" : "text-gray-900"}`}>
                        {formatTimeInterval(r.interval)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"} text-center py-4`}>
                    No day records yet
                  </div>
                )}
              </div>
            </div>

            {/* Night Records */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">🌙</span>
                <span className="text-sm font-medium text-blue-600">Night</span>
              </div>
              <div className="space-y-2">
                {records.night.length > 0 ? (
                  records.night.map((r: any, i: number) => (
                    <div 
                      key={`night-${i}`} 
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        i === 0 
                          ? isDarkMode 
                            ? "bg-gradient-to-r from-yellow-500/10 to-yellow-500/5" 
                            : "bg-gradient-to-r from-yellow-100 to-yellow-50"
                          : isDarkMode 
                            ? "bg-gray-700/50 hover:bg-gray-700" 
                            : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg w-6 text-center">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-sm font-medium ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
                            {r.date}
                          </span>
                          <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                            {r.time}
                          </span>
                        </div>
                      </div>
                      <span className={`text-base font-semibold ${isDarkMode ? "text-gray-100" : "text-gray-900"}`}>
                        {formatTimeInterval(r.interval)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"} text-center py-4`}>
                    No night records yet
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table récentes */}
      <Card className={isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"}>
        <CardHeader className="pb-3">
          <CardTitle>Recent feedings (20)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Ago</TableHead>
                <TableHead>Gap</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsWithIntervals.map((log) => {
                // Déterminer si c'est une tétée de jour ou de nuit
                const feedingTime = new Date(log.timestamp)
                const hour = feedingTime.getHours()
                const isNightFeeding = hour >= 22 || hour < 7
                
                // Classes CSS pour le background jour/nuit
                const dayNightBg = isNightFeeding 
                  ? (isDarkMode ? "bg-blue-950/20" : "bg-blue-50/50")  // Nuit - bleu subtil
                  : (isDarkMode ? "bg-amber-950/20" : "bg-amber-50/50") // Jour - jaune subtil
                
                return (
                <TableRow key={log.id} className={`group hover:bg-muted/50 ${dayNightBg}`}>
                  <TableCell className="font-medium">
                    {editingId === log.id ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="date"
                            value={editingDate}
                            onChange={(e) => setEditingDate(e.target.value)}
                            className="w-36 h-8"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="time"
                            value={editingTime}
                            onChange={(e) => setEditingTime(e.target.value)}
                            className="w-24 h-8"
                          />
                        </div>
                        <div className="flex items-center gap-1 mt-2 sm:mt-0">
                          <Button
                            onClick={() => saveEdit(log.id)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600"
                            title="Save"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={cancelEditing}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{formatTimestamp(log.timestamp)}</span>
                        <Button
                          onClick={() => startEditing(log)}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-100 transition-opacity hover:bg-blue-50 hover:text-blue-600"
                          title="Edit date and time"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.side === "bottle" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                        {sideLabels[log.side]}
                      </span>
                    ) : (
                      <Badge variant={sideBadgeVariant(log.side)}>{sideLabels[log.side]}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatPreciseTimeSince(log.timestamp)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.intervalMinutes ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {formatTimeInterval(log.intervalMinutes)}
                        </Badge>
                        {(() => {
                          const ind = getRecordIndicator(log)
                          return ind ? (
                            <span
                              className="text-lg"
                              title={`${ind.includes("🌙") ? "Night" : "Day"} record of the month`}
                            >
                              {ind}
                            </span>
                          ) : null
                        })()}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId !== log.id && (
                      <Button
                        onClick={() => deleteLog(log.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600"
                        title="Delete this feeding"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                )
              })}
              {logsWithIntervals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No feedings recorded
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Popup d'information sur les prédictions */}
      <Dialog open={showPredictionInfo} onOpenChange={setShowPredictionInfo}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How is it calculated?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <strong>1. Analysis of your habits</strong>
              <br />
              The algorithm uses an adaptive window: {(() => {
                const adaptiveParams = getAdaptiveParams(totalLogsCount, calculateBabyAgeWeeks())
                return `${adaptiveParams.timeWindow}h for ${calculateBabyAgeWeeks()} week old babies`
              })()}. It prioritizes recent data first, then data from the same time slot, then day/night.
            </div>
            <div>
              <strong>2. Expected interval calculation</strong>
              <br />
              It uses an "intelligent" average that ignores extreme values to prevent a few
              atypical feedings from skewing the prediction. If fewer than 10 intervals available, uses universal default values.
            </div>
            <div>
              <strong>3. Adaptive probability window</strong>
              <br />
              The window adapts progressively according to the variability of your habits: the more regular the intervals, the more accurate the prediction.
            </div>
            <div>
              <strong>4. Reliability index</strong>
              <br />
              The reliability percentage combines 3 factors: number of feedings analyzed (40%), interval
              regularity (40%), and data recency (20%). Very low if fewer than 10 intervals.
            </div>
            <div>
              <strong>5. Intelligent cluster feeding detection</strong>
              <br />
              The algorithm analyzes evening intervals (6pm-9pm) and automatically detects cluster feeding periods, adjusting predictions accordingly.
            </div>
            <div>
              <strong>6. Dynamic parameter adaptation</strong>
              <br />
              Parameters adapt automatically: CLAMP_MAX according to age, MIN_SAMPLES according to data quantity, and time window according to age and history.
            </div>
            <div className="text-xs text-muted-foreground mt-4 p-3 bg-blue-50 rounded-lg">
              💡 <strong>Tip:</strong> The more regularly you use the app, the more reliability
              increases and predictions become accurate!
            </div>
            <div className="text-xs text-muted-foreground p-2 bg-gray-50 rounded-lg">
              <strong>Reliability thresholds:</strong> 🔴 &lt;45% (few data), 🟡 45-80% (average), 🟢 &gt;80% (reliable)
            </div>
            <div className="text-xs text-muted-foreground p-2 bg-green-50 rounded-lg">
              <strong>Current data:</strong> {totalLogsCount} total feedings in database (display limited to 20)
            </div>
            <div className="text-xs text-muted-foreground p-2 bg-blue-50 rounded-lg">
              <strong>Current adaptive parameters:</strong>
              <div className="mt-1 grid grid-cols-2 gap-1 text-xs">
                <div>• CLAMP_MAX: {getAdaptiveParams(totalLogsCount, calculateBabyAgeWeeks()).clampMax} min</div>
                <div>• MIN_SAMPLES: {getAdaptiveParams(totalLogsCount, calculateBabyAgeWeeks()).minSamplesSlot}</div>
                <div>• Window: {getAdaptiveParams(totalLogsCount, calculateBabyAgeWeeks()).timeWindow}h</div>
                <div>• Baby age: {calculateBabyAgeWeeks()} weeks</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}

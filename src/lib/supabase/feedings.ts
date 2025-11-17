import { getSupabaseClient } from "./client"
import { type FoodLog, type FoodLogWithInterval } from "../types"

type FetchOptions = {
  orderBy?: string
  ascending?: boolean
  limit?: number
  startDate?: Date
  endDate?: Date
}

export async function fetchLogsWithOptions(options: FetchOptions = {}, userId: string) {
  const supabase = getSupabaseClient()
  const { orderBy = "timestamp", ascending = false, limit, startDate, endDate } = options

  let query = supabase.from("food_logs").select("*").eq("user_id", userId)
  if (startDate) query = query.gte("timestamp", startDate.toISOString())
  if (endDate) query = query.lte("timestamp", endDate.toISOString())
  query = query.order(orderBy, { ascending })
  if (limit) query = query.limit(limit)
  const { data, error } = await query

  if (error) throw error
  return (data || []) as FoodLog[]
}

export async function fetchTotalLogsCount(userId: string) {
  const supabase = getSupabaseClient()
  const { count, error } = await supabase
    .from("food_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
  if (error) throw error
  return count || 0
}

export async function fetchTodayCount(userId: string) {
  const supabase = getSupabaseClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const { count, error } = await supabase
    .from("food_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("timestamp", today.toISOString())
    .lt("timestamp", tomorrow.toISOString())
  if (error) throw error
  return count || 0
}

export async function addLogEntry(params: { side: "left" | "right" | "bottle"; timestamp: string; userId: string }) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("food_logs").insert([
    { side: params.side, timestamp: params.timestamp, user_id: params.userId },
  ])
  if (error) throw error
}

export async function updateLogTimestamp(id: string, newTimestamp: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("food_logs").update({ timestamp: newTimestamp }).eq("id", id)
  if (error) throw error
}

export async function deleteLogEntry(id: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("food_logs").delete().eq("id", id)
  if (error) throw error
}



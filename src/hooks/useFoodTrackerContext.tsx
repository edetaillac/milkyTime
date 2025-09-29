"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useFoodTracker } from "./useFoodTracker"

const FoodTrackerContext = createContext<ReturnType<typeof useFoodTracker> | null>(null)

export function FoodTrackerProvider({ children }: { children: ReactNode }) {
  const value = useFoodTracker()
  return <FoodTrackerContext.Provider value={value}>{children}</FoodTrackerContext.Provider>
}

export function useFoodTrackerContext() {
  const context = useContext(FoodTrackerContext)
  if (!context) {
    throw new Error("useFoodTrackerContext must be used within a FoodTrackerProvider")
  }
  return context
}

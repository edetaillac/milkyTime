"use client"

import { useEffect, useState } from "react"

interface HydrationWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

// Wrapper ultra-simple pour éviter les erreurs d'hydratation
export function HydrationWrapper({ children, fallback }: HydrationWrapperProps) {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    // Marquer comme hydraté après le premier rendu côté client
    setIsHydrated(true)
  }, [])

  if (!isHydrated) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-muted border-t-foreground rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        </div>
      )
    )
  }

  return <>{children}</>
}

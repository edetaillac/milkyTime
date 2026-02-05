// ===========================
// Fonctions utilitaires pour les graphiques
// ===========================

/**
 * Calcule les graduations intermédiaires de l'axe Y selon la valeur max
 */
export const getYAxisTicks = (dataMax: number) => {
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

/**
 * Calcule le domaine Y du graphique Evolution avec marge intelligente
 */
export const getEvolutionYDomain = ([_dataMin, dataMax]: [number, number]): [number, number] => {
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

/**
 * Génère les graduations X aux heures pleines pour un graphique temporel
 */
export const getXAxisTicks = (data: Array<{ numericTime?: number }>) => {
  if (data.length === 0) return []

  const numericTimes = data
    .map((d) => d.numericTime)
    .filter((value): value is number => typeof value === "number")

  if (numericTimes.length === 0) return []

  const startTime = Math.min(...numericTimes)
  const endTime = Math.max(...numericTimes)
  
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

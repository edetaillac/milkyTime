export function calculateBabyAgeWeeksFromBirthDate(babyBirthDate: string | null | undefined): number {
  if (!babyBirthDate) return 0
  const birthDate = new Date(babyBirthDate)
  if (isNaN(birthDate.getTime())) return 0
  const today = new Date()
  const diffTime = Math.abs(today.getTime() - birthDate.getTime())
  const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7))
  return diffWeeks
}

export function formatBabyAgeFromBirthDate(babyBirthDate: string | null | undefined): string {
  if (!babyBirthDate) return "Age undefined"
  const birthDate = new Date(babyBirthDate)
  if (isNaN(birthDate.getTime())) return "Age undefined"
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
    if (remainingDays === 0) return `${weeks} semaine${weeks > 1 ? "s" : ""}`
    return `${weeks} week${weeks > 1 ? "s" : ""} ${remainingDays} day${remainingDays > 1 ? "s" : ""}`
  }
  // Use average month length (30.44 days) as précédemment pour conserver l'affichage détaillé
  const months = Math.floor(diffDays / 30.44)
  const remainingDaysAfterMonths = diffDays % 30.44
  const weeks = Math.floor(remainingDaysAfterMonths / 7)
  const days = Math.floor(remainingDaysAfterMonths % 7)
  const parts: string[] = []
  parts.push(`${months} month${months > 1 ? "s" : ""}`)
  if (weeks > 0) parts.push(`${weeks} week${weeks > 1 ? "s" : ""}`)
  if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`)
  return parts.join(" ")
}

export function getUserIdSafelyFromState(
  currentUserId: string | null | undefined,
  override?: string,
): string {
  if (override && override.length > 0) return override
  if (currentUserId && currentUserId.length > 0) return currentUserId
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('diaper-user-id')
    if (stored && stored.length > 0) return stored
  }
  return ''
}



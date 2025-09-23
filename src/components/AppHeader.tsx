import { Button } from "@/components/ui/button"
import { Sun, Moon, LogOut } from "lucide-react"

interface AppHeaderProps {
  isDarkMode: boolean
  onToggleDarkMode: () => void
  currentUser: string
  onLogout: () => void
  formatBabyAge: () => string
  title: string
}

export function AppHeader({ isDarkMode, onToggleDarkMode, currentUser, onLogout, formatBabyAge, title }: AppHeaderProps) {
  return (
    <div className="text-center space-y-2">
      <div className="relative">
        <div className="flex items-center justify-center">
          <h1 data-testid="page-title" className="text-3xl font-bold flex items-center gap-2">
            <img src="/logo_app.png" alt="Logo" className="h-8 w-8" />
            {title}
          </h1>
        </div>
        <div className="absolute top-0 left-0">
          <Button
            onClick={onToggleDarkMode}
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
          <Button onClick={onLogout} variant="outline" size="sm" className="px-2 sm:px-3 bg-transparent">
            <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-center">
        <div
          className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-full
            ${isDarkMode ? "bg-blue-900/20" : "bg-blue-50/80"}
          `}
        >
          <span className="text-sm">👶</span>
          <span className={`text-xs font-medium ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>{formatBabyAge()}</span>
        </div>
      </div>
    </div>
  )
}



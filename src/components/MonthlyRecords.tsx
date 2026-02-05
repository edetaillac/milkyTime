import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy } from "lucide-react"
import type { DayNightSchedule } from "../lib/scheduleConfig"

interface MonthlyRecordsProps {
  isDarkMode: boolean
  records: { day: Array<{ date: string; time: string; interval: number }>; night: Array<{ date: string; time: string; interval: number }> }
  formatTimeInterval: (minutes: number) => string
  currentSchedule: DayNightSchedule
}

export function MonthlyRecords({ isDarkMode, records, formatTimeInterval, currentSchedule }: MonthlyRecordsProps) {
  // Format schedule time for display
  const formatScheduleTime = (hour: number, minute: number) => {
    return `${hour}h${minute > 0 ? minute.toString().padStart(2, '0') : ''}`
  }

  const dayPeriod = `${formatScheduleTime(currentSchedule.dayStartHour, currentSchedule.dayStartMinute)}-${formatScheduleTime(currentSchedule.nightStartHour, currentSchedule.nightStartMinute)}`
  const nightPeriod = `${formatScheduleTime(currentSchedule.nightStartHour, currentSchedule.nightStartMinute)}-${formatScheduleTime(currentSchedule.dayStartHour, currentSchedule.dayStartMinute)}`

  return (
    <Card className={`gap-2 ${isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Monthly records
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pt-1 pb-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">☀️</span>
              <span className="text-sm font-medium text-amber-600">Day</span>
              <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>({dayPeriod})</span>
            </div>
            <div className="space-y-2">
              {records.day.length > 0 ? (
                records.day.map((r, i) => (
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
                      <span className="text-lg w-6 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-sm font-medium ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>{r.date}</span>
                        <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>{r.time}</span>
                      </div>
                    </div>
                    <span className={`text-base font-semibold ${isDarkMode ? "text-gray-100" : "text-gray-900"}`}>
                      {formatTimeInterval(r.interval)}
                    </span>
                  </div>
                ))
              ) : (
                <div className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"} text-center py-4`}>No day records yet</div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">🌙</span>
              <span className="text-sm font-medium text-blue-600">Night</span>
              <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>({nightPeriod})</span>
            </div>
            <div className="space-y-2">
              {records.night.length > 0 ? (
                records.night.map((r, i) => (
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
                      <span className="text-lg w-6 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-sm font-medium ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>{r.date}</span>
                        <span className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>{r.time}</span>
                      </div>
                    </div>
                    <span className={`text-base font-semibold ${isDarkMode ? "text-gray-100" : "text-gray-900"}`}>
                      {formatTimeInterval(r.interval)}
                    </span>
                  </div>
                ))
              ) : (
                <div className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"} text-center py-4`}>No night records yet</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}



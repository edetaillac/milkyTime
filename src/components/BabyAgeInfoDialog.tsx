"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { DayNightSchedule } from "../lib/scheduleConfig"

interface BabyAgeInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentSchedule: DayNightSchedule
  calculateBabyAgeWeeks: () => number
}

export function BabyAgeInfoDialog({ open, onOpenChange, currentSchedule, calculateBabyAgeWeeks }: BabyAgeInfoDialogProps) {
  const formatScheduleTime = (hour: number, minute: number) => {
    return `${hour}h${minute > 0 ? minute.toString().padStart(2, '0') : ''}`
  }

  const dayPeriod = `${formatScheduleTime(currentSchedule.dayStartHour, currentSchedule.dayStartMinute)}-${formatScheduleTime(currentSchedule.nightStartHour, currentSchedule.nightStartMinute)}`
  const nightPeriod = `${formatScheduleTime(currentSchedule.nightStartHour, currentSchedule.nightStartMinute)}-${formatScheduleTime(currentSchedule.dayStartHour, currentSchedule.dayStartMinute)}`

  const ageWeeks = calculateBabyAgeWeeks()
  const getCurrentCategory = () => {
    if (ageWeeks <= 12) return "0-3 months"
    if (ageWeeks <= 24) return "3-6 months"
    if (ageWeeks <= 52) return "6-12 months"
    return "12+ months"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Age-based schedule adjustments</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <strong>How it works</strong>
            <br />
            The app automatically adjusts day/night schedules based on your baby's age to match typical sleep patterns. This affects interval classification in statistics and predictions.
          </div>

          <div className="space-y-3">
            <strong>Age-based schedule periods:</strong>

            <div className={`p-3 rounded-lg ${ageWeeks <= 12 ? "bg-blue-100 border-2 border-blue-400" : "bg-gray-50"}`}>
              <div className="font-semibold flex items-center gap-2">
                👶 0-3 months (0-12 weeks)
                {ageWeeks <= 12 && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Current</span>}
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <div>☀️ Day: <strong>7h00 - 21h00</strong> (14 hours)</div>
                <div>🌙 Night: <strong>21h00 - 7h00</strong> (10 hours)</div>
                <div className="text-muted-foreground italic mt-1">Newborns often have later bedtimes</div>
              </div>
            </div>

            <div className={`p-3 rounded-lg ${ageWeeks > 12 && ageWeeks <= 24 ? "bg-blue-100 border-2 border-blue-400" : "bg-gray-50"}`}>
              <div className="font-semibold flex items-center gap-2">
                👶 3-6 months (13-24 weeks)
                {ageWeeks > 12 && ageWeeks <= 24 && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Current</span>}
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <div>☀️ Day: <strong>7h00 - 20h00</strong> (13 hours)</div>
                <div>🌙 Night: <strong>20h00 - 7h00</strong> (11 hours)</div>
                <div className="text-muted-foreground italic mt-1">Sleep consolidation begins, earlier bedtime</div>
              </div>
            </div>

            <div className={`p-3 rounded-lg ${ageWeeks > 24 && ageWeeks <= 52 ? "bg-blue-100 border-2 border-blue-400" : "bg-gray-50"}`}>
              <div className="font-semibold flex items-center gap-2">
                👶 6-12 months (25-52 weeks)
                {ageWeeks > 24 && ageWeeks <= 52 && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Current</span>}
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <div>☀️ Day: <strong>7h00 - 19h30</strong> (12h30)</div>
                <div>🌙 Night: <strong>19h30 - 7h00</strong> (11h30)</div>
                <div className="text-muted-foreground italic mt-1">More established sleep routine</div>
              </div>
            </div>

            <div className={`p-3 rounded-lg ${ageWeeks > 52 ? "bg-blue-100 border-2 border-blue-400" : "bg-gray-50"}`}>
              <div className="font-semibold flex items-center gap-2">
                👶 12+ months (53+ weeks)
                {ageWeeks > 52 && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Current</span>}
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <div>☀️ Day: <strong>7h00 - 19h00</strong> (12 hours)</div>
                <div>🌙 Night: <strong>19h00 - 7h00</strong> (12 hours)</div>
                <div className="text-muted-foreground italic mt-1">Consistent early bedtime routine</div>
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground mt-4 p-3 bg-blue-50 rounded-lg">
            <strong>💡 Current status:</strong>
            <div className="mt-2 space-y-1">
              <div>• Baby age: <strong>{ageWeeks} weeks</strong> ({getCurrentCategory()})</div>
              <div>• Day period: <strong>{dayPeriod}</strong></div>
              <div>• Night period: <strong>{nightPeriod}</strong></div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground p-3 bg-amber-50 rounded-lg">
            <strong>📊 What this affects:</strong>
            <div className="mt-1 space-y-1">
              <div>• Interval Statistics: classification of intervals as day or night</div>
              <div>• Predictions: separate prediction models for day vs night</div>
              <div>• Records: separate tracking of day and night records</div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground p-3 bg-green-50 rounded-lg">
            <strong>🔄 Automatic transitions:</strong>
            <br />
            Schedules update automatically when your baby reaches 3, 6, and 12 month milestones. Historical data is recategorized using the schedule that was active at that time.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

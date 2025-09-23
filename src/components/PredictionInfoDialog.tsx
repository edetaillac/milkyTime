"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getAdaptiveParams } from "../lib"

interface PredictionInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalLogsCount: number
  calculateBabyAgeWeeks: () => number
}

export function PredictionInfoDialog({ open, onOpenChange, totalLogsCount, calculateBabyAgeWeeks }: PredictionInfoDialogProps) {
  const adaptive = getAdaptiveParams(totalLogsCount, calculateBabyAgeWeeks())
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How is it calculated?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <strong>1. Analysis of your habits</strong>
            <br />
            The algorithm uses an adaptive window: {adaptive.timeWindow}h for {calculateBabyAgeWeeks()} week old babies. It prioritizes recent data first, then data from the same time slot, then day/night.
          </div>
          <div>
            <strong>2. Expected interval calculation</strong>
            <br />
            It uses an "intelligent" average that ignores extreme values to prevent a few atypical feedings from skewing the prediction. If fewer than 10 intervals available, uses universal default values.
          </div>
          <div>
            <strong>3. Adaptive probability window</strong>
            <br />
            The window adapts progressively according to the variability of your habits: the more regular the intervals, the more accurate the prediction.
          </div>
          <div>
            <strong>4. Reliability index</strong>
            <br />
            The reliability percentage combines 3 factors: number of feedings analyzed (40%), interval regularity (40%), and data recency (20%). Very low if fewer than 10 intervals.
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
            💡 <strong>Tip:</strong> The more regularly you use the app, the more reliability increases and predictions become accurate!
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
              <div>• CLAMP_MAX: {adaptive.clampMax} min</div>
              <div>• MIN_SAMPLES: {adaptive.minSamplesSlot}</div>
              <div>• Window: {adaptive.timeWindow}h</div>
              <div>• Baby age: {calculateBabyAgeWeeks()} weeks</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}



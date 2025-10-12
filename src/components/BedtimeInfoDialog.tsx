"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  BEDTIME_ANALYSIS_DAYS,
  BEDTIME_MIN_AGE_WEEKS,
  BEDTIME_MIN_GAP_MINUTES,
  BEDTIME_MIN_SAMPLE_SIZE,
  type BedtimePredictionResult,
} from "../lib"

interface BedtimeInfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bedtimePrediction: BedtimePredictionResult | null
  calculateBabyAgeWeeks: () => number
}

export function BedtimeInfoDialog({ open, onOpenChange, bedtimePrediction, calculateBabyAgeWeeks }: BedtimeInfoDialogProps) {
  const currentAgeWeeks = calculateBabyAgeWeeks()
  const sampleSize = bedtimePrediction?.sampleSize ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How is the bedtime window calculated?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <strong>1. Activation criteria</strong>
            <br />
            We only start predicting once baby is at least {BEDTIME_MIN_AGE_WEEKS} weeks old and we have {BEDTIME_MIN_SAMPLE_SIZE} nights with a stretch ≥ {Math.round(BEDTIME_MIN_GAP_MINUTES / 60)}h. Right now your baby is {currentAgeWeeks} weeks old and we have {sampleSize} qualified nights in the last {BEDTIME_ANALYSIS_DAYS} days.
          </div>
          <div>
            <strong>2. Detection of the "night" stretch</strong>
            <br />
            Each evening feeding is tagged with the time to the next feeding. If the next feeding is at least {Math.round(BEDTIME_MIN_GAP_MINUTES / 60)} hours away and either crosses midnight or happens after 5&nbsp;pm, we consider it a bedtime candidate.
          </div>
          <div>
            <strong>3. Rolling 30-day analysis</strong>
            <br />
            We work on a sliding {BEDTIME_ANALYSIS_DAYS}-day window to stay adaptive. Times are converted to your device timezone so the window reflects your local routine.
          </div>
          <div>
            <strong>4. Window & confidence</strong>
            <br />
            We look at the 50% central band (between the 25th and 75th percentile) of the bedtime candidates to define the suggested window. Reliability blends sample size and variability: more nights and tighter clustering increase confidence.
          </div>
          <div className="text-xs text-muted-foreground p-3 bg-blue-50 rounded-lg">
            💡 Tip: keep logging each evening feeding. Missing nights or travel days widen the window and lower confidence.
          </div>
          <div className="text-xs text-muted-foreground p-2 bg-gray-50 rounded-lg">
            • "Learning" means we still need a few more evenings.<br />
            • "Too young" waits until {BEDTIME_MIN_AGE_WEEKS} weeks.<br />
            • Once the indicator is green, the window updates automatically every time you add a feeding.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

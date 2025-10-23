"use client"

import { useCallback, useMemo, useState } from "react"
import { CirclePlus, Loader2, Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type BatchEntry = {
  id: string
  date: string
  time: string
}

const getTodayDate = () => new Date().toISOString().split("T")[0]

const generateEntryId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const getDefaultTimeForIndex = (index: number) => {
  const startMinutes = 10 * 60 // 10:00 so the first bottle happens after daycare drop-off
  const stepMinutes = 150 // 2h30 spacing between feedings
  const totalMinutes = startMinutes + index * stepMinutes
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

const createBatchEntry = (index: number, baseDate?: string): BatchEntry => ({
  id: generateEntryId(),
  date: baseDate ?? getTodayDate(),
  time: getDefaultTimeForIndex(index),
})

interface AddFeedingPanelProps {
  isDarkMode: boolean
  submitting: boolean
  suggestedSide: "left" | "right" | null
  onAddFeeding: (side: "left" | "right" | "bottle") => void
  onAddFeedingsBatch: (entries: Array<{ timestamp: string; side?: "left" | "right" | "bottle" }>) => void
}

export function AddFeedingPanel({
  isDarkMode,
  submitting,
  suggestedSide,
  onAddFeeding,
  onAddFeedingsBatch,
}: AddFeedingPanelProps) {
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false)
  const [batchCount, setBatchCount] = useState(1)
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>(() => [createBatchEntry(0)])
  const [formError, setFormError] = useState<string | null>(null)

  const resetBatchForm = useCallback(() => {
    const today = getTodayDate()
    setBatchCount(1)
    setBatchEntries([createBatchEntry(0, today)])
    setFormError(null)
  }, [])

  const handleOpenBatchDialog = useCallback(() => {
    resetBatchForm()
    setIsBatchDialogOpen(true)
  }, [resetBatchForm])

  const handleCountChange = useCallback((delta: number) => {
    setBatchCount((prev) => {
      const next = Math.max(1, prev + delta)
      setBatchEntries((entries) => {
        if (next > entries.length) {
          const baseDate = entries[0]?.date ?? getTodayDate()
          const updated = [...entries]
          for (let i = entries.length; i < next; i++) {
            updated.push(createBatchEntry(i, baseDate))
          }
          return updated
        }
        if (next < entries.length) {
          return entries.slice(0, next)
        }
        return entries
      })
      setFormError(null)
      return next
    })
  }, [])

  const handleEntryChange = useCallback(
    (index: number, field: "date" | "time", value: string) => {
      setBatchEntries((entries) => {
        const updated = [...entries]
        updated[index] = { ...updated[index], [field]: value }
        return updated
      })
      setFormError(null)
    },
    [],
  )

  const handleSubmitBatch = useCallback(async () => {
    const hasMissingValues = batchEntries.some((entry) => !entry.date || !entry.time)
    if (hasMissingValues) {
      setFormError("Fill date and time for each feeding")
      return
    }

    try {
      const payload = batchEntries.map((entry) => {
        const timestamp = new Date(`${entry.date}T${entry.time}`)
        if (Number.isNaN(timestamp.getTime())) {
          throw new Error("Invalid date or time")
        }
        return { side: "bottle" as const, timestamp: timestamp.toISOString() }
      })

      await Promise.resolve(onAddFeedingsBatch(payload))
      setIsBatchDialogOpen(false)
      resetBatchForm()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to save feedings"
      setFormError(message)
    }
  }, [batchEntries, onAddFeedingsBatch, resetBatchForm])

  const disableSubmit = useMemo(
    () => submitting || batchEntries.some((entry) => !entry.date || !entry.time),
    [batchEntries, submitting],
  )

  return (
    <>
      <Dialog
        open={isBatchDialogOpen}
        onOpenChange={(open) => {
          setIsBatchDialogOpen(open)
          if (!open) {
            resetBatchForm()
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add feedings in batch</DialogTitle>
            <DialogDescription>Example: feedings logged by daycare</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div
              className={`${
                isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
              } flex items-center justify-between rounded-lg border px-4 py-3`}
            >
              <div className="text-sm font-medium">How many feedings today?</div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCountChange(-1)}
                  disabled={batchCount <= 1 || submitting}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center text-lg font-semibold">{batchCount}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCountChange(1)}
                  disabled={submitting}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {batchEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`${
                    isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
                  } rounded-lg border px-4 py-3`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {index + 1}
                        <span className="sr-only">Feeding {index + 1}</span>
                      </span>
                    </div>
                    <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                      <Input
                        type="date"
                        value={entry.date}
                        onChange={(event) => handleEntryChange(index, "date", event.target.value)}
                        max="9999-12-31"
                        className="w-auto min-w-[135px] flex-1"
                      />
                      <Input
                        type="time"
                        value={entry.time}
                        onChange={(event) => handleEntryChange(index, "time", event.target.value)}
                        step={300}
                        className="w-auto min-w-[110px] flex-none"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Saved as a bottle feeding — edit later if you need.
                  </p>
                </div>
              ))}
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsBatchDialogOpen(false)
                resetBatchForm()
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmitBatch} disabled={disableSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save feedings"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card
        className={`${
          isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"
        } relative`}
      >
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleOpenBatchDialog}
          className="absolute right-6 top-6 z-10 gap-2 whitespace-nowrap px-3 sm:px-4"
          disabled={submitting}
        >
          <CirclePlus className="h-4 w-4" />
          <span className="hidden sm:inline">Add batch</span>
          <span className="sm:hidden">Batch</span>
        </Button>
        <CardHeader className="pb-2 pr-24">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <Plus className="h-5 w-5" />
            Add a feeding
          </CardTitle>
          <p className={`text-xs italic ${isDarkMode ? "text-gray-400" : "text-gray-400"}`}>
            The highlighted breast indicates the recommended side for balanced feeding
          </p>
        </CardHeader>
      <CardContent className="px-4 sm:px-6 py-0">
        <div className="flex flex-row flex-nowrap gap-3 sm:gap-6 items-stretch">
          {/* Breast Toggle */}
          <div className={`${isDarkMode ? "bg-gray-700" : "bg-gray-100"} rounded-2xl px-3 py-4 sm:px-4 sm:py-5 flex flex-col items-center gap-2 sm:gap-3 basis-2/3 flex-[2] min-w-0`}>
            <div className="flex gap-4 sm:gap-5 relative">
              {/* Left Breast */}
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  {suggestedSide === "left" && (
                    <div className="absolute inset-0 rounded-full bg-pink-300/80 animate-ping" style={{ width: '45px', height: '45px', top: '5.5px', left: '5.5px' }}></div>
                  )}
                  <div 
                    onClick={() => !submitting && onAddFeeding("left")}
                    className={`rounded-full cursor-pointer transition-all duration-300 flex items-center justify-center text-base sm:text-lg font-semibold relative border-3 ${
                      suggestedSide === "left"
                        ? "bg-pink-500 text-white border-pink-500 shadow-lg shadow-pink-500/30"
                        : `${isDarkMode ? "bg-gray-800 border-pink-500/70 text-pink-500 hover:bg-gray-700" : "bg-white border-pink-500/70 text-pink-500"} hover:scale-105 hover:shadow-md`
                    } ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
                    style={{ width: '56px', height: '56px' }}
                  >
                    <div className="flex items-baseline gap-0.5 leading-none">
                      <span className={`text-xl sm:text-2xl font-semibold ${suggestedSide === "left" ? "text-white" : "text-gray-400"}`}>L</span>
                      <span className={`text-[9px] sm:text-[10px] font-medium opacity-90 ${suggestedSide === "left" ? "text-white" : "text-gray-400"}`} style={{ transform: 'translateY(0.5px)' }}>eft</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Right Breast */}
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  {suggestedSide === "right" && (
                    <div className="absolute inset-0 rounded-full bg-purple-300/80 animate-ping" style={{ width: '45px', height: '45px', top: '5.5px', left: '5.5px' }}></div>
                  )}
                  <div 
                    onClick={() => !submitting && onAddFeeding("right")}
                    className={`rounded-full cursor-pointer transition-all duration-300 flex items-center justify-center text-base sm:text-lg font-semibold relative border-3 ${
                      suggestedSide === "right"
                        ? "bg-purple-500 text-white border-purple-500 shadow-lg shadow-purple-500/30"
                        : `${isDarkMode ? "bg-gray-800 border-purple-500/70 text-purple-500 hover:bg-gray-700" : "bg-white border-purple-500/70 text-purple-500"} hover:scale-105 hover:shadow-md`
                    } ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
                    style={{ width: '56px', height: '56px' }}
                  >
                    <div className="flex items-baseline gap-0.5 leading-none">
                      <span className={`text-xl sm:text-2xl font-semibold ${suggestedSide === "right" ? "text-white" : "text-gray-400"}`}>R</span>
                      <span className={`text-[9px] sm:text-[10px] font-medium opacity-90 ${suggestedSide === "right" ? "text-white" : "text-gray-400"}`} style={{ transform: 'translateY(0.5px)' }}>ight</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <span className={`text-xs sm:text-sm ${isDarkMode ? "text-gray-300" : "text-gray-500"}`}>Breast</span>
          </div>

          {/* Bottle Option */}
          <div 
            onClick={() => !submitting && onAddFeeding("bottle")}
            className={`${isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"} rounded-2xl px-3 py-4 sm:px-4 sm:py-5 cursor-pointer transition-all duration-300 flex flex-col items-center gap-2 hover:-translate-y-0.5 basis-1/3 flex-[1] min-w-0 ${
              submitting ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <div className={`${isDarkMode ? "bg-green-900" : "bg-green-100"} rounded-full flex items-center justify-center text-xl sm:text-2xl transition-all duration-300`} style={{ width: '44px', height: '44px' }}>
              🍼
            </div>
            <span className={`text-xs sm:text-sm ${isDarkMode ? "text-gray-300" : "text-gray-500"}`}>Bottle</span>
          </div>
        </div>
      </CardContent>
      </Card>
    </>
  )
}

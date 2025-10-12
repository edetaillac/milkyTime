import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info, Calendar, MoonStar } from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceArea,
} from "recharts"
import React, { useEffect, useState } from "react"
import { useFoodTrackerContext } from "../hooks/useFoodTrackerContext"
import { roundToStep, formatTimeInterval } from "../lib"

export function TodayAndSmartCards() {
  const {
    isDarkMode,
    wasInWindow,
    todayCount,
    timeSinceLast,
    lastTextColor,
    formatTimeSinceLast: formatTimeSinceLastRaw,
    reliabilityIndex,
    setShowPredictionInfo,
    setShowBedtimeInfo,
    totalLogsCount,
    expectedIntervalMinutes,
    probWindowMinutes,
    logs,
    smartAlerts,
    predictionPointColor,
    stablePointPosition,
    predictionLegend,
    calculateBabyAgeWeeks,
    approachingRecord,
    bedtimePrediction,
  } = useFoodTrackerContext()

  const formatTimeSinceLast = (mins: number) => formatTimeSinceLastRaw(mins) ?? ""

  const lastFeedingTime = logs.length > 0 ? new Date(logs[0].timestamp) : new Date()

  const xAxisTickFormatter = (value: number) => {
    const hours = Math.floor(value / 60)
    const minutes = value % 60
    return `${hours}h${minutes.toString().padStart(2, "0")}`
  }

  const formatWindowMinutes = (value: number) => {
    const hours = Math.floor(value / 60)
    const minutes = value % 60
    return `${hours.toString().padStart(2, "0")}h${minutes.toString().padStart(2, "0")}`
  }

  const computeIsEvening = () => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes() >= 18 * 60
  }

  const [isEvening, setIsEvening] = useState(() => computeIsEvening())

  useEffect(() => {
    if (typeof window === "undefined") return
    const interval = window.setInterval(() => {
      setIsEvening(computeIsEvening())
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const renderBedtimeSummary = () => {
    if (!bedtimePrediction) {
      return <div className="text-xs text-muted-foreground">Collecting data…</div>
    }

    if (bedtimePrediction.status !== "ready") {
      const remainingLabel = bedtimePrediction.nightsRemaining > 0
        ? `${bedtimePrediction.nightsRemaining} more night${bedtimePrediction.nightsRemaining > 1 ? "s" : ""}`
        : "More data required"
      const message =
        bedtimePrediction.status === "too-young"
          ? "Baby is still too young for a reliable bedtime pattern"
          : bedtimePrediction.status === "learning"
            ? `Model learning (${remainingLabel})`
            : "Need additional evenings to analyze"

      return (
        <Alert className={`border border-dashed ${isDarkMode ? "bg-[#2d2d2d] border-gray-700" : "bg-slate-50 border-slate-200"}`}>
          <AlertDescription className="text-xs text-muted-foreground">
            {message}
          </AlertDescription>
        </Alert>
      )
    }

    const { windowStartMinutes, windowEndMinutes } = bedtimePrediction
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const chartStart = Math.max(0, Math.min(windowStartMinutes, currentMinutes) - 60)
    const chartEnd = Math.min(24 * 60, Math.max(windowEndMinutes, currentMinutes) + 60)
    const showPoint = currentMinutes >= chartStart && currentMinutes <= chartEnd

    return (
      <>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${isDarkMode ? "bg-indigo-900/40" : "bg-indigo-100"}`}>
            <MoonStar className={`h-6 w-6 ${isDarkMode ? "text-indigo-200" : "text-indigo-600"}`} />
          </div>
          <div className="flex-1 text-xl font-semibold">
            {formatWindowMinutes(windowStartMinutes)} – {formatWindowMinutes(windowEndMinutes)}
          </div>
        </div>
        <div className="h-[80px] mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[{ time: chartStart }, { time: chartEnd }]} margin={{ top: 10, right: 15, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <ReferenceArea
                x1={windowStartMinutes}
                x2={windowEndMinutes}
                fill={isDarkMode ? "#6366f1" : "#4338ca"}
                fillOpacity={isDarkMode ? 0.35 : 0.25}
              />
              {showPoint && (
                <Line
                  type="monotone"
                  data={[{ time: currentMinutes, value: 0.5 }]}
                  dataKey="value"
                  stroke="none"
                  dot={{ fill: isDarkMode ? "#c7d2fe" : "#4338ca", strokeWidth: 0, r: 6 }}
                />
              )}
              <XAxis
                type="number"
                dataKey="time"
                domain={[chartStart, chartEnd]}
                tickFormatter={formatWindowMinutes}
                tick={{ fontSize: 11, fill: isDarkMode ? "#e5e7eb" : "#374151" }}
              />
              <YAxis hide />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </>
    )
  }

  return (
    <div
      id="todayCard"
      data-testid="today-block"
      className={`rounded-2xl overflow-hidden shadow-sm transition-all duration-300 ${
        wasInWindow ? (isDarkMode ? "bg-green-900/20" : "bg-green-50") : (isDarkMode ? "bg-red-900/20" : "bg-red-50")
      }`}
    >
      {/* Today Section - Top */}
      <div
        className={`p-5 flex justify-between items-center ${
          wasInWindow ? (isDarkMode ? "bg-green-900/20" : "bg-green-50") : (isDarkMode ? "bg-red-900/20" : "bg-red-50")
        }`}
      >
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5" />
          <div className="flex flex-col gap-0.5">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Today</div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{todayCount}</span>
              <span className="text-sm text-muted-foreground">feedings</span>
            </div>
          </div>
        </div>
        {timeSinceLast !== null && (
          <div className={`text-xs font-medium ${lastTextColor}`}>last {formatTimeSinceLast(timeSinceLast)} ago</div>
        )}
      </div>

      {/* Predictions Section - Bottom */}
      <div className={`p-5 border-t ${isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"}`}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Predictions</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPredictionInfo(true)}
              className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
              title="How are predictions calculated?"
            >
              <Info className="h-3 w-3" />
            </Button>
          </div>
          {reliabilityIndex !== null && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Reliability: {reliabilityIndex}%</span>
              <div
                className={`w-2 h-2 rounded-full ${
                  reliabilityIndex >= 80 ? "bg-green-500" : reliabilityIndex >= 60 ? "bg-yellow-500" : "bg-red-500"
                }`}
              ></div>
            </div>
          )}
        </div>

        {totalLogsCount < 30 && (
          <div className="text-amber-600 text-xs mb-4">
            🔄 Learning mode - {30 - totalLogsCount} more feedings for reliable predictions
          </div>
        )}

        <div className="flex items-center gap-5 mb-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${wasInWindow ? "bg-blue-100" : "bg-amber-100"}`}>
            {wasInWindow ? "🔔" : "⏰"}
          </div>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-1">
              Next at {(() => {
                const interval = expectedIntervalMinutes ?? 0
                const probableTime = new Date(lastFeedingTime.getTime() + interval * 60 * 1000)
                return probableTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
              })()}
            </div>
            <div
              className={`text-2xl font-semibold mb-1 ${
                wasInWindow ? (isDarkMode ? "text-green-400" : "text-green-600") : (isDarkMode ? "text-red-400" : "text-red-600")
              }`}
            >
              {smartAlerts.nextFeedingPrediction !== null
                ? smartAlerts.nextFeedingPrediction <= 5
                  ? "Now!"
                  : `In ${formatTimeInterval(roundToStep(Math.round(smartAlerts.nextFeedingPrediction)))}`
                : "Not enough data"}
            </div>
            {probWindowMinutes !== null && (
              <div className="text-xs text-muted-foreground">Window ≈ {Math.round(probWindowMinutes)}min</div>
            )}
          </div>
        </div>

        {smartAlerts?.isClusterFeeding && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 border border-purple-200 mb-4">
            <span className="text-purple-600 text-sm font-medium">🍇 Cluster feeding period detected</span>
          </div>
        )}

        {smartAlerts.nextFeedingPrediction !== null &&
          probWindowMinutes !== null &&
          expectedIntervalMinutes !== null &&
          timeSinceLast !== null &&
          wasInWindow && (
            <div
              data-testid="prediction-window"
              className={`p-3 rounded-lg ${isDarkMode ? "bg-gray-700 border border-gray-600" : "bg-gray-50 border border-gray-200"}`}
            >
              <div className="h-[80px] mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[{ time: expectedIntervalMinutes - 60 }, { time: expectedIntervalMinutes + 60 }]}
                    margin={{ top: 10, right: 15, left: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <ReferenceArea
                      x1={expectedIntervalMinutes - probWindowMinutes / 2}
                      x2={expectedIntervalMinutes + probWindowMinutes / 2}
                      fill={isDarkMode ? "#60a5fa" : "#3b82f6"}
                      fillOpacity={isDarkMode ? 0.4 : 0.3}
                    />
                    <Line
                      type="monotone"
                      data={[{ time: stablePointPosition, value: 0.5 }]}
                      dataKey="value"
                      stroke="none"
                      dot={{ fill: predictionPointColor, strokeWidth: 2, r: 6 }}
                    />
                    <XAxis
                      type="number"
                      dataKey="time"
                      domain={[expectedIntervalMinutes - 60, expectedIntervalMinutes + 60]}
                      tickFormatter={xAxisTickFormatter}
                      tick={{ fontSize: 11, fill: isDarkMode ? "#e5e7eb" : "#374151" }}
                    />
                    <YAxis hide />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className={`flex justify-between text-xs mt-2 ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                <span>Start : {predictionLegend.start}</span>
                <span>End : {predictionLegend.end}</span>
              </div>
            </div>
          )}

        {isEvening && (
          <div
            className={`mt-5 pt-4 border-t ${
              isDarkMode ? "border-gray-700" : "border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Last night feed window</span>
                <span className="text-[10px] text-muted-foreground">
                  (30 days · {bedtimePrediction?.status === "ready"
                    ? `Based on ${bedtimePrediction.sampleSize} nights`
                    : "Learning"})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBedtimeInfo(true)}
                  className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                  title="How is bedtime predicted?"
                >
                  <Info className="h-3 w-3" />
                </Button>
              </div>
              {bedtimePrediction?.status === "ready" && bedtimePrediction.reliability !== null && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Reliability: {bedtimePrediction.reliability}%</span>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      bedtimePrediction.reliability >= 80
                        ? "bg-green-500"
                        : bedtimePrediction.reliability >= 60
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                  ></div>
                </div>
              )}
            </div>
            {renderBedtimeSummary()}
          </div>
        )}

        {calculateBabyAgeWeeks() < 4 && (timeSinceLast ?? 0) > 180 && (
          <Alert className="mt-4 border-red-500">
            <AlertDescription className="text-red-600 text-xs font-semibold">⚠️ More than 3h since last feeding</AlertDescription>
          </Alert>
        )}
        {approachingRecord && (
          <div className="text-xs mt-4 font-medium space-y-1">
            {approachingRecord.beatenRecords.length > 0 && !approachingRecord.allRecordsBroken && (
              <p className="text-green-600">🎉 Record{approachingRecord.beatenRecords.length > 1 ? "s" : ""} {approachingRecord.beatenRecords.join(", ")} beaten{approachingRecord.beatenRecords.length > 1 ? "s" : ""} !</p>
            )}
            {approachingRecord.allRecordsBroken ? (
              <p className="text-purple-600 animate-pulse">👑 ABSOLUTE {approachingRecord.isNight ? "NIGHT" : "DAY"} RECORD IN PROGRESS !</p>
            ) : (
              approachingRecord.isApproaching && (
                <p className="text-amber-600 animate-pulse">
                  🔥 Only {approachingRecord.timeRemaining}min left for {approachingRecord.nextRecordRank} record {approachingRecord.isNight ? "night" : "day"} ! ({formatTimeInterval(approachingRecord.recordInterval)})
                </p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

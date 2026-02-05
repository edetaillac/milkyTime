import React from "react"
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  ReferenceArea,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  type TooltipProps,
  type DotProps,
} from "recharts"
import { Activity } from "lucide-react"
import { useFoodTrackerContext } from "../hooks/useFoodTrackerContext"
import {
  sideColors,
  formatTimeInterval,
  formatYAxisInterval,
  getXAxisTicks,
  getYAxisTicks,
  type ProcessedIntervalData,
} from "../lib"
import { isNightHourWithSchedule } from "../lib/scheduleConfig"

export function FeedingTimeline3d() {
  const { intervalChartData72h, getTooltipContentStyle, currentSchedule } = useFoodTrackerContext()
  const data = intervalChartData72h

  const tooltipFormatter: TooltipProps<number, string>["formatter"] = (value, name) => {
    if (name === "Trend" || value == null) return [null, null]
    return [formatTimeInterval(value), "Deviation"]
  }

  const tooltipLabelFormatter: TooltipProps<number, string>["labelFormatter"] = (_label, payload) => {
    const entry = payload?.[0]?.payload as ProcessedIntervalData | undefined
    if (entry) {
      const date = new Date(entry.timestamp)
      return `${date.toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "2-digit" })} at ${
        date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      }`
    }
    return ""
  }

  const renderDot = (props: DotProps) => {
    const { cx, cy } = props
    const entry = (props as DotProps & { payload?: ProcessedIntervalData }).payload
    const safeCx = typeof cx === "number" ? cx : 0
    const safeCy = typeof cy === "number" ? cy : 0
    if (!entry) return <circle cx={safeCx} cy={safeCy} r={0} fill="transparent" stroke="transparent" />
    const sideKey: keyof typeof sideColors = entry.side ?? "bottle"
    const sideColor = sideColors[sideKey]
    return <circle cx={safeCx} cy={safeCy} r={4} fill={sideColor} stroke="white" strokeWidth={2} />
  }
  return (
    <div className="h-[280px] -mt-0.5 -mb-0.5">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />

            {(() => {
              const rawStart = Math.min(...data.map((d) => d.numericTime ?? 0))
              const rawEnd = Math.max(...data.map((d) => d.numericTime ?? 0))
              const startAligned = new Date(rawStart); startAligned.setMinutes(0, 0, 0)
              const endAligned = new Date(rawEnd); endAligned.setMinutes(0, 0, 0)
              const startHourMs = startAligned.getTime()
              const endHourMs = endAligned.getTime()
              const zones: React.ReactNode[] = []
              for (let time = startHourMs; time <= endHourMs; time += 60 * 60 * 1000) {
                const x1 = Math.max(time, rawStart)
                const x2 = Math.min(time + 60 * 60 * 1000, rawEnd)
                if (x2 <= x1) continue
                // Test at the middle of the hour zone to handle schedules with minutes (e.g., 19h30)
                const middleOfZone = new Date(time + 30 * 60 * 1000)
                const isNight = isNightHourWithSchedule(middleOfZone, currentSchedule)
                zones.push(
                  <ReferenceArea
                    key={`zone-${time}`}
                    x1={x1}
                    x2={x2}
                    fill={isNight ? "#cbd5e1" : "#fde68a"}
                    fillOpacity={isNight ? 0.3 : 0.3}
                  />,
                )
              }
              return zones
            })()}

            <XAxis
              type="number"
              dataKey="numericTime"
              domain={["dataMin", "dataMax"]}
              angle={-45}
              textAnchor="end"
              height={36}
              tickMargin={4}
              fontSize={10}
              tick={{ fontSize: 10 }}
              ticks={getXAxisTicks(data)}
              tickFormatter={(value: number) => {
                const date = new Date(value)
                return `${date.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })} ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
              }}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, dataMax + 30)]}
              tickFormatter={formatYAxisInterval}
              ticks={getYAxisTicks(Math.max(...data.map((d) => d.interval)))}
              tickMargin={4}
              padding={{ top: 2, bottom: 2 }}
            />
            <Tooltip
              formatter={tooltipFormatter}
              labelFormatter={tooltipLabelFormatter}
              contentStyle={getTooltipContentStyle()}
            />
            <Line
              type="monotone"
              dataKey="interval"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={renderDot as any}
              activeDot={{ r: 6, stroke: "white", strokeWidth: 2 }}
            />
            <Line type="monotone" dataKey="trendLine" stroke="#94a3b8" strokeWidth={2} strokeDasharray="8 4" dot={false} activeDot={false} name="Trend" opacity={0.6} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No feedings in 3 days</p>
            <p className="text-sm">At least 2 feedings are required</p>
          </div>
        </div>
      )}
    </div>
  )
}

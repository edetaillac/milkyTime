import { useMemo, type CSSProperties } from "react"
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, type TooltipProps } from "recharts"
import { Activity } from "lucide-react"
import type { Last7DaysData } from "../lib"

interface IntervalStatisticsByDaysProps {
  data: Last7DaysData[]
  getTooltipContentStyle: () => CSSProperties
  formatTimeInterval: (v: number) => string
  formatYAxisInterval: (v: number) => string
}

export function IntervalStatisticsByDays({ data, getTooltipContentStyle, formatTimeInterval, formatYAxisInterval }: IntervalStatisticsByDaysProps) {
  const { yMax, yTicks } = useMemo(() => {
    if (data.length === 0) return { yMax: 180, yTicks: Array.from({ length: 7 }, (_, i) => i * 30) }

    const maxInData = data.reduce((acc, point) => Math.max(acc, point.dayMedianInterval, point.nightMedianInterval), 0)
    const ceilTo30 = (value: number) => Math.ceil(value / 30) * 30
    const computedMax = Math.max(180, ceilTo30(maxInData))
    const ticks = Array.from({ length: computedMax / 30 + 1 }, (_, index) => index * 30)

    return { yMax: computedMax, yTicks: ticks }
  }, [data])

  const tooltipFormatter: TooltipProps<number, string>["formatter"] = (value, name, item) => {
    if (value == null) return null
    const point = item?.payload as Last7DaysData | undefined
    if (name === "☀️ Day" && point) {
      return [`${formatTimeInterval(Math.round(value))} (avg) - variability ${point.dayCV}%`, name]
    }
    if (name === "🌙 Night" && point) {
      return [`${formatTimeInterval(Math.round(value))} (avg) - variability ${point.nightCV}%`, name]
    }
    return [formatTimeInterval(value), name]
  }

  const tooltipLabelFormatter: TooltipProps<number, string>["labelFormatter"] = (_label, payload) => {
    const point = payload?.[0]?.payload as Last7DaysData | undefined
    if (!point) return ""

    const totalCount = point.dayCount + point.nightCount
    const date = new Date(point.date)
    return (
      <div>
        <div>{`${date.toLocaleDateString("en-US")} (${totalCount} feedings)`}</div>
        <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
          ☀️ Day: {point.dayCount} feedings • 🌙 Night: {point.nightCount} feedings
        </div>
      </div>
    )
  }

  return (
    <div className="h-[280px] -mt-0.5 -mb-0.5">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              angle={-45}
              textAnchor="end"
              height={60}
              fontSize={10}
              tick={{ fontSize: 10 }}
              interval={0}
              tickFormatter={(value: string) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" })
              }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10 }}
              domain={[0, yMax]}
              padding={{ top: 8, bottom: 0 }}
              tickFormatter={(value: number) => {
                if (value === 0) return "0min"
                if (value === 30) return "30min"
                if (value === 60) return "1h"
                if (value === 90) return "1h30"
                if (value === 120) return "2h"
                if (value === 150) return "2h30"
                if (value === 180) return "3h"
                return formatYAxisInterval(value)
              }}
              ticks={yTicks}
            />
            <Tooltip
              formatter={tooltipFormatter}
              labelFormatter={tooltipLabelFormatter}
              contentStyle={getTooltipContentStyle()}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="dayMedianInterval"
              stroke="#f59e0b"
              strokeWidth={3}
              dot={{ fill: "#f59e0b", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: "#f59e0b", strokeWidth: 2 }}
              name="☀️ Day"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="nightMedianInterval"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2 }}
              name="🌙 Night"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Not enough data over 7 days</p>
            <p className="text-xs mt-1">Need at least 2 feedings to calculate intervals</p>
          </div>
        </div>
      )}
    </div>
  )
}

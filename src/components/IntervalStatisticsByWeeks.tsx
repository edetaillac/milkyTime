import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts"
import { Activity } from "lucide-react"

interface WeekPoint {
  weekNumber: string
  dayMedianInterval: number
  nightMedianInterval: number
  dayCount: number
  nightCount: number
  dayCV: number
  nightCV: number
  weekStart: string
  weekEnd: string
}

interface IntervalStatisticsByWeeksProps {
  data: WeekPoint[]
  getTooltipContentStyle: () => any
  formatTimeInterval: (v: number) => string
  formatYAxisInterval: (v: number) => string
}

export function IntervalStatisticsByWeeks({ data, getTooltipContentStyle, formatTimeInterval, formatYAxisInterval }: IntervalStatisticsByWeeksProps) {
  return (
    <div className="h-[280px] -mt-0.5 -mb-0.5">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 10 }}>
            {(() => {
              // Calcul dynamique des ticks Y (toutes les 30min) jusqu'au prochain palier >= max
              const maxInData = data.reduce((acc, d) => Math.max(acc, d.dayMedianInterval, d.nightMedianInterval), 0)
              const ceilTo30 = (v: number) => Math.ceil(v / 30) * 30
              const yMax = Math.max(180, ceilTo30(maxInData))
              const yTicks = Array.from({ length: yMax / 30 + 1 }, (_, i) => i * 30)
              ;(LineChart as any).yMaxWeeks = yMax
              ;(LineChart as any).yTicksWeeks = yTicks
              return null
            })()}
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="weekNumber"
              angle={-45}
              textAnchor="end"
              height={60}
              fontSize={10}
              tick={{ fontSize: 10 }}
              interval={0}
              tickFormatter={(value: any) => value}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10 }}
              domain={[0, (LineChart as any).yMaxWeeks]}
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
              ticks={(LineChart as any).yTicksWeeks}
            />
            <Tooltip
              formatter={(value: any, name: any, props: any) => {
                if (name === "☀️ Day") {
                  const d = props.payload
                  const rounded = Math.round(value as number)
                  return [`${formatTimeInterval(rounded)} (median) - variability ${d.dayCV}%`, name]
                } else if (name === "🌙 Night") {
                  const d = props.payload
                  return [`${formatTimeInterval(Math.round(value as number))} (median) - variability ${d.nightCV}%`, name]
                }
                return [formatTimeInterval(value as number), name]
              }}
              labelFormatter={(label: any, payload: any) => {
                if (payload && payload[0] && payload[0].payload) {
                  const d = payload[0].payload as WeekPoint
                  const totalCount = d.dayCount + d.nightCount
                  return (
                    <div>
                      <div>{`Week from ${d.weekStart} to ${d.weekEnd} (${totalCount} feedings)`}</div>
                      <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                        ☀️ Day: {d.dayCount} feedings • 🌙 Night: {d.nightCount} feedings
                      </div>
                    </div>
                  )
                }
                return ""
              }}
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
            <p>Not enough data over 12 weeks</p>
            <p className="text-xs mt-1">Minimum 3 intervals per week</p>
          </div>
        </div>
      )}
    </div>
  )
}



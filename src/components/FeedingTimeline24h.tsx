import { ResponsiveContainer, LineChart, CartesianGrid, ReferenceArea, XAxis, YAxis, Tooltip, Line } from "recharts"
import { Activity } from "lucide-react"

interface Datum24h {
  timestamp: string
  numericTime?: number
  interval: number
  trendLine?: number
  side?: "left" | "right" | "bottle"
}

interface FeedingTimeline24hProps {
  isDarkMode: boolean
  data: Datum24h[]
  getTooltipContentStyle: () => any
  formatTimeInterval: (v: number) => string
  formatYAxisInterval: (v: number) => string
  sideColors: Record<string, string>
  isNightHour: (d: Date) => boolean
  getXAxisTicks: (data: any[]) => number[]
  getYAxisTicks: (max: number) => number[]
}

export function FeedingTimeline24h({
  isDarkMode,
  data,
  getTooltipContentStyle,
  formatTimeInterval,
  formatYAxisInterval,
  sideColors,
  isNightHour,
  getXAxisTicks,
  getYAxisTicks,
}: FeedingTimeline24hProps) {
  return (
    <div className="h-[280px] -mt-0.5 -mb-0.5">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />

            {/* Zones jour/nuit basées sur les timestamps réels (alignées à l'heure) */}
            {(() => {
              const rawStart = Math.min(...data.map((d) => d.numericTime ?? 0))
              const rawEnd = Math.max(...data.map((d) => d.numericTime ?? 0))
              const startAligned = new Date(rawStart)
              startAligned.setMinutes(0, 0, 0)
              const endAligned = new Date(rawEnd)
              endAligned.setMinutes(0, 0, 0)
              const startHourMs = startAligned.getTime()
              const endHourMs = endAligned.getTime()
              const zones: React.ReactNode[] = []
              for (let time = startHourMs; time <= endHourMs; time += 60 * 60 * 1000) {
                const x1 = Math.max(time, rawStart)
                const x2 = Math.min(time + 60 * 60 * 1000, rawEnd)
                if (x2 <= x1) continue
                const currentDate = new Date(time)
                const isNight = isNightHour(currentDate)
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
                return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
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
              formatter={(v: any, name: any) => (name === "Trend" ? [null, null] : [formatTimeInterval(v as number), "Deviation"])}
              labelFormatter={(label: any, payload: any) => {
                if (payload && payload[0] && payload[0].payload) {
                  const d = payload[0].payload
                  const date = new Date(d.timestamp)
                  return `${date.toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "2-digit" })} at ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                }
                return label
              }}
              contentStyle={getTooltipContentStyle()}
            />
            <Line
              type="monotone"
              dataKey="interval"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, payload } = props
                const sideKey = (payload.side ?? "bottle") as keyof typeof sideColors
                const sideColor = payload.side ? sideColors[sideKey] : "#8b5cf6"
                return <circle key={`dot-${payload.timestamp}`} cx={cx} cy={cy} r={6} fill={sideColor} stroke="white" strokeWidth={2} />
              }}
              activeDot={{ r: 9, stroke: "white", strokeWidth: 2 }}
            />
            <Line type="monotone" dataKey="trendLine" stroke="#94a3b8" strokeWidth={2} strokeDasharray="8 4" dot={false} activeDot={false} name="Trend" opacity={0.6} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No feedings in 24h</p>
            <p className="text-sm">At least 2 feedings are required</p>
          </div>
        </div>
      )}
    </div>
  )
}



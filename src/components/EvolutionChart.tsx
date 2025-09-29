import { useMemo, type CSSProperties } from "react"
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, type TooltipProps } from "recharts"
import type { DailyStatsData } from "../lib"

type SideColorMap = {
  left: string
  right: string
  bottle: string
}

interface EvolutionChartProps {
  data: DailyStatsData[]
  sideColors: SideColorMap
  getEvolutionYDomain: (bounds: [number, number]) => [number, number]
  getTooltipContentStyle: () => CSSProperties
}

export function EvolutionChart({ data, sideColors, getEvolutionYDomain, getTooltipContentStyle }: EvolutionChartProps) {
  const yDomain = useMemo<[number, number]>(() => {
    if (data.length === 0) return [0, 10]
    const maxTotal = Math.max(...data.map((point) => point.total))
    return getEvolutionYDomain([0, maxTotal])
  }, [data, getEvolutionYDomain])

  const tooltipFormatter: TooltipProps<number, string>["formatter"] = (value, name) => {
    if (value == null) return null
    const label = name === "left" ? "Left breast" : name === "right" ? "Right breast" : "Bottle"
    return [value, label]
  }

  const tooltipLabelFormatter: TooltipProps<number, string>["labelFormatter"] = (label, payload) => {
    const point = payload?.[0]?.payload as DailyStatsData | undefined
    return point ? `${point.date} — Total: ${point.total}` : label
  }

  return (
    <div className="h-[280px] -mt-0.5 -mb-0.5">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 2, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} domain={yDomain} />
            <Tooltip formatter={tooltipFormatter} labelFormatter={tooltipLabelFormatter} contentStyle={getTooltipContentStyle()} />
            <Bar dataKey="left" stackId="tetees" fill={sideColors.left} />
            <Bar dataKey="right" stackId="tetees" fill={sideColors.right} />
            <Bar dataKey="bottle" stackId="tetees" fill={sideColors.bottle} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">No data available</div>
      )}
    </div>
  )
}


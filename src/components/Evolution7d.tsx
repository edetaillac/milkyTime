import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from "recharts"

interface DayStat {
  date: string
  left: number
  right: number
  bottle: number
  total: number
}

interface Evolution7dProps {
  data: DayStat[]
  sideColors: { left: string; right: string; bottle: string }
  getEvolutionYDomain: (values: any) => [number, number]
  getTooltipContentStyle: () => any
}

export function Evolution7d({ data, sideColors, getEvolutionYDomain, getTooltipContentStyle }: Evolution7dProps) {
  return (
    <div className="h-[280px] -mt-0.5 -mb-0.5">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 2, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} domain={getEvolutionYDomain as any} />
            <Tooltip
              formatter={(v: any, name: any) => {
                const label = name === "left" ? "Left breast" : name === "right" ? "Right breast" : "Bottle"
                return [v, label]
              }}
              labelFormatter={(label: any, payload: readonly any[]) => {
                const p = payload?.[0]?.payload
                return p ? `${p.date} — Total: ${p.total}` : ""
              }}
              contentStyle={getTooltipContentStyle()}
            />
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



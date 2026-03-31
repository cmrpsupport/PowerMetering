import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export type TrendSeries = {
  key: string
  label: string
  color: string
  yAxisId: 'left' | 'right'
}

type Props = {
  data: Record<string, unknown>[]
  series: TrendSeries[]
  height?: number
}

function formatTime(ts: string | number) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatTimeLabel(label: unknown) {
  if (label == null) return ''
  if (typeof label === 'string' || typeof label === 'number') return formatTime(label)
  return formatTime(String(label))
}

export default function MultiAxisTrendChart({
  data,
  series,
  height = 300,
}: Props) {
  const leftSeries = series.filter((s) => s.yAxisId === 'left')
  const rightSeries = series.filter((s) => s.yAxisId === 'right')

  return (
    <div className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--chart-grid)"
          />
          <XAxis
            dataKey="ts"
            tickFormatter={formatTime}
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            stroke="var(--chart-axis)"
          />
          {leftSeries.length > 0 && (
            <YAxis
              yAxisId="left"
              tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
              stroke="var(--chart-axis)"
            />
          )}
          {rightSeries.length > 0 && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
              stroke="var(--chart-axis)"
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--chart-tooltip-bg)',
              border: `1px solid var(--chart-tooltip-border)`,
              borderRadius: 8,
              color: 'var(--chart-tooltip-text)',
            }}
            labelFormatter={formatTimeLabel}
          />
          <Legend
            wrapperStyle={{ color: 'var(--muted)', fontSize: 12 }}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              yAxisId={s.yAxisId}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

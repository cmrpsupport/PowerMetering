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
    <div className="w-full rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#94a3b8"
            opacity={0.3}
          />
          <XAxis
            dataKey="ts"
            tickFormatter={formatTime}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            stroke="#94a3b8"
          />
          {leftSeries.length > 0 && (
            <YAxis
              yAxisId="left"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              stroke="#94a3b8"
            />
          )}
          {rightSeries.length > 0 && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              stroke="#94a3b8"
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#f1f5f9',
            }}
            labelFormatter={formatTimeLabel}
          />
          <Legend
            wrapperStyle={{ color: '#94a3b8', fontSize: 12 }}
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

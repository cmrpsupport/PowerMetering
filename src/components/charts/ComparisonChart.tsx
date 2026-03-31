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

type SeriesData = {
  label: string
  color: string
  data: { ts: string; value: number }[]
}

type Props = {
  series: SeriesData[]
  yLabel?: string
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

export default function ComparisonChart({ series, yLabel }: Props) {
  // Normalize all series onto a shared index so recharts can overlay them.
  // We use the longest series' indices, and each series gets its own key.
  const maxLen = Math.max(...series.map((s) => s.data.length), 0)

  const merged: Record<string, unknown>[] = []
  for (let i = 0; i < maxLen; i++) {
    const row: Record<string, unknown> = { idx: i }
    // Use the first series' timestamps as the x-axis reference
    if (series[0]?.data[i]) {
      row.ts = series[0].data[i].ts
    }
    series.forEach((s, sIdx) => {
      if (s.data[i]) {
        row[`series_${sIdx}`] = s.data[i].value
        row[`ts_${sIdx}`] = s.data[i].ts
      }
    })
    merged.push(row)
  }

  const DASH_PATTERNS = ['', '8 4', '4 4', '2 4']

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={merged} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#94a3b8"
            opacity={0.3}
          />
          <XAxis
            dataKey="ts"
            tickFormatter={formatTime}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            stroke="#94a3b8"
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            stroke="#94a3b8"
            label={
              yLabel
                ? {
                    value: yLabel,
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: '#94a3b8', fontSize: 12 },
                  }
                : undefined
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#f1f5f9',
            }}
            labelFormatter={formatTimeLabel}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.slice(0, 4).map((s, idx) => (
            <Line
              key={s.label}
              type="monotone"
              dataKey={`series_${idx}`}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={DASH_PATTERNS[idx] || ''}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

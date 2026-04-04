import {
  Area,
  ComposedChart,
  Line,
  CartesianGrid,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { FluctuationAlert } from '../../lib/fluctuationDetection'

export type TrendSeries = {
  key: string
  label: string
  color: string
  yAxisId: 'left' | 'right'
  /** Filled area under the line (PQ / trend emphasis). */
  shade?: boolean
}

type Props = {
  data: Record<string, unknown>[]
  series: TrendSeries[]
  height?: number
  /** Spike markers (e.g. from `computeFluctuationAlerts`) — shown on the matching metric axis. */
  fluctuationAlerts?: FluctuationAlert[]
}

function formatTime(ts: string | number) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatTimeLabel(label: unknown) {
  if (label == null) return ''
  const d = new Date(typeof label === 'string' || typeof label === 'number' ? label : String(label))
  if (Number.isNaN(d.getTime())) return String(label)
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function gradId(key: string) {
  return `grad-${key.replace(/[^a-z0-9]/gi, '')}`
}

export default function MultiAxisTrendChart({ data, series, height = 300, fluctuationAlerts }: Props) {
  const leftSeries = series.filter((s) => s.yAxisId === 'left')
  const rightSeries = series.filter((s) => s.yAxisId === 'right')

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
      <ResponsiveContainer width="100%" height={height} className="min-w-0 [&_.recharts-surface]:outline-none">
        <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 8, left: 8 }}>
          <defs>
            {series
              .filter((s) => s.shade)
              .map((s) => (
                <linearGradient key={gradId(s.key)} id={gradId(s.key)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis
            dataKey="ts"
            tickFormatter={formatTime}
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            stroke="var(--chart-axis)"
            minTickGap={24}
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
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ color: 'var(--muted)', fontSize: 11, paddingTop: 12 }}
            iconSize={8}
          />

          {series.map((s) =>
            s.shade ? (
              <Area
                key={s.key}
                yAxisId={s.yAxisId}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#${gradId(s.key)})`}
                fillOpacity={1}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ) : (
              <Line
                key={s.key}
                yAxisId={s.yAxisId}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                connectNulls
                activeDot={{ r: 4 }}
              />
            ),
          )}

          {(fluctuationAlerts ?? []).map((a) => {
            const fill = a.severity === 'critical' ? '#ef4444' : '#f59e0b'
            if (a.metric === 'kw') {
              return (
                <ReferenceDot
                  key={a.id}
                  x={a.ts}
                  y={a.value}
                  yAxisId="right"
                  r={5}
                  fill={fill}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              )
            }
            if (a.metric === 'voltage') {
              return (
                <ReferenceDot
                  key={a.id}
                  x={a.ts}
                  y={a.value}
                  yAxisId="left"
                  r={5}
                  fill={fill}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              )
            }
            return (
              <ReferenceDot
                key={a.id}
                x={a.ts}
                y={a.value}
                yAxisId="left"
                r={5}
                fill={fill}
                stroke="var(--card)"
                strokeWidth={2}
              />
            )
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

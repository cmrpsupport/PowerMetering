import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ZAxis,
} from 'recharts'
import type { VoltageEvent, VoltageEventType } from '../../types'

type Props = {
  events: VoltageEvent[]
}

const EVENT_COLORS: Record<VoltageEventType, string> = {
  sag: '#3b82f6',
  swell: '#f97316',
  interruption: '#ef4444',
  transient: '#a855f7',
}

const EVENT_LABELS: Record<VoltageEventType, string> = {
  sag: 'Sag',
  swell: 'Swell',
  interruption: 'Interruption',
  transient: 'Transient',
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type ScatterPoint = {
  ts: number
  magnitudePu: number
  durationMs: number
  type: VoltageEventType
  phase: string
  description: string
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: ScatterPoint }[]
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--text)] shadow-lg">
      <p className="font-semibold">{EVENT_LABELS[d.type]}</p>
      <p>Time: {formatTime(d.ts)}</p>
      <p>Magnitude: {d.magnitudePu.toFixed(3)} pu</p>
      <p>Duration: {d.durationMs} ms</p>
      <p>Phase: {d.phase}</p>
      {d.description && <p className="mt-1 text-[var(--muted)]">{d.description}</p>}
    </div>
  )
}

export default function VoltageEventTimeline({ events }: Props) {
  const eventTypes: VoltageEventType[] = ['sag', 'swell', 'interruption', 'transient']

  const grouped = eventTypes.reduce<Record<VoltageEventType, ScatterPoint[]>>(
    (acc, type) => {
      acc[type] = events
        .filter((e) => e.type === type)
        .map((e) => ({
          ts: new Date(e.ts).getTime(),
          magnitudePu: e.magnitudePu,
          durationMs: e.durationMs,
          type: e.type,
          phase: e.phase,
          description: e.description,
        }))
      return acc
    },
    {} as Record<VoltageEventType, ScatterPoint[]>,
  )

  return (
    <div className="w-full min-w-0 overflow-hidden p-2 sm:p-3">
      <ResponsiveContainer width="100%" height={300} className="min-w-0">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 28, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" opacity={0.85} />
          <XAxis
            dataKey="ts"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTime}
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            stroke="var(--chart-axis)"
            name="Time"
          />
          <YAxis
            dataKey="magnitudePu"
            type="number"
            name="Magnitude"
            unit=" pu"
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            stroke="var(--chart-axis)"
            label={{
              value: 'Magnitude (pu)',
              angle: -90,
              position: 'insideLeft',
              style: { fill: 'var(--muted)', fontSize: 11 },
            }}
          />
          <ZAxis dataKey="durationMs" range={[40, 400]} name="Duration (ms)" />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted)', paddingTop: 8 }} verticalAlign="bottom" />
          {eventTypes.map((type) => (
            <Scatter
              key={type}
              name={EVENT_LABELS[type]}
              data={grouped[type]}
              fill={EVENT_COLORS[type]}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

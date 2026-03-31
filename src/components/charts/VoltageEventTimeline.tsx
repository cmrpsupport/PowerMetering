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
    <div className="rounded-lg border border-slate-300 bg-white p-3 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
      <p className="font-semibold">{EVENT_LABELS[d.type]}</p>
      <p>Time: {formatTime(d.ts)}</p>
      <p>Magnitude: {d.magnitudePu.toFixed(3)} pu</p>
      <p>Duration: {d.durationMs} ms</p>
      <p>Phase: {d.phase}</p>
      {d.description && <p className="mt-1 text-slate-500 dark:text-slate-400">{d.description}</p>}
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
    <div className="w-full rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.3} />
          <XAxis
            dataKey="ts"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTime}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            stroke="#94a3b8"
            name="Time"
          />
          <YAxis
            dataKey="magnitudePu"
            type="number"
            name="Magnitude"
            unit=" pu"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            stroke="#94a3b8"
            label={{
              value: 'Magnitude (pu)',
              angle: -90,
              position: 'insideLeft',
              style: { fill: '#94a3b8', fontSize: 12 },
            }}
          />
          <ZAxis dataKey="durationMs" range={[40, 400]} name="Duration (ms)" />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
          />
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

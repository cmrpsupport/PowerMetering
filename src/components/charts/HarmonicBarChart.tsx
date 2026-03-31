import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts'

type Harmonic = {
  order: number
  magnitudePercent: number
  limitPercent: number
}

type Props = {
  harmonics: Harmonic[]
}

function barColor(h: Harmonic) {
  if (h.magnitudePercent >= h.limitPercent) return '#ef4444'
  if (h.magnitudePercent >= h.limitPercent * 0.8) return '#f59e0b'
  return '#3b82f6'
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; dataKey: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const magnitude = payload.find((p) => p.dataKey === 'magnitudePercent')
  const limit = payload.find((p) => p.dataKey === 'limitPercent')
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-3 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
      <p className="font-semibold">Harmonic #{label}</p>
      {magnitude && <p>Magnitude: {magnitude.value.toFixed(2)}%</p>}
      {limit && <p>IEEE 519 Limit: {limit.value.toFixed(2)}%</p>}
    </div>
  )
}

export default function HarmonicBarChart({ harmonics }: Props) {
  const data = harmonics.map((h) => ({
    ...h,
    label: `H${h.order}`,
  }))

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#94a3b8"
            opacity={0.3}
          />
          <XAxis
            dataKey="order"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            stroke="#94a3b8"
            label={{
              value: 'Harmonic Order',
              position: 'insideBottom',
              offset: -10,
              style: { fill: '#94a3b8', fontSize: 12 },
            }}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            stroke="#94a3b8"
            label={{
              value: 'Magnitude (%)',
              angle: -90,
              position: 'insideLeft',
              style: { fill: '#94a3b8', fontSize: 12 },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="magnitudePercent"
            name="Magnitude"
            radius={[4, 4, 0, 0]}
          >
            {data.map((entry, idx) => (
              <Cell key={idx} fill={barColor(entry)} />
            ))}
          </Bar>
          <Bar
            dataKey="limitPercent"
            name="IEEE 519 Limit"
            fill="none"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="4 2"
            radius={[4, 4, 0, 0]}
          />
          {/* Also draw a general reference line for the most common limit */}
          {harmonics.length > 0 && (
            <ReferenceLine
              y={harmonics[0].limitPercent}
              stroke="#ef4444"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: 'Limit',
                position: 'right',
                fill: '#ef4444',
                fontSize: 11,
              }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

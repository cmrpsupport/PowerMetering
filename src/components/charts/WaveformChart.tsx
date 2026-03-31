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

type Props = {
  phaseA: number[]
  phaseB: number[]
  phaseC: number[]
  samplesPerCycle: number
  cycles: number
  showPhases?: { a: boolean; b: boolean; c: boolean }
}

const PHASE_COLORS = {
  a: 'var(--accent-red)',
  b: 'var(--text)',
  c: 'var(--accent-green)',
} as const

export default function WaveformChart({
  phaseA,
  phaseB,
  phaseC,
  samplesPerCycle,
  cycles,
  showPhases = { a: true, b: true, c: true },
}: Props) {
  const totalSamples = samplesPerCycle * cycles
  const data = Array.from({ length: totalSamples }, (_, i) => ({
    sample: i,
    deg: ((i % samplesPerCycle) / samplesPerCycle) * 360,
    a: phaseA[i] ?? 0,
    b: phaseB[i] ?? 0,
    c: phaseC[i] ?? 0,
  }))

  // Calculate cycle boundaries for reference lines
  const cycleTicks = Array.from({ length: cycles + 1 }, (_, i) => i * samplesPerCycle)

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#94a3b8"
            opacity={0.3}
          />
          <XAxis
            dataKey="sample"
            ticks={cycleTicks}
            tickFormatter={(v: number) => `${(v / samplesPerCycle).toFixed(0)}T`}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            stroke="#94a3b8"
            label={{
              value: 'Cycles',
              position: 'insideBottom',
              offset: -10,
              style: { fill: '#94a3b8', fontSize: 12 },
            }}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            stroke="#94a3b8"
            label={{
              value: 'Amplitude',
              angle: -90,
              position: 'insideLeft',
              style: { fill: '#94a3b8', fontSize: 12 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#f1f5f9',
            }}
            labelFormatter={(label) => `Sample ${String(label ?? '')}`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {showPhases.a && (
            <Line
              type="monotone"
              dataKey="a"
              name="Phase A"
              stroke={PHASE_COLORS.a}
              strokeWidth={1.5}
              dot={false}
            />
          )}
          {showPhases.b && (
            <Line
              type="monotone"
              dataKey="b"
              name="Phase B"
              stroke={PHASE_COLORS.b}
              strokeWidth={1.5}
              dot={false}
            />
          )}
          {showPhases.c && (
            <Line
              type="monotone"
              dataKey="c"
              name="Phase C"
              stroke={PHASE_COLORS.c}
              strokeWidth={1.5}
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

import { useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { FluctuationAlert } from '../../lib/fluctuationDetection'
import { levelFromFreqDeviationHz, levelFromVoltageDeviationPct } from '../../lib/pqStatus'
import type { PqLevel } from '../../lib/pqStandards'
import {
  PQ_FREQ_DEV_CRIT_HZ,
  PQ_FREQ_DEV_WARN_HZ,
  PQ_NOMINAL_HZ,
  PQ_NOMINAL_V_LL,
  PQ_VOLTAGE_DEV_CRIT_PCT,
  PQ_VOLTAGE_DEV_WARN_PCT,
} from '../../lib/pqStandards'
import type { VoltageEvent, VoltageEventType } from '../../types'

export type PqChartRow = {
  ts: string
  voltage: number
  frequencyHz: number | null
  /** Optional historian (else null). */
  thdPercent: number | null
  flickerPst: number | null
}

const SERIES_DEF = [
  { key: 'voltage', label: 'Voltage (V)', color: 'var(--chart-2)', yAxisId: 'left' as const, shade: true },
  { key: 'frequencyHz', label: 'Frequency (Hz)', color: 'var(--chart-1)', yAxisId: 'right' as const, shade: false },
  { key: 'thdPercent', label: 'THD (%)', color: 'var(--chart-4)', yAxisId: 'thd' as const, shade: false },
  { key: 'flickerPst', label: 'Flicker Pst', color: 'var(--chart-3)', yAxisId: 'fl' as const, shade: false },
]

function formatTime(ts: string | number) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatTimeFull(label: unknown) {
  if (label == null) return ''
  const d = new Date(typeof label === 'string' || typeof label === 'number' ? label : String(label))
  if (Number.isNaN(d.getTime())) return String(label)
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function gradId(key: string) {
  return `pq-grad-${key.replace(/[^a-z0-9]/gi, '')}`
}

function levelLabel(l: PqLevel): string {
  if (l === 'critical') return 'Critical'
  if (l === 'warning') return 'Warning'
  return 'Normal'
}

const eventStroke: Record<VoltageEventType, string> = {
  sag: '#f59e0b',
  swell: '#818cf8',
  interruption: '#ef4444',
  transient: '#94a3b8',
}

type Props = {
  data: PqChartRow[]
  height?: number
  fluctuationAlerts?: FluctuationAlert[]
  voltageEvents?: VoltageEvent[]
  /** Nominal line-to-line voltage for band shading. */
  nominalVLl?: number
}

export default function PqTrendChart({
  data,
  height = 520,
  fluctuationAlerts = [],
  voltageEvents = [],
  nominalVLl = PQ_NOMINAL_V_LL,
}: Props) {
  const [vis, setVis] = useState<Record<string, boolean>>({
    voltage: true,
    frequencyHz: true,
    thdPercent: true,
    flickerPst: true,
  })

  const hasThd = useMemo(() => data.some((r) => r.thdPercent != null && Number.isFinite(r.thdPercent as number)), [data])
  const hasFl = useMemo(() => data.some((r) => r.flickerPst != null && Number.isFinite(r.flickerPst as number)), [data])

  const voltageFluctuations = useMemo(() => fluctuationAlerts.filter((a) => a.metric === 'voltage'), [fluctuationAlerts])

  const activeSeries = useMemo(() => {
    const keys: { key: string; label: string; color: string; yAxisId: 'left' | 'right' | 'thd' | 'fl'; shade?: boolean }[] = []
    for (const s of SERIES_DEF) {
      if (s.key === 'thdPercent' && !hasThd) continue
      if (s.key === 'flickerPst' && !hasFl) continue
      if (vis[s.key] === false) continue
      keys.push(s)
    }
    return keys
  }, [hasThd, hasFl, vis])

  const vWarnLo = nominalVLl * (1 - PQ_VOLTAGE_DEV_WARN_PCT / 100)
  const vWarnHi = nominalVLl * (1 + PQ_VOLTAGE_DEV_WARN_PCT / 100)
  const vCritLo = nominalVLl * (1 - PQ_VOLTAGE_DEV_CRIT_PCT / 100)
  const vCritHi = nominalVLl * (1 + PQ_VOLTAGE_DEV_CRIT_PCT / 100)

  const freqLo = PQ_NOMINAL_HZ - PQ_FREQ_DEV_CRIT_HZ
  const freqHi = PQ_NOMINAL_HZ + PQ_FREQ_DEV_CRIT_HZ
  const freqWarnLo = PQ_NOMINAL_HZ - PQ_FREQ_DEV_WARN_HZ
  const freqWarnHi = PQ_NOMINAL_HZ + PQ_FREQ_DEV_WARN_HZ

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex flex-wrap gap-2">
        {SERIES_DEF.filter((s) => (s.key === 'thdPercent' ? hasThd : s.key === 'flickerPst' ? hasFl : true)).map((s) => (
          <label
            key={s.key}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_90%,transparent)] px-2.5 py-1 text-[11px] text-[var(--text)]"
          >
            <input
              type="checkbox"
              className="rounded border-[var(--border)]"
              checked={vis[s.key] !== false}
              onChange={() => setVis((v) => ({ ...v, [s.key]: !v[s.key] }))}
            />
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          </label>
        ))}
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
        <ResponsiveContainer width="100%" height={height} className="min-w-0 [&_.recharts-surface]:outline-none">
          <ComposedChart data={data as Record<string, unknown>[]} margin={{ top: 12, right: 16, bottom: 8, left: 4 }}>
            <defs>
              {activeSeries
                .filter((s) => s.shade)
                .map((s) => (
                  <linearGradient key={gradId(s.key)} id={gradId(s.key)} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />

            {/* Advisory bands on voltage axis */}
            <ReferenceArea
              yAxisId="left"
              y1={vCritLo}
              y2={vWarnLo}
              fill="#ef4444"
              fillOpacity={0.06}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              yAxisId="left"
              y1={vWarnHi}
              y2={vCritHi}
              fill="#ef4444"
              fillOpacity={0.06}
              ifOverflow="extendDomain"
            />
            <ReferenceArea yAxisId="left" y1={vWarnLo} y2={vWarnHi} fill="#22c55e" fillOpacity={0.07} ifOverflow="extendDomain" />

            <ReferenceLine yAxisId="left" y={nominalVLl} stroke="var(--muted)" strokeDasharray="4 4" strokeOpacity={0.6} />
            <ReferenceLine yAxisId="right" y={PQ_NOMINAL_HZ} stroke="var(--muted)" strokeDasharray="4 4" strokeOpacity={0.6} />

            <ReferenceArea
              yAxisId="right"
              y1={freqLo}
              y2={freqWarnLo}
              fill="#ef4444"
              fillOpacity={0.05}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              yAxisId="right"
              y1={freqWarnHi}
              y2={freqHi}
              fill="#ef4444"
              fillOpacity={0.05}
              ifOverflow="extendDomain"
            />
            <ReferenceArea yAxisId="right" y1={freqWarnLo} y2={freqWarnHi} fill="#22c55e" fillOpacity={0.05} ifOverflow="extendDomain" />

            <XAxis
              dataKey="ts"
              tickFormatter={formatTime}
              tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
              stroke="var(--chart-axis)"
              minTickGap={28}
            />

            <YAxis
              yAxisId="left"
              tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
              stroke="var(--chart-axis)"
              width={48}
              label={{ value: 'V', position: 'insideLeft', fill: 'var(--muted)', fontSize: 10 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
              stroke="var(--chart-axis)"
              width={44}
              domain={['auto', 'auto']}
            />
            {hasThd && vis.thdPercent !== false ? (
              <YAxis
                yAxisId="thd"
                orientation="right"
                tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                stroke="var(--chart-axis)"
                width={36}
                domain={[0, 'auto']}
                hide={false}
              />
            ) : null}
            {hasFl && vis.flickerPst !== false ? (
              <YAxis yAxisId="fl" orientation="right" tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} stroke="var(--chart-axis)" width={36} domain={[0, 2]} hide={false} />
            ) : null}

            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--chart-tooltip-bg)',
                border: `1px solid var(--chart-tooltip-border)`,
                borderRadius: 8,
                color: 'var(--chart-tooltip-text)',
                fontSize: 12,
              }}
              labelFormatter={formatTimeFull}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const row = payload[0]?.payload as PqChartRow & Record<string, unknown>
                const v = row.voltage as number
                const f = row.frequencyHz as number | null
                const vPct = nominalVLl > 0 ? ((v - nominalVLl) / nominalVLl) * 100 : null
                const fDev = f != null && Number.isFinite(f) ? f - PQ_NOMINAL_HZ : null
                const vLvl = levelFromVoltageDeviationPct(vPct)
                const fLvl = levelFromFreqDeviationHz(fDev)
                return (
                  <div className="space-y-1 p-1">
                    <div className="text-[11px] text-[var(--muted)]">{formatTimeFull(label)}</div>
                    <div className="text-xs">
                      Voltage:{' '}
                      <span className="font-mono font-medium">
                        {Number.isFinite(v) ? v.toFixed(1) : '—'} V
                      </span>{' '}
                      <span className="text-[var(--muted)]">({vPct != null ? `${vPct >= 0 ? '+' : ''}${vPct.toFixed(2)}%` : '—'})</span>{' '}
                      <span className={vLvl === 'critical' ? 'text-red-400' : vLvl === 'warning' ? 'text-amber-400' : 'text-emerald-400'}>
                        {levelLabel(vLvl)}
                      </span>
                    </div>
                    <div className="text-xs">
                      Frequency:{' '}
                      <span className="font-mono font-medium">{f != null && Number.isFinite(f) ? f.toFixed(3) : '—'} Hz</span>{' '}
                      <span className="text-[var(--muted)]">({fDev != null ? `${fDev >= 0 ? '+' : ''}${fDev.toFixed(3)} Hz` : '—'})</span>{' '}
                      <span className={fLvl === 'critical' ? 'text-red-400' : fLvl === 'warning' ? 'text-amber-400' : 'text-emerald-400'}>
                        {levelLabel(fLvl)}
                      </span>
                    </div>
                    {row.thdPercent != null && Number.isFinite(row.thdPercent as number) ? (
                      <div className="text-xs">THD: {Number(row.thdPercent).toFixed(2)}%</div>
                    ) : null}
                    {row.flickerPst != null && Number.isFinite(row.flickerPst as number) ? (
                      <div className="text-xs">Flicker Pst: {Number(row.flickerPst).toFixed(2)}</div>
                    ) : null}
                  </div>
                )
              }}
            />

            <Legend
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ color: 'var(--muted)', fontSize: 11, paddingTop: 10 }}
              iconSize={8}
            />

            {activeSeries.map((s) => {
              const dataKey = s.key === 'voltage' ? 'voltage' : s.key
              return s.shade ? (
                <Area
                  key={s.key}
                  yAxisId={s.yAxisId}
                  type="monotone"
                  dataKey={dataKey}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#${gradId(s.key)})`}
                  fillOpacity={1}
                  dot={false}
                  connectNulls
                />
              ) : (
                <Line
                  key={s.key}
                  yAxisId={s.yAxisId}
                  type="monotone"
                  dataKey={dataKey}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              )
            })}

            {voltageEvents.map((e) => (
              <ReferenceLine
                key={e.id}
                x={e.ts}
                stroke={eventStroke[e.type]}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                strokeOpacity={0.85}
                isFront
              />
            ))}

            {voltageFluctuations.map((a) => {
              const fill = a.severity === 'critical' ? '#ef4444' : '#f59e0b'
              const yVal = (data.find((r) => r.ts === a.ts)?.voltage as number | undefined) ?? a.value
              return (
                <ReferenceDot
                  key={a.id}
                  x={a.ts}
                  y={yVal}
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
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
          Shaded bands: green = advisory ±{PQ_VOLTAGE_DEV_WARN_PCT}% V / ±{PQ_FREQ_DEV_WARN_HZ} Hz; red tint = outside ±{PQ_VOLTAGE_DEV_CRIT_PCT}% V or ±{PQ_FREQ_DEV_CRIT_HZ} Hz. Vertical dashes: voltage events. Dots: fluctuation spikes.
        </p>
      </div>
    </div>
  )
}

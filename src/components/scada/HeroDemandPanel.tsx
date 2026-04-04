import { useId, useMemo, useState } from 'react'
import { useDemandStatus } from '../../hooks/queries'
import { setDemandThreshold, type DemandTrendRange } from '../../api/powerApi'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, Zap } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { predictDemand, type DemandPrediction } from '../../lib/demandPrediction'

// ── constants ───────────────────────────────────────────────
const ROLLING_WINDOW_MS = 15 * 60 * 1000
const ROLLING_WINDOW_SEC = ROLLING_WINDOW_MS / 1000

function fmt(n: number, d = 1): string {
  if (!Number.isFinite(n) || n === 0) return '\u2014'
  return n.toFixed(d)
}

function barColor(pct: number): string {
  if (pct >= 95) return 'var(--accent-red, var(--danger))'
  if (pct >= 80) return '#f59e0b'
  if (pct >= 60) return '#eab308'
  return 'var(--accent-green, var(--success))'
}

function statusLevel(pct: number): 'ok' | 'warning' | 'critical' {
  if (pct >= 95) return 'critical'
  if (pct >= 80) return 'warning'
  return 'ok'
}

function statusMessage(pct: number, prediction: DemandPrediction | null): { icon: React.ReactNode; text: string; cls: string } {
  if (pct >= 95) return { icon: <AlertTriangle size={16} />, text: 'Reduce load now', cls: 'text-red-400 bg-red-500/10 border-red-500/30' }
  if (pct >= 80) return { icon: <AlertTriangle size={16} />, text: 'Approaching limit', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
  if (prediction?.willExceed && prediction.secondsToThreshold !== null && prediction.secondsToThreshold < 1800)
    return { icon: <TrendingUp size={16} />, text: 'Trend rising toward threshold', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
  return { icon: <CheckCircle2 size={16} />, text: 'Within limits', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
}

function formatTick(ts: string) {
  const t = Date.parse(ts)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtCountdown(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

// ── component ───────────────────────────────────────────────

export function HeroDemandPanel() {
  const [range] = useState<DemandTrendRange>('24h')
  const { data: demand } = useDemandStatus(range)
  const queryClient = useQueryClient()
  const gradId = useId().replace(/:/g, '')
  const [editing, setEditing] = useState(false)
  const [thresholdInput, setThresholdInput] = useState('')

  // ── derived rolling demand (client-side time-weighted) ──
  const derived = useMemo(() => {
    if (!demand) return null

    // eslint-disable-next-line react-hooks/purity -- demand refreshes every 5s; Date.now() fallback is stable enough
    const nowMs = Number.isFinite(Date.parse(demand.ts)) ? Date.parse(demand.ts) : Date.now()
    const threshold = demand.thresholdKw ?? 0

    const baseSamples = (demand.trend ?? [])
      .map((p) => ({ t: Date.parse(p.ts), kw: Number(p.kw) }))
      .filter((s) => Number.isFinite(s.t) && Number.isFinite(s.kw))

    const sampleMap = new Map<number, number>()
    for (const s of baseSamples) sampleMap.set(s.t, s.kw)
    sampleMap.set(nowMs, Number(demand.instantKw))
    const samples = Array.from(sampleMap.entries())
      .map(([t, kw]) => ({ t, kw }))
      .sort((a, b) => a.t - b.t)

    if (samples.length < 2) {
      return { rollingNow: 0, fixedNow: 0, pctNow: 0, exceedsNow: false, trend: [] as { ts: string; kw: number }[] }
    }

    const tArr = samples.map((s) => s.t)
    const kwArr = samples.map((s) => s.kw)
    const cumulative = new Array(samples.length).fill(0) as number[]
    for (let i = 1; i < samples.length; i++) {
      cumulative[i] = cumulative[i - 1] + (kwArr[i - 1] * (tArr[i] - tArr[i - 1])) / 1000
    }

    const upperBound = (x: number) => {
      let lo = 0, hi = tArr.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (tArr[mid] <= x) lo = mid + 1
        else hi = mid
      }
      return lo
    }

    const integrate = (startMs: number, endMs: number) => {
      if (!(Number.isFinite(startMs) && Number.isFinite(endMs)) || endMs <= startMs || samples.length < 2) return 0
      let start = startMs
      const end = endMs
      let result = 0

      if (start < tArr[0]) {
        result += (kwArr[0] * (Math.min(end, tArr[0]) - start)) / 1000
        start = tArr[0]
        if (end <= tArr[0]) return result
      }

      const endClamped = Math.min(end, tArr[tArr.length - 1])
      if (endClamped <= start) return result

      const idxStart = Math.max(0, upperBound(start) - 1)
      const idxEnd = Math.max(0, upperBound(endClamped) - 1)

      const tNext = idxStart + 1 < tArr.length ? tArr[idxStart + 1] : endClamped
      const partEnd = Math.min(endClamped, tNext)
      const dt1 = partEnd - start
      if (dt1 > 0) result += (kwArr[idxStart] * dt1) / 1000
      if (partEnd >= endClamped) return result

      const fullStartIdx = idxStart + 1
      if (idxEnd >= fullStartIdx) result += cumulative[idxEnd] - cumulative[fullStartIdx]

      if (endClamped > tArr[idxEnd] && idxEnd < kwArr.length)
        result += (kwArr[idxEnd] * (endClamped - tArr[idxEnd])) / 1000

      return result
    }

    const rollingNow = integrate(nowMs - ROLLING_WINDOW_MS, nowMs) / ROLLING_WINDOW_SEC

    const d0 = new Date(nowMs)
    const slotMin = Math.floor(d0.getMinutes() / 15) * 15
    const slotStartMs = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), d0.getHours(), slotMin, 0, 0).getTime()
    const fixedNow = integrate(slotStartMs, nowMs) / ROLLING_WINDOW_SEC

    const pctNow = threshold > 0 ? (rollingNow / threshold) * 100 : 0
    const exceedsNow = threshold > 0 ? rollingNow > threshold : false

    const rawTrend = demand.trend ?? []
    const maxPoints = 200
    const step = rawTrend.length > maxPoints ? Math.ceil(rawTrend.length / maxPoints) : 1
    const derivedTrend = rawTrend
      .filter((_, i) => i % step === 0 || i === rawTrend.length - 1)
      .map((p) => {
        const t = Date.parse(p.ts)
        const kw = Number.isFinite(t) ? integrate(t - ROLLING_WINDOW_MS, t) / ROLLING_WINDOW_SEC : 0
        return { ts: p.ts, kw }
      })

    return { rollingNow, fixedNow, pctNow, exceedsNow, trend: derivedTrend }
  }, [demand])

  // ── demand prediction ──
  const prediction = useMemo<DemandPrediction | null>(() => {
    if (!demand || !derived?.trend?.length) return null
    return predictDemand(derived.trend, demand.thresholdKw)
  }, [demand, derived?.trend])

  const pct = derived?.pctNow ?? demand?.pctOfThreshold ?? 0
  const color = barColor(pct)
  const fixedKw = derived?.fixedNow ?? demand?.fixedDemandKw ?? 0
  const rollingNow = derived?.rollingNow ?? demand?.currentDemandKw ?? 0
  const level = statusLevel(pct)
  const msg = statusMessage(pct, prediction)

  // Fixed block progress
  const elapsedSec = Math.max(0, Math.min(900, Math.floor(Number(demand?.fixedBlockSecondsElapsed ?? 0))))
  const elapsedMin = Math.floor(elapsedSec / 60)
  const fixedPct = (elapsedSec / 900) * 100
  const isPartial = demand?.fixedBlockIsPartial === true || elapsedSec < 900
  const remainingSec = 900 - elapsedSec

  // Estimated final fixed demand
  const estFinalFixed = isPartial && elapsedSec > 30 ? (fixedKw * 900) / elapsedSec : fixedKw

  const chartData = useMemo(() => {
    const t = derived?.trend ?? demand?.trend ?? []
    return t.map((p) => ({ ...p, t: Date.parse(p.ts) }))
  }, [derived?.trend, demand?.trend])

  const handleSetThreshold = async () => {
    const kw = Number(thresholdInput)
    if (Number.isFinite(kw) && kw > 0) {
      await setDemandThreshold(kw, range)
      queryClient.invalidateQueries({ queryKey: ['demandStatus'] })
    }
    setEditing(false)
    setThresholdInput('')
  }

  if (!demand) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-xs text-[var(--muted)]">Waiting for demand data...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Hero value */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-[var(--primary)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Rolling 15-min Demand</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={[
                'font-mono text-4xl font-black tabular-nums leading-none tracking-tight',
                level === 'critical' ? 'text-red-400' : level === 'warning' ? 'text-amber-300' : 'text-[var(--text)]',
              ].join(' ')}
            >
              {fmt(rollingNow, 1)}
            </span>
            <span className="text-sm font-medium text-[var(--muted)]">kW</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-[var(--muted)]">
            {fmt(pct, 1)}% of {demand.thresholdKw > 0 ? `${fmt(demand.thresholdKw, 0)} kW` : 'threshold'}
          </div>
          {editing ? (
            <div className="mt-1 flex items-center gap-1">
              <input
                type="number"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                placeholder={String(demand.thresholdKw || 'kW')}
                className="w-20 rounded border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[10px] text-[var(--text)]"
                onKeyDown={(e) => e.key === 'Enter' && handleSetThreshold()}
                autoFocus
              />
              <button type="button" onClick={handleSetThreshold} className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                Set
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-[10px] text-[var(--muted)]">
                X
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setEditing(true); setThresholdInput(String(demand.thresholdKw || '')) }}
              className="mt-0.5 text-[10px] text-[var(--muted)] underline decoration-dotted hover:text-[var(--text)]"
            >
              Edit threshold
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
          />
          {/* Predicted demand marker */}
          {prediction && prediction.predictedKw > 0 && demand.thresholdKw > 0 && (
            <div
              className="absolute inset-y-0 w-0.5 bg-white/60"
              style={{ left: `${Math.min((prediction.predictedKw / demand.thresholdKw) * 100, 100)}%` }}
              title={`Predicted: ${fmt(prediction.predictedKw, 1)} kW`}
            />
          )}
          <div className="absolute inset-y-0 w-px bg-amber-500/60" style={{ left: '80%' }} />
          <div className="absolute inset-y-0 w-px bg-red-500/60" style={{ left: '95%' }} />
        </div>
        <div className="mt-0.5 flex justify-between text-[9px] text-[var(--muted)]">
          <span>0</span><span>80%</span><span>95%</span><span>100%</span>
        </div>
      </div>

      {/* Status message */}
      <div className={['flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold', msg.cls].join(' ')}>
        {msg.icon}
        <span>{msg.text}</span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_6%,var(--card))] px-2 py-1.5 text-center">
          <div className="text-[9px] font-semibold uppercase text-[var(--muted)]">Fixed (block)</div>
          <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[var(--text)]">{fmt(fixedKw, 1)} kW</div>
          {isPartial && (
            <div className="mt-0.5">
              <div className="text-[8px] text-[var(--muted)]">
                Partial: {elapsedMin}m / 15m ({Math.round(fixedPct)}%)
              </div>
              <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-[var(--border)]">
                <div className="h-full rounded-full bg-sky-500/60 transition-all" style={{ width: `${fixedPct}%` }} />
              </div>
              <div className="mt-0.5 text-[8px] text-[var(--muted)]">Est. Final: {fmt(estFinalFixed, 1)} kW</div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_6%,var(--card))] px-2 py-1.5 text-center">
          <div className="text-[9px] font-semibold uppercase text-[var(--muted)]">Predicted</div>
          <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[var(--text)]">
            {prediction ? fmt(prediction.predictedKw, 1) : '\u2014'} kW
          </div>
          {prediction?.secondsToThreshold != null && (
            <div className="mt-1 flex items-center justify-center gap-1 text-[9px] text-amber-400">
              <Clock size={10} />
              <span>Exceeds in {fmtCountdown(prediction.secondsToThreshold)}</span>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_6%,var(--card))] px-2 py-1.5 text-center">
          <div className="text-[9px] font-semibold uppercase text-[var(--muted)]">Remaining</div>
          <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[var(--text)]">{fmtCountdown(remainingSec)}</div>
          <div className="mt-0.5 text-[8px] text-[var(--muted)]">
            Peak: {fmt(demand.monthlyPeakKw, 1)} kW
          </div>
        </div>
      </div>

      {/* Demand chart */}
      {chartData.length > 0 && (
        <div className="min-h-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id={`demShade-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="ts" tickFormatter={formatTick} tick={{ fill: 'var(--chart-axis)', fontSize: 9 }} stroke="var(--chart-axis)" minTickGap={40} />
              <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 9 }} stroke="var(--chart-axis)" width={36} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: 8, color: 'var(--chart-tooltip-text)', fontSize: 11 }}
                labelFormatter={(l) => (typeof l === 'string' ? formatTick(l) : String(l))}
                formatter={(v: number) => [`${fmt(v, 1)} kW`, 'Rolling demand']}
              />
              {demand.thresholdKw > 0 && (
                <ReferenceLine y={demand.thresholdKw} stroke="var(--danger)" strokeDasharray="4 3" strokeOpacity={0.8} />
              )}
              <Area type="monotone" dataKey="kw" stroke="var(--primary)" strokeWidth={1.5} fill={`url(#demShade-${gradId})`} isAnimationActive={false} dot={false} activeDot={{ r: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

import { useId, useMemo, useState } from 'react'
import { useDemandStatus } from '../../hooks/queries'
import { setDemandThreshold, type DemandTrendRange } from '../../api/powerApi'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, HelpCircle, TrendingUp } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts'
import { SegmentedControl } from './SegmentedControl'

function fmt(n: number, decimals = 1): string {
  if (!Number.isFinite(n) || n === 0) return '\u2014'
  return n.toFixed(decimals)
}

function barColor(pct: number): string {
  if (pct >= 95) return 'var(--accent-red)'
  if (pct >= 80) return '#f59e0b'
  if (pct >= 60) return '#eab308'
  return 'var(--accent-green)'
}

function formatTick(ts: string) {
  const t = Date.parse(ts)
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type DemandTrackerProps = {
  /** `embedded`: no outer card — use inside a parent panel (e.g. combined load profile). */
  variant?: 'card' | 'embedded'
}

const ROLLING_TOOLTIP =
  'Rolling demand uses time-weighted average power over the last 15 minutes (irregular PLC samples weighted by duration). Chart points are logged rolling values from the database.'

export function DemandTracker({ variant = 'card' }: DemandTrackerProps) {
  const [range, setRange] = useState<DemandTrendRange>('all')
  const { data: demand } = useDemandStatus(range)
  const queryClient = useQueryClient()
  const gradId = useId().replace(/:/g, '')
  const [editing, setEditing] = useState(false)
  const [thresholdInput, setThresholdInput] = useState('')

  const pct = demand?.pctOfThreshold ?? 0
  const color = barColor(pct)
  const fixedKw = demand?.fixedDemandKw ?? 0
  const exceeds = demand?.exceedsThreshold === true

  const chartData = useMemo(() => {
    const t = demand?.trend ?? []
    return t.map((p) => ({
      ...p,
      t: Date.parse(p.ts),
    }))
  }, [demand?.trend])

  const handleSetThreshold = async () => {
    const kw = Number(thresholdInput)
    if (Number.isFinite(kw) && kw > 0) {
      await setDemandThreshold(kw, range)
      queryClient.invalidateQueries({ queryKey: ['demandStatus'] })
    }
    setEditing(false)
    setThresholdInput('')
  }

  const shell = variant === 'card' ? 'card card-hover p-5' : ''

  if (!demand) {
    return (
      <div className={shell}>
        <div className="text-sm font-semibold text-[var(--text)]">
          {variant === 'embedded' ? 'Rolling demand (logged)' : 'Load demand'}
        </div>
        <div className="mt-2 text-xs text-[var(--muted)]">Waiting for data...</div>
      </div>
    )
  }

  return (
    <div
      className={[
        shell,
        exceeds ? 'ring-2 ring-[color-mix(in_srgb,var(--danger)_55%,transparent)]' : '',
      ].join(' ')}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[var(--muted)]" />
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold text-[var(--text)]">Rolling Demand (15-min)</span>
              <span className="rounded-md bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                real-time control
              </span>
              <span className="inline-flex items-center" title={ROLLING_TOOLTIP}>
                <HelpCircle size={14} className="text-[var(--muted)]" aria-hidden />
                <span className="sr-only">{ROLLING_TOOLTIP}</span>
              </span>
            </div>
            <div className="text-[11px] text-[var(--muted)]">
              Logged continuously from Node-RED; chart range below.
              {demand.trendStartTs ? (
                <span className="ml-1 tabular-nums">Since {new Date(demand.trendStartTs).toLocaleString()}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={range}
            onChange={setRange}
            options={[
              { id: '24h', label: '24h' },
              { id: '7d', label: '7d' },
              { id: '30d', label: '30d' },
              { id: 'all', label: 'All' },
            ]}
          />
          {pct >= 80 && (
            <div className="flex items-center gap-1 text-xs font-medium" style={{ color }}>
              <AlertTriangle size={14} />
              {pct >= 95 ? 'SHED LOAD' : exceeds ? 'Over threshold' : 'Approaching limit'}
            </div>
          )}
        </div>
      </div>

      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-2xl font-bold text-[var(--text)]">
          {fmt(demand.currentDemandKw, 1)} <span className="text-sm font-normal text-[var(--muted)]">kW</span>
        </span>
        <span className="text-xs text-[var(--muted)]">
          {fmt(pct, 1)}% of threshold
          {demand.pctBasis === 'rolling' || !demand.pctBasis ? (
            <span className="ml-1 text-[10px] opacity-80">(rolling)</span>
          ) : null}
        </span>
      </div>

      <div className="relative h-4 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
        <div className="absolute inset-y-0 w-px bg-amber-500/60" style={{ left: '80%' }} />
        <div
          className="absolute inset-y-0 w-px"
          style={{ left: '95%', backgroundColor: 'var(--accent-red)', opacity: 0.6 }}
        />
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]">
        <span>0</span>
        <span>80%</span>
        <span>95%</span>
        <span>Threshold: {demand.thresholdKw > 0 ? `${fmt(demand.thresholdKw, 0)} kW` : 'auto'}</span>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_6%,var(--card))] px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-[var(--text)]">Billing Demand (15-min fixed)</span>
            <span className="ml-2 rounded-md bg-[color-mix(in_srgb,var(--muted)_12%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
              utility-aligned
            </span>
          </div>
          <span className="font-mono text-sm font-semibold tabular-nums text-[var(--text)]">{fmt(fixedKw, 1)} kW</span>
        </div>
        <p className="mt-1 text-[10px] text-[var(--muted)]">
          Maximum rolling demand observed during the current clock 15-minute block (00 / 15 / 30 / 45).
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="text-center">
          <div className="text-[10px] font-medium uppercase text-[var(--muted)]">Instant</div>
          <div className="text-sm font-semibold tabular-nums text-[var(--text)]">{fmt(demand.instantKw, 1)} kW</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] font-medium uppercase text-[var(--muted)]">Rolling</div>
          <div className="text-sm font-semibold tabular-nums text-[var(--text)]">{fmt(demand.currentDemandKw, 1)} kW</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] font-medium uppercase text-[var(--muted)]">Fixed (block)</div>
          <div className="text-sm font-semibold tabular-nums text-[var(--text)]">{fmt(fixedKw, 1)} kW</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] font-medium uppercase text-[var(--muted)]">% threshold</div>
          <div className="text-sm font-semibold tabular-nums text-[var(--text)]">{fmt(pct, 1)}%</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-2">
        <div>
          <div className="text-[10px] font-medium uppercase text-[var(--muted)]">Monthly peak</div>
          <div className="text-sm font-semibold text-[var(--text)]">{fmt(demand.monthlyPeakKw, 1)} kW</div>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase text-[var(--muted)]">Peak time</div>
          <div className="text-sm font-semibold text-[var(--text)]">
            {demand.monthlyPeakTs
              ? new Date(demand.monthlyPeakTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '\u2014'}
          </div>
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className="mt-4 h-[200px] w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id={`demandShade-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="ts"
                tickFormatter={formatTick}
                tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                stroke="var(--chart-axis)"
                minTickGap={28}
              />
              <YAxis
                tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                stroke="var(--chart-axis)"
                width={44}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--chart-tooltip-bg)',
                  border: '1px solid var(--chart-tooltip-border)',
                  borderRadius: 8,
                  color: 'var(--chart-tooltip-text)',
                  fontSize: 12,
                }}
                labelFormatter={(l) => (typeof l === 'string' ? formatTick(l) : String(l))}
                formatter={(v: number) => [`${fmt(v, 1)} kW`, 'Logged rolling demand']}
              />
              {demand.thresholdKw > 0 ? (
                <ReferenceLine
                  y={demand.thresholdKw}
                  stroke="var(--accent-red)"
                  strokeDasharray="4 3"
                  strokeOpacity={0.85}
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="kw"
                name="kW"
                stroke="var(--primary)"
                strokeWidth={2}
                fill={`url(#demandShade-${gradId})`}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted)]">
          No logged demand samples yet. After a minute of PLC data, history will appear here.
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {editing ? (
          <>
            <input
              type="number"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              placeholder={String(demand.thresholdKw || 'kW')}
              className="w-24 rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text)]"
              onKeyDown={(e) => e.key === 'Enter' && handleSetThreshold()}
              autoFocus
            />
            <button
              type="button"
              onClick={handleSetThreshold}
              className="rounded bg-[var(--accent-green)] px-2 py-1 text-xs font-medium text-white"
            >
              Set
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-[var(--muted)]">
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditing(true)
              setThresholdInput(String(demand.thresholdKw || ''))
            }}
            className="text-xs text-[var(--muted)] underline decoration-dotted hover:text-[var(--text)]"
          >
            Set demand threshold
          </button>
        )}
      </div>
    </div>
  )
}

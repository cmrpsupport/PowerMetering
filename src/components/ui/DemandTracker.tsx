import { useMemo, useState } from 'react'
import { useDemandStatus } from '../../hooks/queries'
import { setDemandThreshold } from '../../api/powerApi'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, TrendingUp } from 'lucide-react'

function fmt(n: number, decimals = 1): string {
  if (!Number.isFinite(n) || n === 0) return '\u2014'
  return n.toFixed(decimals)
}

function barColor(pct: number): string {
  if (pct >= 95) return 'var(--accent-red)'
  if (pct >= 80) return '#f59e0b' // amber
  if (pct >= 60) return '#eab308' // yellow
  return 'var(--accent-green)'
}

export function DemandTracker() {
  const { data: demand } = useDemandStatus()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [thresholdInput, setThresholdInput] = useState('')

  const pct = demand?.pctOfThreshold ?? 0
  const color = barColor(pct)

  const trendSvg = useMemo(() => {
    if (!demand?.trend || demand.trend.length < 2) return null
    const pts = demand.trend
    const maxKw = Math.max(...pts.map((p) => p.kw), 1)
    const minKw = Math.min(...pts.map((p) => p.kw), 0)
    const range = maxKw - minKw || 1
    const w = 200
    const h = 40
    const points = pts
      .map((p, i) => {
        const x = (i / (pts.length - 1)) * w
        const y = h - ((p.kw - minKw) / range) * h
        return `${x},${y}`
      })
      .join(' ')
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {demand.thresholdKw > 0 && (
          <line
            x1="0"
            y1={h - ((demand.thresholdKw - minKw) / range) * h}
            x2={w}
            y2={h - ((demand.thresholdKw - minKw) / range) * h}
            stroke="var(--accent-red)"
            strokeWidth="1"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    )
  }, [demand, color])

  const handleSetThreshold = async () => {
    const kw = Number(thresholdInput)
    if (Number.isFinite(kw) && kw > 0) {
      await setDemandThreshold(kw)
      queryClient.invalidateQueries({ queryKey: ['demandStatus'] })
    }
    setEditing(false)
    setThresholdInput('')
  }

  if (!demand) {
    return (
      <div className="card card-hover p-5">
        <div className="text-sm font-semibold text-[var(--text)]">15-Min Demand Tracking</div>
        <div className="mt-2 text-xs text-[var(--muted)]">Waiting for data...</div>
      </div>
    )
  }

  return (
    <div className="card card-hover p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[var(--muted)]" />
          <div className="text-sm font-semibold text-[var(--text)]">15-Min Rolling Demand</div>
        </div>
        {pct >= 80 && (
          <div className="flex items-center gap-1 text-xs font-medium" style={{ color }}>
            <AlertTriangle size={14} />
            {pct >= 95 ? 'SHED LOAD' : 'Approaching limit'}
          </div>
        )}
      </div>

      {/* Gauge bar */}
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-2xl font-bold text-[var(--text)]">
          {fmt(demand.currentDemandKw, 1)} <span className="text-sm font-normal text-[var(--muted)]">kW</span>
        </span>
        <span className="text-xs text-[var(--muted)]">
          {fmt(pct, 1)}% of threshold
        </span>
      </div>

      <div className="relative h-4 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
        {/* 80% marker */}
        <div
          className="absolute inset-y-0 w-px bg-amber-500/60"
          style={{ left: '80%' }}
        />
        {/* 95% marker */}
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

      {/* Stats row */}
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-[10px] font-medium uppercase text-[var(--muted)]">Instant</div>
          <div className="text-sm font-semibold text-[var(--text)]">{fmt(demand.instantKw, 1)} kW</div>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase text-[var(--muted)]">Monthly Peak</div>
          <div className="text-sm font-semibold text-[var(--text)]">{fmt(demand.monthlyPeakKw, 1)} kW</div>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase text-[var(--muted)]">Peak Time</div>
          <div className="text-sm font-semibold text-[var(--text)]">
            {demand.monthlyPeakTs
              ? new Date(demand.monthlyPeakTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '\u2014'}
          </div>
        </div>
      </div>

      {/* Mini trend sparkline */}
      {trendSvg && <div className="mt-3">{trendSvg}</div>}

      {/* Threshold edit */}
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
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-[var(--muted)]"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => { setEditing(true); setThresholdInput(String(demand.thresholdKw || '')) }}
            className="text-xs text-[var(--muted)] underline decoration-dotted hover:text-[var(--text)]"
          >
            Set demand threshold
          </button>
        )}
      </div>
    </div>
  )
}

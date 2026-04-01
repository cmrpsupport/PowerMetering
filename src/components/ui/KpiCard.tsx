import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

export type KpiStatus = 'normal' | 'good' | 'warning' | 'critical'

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

function sparkPath(values: number[]) {
  const xs = values.filter((v) => Number.isFinite(v))
  if (xs.length < 2) return ''
  const min = Math.min(...xs)
  const max = Math.max(...xs)
  const span = Math.max(1e-9, max - min)
  return xs
    .map((v, i) => {
      const x = (i / (xs.length - 1)) * 100
      const y = (1 - clamp01((v - min) / span)) * 24
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

function trendFromDelta(deltaPct: number | null | undefined): 'up' | 'down' | 'flat' {
  if (!Number.isFinite(deltaPct as number)) return 'flat'
  const d = Number(deltaPct)
  if (Math.abs(d) < 0.0025) return 'flat'
  return d > 0 ? 'up' : 'down'
}

function statusStyles(status: KpiStatus) {
  if (status === 'critical') {
    return {
      ring: 'ring-1 ring-[color-mix(in_srgb,var(--danger)_60%,transparent)]',
      glow: 'shadow-[0_0_0_1px_color-mix(in_srgb,var(--danger)_45%,transparent),0_10px_30px_rgba(220,38,38,0.14)]',
      accent: 'text-[var(--danger)]',
    }
  }
  if (status === 'warning') {
    return {
      ring: 'ring-1 ring-[color-mix(in_srgb,var(--warning)_45%,transparent)]',
      glow: 'shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_24px_rgba(16,24,40,0.10)]',
      accent: 'text-[var(--warning)]',
    }
  }
  if (status === 'good') {
    return {
      ring: 'ring-1 ring-[color-mix(in_srgb,var(--success)_40%,transparent)]',
      glow: 'shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_24px_rgba(16,24,40,0.10)]',
      accent: 'text-[var(--success)]',
    }
  }
  return {
    ring: 'ring-1 ring-[color-mix(in_srgb,var(--text)_10%,transparent)]',
    glow: 'shadow-[0_1px_2px_rgba(16,24,40,0.06),0_12px_24px_rgba(16,24,40,0.10)]',
    accent: 'text-[var(--muted)]',
  }
}

export function KpiCard({
  title,
  value,
  unit,
  subtext,
  icon,
  status = 'normal',
  deltaPct,
  deltaLabel = 'vs previous',
  targetText,
  projectionText,
  sparkline,
  footerRight,
  onClick,
}: {
  title: string
  value: ReactNode
  unit?: ReactNode
  subtext?: ReactNode
  icon?: ReactNode
  status?: KpiStatus
  /** Decimal percent, e.g. 0.024 for +2.4% */
  deltaPct?: number | null
  deltaLabel?: ReactNode
  targetText?: ReactNode
  projectionText?: ReactNode
  sparkline?: number[]
  footerRight?: ReactNode
  onClick?: () => void
}) {
  const st = statusStyles(status)
  const trend = trendFromDelta(deltaPct)
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const deltaStr =
    typeof deltaPct === 'number' && Number.isFinite(deltaPct) ? `${deltaPct >= 0 ? '↑' : '↓'} ${Math.abs(deltaPct * 100).toFixed(1)}%` : null
  const path = sparkline && sparkline.length >= 2 ? sparkPath(sparkline) : ''

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick()
            }
          : undefined
      }
      className={[
        'card card-hover relative overflow-hidden p-4',
        'bg-[linear-gradient(145deg,color-mix(in_srgb,var(--card)_88%,transparent),color-mix(in_srgb,var(--muted)_6%,var(--card)))]',
        'backdrop-blur-[2px]',
        st.ring,
        st.glow,
        onClick ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_45%,transparent)]' : '',
      ].join(' ')}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.16] [mask-image:radial-gradient(160px_120px_at_80%_20%,black,transparent)]">
        <div className="h-full w-full bg-[color-mix(in_srgb,var(--primary)_18%,transparent)]" />
      </div>

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">{title}</div>
          <div className="mt-1 flex min-w-0 items-baseline gap-1">
            <div className="truncate text-2xl font-semibold text-[var(--text)]">{value}</div>
            {unit ? <div className="text-xs font-medium text-[var(--muted)]">{unit}</div> : null}
          </div>
          {subtext ? <div className="mt-1 text-xs text-[var(--muted)]">{subtext}</div> : null}
        </div>

        {icon ? (
          <div className="relative shrink-0">
            <div className="absolute -inset-2 rounded-2xl bg-[color-mix(in_srgb,var(--muted)_10%,transparent)] opacity-40 blur-[6px]" />
            <div className="relative opacity-45">{icon}</div>
          </div>
        ) : null}
      </div>

      {(deltaStr || path || targetText || projectionText || footerRight) && (
        <div className="relative mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
          <div className="min-w-0">
            {(deltaStr || path) && (
              <div className="flex items-center gap-2">
                <div className={['inline-flex items-center gap-1 text-xs font-medium', st.accent].join(' ')}>
                  <TrendIcon size={14} className={st.accent} />
                  {deltaStr ? <span className="tabular-nums">{deltaStr}</span> : <span>{trend === 'flat' ? '—' : ''}</span>}
                </div>
                <div className="text-xs text-[var(--muted)]">{deltaLabel}</div>
              </div>
            )}
            {targetText || projectionText ? (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                {targetText ? <div>{targetText}</div> : null}
                {projectionText ? <div>{projectionText}</div> : null}
              </div>
            ) : null}
          </div>

          <div className="flex items-end gap-2">
            {footerRight}
            {path ? (
              <svg width="96" height="24" viewBox="0 0 100 24" className="opacity-70">
                <polyline fill="none" stroke="var(--primary)" strokeWidth="2" points={path} />
              </svg>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

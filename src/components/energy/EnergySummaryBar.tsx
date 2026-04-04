import type { ReactNode } from 'react'

export type SummaryTone = 'normal' | 'warning' | 'critical'

function toneClasses(t: SummaryTone) {
  switch (t) {
    case 'critical':
      return 'border-red-500/40 bg-[color-mix(in_srgb,var(--danger)_12%,var(--card))] text-[var(--text)]'
    case 'warning':
      return 'border-amber-500/35 bg-[color-mix(in_srgb,var(--warning)_10%,var(--card))] text-[var(--text)]'
    default:
      return 'border-emerald-500/30 bg-[color-mix(in_srgb,var(--success)_8%,var(--card))] text-[var(--text)]'
  }
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
}) {
  return (
    <div className="min-w-0 flex-1 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-0.5 truncate text-lg font-semibold tabular-nums text-[var(--text)]">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-[var(--muted)]">{sub}</div> : null}
    </div>
  )
}

export function EnergySummaryBar(props: {
  totalKwh: number
  vsPrevPct: number | null
  vsWeekAvgPct: number | null
  peakDemandKw: number
  peakTs: string | null
  peakLine: string | null
  contractKw: number
  demandPct: number | null
  tone: SummaryTone
}) {
  const { totalKwh, vsPrevPct, vsWeekAvgPct, peakDemandKw, peakTs, peakLine, contractKw, demandPct, tone } = props

  const prevStr =
    vsPrevPct === null ? '—' : `${vsPrevPct >= 0 ? '+' : ''}${vsPrevPct.toFixed(1)}%`
  const weekStr =
    vsWeekAvgPct === null ? '—' : `${vsWeekAvgPct >= 0 ? '+' : ''}${vsWeekAvgPct.toFixed(1)}%`

  return (
    <div
      className={[
        'flex min-w-0 flex-col gap-2 rounded-2xl border px-2 py-2 sm:flex-row sm:flex-wrap sm:items-stretch',
        toneClasses(tone),
      ].join(' ')}
    >
      <Metric label="Total energy (period)" value={`${totalKwh.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`} />
      <div className="hidden h-10 w-px self-center bg-[var(--border)] sm:block" />
      <Metric label="vs previous period" value={prevStr} sub="Same granularity, prior bucket window" />
      <div className="hidden h-10 w-px self-center bg-[var(--border)] sm:block" />
      <Metric label="vs prior week avg" value={weekStr} sub="Daily mode: last 7 vs prior 7 buckets" />
      <div className="hidden h-10 w-px self-center bg-[var(--border)] sm:block" />
      <Metric
        label="Peak demand"
        value={`${peakDemandKw.toLocaleString(undefined, { maximumFractionDigits: 1 })} kW`}
        sub={
          peakTs ? (
            <>
              {new Date(peakTs).toLocaleString()} · {peakLine ?? '—'}
            </>
          ) : (
            '—'
          )
        }
      />
      <div className="hidden h-10 w-px self-center bg-[var(--border)] sm:block" />
      <Metric
        label="Demand vs contract"
        value={demandPct === null ? '—' : `${demandPct.toFixed(0)}%`}
        sub={contractKw > 0 ? `of ${contractKw.toLocaleString(undefined, { maximumFractionDigits: 0 })} kW` : 'Threshold not configured'}
      />
    </div>
  )
}

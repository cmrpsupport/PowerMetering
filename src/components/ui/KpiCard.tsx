import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export function KpiCard({
  name,
  unit,
  currentValue,
  targetValue,
  previousValue,
  trend,
  status,
}: {
  name: string
  unit: string
  currentValue: number
  targetValue: number
  previousValue: number
  trend: 'up' | 'down' | 'flat'
  status: 'on-track' | 'at-risk' | 'off-track'
}) {
  const progressPercent = targetValue > 0 ? Math.min(100, (currentValue / targetValue) * 100) : 0

  const statusColors = {
    'on-track':
      'border-emerald-300 dark:border-emerald-500/30',
    'at-risk':
      'border-amber-300 dark:border-amber-500/30',
    'off-track':
      'border-rose-300 dark:border-rose-500/30',
  }

  const statusBadgeColors = {
    'on-track':
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
    'at-risk':
      'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
    'off-track':
      'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200',
  }

  const barColors = {
    'on-track': 'bg-emerald-500 dark:bg-emerald-400',
    'at-risk': 'bg-amber-500 dark:bg-amber-400',
    'off-track': 'bg-rose-500 dark:bg-rose-400',
  }

  const trendColors = {
    up: 'text-emerald-600 dark:text-emerald-400',
    down: 'text-rose-600 dark:text-rose-400',
    flat: 'text-slate-500 dark:text-slate-400',
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  const delta = previousValue !== 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0

  return (
    <div
      className={[
        'rounded-xl border bg-white p-4 dark:bg-slate-900',
        statusColors[status],
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
            {name}
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {currentValue.toLocaleString()}
            <span className="ml-1 text-sm font-normal text-slate-500 dark:text-slate-400">
              {unit}
            </span>
          </div>
        </div>
        <span
          className={[
            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
            statusBadgeColors[status],
          ].join(' ')}
        >
          {status.replace('-', ' ')}
        </span>
      </div>

      {/* Trend indicator */}
      <div className="mt-2 flex items-center gap-1.5">
        <TrendIcon size={14} className={trendColors[trend]} />
        <span className={['text-xs font-medium', trendColors[trend]].join(' ')}>
          {delta >= 0 ? '+' : ''}
          {delta.toFixed(1)}%
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          vs previous
        </span>
      </div>

      {/* Progress toward target */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-slate-400">
            Target: {targetValue.toLocaleString()} {unit}
          </span>
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {progressPercent.toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={['h-full rounded-full transition-all', barColors[status]].join(' ')}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function CapacityBar({
  feederName,
  loadPercent,
  ratingA,
  currentLoadA,
  status,
}: {
  feederName: string
  loadPercent: number
  ratingA: number
  currentLoadA: number
  status: 'normal' | 'warning' | 'critical'
}) {
  const clamped = Math.max(0, Math.min(100, loadPercent))

  const barColors = {
    normal: 'bg-emerald-500 dark:bg-emerald-400',
    warning: 'bg-amber-500 dark:bg-amber-400',
    critical: 'bg-rose-500 dark:bg-rose-400',
  }

  const statusLabels = {
    normal: 'Normal',
    warning: 'Warning',
    critical: 'Critical',
  }

  const statusTextColors = {
    normal: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    critical: 'text-rose-600 dark:text-rose-400',
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-900 dark:text-slate-50">
          {feederName}
        </span>
        <span
          className={[
            'text-xs font-semibold',
            statusTextColors[status],
          ].join(' ')}
        >
          {statusLabels[status]}
        </span>
      </div>

      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={['h-full rounded-full transition-all duration-300', barColors[status]].join(
            ' ',
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          {currentLoadA.toFixed(0)} A / {ratingA} A
        </span>
        <span className="font-medium">{clamped.toFixed(1)}%</span>
      </div>
    </div>
  )
}

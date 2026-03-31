export function ProgressBar({
  value,
  color = 'indigo',
  label,
}: {
  value: number
  color?: 'indigo' | 'emerald' | 'amber' | 'rose'
  label?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))

  const barColors = {
    indigo: 'bg-[var(--accent-green)]',
    emerald: 'bg-[var(--accent-green)]',
    amber: 'bg-[var(--accent-green)]',
    rose: 'bg-[var(--accent-red)]',
  }

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted)]">
            {label}
          </span>
          <span className="text-xs font-semibold text-[var(--text)]">
            {clamped.toFixed(0)}%
          </span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-[10px] bg-[var(--bg)] ring-1 ring-inset ring-[var(--border)]">
        <div
          className={['h-full rounded-full transition-all duration-300', barColors[color]].join(
            ' ',
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

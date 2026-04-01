import type { ReactNode } from 'react'

export function MiniKpiCard({
  title,
  value,
  subtitle,
  icon,
  tone = 'neutral',
  status,
}: {
  title: string
  value: ReactNode
  subtitle?: ReactNode
  icon: ReactNode
  tone?: 'neutral' | 'danger' | 'success' | 'warning'
  /** Top-right status glyph (e.g. KPI threshold indicator) */
  status?: ReactNode
}) {
  const toneRing =
    tone === 'danger'
      ? 'ring-[color-mix(in_srgb,var(--accent-red)_25%,transparent)]'
      : tone === 'success'
        ? 'ring-[color-mix(in_srgb,var(--accent-green)_25%,transparent)]'
        : tone === 'warning'
          ? 'ring-amber-200/60 dark:ring-amber-500/25'
          : 'ring-[color-mix(in_srgb,var(--text)_8%,transparent)]'

  const iconBg =
    tone === 'danger'
      ? 'bg-[color-mix(in_srgb,var(--accent-red)_10%,transparent)] text-[var(--accent-red)]'
      : tone === 'success'
        ? 'bg-[color-mix(in_srgb,var(--accent-green)_10%,transparent)] text-[var(--accent-green)]'
        : tone === 'warning'
          ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300'
          : 'bg-[color-mix(in_srgb,var(--text)_6%,transparent)] text-[var(--text)]'

  return (
    <div className={['card card-hover p-4 ring-1', toneRing].join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-[var(--muted)]">{title}</div>
          <div className="mt-1 truncate text-2xl font-semibold text-[var(--text)]">{value}</div>
          {subtitle ? <div className="mt-1 text-xs text-[var(--muted)]">{subtitle}</div> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {status}
          <div className={['grid h-10 w-10 place-items-center rounded-xl', iconBg].join(' ')}>{icon}</div>
        </div>
      </div>
    </div>
  )
}


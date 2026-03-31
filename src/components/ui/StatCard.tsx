import type { ReactNode } from 'react'

export function StatCard({
  title,
  value,
  subtitle,
  right,
}: {
  title: string
  value: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-[var(--muted)]">{title}</div>
          <div className="mt-1 truncate text-2xl font-semibold text-[var(--text)]">
            {value}
          </div>
          {subtitle ? (
            <div className="mt-1 text-xs text-[var(--muted)]">{subtitle}</div>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  )
}


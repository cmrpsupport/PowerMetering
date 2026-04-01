import type { ReactNode } from 'react'
import { KpiCard, type KpiStatus } from './KpiCard'

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
  const kpiStatus: KpiStatus =
    tone === 'danger' ? 'critical' : tone === 'warning' ? 'warning' : tone === 'success' ? 'good' : 'normal'

  return (
    <KpiCard
      title={title}
      value={value}
      subtext={subtitle}
      icon={
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--muted)_10%,transparent)] text-[var(--text)]">
          {icon}
        </div>
      }
      status={kpiStatus}
      footerRight={status}
    />
  )
}


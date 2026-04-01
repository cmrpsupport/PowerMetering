import type { ReactNode } from 'react'
import { KpiCard, type KpiStatus } from './KpiCard'

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
  let kpiValue: ReactNode = value
  let kpiUnit: ReactNode | undefined
  if (typeof value === 'string') {
    const m = value.trim().match(/^(-?\d[\d,]*\.?\d*)\s*([A-Za-z%/]+)$/)
    if (m) {
      kpiValue = m[1]
      kpiUnit = m[2]
    }
  }

  // StatCard historically had no status; treat "right" as a footer affordance.
  const status: KpiStatus = 'normal'
  return (
    <KpiCard title={title} value={kpiValue} unit={kpiUnit} subtext={subtitle} footerRight={right} status={status} />
  )
}


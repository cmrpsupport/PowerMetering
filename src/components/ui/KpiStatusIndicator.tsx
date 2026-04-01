import type { KpiStatusLevel } from '../../lib/kpiStatus'
import { AlertTriangle, OctagonAlert, CircleCheck } from 'lucide-react'

const TONE_CLASS: Record<Exclude<KpiStatusLevel, 'unknown'>, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
}

/**
 * Status glyph for KPI cards: 🟢 ok, ⚠️ warning, 🔻 critical.
 * Renders nothing when level is unknown.
 */
export function KpiStatusIndicator({
  level,
  detail,
}: {
  level: KpiStatusLevel
  detail: string
}) {
  if (level === 'unknown') return null

  const Icon = level === 'ok' ? CircleCheck : level === 'warning' ? AlertTriangle : OctagonAlert

  return (
    <span
      title={detail}
      role="img"
      aria-label={detail}
      className={[
        'inline-flex origin-center select-none items-center leading-none transition-all duration-500 ease-out will-change-transform',
        TONE_CLASS[level],
        level === 'critical' ? 'motion-safe:animate-pulse' : '',
        level === 'warning' ? 'kpi-status-soft motion-safe:opacity-100' : '',
      ].join(' ')}
    >
      <Icon size={18} />
    </span>
  )
}

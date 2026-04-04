import type { PqLevel } from '../../lib/pqStandards'

export function PqInsightPanel(props: {
  level: PqLevel
  bullets: string[]
  recommendation: string
}) {
  const { level, bullets, recommendation } = props
  const title =
    level === 'critical'
      ? 'Critical — immediate review'
      : level === 'warning'
        ? 'Warning — investigate'
        : 'Power quality summary'

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_95%,transparent)] p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Insight & recommendation</div>
      <h3 className="mt-1 text-sm font-semibold text-[var(--text)]">{title}</h3>
      <ul className="mt-3 list-inside list-disc space-y-1 text-xs leading-relaxed text-[var(--text)]">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs font-medium leading-relaxed text-[var(--text)]">{recommendation}</p>
    </div>
  )
}

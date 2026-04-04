export function EnergyInsightPanel(props: {
  title: string
  bullets: string[]
  recommendations: string[]
}) {
  const { title, bullets, recommendations } = props
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_95%,transparent)] p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Insight & recommendations</div>
      <h3 className="mt-1 text-sm font-semibold text-[var(--text)]">{title}</h3>
      <ul className="mt-3 list-inside list-disc space-y-1.5 text-xs leading-relaxed text-[var(--text)]">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      <div className="mt-4 border-t border-[var(--border)] pt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Recommendations</div>
        <ul className="mt-2 list-inside list-decimal space-y-1 text-xs text-[var(--text)]">
          {recommendations.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

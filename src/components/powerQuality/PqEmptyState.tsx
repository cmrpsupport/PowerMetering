export function PqEmptyState(props: {
  lastKnownTs: string | null
  onChangeMeter: () => void
  onChangeRange: () => void
}) {
  const { lastKnownTs, onChangeMeter, onChangeRange } = props

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-amber-500/40 bg-[color-mix(in_srgb,var(--card)_90%,transparent)] px-6 py-12 text-center">
      <div className="text-2xl" aria-hidden>
        ⚠️
      </div>
      <p className="max-w-md text-sm font-medium text-[var(--text)]">No data available for selected meter and time range</p>
      {lastKnownTs ? (
        <p className="text-xs text-[var(--muted)]">
          Last known sample: <span className="tabular-nums text-[var(--text)]">{lastKnownTs}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className="nr-btn nr-btn-secondary px-4 py-2 text-xs font-medium" onClick={onChangeMeter}>
          Change meter
        </button>
        <button type="button" className="nr-btn nr-btn-secondary px-4 py-2 text-xs font-medium" onClick={onChangeRange}>
          Change time range
        </button>
      </div>
    </div>
  )
}

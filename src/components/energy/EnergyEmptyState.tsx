export function EnergyEmptyState(props: { onChangeDate: () => void; onRetry: () => void }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_92%,transparent)] px-6 py-12 text-center">
      <p className="text-sm font-medium text-[var(--text)]">No energy data available for selected range</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="nr-btn-secondary nr-btn px-4 py-2 text-xs font-medium" onClick={onChangeDate}>
          Change date
        </button>
        <button type="button" className="nr-btn-primary nr-btn px-4 py-2 text-xs font-medium" onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  )
}

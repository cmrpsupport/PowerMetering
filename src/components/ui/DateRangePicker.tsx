export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
        From
      </label>
      <input
        type="date"
        value={from}
        onChange={(e) => onChange(e.target.value, to)}
        className="nr-input px-2.5 py-1.5"
      />
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
        To
      </label>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange(from, e.target.value)}
        className="nr-input px-2.5 py-1.5"
      />
    </div>
  )
}

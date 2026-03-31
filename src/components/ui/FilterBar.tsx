type FilterDef = {
  key: string
  label: string
  options: { value: string; label: string }[]
  value: string
}

export function FilterBar({
  filters,
  onChange,
}: {
  filters: FilterDef[]
  onChange: (key: string, value: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {filters.map((f) => (
        <div key={f.key} className="flex items-center gap-1.5">
          <label
            htmlFor={`filter-${f.key}`}
            className="text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {f.label}
          </label>
          <select
            id={`filter-${f.key}`}
            value={f.value}
            onChange={(e) => onChange(f.key, e.target.value)}
            className="nr-input px-2.5 py-1.5"
          >
            {f.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}

export type SegmentedOption<T extends string> = {
  id: T
  label: string
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'sm',
}: {
  value: T
  onChange: (v: T) => void
  options: SegmentedOption<T>[]
  size?: 'sm' | 'md'
}) {
  const pad = size === 'md' ? 'px-3 py-2 text-sm' : 'px-2.5 py-1.5 text-xs'
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm dark:bg-[var(--card)]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={[
            pad,
            'font-medium transition',
            value === o.id
              ? 'bg-[color-mix(in_srgb,var(--text)_6%,transparent)] text-[var(--text)]'
              : 'text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)]',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}


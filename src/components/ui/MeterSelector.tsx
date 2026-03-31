import { useMeters } from '../../hooks/queries'

export function MeterSelector({
  value,
  onChange,
  includeAll = false,
}: {
  value: string
  onChange: (meterId: string) => void
  includeAll?: boolean
}) {
  const { data: meters, isLoading } = useMeters()

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={isLoading}
      className="nr-input px-2.5 py-1.5 disabled:opacity-50"
    >
      {includeAll && <option value="">All Meters</option>}
      {meters?.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  )
}

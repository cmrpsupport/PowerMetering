import { useMemo, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { useMeters, useVoltageEvents } from '../hooks/queries'
import { FilterBar } from '../components/ui/FilterBar'
import { Badge, type BadgeColor } from '../components/ui/Badge'
import type { VoltageEvent, VoltageEventType } from '../types'

/* ── helpers ────────────────────────────────────────────── */

function typeBadgeColor(type: VoltageEventType): BadgeColor {
  switch (type) {
    case 'sag':
      return 'yellow'
    case 'swell':
      return 'indigo'
    case 'interruption':
      return 'red'
    case 'transient':
      return 'slate'
  }
}

type SortKey = 'ts' | 'type' | 'phase' | 'durationMs' | 'magnitudePu'
type SortDir = 'asc' | 'desc'

function SortHeader({
  k,
  label,
  activeKey,
  onToggle,
}: {
  k: SortKey
  label: string
  activeKey: SortKey
  onToggle: (k: SortKey) => void
}) {
  return (
    <th className="px-4 py-2">
      <button
        type="button"
        onClick={() => onToggle(k)}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50"
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${activeKey === k ? 'text-indigo-500' : ''}`} />
      </button>
    </th>
  )
}

/* ── page ───────────────────────────────────────────────── */

export function EventsPage() {
  const metersQ = useMeters()
  const meters = useMemo(() => metersQ.data ?? [], [metersQ.data])

  const [filterType, setFilterType] = useState('')
  const [filterMeter, setFilterMeter] = useState('')
  const [filterPhase, setFilterPhase] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('ts')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const eventsQ = useVoltageEvents(filterMeter || undefined)
  const events: VoltageEvent[] = useMemo(() => eventsQ.data ?? [], [eventsQ.data])

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'type') setFilterType(value)
    if (key === 'meter') setFilterMeter(value)
    if (key === 'phase') setFilterPhase(value)
  }

  const filters = useMemo(
    () => [
      {
        key: 'type',
        label: 'Type',
        value: filterType,
        options: [
          { value: '', label: 'All types' },
          { value: 'sag', label: 'Sag' },
          { value: 'swell', label: 'Swell' },
          { value: 'interruption', label: 'Interruption' },
          { value: 'transient', label: 'Transient' },
        ],
      },
      {
        key: 'meter',
        label: 'Meter',
        value: filterMeter,
        options: [
          { value: '', label: 'All meters' },
          ...meters.map((m) => ({ value: m.id, label: m.name })),
        ],
      },
      {
        key: 'phase',
        label: 'Phase',
        value: filterPhase,
        options: [
          { value: '', label: 'All phases' },
          { value: 'A', label: 'Phase A' },
          { value: 'B', label: 'Phase B' },
          { value: 'C', label: 'Phase C' },
          { value: 'ABC', label: 'ABC' },
        ],
      },
    ],
    [filterType, filterMeter, filterPhase, meters],
  )

  const filtered = useMemo(() => {
    let result = events
    if (filterType) result = result.filter((e) => e.type === filterType)
    if (filterPhase) result = result.filter((e) => e.phase === filterPhase)
    return result
  }, [events, filterType, filterPhase])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'ts') cmp = new Date(a.ts).getTime() - new Date(b.ts).getTime()
      else if (sortKey === 'type') cmp = a.type.localeCompare(b.type)
      else if (sortKey === 'phase') cmp = a.phase.localeCompare(b.phase)
      else if (sortKey === 'durationMs') cmp = a.durationMs - b.durationMs
      else if (sortKey === 'magnitudePu') cmp = a.magnitudePu - b.magnitudePu
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filtered, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Voltage Events
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Complete log of all recorded voltage disturbances.
        </div>
      </div>

      {/* Filters */}
      <FilterBar filters={filters} onChange={handleFilterChange} />

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Events ({sorted.length})
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left dark:border-slate-800">
                <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  ID
                </th>
                <SortHeader k="ts" label="Time" activeKey={sortKey} onToggle={toggleSort} />
                <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Meter
                </th>
                <SortHeader k="type" label="Type" activeKey={sortKey} onToggle={toggleSort} />
                <SortHeader k="phase" label="Phase" activeKey={sortKey} onToggle={toggleSort} />
                <SortHeader k="durationMs" label="Duration (ms)" activeKey={sortKey} onToggle={toggleSort} />
                <SortHeader k="magnitudePu" label="Magnitude (pu)" activeKey={sortKey} onToggle={toggleSort} />
                <th className="px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                    No events found
                  </td>
                </tr>
              )}
              {sorted.map((e) => {
                const meterName = meters.find((m) => m.id === e.meterId)?.name ?? e.meterId
                return (
                  <tr
                    key={e.id}
                    className="border-b border-slate-50 last:border-0 dark:border-slate-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-400 dark:text-slate-500">
                      {e.id}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(e.ts).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                      {meterName}
                    </td>
                    <td className="px-4 py-2">
                      <Badge color={typeBadgeColor(e.type)}>{e.type}</Badge>
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{e.phase}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                      {e.durationMs.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                      {e.magnitudePu.toFixed(3)}
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 text-slate-500 dark:text-slate-400">
                      {e.description}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useVoltageEvents } from '../hooks/queries'
import { MeterSelector } from '../components/ui/MeterSelector'
import { DateRangePicker } from '../components/ui/DateRangePicker'
import { StatCard } from '../components/ui/StatCard'
import { Badge, type BadgeColor } from '../components/ui/Badge'
import VoltageEventTimeline from '../components/charts/VoltageEventTimeline'
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

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function thirtyDaysAgoIso() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

/* ── page ───────────────────────────────────────────────── */

export function PowerQualityPage() {
  const [meterId, setMeterId] = useState('')
  const [dateRange, setDateRange] = useState({ from: thirtyDaysAgoIso(), to: todayIso() })

  const eventsQ = useVoltageEvents(meterId || undefined)
  const events: VoltageEvent[] = useMemo(() => eventsQ.data ?? [], [eventsQ.data])

  // Filter by date range
  const filtered = useMemo(() => {
    const fromTs = new Date(dateRange.from).getTime()
    const toTs = new Date(dateRange.to + 'T23:59:59').getTime()
    return events.filter((e) => {
      const t = new Date(e.ts).getTime()
      return t >= fromTs && t <= toTs
    })
  }, [events, dateRange])

  // Counts by type
  const counts = useMemo(() => {
    const c: Record<VoltageEventType, number> = { sag: 0, swell: 0, interruption: 0, transient: 0 }
    for (const e of filtered) {
      c[e.type] = (c[e.type] ?? 0) + 1
    }
    return c
  }, [filtered])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Power Quality
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Voltage events, sags, swells, interruptions, and transients.
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <MeterSelector value={meterId} onChange={setMeterId} includeAll />
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={(from, to) => setDateRange({ from, to })}
        />
      </div>

      {/* Summary stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Sags"
          value={counts.sag}
          right={<Badge color="yellow">sag</Badge>}
        />
        <StatCard
          title="Swells"
          value={counts.swell}
          right={<Badge color="indigo">swell</Badge>}
        />
        <StatCard
          title="Interruptions"
          value={counts.interruption}
          right={<Badge color="red">interruption</Badge>}
        />
        <StatCard
          title="Transients"
          value={counts.transient}
          right={<Badge color="slate">transient</Badge>}
        />
      </div>

      {/* Scatter timeline */}
      <div className="card p-4">
        <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-50">
          Voltage Event Timeline
        </div>
        <VoltageEventTimeline events={filtered} />
      </div>

      {/* Events table */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Events ({filtered.length})
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Phase</th>
                <th className="px-4 py-2">Duration (ms)</th>
                <th className="px-4 py-2">Magnitude (pu)</th>
                <th className="px-4 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                    No voltage events found
                  </td>
                </tr>
              )}
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-slate-50 last:border-0 dark:border-slate-800/50"
                >
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {new Date(e.ts).toLocaleString()}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

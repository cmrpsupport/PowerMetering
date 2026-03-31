import { useMemo, useState } from 'react'
import { List, Clock } from 'lucide-react'
import { useSOE } from '../hooks/queries'
import SOETimeline from '../components/charts/SOETimeline'

function fmtPreciseTs(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  } as Intl.DateTimeFormatOptions)
}

export function SOEPage() {
  const soeQ = useSOE()
  const entries = useMemo(() => soeQ.data ?? [], [soeQ.data])
  const [view, setView] = useState<'timeline' | 'table'>('timeline')

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
      ),
    [entries],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Sequence of Events
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            High-resolution event log with millisecond precision.
          </div>
        </div>

        {/* View toggle */}
        <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setView('timeline')}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'timeline'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
            ].join(' ')}
          >
            <Clock size={14} />
            Timeline
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'table'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
            ].join(' ')}
          >
            <List size={14} />
            Table
          </button>
        </div>
      </div>

      {view === 'timeline' ? (
        <SOETimeline entries={entries} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Device</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {sorted.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">
                      {fmtPreciseTs(e.ts)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-50">
                        {e.deviceName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {e.deviceId}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {e.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {e.description}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">
                      {e.value || '--'}
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                    >
                      No events recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

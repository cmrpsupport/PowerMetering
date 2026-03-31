import type { SequenceOfEventsEntry } from '../../types'

type Props = {
  entries: SequenceOfEventsEntry[]
}

function formatTs(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  } as Intl.DateTimeFormatOptions)
}

const EVENT_DOT_COLORS: Record<string, string> = {
  trip: 'bg-red-500',
  close: 'bg-green-500',
  alarm: 'bg-amber-500',
  status: 'bg-blue-500',
}

function dotColor(eventType: string) {
  const lower = eventType.toLowerCase()
  for (const [key, cls] of Object.entries(EVENT_DOT_COLORS)) {
    if (lower.includes(key)) return cls
  }
  return 'bg-slate-400'
}

export default function SOETimeline({ entries }: Props) {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
  )

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        No events recorded.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="relative ml-4">
        {/* Vertical line */}
        <div className="absolute left-2 top-0 h-full w-0.5 bg-slate-300 dark:bg-slate-600" />

        <ul className="space-y-4">
          {sorted.map((entry) => (
            <li key={entry.id} className="relative flex items-start gap-4 pl-6">
              {/* Dot */}
              <span
                className={`absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${dotColor(entry.eventType)}`}
              />

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {formatTs(entry.ts)}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {entry.eventType}
                  </span>
                </div>
                <p className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                  {entry.deviceName}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {entry.description}
                </p>
                {entry.value && (
                  <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                    Value: {entry.value}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

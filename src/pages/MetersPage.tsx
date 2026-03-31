import { Link, useSearchParams } from 'react-router-dom'
import { useMemo } from 'react'
import { useMeters } from '../hooks/queries'
import { Badge, type BadgeColor } from '../components/ui/Badge'

function statusColor(status: string): BadgeColor {
  if (status === 'online') return 'green'
  if (status === 'warning') return 'yellow'
  return 'red'
}

export function MetersPage() {
  const metersQ = useMeters()
  const [params] = useSearchParams()
  const query = (params.get('query') ?? '').trim().toLowerCase()

  const rows = useMemo(() => {
    const list = metersQ.data ?? []
    if (!query) return list
    return list.filter((m) => `${m.name} ${m.site} ${m.id}`.toLowerCase().includes(query))
  }, [metersQ.data, query])

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Meters</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Browse your meters and open live detail pages.
          </div>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Refresh: 10s {query ? <span className="ml-2">Filter: “{query}”</span> : null}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last seen</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-50">{m.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{m.id}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{m.site}</td>
                  <td className="px-4 py-3">
                    <Badge color={statusColor(m.status)}>{m.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {new Date(m.lastSeenAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/meters/${encodeURIComponent(m.id)}`}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    No meters match your search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


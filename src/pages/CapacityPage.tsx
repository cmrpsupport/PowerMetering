import { useCapacityThresholds } from '../hooks/queries'
import { Badge } from '../components/ui/Badge'

function fmtNum(n: number, decimals = 0) {
  if (!Number.isFinite(n)) return '--'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function CapacityPage() {
  const capQ = useCapacityThresholds()
  const thresholds = capQ.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Capacity Planning
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Thresholds and limits for safe loading and reliability monitoring.
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Feeder</th>
                <th className="px-4 py-3 text-right">Rating (A)</th>
                <th className="px-4 py-3 text-right">Load (A)</th>
                <th className="px-4 py-3 text-right">Load (%)</th>
                <th className="px-4 py-3 text-right">Warn (%)</th>
                <th className="px-4 py-3 text-right">Crit (%)</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {thresholds.map((t) => (
                <tr key={t.feederId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-50">{t.feederName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{t.feederId}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                    {fmtNum(t.ratingA)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                    {fmtNum(t.currentLoadA)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                    {fmtNum(t.loadPercent, 1)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                    {fmtNum(t.thresholdWarning, 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                    {fmtNum(t.thresholdCritical, 0)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      color={
                        t.status === 'normal'
                          ? 'green'
                          : t.status === 'warning'
                            ? 'yellow'
                            : 'red'
                      }
                    >
                      {t.status}
                    </Badge>
                  </td>
                </tr>
              ))}

              {thresholds.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    {capQ.isLoading ? 'Loading capacity thresholds...' : 'No capacity thresholds available.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


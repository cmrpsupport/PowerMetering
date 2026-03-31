import { useKpis } from '../hooks/queries'
import { Badge } from '../components/ui/Badge'

function fmtNum(n: number, decimals = 1) {
  if (!Number.isFinite(n)) return '--'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function KpisPage() {
  const kpisQ = useKpis()
  const kpis = kpisQ.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          KPIs
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Operational and energy KPIs for benchmarking.
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {k.name}
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Previous: {fmtNum(k.previousValue)} {k.unit} · Trend: {k.trend}
                </div>
              </div>
              <Badge
                color={
                  k.status === 'on-track'
                    ? 'green'
                    : k.status === 'at-risk'
                      ? 'yellow'
                      : 'red'
                }
              >
                {k.status}
              </Badge>
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-50">
              {fmtNum(k.currentValue)} {k.unit}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Target: {fmtNum(k.targetValue)} {k.unit}
            </div>
          </div>
        ))}

        {kpis.length === 0 && (
          <div className="card p-10 text-center text-sm text-slate-500 dark:text-slate-400 sm:col-span-2 lg:col-span-3">
            {kpisQ.isLoading ? 'Loading KPIs...' : 'No KPIs available.'}
          </div>
        )}
      </div>
    </div>
  )
}


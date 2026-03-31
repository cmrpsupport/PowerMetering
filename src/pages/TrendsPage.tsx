import { useMemo } from 'react'
import { useMeters } from '../hooks/queries'
import { StatCard } from '../components/ui/StatCard'

export function TrendsPage() {
  const metersQ = useMeters()
  const meters = useMemo(() => metersQ.data ?? [], [metersQ.data])

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Trends
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Higher-level trend analytics across meters (stub).
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Meters" value={meters.length} />
        <StatCard title="Trend windows" value="Daily/Weekly" />
        <StatCard title="Comparisons" value="Baseline" />
        <StatCard title="Exports" value="CSV/PDF" />
      </div>

      <div className="card p-4 text-sm text-slate-600 dark:text-slate-300">
        This page is a placeholder for cross-meter analytics (daily/weekly/monthly comparisons, baselining, anomaly detection).
      </div>
    </div>
  )
}


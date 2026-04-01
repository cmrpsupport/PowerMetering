import { useKpis } from '../hooks/queries'
import { Badge } from '../components/ui/Badge'
import { KpiCard } from '../components/ui/KpiCard'
import { Gauge, Target, TrendingUp } from 'lucide-react'

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

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {kpis.map((k) => (
          <KpiCard
            key={k.id}
            title={k.name}
            value={fmtNum(k.currentValue)}
            unit={k.unit}
            subtext={
              <span>
                Prev: {fmtNum(k.previousValue)} {k.unit} · Trend: {k.trend}
              </span>
            }
            icon={<Gauge size={18} />}
            status={k.status === 'on-track' ? 'good' : k.status === 'at-risk' ? 'warning' : 'critical'}
            deltaPct={k.previousValue ? (k.currentValue - k.previousValue) / k.previousValue : null}
            deltaLabel="from previous"
            targetText={
              <span className="inline-flex items-center gap-1">
                <Target size={12} /> Target {fmtNum(k.targetValue)} {k.unit}
              </span>
            }
            footerRight={
              <Badge color={k.status === 'on-track' ? 'green' : k.status === 'at-risk' ? 'yellow' : 'red'}>
                <span className="inline-flex items-center gap-1">
                  <TrendingUp size={12} />
                  {k.status}
                </span>
              </Badge>
            }
          />
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


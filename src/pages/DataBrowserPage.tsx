import { useMeters, useReadings } from '../hooks/queries'
import { useMemo, useState } from 'react'
import { MeterSelector } from '../components/ui/MeterSelector'
import MultiAxisTrendChart, { type TrendSeries } from '../components/charts/MultiAxisTrendChart'

function fmtNum(n: number, decimals = 2) {
  if (!Number.isFinite(n)) return '--'
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

export function DataBrowserPage() {
  const metersQ = useMeters()
  const meters = metersQ.data ?? []

  const [meterId, setMeterId] = useState('')
  const activeMeterId = meterId || meters[0]?.id || ''

  const readingsQ = useReadings(activeMeterId, 60)
  const readings = useMemo(() => readingsQ.data ?? [], [readingsQ.data])

  const data = useMemo(
    () =>
      readings.map((r) => ({
        ts: r.ts,
        kw: r.powerKw,
        v: r.voltageV,
        a: r.currentA,
        pf: r.pf,
      })),
    [readings],
  )

  const series: TrendSeries[] = [
    { key: 'kw', label: 'kW', color: '#4f46e5', yAxisId: 'left' },
    { key: 'v', label: 'V', color: '#0891b2', yAxisId: 'right' },
    { key: 'a', label: 'A', color: '#f59e0b', yAxisId: 'right' },
    { key: 'pf', label: 'PF', color: '#10b981', yAxisId: 'left' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Data Browser
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Quick inspection of recent time-series data for a meter.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <MeterSelector value={activeMeterId} onChange={setMeterId} />
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Last 60 minutes
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {readingsQ.isLoading ? 'Loading…' : `${readings.length} points`}
          </div>
        </div>

        <MultiAxisTrendChart data={data} series={series} height={320} />

        <div className="mt-3 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
          <div>kW: {fmtNum(readings.at(-1)?.powerKw ?? NaN)}</div>
          <div>V: {fmtNum(readings.at(-1)?.voltageV ?? NaN)}</div>
          <div>A: {fmtNum(readings.at(-1)?.currentA ?? NaN)}</div>
          <div>PF: {fmtNum(readings.at(-1)?.pf ?? NaN)}</div>
        </div>
      </div>
    </div>
  )
}


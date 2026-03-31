import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { usePlcEnergyConsumptionSnapshot } from '../hooks/queries'
import { StatCard } from '../components/ui/StatCard'

function fmtNum(n: number | null, decimals = 3) {
  if (n === null || !Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtRaw(raw: unknown): string {
  if (raw === undefined) return 'undefined'
  if (raw === null) return 'null'
  if (typeof raw === 'number') return String(raw)
  return JSON.stringify(raw)
}

export function PlcTotalEnergyPage() {
  const q = usePlcEnergyConsumptionSnapshot()
  const [showJson, setShowJson] = useState(true)
  const data = q.data

  const sumKwh = useMemo(() => {
    if (!data?.rows.length) return null
    let s = 0
    let any = false
    for (const r of data.rows) {
      if (r.kwh !== null && Number.isFinite(r.kwh)) {
        s += r.kwh
        any = true
      }
    }
    return any ? s : null
  }, [data?.rows])

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          PLC total energy (DB16)
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Total energy consumption by line from Cracker Line 1 through Utilities Lighting. Values
          come from <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">GET /api/plc/snapshot</code>{' '}
          (Node-RED S7 → PLC). Use the table and raw JSON below to confirm tags match TIA Portal.
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="PLC snapshot time"
          value={
            data?.ts
              ? new Date(data.ts).toLocaleString()
              : q.isLoading
                ? '…'
                : '—'
          }
        />
        <StatCard
          title="Connection"
          value={data?.connected ? 'Reading PLC' : 'Not connected'}
        />
        <StatCard
          title="Sum (all lines)"
          value={sumKwh !== null ? `${fmtNum(sumKwh)} kWh` : '—'}
        />
        <StatCard title="API base" value={data?.apiBaseUrl ?? '—'} />
      </div>

      {data?.warning ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          {data.warning}
        </div>
      ) : null}

      {q.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          Failed to load snapshot: {(q.error as Error)?.message ?? 'Unknown error'}
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
          <span>Lines (Total_*_kWh)</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              Auto every 5s · last fetch:{' '}
              {q.dataUpdatedAt ? new Date(q.dataUpdatedAt).toLocaleTimeString() : '—'}
            </span>
            <button
              type="button"
              onClick={() => void q.refetch()}
              disabled={q.isFetching}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Fetch latest snapshot now"
            >
              <RefreshCw
                size={14}
                className={q.isFetching ? 'animate-spin' : ''}
                aria-hidden
              />
              Refresh
            </button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Line</th>
                <th className="px-4 py-3 font-mono text-[11px]">PLC tag key</th>
                <th className="px-4 py-3 text-right">Energy (kWh)</th>
                <th className="px-4 py-3 font-mono text-[11px]">Raw value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data?.rows ?? []).map((row) => (
                <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                  <td className="px-4 py-3">{row.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {row.key}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtNum(row.kwh)}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {fmtRaw(row.raw)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-medium dark:border-slate-800 dark:bg-slate-950">
              <tr>
                <td className="px-4 py-3" colSpan={2}>
                  Total (sum of numeric rows)
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtNum(sumKwh)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowJson((v) => !v)}
          className="flex w-full items-center justify-between border-b border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50"
        >
          <span>Verification JSON (all Total_*_kWh keys from snapshot)</span>
          <span className="text-xs font-normal text-slate-500">{showJson ? 'Hide' : 'Show'}</span>
        </button>
        {showJson ? (
          <pre className="max-h-[min(480px,50vh)] overflow-auto p-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {JSON.stringify(
              {
                ts: data?.ts,
                connected: data?.connected,
                warning: data?.warning,
                totalEnergyKeys: data?.totalEnergyKeys ?? {},
              },
              null,
              2,
            )}
          </pre>
        ) : null}
      </div>
    </div>
  )
}

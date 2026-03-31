import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useEnhancedAlerts, useMeterHistory, usePlcFullSnapshot } from '../hooks/queries'
import { PLC_PRODUCTION_METERS } from '../constants/plcProductionMeters'
import { findPlcMeter } from '../constants/plcMeters'
import { Badge } from '../components/ui/Badge'
import type { PlcMeterData } from '../types'
import MultiAxisTrendChart from '../components/charts/MultiAxisTrendChart'

function fmtSnap(n: number, decimals = 1): string {
  if (!Number.isFinite(n) || n === 0) return '\u2014'
  return n.toFixed(decimals)
}

function meterHasData(data: PlcMeterData | undefined): boolean {
  if (!data) return false
  return data.Real_power !== 0 || data.Voltage_Lave !== 0 || data.Current_Ave !== 0
}

function fmtNum(n: number, decimals = 1) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function LineDashboardPage() {
  const { lineId } = useParams()
  const lineDef = useMemo(() => PLC_PRODUCTION_METERS.find((l) => l.id === lineId), [lineId])
  const meterIds = lineDef?.meterIds ?? []

  const snapQ = usePlcFullSnapshot()
  const snap = snapQ.data

  const alertsQ = useEnhancedAlerts()

  const [trendWindow, setTrendWindow] = useState<'1h' | '6h' | '12h' | '24h' | '7d'>('24h')
  const trendMinutes =
    trendWindow === '1h'
      ? 60
      : trendWindow === '6h'
        ? 6 * 60
        : trendWindow === '12h'
          ? 12 * 60
          : trendWindow === '24h'
            ? 24 * 60
            : 7 * 24 * 60

  // Fetch all meter history once, then filter/aggregate for this line.
  const histQ = useMeterHistory(trendMinutes)
  const lineHistory = useMemo(() => {
    const pts = (histQ.data ?? []).filter((p) => meterIds.includes(p.meterId))
    const map = new Map<
      string,
      { ts: string; kwSum: number; vSum: number; aSum: number; cnt: number }
    >()
    for (const p of pts) {
      const row = map.get(p.ts) ?? { ts: p.ts, kwSum: 0, vSum: 0, aSum: 0, cnt: 0 }
      row.kwSum += p.realPowerKw
      row.vSum += p.voltageLlAvg
      row.aSum += p.currentAvg
      row.cnt += 1
      map.set(p.ts, row)
    }
    return Array.from(map.values())
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
      .map((r) => ({
        ts: r.ts,
        kw: r.kwSum,
        voltageV: r.cnt > 0 ? r.vSum / r.cnt : 0,
        currentA: r.cnt > 0 ? r.aSum / r.cnt : 0,
      }))
  }, [histQ.data, meterIds])

  const series = useMemo(
    () => [
      { key: 'kw', label: 'kW (sum)', color: 'var(--primary)', yAxisId: 'left' as const },
      { key: 'voltageV', label: 'V (avg)', color: 'var(--success)', yAxisId: 'right' as const },
      { key: 'currentA', label: 'A (avg)', color: 'var(--warning)', yAxisId: 'right' as const },
    ],
    [],
  )

  const stats = useMemo(() => {
    const ids = meterIds
    const meterCount = ids.length
    const onlineCount = ids.filter((id) => meterHasData(snap?.meters[id])).length
    const kwSum = ids.reduce((s, id) => s + (snap?.meters[id]?.Real_power ?? 0), 0)
    const vAvg =
      meterCount > 0 ? ids.reduce((s, id) => s + (snap?.meters[id]?.Voltage_Lave ?? 0), 0) / meterCount : 0
    const aAvg =
      meterCount > 0 ? ids.reduce((s, id) => s + (snap?.meters[id]?.Current_Ave ?? 0), 0) / meterCount : 0
    const totalEnergyKwh = lineDef ? (snap?.totalEnergy?.[lineDef.name] ?? 0) : 0
    return { meterCount, onlineCount, kwSum, vAvg, aAvg, totalEnergyKwh }
  }, [lineDef, meterIds, snap?.meters, snap?.totalEnergy])

  const lineAlerts = useMemo(() => {
    const ids = new Set(meterIds)
    return (alertsQ.data ?? [])
      .filter((a) => ids.has(a.meterId))
      .slice()
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 20)
  }, [alertsQ.data, meterIds])

  if (!lineDef) {
    return (
      <div className="card p-4">
        <div className="text-sm font-semibold text-[var(--text)]">Production line not found</div>
        <div className="mt-1 text-sm text-[var(--muted)]">Unknown line id: {lineId ?? '—'}</div>
        <div className="mt-3">
          <Link to="/dashboard" className="text-sm font-medium text-[var(--primary)] hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-base font-semibold text-[var(--text)]">{lineDef.name}</div>
          <div className="mt-0.5 text-sm text-[var(--muted)]">
            Line dashboard for tracking fluctuation, meters, and totals
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/dashboard" className="text-sm font-medium text-[var(--primary)] hover:underline">
            Main dashboard
          </Link>
          <span className="text-xs text-[var(--muted)]">•</span>
          <Link to="/" className="text-sm font-medium text-[var(--primary)] hover:underline">
            Consumption
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <div className="text-xs font-medium text-[var(--muted)]">Meters online</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text)] tabular-nums">
            {stats.onlineCount}/{stats.meterCount}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-[var(--muted)]">Instant load</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text)] tabular-nums">{fmtNum(stats.kwSum, 1)} kW</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-[var(--muted)]">Voltage (avg)</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text)] tabular-nums">{fmtNum(stats.vAvg, 0)} V</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-[var(--muted)]">Total energy</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text)] tabular-nums">
            {fmtNum(stats.totalEnergyKwh, 1)} kWh
          </div>
        </div>
      </div>

      {meterIds.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-[var(--text)]">Line trend</div>
            <div className="inline-flex overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
              {(['1h', '6h', '12h', '24h', '7d'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setTrendWindow(w)}
                  className={[
                    'px-3 py-2 text-xs font-medium transition',
                    trendWindow === w
                      ? 'bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))] text-[var(--primary)]'
                      : 'text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)] hover:text-[var(--text)]',
                  ].join(' ')}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            <MultiAxisTrendChart data={lineHistory} series={series} height={320} />
            <div className="mt-2 text-xs text-[var(--muted)]">
              kW is summed across meters; V/A are averages across meters.
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-4">
          <div className="text-sm text-[var(--muted)]">No meters mapped under this line yet.</div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="text-sm font-semibold text-[var(--text)]">Meters under {lineDef.name}</div>
        </div>
        <div className="p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {meterIds.map((meterId) => {
              const meter = findPlcMeter(meterId)
              const d = snap?.meters[meterId]
              return (
                <div key={meterId} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/meters/${meterId}`}
                        className="truncate text-sm font-semibold text-[var(--text)] hover:text-[var(--primary)]"
                      >
                        {meter?.name ?? meterId}
                      </Link>
                      <div className="mt-0.5 text-[11px] text-[var(--muted)]">{meter?.model ?? '—'}</div>
                    </div>
                    <Badge color={meterHasData(d) ? 'green' : 'red'}>{meterHasData(d) ? 'ON' : 'OFF'}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-[11px] text-[var(--muted)]">kW</div>
                      <div className="font-mono text-[var(--text)]">{fmtSnap(d?.Real_power ?? 0, 1)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--muted)]">V</div>
                      <div className="font-mono text-[var(--text)]">{fmtSnap(d?.Voltage_Lave ?? 0, 0)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--muted)]">A</div>
                      <div className="font-mono text-[var(--text)]">{fmtSnap(d?.Current_Ave ?? 0, 1)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="text-sm font-semibold text-[var(--text)]">Recent alerts for this line</div>
        </div>
        <div className="p-4">
          {lineAlerts.length === 0 ? (
            <div className="text-sm text-[var(--muted)]">No alerts found for these meters.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[720px] w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] text-[11px] font-medium text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Meter</th>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {lineAlerts.map((a) => (
                    <tr key={a.id}>
                      <td className="px-3 py-2 text-[var(--muted)] tabular-nums">
                        {new Date(a.ts).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <Link to={`/meters/${a.meterId}`} className="font-medium text-[var(--text)] hover:underline">
                          {a.meterName}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <Badge color={a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'yellow' : 'slate'}>
                          {a.severity.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-[var(--text)]">{a.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


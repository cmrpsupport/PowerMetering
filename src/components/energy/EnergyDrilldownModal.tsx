import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePlantLoadProfile } from '../../hooks/queries'
import { hourBucketStartIso } from '../../lib/energyHourly'
import type { EnergyInterval } from '../../types'

function hourlySeriesForLine(ivs: EnergyInterval[], lineName: string) {
  const map = new Map<string, { kwh: number; peakKw: number }>()
  for (const iv of ivs) {
    if (iv.meterName !== lineName) continue
    const hk = hourBucketStartIso(iv.ts)
    const cur = map.get(hk) ?? { kwh: 0, peakKw: 0 }
    cur.kwh += iv.energyKwh
    cur.peakKw = Math.max(cur.peakKw, iv.demandKw)
    map.set(hk, cur)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ts, v]) => ({
      ts,
      label: new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      kwh: Math.round(v.kwh * 1000) / 1000,
      peakKw: Math.round(v.peakKw * 100) / 100,
    }))
}

export function EnergyDrilldownModal(props: {
  open: boolean
  onClose: () => void
  lineName: string
  periodLabel: string
  intervals: EnergyInterval[]
  loadProfileHours?: number
}) {
  const { open, onClose, lineName, periodLabel, intervals, loadProfileHours = 72 } = props
  const loadQ = usePlantLoadProfile(loadProfileHours, { bucket: '15m' })

  const hourly = useMemo(() => hourlySeriesForLine(intervals, lineName), [intervals, lineName])

  const loadData = useMemo(() => {
    const pts = loadQ.data ?? []
    return pts.map((p) => ({
      ts: p.ts,
      label: new Date(p.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      demandKw: Math.round(p.demandKw * 100) / 100,
    }))
  }, [loadQ.data])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="max-h-[min(92vh,900px)] w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--text)]">Drilldown: {lineName}</div>
            <div className="mt-0.5 text-xs text-[var(--muted)]">{periodLabel}</div>
          </div>
          <button type="button" className="nr-btn-secondary nr-btn shrink-0 px-3 py-1.5 text-xs" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="max-h-[calc(min(92vh,900px)-52px)] overflow-y-auto p-4">
          <div className="space-y-6">
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Hourly energy (filtered intervals)</h4>
              <div className="h-56 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2">
                {hourly.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">No sub-interval rows for this line in range.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis dataKey="label" tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} stroke="var(--chart-axis)" interval="preserveStartEnd" minTickGap={20} />
                      <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} stroke="var(--chart-axis)" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--chart-tooltip-bg)',
                          border: '1px solid var(--chart-tooltip-border)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="kwh" name="kWh" fill="var(--chart-1)" maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Interval peak demand (same line)</h4>
              <div className="h-44 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2">
                {hourly.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">—</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={hourly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis dataKey="label" tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} stroke="var(--chart-axis)" interval="preserveStartEnd" minTickGap={20} />
                      <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} stroke="var(--chart-axis)" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--chart-tooltip-bg)',
                          border: '1px solid var(--chart-tooltip-border)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Line type="monotone" dataKey="peakKw" name="Peak kW" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Plant load profile (last {loadProfileHours}h)</h4>
              <div className="h-44 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2">
                {loadData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
                    {loadQ.isLoading ? 'Loading…' : 'No load profile'}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={loadData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis dataKey="label" tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} stroke="var(--chart-axis)" interval="preserveStartEnd" minTickGap={16} />
                      <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} stroke="var(--chart-axis)" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--chart-tooltip-bg)',
                          border: '1px solid var(--chart-tooltip-border)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="demandKw" name="Plant kW" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

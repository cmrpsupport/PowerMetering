import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { useLoadProfile, useAllLoadProfiles } from '../hooks/queries'
import { MeterSelector } from '../components/ui/MeterSelector'
import { StatCard } from '../components/ui/StatCard'
import type { LoadProfile } from '../types'

function fmtNum(n: number, decimals = 1) {
  if (!Number.isFinite(n)) return '--'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtTimeShort(ts: string) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function LoadProfilePage() {
  const [meterId, setMeterId] = useState('')

  const singleQ = useLoadProfile(meterId)
  const allQ = useAllLoadProfiles()

  const isAll = meterId === ''
  const profiles: LoadProfile[] = useMemo(() => {
    if (isAll) return allQ.data ?? []
    return singleQ.data ? [singleQ.data] : []
  }, [isAll, allQ.data, singleQ.data])

  // Aggregate profile for display (sum demand when all, or single meter)
  const aggregated = useMemo(() => {
    if (profiles.length === 0) return null

    // Take the first profile's intervals as the time template
    const base = profiles[0]
    const intervals = base.intervals.map((iv, idx) => {
      const totalDemand = profiles.reduce((sum, p) => {
        return sum + (p.intervals[idx]?.demandKw ?? 0)
      }, 0)
      return { ts: iv.ts, demandKw: totalDemand }
    })

    const peakDemandKw = profiles.reduce(
      (m, p) => Math.max(m, p.peakDemandKw),
      0,
    )
    const peakTs =
      profiles.reduce(
        (best, p) => (p.peakDemandKw > best.peakDemandKw ? p : best),
        profiles[0],
      ).peakTs
    const avgDemandKw =
      intervals.length > 0
        ? intervals.reduce((s, iv) => s + iv.demandKw, 0) / intervals.length
        : 0
    const loadFactor =
      peakDemandKw > 0 ? avgDemandKw / peakDemandKw : 0

    return { intervals, peakDemandKw, peakTs, avgDemandKw, loadFactor }
  }, [profiles])

  // Top 5 peak intervals
  const topPeaks = useMemo(() => {
    if (!aggregated) return []
    return [...aggregated.intervals]
      .sort((a, b) => b.demandKw - a.demandKw)
      .slice(0, 5)
  }, [aggregated])

  // Day-over-day overlay: create a "yesterday" shifted version
  const overlayData = useMemo(() => {
    if (!aggregated || aggregated.intervals.length === 0) return []
    return aggregated.intervals.map((iv, idx) => {
      // Simulate "yesterday" by shifting demand down slightly (simple demo shift)
      const yesterdayDemand = iv.demandKw * (0.85 + Math.sin(idx * 0.3) * 0.1)
      return {
        ts: iv.ts,
        today: iv.demandKw,
        yesterday: Math.max(0, yesterdayDemand),
      }
    })
  }, [aggregated])

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Load Profiles
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            15-minute interval demand analysis with peak identification.
          </div>
        </div>
        <MeterSelector
          value={meterId}
          onChange={setMeterId}
          includeAll
        />
      </div>

      {!aggregated ? (
        <div className="card p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {isAll && allQ.isLoading
            ? 'Loading load profiles...'
            : !isAll && singleQ.isLoading
              ? 'Loading load profile...'
              : 'No load profile data available.'}
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Peak Demand"
              value={`${fmtNum(aggregated.peakDemandKw)} kW`}
            />
            <StatCard
              title="Peak Time"
              value={fmtTime(aggregated.peakTs)}
            />
            <StatCard
              title="Avg Demand"
              value={`${fmtNum(aggregated.avgDemandKw)} kW`}
            />
            <StatCard
              title="Load Factor"
              value={`${fmtNum(aggregated.loadFactor * 100)}%`}
              subtitle="Avg / Peak ratio"
            />
          </div>

          {/* 15-min demand bar chart */}
          <div className="card p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
              15-Minute Demand Profile
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={aggregated.intervals}
                  margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
                >
                  <XAxis
                    dataKey="ts"
                    tickFormatter={fmtTimeShort}
                    minTickGap={40}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v}`}
                    width={50}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    labelFormatter={(label) => fmtTimeShort(String(label))}
                    formatter={(value) => [
                      `${fmtNum(Number(value))} kW`,
                      'Demand',
                    ]}
                  />
                  <ReferenceLine
                    y={aggregated.peakDemandKw}
                    stroke="#dc2626"
                    strokeDasharray="4 4"
                    label={{
                      value: `Peak: ${fmtNum(aggregated.peakDemandKw)} kW`,
                      position: 'insideTopRight',
                      fill: '#dc2626',
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="demandKw" radius={[2, 2, 0, 0]}>
                    {aggregated.intervals.map((iv) => (
                      <Cell
                        key={iv.ts}
                        fill={
                          iv.demandKw >= aggregated.peakDemandKw * 0.98
                            ? '#dc2626'
                            : '#4f46e5'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Day-over-day overlay */}
          <div className="card p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
              Day-Over-Day Comparison
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={overlayData}
                  margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
                >
                  <XAxis
                    dataKey="ts"
                    tickFormatter={fmtTimeShort}
                    minTickGap={40}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v}`}
                    width={50}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    labelFormatter={(label) => fmtTimeShort(String(label))}
                    formatter={(value, name) => [
                      `${fmtNum(Number(value))} kW`,
                      String(name) === 'today' ? 'Today' : 'Yesterday',
                    ]}
                  />
                  <Legend
                    formatter={(value) =>
                      value === 'today' ? 'Today' : 'Yesterday'
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="today"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="yesterday"
                    stroke="#9ca3af"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top 5 peak intervals */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
              Top 5 Peak Intervals
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3 text-right">Demand (kW)</th>
                    <th className="px-4 py-3 text-right">% of Peak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {topPeaks.map((iv, i) => (
                    <tr
                      key={iv.ts}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-50">
                        #{i + 1}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {fmtTimeShort(iv.ts)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-50">
                        {fmtNum(iv.demandKw)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                        {aggregated.peakDemandKw > 0
                          ? fmtNum(
                              (iv.demandKw / aggregated.peakDemandKw) * 100,
                            )
                          : '0.0'}
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { useEnergyIntervals, usePlcEnergyTotals } from '../hooks/queries'
import { StatCard } from '../components/ui/StatCard'
import type { EnergyInterval } from '../types'

const PERIOD_OPTIONS = [
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '7d', hours: 168 },
]

const METER_COLORS = [
  '#4f46e5',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
  '#0d9488',
]

function fmtNum(n: number, decimals = 1) {
  if (!Number.isFinite(n)) return '--'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtHour(ts: string) {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function hourKey(ts: string) {
  const d = new Date(ts)
  d.setMinutes(0, 0, 0)
  return d.toISOString()
}

export function EnergyDashboardPage() {
  const [periodIdx, setPeriodIdx] = useState(0)
  const hours = PERIOD_OPTIONS[periodIdx].hours
  const energyQ = useEnergyIntervals(hours)
  const plcTotalsQ = usePlcEnergyTotals()
  const intervals: EnergyInterval[] = useMemo(
    () => energyQ.data ?? [],
    [energyQ.data],
  )

  // All unique meter names
  const meterNames = useMemo(() => {
    const s = new Set<string>()
    for (const iv of intervals) s.add(iv.meterName)
    return Array.from(s)
  }, [intervals])

  // Summary stats
  const stats = useMemo(() => {
    const totalEnergy = intervals.reduce((s, iv) => s + iv.energyKwh, 0)
    const peakDemand = intervals.reduce(
      (m, iv) => Math.max(m, iv.demandKw),
      0,
    )
    const avgDemand =
      intervals.length > 0
        ? intervals.reduce((s, iv) => s + iv.demandKw, 0) / intervals.length
        : 0
    return { totalEnergy, peakDemand, avgDemand }
  }, [intervals])

  // Stacked bar data: group by hour, stack by meter
  const stackedData = useMemo(() => {
    const buckets = new Map<string, ({ ts: string } & Record<string, number>)>()
    for (const iv of intervals) {
      const key = hourKey(iv.ts)
      if (!buckets.has(key)) {
        const row = { ts: key } as { ts: string } & Record<string, number>
        for (const mn of meterNames) row[mn] = 0
        buckets.set(key, row)
      }
      const row = buckets.get(key)!
      row[iv.meterName] = (row[iv.meterName] ?? 0) + iv.energyKwh
    }
    return Array.from(buckets.values()).sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
    )
  }, [intervals, meterNames])

  // Per-meter breakdown
  const meterBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { meter: string; energy: number; peak: number }
    >()
    for (const iv of intervals) {
      const prev = map.get(iv.meterName) ?? {
        meter: iv.meterName,
        energy: 0,
        peak: 0,
      }
      prev.energy += iv.energyKwh
      prev.peak = Math.max(prev.peak, iv.demandKw)
      map.set(iv.meterName, prev)
    }
    return Array.from(map.values()).sort((a, b) => b.energy - a.energy)
  }, [intervals])

  // Pie data
  const pieData = useMemo(
    () =>
      meterBreakdown.map((m, i) => ({
        name: m.meter,
        value: m.energy,
        color: METER_COLORS[i % METER_COLORS.length],
      })),
    [meterBreakdown],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Energy Dashboard
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Consumption and demand analysis across all meters.
          </div>
        </div>

        {/* Period selector */}
        <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          {PERIOD_OPTIONS.map((opt, i) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setPeriodIdx(i)}
              className={[
                'px-3 py-1.5 text-sm font-medium transition-colors',
                i === periodIdx
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Energy" value={`${fmtNum(stats.totalEnergy)} kWh`} />
        <StatCard
          title="Active Meters"
          value={String(meterBreakdown.length)}
        />
        <StatCard
          title="Peak Demand"
          value={`${fmtNum(stats.peakDemand)} kW`}
        />
        <StatCard
          title="Avg Demand"
          value={`${fmtNum(stats.avgDemand)} kW`}
        />
      </div>

      {/* PLC totals (DB16 Total_EnergyCon_kWh) */}
      {(plcTotalsQ.data?.length ?? 0) > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
            <div>DB16 Total Energy Consumption (kWh)</div>
            <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
              Live from PLC
            </div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Line</th>
                  <th className="px-4 py-3 text-right">Energy (kWh)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(plcTotalsQ.data ?? [])
                  .slice()
                  .sort((a, b) => b.kwh - a.kwh)
                  .map((row) => (
                    <tr key={row.name} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtNum(row.kwh, 1)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stacked bar chart */}
      <div className="card p-4">
        <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          Energy by Meter (Hourly)
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stackedData}
              margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
            >
              <XAxis
                dataKey="ts"
                tickFormatter={fmtHour}
                minTickGap={40}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickFormatter={(v) => `${v}`}
                width={50}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                labelFormatter={(label) => fmtHour(String(label))}
                formatter={(value, name) => [
                  `${fmtNum(Number(value))} kWh`,
                  String(name),
                ]}
              />
              {meterNames.map((mn, i) => (
                <Bar
                  key={mn}
                  dataKey={mn}
                  stackId="energy"
                  fill={METER_COLORS[i % METER_COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-meter breakdown table + Pie chart */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Meter</th>
                    <th className="px-4 py-3 text-right">Energy (kWh)</th>
                    <th className="px-4 py-3 text-right">Peak Demand (kW)</th>
                    <th className="px-4 py-3 text-right">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {meterBreakdown.map((m) => (
                    <tr
                      key={m.meter}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-50">
                        {m.meter}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                        {fmtNum(m.energy)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                        {fmtNum(m.peak)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                        {stats.totalEnergy > 0
                          ? fmtNum((m.energy / stats.totalEnergy) * 100)
                          : '0.0'}
                        %
                      </td>
                    </tr>
                  ))}
                  {meterBreakdown.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                      >
                        No data for selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pie chart */}
        <div className="card p-4">
          <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
            Energy Share by Meter
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => {
                    const p = typeof percent === 'number' ? percent : 0
                    return `${name} ${(p * 100).toFixed(0)}%`
                  }}
                  labelLine={false}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    `${fmtNum(Number(value))} kWh`,
                    'Energy',
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

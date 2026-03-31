import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useEnergyIntervals, useCostRates } from '../hooks/queries'
import { StatCard } from '../components/ui/StatCard'
import type { EnergyInterval, CostRate } from '../types'

const TIER_COLORS: Record<string, string> = {
  'on-peak': '#dc2626',
  'mid-peak': '#d97706',
  'off-peak': '#059669',
}

function fmtNum(n: number, decimals = 2) {
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

export function CostAnalysisPage() {
  const energyQ = useEnergyIntervals(24)
  const ratesQ = useCostRates()

  const intervals: EnergyInterval[] = useMemo(
    () => energyQ.data ?? [],
    [energyQ.data],
  )
  const rates: CostRate[] = useMemo(() => ratesQ.data ?? [], [ratesQ.data])

  // Cost rate tier cards
  const tierCards = useMemo(() => {
    const tiers: CostRate['tier'][] = ['on-peak', 'mid-peak', 'off-peak']
    return tiers.map((tier) => {
      const rate = rates.find((r) => r.tier === tier)
      return {
        tier,
        name: rate?.name ?? tier,
        ratePerKwh: rate?.ratePerKwh ?? 0,
        demandCharge: rate?.demandChargePerKw ?? 0,
        startHour: rate?.startHour ?? 0,
        endHour: rate?.endHour ?? 0,
        color: rate?.color ?? TIER_COLORS[tier],
      }
    })
  }, [rates])

  // All unique tiers present in data
  const tierNames = useMemo(() => {
    const s = new Set<string>()
    for (const iv of intervals) s.add(iv.rateTier)
    return Array.from(s)
  }, [intervals])

  // Cost trend: stacked area by tier over hourly buckets
  const costTrend = useMemo(() => {
    const buckets = new Map<string, ({ ts: string } & Record<string, number>)>()
    for (const iv of intervals) {
      const key = hourKey(iv.ts)
      if (!buckets.has(key)) {
        const row = { ts: key } as { ts: string } & Record<string, number>
        for (const tn of tierNames) row[tn] = 0
        buckets.set(key, row)
      }
      const row = buckets.get(key)!
      row[iv.rateTier] = (row[iv.rateTier] ?? 0) + iv.costDollars
    }
    return Array.from(buckets.values()).sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
    )
  }, [intervals, tierNames])

  // Cost allocation by meter and tier
  const costAllocation = useMemo(() => {
    const map = new Map<
      string,
      { meter: string } & Record<string, number>
    >()
    for (const iv of intervals) {
      if (!map.has(iv.meterName)) {
        const row = { meter: iv.meterName, total: 0 } as { meter: string; total: number } & Record<string, number>
        for (const tn of tierNames) row[tn] = 0
        map.set(iv.meterName, row)
      }
      const row = map.get(iv.meterName)!
      row[iv.rateTier] = (row[iv.rateTier] ?? 0) + iv.costDollars
      row.total += iv.costDollars
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [intervals, tierNames])

  // Demand charge: peak demand per meter
  const meterNames = useMemo(() => {
    const s = new Set<string>()
    for (const iv of intervals) s.add(iv.meterName)
    return Array.from(s)
  }, [intervals])

  const demandData = useMemo(() => {
    return meterNames.map((mn) => {
      const meterIntervals = intervals.filter((iv) => iv.meterName === mn)
      const peak = meterIntervals.reduce(
        (m, iv) => Math.max(m, iv.demandKw),
        0,
      )
      // Use the highest demand charge rate available
      const maxDemandRate = rates.reduce(
        (m, r) => Math.max(m, r.demandChargePerKw),
        0,
      )
      return {
        meter: mn,
        peakDemand: peak,
        demandCharge: peak * maxDemandRate,
      }
    })
  }, [meterNames, intervals, rates])

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Cost Analysis
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Rate tiers, cost trends, and demand charges for the last 24 hours.
        </div>
      </div>

      {/* Rate tier cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {tierCards.map((tc) => (
          <StatCard
            key={tc.tier}
            title={tc.name}
            value={`$${fmtNum(tc.ratePerKwh, 4)}/kWh`}
            subtitle={
              <span>
                Demand: ${fmtNum(tc.demandCharge, 2)}/kW &middot;{' '}
                {tc.startHour}:00&ndash;{tc.endHour}:00
              </span>
            }
            right={
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: tc.color }}
              />
            }
          />
        ))}
      </div>

      {/* Cost trend stacked area */}
      <div className="card p-4">
        <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          Cost Trend by Tier
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={costTrend}
              margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
            >
              <XAxis
                dataKey="ts"
                tickFormatter={fmtHour}
                minTickGap={40}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickFormatter={(v) => `$${v}`}
                width={55}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                labelFormatter={(label) => fmtHour(String(label))}
                formatter={(value, name) => [`$${fmtNum(Number(value))}`, String(name)]}
              />
              <Legend />
              {tierNames.map((tn) => (
                <Area
                  key={tn}
                  type="monotone"
                  dataKey={tn}
                  stackId="cost"
                  stroke={TIER_COLORS[tn] ?? '#6b7280'}
                  fill={TIER_COLORS[tn] ?? '#6b7280'}
                  fillOpacity={0.3}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost allocation table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          Cost Allocation by Meter
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Meter</th>
                {tierNames.map((tn) => (
                  <th key={tn} className="px-4 py-3 text-right">
                    {tn}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {costAllocation.map((row) => (
                <tr
                  key={row.meter}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-50">
                    {row.meter}
                  </td>
                  {tierNames.map((tn) => (
                    <td
                      key={tn}
                      className="px-4 py-3 text-right text-slate-700 dark:text-slate-200"
                    >
                      ${fmtNum(row[tn] ?? 0)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-50">
                    ${fmtNum(row.total)}
                  </td>
                </tr>
              ))}
              {costAllocation.length === 0 && (
                <tr>
                  <td
                    colSpan={tierNames.length + 2}
                    className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                  >
                    No cost data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demand charge bar chart */}
      <div className="card p-4">
        <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          Peak Demand &amp; Demand Charges by Meter
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={demandData}
              margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
            >
              <XAxis dataKey="meter" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="kw"
                tickFormatter={(v) => `${v} kW`}
                width={60}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                yAxisId="cost"
                orientation="right"
                tickFormatter={(v) => `$${v}`}
                width={55}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value, name) => {
                  const n = String(name)
                  if (n === 'Peak Demand') return [`${fmtNum(Number(value), 1)} kW`, n]
                  return [`$${fmtNum(Number(value))}`, n]
                }}
              />
              <Legend />
              <Bar
                yAxisId="kw"
                dataKey="peakDemand"
                name="Peak Demand"
                fill="#4f46e5"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="cost"
                dataKey="demandCharge"
                name="Demand Charge"
                fill="#d97706"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

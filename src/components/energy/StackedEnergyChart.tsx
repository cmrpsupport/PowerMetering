import { useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ConsumptionGranularity } from '../../types'
import type { ConsumptionReportBucket } from '../../lib/consumptionReport'

type Row = Record<string, string | number> & {
  label: string
  fullLabel: string
  totalKwh: number
  peakKw: number
}

export function StackedEnergyChart(props: {
  buckets: ConsumptionReportBucket[]
  meterNames: string[]
  lineColors: string[]
  height?: number
  /** Used for tick density + remount when switching step (avoids Recharts brush/tick cache bugs). */
  granularity?: ConsumptionGranularity
}) {
  const { buckets, meterNames, lineColors, height = 420, granularity = 'daily' } = props
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(meterNames.map((m) => [m, true])),
  )

  const data: Row[] = useMemo(() => {
    return buckets.map((b) => {
      const row: Row = {
        label: b.label.length > 20 ? `${b.label.slice(0, 18)}…` : b.label,
        fullLabel: b.label,
        totalKwh: Math.round(b.totalEnergyKwh * 1000) / 1000,
        peakKw: Math.round(b.peakDemandKw * 100) / 100,
      }
      for (const m of meterNames) {
        row[m] = Math.round((b.byMeter[m]?.energyKwh ?? 0) * 1000) / 1000
      }
      return row
    })
  }, [buckets, meterNames])

  const activeNames = useMemo(() => meterNames.filter((m) => visible[m] !== false), [meterNames, visible])

  /**
   * Recharts: `interval` is a tick skip (0 = all, 1 = every other, n = sparser).
   * Hourly can have ~72 points — show a readable subset without "blank" axis.
   */
  const xAxisInterval = useMemo(() => {
    if (data.length <= 1) return 0
    if (granularity === 'hourly') return 3
    if (data.length > 40) return 1
    return 0
  }, [data.length, granularity])

  const bottomMargin = granularity === 'hourly' ? 52 : 16

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex flex-wrap gap-2">
        {meterNames.map((m, i) => (
          <label
            key={m}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px]"
          >
            <input
              type="checkbox"
              className="rounded border-[var(--border)]"
              checked={visible[m] !== false}
              onChange={() => setVisible((v) => ({ ...v, [m]: !v[m] }))}
            />
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: lineColors[i % lineColors.length] }} />
              <span className="max-w-[140px] truncate text-[var(--text)]">{m}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="min-h-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 sm:p-3">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            key={`${granularity}-${data.length}-${meterNames.join('|')}`}
            data={data}
            margin={{ top: 8, right: 16, left: 4, bottom: bottomMargin }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--chart-axis)', fontSize: granularity === 'hourly' ? 9 : 11 }}
              stroke="var(--chart-axis)"
              interval={xAxisInterval}
              angle={granularity === 'hourly' ? -35 : 0}
              textAnchor={granularity === 'hourly' ? 'end' : 'middle'}
              height={granularity === 'hourly' ? 48 : undefined}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
              stroke="var(--chart-axis)"
              label={{ value: 'kWh', angle: -90, position: 'insideLeft', fill: 'var(--muted)', fontSize: 10 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
              stroke="var(--chart-axis)"
              label={{ value: 'kW', angle: 90, position: 'insideRight', fill: 'var(--muted)', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--chart-tooltip-bg)',
                border: '1px solid var(--chart-tooltip-border)',
                borderRadius: 8,
                color: 'var(--chart-tooltip-text)',
                fontSize: 12,
              }}
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload as Row | undefined
                return p?.fullLabel ?? p?.label ?? ''
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }} />
            {activeNames.map((m) => {
              const i = meterNames.indexOf(m)
              return (
                <Bar
                  key={m}
                  yAxisId="left"
                  dataKey={m}
                  stackId="e"
                  fill={lineColors[i % lineColors.length]}
                  name={m}
                  maxBarSize={56}
                />
              )
            })}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="totalKwh"
              name="Total kWh"
              stroke="#e2e8f0"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="peakKw"
              name="Peak kW (bucket)"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-2 px-1 text-[10px] text-[var(--muted)]">
          Stacked bars = period kWh by line. White line = total kWh; orange = interval peak demand. Use table below for exact values when many hours are shown.
        </p>
      </div>
    </div>
  )
}

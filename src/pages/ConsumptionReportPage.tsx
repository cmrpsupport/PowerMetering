import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Download, TrendingUp, Zap } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { EnergyDrilldownModal } from '../components/energy/EnergyDrilldownModal'
import { EnergyEmptyState } from '../components/energy/EnergyEmptyState'
import { EnergyInsightPanel } from '../components/energy/EnergyInsightPanel'
import { EnergySummaryBar, type SummaryTone } from '../components/energy/EnergySummaryBar'
import { StackedEnergyChart } from '../components/energy/StackedEnergyChart'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { PLC_PRODUCTION_METERS } from '../constants/plcProductionMeters'
import { useConsumptionReportIntervals, useDemandStatus, usePlcFullSnapshot } from '../hooks/queries'
import { classifyEnergyCell, type CellAnomaly } from '../lib/energyAnomalies'
import {
  aggregateConsumptionIntervals,
  consumptionReportToCsv,
  CONSUMPTION_REPORT_HOURS,
  type ConsumptionReportBucket,
} from '../lib/consumptionReport'
import {
  buildEnergyInsights,
  computePeriodComparisons,
  findGlobalPeakDemand,
  intervalsForBucket,
} from '../lib/energyInsights'
import type { PlcMeterData } from '../types'
import type { ConsumptionGranularity, EnergyInterval } from '../types'

const GRANULARITY_OPTIONS: { id: ConsumptionGranularity; label: string; hint: string }[] = [
  { id: 'hourly', label: 'Hourly', hint: '' },
  { id: 'daily', label: 'Daily', hint: '' },
  { id: 'weekly', label: 'Weekly', hint: '' },
  { id: 'monthly', label: 'Monthly', hint: '' },
]

const LINE_ORDER = [
  'Cracker Line 1',
  'Cracker Line 2',
  'Pretzel Line',
  'Wafer Line 1',
  'Wafer Line 2',
  'Chooey Choco Line',
  'Dynamite Line',
  'XO Line',
  'Maxx Line',
  'Main Line',
  'Utilities Jaguar',
  'Utilities Lighting',
]

const LINE_COLORS = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#7c3aed',
  '#0ea5e9',
  '#db2777',
  '#ef4444',
  '#14b8a6',
  '#a16207',
  '#4f46e5',
  '#22c55e',
  '#eab308',
]

type DataMode = 'consumption' | 'meterReading'
type RowSort = 'time-asc' | 'time-desc' | 'total-desc' | 'total-asc'

function fmtNum(n: number, decimals = 1) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtSnap(n: number, decimals = 1): string {
  if (!Number.isFinite(n) || n === 0) return '\u2014'
  return n.toFixed(decimals)
}

function meterHasData(data: PlcMeterData | undefined): boolean {
  if (!data) return false
  return data.Real_power !== 0 || data.Voltage_Lave !== 0 || data.Current_Ave !== 0
}

function rankLinesForRow(b: ConsumptionReportBucket, meterNames: string[]): Map<string, number> {
  const scores = meterNames.map((m) => ({ m, v: b.byMeter[m]?.energyKwh ?? 0 }))
  scores.sort((a, b) => b.v - a.v)
  const map = new Map<string, number>()
  scores.forEach((s, i) => map.set(s.m, i + 1))
  return map
}

function activeLineCount(b: ConsumptionReportBucket, meterNames: string[]): number {
  return meterNames.filter((m) => (b.byMeter[m]?.energyKwh ?? 0) > 1e-6).length
}

function deriveSummaryTone(vsPrev: number | null, vsWeek: number | null, demandPct: number | null): SummaryTone {
  if (demandPct !== null && demandPct >= 100) return 'critical'
  if (vsPrev !== null && vsPrev > 25) return 'critical'
  if (demandPct !== null && demandPct >= 85) return 'warning'
  if (vsPrev !== null && vsPrev > 12) return 'warning'
  if (vsWeek !== null && vsWeek > 12) return 'warning'
  return 'normal'
}

function sortBuckets(rows: ConsumptionReportBucket[], sort: RowSort): ConsumptionReportBucket[] {
  const arr = [...rows]
  if (sort === 'time-asc') return arr.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  if (sort === 'time-desc') return arr.sort((a, b) => b.sortKey.localeCompare(a.sortKey))
  if (sort === 'total-desc') return arr.sort((a, b) => b.totalEnergyKwh - a.totalEnergyKwh)
  return arr.sort((a, b) => a.totalEnergyKwh - b.totalEnergyKwh)
}

function AnomalyIcon({ a }: { a: CellAnomaly }) {
  if (a.icon === 'zero') return <AlertTriangle size={14} className="inline text-amber-400" aria-hidden />
  if (a.icon === 'spike') return <TrendingUp size={14} className="inline text-[var(--text)]" aria-hidden />
  if (a.icon === 'flat') return <Zap size={14} className="inline text-amber-400" aria-hidden />
  return null
}

function cellClass(a: CellAnomaly, topBold: boolean): string {
  if (a.highlight === 'critical') return 'bg-[color-mix(in_srgb,var(--danger)_18%,transparent)]'
  if (a.highlight === 'warn') return 'bg-[color-mix(in_srgb,var(--warning)_14%,transparent)]'
  if (a.highlight === 'zero') return 'bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]'
  if (a.highlight === 'top' || topBold) return 'font-semibold text-[var(--text)]'
  return ''
}

export function ConsumptionReportPage() {
  const [granularity, setGranularity] = useState<ConsumptionGranularity>('daily')
  const [dataMode, setDataMode] = useState<DataMode>('consumption')
  const [rowSort, setRowSort] = useState<RowSort>('time-desc')
  const [drilldown, setDrilldown] = useState<{ bucketKey: string; lineName: string; periodLabel: string } | null>(null)

  const q = useConsumptionReportIntervals(granularity)
  const snapQ = usePlcFullSnapshot()
  const snap = snapQ.data
  const demandQ = useDemandStatus('24h')
  const queryClient = useQueryClient()
  const granRef = useRef<HTMLDivElement>(null)

  const rawIntervals: EnergyInterval[] = q.data ?? []

  const buckets = useMemo(() => {
    const intervals = q.data ?? []
    return aggregateConsumptionIntervals(intervals, granularity)
  }, [q.data, granularity])

  const sortedBuckets = useMemo(() => sortBuckets(buckets, rowSort), [buckets, rowSort])

  const totals = useMemo(() => {
    const te = buckets.reduce((s, b) => s + b.totalEnergyKwh, 0)
    const pk = buckets.reduce((m, b) => Math.max(m, b.peakDemandKw), 0)
    return { totalEnergyKwh: te, peakDemandKw: pk }
  }, [buckets])

  const globalPeak = useMemo(() => findGlobalPeakDemand(rawIntervals), [rawIntervals])

  const meterNames = useMemo(() => {
    const s = new Set<string>()
    for (const b of buckets) {
      for (const m of Object.keys(b.byMeter)) s.add(m)
    }
    const raw = Array.from(s)
    return raw.sort((a, b) => {
      const ia = LINE_ORDER.indexOf(a)
      const ib = LINE_ORDER.indexOf(b)
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
  }, [buckets])

  const insights = useMemo(
    () => buildEnergyInsights(buckets, meterNames, granularity),
    [buckets, meterNames, granularity],
  )

  const periodCmp = useMemo(() => computePeriodComparisons(buckets, granularity), [buckets, granularity])

  const demandPct = demandQ.data?.pctOfThreshold ?? null
  const contractKw = demandQ.data?.thresholdKw ?? 0

  const summaryTone = useMemo(
    () => deriveSummaryTone(periodCmp.vsPrevPct, periodCmp.vsWeekAvgPct, demandPct),
    [periodCmp.vsPrevPct, periodCmp.vsWeekAvgPct, demandPct],
  )

  const drilldownIntervals = useMemo(() => {
    if (!drilldown) return []
    return intervalsForBucket(rawIntervals, drilldown.bucketKey, granularity).filter((iv) => iv.meterName === drilldown.lineName)
  }, [drilldown, rawIntervals, granularity])

  const onDownloadCsv = () => {
    const csv = consumptionReportToCsv(buckets, granularity)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `consumption-${granularity}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onDownloadTableCsv = () => {
    const header = ['Period', ...meterNames.map((m) => `${m} (${dataMode === 'consumption' ? 'kWh' : 'CUM kWh'})`), 'Total']
    const lines = [header.join(',')]
    for (const b of sortedBuckets) {
      const cells = meterNames.map((m) => {
        if (dataMode === 'consumption') return String(Math.round((b.byMeter[m]?.energyKwh ?? 0) * 1000) / 1000)
        const c = b.byMeter[m]?.cumulativeKwhEnd
        return c !== null && c !== undefined ? String(Math.round(c * 1000) / 1000) : ''
      })
      const total =
        dataMode === 'consumption'
          ? meterNames.reduce((s, m) => s + (b.byMeter[m]?.energyKwh ?? 0), 0)
          : meterNames.reduce((s, m) => s + (b.byMeter[m]?.cumulativeKwhEnd ?? 0), 0)
      lines.push([`"${b.label}"`, ...cells, String(Math.round(total * 1000) / 1000)].join(','))
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `energy-table-${dataMode}-${granularity}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const empty = !q.isLoading && buckets.length === 0

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pb-8">
      <header className="flex min-w-0 flex-col gap-2 border-b border-[var(--border)] pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text)]">Total energy consumption</h1>
          <p className="mt-1 max-w-2xl text-xs text-[var(--muted)]">
            Operational view: where energy goes, whether it is normal, and what to check next — without mixing period kWh and
            cumulative register reads in the same table.
          </p>
        </div>
      </header>

      {q.isLoading ? (
        <div className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_10%,var(--card))]" />
      ) : empty ? null : (
        <EnergySummaryBar
          totalKwh={totals.totalEnergyKwh}
          vsPrevPct={periodCmp.vsPrevPct}
          vsWeekAvgPct={periodCmp.vsWeekAvgPct}
          peakDemandKw={globalPeak?.demandKw ?? totals.peakDemandKw}
          peakTs={globalPeak?.ts ?? null}
          peakLine={globalPeak?.meterName ?? null}
          contractKw={contractKw}
          demandPct={demandPct}
          tone={summaryTone}
        />
      )}

      <div ref={granRef} className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-[var(--muted)]">Time step</span>
          <div className="inline-flex flex-wrap overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-sm">
            {GRANULARITY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGranularity(opt.id)}
                className={[
                  'px-3 py-2 text-left text-xs font-medium transition',
                  granularity === opt.id
                    ? 'bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))] text-[var(--primary)]'
                    : 'text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <SegmentedControl<DataMode>
            value={dataMode}
            onChange={setDataMode}
            options={[
              { id: 'consumption', label: 'Consumption' },
              { id: 'meterReading', label: 'Meter reading' },
            ]}
          />
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDownloadTableCsv}
              disabled={buckets.length === 0 || q.isLoading}
              className="nr-btn-secondary nr-btn inline-flex items-center gap-2 px-3 py-2 text-xs font-medium disabled:opacity-50"
            >
              <Download size={14} aria-hidden />
              Export table (Excel‑friendly CSV)
            </button>
            <button
              type="button"
              onClick={onDownloadCsv}
              disabled={buckets.length === 0 || q.isLoading}
              className="nr-btn-secondary nr-btn inline-flex items-center gap-2 px-3 py-2 text-xs font-medium disabled:opacity-50"
            >
              <Download size={14} aria-hidden />
              Raw intervals CSV
            </button>
          </div>
        </div>
      </div>

      {!empty && !q.isLoading ? <EnergyInsightPanel title={insights.title} bullets={insights.bullets} recommendations={insights.recommendations} /> : null}

      {q.isLoading ? (
        <div className="h-[min(440px,50vh)] min-h-[280px] animate-pulse rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_10%,var(--card))]" />
      ) : empty ? (
        <EnergyEmptyState
          onChangeDate={() => granRef.current?.scrollIntoView({ behavior: 'smooth' })}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['energyIntervals', 'consumption'] })}
        />
      ) : (
        <StackedEnergyChart
          buckets={buckets}
          meterNames={meterNames}
          lineColors={LINE_COLORS}
          height={440}
          granularity={granularity}
        />
      )}

      {q.isError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          Failed to load intervals: {(q.error as Error)?.message ?? 'Unknown error'}
        </div>
      ) : null}

      {!empty && !q.isLoading ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--text)]">
              {dataMode === 'consumption' ? 'Period consumption (kWh)' : 'Cumulative meter totals (kWh)'}
            </h2>
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              Sort rows
              <select
                className="nr-input rounded-lg px-2 py-1.5 text-xs"
                value={rowSort}
                onChange={(e) => setRowSort(e.target.value as RowSort)}
              >
                <option value="time-desc">Newest first</option>
                <option value="time-asc">Oldest first</option>
                <option value="total-desc">Total kWh high → low</option>
                <option value="total-asc">Total kWh low → high</option>
              </select>
            </label>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
            <div className="max-h-[min(70vh,620px)] overflow-auto">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--card)] shadow-sm">
                  <tr className="text-[11px] text-[var(--muted)]">
                    <th className="sticky left-0 z-30 min-w-[140px] border-b border-[var(--border)] bg-[var(--card)] px-3 py-3 text-left font-medium">
                      Period
                    </th>
                    {meterNames.map((m, i) => (
                      <th
                        key={m}
                        className="min-w-[100px] border-b border-l border-[var(--border)] px-2 py-3 text-right font-medium text-[var(--text)]"
                        style={{ borderLeftColor: LINE_COLORS[i % LINE_COLORS.length] }}
                      >
                        <span className="line-clamp-2">{m}</span>
                        <span className="mt-0.5 block text-[10px] font-normal text-[var(--muted)]">
                          {dataMode === 'consumption' ? 'kWh' : 'CUM'}
                        </span>
                      </th>
                    ))}
                    <th className="sticky right-0 z-30 min-w-[100px] border-b border-l border-[var(--border)] bg-[var(--card)] px-3 py-3 text-right font-semibold text-[var(--text)]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBuckets.map((b, idx) => {
                    const bi = buckets.findIndex((x) => x.key === b.key)
                    const prevBucket = bi > 0 ? buckets[bi - 1]! : null
                    const prevPrevBucket = bi > 1 ? buckets[bi - 2]! : null
                    const ranks = rankLinesForRow(b, meterNames)
                    const activeN = activeLineCount(b, meterNames)

                    return (
                      <tr
                        key={b.key}
                        className={idx % 2 === 0 ? 'bg-[var(--card)]' : 'bg-[color-mix(in_srgb,var(--text)_2.5%,var(--card))]'}
                      >
                        <td className="sticky left-0 z-10 border-b border-[var(--border)] bg-[inherit] px-3 py-2.5 shadow-[1px_0_0_var(--border)]">
                          <div className="max-w-[200px] font-medium leading-snug text-[var(--text)]">{b.label}</div>
                        </td>
                        {meterNames.map((m, i) => {
                          const cell = b.byMeter[m]
                          const periodKwh = cell?.energyKwh ?? 0
                          const cum = cell?.cumulativeKwhEnd ?? null
                          const prevC = prevBucket?.byMeter[m]
                          const prevPeriodKwh = prevC !== undefined ? prevC.energyKwh ?? 0 : null

                          const curCum = cum
                          const prevCumEnd = prevBucket?.byMeter[m]?.cumulativeKwhEnd
                          const prevPrevCumEnd = prevPrevBucket?.byMeter[m]?.cumulativeKwhEnd

                          const impliedDelta =
                            curCum !== null && prevCumEnd !== null && Number.isFinite(prevCumEnd)
                              ? curCum - prevCumEnd
                              : null
                          const prevImpliedDelta =
                            prevCumEnd !== null && prevPrevCumEnd !== null && Number.isFinite(prevPrevCumEnd)
                              ? prevCumEnd - prevPrevCumEnd
                              : null

                          const a = classifyEnergyCell({
                            value: dataMode === 'consumption' ? periodKwh : impliedDelta ?? periodKwh,
                            prevPeriodValue: dataMode === 'consumption' ? prevPeriodKwh : prevImpliedDelta,
                            consumptionRank: ranks.get(m) ?? 99,
                            activeLines: activeN,
                          })

                          const display =
                            dataMode === 'consumption'
                              ? fmtNum(periodKwh, 0)
                              : cum !== null
                                ? fmtNum(cum, 0)
                                : '—'

                          const topBold = (ranks.get(m) ?? 99) <= 3 && activeN >= 3

                          return (
                            <td
                              key={`${b.key}:${m}`}
                              role="button"
                              tabIndex={0}
                              className={[
                                'cursor-pointer border-b border-l border-[var(--border)] px-2 py-2.5 text-right font-mono text-xs tabular-nums transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]',
                                cellClass(a, topBold),
                              ].join(' ')}
                              style={{ borderLeftColor: LINE_COLORS[i % LINE_COLORS.length] }}
                              title={a.tooltip || (topBold ? 'Top period consumer' : undefined)}
                              onClick={() => setDrilldown({ bucketKey: b.key, lineName: m, periodLabel: b.label })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setDrilldown({ bucketKey: b.key, lineName: m, periodLabel: b.label })
                                }
                              }}
                            >
                              <span className="inline-flex items-center justify-end gap-1">
                                <AnomalyIcon a={a} />
                                {display}{' '}
                                <span className="text-[10px] text-[var(--muted)]">{dataMode === 'consumption' ? 'kWh' : ''}</span>
                              </span>
                            </td>
                          )
                        })}
                        <td className="sticky right-0 z-10 border-b border-l border-[var(--border)] bg-[inherit] px-3 py-2.5 text-right font-mono text-sm font-semibold tabular-nums text-[var(--text)] shadow-[-1px_0_0_var(--border)]">
                          {fmtNum(
                            dataMode === 'consumption'
                              ? meterNames.reduce((s, m) => s + (b.byMeter[m]?.energyKwh ?? 0), 0)
                              : meterNames.reduce((s, m) => s + (b.byMeter[m]?.cumulativeKwhEnd ?? 0), 0),
                            0,
                          )}{' '}
                          <span className="text-[10px] font-normal text-[var(--muted)]">kWh</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Cell highlights: yellow/red = large change vs prior period; ⚠ = zero use; bold = top three in row. Click any cell for
            hourly detail and plant load context.
          </p>
        </section>
      ) : null}

      {/* Compact line quick links */}
      {!empty && !q.isLoading ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="text-xs font-semibold text-[var(--text)]">Production lines</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PLC_PRODUCTION_METERS.map((def) => {
              const d = snap?.meters[def.meterIds?.[0] ?? '']
              return (
                <div key={def.id} className="rounded-xl border border-[var(--border)] p-3">
                  <Link to={`/lines/${def.id}`} className="text-sm font-semibold text-[var(--primary)] hover:underline">
                    {def.name}
                  </Link>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] text-[var(--muted)]">Live kW</div>
                      <div className="font-mono">{fmtSnap(d?.Real_power ?? 0, 1)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--muted)]">E (kWh)</div>
                      <div className="font-mono">{fmtSnap(d?.Real_energy ?? 0, 1)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <EnergyDrilldownModal
        open={drilldown !== null}
        onClose={() => setDrilldown(null)}
        lineName={drilldown?.lineName ?? ''}
        periodLabel={drilldown?.periodLabel ?? ''}
        intervals={drilldownIntervals}
      />
    </div>
  )
}

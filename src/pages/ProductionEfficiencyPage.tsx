import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'
import { Link } from 'react-router-dom'
import { Factory, Gauge, TrendingUp, Trophy, Zap } from 'lucide-react'
import { useDemandStatus, useEnergyIntervals, useProductionEntries } from '../hooks/queries'
import { PLC_PRODUCTION_METERS } from '../constants/plcProductionMeters'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { KpiCard, type KpiStatus } from '../components/ui/KpiCard'
import {
  aggregatePlantBuckets,
  efficiencyByLine,
  kWhPerUnit,
  sumEnergyByLine,
  sumProductionByLine,
  type ChartTimeMode,
} from '../lib/productionEfficiency'

const ENERGY_HOURS = 24 * 90
const TARGET_LS_KEY = 'productionTargetKwhPerUnit'

/** Cap points for dual charts on dense layout */
const MAX_DUAL_POINTS = 40

function fmt(n: number, d = 1) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d })
}

type EffTone = 'good' | 'warn' | 'bad' | 'neutral'

/** Lower kWh/unit is better. Optional target defines green / yellow / red bands. */
function toneForKwhPerUnit(value: number | null, target: number): EffTone {
  if (value === null || !Number.isFinite(value)) return 'neutral'
  if (target <= 0) return 'neutral'
  if (value <= target) return 'good'
  if (value <= target * 1.2) return 'warn'
  return 'bad'
}

function kpiStatusFromTone(tone: EffTone): KpiStatus {
  if (tone === 'bad') return 'critical'
  if (tone === 'warn') return 'warning'
  if (tone === 'good') return 'good'
  return 'normal'
}

export function ProductionEfficiencyPage() {
  const energyQ = useEnergyIntervals(ENERGY_HOURS)
  const prodQ = useProductionEntries(ENERGY_HOURS)
  const demandQ = useDemandStatus('24h')

  const ivs = energyQ.data ?? []
  const entries = prodQ.data ?? []

  const [chartMode, setChartMode] = useState<ChartTimeMode>('daily')
  const [targetKwh, setTargetKwh] = useState(0)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TARGET_LS_KEY)
      const n = raw ? Number(raw) : 0
      if (Number.isFinite(n) && n > 0) setTargetKwh(n)
    } catch {
      /* ignore */
    }
  }, [])

  const persistTarget = (n: number) => {
    setTargetKwh(n)
    try {
      if (n > 0 && Number.isFinite(n)) localStorage.setItem(TARGET_LS_KEY, String(n))
      else localStorage.removeItem(TARGET_LS_KEY)
    } catch {
      /* ignore */
    }
  }

  const todayStartMs = useMemo(() => {
    const s = new Date()
    s.setHours(0, 0, 0, 0)
    return s.getTime()
  }, [])

  const summary = useMemo(() => {
    const prodToday = sumProductionByLine(entries, { sinceMs: todayStartMs })
    let totalUnits = 0
    for (const v of prodToday.values()) totalUnits += v

    const eToday = sumEnergyByLine(ivs, { sinceMs: todayStartMs })
    let totalKwh = 0
    for (const v of eToday.values()) totalKwh += v

    const plantEff = kWhPerUnit(totalKwh, totalUnits)
    const byLine = efficiencyByLine(
      ivs.filter((x) => Date.parse(x.ts) >= todayStartMs),
      entries.filter((x) => Date.parse(x.ts) >= todayStartMs),
    )
    const ranked = byLine
      .filter((r) => r.kwhPerUnit !== null)
      .sort((a, b) => (a.kwhPerUnit ?? Infinity) - (b.kwhPerUnit ?? Infinity))
    const best = ranked[0]

    return {
      totalUnits,
      totalKwh,
      plantEff,
      bestLineName: best?.name ?? '—',
      bestKwhPerUnit: best?.kwhPerUnit ?? null,
    }
  }, [entries, ivs, todayStartMs])

  const defaultTarget = useMemo(() => {
    if (targetKwh > 0) return targetKwh
    const samples = [summary.plantEff, summary.bestKwhPerUnit].filter((x): x is number => x !== null && Number.isFinite(x))
    if (samples.length === 0) return 0
    return Math.max(...samples) * 1.05
  }, [targetKwh, summary.plantEff, summary.bestKwhPerUnit])

  const bucketSeries = useMemo(() => {
    const raw = aggregatePlantBuckets(ivs, entries, chartMode)
    const max = chartMode === 'daily' ? 14 : chartMode === 'weekly' ? 8 : 12
    const sliced = raw.slice(-max)
    if (sliced.length <= MAX_DUAL_POINTS) return sliced
    const step = Math.ceil(sliced.length / MAX_DUAL_POINTS)
    return sliced.filter((_, i) => i % step === 0 || i === sliced.length - 1)
  }, [ivs, entries, chartMode])

  const effTrend = useMemo(() => {
    return bucketSeries.map((b) => ({
      label: b.label,
      kwhPerUnit: b.kwhPerUnit,
    }))
  }, [bucketSeries])

  const hasEfficiencySeriesData = useMemo(
    () => effTrend.some((p) => p.kwhPerUnit !== null && Number.isFinite(p.kwhPerUnit)),
    [effTrend],
  )

  const lineCompareRaw = useMemo(() => {
    return efficiencyByLine(ivs, entries).map((r) => ({
      ...r,
      kwhBar: r.kwhPerUnit !== null && Number.isFinite(r.kwhPerUnit) ? r.kwhPerUnit : 0,
    }))
  }, [ivs, entries])

  /** Best (lowest kWh/u) first → worst last; lines without production at bottom */
  const lineCompareSorted = useMemo(() => {
    const valid = lineCompareRaw.filter((r) => r.units > 0 && r.kwhPerUnit !== null)
    const rest = lineCompareRaw.filter((r) => !(r.units > 0 && r.kwhPerUnit !== null))
    valid.sort((a, b) => (a.kwhPerUnit as number) - (b.kwhPerUnit as number))
    return [...valid, ...rest]
  }, [lineCompareRaw])

  const { bestLineId, worstLineId } = useMemo(() => {
    const valid = lineCompareSorted.filter((r) => r.units > 0 && r.kwhPerUnit !== null)
    if (valid.length === 0) return { bestLineId: null as string | null, worstLineId: null as string | null }
    return {
      bestLineId: valid[0].plcLineId,
      worstLineId: valid[valid.length - 1].plcLineId,
    }
  }, [lineCompareSorted])

  const chartMargins = { left: 4, right: 4, top: 6, bottom: 2 }
  const axisTick = { fontSize: 9, fill: 'var(--chart-axis)' }
  const axisLabel = { fontSize: 9, fill: 'var(--muted)', fontWeight: 600 }

  const effTargetForColor =
    targetKwh > 0 ? targetKwh : defaultTarget > 0 ? defaultTarget : 0

  const plantTone: EffTone =
    summary.plantEff === null || summary.totalUnits <= 0
      ? 'neutral'
      : effTargetForColor > 0
        ? toneForKwhPerUnit(summary.plantEff, effTargetForColor)
        : 'neutral'

  const bestTone: EffTone =
    summary.bestKwhPerUnit === null
      ? 'neutral'
      : effTargetForColor > 0
        ? toneForKwhPerUnit(summary.bestKwhPerUnit, effTargetForColor)
        : 'neutral'

  const demandTone: EffTone = useMemo(() => {
    const pct = demandQ.data?.pctOfThreshold ?? 0
    if (!Number.isFinite(pct) || pct <= 0) return 'neutral'
    if (pct >= 95) return 'bad'
    if (pct >= 80) return 'warn'
    return 'good'
  }, [demandQ.data?.pctOfThreshold])

  const hasAnyProductionToday = summary.totalUnits > 0
  const showCta = !hasAnyProductionToday

  return (
    <div className="flex h-[calc(100vh-124px)] min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-[var(--text)]">Production &amp; Efficiency</div>
          <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
            Read-only metrics from energy and logged production. Enter quantities on{' '}
            <Link to="/production-input" className="font-medium text-[var(--primary)] underline-offset-2 hover:underline">
              Production Input
            </Link>
            .
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-[var(--muted)]">Target kWh/u</div>
          <input
            type="number"
            min={0}
            step={0.01}
            value={targetKwh || ''}
            onChange={(e) => persistTarget(Number(e.target.value))}
            className="h-8 w-24 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-xs font-mono text-[var(--text)] outline-none focus:border-[var(--primary)]"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_92%,transparent)] p-3">
        <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-hidden">
          {/* KPI Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] pb-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">KPI Summary</div>
            {showCta ? (
              <div className="text-xs text-[var(--muted)]">
                <Link to="/production-input" className="font-medium text-[var(--primary)] underline-offset-2 hover:underline">
                  Production Input
                </Link>{' '}
                to log quantities and enable metrics.
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              className="h-[112px]"
              title="Production (today)"
              value={hasAnyProductionToday ? fmt(summary.totalUnits, 0) : '—'}
              unit="units"
              status="normal"
              icon={<Factory size={18} />}
              subtext={hasAnyProductionToday ? 'OK' : 'No production logged today'}
            />
            <KpiCard
              className="h-[112px]"
              title="Energy (today)"
              value={hasAnyProductionToday ? fmt(summary.totalKwh, 0) : '—'}
              unit="kWh"
              status="normal"
              icon={<Zap size={18} />}
              subtext={hasAnyProductionToday ? 'OK' : '—'}
            />
            <KpiCard
              className="h-[112px]"
              title="kWh per unit"
              value={summary.plantEff !== null && hasAnyProductionToday ? fmt(summary.plantEff, 2) : '—'}
              status={kpiStatusFromTone(plantTone)}
              icon={<Gauge size={18} />}
              targetText={targetKwh > 0 ? `Target ≤ ${fmt(targetKwh, 2)}` : undefined}
              subtext={hasAnyProductionToday ? undefined : 'No production logged today'}
            />
            <KpiCard
              className="h-[112px]"
              title="Rolling demand"
              value={demandQ.data ? fmt(demandQ.data.currentDemandKw, 1) : '—'}
              unit="kW"
              status={kpiStatusFromTone(demandTone)}
              icon={<TrendingUp size={18} />}
              subtext={
                demandQ.data?.thresholdKw
                  ? `${fmt(demandQ.data.pctOfThreshold, 0)}% of ${fmt(demandQ.data.thresholdKw, 0)} kW`
                  : 'Threshold unavailable'
              }
            />
            <KpiCard
              className="h-[112px]"
              title="Best line (today)"
              value={summary.bestKwhPerUnit !== null && hasAnyProductionToday ? fmt(summary.bestKwhPerUnit, 2) : '—'}
              unit="kWh/u"
              status={kpiStatusFromTone(bestTone)}
              icon={<Trophy size={18} />}
              subtext={hasAnyProductionToday ? summary.bestLineName : '—'}
            />
          </div>

          <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 overflow-hidden">
            {/* Trends & Analysis */}
            <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] pb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Trends &amp; Analysis</div>
              <div className="text-[11px] text-[var(--muted)]">D / W / M</div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="card card-hover flex h-[340px] min-w-0 flex-col overflow-hidden p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-[var(--text)]">Production vs energy</div>
                  <SegmentedControl
                    size="xs"
                    value={chartMode}
                    onChange={(id) => setChartMode(id as ChartTimeMode)}
                    options={[
                      { id: 'daily', label: 'D' },
                      { id: 'weekly', label: 'W' },
                      { id: 'monthly', label: 'M' },
                    ]}
                  />
                </div>
                <div className="min-h-0 flex-1 w-full min-w-0">
                  {bucketSeries.length === 0 ? (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-[var(--muted)]">
                      No data for this view. Log production on{' '}
                      <Link to="/production-input" className="text-[var(--primary)] underline-offset-2 hover:underline">
                        Production Input
                      </Link>
                      .
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={bucketSeries} margin={chartMargins} barCategoryGap="22%" barGap={3}>
                        <CartesianGrid strokeDasharray="2 3" stroke="var(--chart-grid)" strokeOpacity={0.85} vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={axisTick}
                          stroke="var(--chart-axis)"
                          interval="preserveStartEnd"
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="kwh"
                          tick={axisTick}
                          stroke="var(--chart-4)"
                          width={40}
                          tickLine={false}
                          tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                          label={{ value: 'kWh', ...axisLabel, position: 'insideLeft', angle: -90, offset: 4 }}
                        />
                        <YAxis
                          yAxisId="u"
                          orientation="right"
                          tick={axisTick}
                          stroke="var(--chart-1)"
                          width={36}
                          tickLine={false}
                          label={{ value: 'Units', ...axisLabel, position: 'insideRight', angle: 90, offset: 4 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--chart-tooltip-bg)',
                            border: '1px solid var(--chart-tooltip-border)',
                            borderRadius: 4,
                            fontSize: 10,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 9, paddingTop: 2 }} />
                        <Bar
                          yAxisId="kwh"
                          dataKey="kwh"
                          name="kWh"
                          fill="var(--chart-4)"
                          fillOpacity={0.85}
                          radius={[1, 1, 0, 0]}
                          maxBarSize={22}
                        />
                        <Line
                          yAxisId="u"
                          type="monotone"
                          dataKey="units"
                          name="Units"
                          stroke="var(--chart-1)"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 3 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="card card-hover flex h-[340px] min-w-0 flex-col overflow-hidden p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-[var(--text)]">Efficiency trend</div>
                  <div className="flex items-center gap-2">
                    {targetKwh > 0 ? <div className="text-[11px] text-[var(--muted)]">Target: {fmt(targetKwh, 2)} kWh/u</div> : null}
                    <SegmentedControl
                      size="xs"
                      value={chartMode}
                      onChange={(id) => setChartMode(id as ChartTimeMode)}
                      options={[
                        { id: 'daily', label: 'D' },
                        { id: 'weekly', label: 'W' },
                        { id: 'monthly', label: 'M' },
                      ]}
                    />
                  </div>
                </div>
                <div className="min-h-0 flex-1 w-full min-w-0">
                  {!hasEfficiencySeriesData ? (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-[var(--muted)]">
                      No efficiency series yet. Log production on{' '}
                      <Link to="/production-input" className="text-[var(--primary)] underline-offset-2 hover:underline">
                        Production Input
                      </Link>
                      .
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={effTrend} margin={chartMargins}>
                        <CartesianGrid strokeDasharray="2 3" stroke="var(--chart-grid)" strokeOpacity={0.85} />
                        <XAxis
                          dataKey="label"
                          tick={axisTick}
                          stroke="var(--chart-axis)"
                          interval="preserveStartEnd"
                          tickLine={false}
                        />
                        <YAxis tick={axisTick} stroke="var(--success)" width={42} tickLine={false} domain={['auto', 'auto']} />
                        {targetKwh > 0 ? (
                          <ReferenceLine
                            y={targetKwh}
                            stroke="var(--success)"
                            strokeDasharray="4 4"
                            strokeOpacity={0.95}
                            strokeWidth={1.5}
                          />
                        ) : null}
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--chart-tooltip-bg)',
                            border: '1px solid var(--chart-tooltip-border)',
                            borderRadius: 4,
                            fontSize: 10,
                          }}
                          formatter={(value) => {
                            const v = value == null || value === '' ? NaN : Number(value)
                            return [Number.isFinite(v) ? fmt(v, 3) : '—', 'kWh/u']
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="kwhPerUnit"
                          name="kWh/u"
                          stroke="var(--success)"
                          strokeWidth={2}
                          dot={false}
                          connectNulls={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Line Ranking */}
            <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] pb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Line Comparison / Efficiency Ranking</div>
              <span className="text-[11px] text-[var(--muted)]">
                Best{' '}
                <span className="font-semibold text-emerald-400">
                  {bestLineId ? PLC_PRODUCTION_METERS.find((l) => l.id === bestLineId)?.name : '—'}
                </span>
                <span className="mx-1 text-[var(--border)]">|</span>
                <span className="text-red-400">Worst </span>
                <span className="font-semibold text-red-400">
                  {worstLineId ? PLC_PRODUCTION_METERS.find((l) => l.id === worstLineId)?.name : '—'}
                </span>
              </span>
            </div>

            <div className="card card-hover flex min-h-0 flex-1 flex-col overflow-hidden p-4">
              <div className="min-h-0 flex-1 w-full min-w-0">
                {lineCompareSorted.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-4 text-center text-xs text-[var(--muted)]">
                    No line comparison data. Log production on{' '}
                    <Link to="/production-input" className="text-[var(--primary)] underline-offset-2 hover:underline">
                      Production Input
                    </Link>
                    .
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={lineCompareSorted}
                      layout="vertical"
                      margin={{ left: 2, right: 10, top: 4, bottom: 2 }}
                      barCategoryGap="18%"
                    >
                      <CartesianGrid strokeDasharray="2 3" stroke="var(--chart-grid)" strokeOpacity={0.75} horizontal={false} />
                      <XAxis
                        type="number"
                        tick={axisTick}
                        stroke="var(--chart-axis)"
                        tickFormatter={(v) => String(v)}
                        tickLine={false}
                        label={{ value: 'kWh / unit', ...axisLabel, position: 'insideBottom', offset: -2 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={78}
                        tick={axisTick}
                        stroke="var(--chart-axis)"
                        tickLine={false}
                        tickFormatter={(v) => (String(v).length > 12 ? `${String(v).slice(0, 11)}…` : String(v))}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--chart-tooltip-bg)',
                          border: '1px solid var(--chart-tooltip-border)',
                          borderRadius: 4,
                          fontSize: 10,
                        }}
                        formatter={(value, name) => {
                          const n = String(name ?? '')
                          const v = value == null || value === '' ? NaN : Number(value)
                          if (n === 'kWh/unit' || n === 'kwhBar')
                            return [Number.isFinite(v) ? fmt(v, 3) : '—', 'kWh/u']
                          return [Number.isFinite(v) ? fmt(v, 0) : '—', n]
                        }}
                      />
                      <Bar dataKey="kwhBar" name="kWh/unit" radius={[0, 2, 2, 0]} maxBarSize={16} minPointSize={2}>
                        {lineCompareSorted.map((row) => {
                          const v = row.kwhPerUnit
                          const isWorst = row.plcLineId === worstLineId && row.units > 0 && v !== null
                          const isBest = row.plcLineId === bestLineId && row.units > 0 && v !== null
                          let fill = 'var(--chart-3)'
                          if (v === null || !Number.isFinite(v) || row.units <= 0)
                            fill = 'color-mix(in srgb, var(--muted) 45%, transparent)'
                          else if (isWorst) fill = 'var(--danger)'
                          else if (isBest) fill = 'var(--success)'
                          else if (targetKwh > 0)
                            fill =
                              v <= targetKwh
                                ? 'color-mix(in srgb, var(--success) 65%, var(--chart-3))'
                                : 'color-mix(in srgb, var(--danger) 50%, var(--chart-3))'
                          return <Cell key={row.plcLineId} fill={fill} />
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

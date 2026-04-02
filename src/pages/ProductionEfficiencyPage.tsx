import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
import { Factory, Gauge, SlidersHorizontal, Trophy, Zap } from 'lucide-react'
import { useEnergyIntervals, useProductionEntries } from '../hooks/queries'
import { PLC_PRODUCTION_METERS } from '../constants/plcProductionMeters'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import {
  aggregatePlantBuckets,
  efficiencyByLine,
  kWhPerUnit,
  sumEnergyByLine,
  sumProductionByLine,
  type ChartTimeMode,
} from '../lib/productionEfficiency'
import {
  createProductionEntry,
  getLastProductionEntry,
  updateProductionEntry,
} from '../api/productionApi'

const ENERGY_HOURS = 24 * 90
const TARGET_LS_KEY = 'productionTargetKwhPerUnit'

const ICON = { className: 'shrink-0', strokeWidth: 2, size: 22 } as const

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

function toneClass(tone: EffTone): string {
  switch (tone) {
    case 'good':
      return 'border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_20px_-4px_rgba(16,185,129,0.35)]'
    case 'warn':
      return 'border-amber-500/50 bg-amber-500/5 shadow-[0_0_18px_-4px_rgba(245,158,11,0.3)]'
    case 'bad':
      return 'border-red-500/50 bg-red-500/5 shadow-[0_0_20px_-4px_rgba(239,68,68,0.35)]'
    default:
      return 'border-sky-500/40 bg-sky-500/5 shadow-[0_0_16px_-4px_rgba(56,189,248,0.25)]'
  }
}

function iconAccentClass(tone: EffTone): string {
  switch (tone) {
    case 'good':
      return 'text-emerald-400'
    case 'warn':
      return 'text-amber-400'
    case 'bad':
      return 'text-red-400'
    default:
      return 'text-sky-400'
  }
}

function valueToneClass(tone: EffTone): string {
  switch (tone) {
    case 'good':
      return 'text-emerald-300 [text-shadow:0_0_24px_rgba(16,185,129,0.5)]'
    case 'warn':
      return 'text-amber-200 [text-shadow:0_0_20px_rgba(245,158,11,0.4)]'
    case 'bad':
      return 'text-red-200 [text-shadow:0_0_24px_rgba(239,68,68,0.45)]'
    default:
      return 'text-[var(--text)] [text-shadow:0_0_18px_rgba(56,189,248,0.28)]'
  }
}

function ScadaKpi({
  title,
  value,
  unit,
  icon,
  sub,
  tone,
}: {
  title: string
  value: string
  unit: string
  icon: ReactNode
  sub?: string
  tone: EffTone
}) {
  return (
    <div
      className={[
        'flex min-w-0 items-stretch gap-1.5 rounded-md border-2 px-1.5 py-1',
        'bg-[color-mix(in_srgb,var(--card)_88%,#0a0a12)]',
        toneClass(tone),
      ].join(' ')}
    >
      <div className="flex shrink-0 items-center self-center">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[8px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{title}</div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1 gap-y-0">
          <span
            className={['font-mono text-2xl font-bold tabular-nums leading-none tracking-tight', valueToneClass(tone)].join(
              ' ',
            )}
          >
            {value}
          </span>
          {unit ? <span className="text-[10px] font-medium text-[var(--muted)]">{unit}</span> : null}
        </div>
        {sub ? <div className="mt-0.5 truncate text-[8px] font-medium text-[var(--muted)]">{sub}</div> : null}
      </div>
    </div>
  )
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseDatetimeLocal(s: string): string {
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

export function ProductionEfficiencyPage() {
  const qc = useQueryClient()
  const energyQ = useEnergyIntervals(ENERGY_HOURS)
  const prodQ = useProductionEntries(ENERGY_HOURS)

  const ivs = energyQ.data ?? []
  const entries = prodQ.data ?? []

  const [lineId, setLineId] = useState(PLC_PRODUCTION_METERS[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [tsLocal, setTsLocal] = useState(() => toDatetimeLocalValue(new Date()))
  const [shift, setShift] = useState<'Day' | 'Night' | ''>('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [chartMode, setChartMode] = useState<ChartTimeMode>('daily')
  const [targetKwh, setTargetKwh] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [formBusy, setFormBusy] = useState(false)

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

  const invalidate = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['productionEntries'] })
    await qc.invalidateQueries({ queryKey: ['energyIntervals'] })
  }, [qc])

  const onSubmit = async () => {
    setFormError(null)
    const q = Number(quantity.replace(/,/g, ''))
    if (!lineId || !Number.isFinite(q) || q <= 0) {
      setFormError('Line + qty')
      return
    }
    setFormBusy(true)
    try {
      const iso = editingId !== null ? parseDatetimeLocal(tsLocal) : new Date().toISOString()
      if (editingId !== null) {
        const res = await updateProductionEntry({
          id: editingId,
          lineId,
          quantity: q,
          ts: iso,
          shift: shift || null,
        })
        if (!res.ok) {
          setFormError(res.error ?? 'Update failed')
          return
        }
        setEditingId(null)
      } else {
        const res = await createProductionEntry({
          lineId,
          quantity: q,
          ts: iso,
          shift: shift || null,
        })
        if (!res.ok) {
          setFormError(res.error ?? 'Save failed')
          return
        }
      }
      setQuantity('')
      setTsLocal(toDatetimeLocalValue(new Date()))
      setShift('')
      await invalidate()
    } finally {
      setFormBusy(false)
    }
  }

  const onEditLast = async () => {
    setFormError(null)
    setFormBusy(true)
    try {
      const last = await getLastProductionEntry()
      if (!last) {
        setFormError('No entries')
        return
      }
      setEditingId(last.id)
      setLineId(last.lineId)
      setQuantity(String(last.quantity))
      setShift((last.shift as 'Day' | 'Night') || '')
      setTsLocal(toDatetimeLocalValue(new Date(last.ts)))
    } finally {
      setFormBusy(false)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setQuantity('')
    setTsLocal(toDatetimeLocalValue(new Date()))
    setFormError(null)
  }

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

  return (
    <div className="flex h-full min-h-0 flex-col gap-0.5 overflow-hidden px-0.5 py-0.5 text-[11px] leading-tight text-[var(--text)] md:gap-1 md:px-1 md:py-1">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--border)] pb-0.5">
        <Factory {...ICON} className="shrink-0 text-sky-400" strokeWidth={2} />
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--text)]">Production &amp; Efficiency</span>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-0.5 sm:grid-cols-4 sm:gap-1">
        <ScadaKpi
          title="Production (today)"
          value={fmt(summary.totalUnits, 0)}
          unit="units"
          tone="neutral"
          icon={<Factory {...ICON} className={iconAccentClass('neutral')} strokeWidth={2} />}
          sub={summary.totalUnits > 0 ? 'Live count' : undefined}
        />
        <ScadaKpi
          title="Energy (today)"
          value={fmt(summary.totalKwh, 0)}
          unit="kWh"
          tone="neutral"
          icon={<Zap {...ICON} className={iconAccentClass('neutral')} strokeWidth={2} />}
        />
        <ScadaKpi
          title="Plant kWh / unit"
          value={summary.plantEff !== null ? fmt(summary.plantEff, 2) : '—'}
          unit=""
          tone={plantTone}
          icon={<Gauge {...ICON} className={iconAccentClass(plantTone)} strokeWidth={2} />}
          sub={summary.totalUnits <= 0 ? 'No production data' : targetKwh > 0 ? `Target ${fmt(targetKwh, 2)}` : undefined}
        />
        <ScadaKpi
          title="Best line"
          value={summary.bestKwhPerUnit !== null ? fmt(summary.bestKwhPerUnit, 2) : '—'}
          unit="kWh/u"
          tone={bestTone}
          icon={<Trophy {...ICON} className={iconAccentClass(bestTone)} strokeWidth={2} />}
          sub={summary.bestLineName !== '—' ? summary.bestLineName : undefined}
        />
      </div>

      {/* Control bar */}
      <div className="flex shrink-0 flex-col gap-0.5 rounded-md border-2 border-[color-mix(in_srgb,var(--border)_80%,#1e3a5f)] bg-[color-mix(in_srgb,var(--card)_90%,#0c1220)] px-1 py-0.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
        <div className="flex min-h-[28px] flex-wrap items-center gap-1">
          <SlidersHorizontal size={18} strokeWidth={2} className="shrink-0 text-sky-400" aria-hidden />
          <select
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            className="h-7 min-w-[7rem] flex-1 rounded border border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_4%,var(--card))] px-1.5 text-[10px] font-medium text-[var(--text)] sm:min-w-0 sm:flex-none"
            title="Production line"
          >
            {PLC_PRODUCTION_METERS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Qty"
            className="h-7 w-[4.5rem] rounded border border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_4%,var(--card))] px-1.5 font-mono text-[10px] text-[var(--text)]"
          />
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value as '' | 'Day' | 'Night')}
            className="h-7 w-[4.75rem] rounded border border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_4%,var(--card))] px-1 text-[10px] font-medium"
            title="Shift"
          >
            <option value="">Shift</option>
            <option value="Day">Day</option>
            <option value="Night">Night</option>
          </select>
          <div className="flex h-7 items-center gap-0.5 rounded border border-dashed border-[var(--border)] px-1">
            <span className="text-[8px] font-semibold uppercase text-[var(--muted)]">Tgt</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={targetKwh || ''}
              onChange={(e) => persistTarget(Number(e.target.value))}
              className="w-12 border-0 bg-transparent font-mono text-[10px] text-[var(--text)] outline-none"
              title="Target kWh/unit (efficiency threshold)"
            />
          </div>
          <button
            type="button"
            disabled={formBusy}
            onClick={onSubmit}
            className="h-7 rounded border border-sky-600 bg-sky-600/90 px-2.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm hover:bg-sky-500 disabled:opacity-50"
          >
            {editingId !== null ? 'Save' : 'Submit'}
          </button>
          <button
            type="button"
            disabled={formBusy}
            onClick={onEditLast}
            className="h-7 rounded border border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_6%,var(--card))] px-2 text-[10px] font-semibold text-[var(--text)] disabled:opacity-50"
          >
            Edit
          </button>
          {editingId !== null ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="h-7 rounded px-2 text-[10px] font-medium text-[var(--muted)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
          ) : null}
        </div>
        {editingId !== null ? (
          <div className="flex flex-wrap items-center gap-1 border-t border-[var(--border)] pt-0.5">
            <span className="text-[8px] text-[var(--muted)]">Timestamp</span>
            <input
              type="datetime-local"
              value={tsLocal}
              onChange={(e) => setTsLocal(e.target.value)}
              className="h-6 flex-1 min-w-[10rem] rounded border border-[var(--border)] bg-[var(--card)] px-1 font-mono text-[10px]"
            />
          </div>
        ) : null}
        {formError ? <div className="text-[9px] font-medium text-[var(--danger)]">{formError}</div> : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,0.4fr)] gap-0.5 overflow-hidden md:grid-cols-2 md:grid-rows-[minmax(0,1fr)_minmax(0,0.42fr)] md:gap-1">
        {/* Production vs energy */}
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border-2 border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_92%,#080810)] p-0.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] md:col-start-1 md:row-start-1">
          <div className="mb-0 flex shrink-0 flex-wrap items-center justify-between gap-1 px-0.5 pt-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">Production vs energy</span>
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
          <div className="min-h-0 flex-1 pb-0.5">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={bucketSeries} margin={chartMargins} barCategoryGap="22%" barGap={3}>
                <CartesianGrid strokeDasharray="2 3" stroke="var(--chart-grid)" strokeOpacity={0.85} vertical={false} />
                <XAxis dataKey="label" tick={axisTick} stroke="var(--chart-axis)" interval="preserveStartEnd" tickLine={false} />
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
          </div>
        </div>

        {/* Efficiency trend */}
        <div className="relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border-2 border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_92%,#080810)] p-0.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] md:col-start-2 md:row-start-1">
          <div className="mb-0 flex shrink-0 items-center justify-between gap-1 px-0.5 pt-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">Plant efficiency</span>
            {targetKwh > 0 ? (
              <span className="text-[8px] font-mono text-emerald-400/90">Target {fmt(targetKwh, 2)} kWh/u</span>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 pb-0.5">
            {!hasEfficiencySeriesData ? (
              <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1 px-2 text-center">
                <Gauge size={28} strokeWidth={2} className="text-[var(--muted)] opacity-60" />
                <p className="text-[10px] font-semibold text-[var(--text)]">No production data</p>
                <p className="max-w-[14rem] text-[8px] leading-snug text-[var(--muted)]">
                  Enter production quantities to compute kWh per unit for this period.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={effTrend} margin={chartMargins}>
                  <CartesianGrid strokeDasharray="2 3" stroke="var(--chart-grid)" strokeOpacity={0.85} />
                  <XAxis dataKey="label" tick={axisTick} stroke="var(--chart-axis)" interval="preserveStartEnd" tickLine={false} />
                  <YAxis tick={axisTick} stroke="var(--success)" width={42} tickLine={false} domain={['auto', 'auto']} />
                  {targetKwh > 0 ? (
                    <ReferenceLine
                      y={targetKwh}
                      stroke="var(--success)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.95}
                      strokeWidth={1.5}
                      label={{
                        value: `Target ${fmt(targetKwh, 2)}`,
                        position: 'insideTopRight',
                        fill: 'var(--success)',
                        fontSize: 8,
                        fontWeight: 700,
                      }}
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

        {/* Line comparison — sorted best → worst */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-md border-2 border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_92%,#080810)] p-0.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] md:col-span-2 md:row-start-2">
          <div className="mb-0 flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-0 px-0.5 pt-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">Line efficiency (best → worst)</span>
            <span className="text-[8px] text-[var(--muted)]">
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
          <div className="min-h-0 flex-1 pb-0.5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lineCompareSorted} layout="vertical" margin={{ left: 2, right: 10, top: 4, bottom: 2 }} barCategoryGap="18%">
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
                    if (v === null || !Number.isFinite(v) || row.units <= 0) fill = 'color-mix(in srgb, var(--muted) 45%, transparent)'
                    else if (isWorst) fill = 'var(--danger)'
                    else if (isBest) fill = 'var(--success)'
                    else if (targetKwh > 0) fill = v <= targetKwh ? 'color-mix(in srgb, var(--success) 65%, var(--chart-3))' : 'color-mix(in srgb, var(--danger) 50%, var(--chart-3))'
                    return <Cell key={row.plcLineId} fill={fill} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

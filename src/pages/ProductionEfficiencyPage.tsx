import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'
import { Factory, Gauge, Zap } from 'lucide-react'
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

/** Cap points per chart for readability on dense SCADA layout */
const MAX_DUAL_POINTS = 36
const MAX_BAR_LABELS = 12

function fmt(n: number, d = 1) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d })
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseDatetimeLocal(s: string): string {
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function CompactKpi({
  title,
  value,
  unit,
  icon,
  sub,
}: {
  title: string
  value: string
  unit: string
  icon: ReactNode
  sub?: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5">
      <div className="shrink-0 text-[var(--muted)]">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[9px] font-medium uppercase tracking-wide text-[var(--muted)]">{title}</div>
        <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
          <span className="font-mono text-sm font-semibold tabular-nums leading-tight text-[var(--text)]">{value}</span>
          {unit ? <span className="text-[10px] text-[var(--muted)]">{unit}</span> : null}
        </div>
        {sub ? <div className="truncate text-[9px] text-[var(--muted)]">{sub}</div> : null}
      </div>
    </div>
  )
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

  const bucketSeries = useMemo(() => {
    const raw = aggregatePlantBuckets(ivs, entries, chartMode)
    const max =
      chartMode === 'daily' ? 14 : chartMode === 'weekly' ? 8 : 12
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

  const lineCompare = useMemo(() => {
    return efficiencyByLine(ivs, entries).map((r) => ({
      ...r,
      kwhBar: r.kwhPerUnit !== null && Number.isFinite(r.kwhPerUnit) ? r.kwhPerUnit : 0,
    }))
  }, [ivs, entries])

  const lineCompareDisplay = useMemo(() => {
    if (lineCompare.length <= MAX_BAR_LABELS) return lineCompare
    const step = Math.ceil(lineCompare.length / MAX_BAR_LABELS)
    return lineCompare.filter((_, i) => i % step === 0 || i === lineCompare.length - 1)
  }, [lineCompare])

  const bestId = useMemo(() => {
    const valid = lineCompare.filter((r) => r.kwhPerUnit !== null && r.units > 0)
    if (valid.length === 0) return null
    const min = Math.min(...valid.map((r) => r.kwhPerUnit as number))
    const row = valid.find((r) => r.kwhPerUnit === min)
    return row?.plcLineId ?? null
  }, [lineCompare])

  const worstId = useMemo(() => {
    const valid = lineCompare.filter((r) => r.kwhPerUnit !== null && r.units > 0)
    if (valid.length === 0) return null
    const max = Math.max(...valid.map((r) => r.kwhPerUnit as number))
    const row = valid.find((r) => r.kwhPerUnit === max)
    return row?.plcLineId ?? null
  }, [lineCompare])

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
      const iso =
        editingId !== null ? parseDatetimeLocal(tsLocal) : new Date().toISOString()
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

  const chartMargins = { left: 0, right: 8, top: 4, bottom: 0 }
  const axisTick = { fontSize: 9, fill: 'var(--chart-axis)' }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 overflow-hidden p-1 text-[11px] leading-tight text-[var(--text)] md:gap-1.5 md:p-1.5">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--border)] pb-1">
        <Factory size={14} className="shrink-0 text-[var(--primary)]" />
        <span className="text-[11px] font-semibold text-[var(--text)]">Production &amp; Efficiency</span>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-1 sm:grid-cols-4">
        <CompactKpi
          title="Production (today)"
          value={fmt(summary.totalUnits, 0)}
          unit="u"
          icon={<Factory size={14} />}
        />
        <CompactKpi
          title="Energy (today)"
          value={fmt(summary.totalKwh, 0)}
          unit="kWh"
          icon={<Zap size={14} />}
        />
        <CompactKpi
          title="kWh / unit"
          value={summary.plantEff !== null ? fmt(summary.plantEff, 2) : '—'}
          unit="plant"
          icon={<Gauge size={14} />}
          sub={summary.totalUnits <= 0 ? 'No prod' : undefined}
        />
        <CompactKpi
          title="Best line"
          value={summary.bestKwhPerUnit !== null ? fmt(summary.bestKwhPerUnit, 2) : '—'}
          unit="kWh/u"
          icon={<Gauge size={14} />}
          sub={summary.bestLineName !== '—' ? summary.bestLineName : undefined}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,0.42fr)] gap-1 overflow-hidden md:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)_minmax(0,0.42fr)]">
        {/* Production input — max ~25vh */}
        <div className="flex max-h-[25vh] min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5 md:row-span-1 md:max-h-none md:h-full">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Input</div>

          <div className="flex min-h-0 flex-1 flex-col gap-1">
            <div className="flex gap-1">
              <select
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className="h-7 min-w-0 flex-1 rounded border border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_3%,var(--card))] px-1.5 text-[10px] text-[var(--text)]"
                title="Line"
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
                className="h-7 w-16 shrink-0 rounded border border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_3%,var(--card))] px-1.5 font-mono text-[10px] text-[var(--text)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as '' | 'Day' | 'Night')}
                className="h-7 min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--card)] px-1 text-[10px]"
                title="Shift"
              >
                <option value="">Shift</option>
                <option value="Day">Day</option>
                <option value="Night">Night</option>
              </select>
              <div className="flex h-7 items-center gap-0.5">
                <span className="text-[9px] text-[var(--muted)]">Tgt</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={targetKwh || ''}
                  onChange={(e) => persistTarget(Number(e.target.value))}
                  className="w-14 rounded border border-[var(--border)] bg-[var(--card)] px-1 font-mono text-[10px]"
                  title="Target kWh/unit"
                />
              </div>
            </div>

            {editingId !== null ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-[var(--muted)]">Time (edit)</span>
                <input
                  type="datetime-local"
                  value={tsLocal}
                  onChange={(e) => setTsLocal(e.target.value)}
                  className="h-7 rounded border border-[var(--border)] bg-[var(--card)] px-1 font-mono text-[10px]"
                />
              </div>
            ) : (
              <div className="text-[9px] text-[var(--muted)]">Time: now (server)</div>
            )}

            {formError ? <div className="text-[9px] text-[var(--danger)]">{formError}</div> : null}

            <div className="mt-auto flex flex-wrap gap-1 pt-0.5">
              <button
                type="button"
                disabled={formBusy}
                onClick={onSubmit}
                className="rounded border border-[var(--primary)] bg-[var(--primary)] px-2 py-0.5 text-[10px] font-medium text-[var(--primary-foreground)] disabled:opacity-50"
              >
                {editingId !== null ? 'Save' : 'Submit'}
              </button>
              <button
                type="button"
                disabled={formBusy}
                onClick={onEditLast}
                className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[10px] text-[var(--text)] disabled:opacity-50"
              >
                Edit
              </button>
              {editingId !== null ? (
                <button type="button" onClick={cancelEdit} className="rounded px-2 py-0.5 text-[10px] text-[var(--muted)]">
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Production vs energy */}
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 md:col-start-2">
          <div className="mb-0.5 flex shrink-0 flex-wrap items-center justify-between gap-1">
            <span className="text-[10px] font-semibold text-[var(--text)]">Prod. vs energy</span>
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
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={bucketSeries} margin={chartMargins}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" strokeOpacity={0.6} />
                <XAxis dataKey="label" tick={axisTick} stroke="var(--chart-axis)" interval="preserveStartEnd" />
                <YAxis
                  yAxisId="kwh"
                  tick={axisTick}
                  stroke="var(--chart-axis)"
                  width={32}
                  tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                />
                <YAxis
                  yAxisId="u"
                  orientation="right"
                  tick={axisTick}
                  stroke="var(--chart-axis)"
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--chart-tooltip-bg)',
                    border: '1px solid var(--chart-tooltip-border)',
                    borderRadius: 6,
                    fontSize: 10,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar yAxisId="kwh" dataKey="kwh" name="kWh" fill="var(--chart-4)" radius={[2, 2, 0, 0]} maxBarSize={40} />
                <Line
                  yAxisId="u"
                  type="monotone"
                  dataKey="units"
                  name="Units"
                  stroke="var(--chart-1)"
                  strokeWidth={1.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Efficiency trend */}
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 md:col-start-3">
          <div className="mb-0.5 shrink-0 text-[10px] font-semibold text-[var(--text)]">Efficiency</div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={effTrend} margin={chartMargins}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" strokeOpacity={0.6} />
                <XAxis dataKey="label" tick={axisTick} stroke="var(--chart-axis)" interval="preserveStartEnd" />
                <YAxis tick={axisTick} stroke="var(--chart-axis)" width={36} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--chart-tooltip-bg)',
                    border: '1px solid var(--chart-tooltip-border)',
                    borderRadius: 6,
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
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Line comparison — full width bottom */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 md:col-span-3 md:row-start-2">
          <div className="mb-0.5 flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-0">
            <span className="text-[10px] font-semibold text-[var(--text)]">Line kWh/unit</span>
            <span className="text-[9px] text-[var(--muted)]">
              Best{' '}
              <span className="text-[var(--success)]">{bestId ? PLC_PRODUCTION_METERS.find((l) => l.id === bestId)?.name : '—'}</span>
              {' · '}
              <span className="text-[var(--danger)]">{worstId ? PLC_PRODUCTION_METERS.find((l) => l.id === worstId)?.name : '—'}</span>
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lineCompareDisplay} layout="vertical" margin={{ left: 4, right: 8, top: 2, bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" strokeOpacity={0.5} horizontal={false} />
                <XAxis type="number" tick={axisTick} stroke="var(--chart-axis)" tickFormatter={(v) => String(v)} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  tick={axisTick}
                  stroke="var(--chart-axis)"
                  tickFormatter={(v) => (String(v).length > 10 ? `${String(v).slice(0, 9)}…` : String(v))}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--chart-tooltip-bg)',
                    border: '1px solid var(--chart-tooltip-border)',
                    borderRadius: 6,
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
                <Bar dataKey="kwhBar" name="kWh/unit" radius={[0, 2, 2, 0]} maxBarSize={14}>
                  {lineCompareDisplay.map((row) => {
                    const v = row.kwhPerUnit
                    let fill = 'var(--chart-3)'
                    if (v === null || !Number.isFinite(v)) fill = 'var(--muted)'
                    else if (targetKwh > 0) fill = v <= targetKwh ? 'var(--success)' : 'var(--danger)'
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

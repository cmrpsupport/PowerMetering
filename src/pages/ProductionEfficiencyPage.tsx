import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { KpiCard } from '../components/ui/KpiCard'
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
    return raw.slice(-max)
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
      setFormError('Choose a line and enter a positive quantity.')
      return
    }
    setFormBusy(true)
    try {
      const iso = parseDatetimeLocal(tsLocal)
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
        setFormError('No entries yet.')
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

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 p-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
            <Factory size={22} className="text-[var(--primary)]" />
            Production &amp; Efficiency
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Log production by line, align with metered energy, and track kWh per unit without changing the
            plant power dashboard.
          </p>
        </div>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <KpiCard
          title="Production (today)"
          value={fmt(summary.totalUnits, 0)}
          unit="units"
          status="normal"
          icon={<Factory size={18} />}
        />
        <KpiCard
          title="Energy (today)"
          value={fmt(summary.totalKwh, 0)}
          unit="kWh"
          status="normal"
          icon={<Zap size={18} />}
        />
        <KpiCard
          title="kWh / unit"
          value={summary.plantEff !== null ? fmt(summary.plantEff, 2) : '—'}
          unit="plant"
          status="normal"
          icon={<Gauge size={18} />}
          subtext={summary.totalUnits <= 0 ? 'Log production to compute' : null}
        />
        <KpiCard
          title="Best line (kWh/unit)"
          value={summary.bestKwhPerUnit !== null ? fmt(summary.bestKwhPerUnit, 2) : '—'}
          unit="kWh/unit"
          status="good"
          icon={<Gauge size={18} />}
          subtext={summary.bestLineName !== '—' ? summary.bestLineName : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="card rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <div className="text-sm font-semibold text-[var(--text)]">Production input</div>
          <p className="mt-1 text-xs text-[var(--muted)]">Timestamp defaults to now; optional shift for reporting.</p>

          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-[var(--muted)]">
              Line
              <select
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_3%,var(--card))] px-3 py-2 text-sm text-[var(--text)]"
              >
                {PLC_PRODUCTION_METERS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-[var(--muted)]">
              Quantity (units)
              <input
                type="text"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 1200"
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_3%,var(--card))] px-3 py-2 font-mono text-sm text-[var(--text)]"
              />
            </label>

            <label className="block text-xs font-medium text-[var(--muted)]">
              Timestamp
              <input
                type="datetime-local"
                value={tsLocal}
                onChange={(e) => setTsLocal(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_3%,var(--card))] px-3 py-2 font-mono text-sm text-[var(--text)]"
              />
            </label>

            <label className="block text-xs font-medium text-[var(--muted)]">
              Shift (optional)
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as '' | 'Day' | 'Night')}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_3%,var(--card))] px-3 py-2 text-sm text-[var(--text)]"
              >
                <option value="">—</option>
                <option value="Day">Day</option>
                <option value="Night">Night</option>
              </select>
            </label>

            {formError ? <div className="text-xs text-[var(--danger)]">{formError}</div> : null}
            {editingId !== null ? (
              <div className="text-xs text-[var(--muted)]">Editing entry #{editingId}</div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={formBusy}
                onClick={onSubmit}
                className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
              >
                {editingId !== null ? 'Save changes' : 'Submit'}
              </button>
              <button
                type="button"
                disabled={formBusy}
                onClick={onEditLast}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--text)] disabled:opacity-50"
              >
                Edit last entry
              </button>
              {editingId !== null ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)]"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <div className="text-xs font-medium text-[var(--muted)]">Target kWh/unit (optional)</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                step={0.01}
                value={targetKwh || ''}
                onChange={(e) => persistTarget(Number(e.target.value))}
                placeholder="e.g. 2.5"
                className="w-32 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 font-mono text-sm"
              />
              <span className="text-xs text-[var(--muted)]">Used for bar colors when set.</span>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <div className="card rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Production vs energy</div>
                <div className="text-xs text-[var(--muted)]">Dual axis: kWh and units per time bucket.</div>
              </div>
              <SegmentedControl
                value={chartMode}
                onChange={(id) => setChartMode(id as ChartTimeMode)}
                options={[
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                ]}
              />
            </div>
            <div className="h-72 min-h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={bucketSeries} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" />
                  <YAxis
                    yAxisId="kwh"
                    tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                    stroke="var(--chart-axis)"
                    width={48}
                    label={{ value: 'kWh', angle: -90, position: 'insideLeft', fill: 'var(--muted)', fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="u"
                    orientation="right"
                    tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                    stroke="var(--chart-axis)"
                    width={48}
                    label={{ value: 'Units', angle: 90, position: 'insideRight', fill: 'var(--muted)', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--chart-tooltip-bg)',
                      border: '1px solid var(--chart-tooltip-border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="kwh" dataKey="kwh" name="Energy (kWh)" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="u"
                    type="monotone"
                    dataKey="units"
                    name="Production (units)"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="mb-2 text-sm font-semibold text-[var(--text)]">Efficiency trend</div>
            <div className="text-xs text-[var(--muted)]">kWh per unit (null when no production in bucket).</div>
            <div className="mt-2 h-56 w-full min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={effTrend} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" width={52} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--chart-tooltip-bg)',
                      border: '1px solid var(--chart-tooltip-border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number | null) => [v !== null && Number.isFinite(v) ? fmt(v, 3) : '—', 'kWh/unit']}
                  />
                  <Line
                    type="monotone"
                    dataKey="kwhPerUnit"
                    name="kWh/unit"
                    stroke="var(--success)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="card rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Line comparison</div>
            <div className="text-xs text-[var(--muted)]">
              kWh per unit over the loaded window ({ENERGY_HOURS}h). Green = below target (when set); red = above.
            </div>
          </div>
          <div className="text-xs text-[var(--muted)]">
            Best: <span className="font-medium text-[var(--success)]">{bestId ? PLC_PRODUCTION_METERS.find((l) => l.id === bestId)?.name : '—'}</span>
            {' · '}
            Least efficient:{' '}
            <span className="font-medium text-[var(--danger)]">{worstId ? PLC_PRODUCTION_METERS.find((l) => l.id === worstId)?.name : '—'}</span>
          </div>
        </div>
        <div className="h-80 w-full min-h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lineCompare} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} stroke="var(--chart-axis)" />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                stroke="var(--chart-axis)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--chart-tooltip-bg)',
                  border: '1px solid var(--chart-tooltip-border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: unknown, name: string) => {
                  if (name === 'kwhPerUnit') return [v !== null && Number.isFinite(Number(v)) ? fmt(Number(v), 3) : '—', 'kWh/unit']
                  return [fmt(Number(v), 0), name]
                }}
              />
              <Bar dataKey="kwhBar" name="kWh/unit" radius={[0, 4, 4, 0]}>
                {lineCompare.map((row) => {
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
  )
}

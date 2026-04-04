import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Save, Trash2 } from 'lucide-react'
import { PLC_MAIN_LINE_ID, PLC_PRODUCTION_METERS } from '../constants/plcProductionMeters'
import { useProductionEntries } from '../hooks/queries'
import { createProductionEntry, deleteProductionEntry, updateProductionEntry } from '../api/productionApi'
import type { ProductionEntry } from '../types'

type ShiftId = 'A' | 'B' | 'C'
type UnitId = 'kg' | 'pcs' | 'batch'

type RowErrors = Partial<Record<'date' | 'shift' | 'lineId' | 'quantity', string>>

type DraftRow = {
  key: string
  id?: number
  date: string // yyyy-mm-dd
  shift: ShiftId
  lineId: string
  productType: string
  quantity: string
  unit: UnitId
  remarks: string
  submittedBy: string
  errors?: RowErrors
}

/** Production lines for manual entry — plant list minus Main Line and all Utilities lines. */
const EXCLUDED_PRODUCTION_INPUT_LINE_IDS = new Set<string>([PLC_MAIN_LINE_ID, 'plc-line-11', 'plc-line-12'])
const LINES = PLC_PRODUCTION_METERS.filter((m) => !EXCLUDED_PRODUCTION_INPUT_LINE_IDS.has(m.id)).map((m) => ({
  lineId: m.id,
  label: m.name,
}))

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function todayYm() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function entryLocalYmd(ts: string): string | null {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function entryLocalYm(ts: string): string | null {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function firstYmdOfMonth(ym: string): string {
  return `${ym}-01`
}

function lastDayOfMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return 31
  return new Date(y, m, 0).getDate()
}

function addMonths(ym: string, delta: number): string {
  const [y0, m0] = ym.split('-').map(Number)
  if (!y0 || !m0) return ym
  const d = new Date(y0, m0 - 1 + delta, 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function formatMonthTitle(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function formatDisplayDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function clampYmdToMonth(ymd: string, ym: string): string {
  if (ymd.startsWith(ym)) return ymd
  return firstYmdOfMonth(ym)
}

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function decodeShiftMeta(raw: string | null | undefined): {
  shift: string | null
  unit?: string
  productType?: string
  remarks?: string
  submittedBy?: string
} {
  const s = raw ?? null
  if (!s) return { shift: null }
  const j = typeof s === 'string' ? safeJsonParse(s) : null
  if (j && typeof j === 'object' && typeof j.shift === 'string') return j
  return { shift: s }
}

function encodeShiftMeta(meta: {
  shift: ShiftId
  unit?: UnitId
  productType?: string
  remarks?: string
  submittedBy?: string
}): string {
  return JSON.stringify({
    shift: meta.shift,
    unit: meta.unit,
    productType: meta.productType?.trim() || undefined,
    remarks: meta.remarks?.trim() || undefined,
    submittedBy: meta.submittedBy?.trim() || undefined,
  })
}

function newRow(seed?: Partial<DraftRow>): DraftRow {
  const base: DraftRow = {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: todayYmd(),
    shift: 'A',
    lineId: LINES[0]?.lineId ?? '',
    productType: '',
    quantity: '',
    unit: 'kg',
    remarks: '',
    submittedBy: '',
  }
  return { ...base, ...(seed ?? {}) }
}

/** Table column order: shift mode has no date/line inputs (calendar + fixed line per row). */
const COLS_WITH_DATE = ['date', 'shift', 'line', 'productType', 'quantity', 'unit', 'remarks', 'submittedBy'] as const
const COLS_NO_DATE = ['shift', 'productType', 'quantity', 'unit', 'remarks', 'submittedBy'] as const
type ColId = (typeof COLS_WITH_DATE)[number]

function nextCell(col: ColId, shiftMode: boolean): ColId {
  const cols = shiftMode ? COLS_NO_DATE : COLS_WITH_DATE
  const i = cols.indexOf(col as (typeof cols)[number])
  const j = Math.min(cols.length - 1, Math.max(0, i >= 0 ? i + 1 : 0))
  return cols[j]! as ColId
}

function aggregateMonthFromApi(entries: ProductionEntry[] | undefined, ym: string) {
  const byLine = new Map<string, number>()
  const byShift = new Map<string, number>()
  const byDay = new Map<string, number>()
  let total = 0
  let entryCount = 0
  for (const e of entries ?? []) {
    const eym = entryLocalYm(e.ts)
    if (!eym || eym !== ym) continue
    const ymd = entryLocalYmd(e.ts)
    if (!ymd) continue
    const q = Number(e.quantity)
    if (!Number.isFinite(q)) continue
    total += q
    entryCount += 1
    byLine.set(e.lineId, (byLine.get(e.lineId) ?? 0) + q)
    byDay.set(ymd, (byDay.get(ymd) ?? 0) + q)
    const meta = decodeShiftMeta(e.shift)
    const sh = meta.shift ?? '?'
    byShift.set(sh, (byShift.get(sh) ?? 0) + q)
  }
  return { total, byLine, byShift, byDay, entryCount }
}

export function ProductionInputPage() {
  const qc = useQueryClient()
  const entriesQ = useProductionEntries(24 * 400)

  const [shiftEntryMode, setShiftEntryMode] = useState(true)
  const [activeMonth, setActiveMonth] = useState(() => todayYm())
  const [activeDate, setActiveDate] = useState(() => todayYmd())
  const [activeShift, setActiveShift] = useState<ShiftId>('A')
  const [busy, setBusy] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [rows, setRows] = useState<DraftRow[]>(() =>
    LINES.map((l) => newRow({ lineId: l.lineId, date: todayYmd(), shift: 'A' })),
  )

  const tableWrapRef = useRef<HTMLDivElement | null>(null)
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null)

  useEffect(() => {
    setActiveDate((d) => clampYmdToMonth(d, activeMonth))
  }, [activeMonth])

  const monthStats = useMemo(
    () => aggregateMonthFromApi(entriesQ.data, activeMonth),
    [entriesQ.data, activeMonth],
  )

  const maxDayTotal = useMemo(() => {
    let m = 0
    for (const v of monthStats.byDay.values()) m = Math.max(m, v)
    return m || 1
  }, [monthStats.byDay])

  const existingByKey = useMemo(() => {
    const out = new Map<string, { id: number; meta: ReturnType<typeof decodeShiftMeta> }>()
    const xs = entriesQ.data ?? []
    for (const e of xs) {
      const ymd = entryLocalYmd(e.ts)
      if (!ymd) continue
      const meta = decodeShiftMeta(e.shift)
      const shift = meta.shift
      if (!shift) continue
      const key = `${ymd}::${shift}::${e.lineId}`
      out.set(key, { id: e.id, meta })
    }
    return out
  }, [entriesQ.data])

  useEffect(() => {
    if (!shiftEntryMode) return
    setRows((prev) => {
      const next = LINES.map((l) => {
        const k = `${activeDate}::${activeShift}::${l.lineId}`
        const existing = existingByKey.get(k)
        if (!existing) return newRow({ lineId: l.lineId, date: activeDate, shift: activeShift })
        const meta = existing.meta
        return newRow({
          id: existing.id,
          lineId: l.lineId,
          date: activeDate,
          shift: activeShift,
          productType: String(meta.productType ?? ''),
          unit: (meta.unit as UnitId) || 'kg',
          remarks: String(meta.remarks ?? ''),
          submittedBy: String(meta.submittedBy ?? ''),
        })
      })
      const prevMap = new Map(prev.map((r) => [`${r.date}::${r.shift}::${r.lineId}`, r] as const))
      return next.map((r) => {
        const p = prevMap.get(`${r.date}::${r.shift}::${r.lineId}`)
        return p ? { ...r, quantity: p.quantity, productType: p.productType, unit: p.unit, remarks: p.remarks, submittedBy: p.submittedBy } : r
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftEntryMode, activeDate, activeShift, existingByKey])

  useEffect(() => {
    const key = `prodInputDraft::${activeDate}::${activeShift}`
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(rows))
      } catch {
        /* ignore */
      }
    }, 250)
    return () => clearTimeout(t)
  }, [rows, activeDate, activeShift])

  useEffect(() => {
    const key = `prodInputDraft::${activeDate}::${activeShift}`
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const j = safeJsonParse(raw)
      if (!Array.isArray(j)) return
      setRows(j as DraftRow[])
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDate, activeShift])

  const dayDraftTotals = useMemo(() => {
    const rowsForDate = rows.filter((r) => r.date === activeDate)
    const total = rowsForDate.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0)
    const byLine = new Map<string, number>()
    const byShift = new Map<string, number>()
    for (const r of rowsForDate) {
      const q = Number(r.quantity) || 0
      byLine.set(r.lineId, (byLine.get(r.lineId) ?? 0) + q)
      byShift.set(r.shift, (byShift.get(r.shift) ?? 0) + q)
    }
    return { total, byLine, byShift }
  }, [rows, activeDate])

  const validateRow = (r: DraftRow): RowErrors => {
    const errs: RowErrors = {}
    if (!r.date) errs.date = 'Required'
    if (!r.shift) errs.shift = 'Required'
    if (!r.lineId) errs.lineId = 'Required'
    const q = Number(String(r.quantity ?? '').replace(/,/g, ''))
    if (!Number.isFinite(q) || q <= 0) errs.quantity = 'Enter a positive quantity'
    return errs
  }

  const setCell = (rowKey: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => (r.key === rowKey ? { ...r, ...patch } : r)))
  }

  const addRow = () => {
    setRows((prev) => [...prev, newRow({ date: activeDate, shift: activeShift })])
    setTimeout(() => {
      const el = tableWrapRef.current?.querySelector<HTMLElement>('tbody tr:last-child [data-col="quantity"]')
      el?.focus()
    }, 0)
  }

  const onKeyDownCell = (e: React.KeyboardEvent, rowIdx: number, col: ColId) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const nextCol = nextCell(col, shiftEntryMode)
    const sel = `[data-cell][data-row-idx="${rowIdx}"][data-col="${nextCol}"]`
    const el = tableWrapRef.current?.querySelector<HTMLElement>(sel)
    el?.focus()
  }

  const removeRow = async (row: DraftRow) => {
    if (row.id) {
      if (!window.confirm('Delete this submitted entry?')) return
      setBusy(true)
      setGlobalError(null)
      try {
        const res = await deleteProductionEntry(row.id)
        if (!res.ok) throw new Error(res.error ?? 'Delete failed')
        setRows((prev) => prev.filter((r) => r.key !== row.key))
        await qc.invalidateQueries({ queryKey: ['productionEntries'] })
      } catch (e) {
        setGlobalError(String(e))
      } finally {
        setBusy(false)
      }
      return
    }
    setRows((prev) => prev.filter((r) => r.key !== row.key))
  }

  const submit = async () => {
    setGlobalError(null)
    const inMonth = (r: DraftRow) => r.date.startsWith(activeMonth)
    const scope = shiftEntryMode
      ? rows.filter((r) => r.date === activeDate && r.shift === activeShift)
      : rows.filter(inMonth)

    const nextRows = rows.map((r) => {
      const isScope = scope.some((x) => x.key === r.key)
      if (!isScope) return { ...r, errors: {} }
      const errs = validateRow(r)
      return { ...r, errors: errs }
    })
    setRows(nextRows)

    const hasErr = nextRows.some((r) => r.errors && Object.keys(r.errors).length > 0 && scope.some((x) => x.key === r.key))
    if (hasErr) return

    setBusy(true)
    try {
      for (const r of scope) {
        const q = Number(String(r.quantity).replace(/,/g, ''))
        const ts = new Date(`${r.date}T12:00:00`).toISOString()
        const shiftMeta = encodeShiftMeta({
          shift: r.shift,
          unit: r.unit,
          productType: r.productType,
          remarks: r.remarks,
          submittedBy: r.submittedBy,
        })

        const dupeKey = `${r.date}::${r.shift}::${r.lineId}`
        const existing = existingByKey.get(dupeKey)
        const overwriteId = existing?.id

        if (r.id) {
          const res = await updateProductionEntry({ id: r.id, lineId: r.lineId, quantity: q, ts, shift: shiftMeta })
          if (!res.ok) throw new Error(res.error ?? 'Update failed')
          continue
        }

        if (overwriteId) {
          const ok = window.confirm('Existing data found for this Line + Shift + Date.\n\nAre you sure you want to overwrite existing data?')
          if (!ok) continue
          const res = await updateProductionEntry({ id: overwriteId, lineId: r.lineId, quantity: q, ts, shift: shiftMeta })
          if (!res.ok) throw new Error(res.error ?? 'Overwrite failed')
          continue
        }

        const res = await createProductionEntry({ lineId: r.lineId, quantity: q, ts, shift: shiftMeta })
        if (!res.ok) throw new Error(res.error ?? 'Create failed')
      }

      await qc.invalidateQueries({ queryKey: ['productionEntries'] })
    } catch (e) {
      setGlobalError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const titleLineTotalsMonth = useMemo(() => {
    return LINES.map((l) => {
      const qty = monthStats.byLine.get(l.lineId) ?? 0
      return `${l.label}: ${qty.toLocaleString()}`
    }).join('  •  ')
  }, [monthStats.byLine])

  const titleShiftTotalsMonth = useMemo(() => {
    return (['A', 'B', 'C'] as const).map((s) => `${s}: ${(monthStats.byShift.get(s) ?? 0).toLocaleString()}`).join('  •  ')
  }, [monthStats.byShift])

  const calendarWeeks = useMemo(() => {
    const [y, m] = activeMonth.split('-').map(Number)
    if (!y || !m) return []
    const first = new Date(y, m - 1, 1)
    const startWeekday = (first.getDay() + 6) % 7
    const lastD = lastDayOfMonth(activeMonth)
    const cells: Array<{ d: number | null }> = []
    for (let i = 0; i < startWeekday; i++) cells.push({ d: null })
    for (let d = 1; d <= lastD; d++) cells.push({ d })
    while (cells.length % 7 !== 0) cells.push({ d: null })
    const weeks: (typeof cells)[] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
    return weeks
  }, [activeMonth])

  const visibleRows = useMemo(() => {
    if (shiftEntryMode) return rows.filter((r) => r.date === activeDate && r.shift === activeShift)
    return rows.filter((r) => r.date.startsWith(activeMonth))
  }, [rows, shiftEntryMode, activeDate, activeShift, activeMonth])

  const jumpToday = () => {
    const t = todayYm()
    setActiveMonth(t)
    setActiveDate(todayYmd())
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
            <div className="truncate text-lg font-semibold text-[var(--text)]">Production Input</div>
          </div>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Pick a month, choose a day on the calendar, then log quantities by shift. Totals below reflect the full month from saved records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--text)] transition hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)]">
            <input
              type="checkbox"
              checked={shiftEntryMode}
              onChange={(e) => setShiftEntryMode(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Shift entry (one row per line)
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save size={18} />
            Save
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,360px)_1fr]">
        {/* Left: month + calendar + distribution */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveMonth((m) => addMonths(m, -1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] transition hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <div className="text-sm font-semibold text-[var(--text)]">{formatMonthTitle(activeMonth)}</div>
                <label className="mt-2 block">
                  <span className="sr-only">Select month</span>
                  <input
                    type="month"
                    value={activeMonth}
                    onChange={(e) => setActiveMonth(e.target.value)}
                    className="mx-auto mt-1 h-9 max-w-[200px] cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-xs text-[var(--text)] outline-none focus:border-[var(--primary)]"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => setActiveMonth((m) => addMonths(m, 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] transition hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              type="button"
              onClick={jumpToday}
              className="mt-3 w-full rounded-xl border border-dashed border-[var(--border)] py-2 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              Jump to today
            </button>

            <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {WEEKDAYS.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
            <div className="mt-1 space-y-1">
              {calendarWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((cell, ci) => {
                    if (cell.d == null) {
                      return <div key={`e-${wi}-${ci}`} className="aspect-square" />
                    }
                    const ymd = `${activeMonth}-${pad2(cell.d)}`
                    const isSelected = ymd === activeDate
                    const isToday = ymd === todayYmd()
                    const dayTotal = monthStats.byDay.get(ymd) ?? 0
                    const intensity = dayTotal > 0 ? 0.15 + (dayTotal / maxDayTotal) * 0.55 : 0
                    return (
                      <button
                        key={ymd}
                        type="button"
                        onClick={() => setActiveDate(ymd)}
                        className={[
                          'relative flex aspect-square flex-col items-center justify-center rounded-xl border text-sm font-semibold transition',
                          isSelected
                            ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-[var(--text)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--primary)_35%,transparent)]'
                            : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]',
                          isToday && !isSelected ? 'ring-1 ring-[color-mix(in_srgb,var(--warning)_45%,transparent)]' : '',
                        ].join(' ')}
                        style={
                          dayTotal > 0 && !isSelected
                            ? { backgroundColor: `color-mix(in srgb, var(--primary) ${Math.round(intensity * 100)}%, var(--bg))` }
                            : undefined
                        }
                        title={dayTotal > 0 ? `${ymd}: ${dayTotal.toLocaleString()} total` : ymd}
                      >
                        <span>{cell.d}</span>
                        {dayTotal > 0 ? (
                          <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--primary)]" aria-hidden />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Month by line</div>
            <div className="mt-3 space-y-2">
              {LINES.map((l) => {
                const v = monthStats.byLine.get(l.lineId) ?? 0
                const pct = monthStats.total > 0 ? (v / monthStats.total) * 100 : 0
                return (
                  <div key={l.lineId}>
                    <div className="flex justify-between text-xs text-[var(--text)]">
                      <span className="font-medium">{l.label}</span>
                      <span className="tabular-nums text-[var(--muted)]">{v.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_8%,transparent)]">
                      <div
                        className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: KPIs + entry */}
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Month total (saved)</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--text)]">{monthStats.total.toLocaleString()}</div>
              <div className="mt-1 text-[11px] text-[var(--muted)]">{monthStats.entryCount} entries</div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Month by line</div>
              <div className="mt-1 truncate text-sm tabular-nums text-[var(--text)]" title={titleLineTotalsMonth}>
                {titleLineTotalsMonth}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Month by shift</div>
              <div className="mt-1 truncate text-sm tabular-nums text-[var(--text)]" title={titleShiftTotalsMonth}>
                {titleShiftTotalsMonth}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Selected day</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text)]">{formatDisplayDate(activeDate)}</div>
              <div className="mt-0.5 text-[11px] text-[var(--muted)]">Choose a day on the calendar</div>
            </div>
            <div className="min-w-[200px] flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Shift</div>
              <div className="mt-1 flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-1">
                {(['A', 'B', 'C'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setActiveShift(s)}
                    className={[
                      'flex-1 rounded-lg py-2 text-sm font-bold transition',
                      activeShift === s
                        ? 'bg-[var(--primary)] text-white shadow-sm'
                        : 'text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)] hover:text-[var(--text)]',
                    ].join(' ')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Selected day (draft)</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-[var(--text)]">{dayDraftTotals.total.toLocaleString()}</div>
              <div className="text-[11px] text-[var(--muted)]">Unsaved quantities in the table</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!shiftEntryMode ? (
              <>
                <button
                  type="button"
                  onClick={addRow}
                  className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)]"
                >
                  <Plus size={18} />
                  Add row
                </button>
                <span className="text-xs text-[var(--muted)]">Showing rows in {formatMonthTitle(activeMonth)}</span>
              </>
            ) : (
              <span className="text-xs text-[var(--muted)]">One row per production line — line is fixed for each row</span>
            )}
          </div>

          {globalError ? <div className="text-sm font-medium text-red-400">{globalError}</div> : null}

          <div
            ref={tableWrapRef}
            className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm"
          >
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--card)] shadow-[0_1px_0_var(--border)]">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {!shiftEntryMode ? <th className="px-3 py-3">Date</th> : null}
                  <th className="px-3 py-3">Shift</th>
                  <th className="px-3 py-3">Line</th>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">Qty</th>
                  <th className="px-3 py-3">Unit</th>
                  <th className="px-3 py-3">Remarks</th>
                  <th className="px-3 py-3">By</th>
                  <th className="px-3 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, idx) => {
                  const active = activeRowKey === r.key
                  const lineName = PLC_PRODUCTION_METERS.find((x) => x.id === r.lineId)?.name ?? ''
                  return (
                    <tr
                      key={r.key}
                      className={[
                        'align-top transition-colors',
                        active ? 'bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)]',
                      ].join(' ')}
                    >
                      {!shiftEntryMode ? (
                        <td className="border-b border-[var(--border)] px-3 py-2">
                          <input
                            data-cell
                            data-row-idx={idx}
                            data-col="date"
                            type="date"
                            value={r.date}
                            onFocus={() => setActiveRowKey(r.key)}
                            onChange={(e) => setCell(r.key, { date: e.target.value })}
                            onKeyDown={(e) => onKeyDownCell(e, idx, 'date')}
                            className="h-10 w-[150px] rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                          />
                          {r.errors?.date ? <div className="mt-1 text-xs font-medium text-red-400">{r.errors.date}</div> : null}
                        </td>
                      ) : null}
                      <td className="border-b border-[var(--border)] px-3 py-2">
                        <select
                          data-cell
                          data-row-idx={idx}
                          data-col="shift"
                          value={r.shift}
                          onFocus={() => setActiveRowKey(r.key)}
                          onChange={(e) => setCell(r.key, { shift: e.target.value as ShiftId })}
                          onKeyDown={(e) => onKeyDownCell(e, idx, 'shift')}
                          className="h-10 w-[92px] rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                        </select>
                        {r.errors?.shift ? <div className="mt-1 text-xs font-medium text-red-400">{r.errors.shift}</div> : null}
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2">
                        {shiftEntryMode ? (
                          <div className="flex min-h-10 max-w-[220px] items-center text-sm font-medium leading-snug text-[var(--text)]">
                            {lineName || r.lineId}
                          </div>
                        ) : (
                          <>
                            <select
                              data-cell
                              data-row-idx={idx}
                              data-col="line"
                              value={r.lineId}
                              onFocus={() => setActiveRowKey(r.key)}
                              onChange={(e) => setCell(r.key, { lineId: e.target.value })}
                              onKeyDown={(e) => onKeyDownCell(e, idx, 'line')}
                              className="h-10 min-w-[180px] rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                            >
                              {LINES.map((l) => (
                                <option key={l.lineId} value={l.lineId}>
                                  {l.label}
                                </option>
                              ))}
                            </select>
                            {r.errors?.lineId ? <div className="mt-1 text-xs font-medium text-red-400">{r.errors.lineId}</div> : null}
                          </>
                        )}
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2">
                        <input
                          data-cell
                          data-row-idx={idx}
                          data-col="productType"
                          value={r.productType}
                          onFocus={() => setActiveRowKey(r.key)}
                          onChange={(e) => setCell(r.key, { productType: e.target.value })}
                          onKeyDown={(e) => onKeyDownCell(e, idx, 'productType')}
                          placeholder="Optional"
                          className="h-10 w-[180px] rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                        />
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2">
                        <input
                          data-cell
                          data-row-idx={idx}
                          data-col="quantity"
                          inputMode="decimal"
                          value={r.quantity}
                          onFocus={() => setActiveRowKey(r.key)}
                          onChange={(e) => setCell(r.key, { quantity: e.target.value })}
                          onKeyDown={(e) => onKeyDownCell(e, idx, 'quantity')}
                          placeholder="0"
                          className="h-10 w-[140px] rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-semibold tabular-nums text-[var(--text)] outline-none focus:border-[var(--primary)]"
                        />
                        {r.errors?.quantity ? (
                          <div className="mt-1 text-xs font-medium text-red-400">{r.errors.quantity}</div>
                        ) : null}
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2">
                        <select
                          data-cell
                          data-row-idx={idx}
                          data-col="unit"
                          value={r.unit}
                          onFocus={() => setActiveRowKey(r.key)}
                          onChange={(e) => setCell(r.key, { unit: e.target.value as UnitId })}
                          onKeyDown={(e) => onKeyDownCell(e, idx, 'unit')}
                          className="h-10 w-[110px] rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                        >
                          <option value="kg">kg</option>
                          <option value="pcs">pcs</option>
                          <option value="batch">batch</option>
                        </select>
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2">
                        <input
                          data-cell
                          data-row-idx={idx}
                          data-col="remarks"
                          value={r.remarks}
                          onFocus={() => setActiveRowKey(r.key)}
                          onChange={(e) => setCell(r.key, { remarks: e.target.value })}
                          onKeyDown={(e) => onKeyDownCell(e, idx, 'remarks')}
                          placeholder="Optional"
                          className="h-10 w-[240px] rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                        />
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2">
                        <input
                          data-cell
                          data-row-idx={idx}
                          data-col="submittedBy"
                          value={r.submittedBy}
                          onFocus={() => setActiveRowKey(r.key)}
                          onChange={(e) => setCell(r.key, { submittedBy: e.target.value })}
                          onKeyDown={(e) => onKeyDownCell(e, idx, 'submittedBy')}
                          placeholder="Operator"
                          className="h-10 w-[170px] rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                        />
                      </td>
                      <td className="border-b border-[var(--border)] px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => removeRow(r)}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm font-semibold text-[var(--text)] transition hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] disabled:opacity-50"
                          title={r.id ? 'Delete submitted entry' : 'Remove row'}
                        >
                          <Trash2 size={18} />
                          {r.id ? 'Delete' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

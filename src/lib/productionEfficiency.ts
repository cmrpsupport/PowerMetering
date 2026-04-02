import type { EnergyInterval } from '../types'
import type { ProductionEntry } from '../types'
import { PLC_PRODUCTION_METERS, plcLineIdToEnergyMeterId } from '../constants/plcProductionMeters'

export type ChartTimeMode = 'daily' | 'weekly' | 'monthly'

export function localDayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** ISO week key (Monday start) as YYYY-MM-DD of Monday. */
export function localWeekKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return localDayKey(iso)
  const day = d.getDay()
  const diff = (day + 6) % 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return localDayKey(monday.toISOString())
}

export function localMonthKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function bucketKeyForMode(iso: string, mode: ChartTimeMode): string {
  if (mode === 'daily') return localDayKey(iso)
  if (mode === 'weekly') return localWeekKey(iso)
  return localMonthKey(iso)
}

export function isTodayLocal(iso: string): boolean {
  return localDayKey(iso) === localDayKey(new Date().toISOString())
}

/** Sum energy kWh by interval meterId (line-XX) within optional time window. */
export function sumEnergyByLine(
  ivs: EnergyInterval[],
  opts?: { sinceMs?: number; untilMs?: number },
): Map<string, number> {
  const map = new Map<string, number>()
  const a = opts?.sinceMs
  const b = opts?.untilMs
  for (const iv of ivs) {
    const t = Date.parse(iv.ts)
    if (Number.isFinite(a) && t < (a as number)) continue
    if (Number.isFinite(b) && t > (b as number)) continue
    const e = Number(iv.energyKwh)
    if (!Number.isFinite(e) || e < 0) continue
    const id = iv.meterId
    map.set(id, (map.get(id) ?? 0) + e)
  }
  return map
}

/** Sum production quantity by plc line id. */
export function sumProductionByLine(
  entries: ProductionEntry[],
  opts?: { sinceMs?: number; untilMs?: number },
): Map<string, number> {
  const map = new Map<string, number>()
  const a = opts?.sinceMs
  const b = opts?.untilMs
  for (const r of entries) {
    const t = Date.parse(r.ts)
    if (Number.isFinite(a) && t < (a as number)) continue
    if (Number.isFinite(b) && t > (b as number)) continue
    const q = Number(r.quantity)
    if (!Number.isFinite(q) || q <= 0) continue
    map.set(r.lineId, (map.get(r.lineId) ?? 0) + q)
  }
  return map
}

export function kWhPerUnit(kwh: number, units: number): number | null {
  if (!Number.isFinite(kwh) || !Number.isFinite(units) || units <= 0) return null
  return kwh / units
}

export type BucketPoint = {
  key: string
  label: string
  kwh: number
  units: number
  kwhPerUnit: number | null
}

/** Aggregate plant totals per time bucket for charts. */
export function aggregatePlantBuckets(
  ivs: EnergyInterval[],
  entries: ProductionEntry[],
  mode: ChartTimeMode,
): BucketPoint[] {
  const kwhByBucket = new Map<string, number>()
  const unitsByBucket = new Map<string, number>()

  for (const iv of ivs) {
    const e = Number(iv.energyKwh)
    if (!Number.isFinite(e) || e < 0) continue
    const k = bucketKeyForMode(iv.ts, mode)
    kwhByBucket.set(k, (kwhByBucket.get(k) ?? 0) + e)
  }

  for (const r of entries) {
    const q = Number(r.quantity)
    if (!Number.isFinite(q) || q <= 0) continue
    const k = bucketKeyForMode(r.ts, mode)
    unitsByBucket.set(k, (unitsByBucket.get(k) ?? 0) + q)
  }

  const keys = new Set([...kwhByBucket.keys(), ...unitsByBucket.keys()])
  const sorted = Array.from(keys).sort((a, b) => a.localeCompare(b))

  return sorted.map((key) => {
    const kwh = kwhByBucket.get(key) ?? 0
    const units = unitsByBucket.get(key) ?? 0
    return {
      key,
      label: formatBucketLabel(key, mode),
      kwh,
      units,
      kwhPerUnit: kWhPerUnit(kwh, units),
    }
  })
}

function formatBucketLabel(key: string, mode: ChartTimeMode): string {
  if (mode === 'monthly') {
    const [y, m] = key.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleString([], { month: 'short', year: 'numeric' })
  }
  const d = new Date(key + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return key
  if (mode === 'weekly') {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export type LineEffRow = {
  plcLineId: string
  name: string
  energyKwh: number
  units: number
  kwhPerUnit: number | null
  /** Chart helper: 0 when efficiency is null. */
  kwhBar?: number
}

export function efficiencyByLine(ivs: EnergyInterval[], entries: ProductionEntry[]): LineEffRow[] {
  const eMap = sumEnergyByLine(ivs)
  const pMap = sumProductionByLine(entries)
  return PLC_PRODUCTION_METERS.map((def) => {
    const mid = plcLineIdToEnergyMeterId(def.id)
    const energyKwh = eMap.get(mid) ?? 0
    const units = pMap.get(def.id) ?? 0
    return {
      plcLineId: def.id,
      name: def.name,
      energyKwh,
      units,
      kwhPerUnit: kWhPerUnit(energyKwh, units),
    }
  })
}

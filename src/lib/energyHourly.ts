import type { EnergyInterval } from '../types'

/** Start of local clock hour as ISO string (matches Energy Dashboard grouping). */
export function hourBucketStartIso(ts: string): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  d.setMinutes(0, 0, 0)
  d.setSeconds(0, 0)
  d.setMilliseconds(0)
  return d.toISOString()
}

export type HourlyEnergyRow = { ts: string; kwh: number; [lineKey: string]: number | string }

/**
 * Sums per-interval energy (kWh from cumulative meter diffs) into one row per local hour.
 * Preserves per-line columns when `lineKeys` is provided.
 */
export function aggregateEnergyIntervalsToHourly(
  ivs: EnergyInterval[],
  lineKeys: ReadonlySet<string>,
): HourlyEnergyRow[] {
  const buckets = new Map<string, { kwh: number; lines: Record<string, number> }>()

  for (const iv of ivs) {
    const e = Number(iv.energyKwh)
    if (!Number.isFinite(e) || e < 0) continue
    const hk = hourBucketStartIso(iv.ts)
    const cur = buckets.get(hk) ?? { kwh: 0, lines: {} }
    cur.kwh += e
    const mid = String(iv.meterId ?? '')
    if (lineKeys.has(mid)) {
      cur.lines[mid] = (cur.lines[mid] ?? 0) + e
    }
    buckets.set(hk, cur)
  }

  return Array.from(buckets.entries())
    .map(([ts, v]) => {
      const row: HourlyEnergyRow = { ts, kwh: v.kwh }
      for (const [k, val] of Object.entries(v.lines)) {
        row[k] = val
      }
      return row
    })
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
}

/** Downsample by merging consecutive rows and summing kWh (and line columns), not averaging. */
export function downsampleEnergyRowsSum(
  rows: HourlyEnergyRow[],
  maxPts: number,
  lineKeys: string[],
): HourlyEnergyRow[] {
  if (rows.length <= maxPts) return rows
  const chunk = Math.ceil(rows.length / maxPts)
  const out: HourlyEnergyRow[] = []
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk)
    const merged: HourlyEnergyRow = { ts: part[0].ts, kwh: 0 }
    for (const lk of lineKeys) merged[lk] = 0
    for (const r of part) {
      merged.kwh += Number(r.kwh) || 0
      for (const lk of lineKeys) {
        merged[lk] = (Number(merged[lk]) || 0) + (Number(r[lk]) || 0)
      }
    }
    out.push(merged)
  }
  return out
}

/**
 * For navigator: bucket kWh series by time span and sum energy in each bucket (not average).
 */
export function aggregateKwhSumByTimeBucket(
  points: Array<{ ts: string; kwh: number }>,
  bucketMs: number,
): Array<{ ts: string; kwh: number }> {
  if (points.length === 0) return []
  const out: Array<{ ts: string; kwh: number }> = []
  let bucketStart = Math.floor(Date.parse(points[0].ts) / bucketMs) * bucketMs
  let sum = 0

  for (const p of points) {
    const t = Date.parse(p.ts)
    const b = Math.floor(t / bucketMs) * bucketMs
    if (b !== bucketStart) {
      out.push({ ts: new Date(bucketStart).toISOString(), kwh: sum })
      bucketStart = b
      sum = 0
    }
    sum += Number.isFinite(p.kwh) ? p.kwh : 0
  }
  out.push({ ts: new Date(bucketStart).toISOString(), kwh: sum })
  return out
}

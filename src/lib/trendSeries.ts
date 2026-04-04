/** Time-series helpers for trend charts: bucketing and downsampling by visible span. */

export type TrendPoint = {
  ts: string
  kw: number
  voltageV: number
  currentA: number
  /** System frequency (Hz) when available from telemetry. */
  frequencyHz?: number
  pf?: number
  kvar?: number
}

/** Target bucket size (ms) from the span of data being shown. */
export function bucketMsForVisibleSpan(spanMs: number): number {
  if (!Number.isFinite(spanMs) || spanMs <= 0) return 60 * 1000
  if (spanMs <= 6 * 60 * 60 * 1000) return 60 * 1000 // ≤6h: ~1 min
  if (spanMs <= 24 * 60 * 60 * 1000) return 5 * 60 * 1000 // ≤24h: 5 min
  if (spanMs <= 7 * 24 * 60 * 60 * 1000) return 60 * 60 * 1000 // ≤7d: hourly
  if (spanMs <= 30 * 24 * 60 * 60 * 1000) return 24 * 60 * 60 * 1000 // ≤30d: daily
  return 24 * 60 * 60 * 1000 // longer: daily
}

/** Bucket size for the full-series navigator strip (slightly coarser than main for perf). */
export function bucketMsForNavigatorFullSpan(fullSpanMs: number, maxBuckets: number): number {
  if (!Number.isFinite(fullSpanMs) || fullSpanMs <= 0) return 60 * 1000
  const base = bucketMsForVisibleSpan(fullSpanMs)
  const minBuckets = Math.max(24, Math.floor(maxBuckets))
  const needed = fullSpanMs / minBuckets
  return Math.max(base, Math.ceil(needed / (60 * 1000)) * 60 * 1000)
}

function avg(nums: number[]): number {
  const a = nums.filter((n) => Number.isFinite(n))
  if (a.length === 0) return NaN
  return a.reduce((s, n) => s + n, 0) / a.length
}

function avgNullable(nums: (number | null | undefined)[]): number | null {
  const a = nums.filter((x): x is number => x !== null && x !== undefined && Number.isFinite(x))
  if (a.length === 0) return null
  return a.reduce((s, n) => s + n, 0) / a.length
}

/** Aggregate sorted points into fixed time buckets (left edge = bucket start). */
export function aggregateTrendByBucket(points: TrendPoint[], bucketMs: number): TrendPoint[] {
  if (points.length === 0) return []
  const out: TrendPoint[] = []
  let bucketStart = Math.floor(Date.parse(points[0].ts) / bucketMs) * bucketMs
  let buf: TrendPoint[] = []

  const flush = () => {
    if (buf.length === 0) return
    const ts = new Date(bucketStart).toISOString()
    const pfs = buf.map((p) => p.pf).filter((v): v is number => v !== undefined && Number.isFinite(v))
    const kvars = buf.map((p) => p.kvar).filter((v): v is number => v !== undefined && Number.isFinite(v))
    const freqs = buf.map((p) => p.frequencyHz).filter((v): v is number => v !== undefined && Number.isFinite(v))
    out.push({
      ts,
      kw: avg(buf.map((p) => p.kw)),
      voltageV: avg(buf.map((p) => p.voltageV)),
      currentA: avg(buf.map((p) => p.currentA)),
      ...(freqs.length ? { frequencyHz: freqs.reduce((a, b) => a + b, 0) / freqs.length } : {}),
      ...(pfs.length ? { pf: pfs.reduce((a, b) => a + b, 0) / pfs.length } : {}),
      ...(kvars.length ? { kvar: kvars.reduce((a, b) => a + b, 0) / kvars.length } : {}),
    })
    buf = []
  }

  for (const p of points) {
    const t = Date.parse(p.ts)
    const b = Math.floor(t / bucketMs) * bucketMs
    if (b !== bucketStart) {
      flush()
      bucketStart = b
    }
    buf.push(p)
  }
  flush()
  return out
}

export const MAX_MAIN_CHART_POINTS = 1400

type Sev = 'warning' | 'critical' | null

function mergeSev(a: Sev, b: Sev): Sev {
  if (a === 'critical' || b === 'critical') return 'critical'
  if (a === 'warning' || b === 'warning') return 'warning'
  return null
}

/** Fluctuation row shape (matches Dashboard fluctuation.points entries). */
export type FluctuationBucketPoint = TrendPoint & {
  kwSmooth: number
  voltageSmooth: number
  currentSmooth: number
  kwDelta: number
  kwDeltaPct: number | null
  voltageDelta: number
  voltageDeltaPct: number | null
  currentDelta: number
  currentDeltaPct: number | null
  flagKw: Sev
  flagVoltage: Sev
  flagCurrent: Sev
}

/**
 * Time-bucket aggregate for fluctuation chart rows (preserves tooltip fields; flags = worst in bucket).
 */
export function aggregateFluctuationByBucket(points: FluctuationBucketPoint[], bucketMs: number): FluctuationBucketPoint[] {
  if (points.length === 0) return []
  const out: FluctuationBucketPoint[] = []
  let bucketStart = Math.floor(Date.parse(points[0].ts) / bucketMs) * bucketMs
  let buf: FluctuationBucketPoint[] = []

  const flush = () => {
    if (buf.length === 0) return
    const ts = new Date(bucketStart).toISOString()
    let fk: Sev = null
    let fv: Sev = null
    let fi: Sev = null
    for (const p of buf) {
      fk = mergeSev(fk, p.flagKw)
      fv = mergeSev(fv, p.flagVoltage)
      fi = mergeSev(fi, p.flagCurrent)
    }
    out.push({
      ts,
      kw: avg(buf.map((p) => p.kw)),
      voltageV: avg(buf.map((p) => p.voltageV)),
      currentA: avg(buf.map((p) => p.currentA)),
      kwSmooth: avg(buf.map((p) => p.kwSmooth)),
      voltageSmooth: avg(buf.map((p) => p.voltageSmooth)),
      currentSmooth: avg(buf.map((p) => p.currentSmooth)),
      kwDelta: avg(buf.map((p) => p.kwDelta)),
      kwDeltaPct: avgNullable(buf.map((p) => p.kwDeltaPct)),
      voltageDelta: avg(buf.map((p) => p.voltageDelta)),
      voltageDeltaPct: avgNullable(buf.map((p) => p.voltageDeltaPct)),
      currentDelta: avg(buf.map((p) => p.currentDelta)),
      currentDeltaPct: avgNullable(buf.map((p) => p.currentDeltaPct)),
      flagKw: fk,
      flagVoltage: fv,
      flagCurrent: fi,
    })
    buf = []
  }

  for (const p of points) {
    const t = Date.parse(p.ts)
    const b = Math.floor(t / bucketMs) * bucketMs
    if (b !== bucketStart) {
      flush()
      bucketStart = b
    }
    buf.push(p)
  }
  flush()
  return out
}

/**
 * Downsample for rendering: adaptive bucket size then cap (main chart).
 */
export function downsampleTrendForChart(points: TrendPoint[], spanMs: number, bucketMsOverride?: number): TrendPoint[] {
  if (points.length === 0) return []
  const bucketMs = bucketMsOverride ?? bucketMsForVisibleSpan(spanMs)
  let agg = aggregateTrendByBucket(points, bucketMs)
  if (agg.length <= MAX_MAIN_CHART_POINTS) return agg
  const stride = Math.ceil(agg.length / MAX_MAIN_CHART_POINTS)
  const thin: TrendPoint[] = []
  for (let i = 0; i < agg.length; i += stride) thin.push(agg[i])
  return thin
}

export function capFluctuationSeries(points: FluctuationBucketPoint[]): FluctuationBucketPoint[] {
  if (points.length <= MAX_MAIN_CHART_POINTS) return points
  const stride = Math.ceil(points.length / MAX_MAIN_CHART_POINTS)
  const thin: FluctuationBucketPoint[] = []
  for (let i = 0; i < points.length; i += stride) thin.push(points[i])
  return thin
}

import type { TrendPoint } from './trendSeries'

export type FluctuationSeverity = 'warning' | 'critical'
export type FluctuationMetric = 'kw' | 'voltage' | 'current'

export type FluctuationAlert = {
  id: string
  ts: string
  metric: FluctuationMetric
  severity: FluctuationSeverity
  value: number
  prevValue: number
  delta: number
  deltaPct: number | null
}

type Options = {
  /** Max alerts returned (newest first after sort). Default 200 for chart markers; use 5–20 for compact lists. */
  maxAlerts?: number
  /**
   * Skip fluctuation checks where consecutive points are farther apart than this (ms).
   * Prevents false spikes at the edges of data gaps (e.g. shutdown → restart).
   * If omitted, auto-detected as 3× the median inter-point interval.
   */
  skipGapMs?: number
}

/**
 * Detect step-to-step spikes on kW, voltage, or current (% change vs previous bucket).
 * Rules match dashboard SCADA: |Δ%| &gt; 40% → critical, &gt; 25% → warning.
 * Comparisons that span a data gap are skipped to avoid false positives on restart.
 */
export function computeFluctuationAlerts(points: TrendPoint[], opts?: Options): FluctuationAlert[] {
  const maxAlerts = opts?.maxAlerts ?? 200
  if (points.length < 2) return []

  // Auto-detect gap threshold from the median inter-point interval unless caller supplies one.
  let skipGapMs = opts?.skipGapMs ?? 0
  if (skipGapMs <= 0 && points.length >= 4) {
    const intervals: number[] = []
    for (let j = 1; j < points.length; j++) {
      const d = Date.parse(points[j]!.ts) - Date.parse(points[j - 1]!.ts)
      if (d > 0) intervals.push(d)
    }
    if (intervals.length > 0) {
      intervals.sort((a, b) => a - b)
      const median = intervals[Math.floor(intervals.length / 2)]!
      skipGapMs = median * 3
    }
  }

  const alerts: FluctuationAlert[] = []
  for (let i = 1; i < points.length; i++) {
    const cur = points[i]
    const prev = points[i - 1]
    if (!cur || !prev) continue

    // Skip the first comparison after a data gap — the jump reflects the gap, not a real spike.
    if (skipGapMs > 0 && Date.parse(cur.ts) - Date.parse(prev.ts) > skipGapMs) continue

    const check = (metric: FluctuationMetric, value: number, prevValue: number) => {
      const denom = Math.max(1e-6, Math.abs(prevValue))
      const delta = value - prevValue
      const deltaPct = Number.isFinite(prevValue) && Math.abs(prevValue) > 1e-6 ? delta / denom : null
      const absPct = deltaPct === null ? 0 : Math.abs(deltaPct)
      const severity: FluctuationSeverity | null = absPct > 0.4 ? 'critical' : absPct > 0.25 ? 'warning' : null
      if (!severity) return
      alerts.push({
        id: `${metric}:${cur.ts}`,
        ts: cur.ts,
        metric,
        severity,
        value,
        prevValue,
        delta,
        deltaPct,
      })
    }

    check('kw', cur.kw, prev.kw)
    check('voltage', cur.voltageV, prev.voltageV)
    check('current', cur.currentA, prev.currentA)
  }

  return alerts
    .sort((a, b) => (a.ts < b.ts ? 1 : -1))
    .slice(0, maxAlerts)
}

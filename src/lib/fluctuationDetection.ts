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
}

/**
 * Detect step-to-step spikes on kW, voltage, or current (% change vs previous bucket).
 * Rules match dashboard SCADA: |Δ%| &gt; 40% → critical, &gt; 25% → warning.
 */
export function computeFluctuationAlerts(points: TrendPoint[], opts?: Options): FluctuationAlert[] {
  const maxAlerts = opts?.maxAlerts ?? 200
  if (points.length < 2) return []

  const alerts: FluctuationAlert[] = []
  for (let i = 1; i < points.length; i++) {
    const cur = points[i]
    const prev = points[i - 1]
    if (!cur || !prev) continue

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

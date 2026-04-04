/**
 * Linear-regression demand forecasting from recent trend data.
 * Used by the SCADA dashboard to predict near-future demand and
 * estimate time-to-threshold.
 */

export type DemandPrediction = {
  /** Predicted demand 15 minutes from now (kW). */
  predictedKw: number
  /** Seconds until threshold would be exceeded (null = won't exceed within 1 h). */
  secondsToThreshold: number | null
  /** Will the predicted value exceed threshold? */
  willExceed: boolean
  /** R²-based confidence (0–1). */
  confidence: number
  /** Slope of the linear fit (kW / second). Positive = rising. */
  slope: number
}

/**
 * Fit a line through recent demand samples and extrapolate forward.
 *
 * @param trend   Raw demand trend points (ts + kw).
 * @param thresholdKw Demand threshold (kW).
 * @param lookbackMinutes How far back to use for the regression (default 15 min).
 */
export function predictDemand(
  trend: { ts: string; kw: number }[],
  thresholdKw: number,
  lookbackMinutes = 15,
): DemandPrediction {
  const empty: DemandPrediction = {
    predictedKw: 0,
    secondsToThreshold: null,
    willExceed: false,
    confidence: 0,
    slope: 0,
  }

  if (trend.length < 3) return empty

  const now = Date.now()
  const cutoff = now - lookbackMinutes * 60_000
  const recent = trend
    .map((p) => ({ t: Date.parse(p.ts), kw: Number(p.kw) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.kw) && p.t >= cutoff)
    .sort((a, b) => a.t - b.t)

  if (recent.length < 2) {
    const lastKw = trend[trend.length - 1]?.kw ?? 0
    return { ...empty, predictedKw: lastKw }
  }

  // ---- linear regression (x = seconds from first sample, y = kW) ----
  const t0 = recent[0].t
  const n = recent.length
  const xs = recent.map((p) => (p.t - t0) / 1000)
  const ys = recent.map((p) => p.kw)

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0
  for (let i = 0; i < n; i++) {
    sumX += xs[i]
    sumY += ys[i]
    sumXY += xs[i] * ys[i]
    sumXX += xs[i] * xs[i]
  }

  const denom = n * sumXX - sumX * sumX
  if (Math.abs(denom) < 1e-9) {
    const avg = sumY / n
    return { ...empty, predictedKw: avg, willExceed: thresholdKw > 0 && avg > thresholdKw, confidence: 0.3 }
  }

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  // ---- predict 15 min ahead ----
  const nowSec = (now - t0) / 1000
  const futureSec = nowSec + 900
  const predictedKw = Math.max(0, intercept + slope * futureSec)
  const currentPredicted = intercept + slope * nowSec

  // ---- time to threshold ----
  let secondsToThreshold: number | null = null
  if (thresholdKw > 0 && slope > 0 && currentPredicted < thresholdKw) {
    const secFromStart = (thresholdKw - intercept) / slope
    const secFromNow = secFromStart - nowSec
    if (secFromNow > 0 && secFromNow < 3600) {
      secondsToThreshold = Math.round(secFromNow)
    }
  }

  const willExceed = thresholdKw > 0 && predictedKw > thresholdKw

  // ---- R² for confidence ----
  const yMean = sumY / n
  let ssTot = 0,
    ssRes = 0
  for (let i = 0; i < n; i++) {
    ssTot += (ys[i] - yMean) ** 2
    ssRes += (ys[i] - (intercept + slope * xs[i])) ** 2
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0
  const confidence = Math.max(0, Math.min(1, r2 * Math.min(1, n / 10)))

  return { predictedKw, secondsToThreshold, willExceed, confidence, slope }
}

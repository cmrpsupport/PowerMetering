import type { ConsumptionGranularity, EnergyInterval } from '../types'
import { bucketForTimestamp, type ConsumptionReportBucket } from './consumptionReport'

export function intervalsForBucket(
  ivs: EnergyInterval[],
  bucketKey: string,
  g: ConsumptionGranularity,
): EnergyInterval[] {
  return ivs.filter((iv) => bucketForTimestamp(iv.ts, g).key === bucketKey)
}

export type PeakDemandInfo = {
  demandKw: number
  ts: string
  meterName: string
}

/** Highest single-interval demand in the dataset (for peak context). */
export function findGlobalPeakDemand(ivs: EnergyInterval[]): PeakDemandInfo | null {
  let best: PeakDemandInfo | null = null
  for (const iv of ivs) {
    if (!Number.isFinite(iv.demandKw)) continue
    if (!best || iv.demandKw > best.demandKw) {
      best = { demandKw: iv.demandKw, ts: iv.ts, meterName: iv.meterName }
    }
  }
  return best
}

export type EnergyInsightResult = {
  title: string
  bullets: string[]
  recommendations: string[]
}

function sumBucketEnergy(b: ConsumptionReportBucket): number {
  return b.totalEnergyKwh
}

function lineSharePct(b: ConsumptionReportBucket, line: string, total: number): number {
  if (total <= 0) return 0
  return ((b.byMeter[line]?.energyKwh ?? 0) / total) * 100
}

/**
 * Rule-based “insights” from aggregated buckets (no external AI).
 */
export function buildEnergyInsights(
  buckets: ConsumptionReportBucket[],
  meterNames: string[],
  granularity: ConsumptionGranularity,
): EnergyInsightResult {
  const n = buckets.length
  const title =
    granularity === 'daily'
      ? `Energy insights (last ${Math.min(n, 5)} day${n !== 1 ? 's' : ''})`
      : `Energy insights (${granularity}, ${n} bucket${n !== 1 ? 's' : ''})`

  const bullets: string[] = []
  const recommendations: string[] = []

  if (n === 0) {
    return {
      title,
      bullets: ['No interval data in the selected window.'],
      recommendations: ['Verify historian connectivity and widen the report range.'],
    }
  }

  const recent = buckets.slice(-5)
  const prior = buckets.slice(-10, -5)
  const recentTotal = recent.reduce((s, b) => s + sumBucketEnergy(b), 0)
  const priorTotal = prior.length > 0 ? prior.reduce((s, b) => s + sumBucketEnergy(b), 0) : 0

  if (prior.length > 0 && priorTotal > 1e-6) {
    const pct = ((recentTotal - priorTotal) / priorTotal) * 100
    bullets.push(
      `Total consumption ${pct >= 0 ? 'increased' : 'decreased'} by ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs the prior comparable window.`,
    )
    if (pct > 15) recommendations.push('Review load schedule and top contributors in the stacked chart.')
    if (pct < -10) recommendations.push('Confirm production output vs energy — sustained drops may indicate downtime or metering gaps.')
  } else {
    bullets.push(`Total energy over visible buckets: ${recentTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh.`)
  }

  // Top contributor (last bucket)
  const last = buckets[buckets.length - 1]!
  const lastTotal = sumBucketEnergy(last) || 1
  let topLine = meterNames[0] ?? ''
  let topShare = 0
  for (const m of meterNames) {
    const sh = lineSharePct(last, m, lastTotal)
    if (sh > topShare) {
      topShare = sh
      topLine = m
    }
  }
  if (topLine && topShare > 0) {
    bullets.push(`${topLine} contributed about ${topShare.toFixed(0)}% of energy in the latest bucket.`)
    if (topShare > 55) recommendations.push(`Investigate load distribution on ${topLine} (high share of plant total).`)
  }

  // Spike: largest line WoW / bucket-over-bucket jump for daily
  if (n >= 2 && granularity === 'daily') {
    let worst: { line: string; pct: number; label: string } | null = null
    for (let i = 1; i < buckets.length; i++) {
      const prev = buckets[i - 1]!
      const cur = buckets[i]!
      for (const m of meterNames) {
        const a = prev.byMeter[m]?.energyKwh ?? 0
        const b = cur.byMeter[m]?.energyKwh ?? 0
        if (a < 1) continue
        const pct = ((b - a) / a) * 100
        if (!worst || pct > worst.pct) worst = { line: m, pct, label: cur.label }
      }
    }
    if (worst && worst.pct >= 30) {
      bullets.push(`${worst.line} spiked about +${worst.pct.toFixed(0)}% on ${worst.label}.`)
      recommendations.push(`Check abnormal load or batch run timing on ${worst.line}.`)
    }
  }

  // Stable lines (low variance last 3 buckets)
  if (n >= 3) {
    const stable: string[] = []
    for (const m of meterNames) {
      const vals = buckets.slice(-3).map((b) => b.byMeter[m]?.energyKwh ?? 0)
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length
      if (mean < 1) continue
      const dev = Math.max(...vals.map((v) => Math.abs(v - mean))) / mean
      if (dev < 0.08) stable.push(m)
    }
    if (stable.length > 0) bullets.push(`${stable.slice(0, 4).join(', ')}${stable.length > 4 ? '…' : ''} look stable (last 3 buckets).`)
  }

  if (recommendations.length === 0) recommendations.push('Continue routine monitoring; export CSV for deeper variance analysis if needed.')

  return { title, bullets, recommendations }
}

export type PeriodComparison = {
  vsPrevPct: number | null
  vsWeekAvgPct: number | null
}

export function computePeriodComparisons(buckets: ConsumptionReportBucket[], granularity: ConsumptionGranularity): PeriodComparison {
  if (buckets.length < 2) return { vsPrevPct: null, vsWeekAvgPct: null }
  const totals = buckets.map(sumBucketEnergy)
  const last = totals[totals.length - 1]!
  const prev = totals[totals.length - 2]!
  const vsPrevPct = prev > 1e-6 ? ((last - prev) / prev) * 100 : null

  let vsWeekAvgPct: number | null = null
  if (granularity === 'daily' && totals.length >= 8) {
    const last7 = totals.slice(-7)
    const prev7 = totals.slice(-14, -7)
    if (prev7.length >= 3) {
      const a = last7.reduce((s, v) => s + v, 0) / last7.length
      const b = prev7.reduce((s, v) => s + v, 0) / prev7.length
      if (b > 1e-6) vsWeekAvgPct = ((a - b) / b) * 100
    }
  }

  return { vsPrevPct, vsWeekAvgPct }
}

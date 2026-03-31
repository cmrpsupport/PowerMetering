import type { ConsumptionGranularity, EnergyInterval } from '../types'

/** Hours of 15‑min intervals to request for each report granularity (mock/API). */
export const CONSUMPTION_REPORT_HOURS: Record<ConsumptionGranularity, number> = {
  hourly: 72,
  daily: 720,
  weekly: 2016,
  monthly: 2160,
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Stable bucket key + human label for grouping intervals. */
export function bucketForTimestamp(ts: string, g: ConsumptionGranularity): { key: string; label: string; sortKey: string } {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = d.getMonth()
  const day = d.getDate()
  const h = d.getHours()

  if (g === 'hourly') {
    const key = `${y}-${pad2(m + 1)}-${pad2(day)}T${pad2(h)}`
    const label = `${d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' })}`
    return { key, label, sortKey: key }
  }

  if (g === 'daily') {
    const key = `${y}-${pad2(m + 1)}-${pad2(day)}`
    const label = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    return { key, label, sortKey: key }
  }

  if (g === 'weekly') {
    const x = new Date(d)
    const dow = (x.getDay() + 6) % 7
    x.setDate(x.getDate() - dow)
    const key = `W${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`
    const label = `Week of ${x.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
    return { key, label, sortKey: key }
  }

  const key = `${y}-${pad2(m + 1)}`
  const label = d.toLocaleString([], { month: 'long', year: 'numeric' })
  return { key, label, sortKey: key }
}

export type ConsumptionReportBucket = {
  key: string
  label: string
  sortKey: string
  /** Latest sample timestamp seen in this bucket (for TIME column export). */
  lastTs: string
  totalEnergyKwh: number
  peakDemandKw: number
  byMeter: Record<string, { energyKwh: number; peakDemandKw: number; cumulativeKwhEnd: number | null }>
}

export function aggregateConsumptionIntervals(
  intervals: EnergyInterval[],
  g: ConsumptionGranularity,
): ConsumptionReportBucket[] {
  const map = new Map<
    string,
    {
      label: string
      sortKey: string
      lastTs: string
      totalEnergyKwh: number
      peakDemandKw: number
      byMeter: Record<string, { energyKwh: number; peakDemandKw: number; cumulativeKwhEnd: number | null }>
    }
  >()

  for (const iv of intervals) {
    const { key, label, sortKey } = bucketForTimestamp(iv.ts, g)
    let row = map.get(key)
    if (!row) {
      row = {
        label,
        sortKey,
        lastTs: iv.ts,
        totalEnergyKwh: 0,
        peakDemandKw: 0,
        byMeter: {},
      }
      map.set(key, row)
    }
    if (Date.parse(iv.ts) > Date.parse(row.lastTs)) row.lastTs = iv.ts
    row.totalEnergyKwh += iv.energyKwh
    row.peakDemandKw = Math.max(row.peakDemandKw, iv.demandKw)

    const mn = iv.meterName
    if (!row.byMeter[mn]) {
      row.byMeter[mn] = { energyKwh: 0, peakDemandKw: 0, cumulativeKwhEnd: null }
    }
    const m = row.byMeter[mn]
    m.energyKwh += iv.energyKwh
    m.peakDemandKw = Math.max(m.peakDemandKw, iv.demandKw)
    if (typeof iv.cumulativeKwh === 'number' && Number.isFinite(iv.cumulativeKwh)) {
      m.cumulativeKwhEnd = Math.max(m.cumulativeKwhEnd ?? 0, iv.cumulativeKwh)
    }
  }

  const buckets: ConsumptionReportBucket[] = Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      label: v.label,
      sortKey: v.sortKey,
      lastTs: v.lastTs,
      totalEnergyKwh: v.totalEnergyKwh,
      peakDemandKw: v.peakDemandKw,
      byMeter: v.byMeter,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  return buckets
}

export function consumptionReportToCsv(
  buckets: ConsumptionReportBucket[],
  granularity: ConsumptionGranularity,
): string {
  const meterNames = new Set<string>()
  for (const b of buckets) {
    for (const m of Object.keys(b.byMeter)) meterNames.add(m)
  }
  const meters = Array.from(meterNames).sort()

  // Spreadsheet-like export (as per provided format):
  // Row 1: MONTH,DAY,TIME,<PM1>,,<PM2>,, ...
  // Row 2: ,,,(cumulative),KWH,(cumulative),KWH, ...
  // Add a final TOTAL KWH column (sum of DAILY across all lines).
  const header1 = ['MONTH', 'DAY', 'TIME', ...meters.flatMap((m) => [m, '']), 'TOTAL KWH']
  const header2 = ['', '', '', ...meters.flatMap(() => ['', 'KWH']), 'KWH']
  const lines = [header1.join(','), header2.join(',')]

  const fmtMonth = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleString([], { month: 'long' })
  }

  const fmtDay = (ts: string) => {
    const d = new Date(ts)
    if (granularity === 'weekly' || granularity === 'monthly') {
      return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
    }
    return String(d.getDate())
  }

  const fmtTime = (ts: string) => {
    const d = new Date(ts)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}${mm}`
  }

  for (const b of buckets) {
    const month = fmtMonth(b.lastTs)
    const day = fmtDay(b.lastTs)
    const time = granularity === 'hourly' ? fmtTime(b.lastTs) : ''
    const row = [month, day, time]
    let sumDailyAll = 0
    for (const m of meters) {
      const cell = b.byMeter[m]
      row.push(cell?.cumulativeKwhEnd !== null ? String(cell.cumulativeKwhEnd) : '')
      const daily = cell ? cell.energyKwh : 0
      sumDailyAll += daily
      row.push(cell ? daily.toFixed(3) : '')
    }
    row.push(sumDailyAll.toFixed(3))
    lines.push(row.join(','))
  }

  // Totals row (sum DAILY, blank cumulative)
  const totals = ['TOTAL', '', '']
  let sumAllLines = 0
  for (const m of meters) {
    totals.push('')
    const sumDaily = buckets.reduce((s, b) => s + (b.byMeter[m]?.energyKwh ?? 0), 0)
    sumAllLines += sumDaily
    totals.push(sumDaily.toFixed(3))
  }
  totals.push(sumAllLines.toFixed(3))
  lines.push(totals.join(','))

  lines.unshift(`# Consumption report (${granularity})`)
  return lines.join('\n')
}

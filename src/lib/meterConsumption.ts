import { PLC_METERS, findPlcMeter } from '../constants/plcMeters'
import type { ConsumptionGranularity, MeterIntervalBucket, MeterIntervalRow } from '../types'
import { bucketForTimestamp, type ConsumptionReportBucket } from './consumptionReport'

const METER_ORDER: string[] = PLC_METERS.map((m) => m.name)

function meterDisplayName(meterId: string): string {
  return findPlcMeter(meterId)?.name ?? meterId
}

export function sortMeterDisplayNames(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const ia = METER_ORDER.indexOf(a)
    const ib = METER_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

const GRANULARITY_BUCKET: Record<ConsumptionGranularity, MeterIntervalBucket> = {
  hourly: 'hour',
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
}

const GRANULARITY_PERIODS: Record<ConsumptionGranularity, number> = {
  hourly: 72,
  daily: 30,
  weekly: 12,
  monthly: 12,
}

export function meterBucketForGranularity(g: ConsumptionGranularity): MeterIntervalBucket {
  return GRANULARITY_BUCKET[g]
}

export function meterPeriodsForGranularity(g: ConsumptionGranularity): number {
  return GRANULARITY_PERIODS[g]
}

/** Convert pre-aggregated server rows into the table's bucket shape. */
export function meterIntervalsToBuckets(
  rows: MeterIntervalRow[],
  granularity: ConsumptionGranularity,
): ConsumptionReportBucket[] {
  const map = new Map<string, ConsumptionReportBucket>()
  for (const r of rows) {
    const { key, label, sortKey } = bucketForTimestamp(r.ts, granularity)
    let row = map.get(key)
    if (!row) {
      row = {
        key,
        label,
        sortKey,
        lastTs: r.ts,
        totalEnergyKwh: 0,
        peakDemandKw: 0,
        byMeter: {},
      }
      map.set(key, row)
    }
    if (Date.parse(r.ts) > Date.parse(row.lastTs)) row.lastTs = r.ts
    const name = meterDisplayName(r.meterId)
    const cell =
      row.byMeter[name] ??
      (row.byMeter[name] = { energyKwh: 0, peakDemandKw: 0, cumulativeKwhEnd: null })
    cell.energyKwh += r.energyKwh
    cell.cumulativeKwhEnd = Number.isFinite(r.cumulativeKwh) ? r.cumulativeKwh : cell.cumulativeKwhEnd
    row.totalEnergyKwh += r.energyKwh
  }
  return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

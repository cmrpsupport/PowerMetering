import { PLC_METERS, findPlcMeter } from '../constants/plcMeters'
import type { ConsumptionGranularity, MeterSamplePoint } from '../types'
import { bucketForTimestamp, type ConsumptionReportBucket } from './consumptionReport'

const MAX_PLAUSIBLE_KW_PER_METER = 2000
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

export function meterPointsToBuckets(
  points: MeterSamplePoint[],
  granularity: ConsumptionGranularity,
): ConsumptionReportBucket[] {
  const byMeter = new Map<string, MeterSamplePoint[]>()
  for (const p of points) {
    if (!Number.isFinite(p.realEnergyKwh)) continue
    const arr = byMeter.get(p.meterId) ?? []
    arr.push(p)
    byMeter.set(p.meterId, arr)
  }
  for (const arr of byMeter.values()) {
    arr.sort((a, b) => a.ts.localeCompare(b.ts))
  }

  const map = new Map<string, ConsumptionReportBucket>()

  for (const [meterId, arr] of byMeter) {
    const displayName = meterDisplayName(meterId)
    let prev: MeterSamplePoint | null = null

    for (const curr of arr) {
      let delta = 0
      if (prev) {
        const intervalSec = Math.max(1, (Date.parse(curr.ts) - Date.parse(prev.ts)) / 1000)
        const raw = curr.realEnergyKwh - prev.realEnergyKwh
        const cap = (MAX_PLAUSIBLE_KW_PER_METER * intervalSec) / 3600
        delta = raw < 0 || raw > cap ? 0 : raw
      }
      prev = curr

      const { key, label, sortKey } = bucketForTimestamp(curr.ts, granularity)
      let row = map.get(key)
      if (!row) {
        row = {
          key,
          label,
          sortKey,
          lastTs: curr.ts,
          totalEnergyKwh: 0,
          peakDemandKw: 0,
          byMeter: {},
        }
        map.set(key, row)
      }
      if (Date.parse(curr.ts) > Date.parse(row.lastTs)) row.lastTs = curr.ts

      const cell =
        row.byMeter[displayName] ??
        (row.byMeter[displayName] = { energyKwh: 0, peakDemandKw: 0, cumulativeKwhEnd: null })

      cell.energyKwh += delta
      cell.cumulativeKwhEnd = Number.isFinite(curr.realEnergyKwh) ? curr.realEnergyKwh : cell.cumulativeKwhEnd
      if (Number.isFinite(curr.realPowerKw)) {
        cell.peakDemandKw = Math.max(cell.peakDemandKw, curr.realPowerKw)
      }
      row.totalEnergyKwh += delta
      if (Number.isFinite(curr.realPowerKw)) {
        row.peakDemandKw = Math.max(row.peakDemandKw, curr.realPowerKw)
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

export function meterMinutesForGranularity(g: ConsumptionGranularity): number {
  if (g === 'hourly') return 60 * 24 * 3
  if (g === 'daily') return 60 * 24 * 30
  if (g === 'weekly') return 60 * 24 * 84
  return 60 * 24 * 90
}

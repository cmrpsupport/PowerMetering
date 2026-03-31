import type { CostRate, EnergyInterval, LoadProfile } from '../../types'
import { PLC_PRODUCTION_METERS } from '../../constants/plcProductionMeters'
import { round, seededNoise, sleep } from './helpers'

const costRates: CostRate[] = [
  { id: 'rate-001', name: 'On-Peak', tier: 'on-peak', ratePerKwh: 0.18, demandChargePerKw: 12.50, startHour: 14, endHour: 20, color: '#ef4444' },
  { id: 'rate-002', name: 'Mid-Peak', tier: 'mid-peak', ratePerKwh: 0.12, demandChargePerKw: 8.00, startHour: 8, endHour: 14, color: '#f59e0b' },
  { id: 'rate-003', name: 'Off-Peak', tier: 'off-peak', ratePerKwh: 0.06, demandChargePerKw: 4.00, startHour: 20, endHour: 8, color: '#22c55e' },
]

function getTierForHour(hour: number): CostRate {
  if (hour >= 14 && hour < 20) return costRates[0]
  if (hour >= 8 && hour < 14) return costRates[1]
  return costRates[2]
}

const meterProfiles = PLC_PRODUCTION_METERS.map((m) => ({
  id: m.id,
  name: m.name,
  baseKw: m.baseKw,
}))

function generateEnergyIntervals(hours: number): EnergyInterval[] {
  const intervals: EnergyInterval[] = []
  const now = new Date()
  const intervalsCount = hours * 4 // 15-min intervals

  for (let i = intervalsCount - 1; i >= 0; i--) {
    const ts = new Date(now.getTime() - i * 15 * 60_000)
    const hour = ts.getHours()
    const rate = getTierForHour(hour)

    for (const mp of meterProfiles) {
      if (mp.baseKw === 0) continue
      const timeOfDay = hour + ts.getMinutes() / 60
      const dayShape = 0.6 + 0.4 * Math.sin((timeOfDay - 4) * Math.PI / 12)
      const noise = seededNoise(i * 7 + Number(mp.id.replace(/\D/g, '')) * 31) * 0.08
      const demandKw = round(mp.baseKw * dayShape * (1 + noise), 2)
      const energyKwh = round(demandKw * 0.25, 3)
      const costDollars = round(energyKwh * rate.ratePerKwh, 4)

      intervals.push({
        ts: ts.toISOString(),
        meterId: mp.id,
        meterName: mp.name,
        energyKwh,
        demandKw,
        costDollars,
        rateTier: rate.tier,
      })
    }
  }

  return intervals
}

function generateLoadProfile(meterId: string, meterName: string, baseKw: number): LoadProfile {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const intervals: { ts: string; demandKw: number }[] = []
  let peakDemandKw = 0
  let peakTs = today.toISOString()
  let totalKw = 0
  const meterNum = Number(meterId.replace(/\D/g, '')) || 1

  for (let i = 0; i < 96; i++) {
    const ts = new Date(today.getTime() + i * 15 * 60_000)
    const hour = ts.getHours() + ts.getMinutes() / 60
    const dayShape = 0.5 + 0.5 * Math.sin((hour - 4) * Math.PI / 12)
    const noise = seededNoise(i * 13 + meterNum * 47) * 0.06
    const demandKw = round(baseKw * dayShape * (1 + noise), 2)

    intervals.push({ ts: ts.toISOString(), demandKw })
    totalKw += demandKw
    if (demandKw > peakDemandKw) {
      peakDemandKw = demandKw
      peakTs = ts.toISOString()
    }
  }

  const avgDemandKw = round(totalKw / 96, 2)
  const loadFactor = round(avgDemandKw / peakDemandKw, 3)

  return {
    meterId,
    meterName,
    date: today.toISOString().split('T')[0],
    intervals,
    peakDemandKw,
    peakTs,
    avgDemandKw,
    loadFactor,
  }
}

export async function mockGetEnergyIntervals(hours = 24): Promise<EnergyInterval[]> {
  await sleep(250)
  return generateEnergyIntervals(hours)
}

export async function mockGetCostRates(): Promise<CostRate[]> {
  await sleep(100)
  return costRates.map((r) => ({ ...r }))
}

export async function mockGetLoadProfile(meterId: string): Promise<LoadProfile | null> {
  await sleep(200)
  const mp = meterProfiles.find((m) => m.id === meterId)
  if (!mp || mp.baseKw === 0) return null
  return generateLoadProfile(mp.id, mp.name, mp.baseKw)
}

export async function mockGetAllLoadProfiles(): Promise<LoadProfile[]> {
  await sleep(300)
  return meterProfiles.filter((mp) => mp.baseKw > 0).map((mp) => generateLoadProfile(mp.id, mp.name, mp.baseKw))
}

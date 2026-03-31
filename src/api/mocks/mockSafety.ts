import type { Breaker, CapacityThreshold } from '../../types'
import { hoursAgo, round, seededNoise, sleep } from './helpers'

const breakers: Breaker[] = [
  { id: 'brk-101', name: 'Cracker group CB', feederId: 'fdr-101', state: 'closed', ratingA: 2000, tripCount: 1, lastTripAt: hoursAgo(720) },
  { id: 'brk-102', name: 'Wafer group CB', feederId: 'fdr-102', state: 'closed', ratingA: 1000, tripCount: 2, lastTripAt: hoursAgo(240) },
  { id: 'brk-103', name: 'Main bus CB', feederId: 'fdr-103', state: 'closed', ratingA: 2500, tripCount: 3, lastTripAt: hoursAgo(168) },
  { id: 'brk-104', name: 'Utilities CB', feederId: 'fdr-104', state: 'closed', ratingA: 400, tripCount: 0, lastTripAt: null },
]

function generateCapacityThresholds(): CapacityThreshold[] {
  const feedersData = [
    { feederId: 'fdr-101', feederName: 'Cracker & pretzel group', ratingA: 2000, baseLoadA: 1420 },
    { feederId: 'fdr-102', feederName: 'Wafer & chocolate group', ratingA: 1200, baseLoadA: 640 },
    { feederId: 'fdr-103', feederName: 'Lines & main bus', ratingA: 2500, baseLoadA: 1520 },
    { feederId: 'fdr-104', feederName: 'Utilities', ratingA: 400, baseLoadA: 180 },
  ]

  return feedersData.map((fd, i) => {
    const noise = seededNoise(Date.now() / 10000 + i * 17) * 0.05
    const currentLoadA = round(fd.baseLoadA * (1 + noise), 1)
    const loadPercent = round((currentLoadA / fd.ratingA) * 100, 1)
    const status: CapacityThreshold['status'] =
      loadPercent >= 90 ? 'critical' : loadPercent >= 75 ? 'warning' : 'normal'

    return {
      feederId: fd.feederId,
      feederName: fd.feederName,
      ratingA: fd.ratingA,
      currentLoadA,
      loadPercent,
      thresholdWarning: 75,
      thresholdCritical: 90,
      status,
    }
  })
}

export async function mockListBreakers(): Promise<Breaker[]> {
  await sleep(130)
  return breakers.map((b) => ({ ...b }))
}

export async function mockGetBreaker(breakerId: string): Promise<Breaker | null> {
  await sleep(80)
  const b = breakers.find((x) => x.id === breakerId)
  return b ? { ...b } : null
}

export async function mockGetCapacityThresholds(): Promise<CapacityThreshold[]> {
  await sleep(180)
  return generateCapacityThresholds()
}

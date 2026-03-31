import type { MeterReading, PowerMeter } from '../../types'
import { clamp, nowIso, round, seededNoise, sleep } from './helpers'

export type MeterState = {
  meter: PowerMeter
  energyKwh: number
  lastTs: number
}

export const startTs = Date.now()

export const meterStates: MeterState[] = [
  // URC Cavite meters (from Power Monitoring workbook)
  { meter: { id: 'mtr-101', name: 'MAIN LINE', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 3302710, lastTs: startTs },
  { meter: { id: 'mtr-102', name: 'MDP3EM6400A', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 4186293, lastTs: startTs },
  { meter: { id: 'mtr-103', name: 'MDP3EM6400B', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 0.71, lastTs: startTs },
  { meter: { id: 'mtr-104', name: 'PPBSF (FERM)', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 663666, lastTs: startTs },
  { meter: { id: 'mtr-105', name: 'PPASF', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 598490, lastTs: startTs },
  { meter: { id: 'mtr-106', name: 'PPCSF', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 313450, lastTs: startTs },
  { meter: { id: 'mtr-107', name: 'MCC22', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 408329, lastTs: startTs },
  { meter: { id: 'mtr-108', name: 'MCC23', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 750199, lastTs: startTs },
  { meter: { id: 'mtr-109', name: 'PPM2B', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 691093, lastTs: startTs },
  { meter: { id: 'mtr-110', name: 'PPM2C', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 310594, lastTs: startTs },
  { meter: { id: 'mtr-111', name: 'PPM2A', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 1088, lastTs: startTs },
  { meter: { id: 'mtr-112', name: 'PIPERS', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 167004, lastTs: startTs },
  { meter: { id: 'mtr-113', name: 'PPM2D', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 207, lastTs: startTs },
  { meter: { id: 'mtr-114', name: 'MML', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 970016, lastTs: startTs },
  { meter: { id: 'mtr-115', name: 'PZL', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 242940, lastTs: startTs },
  { meter: { id: 'mtr-116', name: 'PM21 EMU4A', site: 'URC Cavite', status: 'warning', lastSeenAt: nowIso() }, energyKwh: 166085, lastTs: startTs },
  { meter: { id: 'mtr-117', name: 'PM23 EM6400', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 238975, lastTs: startTs },
  { meter: { id: 'mtr-118', name: 'SLITTER', site: 'URC Cavite', status: 'online', lastSeenAt: nowIso() }, energyKwh: 961963, lastTs: startTs },
]

const baseKwMap: Record<string, number> = {
  'mtr-101': 620,
  'mtr-102': 210,
  'mtr-103': 180,
  'mtr-104': 145,
  'mtr-105': 120,
  'mtr-106': 110,
  'mtr-107': 160,
  'mtr-108': 170,
  'mtr-109': 130,
  'mtr-110': 125,
  'mtr-111': 95,
  'mtr-112': 115,
  'mtr-113': 105,
  'mtr-114': 140,
  'mtr-115': 90,
  'mtr-116': 150,
  'mtr-117': 155,
  'mtr-118': 175,
}

export function computeReading(s: MeterState, tsMs: number): MeterReading {
  const meterNum = Number(s.meter.id.replace(/\D/g, '')) || 1
  const t = (tsMs - startTs) / 1000
  const baseKw = baseKwMap[s.meter.id] ?? 100

  const wave = Math.sin(t / 18 + meterNum) * 0.12 + Math.sin(t / 7 + meterNum * 0.7) * 0.05
  const noise = seededNoise(t / 3 + meterNum * 10) * 0.04

  let powerKw = baseKw * (1 + wave + noise)
  if (s.meter.status === 'offline') powerKw = 0
  if (s.meter.status === 'warning') powerKw = powerKw * 1.08
  powerKw = clamp(powerKw, 0, baseKw * 1.6 + 50)

  const voltageV = s.meter.status === 'offline' ? 0 : round(400 + Math.sin(t / 11 + meterNum) * 6 + seededNoise(t + meterNum) * 2, 1)
  const pf = s.meter.status === 'offline' ? 0 : clamp(round(0.96 + Math.sin(t / 25 + meterNum) * 0.03 - (s.meter.status === 'warning' ? 0.06 : 0), 3), 0.7, 1)
  const currentA = voltageV <= 0 ? 0 : round((powerKw * 1000) / (Math.sqrt(3) * voltageV * pf + 1e-6), 1)

  const dtHours = Math.max(0, (tsMs - s.lastTs) / (1000 * 60 * 60))
  s.energyKwh = round(s.energyKwh + powerKw * dtHours, 3)
  s.lastTs = tsMs
  s.meter.lastSeenAt = s.meter.status === 'offline' ? s.meter.lastSeenAt : new Date(tsMs).toISOString()

  return {
    meterId: s.meter.id,
    ts: new Date(tsMs).toISOString(),
    powerKw: round(powerKw, 2),
    energyKwh: s.energyKwh,
    voltageV,
    currentA,
    pf,
  }
}

export async function mockListMeters(): Promise<PowerMeter[]> {
  await sleep(200)
  return meterStates.map((s) => ({ ...s.meter }))
}

export async function mockGetMeter(meterId: string): Promise<PowerMeter | null> {
  await sleep(120)
  const s = meterStates.find((x) => x.meter.id === meterId)
  return s ? { ...s.meter } : null
}

export async function mockGetLatestReading(meterId: string): Promise<MeterReading | null> {
  await sleep(160)
  const s = meterStates.find((x) => x.meter.id === meterId)
  if (!s) return null
  return computeReading(s, Date.now())
}

export async function mockGetReadings(meterId: string, minutes = 60): Promise<MeterReading[]> {
  await sleep(260)
  const s = meterStates.find((x) => x.meter.id === meterId)
  if (!s) return []
  const now = Date.now()
  const points = Math.max(24, Math.min(240, minutes))
  const stepMs = (minutes * 60 * 1000) / points
  const out: MeterReading[] = []
  const snapshotEnergy = s.energyKwh
  const snapshotLastTs = s.lastTs
  for (let i = points; i >= 0; i -= 1) {
    const ts = now - i * stepMs
    out.push(computeReading(s, ts))
  }
  s.energyKwh = snapshotEnergy
  s.lastTs = snapshotLastTs
  return out
}

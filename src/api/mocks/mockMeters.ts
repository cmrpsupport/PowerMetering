import type { MeterReading, PowerMeter } from '../../types'
import { PLC_PRODUCTION_METERS, PLC_SITE_NAME } from '../../constants/plcProductionMeters'
import { clamp, nowIso, round, seededNoise, sleep } from './helpers'

export type MeterState = {
  meter: PowerMeter
  energyKwh: number
  lastTs: number
}

export const startTs = Date.now()

function initialEnergyForLine(index: number): number {
  return round(80000 + index * 42000 + seededNoise(index * 13) * 5000, 1)
}

export const meterStates: MeterState[] = PLC_PRODUCTION_METERS.map((m, i) => ({
  meter: {
    id: m.id,
    name: m.name,
    site: PLC_SITE_NAME,
    status: 'online' as const,
    lastSeenAt: nowIso(),
  },
  energyKwh: initialEnergyForLine(i),
  lastTs: startTs,
}))

const baseKwMap: Record<string, number> = Object.fromEntries(
  PLC_PRODUCTION_METERS.map((m) => [m.id, m.baseKw]),
)

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

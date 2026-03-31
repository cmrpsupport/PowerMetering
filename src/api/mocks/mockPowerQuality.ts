import type { HarmonicSnapshot, VoltageEvent, WaveformCapture } from '../../types'
import { hoursAgo, round, seededNoise, sleep } from './helpers'

const voltageEvents: VoltageEvent[] = [
  { id: 'evt-001', meterId: 'mtr-101', type: 'sag', ts: hoursAgo(2.3), durationMs: 120, magnitudePu: 0.82, phase: 'A', description: 'Voltage sag detected on Phase A — motor start inrush' },
  { id: 'evt-002', meterId: 'mtr-101', type: 'swell', ts: hoursAgo(5.1), durationMs: 80, magnitudePu: 1.12, phase: 'B', description: 'Voltage swell on Phase B — load rejection' },
  { id: 'evt-003', meterId: 'mtr-104', type: 'sag', ts: hoursAgo(1.5), durationMs: 350, magnitudePu: 0.71, phase: 'ABC', description: 'Three-phase voltage sag — upstream fault' },
  { id: 'evt-004', meterId: 'mtr-102', type: 'transient', ts: hoursAgo(8.0), durationMs: 5, magnitudePu: 1.45, phase: 'C', description: 'Capacitor switching transient on Phase C' },
  { id: 'evt-005', meterId: 'mtr-104', type: 'interruption', ts: hoursAgo(24), durationMs: 2400, magnitudePu: 0.05, phase: 'ABC', description: 'Momentary interruption — breaker trip and reclose' },
  { id: 'evt-006', meterId: 'mtr-101', type: 'sag', ts: hoursAgo(12), durationMs: 200, magnitudePu: 0.85, phase: 'A', description: 'Voltage sag — large motor DOL start' },
  { id: 'evt-007', meterId: 'mtr-105', type: 'swell', ts: hoursAgo(18), durationMs: 150, magnitudePu: 1.08, phase: 'ABC', description: 'Minor three-phase swell — UPS test' },
  { id: 'evt-008', meterId: 'mtr-102', type: 'sag', ts: hoursAgo(36), durationMs: 500, magnitudePu: 0.68, phase: 'B', description: 'Deep sag on Phase B — grid disturbance' },
  { id: 'evt-009', meterId: 'mtr-101', type: 'transient', ts: hoursAgo(48), durationMs: 3, magnitudePu: 1.62, phase: 'A', description: 'Lightning-induced transient' },
  { id: 'evt-010', meterId: 'mtr-104', type: 'sag', ts: hoursAgo(72), durationMs: 180, magnitudePu: 0.78, phase: 'C', description: 'Voltage sag — transformer tap change' },
]

function generateHarmonics(meterId: string): HarmonicSnapshot {
  const meterNum = Number(meterId.replace(/\D/g, '')) || 1
  const harmonics = []
  const limits = [100, 4, 2, 1.5, 6, 1, 0.75, 0.5, 1.5, 0.5, 3.5, 0.3, 0.3, 0.2, 0.3, 0.15, 2, 0.1, 0.15, 0.1, 0.15, 0.1, 1.5, 0.1, 0.1]

  for (let order = 1; order <= 25; order++) {
    const seed = meterNum * 100 + order
    const base = order === 1 ? 100 : (order % 2 === 1 ? 3.5 / order : 1.2 / order)
    const magnitude = round(base * (1 + seededNoise(seed) * 0.3), 2)
    harmonics.push({
      order,
      magnitudePercent: Math.max(0, magnitude),
      limitPercent: limits[order - 1] ?? 0.5,
    })
  }

  const thd = round(Math.sqrt(harmonics.slice(1).reduce((sum, h) => sum + h.magnitudePercent ** 2, 0)), 2)

  return {
    meterId,
    ts: new Date().toISOString(),
    fundamentalHz: 50,
    thdPercent: thd,
    harmonics,
  }
}

function generateWaveform(meterId: string, id: string): WaveformCapture {
  const cycles = 4
  const samplesPerCycle = 128
  const total = cycles * samplesPerCycle
  const phaseA: number[] = []
  const phaseB: number[] = []
  const phaseC: number[] = []

  for (let i = 0; i < total; i++) {
    const angle = (i / samplesPerCycle) * 2 * Math.PI
    const noise = seededNoise(i * 0.1) * 8
    phaseA.push(round(325 * Math.sin(angle) + noise, 1))
    phaseB.push(round(325 * Math.sin(angle - (2 * Math.PI) / 3) + noise * 0.8, 1))
    phaseC.push(round(325 * Math.sin(angle + (2 * Math.PI) / 3) + noise * 1.1, 1))
  }

  return {
    id,
    meterId,
    ts: hoursAgo(1),
    triggerEvent: 'Voltage sag trigger',
    cycles,
    samplesPerCycle,
    phaseA,
    phaseB,
    phaseC,
  }
}

export async function mockListVoltageEvents(meterId?: string): Promise<VoltageEvent[]> {
  await sleep(180)
  const list = meterId ? voltageEvents.filter((e) => e.meterId === meterId) : voltageEvents
  return list.sort((a, b) => (a.ts < b.ts ? 1 : -1))
}

export async function mockGetHarmonics(meterId: string): Promise<HarmonicSnapshot> {
  await sleep(200)
  return generateHarmonics(meterId)
}

export async function mockListWaveforms(meterId?: string): Promise<WaveformCapture[]> {
  await sleep(220)
  const meterIds = meterId ? [meterId] : ['mtr-101', 'mtr-102', 'mtr-104']
  return meterIds.map((mid, i) => generateWaveform(mid, `wf-${String(i + 1).padStart(3, '0')}`))
}

export async function mockGetWaveform(waveformId: string): Promise<WaveformCapture | null> {
  await sleep(150)
  const all = ['mtr-101', 'mtr-102', 'mtr-104'].map((mid, i) => generateWaveform(mid, `wf-${String(i + 1).padStart(3, '0')}`))
  return all.find((w) => w.id === waveformId) ?? null
}

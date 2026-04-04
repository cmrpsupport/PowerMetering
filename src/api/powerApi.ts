import type {
  DemandStatus,
  EnhancedAlert,
  EnergyInterval,
  LoadProfilePoint,
  MeterSamplePoint,
  PlcFullSnapshot,
  PlcMeterData,
  VoltageEvent,
  VoltageEventType,
} from '../types'

export type DemandTrendRange = '24h' | '7d' | '30d' | 'all'
import { PLC_METERS, PLC_TOTAL_ENERGY_KEYS, METER_PARAM_SUFFIXES } from '../constants/plcMeters'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').toString()

type RawSnapshot = {
  ts: string
  values: Record<string, unknown> | null
  warning?: string
}

type NodeRedHealth = {
  ok: boolean
  service: string
  ts: string
  plcLink?: {
    up: boolean
    lastCommunicationTs: string | null
  }
}

export type PowerTrendPoint = {
  ts: string
  kw: number
  voltageV: number
  currentA: number
  pf: number
  kvar: number
}

async function http<T>(path: string): Promise<T> {
  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return (await res.json()) as T
}

function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function firstDefined(r: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null) return r[k]
  }
  return undefined
}

/** Node-RED SQLite often returns snake_case column names; normalize to MeterSamplePoint. */
function normalizeMeterSampleRow(r: Record<string, unknown>): MeterSamplePoint {
  const n = (...keys: string[]) => toNumber(firstDefined(r, keys))
  const s = (...keys: string[]) => String(firstDefined(r, keys) ?? '')
  return {
    ts: s('ts'),
    meterId: s('meterId', 'meter_id'),
    realPowerKw: n('realPowerKw', 'real_power_kw'),
    reactivePowerKvar: n('reactivePowerKvar', 'reactive_power_kvar'),
    apparentPowerKva: n('apparentPowerKvar', 'apparent_power_kva'),
    realEnergyKwh: n('realEnergyKwh', 'real_energy_kwh'),
    reactiveEnergyKvarh: n('reactiveEnergyKvarh', 'reactive_energy_kvarh'),
    apparentEnergyKvah: n('apparentEnergyKvah', 'apparent_energy_kvah'),
    voltageAb: n('voltageAb', 'voltage_ab'),
    voltageBc: n('voltageBc', 'voltage_bc'),
    voltageCa: n('voltageCa', 'voltage_ca'),
    voltageLlAvg: n('voltageLlAvg', 'voltage_ll_avg'),
    voltageAn: n('voltageAn', 'voltage_an'),
    voltageBn: n('voltageBn', 'voltage_bn'),
    voltageCn: n('voltageCn', 'voltage_cn'),
    voltageLnAvg: n('voltageLnAvg', 'voltage_ln_avg'),
    currentA: n('currentA', 'current_a'),
    currentB: n('currentB', 'current_b'),
    currentC: n('currentC', 'current_c'),
    currentAvg: n('currentAvg', 'current_avg'),
    powerFactor: n('powerFactor', 'power_factor'),
    frequency: n('frequency'),
  }
}

function readFloat64FromDwordsBE(hi: unknown, lo: unknown): number | null {
  const hiU = toNumber(hi)
  const loU = toNumber(lo)
  if (!Number.isFinite(hiU) || !Number.isFinite(loU)) return null

  // DWORDs are unsigned 32-bit integers
  const hi32 = hiU >>> 0
  const lo32 = loU >>> 0

  const buf = new ArrayBuffer(8)
  const dv = new DataView(buf)
  // S7 stores multi-byte values big-endian.
  dv.setUint32(0, hi32, false)
  dv.setUint32(4, lo32, false)
  const f = dv.getFloat64(0, false)
  return Number.isFinite(f) ? f : null
}

function valueForMeterKey(values: Record<string, unknown>, meterId: string, suffix: string): number {
  const direct = values[`${meterId}_${suffix}`]
  if (direct !== undefined) return toNumber(direct)

  // PAC3200 energy counters are LREAL in DB16; we read them as two DWORDs.
  if (suffix === 'Real_energy' || suffix === 'Reactive_energy' || suffix === 'Apparent_energy') {
    const hi = values[`${meterId}_${suffix}_DWORD0`]
    const lo = values[`${meterId}_${suffix}_DWORD1`]
    const decoded = readFloat64FromDwordsBE(hi, lo)
    if (decoded !== null) return decoded
  }

  return 0
}

function valueForTotalEnergyKey(values: Record<string, unknown>, key: string): number {
  // Prefer the Excel-style total keys.
  const v = values[key]
  if (v !== undefined) return toNumber(v)

  // Fallback to the legacy concise keys used by /api/plc/snapshot.
  const legacyMap: Record<string, string> = {
    Total_EnergyCon_kwh_Cracker_Line_1: 'Total_CrackerLine1_kWh',
    Total_EnergyCon_kwh_Cracker_Line_2: 'Total_CrackerLine2_kWh',
    Total_EnergyCon_kwh_Pretzel_Line: 'Total_PretzelLine_kWh',
    Total_EnergyCon_kwh_Wafer_Line_1: 'Total_WaferLine1_kWh',
    Total_EnergyCon_kwh_Wafer_Line_2: 'Total_WaferLine2_kWh',
    Total_EnergyCon_kwh_Chooey_Choco_Line: 'Total_ChooeyChocoLine_kWh',
    Total_EnergyCon_kwh_Dynamite_Line: 'Total_DynamiteLine_kWh',
    Total_EnergyCon_kwh_XO_Line: 'Total_XOLine_kWh',
    Total_EnergyCon_kwh_Maxx_Line: 'Total_MaxxLine_kWh',
    Total_EnergyCon_kwh_Main_Line: 'Total_MainLine_kWh',
    Total_EnergyCon_kwh_Utilities_Jaguar: 'Total_UtilitiesJaguar_kWh',
    Total_EnergyCon_kwh_Utilities_Lighting_Power_Panel: 'Total_UtilitiesLighting_kWh',
  }
  const legacyKey = legacyMap[key]
  return legacyKey ? toNumber(values[legacyKey]) : 0
}

// ── Full Snapshot (primary data source) ──────────────────

function parseFullSnapshot(raw: RawSnapshot): PlcFullSnapshot {
  if (!raw.values) {
    return {
      ts: raw.ts,
      connected: false,
      warning: raw.warning ?? 'No data from PLC',
      meters: {},
      totalEnergy: {},
    }
  }

  const v = raw.values
  const meters: Record<string, PlcMeterData> = {}

  for (const meter of PLC_METERS) {
    const data: Record<string, number> = {}
    for (const suffix of METER_PARAM_SUFFIXES) {
      data[suffix] = valueForMeterKey(v, meter.id, suffix)
    }
    meters[meter.id] = data as PlcMeterData
  }

  const totalEnergy: Record<string, number> = {}
  for (const entry of PLC_TOTAL_ENERGY_KEYS) {
    totalEnergy[entry.name] = valueForTotalEnergyKey(v, entry.key)
  }

  return {
    ts: raw.ts,
    connected: true,
    warning: raw.warning,
    meters,
    totalEnergy,
  }
}

export async function getPlcFullSnapshot(): Promise<PlcFullSnapshot> {
  try {
    // Prefer the full snapshot if the Excel endpoint is enabled.
    const raw = await http<RawSnapshot>('/api/plc/full-snapshot')
    if (!raw || typeof raw !== 'object' || typeof raw.ts !== 'string') {
      return {
        ts: new Date().toISOString(),
        connected: false,
        warning: 'Invalid response from /api/plc/full-snapshot',
        meters: {},
        totalEnergy: {},
      }
    }
    const parsed = parseFullSnapshot(raw)
    if (parsed.connected) return parsed

    // Fallback: the default /api/plc/snapshot can now contain either:
    // - totals-only keys (legacy)
    // - OR the full merged vartable (meters + totals)
    const rawSmall = await http<RawSnapshot>('/api/plc/snapshot')
    if (rawSmall && typeof rawSmall === 'object' && typeof rawSmall.ts === 'string' && rawSmall.values) {
      const parsedSmall = parseFullSnapshot(rawSmall)
      if (parsedSmall.connected) {
        // Don't surface the full-snapshot warning (it’s expected when /api/plc/full-snapshot is disabled).
        return { ...parsedSmall, warning: rawSmall.warning }
      }
    }

    return parsed
  } catch (err) {
    return {
      ts: new Date().toISOString(),
      connected: false,
      warning: `Failed to fetch /api/plc/full-snapshot: ${err instanceof Error ? err.message : String(err)}`,
      meters: {},
      totalEnergy: {},
    }
  }
}

// ── Node-RED Health ──────────────────────────────────────

export async function getNodeRedHealth(): Promise<NodeRedHealth | null> {
  try {
    return await http<NodeRedHealth>('/api/health')
  } catch {
    return null
  }
}

// ── Alerts ───────────────────────────────────────────────

export async function listEnhancedAlerts(): Promise<EnhancedAlert[]> {
  return await http<EnhancedAlert[]>('/api/alarms').catch(() => [])
}

function parseVoltageDetail(detail: string): { voltage: number | null; nominal: number | null } {
  // Example: "Voltage 392.12V vs nominal 400.00V."
  const m = String(detail).match(/Voltage\s+([-+]?\d+(?:\.\d+)?)V\s+vs\s+nominal\s+([-+]?\d+(?:\.\d+)?)V/i)
  if (!m) return { voltage: null, nominal: null }
  const voltage = Number(m[1])
  const nominal = Number(m[2])
  return { voltage: Number.isFinite(voltage) ? voltage : null, nominal: Number.isFinite(nominal) ? nominal : null }
}

function voltageEventTypeFromAlert(message: string, detail: string): VoltageEventType {
  const msg = String(message).toLowerCase()
  if (msg.includes('interruption')) return 'interruption'
  if (msg.includes('transient')) return 'transient'
  // For "Voltage out of band", infer sag/swell from value vs nominal.
  const { voltage, nominal } = parseVoltageDetail(detail)
  if (voltage !== null && nominal !== null && nominal > 0) {
    return voltage < nominal ? 'sag' : 'swell'
  }
  return 'transient'
}

export async function getVoltageEvents(meterId?: string): Promise<VoltageEvent[]> {
  // Backend currently logs PQ events as Enhanced Alerts (category=power_quality).
  // Convert them into voltage-event rows for the PQ Events page.
  const alerts = await listEnhancedAlerts()
  const pq = alerts.filter((a) => a.category === 'power_quality')
  const filtered = meterId ? pq.filter((a) => a.meterId === meterId) : pq
  return filtered.map((a) => {
    const { voltage, nominal } = parseVoltageDetail(a.detail)
    const magnitudePu =
      voltage !== null && nominal !== null && nominal > 0 ? Math.max(0, voltage / nominal) : 0
    return {
      id: a.id,
      meterId: a.meterId,
      meterName: a.meterName,
      ts: a.ts,
      type: voltageEventTypeFromAlert(a.message, a.detail),
      phase: 'L-L',
      durationMs: 0,
      magnitudePu,
      description: a.message,
    } satisfies VoltageEvent
  })
}

export async function acknowledgeAlert(alertId: string, _by: string): Promise<EnhancedAlert | null> {
  return await http<EnhancedAlert>(`/api/alarms/${encodeURIComponent(alertId)}/acknowledge`).catch(() => null)
}

export async function resolveAlert(alertId: string): Promise<EnhancedAlert | null> {
  return await http<EnhancedAlert>(`/api/alarms/${encodeURIComponent(alertId)}/resolve`).catch(() => null)
}

export async function addAlertNote(alertId: string, _note: string): Promise<EnhancedAlert | null> {
  return await http<EnhancedAlert>(`/api/alarms/${encodeURIComponent(alertId)}/notes`).catch(() => null)
}

// ── Energy Intervals (for consumption report) ────────────

export type EnergyIntervalBucket = '5m' | '15m' | '1h'

export async function getEnergyIntervals(
  hours = 24,
  opts?: { bucket?: EnergyIntervalBucket; bucketSec?: number },
): Promise<EnergyInterval[]> {
  const p = new URLSearchParams({ hours: String(hours) })
  if (opts?.bucket) p.set('bucket', opts.bucket)
  if (typeof opts?.bucketSec === 'number' && Number.isFinite(opts.bucketSec) && opts.bucketSec > 0) {
    p.set('bucketSec', String(Math.floor(opts.bucketSec)))
  }
  return await http<EnergyInterval[]>(`/api/energy/intervals?${p.toString()}`).catch(() => [])
}

/** Last N hours of plant kW as time-weighted averages over fixed clock-aligned buckets (plc_samples Power_kW). */
export async function getPlantLoadProfile(
  hours = 24,
  opts?: { bucket?: '1m' | '5m' | '15m' | '1h'; bucketSec?: number },
): Promise<LoadProfilePoint[]> {
  const p = new URLSearchParams({ hours: String(hours) })
  if (opts?.bucket) p.set('bucket', opts.bucket)
  if (typeof opts?.bucketSec === 'number' && Number.isFinite(opts.bucketSec) && opts.bucketSec > 0) {
    p.set('bucketSec', String(Math.floor(opts.bucketSec)))
  }
  return await http<LoadProfilePoint[]>(`/api/trends/load-profile?${p.toString()}`).catch(() => [])
}

export async function getPowerTrend(
  minutes = 24 * 60,
  opts?: { bucket?: '1m' | '5m' | '15m' | '1h' | '1d'; bucketSec?: number },
): Promise<PowerTrendPoint[]> {
  // The in-memory Node-RED buffer can be short after restarts; use SQLite history for >= 24h
  // so 1h vs 24h windows remain meaningfully different.
  const maxInMemoryMinutes = 60 * 24
  const qs =
    minutes >= maxInMemoryMinutes
      ? (() => {
          const p = new URLSearchParams({ minutes: String(minutes) })
          if (opts?.bucket) p.set('bucket', opts.bucket)
          if (typeof opts?.bucketSec === 'number' && Number.isFinite(opts.bucketSec) && opts.bucketSec > 0) {
            p.set('bucketSec', String(Math.floor(opts.bucketSec)))
          }
          return `/api/trends/power/history?${p.toString()}`
        })()
      : `/api/trends/power?minutes=${minutes}`
  return await http<PowerTrendPoint[]>(qs).catch(() => [])
}

// ── Demand Status ───────────────────────────────────────

function demandStatusQuery(range: DemandTrendRange): string {
  if (range === 'all') return 'minutes=all'
  const minutes = range === '24h' ? 24 * 60 : range === '7d' ? 7 * 24 * 60 : 30 * 24 * 60
  return `minutes=${minutes}`
}

function normalizeDemandStatus(raw: DemandStatus): DemandStatus {
  // Derive rolling (sliding 15-min) and fixed (clock-aligned 15-min block)
  // from the logged demand sample series to ensure:
  // - rolling uses a true 15-min time-weighted average (sliding window)
  // - fixed aligns to local 00/15/30/45 boundaries and resets per block
  // - rolling and fixed remain distinct (they should rarely match exactly)

  const th = raw.thresholdKw ?? 0
  const windowMs = 15 * 60 * 1000
  const windowSec = windowMs / 1000

  const nowMs = Number.isFinite(Date.parse(raw.ts)) ? Date.parse(raw.ts) : Date.now()

  const baseSamples = (raw.trend ?? [])
    .map((p) => ({ t: Date.parse(p.ts), kw: Number(p.kw) }))
    .filter((s) => Number.isFinite(s.t) && Number.isFinite(s.kw))

  // Treat trend samples as piecewise-constant kW values until the next timestamp.
  // Add the latest instantaneous reading so the rolling average updates smoothly.
  const sampleMap = new Map<number, number>()
  for (const s of baseSamples) sampleMap.set(s.t, s.kw)
  sampleMap.set(nowMs, Number(raw.instantKw ?? 0))
  const samples = Array.from(sampleMap.entries())
    .map(([t, kw]) => ({ t, kw }))
    .sort((a, b) => a.t - b.t)

  if (samples.length < 2 || !Number.isFinite(windowSec) || windowSec <= 0) {
    const roll = raw.currentDemandKw ?? 0
    return {
      ...raw,
      fixedDemandKw: raw.fixedDemandKw ?? 0,
      pctBasis: raw.pctBasis ?? 'rolling',
      exceedsThreshold: raw.exceedsThreshold ?? (th > 0 && roll > th),
    }
  }

  const tArr = samples.map((s) => s.t)
  const kwArr = samples.map((s) => s.kw)

  const cumulative = new Array(samples.length).fill(0) as number[]
  for (let i = 1; i < samples.length; i++) {
    cumulative[i] = cumulative[i - 1] + (kwArr[i - 1] * (tArr[i] - tArr[i - 1])) / 1000
  }

  const upperBound = (x: number) => {
    let lo = 0
    let hi = tArr.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (tArr[mid] <= x) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  const integrateKwOverMs = (startMs: number, endMs: number) => {
    if (!(Number.isFinite(startMs) && Number.isFinite(endMs))) return 0
    if (endMs <= startMs) return 0
    if (samples.length < 2) return 0

    let start = startMs
    const end = endMs
    let integralKwSec = 0

    // Extrapolate using first sample's kW before the first timestamp.
    if (start < tArr[0]) {
      integralKwSec += kwArr[0] * (Math.min(end, tArr[0]) - start) / 1000
      start = tArr[0]
      if (end <= tArr[0]) return integralKwSec
    }

    const endClamped = Math.min(end, tArr[tArr.length - 1])
    if (endClamped <= start) return integralKwSec

    const idxStart = Math.max(0, upperBound(start) - 1)
    const idxEnd = Math.max(0, upperBound(endClamped) - 1)

    const tNext = idxStart + 1 < tArr.length ? tArr[idxStart + 1] : endClamped
    const partEnd = Math.min(endClamped, tNext)
    const dt1 = partEnd - start
    if (dt1 > 0) integralKwSec += kwArr[idxStart] * dt1 / 1000
    if (partEnd >= endClamped) return integralKwSec

    const fullStartIdx = idxStart + 1
    if (idxEnd >= fullStartIdx) {
      integralKwSec += cumulative[idxEnd] - cumulative[fullStartIdx]
    }

    // Partial at the end if endClamped is inside a step segment.
    if (endClamped > tArr[idxEnd] && idxEnd < kwArr.length) {
      integralKwSec += kwArr[idxEnd] * (endClamped - tArr[idxEnd]) / 1000
    }

    return integralKwSec
  }

  const rollingNow = integrateKwOverMs(nowMs - windowMs, nowMs) / windowSec

  // Fixed: average over the current 15-min clock block, aligned to local 00/15/30/45.
  const d0 = new Date(nowMs)
  const slotMin = Math.floor(d0.getMinutes() / 15) * 15
  const slotStartMs = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), d0.getHours(), slotMin, 0, 0).getTime()
  const fixedNow = integrateKwOverMs(slotStartMs, nowMs) / windowSec

  const pctOfThreshold = th > 0 ? (rollingNow / th) * 100 : 0
  const exceedsThreshold = th > 0 ? rollingNow > th : false

  const rawTrend = raw.trend ?? []
  const maxPoints = 240
  const step = rawTrend.length > maxPoints ? Math.ceil(rawTrend.length / maxPoints) : 1

  const derivedTrend = rawTrend
    .filter((_, i) => i % step === 0 || i === rawTrend.length - 1)
    .map((p) => {
      const t = Date.parse(p.ts)
      if (!Number.isFinite(t)) return { ts: p.ts, kw: 0 }
      const kw = integrateKwOverMs(t - windowMs, t) / windowSec
      return { ts: p.ts, kw }
    })

  return {
    ...raw,
    currentDemandKw: rollingNow,
    fixedDemandKw: fixedNow,
    pctOfThreshold: pctOfThreshold,
    pctBasis: 'rolling',
    exceedsThreshold,
    trend: derivedTrend,
  }
}

export async function getDemandStatus(range: DemandTrendRange = 'all'): Promise<DemandStatus | null> {
  const q = demandStatusQuery(range)
  const raw = await http<DemandStatus>(`/api/demand/status?${q}`).catch(() => null)
  if (!raw) return null
  return normalizeDemandStatus(raw)
}

export async function setDemandThreshold(
  kw: number,
  range: DemandTrendRange = 'all',
): Promise<DemandStatus | null> {
  const q = demandStatusQuery(range)
  const raw = await http<DemandStatus>(`/api/demand/status?setThreshold=${encodeURIComponent(kw)}&${q}`).catch(() => null)
  if (!raw) return null
  return normalizeDemandStatus(raw)
}

// ── Per-Meter Per-Phase History ─────────────────────────

export async function getMeterHistory(
  minutes = 24 * 60,
  meterId?: string,
): Promise<MeterSamplePoint[]> {
  let path = `/api/trends/meter/history?minutes=${minutes}`
  if (meterId) path += `&meterId=${encodeURIComponent(meterId)}`
  const raw = await http<unknown>(path).catch(() => [])
  if (!Array.isArray(raw)) return []
  return raw.map((row) =>
    normalizeMeterSampleRow(
      typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {},
    ),
  )
}

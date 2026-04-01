import type {
  DemandStatus,
  EnhancedAlert,
  EnergyInterval,
  MeterSamplePoint,
  PlcFullSnapshot,
  PlcMeterData,
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
    Total_EnergyCon_kwh_Chooey_Choco_Line: 'Total_ChocoyChocoLine_kWh',
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

export async function getEnergyIntervals(hours = 24): Promise<EnergyInterval[]> {
  return await http<EnergyInterval[]>(`/api/energy/intervals?hours=${hours}`).catch(() => [])
}

export async function getPowerTrend(
  minutes = 24 * 60,
  opts?: { bucket?: '1m' | '5m' | '15m' | '1h' | '1d'; bucketSec?: number },
): Promise<PowerTrendPoint[]> {
  const maxInMemoryMinutes = 60 * 24 * 7
  const qs =
    minutes > maxInMemoryMinutes
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

export async function getDemandStatus(range: DemandTrendRange = 'all'): Promise<DemandStatus | null> {
  const q = demandStatusQuery(range)
  return await http<DemandStatus>(`/api/demand/status?${q}`).catch(() => null)
}

export async function setDemandThreshold(
  kw: number,
  range: DemandTrendRange = 'all',
): Promise<DemandStatus | null> {
  const q = demandStatusQuery(range)
  return await http<DemandStatus>(`/api/demand/status?setThreshold=${encodeURIComponent(kw)}&${q}`).catch(() => null)
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

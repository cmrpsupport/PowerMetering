import type { DemandStatus, EnhancedAlert, EnergyInterval, MeterSamplePoint, PlcFullSnapshot, PlcMeterData } from '../types'
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

export async function getPowerTrend(minutes = 24 * 60): Promise<PowerTrendPoint[]> {
  const maxInMemoryMinutes = 60 * 24 * 7
  const path =
    minutes > maxInMemoryMinutes
      ? `/api/trends/power/history?minutes=${minutes}`
      : `/api/trends/power?minutes=${minutes}`
  return await http<PowerTrendPoint[]>(path).catch(() => [])
}

// ── Demand Status ───────────────────────────────────────

export async function getDemandStatus(): Promise<DemandStatus | null> {
  return await http<DemandStatus>('/api/demand/status').catch(() => null)
}

export async function setDemandThreshold(kw: number): Promise<DemandStatus | null> {
  return await http<DemandStatus>(`/api/demand/status?setThreshold=${kw}`).catch(() => null)
}

// ── Per-Meter Per-Phase History ─────────────────────────

export async function getMeterHistory(
  minutes = 24 * 60,
  meterId?: string,
): Promise<MeterSamplePoint[]> {
  let path = `/api/trends/meter/history?minutes=${minutes}`
  if (meterId) path += `&meterId=${encodeURIComponent(meterId)}`
  return await http<MeterSamplePoint[]>(path).catch(() => [])
}

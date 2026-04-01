import type { MeterParamKey } from './constants/plcMeters'

// ── PLC Full Snapshot (primary data source) ──────────────

/** All 20 parameters for a single power meter from DB16. */
export type PlcMeterData = Record<MeterParamKey, number>

/** Parsed response from /api/plc/full-snapshot. */
export type PlcFullSnapshot = {
  ts: string
  connected: boolean
  warning?: string
  /** Per-meter data keyed by meter ID (e.g. RIO1CM1_EMU4_1). */
  meters: Record<string, PlcMeterData>
  /** Production line total energy counters (kWh). */
  totalEnergy: Record<string, number>
}

// ── Legacy types (still used by alerts, consumption report) ──

export type MeterStatus = 'online' | 'offline' | 'warning'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export type PowerAlert = {
  id: string
  meterId: string
  meterName: string
  severity: AlertSeverity
  message: string
  ts: string
  acknowledged: boolean
}

export type AlertPriority = 'urgent' | 'high' | 'medium' | 'low'
export type AlertCategory = 'power_quality' | 'protection' | 'communication' | 'energy' | 'system'
export type AlertStatus = 'active' | 'acknowledged' | 'resolved'

export type EnhancedAlert = {
  id: string
  meterId: string
  meterName: string
  severity: AlertSeverity
  priority: AlertPriority
  category: AlertCategory
  status: AlertStatus
  message: string
  detail: string
  ts: string
  acknowledgedAt: string | null
  acknowledgedBy: string | null
  resolvedAt: string | null
  notes: string[]
  incidentId: string | null
}

export type EnergyInterval = {
  ts: string
  meterId: string
  meterName: string
  energyKwh: number
  demandKw: number
  costDollars: number
  rateTier: string
  /** Optional: cumulative meter total at end of interval bucket (kWh). */
  cumulativeKwh?: number
}

export type ConsumptionGranularity = 'hourly' | 'daily' | 'weekly' | 'monthly'

/** Real-time demand status from /api/demand/status. */
export type DemandStatus = {
  ts: string
  month: string
  instantKw: number
  currentDemandKw: number
  monthlyPeakKw: number
  monthlyPeakTs: string | null
  thresholdKw: number
  /** Percentage of threshold (0-100+). */
  pctOfThreshold: number
  windowSeconds: number
  samplesInWindow: number
  trend: { ts: string; kw: number }[]
  /** First timestamp in stored demand history (if any). */
  trendStartTs?: string | null
}

/** Per-meter, per-phase historical sample from /api/trends/meter/history. */
export type MeterSamplePoint = {
  ts: string
  meterId: string
  realPowerKw: number
  reactivePowerKvar: number
  apparentPowerKva: number
  realEnergyKwh: number
  reactiveEnergyKvarh: number
  apparentEnergyKvah: number
  voltageAb: number
  voltageBc: number
  voltageCa: number
  voltageLlAvg: number
  voltageAn: number
  voltageBn: number
  voltageCn: number
  voltageLnAvg: number
  currentA: number
  currentB: number
  currentC: number
  currentAvg: number
  powerFactor: number
  frequency: number
}

// ── Power Quality Events ──────────────────────────────────

export type VoltageEventType = 'sag' | 'swell' | 'interruption' | 'transient'

export type VoltageEvent = {
  id: string
  meterId: string
  meterName: string
  ts: string
  type: VoltageEventType
  /** Phase descriptor (best-effort when derived from alerts). */
  phase: string
  /** Duration in milliseconds (0 when unknown). */
  durationMs: number
  /** Magnitude in per-unit (pu), 1.0 = nominal. */
  magnitudePu: number
  description: string
}

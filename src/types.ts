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

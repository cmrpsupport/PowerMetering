// ── Existing types ──────────────────────────────────────

export type MeterStatus = 'online' | 'offline' | 'warning'

export type PowerMeter = {
  id: string
  name: string
  site: string
  status: MeterStatus
  lastSeenAt: string
}

export type MeterReading = {
  meterId: string
  ts: string
  powerKw: number
  energyKwh: number
  voltageV: number
  currentA: number
  pf: number
}

export type PlcEnergyTotal = {
  /** Display name coming from DB16 Total_EnergyCon_kWh.* */
  name: string
  /** Energy consumption in kWh */
  kwh: number
}

/** One row from DB16 Total_*_kWh tags for verification against the PLC. */
export type PlcEnergyTotalRow = {
  key: string
  name: string
  kwh: number | null
  raw: unknown
}

/** Full snapshot for the PLC total-energy verification page. */
export type PlcEnergyConsumptionSnapshot = {
  ts: string
  connected: boolean
  warning?: string
  /** Resolved API base (from VITE_API_BASE_URL) for troubleshooting */
  apiBaseUrl: string
  rows: PlcEnergyTotalRow[]
  /** All `Total_*_kWh` keys present in the snapshot (for JSON verification). */
  totalEnergyKeys: Record<string, unknown>
}

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

// ── Sites & Feeders ────────────────────────────────────

export type Site = {
  id: string
  name: string
  address: string
  meterIds: string[]
  feederIds: string[]
}

export type Feeder = {
  id: string
  siteId: string
  name: string
  parentFeederId: string | null
  meterId: string | null
  breakerId: string | null
  ratingA: number
  voltageKv: number
}

// ── Power Quality ──────────────────────────────────────

export type VoltageEventType = 'sag' | 'swell' | 'interruption' | 'transient'

export type VoltageEvent = {
  id: string
  meterId: string
  type: VoltageEventType
  ts: string
  durationMs: number
  magnitudePu: number
  phase: 'A' | 'B' | 'C' | 'ABC'
  description: string
}

export type HarmonicSnapshot = {
  meterId: string
  ts: string
  fundamentalHz: number
  thdPercent: number
  harmonics: { order: number; magnitudePercent: number; limitPercent: number }[]
}

export type WaveformCapture = {
  id: string
  meterId: string
  ts: string
  triggerEvent: string
  cycles: number
  samplesPerCycle: number
  phaseA: number[]
  phaseB: number[]
  phaseC: number[]
}

// ── Enhanced Alarms ────────────────────────────────────

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

export type IncidentGroup = {
  id: string
  title: string
  rootAlertId: string
  alertIds: string[]
  status: 'open' | 'investigating' | 'resolved'
  createdAt: string
  resolvedAt: string | null
  summary: string
}

export type SequenceOfEventsEntry = {
  id: string
  ts: string
  deviceId: string
  deviceName: string
  eventType: string
  description: string
  value: string
}

// ── Energy Management ──────────────────────────────────

export type EnergyInterval = {
  ts: string
  meterId: string
  meterName: string
  energyKwh: number
  demandKw: number
  costDollars: number
  rateTier: string
}

export type CostRate = {
  id: string
  name: string
  tier: 'on-peak' | 'mid-peak' | 'off-peak'
  ratePerKwh: number
  demandChargePerKw: number
  startHour: number
  endHour: number
  color: string
}

export type LoadProfile = {
  meterId: string
  meterName: string
  date: string
  intervals: { ts: string; demandKw: number }[]
  peakDemandKw: number
  peakTs: string
  avgDemandKw: number
  loadFactor: number
}

// ── Reports ────────────────────────────────────────────

export type ReportType = 'energy' | 'power_quality' | 'compliance' | 'custom' | 'demand' | 'billing'

export type ReportTemplate = {
  id: string
  name: string
  description: string
  type: ReportType
  parameters: { key: string; label: string; inputType: 'select' | 'date' | 'text' }[]
}

export type ReportSchedule = {
  id: string
  templateId: string
  templateName: string
  frequency: 'daily' | 'weekly' | 'monthly'
  nextRun: string
  recipients: string[]
  enabled: boolean
}

export type KpiMetric = {
  id: string
  name: string
  unit: string
  currentValue: number
  targetValue: number
  previousValue: number
  trend: 'up' | 'down' | 'flat'
  status: 'on-track' | 'at-risk' | 'off-track'
}

// ── Devices & System ───────────────────────────────────

export type DeviceProtocol = 'modbus-tcp' | 'modbus-rtu' | 'opc' | 'snmp'
export type DeviceStatus = 'connected' | 'disconnected' | 'error'

export type Device = {
  id: string
  name: string
  manufacturer: string
  model: string
  protocol: DeviceProtocol
  address: string
  status: DeviceStatus
  lastPollAt: string
  meterId: string | null
  firmwareVersion: string
}

export type BreakerState = 'closed' | 'open' | 'tripped'

export type Breaker = {
  id: string
  name: string
  feederId: string
  state: BreakerState
  ratingA: number
  tripCount: number
  lastTripAt: string | null
}

export type CapacityThreshold = {
  feederId: string
  feederName: string
  ratingA: number
  currentLoadA: number
  loadPercent: number
  thresholdWarning: number
  thresholdCritical: number
  status: 'normal' | 'warning' | 'critical'
}

// ── User & Dashboard ───────────────────────────────────

export type UserRole = 'operator' | 'engineer' | 'manager' | 'admin'

export type DashboardWidget = {
  id: string
  type: 'stat' | 'chart' | 'table' | 'diagram'
  title: string
  config: Record<string, unknown>
  x: number
  y: number
  w: number
  h: number
}

export type CustomDashboard = {
  id: string
  name: string
  ownerId: string
  widgets: DashboardWidget[]
  createdAt: string
}

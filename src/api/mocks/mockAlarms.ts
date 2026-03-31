import type { EnhancedAlert, IncidentGroup, PowerAlert, SequenceOfEventsEntry } from '../../types'
import { hoursAgo, minutesAgo, sleep } from './helpers'

const legacyAlerts: PowerAlert[] = [
  {
    id: 'alrt-1001',
    meterId: 'plc-line-03',
    meterName: 'Pretzel Line',
    severity: 'warning',
    message: 'Power factor trending low (PF < 0.92) in last 10 minutes.',
    ts: minutesAgo(8),
    acknowledged: false,
  },
  {
    id: 'alrt-1002',
    meterId: 'plc-line-12',
    meterName: 'Utilities Lighting',
    severity: 'critical',
    message: 'Meter offline / no telemetry received.',
    ts: minutesAgo(17),
    acknowledged: false,
  },
]

const enhancedAlerts: EnhancedAlert[] = [
  { id: 'ea-001', meterId: 'plc-line-03', meterName: 'Pretzel Line', severity: 'warning', priority: 'high', category: 'power_quality', status: 'active', message: 'Power factor below 0.92', detail: 'PF has averaged 0.88 over the last 15 minutes on Pretzel Line.', ts: minutesAgo(8), acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, notes: [], incidentId: null },
  { id: 'ea-002', meterId: 'plc-line-12', meterName: 'Utilities Lighting', severity: 'critical', priority: 'urgent', category: 'communication', status: 'active', message: 'Meter offline — no telemetry', detail: 'No data received from Utilities Lighting for 17+ minutes. Check communication link and meter power supply.', ts: minutesAgo(17), acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, notes: [], incidentId: 'inc-001' },
  { id: 'ea-003', meterId: 'plc-line-10', meterName: 'Main Line', severity: 'warning', priority: 'medium', category: 'energy', status: 'active', message: 'Peak demand approaching limit', detail: 'Current demand is within 10% of the contracted maximum demand. Consider load shedding.', ts: minutesAgo(25), acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, notes: [], incidentId: null },
  { id: 'ea-004', meterId: 'plc-line-02', meterName: 'Cracker Line 2', severity: 'info', priority: 'low', category: 'system', status: 'acknowledged', message: 'Scheduled maintenance due', detail: 'Meter is due for calibration. Last calibrated 11 months ago.', ts: hoursAgo(6), acknowledgedAt: hoursAgo(5), acknowledgedBy: 'John E.', resolvedAt: null, notes: ['Maintenance scheduled for next shutdown window.'], incidentId: null },
  { id: 'ea-005', meterId: 'plc-line-10', meterName: 'Main Line', severity: 'warning', priority: 'high', category: 'power_quality', status: 'active', message: 'Voltage sag detected — Phase A', detail: 'Voltage dropped to 0.82 pu for 120ms on Phase A.', ts: hoursAgo(2.3), acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, notes: [], incidentId: 'inc-002' },
  { id: 'ea-006', meterId: 'plc-line-03', meterName: 'Pretzel Line', severity: 'critical', priority: 'urgent', category: 'power_quality', status: 'resolved', message: 'Three-phase sag — upstream fault', detail: 'Deep three-phase sag to 0.71 pu lasting 350ms. Originated from utility-side fault.', ts: hoursAgo(1.5), acknowledgedAt: hoursAgo(1.4), acknowledgedBy: 'Sarah M.', resolvedAt: hoursAgo(0.5), notes: ['Confirmed utility fault.', 'No equipment damage observed.'], incidentId: 'inc-002' },
  { id: 'ea-007', meterId: 'plc-line-02', meterName: 'Cracker Line 2', severity: 'warning', priority: 'medium', category: 'protection', status: 'active', message: 'Breaker trip count elevated', detail: 'Associated breaker has tripped 3 times in the last 30 days.', ts: hoursAgo(12), acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, notes: [], incidentId: null },
  { id: 'ea-008', meterId: 'plc-line-05', meterName: 'Wafer Line 2', severity: 'info', priority: 'low', category: 'energy', status: 'resolved', message: 'After-hours energy consumption detected', detail: 'After-hours consumption exceeded expected baseline.', ts: hoursAgo(14), acknowledgedAt: hoursAgo(13), acknowledgedBy: 'Admin', resolvedAt: hoursAgo(8), notes: ['Schedule corrected.'], incidentId: null },
  { id: 'ea-009', meterId: 'plc-line-10', meterName: 'Main Line', severity: 'critical', priority: 'high', category: 'power_quality', status: 'acknowledged', message: 'THD exceeding IEEE 519 limit', detail: 'Total Harmonic Distortion at 8.2%, exceeding the 5% IEEE 519 limit.', ts: hoursAgo(4), acknowledgedAt: hoursAgo(3.5), acknowledgedBy: 'John E.', resolvedAt: null, notes: ['Evaluating active harmonic filter installation.'], incidentId: null },
  { id: 'ea-010', meterId: 'plc-line-03', meterName: 'Pretzel Line', severity: 'warning', priority: 'medium', category: 'protection', status: 'active', message: 'Ground fault current detected', detail: 'Residual current of 45 mA detected. Threshold is 30 mA.', ts: hoursAgo(3), acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, notes: [], incidentId: null },
  { id: 'ea-011', meterId: 'plc-line-12', meterName: 'Utilities Lighting', severity: 'warning', priority: 'medium', category: 'communication', status: 'active', message: 'Communication quality degraded', detail: 'Packet loss rate has increased to 12% over the last hour.', ts: hoursAgo(1), acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, notes: [], incidentId: 'inc-001' },
  { id: 'ea-012', meterId: 'plc-line-10', meterName: 'Main Line', severity: 'info', priority: 'low', category: 'system', status: 'active', message: 'Firmware update available', detail: 'Device firmware v2.1.3 is available.', ts: hoursAgo(48), acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, notes: [], incidentId: null },
  { id: 'ea-013', meterId: 'plc-line-02', meterName: 'Cracker Line 2', severity: 'warning', priority: 'high', category: 'energy', status: 'active', message: 'Unusual energy spike', detail: 'Energy consumption jumped 35% compared to same period yesterday.', ts: hoursAgo(0.5), acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, notes: [], incidentId: null },
  { id: 'ea-014', meterId: 'plc-line-05', meterName: 'Wafer Line 2', severity: 'info', priority: 'low', category: 'system', status: 'acknowledged', message: 'Clock drift detected', detail: 'Meter clock is 2.3 seconds ahead of NTP reference.', ts: hoursAgo(20), acknowledgedAt: hoursAgo(19), acknowledgedBy: 'Admin', resolvedAt: null, notes: [], incidentId: null },
  { id: 'ea-015', meterId: 'plc-line-03', meterName: 'Pretzel Line', severity: 'critical', priority: 'urgent', category: 'protection', status: 'active', message: 'Overcurrent detected — Phase B', detail: 'Current on Phase B exceeded breaker rating. Immediate investigation required.', ts: minutesAgo(3), acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, notes: [], incidentId: null },
]

const incidents: IncidentGroup[] = [
  {
    id: 'inc-001',
    title: 'Utilities Lighting communication failure',
    rootAlertId: 'ea-002',
    alertIds: ['ea-002', 'ea-011'],
    status: 'open',
    createdAt: minutesAgo(17),
    resolvedAt: null,
    summary: 'Utilities Lighting meter lost communication. Degraded link detected prior to full outage.',
  },
  {
    id: 'inc-002',
    title: 'Grid Voltage Disturbance',
    rootAlertId: 'ea-005',
    alertIds: ['ea-005', 'ea-006'],
    status: 'investigating',
    createdAt: hoursAgo(2.3),
    resolvedAt: null,
    summary: 'Multiple voltage sag events detected across production feeders. Utility confirmed upstream disturbance.',
  },
  {
    id: 'inc-003',
    title: 'After-hours Schedule Issue',
    rootAlertId: 'ea-008',
    alertIds: ['ea-008'],
    status: 'resolved',
    createdAt: hoursAgo(14),
    resolvedAt: hoursAgo(8),
    summary: 'After-hours energy usage caused by incorrect schedule. Schedule corrected, consumption normalized.',
  },
]

const soeEntries: SequenceOfEventsEntry[] = [
  { id: 'soe-001', ts: hoursAgo(2.301), deviceId: 'plc-line-10', deviceName: 'Main Line', eventType: 'Voltage Sag', description: 'Phase A voltage dropped below 0.9 pu', value: '0.82 pu' },
  { id: 'soe-002', ts: hoursAgo(2.3009), deviceId: 'brk-101', deviceName: 'Main Line CB', eventType: 'Breaker Status', description: 'Breaker remained closed', value: 'Closed' },
  { id: 'soe-003', ts: hoursAgo(2.2995), deviceId: 'plc-line-10', deviceName: 'Main Line', eventType: 'Current Spike', description: 'Phase A current exceeded threshold', value: '945 A' },
  { id: 'soe-004', ts: hoursAgo(2.299), deviceId: 'plc-line-10', deviceName: 'Main Line', eventType: 'Voltage Recovery', description: 'Phase A voltage recovered above 0.9 pu', value: '0.97 pu' },
  { id: 'soe-005', ts: hoursAgo(1.501), deviceId: 'plc-line-03', deviceName: 'Pretzel Line', eventType: 'Voltage Sag', description: 'Three-phase sag detected', value: '0.71 pu' },
  { id: 'soe-006', ts: hoursAgo(1.5005), deviceId: 'brk-103', deviceName: 'Pretzel Line CB', eventType: 'Protection Pickup', description: 'Undervoltage element picked up', value: 'UV Pickup' },
  { id: 'soe-007', ts: hoursAgo(1.498), deviceId: 'plc-line-03', deviceName: 'Pretzel Line', eventType: 'Voltage Recovery', description: 'Three-phase voltage recovered', value: '0.95 pu' },
  { id: 'soe-008', ts: hoursAgo(1.4975), deviceId: 'brk-103', deviceName: 'Pretzel Line CB', eventType: 'Protection Reset', description: 'Undervoltage element reset', value: 'UV Reset' },
  { id: 'soe-009', ts: minutesAgo(17.1), deviceId: 'plc-line-12', deviceName: 'Utilities Lighting', eventType: 'Comm Loss', description: 'No response from Modbus register poll', value: 'Timeout' },
  { id: 'soe-010', ts: minutesAgo(17.05), deviceId: 'plc-line-12', deviceName: 'Utilities Lighting', eventType: 'Alarm Raised', description: 'Communication failure alarm activated', value: 'Critical' },
  { id: 'soe-011', ts: minutesAgo(3.01), deviceId: 'plc-line-03', deviceName: 'Pretzel Line', eventType: 'Overcurrent', description: 'Phase B current exceeded rating', value: '520 A' },
  { id: 'soe-012', ts: minutesAgo(3.005), deviceId: 'brk-103', deviceName: 'Pretzel Line CB', eventType: 'Protection Pickup', description: 'Overcurrent element 51 picked up', value: 'OC Pickup' },
]

export async function mockListLegacyAlerts(): Promise<PowerAlert[]> {
  await sleep(160)
  return legacyAlerts.sort((a, b) => (a.ts < b.ts ? 1 : -1)).map((a) => ({ ...a }))
}

export async function mockListEnhancedAlerts(): Promise<EnhancedAlert[]> {
  await sleep(180)
  return enhancedAlerts.sort((a, b) => (a.ts < b.ts ? 1 : -1)).map((a) => ({ ...a, notes: [...a.notes] }))
}

export async function mockGetEnhancedAlert(alertId: string): Promise<EnhancedAlert | null> {
  await sleep(100)
  const a = enhancedAlerts.find((x) => x.id === alertId)
  return a ? { ...a, notes: [...a.notes] } : null
}

export async function mockAcknowledgeAlert(alertId: string, by: string): Promise<EnhancedAlert | null> {
  await sleep(200)
  const a = enhancedAlerts.find((x) => x.id === alertId)
  if (!a) return null
  a.status = 'acknowledged'
  a.acknowledgedAt = new Date().toISOString()
  a.acknowledgedBy = by
  return { ...a, notes: [...a.notes] }
}

export async function mockResolveAlert(alertId: string): Promise<EnhancedAlert | null> {
  await sleep(200)
  const a = enhancedAlerts.find((x) => x.id === alertId)
  if (!a) return null
  a.status = 'resolved'
  a.resolvedAt = new Date().toISOString()
  return { ...a, notes: [...a.notes] }
}

export async function mockAddAlertNote(alertId: string, note: string): Promise<EnhancedAlert | null> {
  await sleep(150)
  const a = enhancedAlerts.find((x) => x.id === alertId)
  if (!a) return null
  a.notes.push(note)
  return { ...a, notes: [...a.notes] }
}

export async function mockListIncidents(): Promise<IncidentGroup[]> {
  await sleep(150)
  return incidents.map((inc) => ({ ...inc, alertIds: [...inc.alertIds] }))
}

export async function mockListSOE(): Promise<SequenceOfEventsEntry[]> {
  await sleep(140)
  return soeEntries.sort((a, b) => (a.ts < b.ts ? 1 : -1)).map((e) => ({ ...e }))
}

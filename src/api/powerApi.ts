import type {
  Breaker,
  CapacityThreshold,
  CostRate,
  Device,
  EnhancedAlert,
  EnergyInterval,
  Feeder,
  HarmonicSnapshot,
  IncidentGroup,
  KpiMetric,
  LoadProfile,
  MeterReading,
  PlcEnergyConsumptionSnapshot,
  PlcEnergyTotal,
  PowerAlert,
  PowerMeter,
  ReportSchedule,
  ReportTemplate,
  SequenceOfEventsEntry,
  Site,
  VoltageEvent,
  WaveformCapture,
} from '../types'
import {
  mockGetLatestReading,
  mockGetMeter,
  mockGetReadings,
  mockListAlerts,
  mockListMeters,
} from './mockPowerApi'
import {
  mockListSites,
  mockGetSite,
  mockListFeeders,
  mockListVoltageEvents,
  mockGetHarmonics,
  mockListWaveforms,
  mockGetWaveform,
  mockListEnhancedAlerts,
  mockGetEnhancedAlert,
  mockAcknowledgeAlert,
  mockResolveAlert,
  mockAddAlertNote,
  mockListIncidents,
  mockListSOE,
  mockGetEnergyIntervals,
  mockGetCostRates,
  mockGetLoadProfile,
  mockGetAllLoadProfiles,
  mockListReportTemplates,
  mockGetReportTemplate,
  mockListReportSchedules,
  mockToggleSchedule,
  mockListKpis,
  mockListDevices,
  mockGetDevice,
  mockListBreakers,
  mockGetCapacityThresholds,
} from './mocks'

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') === 'true'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').toString()

type PlcSnapshot = {
  ts: string
  values: Record<string, unknown> | null
  warning?: string
}

async function http<T>(path: string): Promise<T> {
  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return (await res.json()) as T
}

async function httpJson<T>(path: string, body: unknown): Promise<T> {
  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return (await res.json()) as T
}

async function tryGetPlcSnapshot(): Promise<PlcSnapshot | null> {
  try {
    const snap = await http<PlcSnapshot>('/api/plc/snapshot')
    if (!snap || typeof snap !== 'object') return null
    if (typeof snap.ts !== 'string') return null
    return snap
  } catch {
    return null
  }
}

function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function toNumberOrNull(v: unknown): number | null {
  if (v === undefined || v === null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** DB16 Total_EnergyCon_kWh block — order: Cracker Line 1 → Utilities Lighting. */
export const PLC_TOTAL_ENERGY_LINES = [
  { key: 'Total_CrackerLine1_kWh', name: 'Cracker Line 1' },
  { key: 'Total_CrackerLine2_kWh', name: 'Cracker Line 2' },
  { key: 'Total_PretzelLine_kWh', name: 'Pretzel Line' },
  { key: 'Total_WaferLine1_kWh', name: 'Wafer Line 1' },
  { key: 'Total_WaferLine2_kWh', name: 'Wafer Line 2' },
  { key: 'Total_ChocoyChocoLine_kWh', name: 'Chocoy Choco Line' },
  { key: 'Total_DynamiteLine_kWh', name: 'Dynamite Line' },
  { key: 'Total_XOLine_kWh', name: 'XO Line' },
  { key: 'Total_MaxxLine_kWh', name: 'Maxx Line' },
  { key: 'Total_MainLine_kWh', name: 'Main Line' },
  { key: 'Total_UtilitiesJaguar_kWh', name: 'Utilities Jaguar' },
  { key: 'Total_UtilitiesLighting_kWh', name: 'Utilities Lighting' },
] as const

function mapSnapshotToReading(meterId: string, snap: PlcSnapshot): MeterReading | null {
  if (!snap.values) return null
  // Expecting names from the Node-RED S7 endpoint variable table.
  // Default flow uses: Power_kW, Energy_kWh, Voltage_V, Current_A, PowerFactor
  const values = snap.values as Record<string, unknown>
  return {
    meterId,
    ts: snap.ts,
    powerKw: toNumber(values.Power_kW),
    energyKwh: toNumber(values.Energy_kWh),
    voltageV: toNumber(values.Voltage_V),
    currentA: toNumber(values.Current_A),
    pf: toNumber(values.PowerFactor),
  }
}

export async function getPlcEnergyTotals(): Promise<PlcEnergyTotal[]> {
  if (USE_MOCK) return []
  const snap = await tryGetPlcSnapshot()
  if (!snap?.values) return []
  const v = snap.values as Record<string, unknown>

  return PLC_TOTAL_ENERGY_LINES.map((it) => ({
    name: it.name,
    kwh: toNumber(v[it.key]),
  })).filter((x) => Number.isFinite(x.kwh))
}

/** Snapshot for the total-energy verification page (Cracker Line 1 → Utilities Lighting). */
export async function getPlcEnergyConsumptionSnapshot(): Promise<PlcEnergyConsumptionSnapshot> {
  const apiBaseUrl = API_BASE_URL || '(same origin as app)'
  if (USE_MOCK) {
    return {
      ts: new Date().toISOString(),
      connected: false,
      warning: 'VITE_USE_MOCK is enabled — set to false and point VITE_API_BASE_URL at Node-RED (e.g. http://127.0.0.1:1880).',
      apiBaseUrl,
      rows: PLC_TOTAL_ENERGY_LINES.map((l) => ({
        key: l.key,
        name: l.name,
        kwh: null,
        raw: null,
      })),
      totalEnergyKeys: {},
    }
  }
  const snap = await tryGetPlcSnapshot()
  if (!snap?.values) {
    return {
      ts: new Date().toISOString(),
      connected: false,
      warning:
        snap?.warning ??
        'No data from GET /api/plc/snapshot — ensure Node-RED is running and the S7 connection to the PLC is healthy.',
      apiBaseUrl,
      rows: PLC_TOTAL_ENERGY_LINES.map((l) => ({
        key: l.key,
        name: l.name,
        kwh: null,
        raw: undefined,
      })),
      totalEnergyKeys: {},
    }
  }
  const v = snap.values as Record<string, unknown>
  const rows = PLC_TOTAL_ENERGY_LINES.map((l) => ({
    key: l.key,
    name: l.name,
    kwh: toNumberOrNull(v[l.key]),
    raw: v[l.key],
  }))
  const totalEnergyKeys: Record<string, unknown> = {}
  for (const key of Object.keys(v)) {
    if (key.startsWith('Total_') && key.endsWith('_kWh')) {
      totalEnergyKeys[key] = v[key]
    }
  }
  return {
    ts: snap.ts,
    connected: true,
    warning: snap.warning,
    apiBaseUrl,
    rows,
    totalEnergyKeys,
  }
}

// ── Meters ─────────────────────────────────────────────

export async function listMeters(): Promise<PowerMeter[]> {
  if (USE_MOCK) return await mockListMeters()
  const snap = await tryGetPlcSnapshot()
  if (snap) {
    return [
      {
        id: 'plc-1',
        name: 'PLC (Node-RED)',
        site: 'PLC',
        status: snap.values ? 'online' : 'offline',
        lastSeenAt: snap.ts,
      },
    ]
  }
  return await http<PowerMeter[]>('/api/meters').catch(async () => await mockListMeters())
}

export async function getMeter(meterId: string): Promise<PowerMeter | null> {
  if (USE_MOCK) return await mockGetMeter(meterId)
  if (meterId === 'plc-1') {
    const snap = await tryGetPlcSnapshot()
    if (snap) {
      return {
        id: 'plc-1',
        name: 'PLC (Node-RED)',
        site: 'PLC',
        status: snap.values ? 'online' : 'offline',
        lastSeenAt: snap.ts,
      }
    }
  }
  return await http<PowerMeter>(`/api/meters/${encodeURIComponent(meterId)}`).catch(async () => await mockGetMeter(meterId))
}

export async function getLatestReading(meterId: string): Promise<MeterReading | null> {
  if (USE_MOCK) return await mockGetLatestReading(meterId)
  if (meterId === 'plc-1') {
    const snap = await tryGetPlcSnapshot()
    if (snap) return mapSnapshotToReading(meterId, snap)
  }
  return await http<MeterReading>(`/api/meters/${encodeURIComponent(meterId)}/latest`).catch(async () => await mockGetLatestReading(meterId))
}

export async function getReadings(meterId: string, minutes = 60): Promise<MeterReading[]> {
  if (USE_MOCK) return await mockGetReadings(meterId, minutes)
  if (meterId === 'plc-1') {
    const snap = await tryGetPlcSnapshot()
    const latest = snap ? mapSnapshotToReading(meterId, snap) : null
    if (!latest) return []
    const points = Math.max(24, Math.min(240, minutes))
    const nowMs = Date.now()
    const stepMs = (minutes * 60 * 1000) / points
    const out: MeterReading[] = []
    for (let i = points; i >= 0; i -= 1) {
      out.push({ ...latest, ts: new Date(nowMs - i * stepMs).toISOString() })
    }
    return out
  }
  return await http<MeterReading[]>(
    `/api/meters/${encodeURIComponent(meterId)}/readings?minutes=${encodeURIComponent(String(minutes))}`,
  ).catch(async () => await mockGetReadings(meterId, minutes))
}

export async function listAlerts(): Promise<PowerAlert[]> {
  if (USE_MOCK) return await mockListAlerts()
  return await http<PowerAlert[]>('/api/alerts').catch(async () => await mockListAlerts())
}

// ── Sites & Feeders ────────────────────────────────────

export async function listSites(): Promise<Site[]> {
  if (USE_MOCK) return await mockListSites()
  return await http<Site[]>('/api/sites').catch(async () => await mockListSites())
}

export async function getSite(siteId: string): Promise<Site | null> {
  if (USE_MOCK) return await mockGetSite(siteId)
  return await http<Site>(`/api/sites/${encodeURIComponent(siteId)}`).catch(async () => await mockGetSite(siteId))
}

export async function listFeeders(siteId?: string): Promise<Feeder[]> {
  if (USE_MOCK) return await mockListFeeders(siteId)
  const qs = siteId ? `?siteId=${encodeURIComponent(siteId)}` : ''
  return await http<Feeder[]>(`/api/feeders${qs}`).catch(async () => await mockListFeeders(siteId))
}

// ── Power Quality ──────────────────────────────────────

export async function listVoltageEvents(meterId?: string): Promise<VoltageEvent[]> {
  if (USE_MOCK) return await mockListVoltageEvents(meterId)
  const qs = meterId ? `?meterId=${encodeURIComponent(meterId)}` : ''
  return await http<VoltageEvent[]>(`/api/power-quality/events${qs}`).catch(async () => await mockListVoltageEvents(meterId))
}

export async function getHarmonics(meterId: string): Promise<HarmonicSnapshot> {
  if (USE_MOCK) return await mockGetHarmonics(meterId)
  return await http<HarmonicSnapshot>(`/api/power-quality/harmonics/${encodeURIComponent(meterId)}`).catch(
    async () => await mockGetHarmonics(meterId),
  )
}

export async function listWaveforms(meterId?: string): Promise<WaveformCapture[]> {
  if (USE_MOCK) return await mockListWaveforms(meterId)
  const qs = meterId ? `?meterId=${encodeURIComponent(meterId)}` : ''
  return await http<WaveformCapture[]>(`/api/power-quality/waveforms${qs}`).catch(async () => await mockListWaveforms(meterId))
}

export async function getWaveform(waveformId: string): Promise<WaveformCapture | null> {
  if (USE_MOCK) return await mockGetWaveform(waveformId)
  return await http<WaveformCapture>(`/api/power-quality/waveforms/${encodeURIComponent(waveformId)}`).catch(
    async () => await mockGetWaveform(waveformId),
  )
}

// ── Enhanced Alarms ────────────────────────────────────

export async function listEnhancedAlerts(): Promise<EnhancedAlert[]> {
  if (USE_MOCK) return await mockListEnhancedAlerts()
  return await http<EnhancedAlert[]>('/api/alarms').catch(async () => await mockListEnhancedAlerts())
}

export async function getEnhancedAlert(alertId: string): Promise<EnhancedAlert | null> {
  if (USE_MOCK) return await mockGetEnhancedAlert(alertId)
  return await http<EnhancedAlert>(`/api/alarms/${encodeURIComponent(alertId)}`).catch(
    async () => await mockGetEnhancedAlert(alertId),
  )
}

export async function acknowledgeAlert(alertId: string, by: string): Promise<EnhancedAlert | null> {
  if (USE_MOCK) return await mockAcknowledgeAlert(alertId, by)
  return await http<EnhancedAlert>(`/api/alarms/${encodeURIComponent(alertId)}/acknowledge`).catch(
    async () => await mockAcknowledgeAlert(alertId, by),
  )
}

export async function resolveAlert(alertId: string): Promise<EnhancedAlert | null> {
  if (USE_MOCK) return await mockResolveAlert(alertId)
  return await http<EnhancedAlert>(`/api/alarms/${encodeURIComponent(alertId)}/resolve`).catch(
    async () => await mockResolveAlert(alertId),
  )
}

export async function addAlertNote(alertId: string, note: string): Promise<EnhancedAlert | null> {
  if (USE_MOCK) return await mockAddAlertNote(alertId, note)
  return await http<EnhancedAlert>(`/api/alarms/${encodeURIComponent(alertId)}/notes`).catch(
    async () => await mockAddAlertNote(alertId, note),
  )
}

export async function listIncidents(): Promise<IncidentGroup[]> {
  if (USE_MOCK) return await mockListIncidents()
  return await http<IncidentGroup[]>('/api/incidents').catch(async () => await mockListIncidents())
}

export async function listSOE(): Promise<SequenceOfEventsEntry[]> {
  if (USE_MOCK) return await mockListSOE()
  return await http<SequenceOfEventsEntry[]>('/api/soe').catch(async () => await mockListSOE())
}

// ── Energy ─────────────────────────────────────────────

export async function getEnergyIntervals(hours = 24): Promise<EnergyInterval[]> {
  if (USE_MOCK) return await mockGetEnergyIntervals(hours)
  return await http<EnergyInterval[]>(`/api/energy/intervals?hours=${hours}`).catch(async () => await mockGetEnergyIntervals(hours))
}

export async function getCostRates(): Promise<CostRate[]> {
  if (USE_MOCK) return await mockGetCostRates()
  return await http<CostRate[]>('/api/energy/rates').catch(async () => await mockGetCostRates())
}

export async function getLoadProfile(meterId: string): Promise<LoadProfile | null> {
  if (USE_MOCK) return await mockGetLoadProfile(meterId)
  return await http<LoadProfile>(`/api/energy/load-profiles/${encodeURIComponent(meterId)}`).catch(
    async () => await mockGetLoadProfile(meterId),
  )
}

export async function getAllLoadProfiles(): Promise<LoadProfile[]> {
  if (USE_MOCK) return await mockGetAllLoadProfiles()
  return await http<LoadProfile[]>('/api/energy/load-profiles').catch(async () => await mockGetAllLoadProfiles())
}

// ── Reports ────────────────────────────────────────────

export async function listReportTemplates(): Promise<ReportTemplate[]> {
  if (USE_MOCK) return await mockListReportTemplates()
  return await http<ReportTemplate[]>('/api/reports/templates').catch(async () => await mockListReportTemplates())
}

export async function getReportTemplate(templateId: string): Promise<ReportTemplate | null> {
  if (USE_MOCK) return await mockGetReportTemplate(templateId)
  return await http<ReportTemplate>(`/api/reports/templates/${encodeURIComponent(templateId)}`).catch(
    async () => await mockGetReportTemplate(templateId),
  )
}

export async function listReportSchedules(): Promise<ReportSchedule[]> {
  if (USE_MOCK) return await mockListReportSchedules()
  return await http<ReportSchedule[]>('/api/reports/schedules').catch(async () => await mockListReportSchedules())
}

export async function toggleSchedule(scheduleId: string): Promise<ReportSchedule | null> {
  if (USE_MOCK) return await mockToggleSchedule(scheduleId)
  return await http<ReportSchedule>(`/api/reports/schedules/${encodeURIComponent(scheduleId)}/toggle`).catch(
    async () => await mockToggleSchedule(scheduleId),
  )
}

export async function listKpis(): Promise<KpiMetric[]> {
  if (USE_MOCK) return await mockListKpis()
  return await http<KpiMetric[]>('/api/reports/kpis').catch(async () => await mockListKpis())
}

export type GenerateReportRequest = {
  templateId: string
  params: Record<string, unknown>
  output: 'csv' | 'pdf'
}

export type GenerateReportResponse = {
  reportId: string
  filename: string
  mimeType: string
  // For now we keep this JSON-first. Backends can switch to signed URLs later.
  contentBase64: string
}

export async function generateReport(req: GenerateReportRequest): Promise<GenerateReportResponse> {
  if (USE_MOCK) {
    const base = {
      generatedAt: new Date().toISOString(),
      templateId: req.templateId,
      params: req.params,
    }

    if (req.output === 'csv') {
      const rows: Array<Record<string, unknown>> = [
        { key: 'generatedAt', value: base.generatedAt },
        { key: 'templateId', value: base.templateId },
        { key: 'params', value: JSON.stringify(base.params) },
      ]
      const csv = [
        'key,value',
        ...rows.map((r) => `${JSON.stringify(r.key)},${JSON.stringify(String(r.value ?? ''))}`),
      ].join('\n')
      return {
        reportId: `mock-${Math.random().toString(16).slice(2)}`,
        filename: `report-${req.templateId}.csv`,
        mimeType: 'text/csv',
        contentBase64: btoa(unescape(encodeURIComponent(csv))),
      }
    }

    // Minimal one-page PDF (ASCII-only) so browsers download/open it as a PDF.
    const lines = [
      `Power Monitor Report`,
      `Template: ${base.templateId}`,
      `Generated: ${base.generatedAt}`,
      ``,
      `Params:`,
      JSON.stringify(base.params, null, 2),
    ]
      .join('\n')
      // keep ASCII-only so our tiny PDF stays simple
      .replace(/[^\u0020-\u007E\n\r\t]/g, '?')

    // Very small PDF generator (text at fixed position)
    const text = lines.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
    const contentStream = `BT /F1 10 Tf 50 760 Td (${text.replace(/\n/g, ') Tj T* (')}) Tj ET`
    const objects: string[] = []
    objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj')
    objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj')
    objects.push(
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    )
    objects.push(`4 0 obj << /Length ${contentStream.length} >> stream\n${contentStream}\nendstream endobj`)
    objects.push('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj')

    let pdf = '%PDF-1.4\n'
    const xref: number[] = [0]
    for (const obj of objects) {
      xref.push(pdf.length)
      pdf += `${obj}\n`
    }
    const xrefStart = pdf.length
    pdf += `xref\n0 ${objects.length + 1}\n`
    pdf += `0000000000 65535 f \n`
    for (let i = 1; i < xref.length; i++) {
      pdf += `${String(xref[i]).padStart(10, '0')} 00000 n \n`
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

    return {
      reportId: `mock-${Math.random().toString(16).slice(2)}`,
      filename: `report-${req.templateId}.pdf`,
      mimeType: 'application/pdf',
      contentBase64: btoa(unescape(encodeURIComponent(pdf))),
    }
  }
  return await httpJson<GenerateReportResponse>('/api/reports/generate', req)
}

// ── Devices ────────────────────────────────────────────

export async function listDevices(): Promise<Device[]> {
  if (USE_MOCK) return await mockListDevices()
  return await http<Device[]>('/api/devices').catch(async () => await mockListDevices())
}

export async function getDevice(deviceId: string): Promise<Device | null> {
  if (USE_MOCK) return await mockGetDevice(deviceId)
  return await http<Device>(`/api/devices/${encodeURIComponent(deviceId)}`).catch(async () => await mockGetDevice(deviceId))
}

// ── Safety ─────────────────────────────────────────────

export async function listBreakers(): Promise<Breaker[]> {
  if (USE_MOCK) return await mockListBreakers()
  return await http<Breaker[]>('/api/breakers').catch(async () => await mockListBreakers())
}

export async function getCapacityThresholds(): Promise<CapacityThreshold[]> {
  if (USE_MOCK) return await mockGetCapacityThresholds()
  return await http<CapacityThreshold[]>('/api/capacity').catch(async () => await mockGetCapacityThresholds())
}

import type { KpiMetric, ReportSchedule, ReportTemplate } from '../../types'
import { sleep } from './helpers'

const templates: ReportTemplate[] = [
  {
    id: 'rpt-001',
    name: 'Monthly Energy Summary',
    description: 'Comprehensive energy consumption breakdown by meter, site, and time-of-use tier.',
    type: 'energy',
    parameters: [
      { key: 'month', label: 'Month', inputType: 'date' },
      { key: 'site', label: 'Site', inputType: 'select' },
    ],
  },
  // 1) Energy Consumption Reports
  {
    id: 'rpt-010',
    name: 'Energy Consumption (Daily/Weekly/Monthly/Yearly)',
    description: 'kWh consumption summaries with optional feeder/building/tenant breakdown and load profile.',
    type: 'energy',
    parameters: [
      { key: 'dateRange', label: 'Date Range', inputType: 'date' },
      { key: 'site', label: 'Site', inputType: 'select' },
      { key: 'building', label: 'Building', inputType: 'text' },
      { key: 'tenant', label: 'Tenant', inputType: 'text' },
      { key: 'feeder', label: 'Feeder', inputType: 'text' },
      { key: 'interval', label: 'Interval (15m/30m)', inputType: 'text' },
      { key: 'tou', label: 'Time-of-Use (TOU)', inputType: 'text' },
    ],
  },
  // 2) Power Quality Reports
  {
    id: 'rpt-020',
    name: 'Power Quality Summary',
    description: 'Voltage events, harmonics (THD), transients and compliance summary (IEC 61000-4-30 / EN 50160).',
    type: 'power_quality',
    parameters: [
      { key: 'dateRange', label: 'Date Range', inputType: 'date' },
      { key: 'meter', label: 'Meter', inputType: 'select' },
      { key: 'includeWaveforms', label: 'Include waveforms (yes/no)', inputType: 'text' },
    ],
  },
  // 3) Demand & Load Analysis
  {
    id: 'rpt-030',
    name: 'Demand & Load Analysis',
    description: 'Peak demand tracking, demand trends, load factor, and equipment loading (transformers/feeders).',
    type: 'demand',
    parameters: [
      { key: 'month', label: 'Month', inputType: 'date' },
      { key: 'site', label: 'Site', inputType: 'select' },
      { key: 'meter', label: 'Meter', inputType: 'select' },
      { key: 'feeder', label: 'Feeder', inputType: 'text' },
      { key: 'transformer', label: 'Transformer', inputType: 'text' },
    ],
  },
  // 4) Alarms & Events Reports
  {
    id: 'rpt-040',
    name: 'Alarms & Events Summary',
    description: 'Alarm history, breaker trip logs, and SOE timeline for fault investigation.',
    type: 'custom',
    parameters: [
      { key: 'dateRange', label: 'Date Range', inputType: 'date' },
      { key: 'site', label: 'Site', inputType: 'select' },
      { key: 'meter', label: 'Meter', inputType: 'select' },
      { key: 'includeSOE', label: 'Include SOE (yes/no)', inputType: 'text' },
    ],
  },
  // 5) Equipment Performance Reports
  {
    id: 'rpt-050',
    name: 'Equipment Performance',
    description: 'Asset-focused report: loading, PF trends, and maintenance indicators (transformers/motors where available).',
    type: 'custom',
    parameters: [
      { key: 'dateRange', label: 'Date Range', inputType: 'date' },
      { key: 'site', label: 'Site', inputType: 'select' },
      { key: 'asset', label: 'Asset', inputType: 'text' },
    ],
  },
  // 6) Cost & Billing Reports
  {
    id: 'rpt-060',
    name: 'Cost & Billing',
    description: 'Tariff-based cost computation, allocations, and peak demand penalties for billing reconciliation.',
    type: 'billing',
    parameters: [
      { key: 'month', label: 'Billing Period', inputType: 'date' },
      { key: 'site', label: 'Site', inputType: 'select' },
      { key: 'tenant', label: 'Tenant', inputType: 'text' },
      { key: 'tariff', label: 'Tariff', inputType: 'text' },
    ],
  },
  // 7) Carbon & Sustainability Reports
  {
    id: 'rpt-070',
    name: 'Carbon & Sustainability',
    description: 'CO₂ emissions, energy intensity, and sustainability KPIs for ESG-style dashboards.',
    type: 'custom',
    parameters: [
      { key: 'dateRange', label: 'Date Range', inputType: 'date' },
      { key: 'site', label: 'Site', inputType: 'select' },
      { key: 'emissionsFactor', label: 'Emissions factor (kgCO2/kWh)', inputType: 'text' },
      { key: 'areaM2', label: 'Area (m²)', inputType: 'text' },
      { key: 'unitsProduced', label: 'Units produced', inputType: 'text' },
    ],
  },
  // 8) Trend & Historical Reports
  {
    id: 'rpt-080',
    name: 'Trend & Historical',
    description: 'Multi-parameter trends and comparisons across a custom date range.',
    type: 'custom',
    parameters: [
      { key: 'dateRange', label: 'Date Range', inputType: 'date' },
      { key: 'meter', label: 'Meter', inputType: 'select' },
      { key: 'series', label: 'Series (comma-separated: V,I,kW,PF)', inputType: 'text' },
    ],
  },
  // 9) Custom Reports
  {
    id: 'rpt-090',
    name: 'Custom Report',
    description: 'Flexible report generation with template-driven parameters and scheduling hooks.',
    type: 'custom',
    parameters: [
      { key: 'title', label: 'Report Title', inputType: 'text' },
      { key: 'dateRange', label: 'Date Range', inputType: 'date' },
      { key: 'site', label: 'Site', inputType: 'select' },
      { key: 'meter', label: 'Meter', inputType: 'select' },
      { key: 'notes', label: 'Notes', inputType: 'text' },
    ],
  },
]

const schedules: ReportSchedule[] = [
  { id: 'sched-001', templateId: 'rpt-001', templateName: 'Monthly Energy Summary', frequency: 'monthly', nextRun: '2026-04-01T06:00:00Z', recipients: ['energy-team@company.com'], enabled: true },
  { id: 'sched-002', templateId: 'rpt-002', templateName: 'Power Quality Report', frequency: 'weekly', nextRun: '2026-03-23T06:00:00Z', recipients: ['pq-engineer@company.com'], enabled: true },
  { id: 'sched-003', templateId: 'rpt-003', templateName: 'ISO 50001 Compliance', frequency: 'monthly', nextRun: '2026-04-01T06:00:00Z', recipients: ['compliance@company.com', 'management@company.com'], enabled: true },
  { id: 'sched-004', templateId: 'rpt-005', templateName: 'Billing Reconciliation', frequency: 'monthly', nextRun: '2026-04-01T08:00:00Z', recipients: ['finance@company.com'], enabled: false },
]

const kpis: KpiMetric[] = [
  { id: 'kpi-001', name: 'Energy Intensity', unit: 'kWh/m\u00b2', currentValue: 142, targetValue: 130, previousValue: 148, trend: 'down', status: 'at-risk' },
  { id: 'kpi-002', name: 'Average Power Factor', unit: '', currentValue: 0.94, targetValue: 0.95, previousValue: 0.93, trend: 'up', status: 'at-risk' },
  { id: 'kpi-003', name: 'Peak Demand', unit: 'kW', currentValue: 685, targetValue: 700, previousValue: 710, trend: 'down', status: 'on-track' },
  { id: 'kpi-004', name: 'Energy Cost', unit: '$/month', currentValue: 18420, targetValue: 17000, previousValue: 19100, trend: 'down', status: 'at-risk' },
  { id: 'kpi-005', name: 'THD Compliance', unit: '%', currentValue: 92, targetValue: 100, previousValue: 88, trend: 'up', status: 'at-risk' },
  { id: 'kpi-006', name: 'Meter Availability', unit: '%', currentValue: 98.5, targetValue: 99.5, previousValue: 97.2, trend: 'up', status: 'on-track' },
  { id: 'kpi-007', name: 'Load Factor', unit: '', currentValue: 0.72, targetValue: 0.75, previousValue: 0.69, trend: 'up', status: 'on-track' },
  { id: 'kpi-008', name: 'Alarm Response Time', unit: 'min', currentValue: 8.5, targetValue: 5, previousValue: 12, trend: 'down', status: 'off-track' },
]

export async function mockListReportTemplates(): Promise<ReportTemplate[]> {
  await sleep(120)
  return templates.map((t) => ({ ...t, parameters: [...t.parameters] }))
}

export async function mockGetReportTemplate(templateId: string): Promise<ReportTemplate | null> {
  await sleep(80)
  const t = templates.find((x) => x.id === templateId)
  return t ? { ...t, parameters: [...t.parameters] } : null
}

export async function mockListReportSchedules(): Promise<ReportSchedule[]> {
  await sleep(130)
  return schedules.map((s) => ({ ...s, recipients: [...s.recipients] }))
}

export async function mockToggleSchedule(scheduleId: string): Promise<ReportSchedule | null> {
  await sleep(150)
  const s = schedules.find((x) => x.id === scheduleId)
  if (!s) return null
  s.enabled = !s.enabled
  return { ...s, recipients: [...s.recipients] }
}

export async function mockListKpis(): Promise<KpiMetric[]> {
  await sleep(140)
  return kpis.map((k) => ({ ...k }))
}

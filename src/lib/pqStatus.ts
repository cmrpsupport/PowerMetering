import type { FluctuationAlert } from './fluctuationDetection'
import {
  maxPqLevel,
  PQ_FREQ_DEV_CRIT_HZ,
  PQ_FREQ_DEV_WARN_HZ,
  PQ_FLICKER_CRIT_PST,
  PQ_FLICKER_WARN_PST,
  PQ_NOMINAL_HZ,
  PQ_NOMINAL_V_LL,
  PQ_THD_CRIT_PCT,
  PQ_THD_WARN_PCT,
  PQ_VOLTAGE_DEV_CRIT_PCT,
  PQ_VOLTAGE_DEV_WARN_PCT,
  type PqLevel,
} from './pqStandards'
import type { VoltageEvent, VoltageEventType } from '../types'

export type PqRollup = {
  level: PqLevel
  worstLabel: string
  activePqAlarms: number
  /** Human-readable worst condition for the status bar. */
  summaryLine: string
}

export function levelFromVoltageDeviationPct(devPct: number | null): PqLevel {
  if (devPct === null || !Number.isFinite(devPct)) return 'normal'
  const a = Math.abs(devPct)
  if (a >= PQ_VOLTAGE_DEV_CRIT_PCT) return 'critical'
  if (a >= PQ_VOLTAGE_DEV_WARN_PCT) return 'warning'
  return 'normal'
}

export function levelFromFreqDeviationHz(devHz: number | null): PqLevel {
  if (devHz === null || !Number.isFinite(devHz)) return 'normal'
  const a = Math.abs(devHz)
  if (a >= PQ_FREQ_DEV_CRIT_HZ) return 'critical'
  if (a >= PQ_FREQ_DEV_WARN_HZ) return 'warning'
  return 'normal'
}

function levelFromThd(thdPct: number | null): PqLevel {
  if (thdPct === null || !Number.isFinite(thdPct)) return 'normal'
  if (thdPct >= PQ_THD_CRIT_PCT) return 'critical'
  if (thdPct >= PQ_THD_WARN_PCT) return 'warning'
  return 'normal'
}

function levelFromFlicker(pst: number | null): PqLevel {
  if (pst === null || !Number.isFinite(pst)) return 'normal'
  if (pst >= PQ_FLICKER_CRIT_PST) return 'critical'
  if (pst >= PQ_FLICKER_WARN_PST) return 'warning'
  return 'normal'
}

function eventSeverity(type: VoltageEventType, magnitudePu: number): PqLevel {
  if (type === 'interruption') return 'critical'
  if (type === 'sag') {
    const dipPct = (1 - magnitudePu) * 100
    if (dipPct >= 40 || magnitudePu < 0.5) return 'critical'
    return 'warning'
  }
  if (type === 'swell') {
    const risePct = (magnitudePu - 1) * 100
    if (risePct >= 15) return 'critical'
    return 'warning'
  }
  if (type === 'transient') return 'warning'
  return 'normal'
}

function worstEventLabel(events: VoltageEvent[]): string {
  if (events.length === 0) return 'No PQ events in range'
  let worst: { e: VoltageEvent; level: PqLevel } | null = null
  for (const e of events) {
    const level = eventSeverity(e.type, e.magnitudePu)
    if (!worst || rank(level) > rank(worst.level) || (rank(level) === rank(worst.level) && e.durationMs > worst.e.durationMs)) {
      worst = { e, level }
    }
  }
  if (!worst) return 'No PQ events in range'
  const e = worst.e
  if (e.type === 'sag') {
    const pct = Math.round((1 - e.magnitudePu) * 100)
    return `Voltage sag −${pct}%`
  }
  if (e.type === 'swell') {
    const pct = Math.round((e.magnitudePu - 1) * 100)
    return `Voltage swell +${pct}%`
  }
  if (e.type === 'interruption') return 'Supply interruption'
  return `Transient / ${e.type}`
}

function rank(l: PqLevel): number {
  return l === 'critical' ? 2 : l === 'warning' ? 1 : 0
}

export function computePqRollup(input: {
  plcConnected: boolean
  /** Live snapshot: V, Hz */
  voltageV: number | null
  frequencyHz: number | null
  /** Optional harmonics snapshot */
  thdPercent: number | null
  flickerPst: number | null
  voltageEvents: VoltageEvent[]
  fluctuationAlerts: FluctuationAlert[]
  pqAlertCount: number
}): PqRollup {
  const { plcConnected, voltageV, frequencyHz, thdPercent, flickerPst, voltageEvents, fluctuationAlerts, pqAlertCount } = input

  if (!plcConnected) {
    return {
      level: 'critical',
      worstLabel: 'PLC disconnected',
      activePqAlarms: pqAlertCount,
      summaryLine: 'No live telemetry — verify PLC / network',
    }
  }

  const vDevPct =
    voltageV !== null && Number.isFinite(voltageV) && PQ_NOMINAL_V_LL > 0
      ? ((voltageV - PQ_NOMINAL_V_LL) / PQ_NOMINAL_V_LL) * 100
      : null
  const fDevHz =
    frequencyHz !== null && Number.isFinite(frequencyHz) ? frequencyHz - PQ_NOMINAL_HZ : null

  let level: PqLevel = 'normal'
  level = maxPqLevel(level, levelFromVoltageDeviationPct(vDevPct))
  level = maxPqLevel(level, levelFromFreqDeviationHz(fDevHz))
  level = maxPqLevel(level, levelFromThd(thdPercent))
  level = maxPqLevel(level, levelFromFlicker(flickerPst))

  for (const a of fluctuationAlerts) {
    level = maxPqLevel(level, a.severity === 'critical' ? 'critical' : 'warning')
  }

  for (const e of voltageEvents) {
    level = maxPqLevel(level, eventSeverity(e.type, e.magnitudePu))
  }

  const worstEvent = worstEventLabel(voltageEvents)
  const worstLabel =
    level === 'normal'
      ? 'Within IEC-style advisory limits'
      : voltageEvents.length > 0
        ? worstEvent
        : fluctuationAlerts.length > 0
          ? `${fluctuationAlerts.length} fluctuation spike(s)`
          : vDevPct !== null && Math.abs(vDevPct) >= PQ_VOLTAGE_DEV_WARN_PCT
            ? `Voltage deviation ${vDevPct >= 0 ? '+' : ''}${vDevPct.toFixed(1)}%`
            : fDevHz !== null && Math.abs(fDevHz) >= PQ_FREQ_DEV_WARN_HZ
              ? `Frequency deviation ${fDevHz >= 0 ? '+' : ''}${fDevHz.toFixed(2)} Hz`
              : 'Review THD / flicker / events'

  const summaryLine =
    level === 'critical'
      ? worstLabel
      : level === 'warning'
        ? worstLabel
        : 'Steady-state quantities within configured advisory bands'

  return {
    level,
    worstLabel,
    activePqAlarms: pqAlertCount,
    summaryLine,
  }
}

export function classifyVoltageDeviationPct(devPct: number): PqLevel {
  return levelFromVoltageDeviationPct(devPct)
}

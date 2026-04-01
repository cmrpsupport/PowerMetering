/** Threshold-based KPI status for dashboard cards (Monitoring). */

export type KpiStatusLevel = 'ok' | 'warning' | 'critical' | 'unknown'

export type KpiStatusResult = {
  level: KpiStatusLevel
  /** Tooltip / aria text */
  detail: string
}

/** Worst (minimum) PF across meters — conservative. */
export function statusPowerFactor(minPf: number): KpiStatusResult {
  if (!Number.isFinite(minPf) || minPf <= 0) {
    return { level: 'unknown', detail: 'No power factor data' }
  }
  if (minPf >= 0.95) {
    return { level: 'ok', detail: 'Normal: power factor ≥ 0.95' }
  }
  if (minPf >= 0.85) {
    return { level: 'warning', detail: 'Warning: power factor 0.85–0.94' }
  }
  return { level: 'critical', detail: 'Critical: power factor below 0.85' }
}

/** Average line-to-line voltage (V). */
export function statusVoltageLavg(v: number): KpiStatusResult {
  if (!Number.isFinite(v) || v <= 0) {
    return { level: 'unknown', detail: 'No voltage data' }
  }
  if (v >= 380 && v <= 415) {
    return { level: 'ok', detail: 'Normal: line voltage 380–415 V' }
  }
  if (v < 360 || v > 430) {
    return { level: 'critical', detail: 'Critical: voltage below 360 V or above 430 V' }
  }
  return {
    level: 'warning',
    detail: 'Warning: line voltage 360–379 V or 416–430 V',
  }
}

/** Average system frequency (Hz). */
export function statusFrequency(avgHz: number): KpiStatusResult {
  if (!Number.isFinite(avgHz) || avgHz <= 0) {
    return { level: 'unknown', detail: 'No frequency data' }
  }
  if (avgHz >= 59.8 && avgHz <= 60.2) {
    return { level: 'ok', detail: 'Normal: frequency 59.8–60.2 Hz' }
  }
  if (avgHz < 59.5 || avgHz > 60.5) {
    return { level: 'critical', detail: 'Critical: frequency below 59.5 Hz or above 60.5 Hz' }
  }
  if (avgHz >= 59.5 && avgHz <= 60.5) {
    return {
      level: 'warning',
      detail: 'Warning: frequency 59.5–59.7 Hz or 60.3–60.5 Hz (outside nominal band)',
    }
  }
  return { level: 'unknown', detail: 'Frequency out of defined bands' }
}

/** Total plant reactive power (kVAR). */
export function statusReactiveKvar(totalKvar: number): KpiStatusResult {
  if (!Number.isFinite(totalKvar)) {
    return { level: 'unknown', detail: 'No reactive power data' }
  }
  const ax = Math.abs(totalKvar)
  if (ax <= 10) {
    return { level: 'ok', detail: 'Normal: reactive power within ±10 kVAR' }
  }
  if (ax <= 20) {
    return { level: 'warning', detail: 'Warning: reactive power between ±11 and ±20 kVAR' }
  }
  return { level: 'critical', detail: 'Critical: reactive power beyond ±20 kVAR' }
}

/** Share of meters reporting (0–100). */
export function statusMetersOnlinePct(pct: number): KpiStatusResult {
  if (!Number.isFinite(pct)) {
    return { level: 'unknown', detail: 'No meter coverage data' }
  }
  if (pct >= 90) {
    return { level: 'ok', detail: 'Normal: ≥ 90% of meters online' }
  }
  if (pct >= 70) {
    return { level: 'warning', detail: 'Warning: 70–89% of meters online' }
  }
  return { level: 'critical', detail: 'Critical: below 70% of meters online' }
}

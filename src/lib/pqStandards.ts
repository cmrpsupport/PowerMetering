/**
 * Configurable IEC / plant-style power quality limits (EN 50160–inspired, simplified for ops dashboards).
 * Tune per site via env or future settings API.
 */

const envNum = (k: string, fallback: number) => {
  const v = import.meta.env[k] as string | undefined
  const n = v !== undefined ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}

/** Line-to-line nominal (V) — typical industrial 400 V or 230 V depending on transformer tap. */
export const PQ_NOMINAL_V_LL = envNum('VITE_PQ_NOMINAL_V_LL', 400)

/** Nominal system frequency (Philippines 60 Hz). */
export const PQ_NOMINAL_HZ = envNum('VITE_PQ_NOMINAL_HZ', 60)

/** Voltage deviation |ΔV| from nominal — percent of nominal. */
export const PQ_VOLTAGE_DEV_WARN_PCT = envNum('VITE_PQ_VOLTAGE_DEV_WARN_PCT', 5)
export const PQ_VOLTAGE_DEV_CRIT_PCT = envNum('VITE_PQ_VOLTAGE_DEV_CRIT_PCT', 10)

/** Frequency deviation |Δf| from nominal (Hz). */
export const PQ_FREQ_DEV_WARN_HZ = envNum('VITE_PQ_FREQ_DEV_WARN_HZ', 0.35)
export const PQ_FREQ_DEV_CRIT_HZ = envNum('VITE_PQ_FREQ_DEV_CRIT_HZ', 0.8)

/** THD (voltage) — IEC 61000-2-2 / plant limits vary; use as guidance. */
export const PQ_THD_WARN_PCT = envNum('VITE_PQ_THD_WARN_PCT', 5)
export const PQ_THD_CRIT_PCT = envNum('VITE_PQ_THD_CRIT_PCT', 8)

/** Flicker Pst (short-term) — EN 50160 commonly 1.0 for LV. */
export const PQ_FLICKER_WARN_PST = envNum('VITE_PQ_FLICKER_WARN_PST', 0.7)
export const PQ_FLICKER_CRIT_PST = envNum('VITE_PQ_FLICKER_CRIT_PST', 1.0)

export type PqLevel = 'normal' | 'warning' | 'critical'

export function maxPqLevel(a: PqLevel, b: PqLevel): PqLevel {
  const o = { normal: 0, warning: 1, critical: 2 }
  return o[a] >= o[b] ? a : b
}

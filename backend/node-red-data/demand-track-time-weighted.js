// Reference implementation (embedded in flows.json as escaped string).
// Time-weighted rolling demand over sliding 15-min window; fixed clock 15-min billing max.

const v = msg.payload || {}
if (!msg.payload || typeof msg.payload !== 'object') return null

const WINDOW_MS = 15 * 60 * 1000
const WINDOW_SEC = WINDOW_MS / 1000
const PLANT_MAX_KW = 50000
const now = Date.now()

const toNum = (x) => {
  const n = typeof x === 'number' ? x : Number(x)
  return Number.isFinite(n) ? n : NaN
}

let totalKw = toNum(v.Power_kW)
if (!Number.isFinite(totalKw) || totalKw <= 0) {
  const meters = [
    'RIO1CM1_EMU4_1',
    'RIO1CM1_EMU4_2',
    'RIO1CM2_EM6400_10',
    'RIO1CM2_EM6400_11',
    'RIO2CM1_EMU4_1',
    'RIO2CM1_EMU4_2',
    'RIO2CM1_EMU4_3',
    'RIO2CM1_EMU4_4',
    'RIO2CM1_EMU4_5',
    'RIO2CM1_EMU4_6',
    'RIO2CM1_EMU4_7',
    'RIO2CM1_EMU4_8',
    'RIO2CM1_EMU4_9',
    'RIO2CM1_EMU4_10',
    'RIO2CM1_EMU4_11',
    'RIO2CM1_EMU4_12',
    'RIO2CM2_EM6400_1',
    'RIO2CM2_EM6400_2',
    'RIO2CM2_EM6400_3',
    'RIO2CM2_EM6400_4',
    'RIO2CM2_EM6400_5',
    'RIO2CM2_EM6400_6',
    'RIO2_PAC3200_51',
    'RIO2_PAC3200_53',
    'RIO2_UMG508_52',
  ]
  totalKw = 0
  for (const m of meters) totalKw += toNum(v[m + '_Real_power'])
}

const validKw = (kw) => Number.isFinite(kw) && kw > 0 && kw <= PLANT_MAX_KW

if (validKw(totalKw)) {
  global.set('demandLastInstantKw', totalKw)
}

const instantKw = global.get('demandLastInstantKw')
const instantKwNum = Number.isFinite(instantKw) ? instantKw : 0

const buf = global.get('demandBuf') || []
if (validKw(totalKw)) {
  buf.push({ t: now, kw: totalKw })
}
// Keep one sample before the window start so the time-weighted average
// can use the correct "previous" kW value for the partial first segment.
const winStart = now - WINDOW_MS
while (buf.length > 1 && buf[1].t < winStart) buf.shift()
global.set('demandBuf', buf)

function integrateKwOverMs(samples, startMs, endMs) {
  if (!samples || samples.length === 0) return 0
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0
  if (endMs <= startMs) return 0
  const sorted = samples.slice().sort((a, b) => a.t - b.t)
  if (sorted.length === 0) return 0
  let integral = 0

  // Find the last sample at/before startMs (for the initial partial segment).
  let idx = 0
  while (idx < sorted.length && sorted[idx].t <= startMs) idx++
  // idx is first sample after start; previous is idx-1 (or first sample if none).
  let kwPrev = idx > 0 ? sorted[idx - 1].kw : sorted[0].kw
  let tCursor = startMs

  while (idx < sorted.length) {
    const tNext = sorted[idx].t
    if (tNext >= endMs) break
    const dtSec = (tNext - tCursor) / 1000
    if (dtSec > 0) {
      // Assume sample's kW holds until next sample.
      // This matches typical PLC "last value until next timestamp".
      integral += kwPrev * dtSec
    }
    tCursor = tNext
    kwPrev = sorted[idx].kw
    idx++
  }

  const dtLastSec = (endMs - tCursor) / 1000
  if (dtLastSec > 0) {
    integral += kwPrev * dtLastSec
  }
  return integral
}

function timeWeightedKw(samples, tNow, winMs) {
  const T0 = tNow - winMs
  // Average kW = integral(kW over time) / winSeconds
  const integralKwSec = integrateKwOverMs(samples, T0, tNow)
  if (!Number.isFinite(integralKwSec) || WINDOW_SEC <= 0) return 0
  return integralKwSec / WINDOW_SEC
}

const rollingKw = timeWeightedKw(buf, now, WINDOW_MS)

const d = new Date(now)
const slotMin = Math.floor(d.getMinutes() / 15) * 15
const slotStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), slotMin, 0, 0).getTime()

// Fixed demand (billing-style): integrate kW over the fixed 15-min clock interval
// and divide by 900 seconds. This resets at each 15-min boundary.
const bill = global.get('demandBilling') || { slotStart: slotStart }
let completedSlotFixedKw = null
let completedSlotFixedTs = null
if (bill.slotStart !== slotStart) {
  // Slot boundary reached: finalize previous slot using full interval [prevSlotStart, slotStart]
  const prevSlotStart = bill.slotStart
  const prevSlotEnd = slotStart
  const prevFixedKw = integrateKwOverMs(buf, prevSlotStart, prevSlotEnd) / WINDOW_SEC
  completedSlotFixedKw = prevFixedKw
  completedSlotFixedTs = new Date(prevSlotEnd).toISOString()

  bill.slotStart = slotStart
  bill.lastCompletedFixedKw = prevFixedKw
  global.set('demandBilling', bill)
}

const fixedDemandKw = integrateKwOverMs(buf, slotStart, now) / WINDOW_SEC

const currentMonth = new Date().toISOString().slice(0, 7)
let state = global.get('demandState') || {}
if (state.month !== currentMonth) {
  state = { month: currentMonth, peakKw: 0, peakTs: null, thresholdKw: state.thresholdKw || 0 }
}

// Monthly peak should follow billing fixed interval demand, not rolling.
if (completedSlotFixedKw !== null && Number.isFinite(completedSlotFixedKw) && completedSlotFixedKw > state.peakKw) {
  state.peakKw = completedSlotFixedKw
  state.peakTs = completedSlotFixedTs
}

if (state.thresholdKw <= 0 && state.peakKw > 0) {
  state.thresholdKw = Math.ceil(state.peakKw * 1.1)
}

const threshold = state.thresholdKw || 0
const pctOfThreshold = threshold > 0 ? rollingKw / threshold : 0

global.set('demandState', state)

const lastAlertLevel = global.get('demandAlertLevel') || 0
let newLevel = 0
if (pctOfThreshold >= 0.95) newLevel = 2
else if (pctOfThreshold >= 0.8) newLevel = 1

if (newLevel > lastAlertLevel) {
  global.set('demandAlertLevel', newLevel)
  const alerts = global.get('enhancedAlerts') || []
  const ts = new Date().toISOString()
  const id = 'demand-' + ts + '-' + Math.random().toString(16).slice(2, 8)
  const severity = newLevel === 2 ? 'critical' : 'warning'
  const priority = newLevel === 2 ? 'urgent' : 'high'
  const pctStr = (pctOfThreshold * 100).toFixed(0)
  const message =
    newLevel === 2
      ? 'Demand at ' + pctStr + '% of threshold — shed load NOW'
      : 'Demand approaching threshold (' + pctStr + '%)'
  const detail =
    'Time-weighted 15-min rolling: ' +
    rollingKw.toFixed(1) +
    ' kW. Threshold: ' +
    threshold.toFixed(0) +
    ' kW. Monthly peak: ' +
    state.peakKw.toFixed(1) +
    ' kW.'
  alerts.unshift({
    id,
    meterId: 'plant',
    meterName: 'Plant Demand',
    severity,
    priority,
    category: 'energy',
    status: 'active',
    message,
    detail,
    ts,
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    notes: [],
    incidentId: null,
  })
  while (alerts.length > 500) alerts.pop()
  global.set('enhancedAlerts', alerts)
}

if (pctOfThreshold < 0.75 && lastAlertLevel > 0) {
  global.set('demandAlertLevel', 0)
}

global.set('demandLastMeta', {
  ts: new Date().toISOString(),
  instantKw: Math.round(instantKwNum * 10) / 10,
  currentDemandKw: Math.round(rollingKw * 10) / 10,
  fixedDemandKw: Math.round(fixedDemandKw * 10) / 10,
  monthlyPeakKw: Math.round((state.peakKw || 0) * 10) / 10,
  monthlyPeakTs: state.peakTs || null,
  thresholdKw: threshold,
  pctOfThreshold: Math.round(pctOfThreshold * 1000) / 10,
  windowSeconds: 900,
  samplesInWindow: buf.length,
})

const insertEveryMs = 60000
const lastIns = global.get('demandSampleLastMs') || 0
if (now - lastIns >= insertEveryMs) {
  global.set('demandSampleLastMs', now)
  const ts = new Date().toISOString().replace(/'/g, "''")
  const tsEpoch = Math.floor(now / 1000)
  msg.topic = `INSERT INTO demand_samples (ts, ts_epoch, current_demand_kw, instant_kw) VALUES ('${ts}', ${tsEpoch}, ${Number(rollingKw)}, ${Number(instantKwNum)});`
  return msg
}
return null

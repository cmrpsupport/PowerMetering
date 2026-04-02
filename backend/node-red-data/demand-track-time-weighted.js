// Reference implementation (embedded in flows.json as escaped string).
// Time-weighted rolling demand over sliding 15-min window; fixed clock 15-min billing max.

const v = msg.payload || {}
if (!msg.payload || typeof msg.payload !== 'object') return null

const WINDOW_MS = 15 * 60 * 1000
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
while (buf.length > 0 && buf[0].t < now - WINDOW_MS) buf.shift()
global.set('demandBuf', buf)

function timeWeightedKw(samples, tNow, winMs) {
  const T0 = tNow - winMs
  const durSec = (tNow - T0) / 1000
  if (durSec <= 0) return 0
  if (!samples || samples.length === 0) return 0
  const sorted = samples.slice().sort((a, b) => a.t - b.t)
  const n = sorted.length
  let integral = 0
  if (sorted[0].t > T0) {
    integral += sorted[0].kw * ((sorted[0].t - T0) / 1000)
  }
  for (let i = 1; i < n; i++) {
    const dt = (sorted[i].t - sorted[i - 1].t) / 1000
    if (dt > 0) integral += sorted[i - 1].kw * dt
  }
  const dtLast = (tNow - sorted[n - 1].t) / 1000
  if (dtLast > 0) integral += sorted[n - 1].kw * dtLast
  return integral / durSec
}

const rollingKw = timeWeightedKw(buf, now, WINDOW_MS)

const d = new Date(now)
const slotMin = Math.floor(d.getMinutes() / 15) * 15
const slotStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), slotMin, 0, 0).getTime()
let bill = global.get('demandBilling') || { slotStart: 0, maxKw: 0 }
if (bill.slotStart !== slotStart) {
  bill = { slotStart: slotStart, maxKw: rollingKw }
} else {
  bill.maxKw = Math.max(Number(bill.maxKw) || 0, rollingKw)
}
global.set('demandBilling', bill)
const fixedDemandKw = bill.maxKw

const currentMonth = new Date().toISOString().slice(0, 7)
let state = global.get('demandState') || {}
if (state.month !== currentMonth) {
  state = { month: currentMonth, peakKw: 0, peakTs: null, thresholdKw: state.thresholdKw || 0 }
}

if (rollingKw > state.peakKw) {
  state.peakKw = rollingKw
  state.peakTs = new Date().toISOString()
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

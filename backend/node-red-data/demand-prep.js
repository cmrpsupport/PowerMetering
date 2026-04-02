const state = global.get('demandState') || {}
const buf = global.get('demandBuf') || []
const WINDOW_MS = 15 * 60 * 1000

const setTh = Number(msg.req?.query?.setThreshold)
if (Number.isFinite(setTh) && setTh > 0) {
  state.thresholdKw = setTh
  global.set('demandState', state)
}

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

const now = Date.now()
const meta0 = global.get('demandLastMeta') || {}
const hasMeta = meta0 && typeof meta0.currentDemandKw === 'number'

let instantKw = meta0.instantKw
let currentDemandKw = meta0.currentDemandKw
let fixedDemandKw = meta0.fixedDemandKw
let monthlyPeakKw = meta0.monthlyPeakKw
let monthlyPeakTs = meta0.monthlyPeakTs
let pctOfThreshold = meta0.pctOfThreshold
let samplesInWindow = meta0.samplesInWindow
let tsIso = meta0.ts

if (!hasMeta) {
  const tw = timeWeightedKw(buf, now, WINDOW_MS)
  currentDemandKw = Math.round(tw * 10) / 10
  instantKw = buf.length > 0 ? Math.round(buf[buf.length - 1].kw * 10) / 10 : 0
  fixedDemandKw = 0
  const th0 = state.thresholdKw || 0
  pctOfThreshold = th0 > 0 ? Math.round((tw / th0) * 1000) / 10 : 0
  samplesInWindow = buf.length
  tsIso = new Date().toISOString()
  monthlyPeakKw = Math.round((state.peakKw || 0) * 10) / 10
  monthlyPeakTs = state.peakTs || null
}

if (!Number.isFinite(fixedDemandKw)) fixedDemandKw = 0
if (!Number.isFinite(instantKw)) instantKw = 0
if (!Number.isFinite(monthlyPeakKw)) monthlyPeakKw = Math.round((state.peakKw || 0) * 10) / 10
if (monthlyPeakTs === undefined) monthlyPeakTs = state.peakTs || null
if (!tsIso) tsIso = new Date().toISOString()
if (!Number.isFinite(samplesInWindow)) samplesInWindow = buf.length

const threshold = state.thresholdKw || 0
if (!hasMeta || !Number.isFinite(pctOfThreshold)) {
  pctOfThreshold = threshold > 0 ? Math.round((currentDemandKw / threshold) * 1000) / 10 : 0
}

const minutesParam = msg.req?.query?.minutes
const allHistory = !minutesParam || minutesParam === 'all' || minutesParam === ''
let minutes = allHistory ? 60 * 24 * 366 * 5 : Math.max(15, Math.min(60 * 24 * 800, Number(minutesParam)))
const sinceEpoch = allHistory ? 0 : Math.floor(Date.now() / 1000) - Math.floor(minutes * 60)

let bucketSec = 60
if (minutes > 60 * 24 * 90) bucketSec = 3600
else if (minutes > 60 * 24 * 30) bucketSec = 900
else if (minutes > 60 * 24 * 7) bucketSec = 300

msg._demandMeta = {
  ts: tsIso,
  month: state.month || new Date().toISOString().slice(0, 7),
  instantKw,
  currentDemandKw,
  fixedDemandKw: Math.round(fixedDemandKw * 10) / 10,
  monthlyPeakKw: Math.round((monthlyPeakKw || 0) * 10) / 10,
  monthlyPeakTs,
  thresholdKw: threshold,
  pctOfThreshold,
  windowSeconds: 900,
  samplesInWindow,
  allHistory,
  pctBasis: 'rolling',
}

msg.topic = `WITH b AS (
  SELECT
    (ts_epoch / ${bucketSec}) * ${bucketSec} AS bucket_epoch,
    MAX(ts_epoch) AS last_epoch,
    AVG(current_demand_kw) AS kw
  FROM demand_samples
  WHERE ts_epoch >= ${sinceEpoch}
  GROUP BY bucket_epoch
)
SELECT
  strftime('%Y-%m-%dT%H:%M:%SZ', datetime(last_epoch, 'unixepoch')) AS ts,
  COALESCE(kw, 0) AS current_demand_kw
FROM b
ORDER BY last_epoch ASC
LIMIT 200000;`

delete msg.payload
return msg

const state = global.get('demandState') || {}
const buf = global.get('demandBuf') || []
const WINDOW_MS = 15 * 60 * 1000
const WINDOW_SEC = WINDOW_MS / 1000

const setTh = Number(msg.req?.query?.setThreshold)
if (Number.isFinite(setTh) && setTh > 0) {
  state.thresholdKw = setTh
  global.set('demandState', state)
}

function timeWeightedKw(samples, tNow, winMs) {
  const T0 = tNow - winMs
  if (!samples || samples.length === 0) return 0
  if (!Number.isFinite(T0) || !Number.isFinite(tNow) || WINDOW_SEC <= 0) return 0

  const sorted = samples.slice().sort((a, b) => a.t - b.t)
  if (sorted.length === 0) return 0

  // integrate kW over [T0, tNow] with piecewise-constant intervals
  let integral = 0
  let idx = 0
  while (idx < sorted.length && sorted[idx].t <= T0) idx++
  let kwPrev = idx > 0 ? sorted[idx - 1].kw : sorted[0].kw
  let tCursor = T0

  while (idx < sorted.length) {
    const tNext = sorted[idx].t
    if (tNext >= tNow) break
    const dtSec = (tNext - tCursor) / 1000
    if (dtSec > 0) integral += kwPrev * dtSec
    tCursor = tNext
    kwPrev = sorted[idx].kw
    idx++
  }

  const dtLastSec = (tNow - tCursor) / 1000
  if (dtLastSec > 0) integral += kwPrev * dtLastSec

  return integral / WINDOW_SEC
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
let fixedBlockStartTs = meta0.fixedBlockStartTs
let fixedBlockSecondsElapsed = meta0.fixedBlockSecondsElapsed
let fixedBlockIsPartial = meta0.fixedBlockIsPartial
let fixedBlockEnergyKwh = meta0.fixedBlockEnergyKwh

if (!hasMeta) {
  const tw = timeWeightedKw(buf, now, WINDOW_MS)
  currentDemandKw = Math.round(tw * 10) / 10
  instantKw = buf.length > 0 ? Math.round(buf[buf.length - 1].kw * 10) / 10 : 0
  fixedDemandKw = 0
  fixedBlockStartTs = null
  fixedBlockSecondsElapsed = 0
  fixedBlockIsPartial = true
  fixedBlockEnergyKwh = 0
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
if (fixedBlockStartTs === undefined) fixedBlockStartTs = null
if (!Number.isFinite(fixedBlockSecondsElapsed)) fixedBlockSecondsElapsed = 0
if (fixedBlockIsPartial === undefined) fixedBlockIsPartial = true
if (!Number.isFinite(fixedBlockEnergyKwh)) fixedBlockEnergyKwh = 0

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
  fixedBlockStartTs,
  fixedBlockSecondsElapsed,
  fixedBlockIsPartial,
  fixedBlockEnergyKwh,
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

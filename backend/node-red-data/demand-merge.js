const meta = msg._demandMeta || {}
const rows = Array.isArray(msg.payload) ? msg.payload : []

let trend = rows.map((r) => ({
  ts: r.ts,
  kw: Number(r.current_demand_kw) || 0,
}))

const nowIso = meta.ts
const curKw = meta.currentDemandKw
const lastTs = trend.length > 0 ? Date.parse(trend[trend.length - 1].ts) : NaN
if (trend.length === 0 || !Number.isFinite(lastTs) || Date.parse(nowIso) > lastTs + 25000) {
  trend = trend.concat([{ ts: nowIso, kw: curKw }])
}

const trendStartTs = trend.length > 0 ? trend[0].ts : null

const th = meta.thresholdKw || 0
const roll = meta.currentDemandKw || 0
const exceedsThreshold = th > 0 && roll > th

msg.payload = {
  ts: meta.ts,
  month: meta.month,
  instantKw: meta.instantKw,
  currentDemandKw: meta.currentDemandKw,
  fixedDemandKw: meta.fixedDemandKw ?? 0,
  fixedBlockStartTs: meta.fixedBlockStartTs ?? null,
  fixedBlockSecondsElapsed: meta.fixedBlockSecondsElapsed ?? 0,
  fixedBlockIsPartial: meta.fixedBlockIsPartial ?? true,
  fixedBlockEnergyKwh: meta.fixedBlockEnergyKwh ?? 0,
  monthlyPeakKw: meta.monthlyPeakKw,
  monthlyPeakTs: meta.monthlyPeakTs,
  thresholdKw: meta.thresholdKw,
  pctOfThreshold: meta.pctOfThreshold,
  pctBasis: meta.pctBasis || 'rolling',
  windowSeconds: meta.windowSeconds ?? 900,
  samplesInWindow: meta.samplesInWindow,
  trend,
  trendStartTs,
  exceedsThreshold,
}

msg.headers = { 'Content-Type': 'application/json; charset=utf-8' }
delete msg._demandMeta
return msg

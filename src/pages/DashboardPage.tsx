import { Fragment, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlcFullSnapshot, useNodeRedHealth, useEnhancedAlerts, useEnergyIntervals, usePowerTrend } from '../hooks/queries'
import { findPlcMeter, PLC_METERS } from '../constants/plcMeters'
import { PLC_PRODUCTION_METERS } from '../constants/plcProductionMeters'
import { Badge, type BadgeColor } from '../components/ui/Badge'
import { MiniKpiCard } from '../components/ui/MiniKpiCard'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { DemandTracker } from '../components/ui/DemandTracker'
import type { PlcMeterData } from '../types'
import MultiAxisTrendChart from '../components/charts/MultiAxisTrendChart'
import { Activity, Bolt, Gauge, Power, Zap } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  Line,
  LineChart,
  ReferenceDot,
  XAxis,
  YAxis,
} from 'recharts'

function fmt(n: number, decimals = 1): string {
  if (!Number.isFinite(n) || n === 0) return '\u2014'
  return n.toFixed(decimals)
}

type FluctuationSeverity = 'warning' | 'critical'
type FluctuationMetric = 'kw' | 'voltage' | 'current'

type FluctuationAlert = {
  id: string
  ts: string
  metric: FluctuationMetric
  severity: FluctuationSeverity
  message: string
  value: number
  prevValue: number
  delta: number
  deltaPct: number | null
}

function severityColor(sev: string): BadgeColor {
  if (sev === 'critical') return 'red'
  if (sev === 'warning') return 'yellow'
  return 'slate'
}

function meterHasData(data: PlcMeterData | undefined): boolean {
  if (!data) return false
  return data.Real_power !== 0 || data.Voltage_Lave !== 0 || data.Current_Ave !== 0
}

function median(nums: number[]): number {
  const a = nums.filter((n) => Number.isFinite(n)).slice().sort((x, y) => x - y)
  if (a.length === 0) return NaN
  const mid = Math.floor(a.length / 2)
  return a.length % 2 === 1 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

function movingAvg(values: number[], window = 5): number[] {
  const w = Math.max(1, Math.floor(window))
  const out: number[] = []
  for (let i = 0; i < values.length; i++) {
    let sum = 0
    let cnt = 0
    for (let j = Math.max(0, i - w + 1); j <= i; j++) {
      const v = values[j]
      if (Number.isFinite(v)) {
        sum += v
        cnt++
      }
    }
    out.push(cnt > 0 ? sum / cnt : values[i])
  }
  return out
}

export function DashboardPage() {
  const snapQ = usePlcFullSnapshot()
  const healthQ = useNodeRedHealth()
  const alertsQ = useEnhancedAlerts()
  const [energyView, setEnergyView] = useState<'hourly' | 'daily' | 'monthly'>('daily')
  const [showLoadProfile, setShowLoadProfile] = useState(true)
  const [trendView, setTrendView] = useState<'raw' | 'smooth'>('raw')
  const [trendWindow, setTrendWindow] = useState<'1h' | '6h' | '12h' | '24h' | '7d' | '30d' | '1y'>('30d')
  const [expandedLine, setExpandedLine] = useState<string | null>(null)
  const loadProfileGradId = useId().replace(/:/g, '')
  const trendMinutes =
    trendWindow === '1h'
      ? 60
      : trendWindow === '6h'
        ? 6 * 60
        : trendWindow === '12h'
          ? 12 * 60
          : trendWindow === '24h'
            ? 24 * 60
            : trendWindow === '7d'
              ? 7 * 24 * 60
              : trendWindow === '30d'
                ? 30 * 24 * 60
                : 365 * 24 * 60
  const powerTrendQ = usePowerTrend(trendMinutes)
  const energy24hQ = useEnergyIntervals(24)
  const energy30dQ = useEnergyIntervals(24 * 30)

  const snap = snapQ.data
  const nodeRedUp = healthQ.data?.ok === true
  // Important: snapshot values can remain cached even when PLC is disconnected.
  // Use the health heartbeat (last communication age) as the source of truth.
  const plcUp = healthQ.data?.plcLink?.up === true

  const activeAlerts = useMemo(
    () => (alertsQ.data ?? []).filter((a) => a.status === 'active'),
    [alertsQ.data],
  )

  const plantStats = useMemo(() => {
    if (!snap?.meters) return { totalPower: 0, totalEnergy: 0, metersOnline: 0, avgPf: NaN, avgFreq: NaN }
    const entries = Object.values(snap.meters)
    const online = entries.filter((d) => meterHasData(d))
    const totalPower = entries.reduce((s, d) => s + d.Real_power, 0)
    const totalEnergy = entries.reduce((s, d) => s + d.Real_energy, 0)
    const pfValues = online.map((d) => d.Power_factor).filter((v) => v > 0)
    const avgPf = pfValues.length > 0 ? pfValues.reduce((s, v) => s + v, 0) / pfValues.length : NaN
    const freqValues = online.map((d) => d.Frequency).filter((v) => v > 0)
    const avgFreq = freqValues.length > 0 ? freqValues.reduce((s, v) => s + v, 0) / freqValues.length : NaN
    return { totalPower, totalEnergy, metersOnline: online.length, avgPf, avgFreq }
  }, [snap])

  const totalEnergyLines = useMemo(() => {
    if (!snap?.totalEnergy) return []
    return Object.entries(snap.totalEnergy)
      .filter(([, kwh]) => kwh > 0)
      .sort((a, b) => b[1] - a[1])
  }, [snap])

  const powerTrendData = useMemo(() => {
    const pts = powerTrendQ.data ?? []
    return pts.map((p) => ({
      ts: p.ts,
      kw: p.kw,
      voltageV: (p as unknown as { voltageV?: number }).voltageV ?? 0,
      currentA: (p as unknown as { currentA?: number }).currentA ?? 0,
      pf: p.pf,
      kvar: p.kvar,
    }))
  }, [powerTrendQ.data])

  const fluctuation = useMemo(() => {
    const pts = powerTrendData
    if (pts.length < 2) {
      return {
        points: pts.map((p) => ({
          ...p,
          kwSmooth: p.kw,
          voltageSmooth: p.voltageV,
          currentSmooth: p.currentA,
          kwDelta: 0,
          kwDeltaPct: null as number | null,
          voltageDelta: 0,
          voltageDeltaPct: null as number | null,
          currentDelta: 0,
          currentDeltaPct: null as number | null,
          flagKw: null as FluctuationSeverity | null,
          flagVoltage: null as FluctuationSeverity | null,
          flagCurrent: null as FluctuationSeverity | null,
        })),
        alerts: [] as FluctuationAlert[],
        nominalVoltage: NaN,
      }
    }

    const kwArr = pts.map((p) => p.kw)
    const vArr = pts.map((p) => p.voltageV)
    const iArr = pts.map((p) => p.currentA)
    const kwSmooth = movingAvg(kwArr, 5)
    const vSmooth = movingAvg(vArr, 5)
    const iSmooth = movingAvg(iArr, 5)

    const nominalVoltage = median(vArr.slice(Math.max(0, vArr.length - 30)))
    const safeNomV = Number.isFinite(nominalVoltage) && nominalVoltage > 0 ? nominalVoltage : NaN

    const alerts: FluctuationAlert[] = []
    const points = pts.map((p, idx) => {
      const prev = idx > 0 ? pts[idx - 1] : null
      const prevKw = prev?.kw ?? p.kw
      const prevV = prev?.voltageV ?? p.voltageV
      const prevI = prev?.currentA ?? p.currentA

      const kwDelta = p.kw - prevKw
      const kwDeltaPct = prevKw !== 0 ? kwDelta / Math.abs(prevKw) : null
      const vDelta = p.voltageV - prevV
      const vDeltaPct = prevV !== 0 ? vDelta / Math.abs(prevV) : null
      const iDelta = p.currentA - prevI
      const iDeltaPct = prevI !== 0 ? iDelta / Math.abs(prevI) : null

      const absKwPct = kwDeltaPct !== null ? Math.abs(kwDeltaPct) : 0
      const absIPct = iDeltaPct !== null ? Math.abs(iDeltaPct) : 0
      const vOffPct = Number.isFinite(safeNomV) ? Math.abs((p.voltageV - safeNomV) / safeNomV) : 0

      const flagKw: FluctuationSeverity | null = absKwPct > 0.4 ? 'critical' : absKwPct > 0.25 ? 'warning' : null
      const flagVoltage: FluctuationSeverity | null = vOffPct > 0.1 ? 'critical' : vOffPct > 0.05 ? 'warning' : null
      const flagCurrent: FluctuationSeverity | null = absIPct > 0.4 ? 'critical' : absIPct > 0.25 ? 'warning' : null

      if (idx > 0 && flagKw) {
        alerts.push({
          id: `kw:${p.ts}`,
          ts: p.ts,
          metric: 'kw',
          severity: flagKw,
          message: `kW spike ${Math.round(absKwPct * 100)}% within short interval`,
          value: p.kw,
          prevValue: prevKw,
          delta: kwDelta,
          deltaPct: kwDeltaPct,
        })
      }

      if (Number.isFinite(safeNomV) && flagVoltage) {
        alerts.push({
          id: `v:${p.ts}`,
          ts: p.ts,
          metric: 'voltage',
          severity: flagVoltage,
          message: `Voltage out of band (${Math.round(vOffPct * 100)}% vs nominal)`,
          value: p.voltageV,
          prevValue: prevV,
          delta: vDelta,
          deltaPct: vDeltaPct,
        })
      }

      if (idx > 0 && flagCurrent) {
        alerts.push({
          id: `i:${p.ts}`,
          ts: p.ts,
          metric: 'current',
          severity: flagCurrent,
          message: `Current surge ${Math.round(absIPct * 100)}% within short interval`,
          value: p.currentA,
          prevValue: prevI,
          delta: iDelta,
          deltaPct: iDeltaPct,
        })
      }

      return {
        ...p,
        kwSmooth: kwSmooth[idx],
        voltageSmooth: vSmooth[idx],
        currentSmooth: iSmooth[idx],
        kwDelta,
        kwDeltaPct,
        voltageDelta: vDelta,
        voltageDeltaPct: vDeltaPct,
        currentDelta: iDelta,
        currentDeltaPct: iDeltaPct,
        flagKw,
        flagVoltage,
        flagCurrent,
      }
    })

    const sorted = alerts
      .slice()
      .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
      .slice(0, 25)

    return { points, alerts: sorted, nominalVoltage: safeNomV }
  }, [powerTrendData])

  const totalDemandSeries24h = useMemo(() => {
    const ivs = energy24hQ.data ?? []
    const map = new Map<string, { ts: string; demandKw: number }>()
    for (const iv of ivs) {
      const prev = map.get(iv.ts)
      if (!prev) map.set(iv.ts, { ts: iv.ts, demandKw: iv.demandKw })
      else prev.demandKw += iv.demandKw
    }
    return Array.from(map.values()).sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
  }, [energy24hQ.data])

  const loadProfile24h = useMemo(() => {
    // 96 points (15-min), x-axis by time-of-day
    const buckets = new Map<string, { tod: string; demandKw: number }>()
    for (const r of totalDemandSeries24h) {
      const d = new Date(r.ts)
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      const tod = `${hh}:${mm}`
      buckets.set(tod, { tod, demandKw: r.demandKw })
    }
    return Array.from(buckets.values()).sort((a, b) => a.tod.localeCompare(b.tod))
  }, [totalDemandSeries24h])

  const peakDemandByDay30d = useMemo(() => {
    const ivs = energy30dQ.data ?? []
    const byTs = new Map<string, number>()
    for (const iv of ivs) byTs.set(iv.ts, (byTs.get(iv.ts) ?? 0) + iv.demandKw)
    const byDay = new Map<string, number>()
    for (const [ts, demand] of byTs.entries()) {
      const d = new Date(ts)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      byDay.set(key, Math.max(byDay.get(key) ?? 0, demand))
    }
    return Array.from(byDay.entries())
      .map(([day, peakKw]) => ({ day, peakKw }))
      .sort((a, b) => a.day.localeCompare(b.day))
  }, [energy30dQ.data])

  const peakDemand30d = useMemo(() => {
    const vals = peakDemandByDay30d.map((r) => r.peakKw).filter((n) => Number.isFinite(n))
    return vals.length > 0 ? Math.max(...vals) : 0
  }, [peakDemandByDay30d])

  const energyByPeriod = useMemo(() => {
    // Build total kWh by hour/day/month from 30d intervals.
    const ivs = energy30dQ.data ?? []
    const byTs = new Map<string, number>()
    for (const iv of ivs) byTs.set(iv.ts, (byTs.get(iv.ts) ?? 0) + iv.energyKwh)

    const buckets = new Map<string, { label: string; sortKey: string; kwh: number }>()
    for (const [ts, kwh] of byTs.entries()) {
      const d = new Date(ts)
      let sortKey = ''
      let label = ''
      if (energyView === 'hourly') {
        d.setMinutes(0, 0, 0)
        sortKey = d.toISOString()
        label = d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' })
      } else if (energyView === 'daily') {
        d.setHours(0, 0, 0, 0)
        sortKey = d.toISOString()
        label = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
      } else {
        d.setDate(1)
        d.setHours(0, 0, 0, 0)
        sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        label = d.toLocaleString([], { month: 'short', year: '2-digit' })
      }
      const cur = buckets.get(sortKey) ?? { label, sortKey, kwh: 0 }
      cur.kwh += kwh
      buckets.set(sortKey, cur)
    }
    return Array.from(buckets.values())
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((b) => ({ name: b.label, kwh: Math.round(b.kwh * 1000) / 1000 }))
  }, [energy30dQ.data, energyView])

  return (
    <div className="space-y-6">
      {/* Connection status */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">Node-RED</span>
          <Badge color={nodeRedUp ? 'green' : 'red'}>{nodeRedUp ? 'UP' : 'DOWN'}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">PLC Link</span>
          <Badge color={plcUp ? 'green' : 'red'}>{plcUp ? 'UP' : 'DOWN'}</Badge>
        </div>
        {snap?.ts && (
          <span className="text-xs text-[var(--muted)]">
            Last update: {new Date(snap.ts).toLocaleTimeString()}
          </span>
        )}
        {snap?.warning && (
          <span className="text-xs text-[var(--accent-red)]">{snap.warning}</span>
        )}
        {activeAlerts.length > 0 && (
          <Link to="/alerts" className="ml-auto">
            <Badge color="red">{activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''}</Badge>
          </Link>
        )}
      </div>

      {/* Plant summary stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniKpiCard
          title="Total Real Power"
          value={
            <>
              {fmt(plantStats.totalPower, 1)} <span className="text-sm font-normal text-[var(--muted)]">kW</span>
            </>
          }
          subtitle="Live total (all meters)"
          icon={<Bolt size={18} />}
          tone={plantStats.totalPower > 0 ? 'neutral' : 'warning'}
        />
        <MiniKpiCard
          title="Total Energy"
          value={
            <>
              {fmt(plantStats.totalEnergy, 1)} <span className="text-sm font-normal text-[var(--muted)]">kWh</span>
            </>
          }
          subtitle="Cumulative (all meters)"
          icon={<Zap size={18} />}
        />
        <MiniKpiCard
          title="Peak Demand (30d)"
          value={
            <>
              {fmt(peakDemand30d, 1)} <span className="text-sm font-normal text-[var(--muted)]">kW</span>
            </>
          }
          subtitle="Max daily demand"
          icon={<Gauge size={18} />}
          tone={peakDemand30d > 0 ? 'neutral' : 'warning'}
        />
        <MiniKpiCard
          title="Meters Online"
          value={
            <>
              {plantStats.metersOnline} <span className="text-sm font-normal text-[var(--muted)]">/ {PLC_METERS.length}</span>
            </>
          }
          subtitle={
            <>
              PF {fmt(plantStats.avgPf, 3)} • {fmt(plantStats.avgFreq, 2)} Hz
            </>
          }
          icon={<Activity size={18} />}
          tone={plantStats.metersOnline > 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Fluctuation detection */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card card-hover p-5 lg:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text)]">Power / Voltage / Current</div>
              <div className="text-xs text-[var(--muted)]">Cumulative view — last {trendWindow}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                value={trendWindow}
                onChange={setTrendWindow}
                options={[
                  { id: '1h', label: '1h' },
                  { id: '6h', label: '6h' },
                  { id: '12h', label: '12h' },
                  { id: '24h', label: '24h' },
                  { id: '7d', label: '7d' },
                  { id: '30d', label: '30d' },
                  { id: '1y', label: '1y' },
                ]}
              />
              <SegmentedControl
                value={trendView}
                onChange={setTrendView}
                options={[
                  { id: 'raw', label: 'Raw' },
                  { id: 'smooth', label: 'Smooth' },
                ]}
              />
            </div>
          </div>

          <div className="h-[480px] min-h-[320px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fluctuation.points} margin={{ left: 6, right: 10, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis
                  dataKey="ts"
                  tick={{ fontSize: 10 }}
                  minTickGap={22}
                  tickFormatter={(v) =>
                    new Date(String(v)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={60} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={60} />
                <Tooltip
                  formatter={(value, name, item) => {
                    const p = item?.payload as
                      | (Record<string, unknown> & {
                          kwDelta?: number
                          kwDeltaPct?: number | null
                          voltageDelta?: number
                          voltageDeltaPct?: number | null
                          currentDelta?: number
                          currentDeltaPct?: number | null
                        })
                      | undefined
                    const key = String(name)
                    if (!p) return [value as unknown as string, key]
                    const fmtPct = (x: number | null | undefined) =>
                      x === null || x === undefined ? '' : ` (${(x * 100).toFixed(1)}%)`
                    if (key === 'kW') return [`${fmt(Number(value), 1)}  Δ${fmt(Number(p.kwDelta ?? 0), 1)}${fmtPct(p.kwDeltaPct)}`, 'kW']
                    if (key === 'Voltage (V)')
                      return [`${fmt(Number(value), 1)}  Δ${fmt(Number(p.voltageDelta ?? 0), 1)}${fmtPct(p.voltageDeltaPct)}`, 'V']
                    if (key === 'Current (A)')
                      return [`${fmt(Number(value), 2)}  Δ${fmt(Number(p.currentDelta ?? 0), 2)}${fmtPct(p.currentDeltaPct)}`, 'A']
                    return [value as unknown as string, key]
                  }}
                />
                <Legend />

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey={trendView === 'raw' ? 'kw' : 'kwSmooth'}
                  name="kW"
                  stroke="var(--chart-1)"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={trendView === 'raw' ? 'voltageV' : 'voltageSmooth'}
                  name="Voltage (V)"
                  stroke="var(--chart-2)"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={trendView === 'raw' ? 'currentA' : 'currentSmooth'}
                  name="Current (A)"
                  stroke="var(--chart-3)"
                  dot={false}
                  isAnimationActive={false}
                />

                {fluctuation.points
                  .filter((p) => (p.flagKw ?? null) !== null)
                  .map((p) => (
                    <ReferenceDot
                      key={`kw-${p.ts}`}
                      x={p.ts}
                      y={trendView === 'raw' ? p.kw : p.kwSmooth}
                      yAxisId="left"
                      r={4}
                      fill="var(--primary)"
                      stroke="none"
                    />
                  ))}
                {fluctuation.points
                  .filter((p) => (p.flagVoltage ?? null) !== null)
                  .map((p) => (
                    <ReferenceDot
                      key={`v-${p.ts}`}
                      x={p.ts}
                      y={trendView === 'raw' ? p.voltageV : p.voltageSmooth}
                      yAxisId="right"
                      r={4}
                      fill="var(--primary)"
                      stroke="none"
                    />
                  ))}
                {fluctuation.points
                  .filter((p) => (p.flagCurrent ?? null) !== null)
                  .map((p) => (
                    <ReferenceDot
                      key={`i-${p.ts}`}
                      x={p.ts}
                      y={trendView === 'raw' ? p.currentA : p.currentSmooth}
                      yAxisId="right"
                      r={4}
                      fill="var(--primary)"
                      stroke="none"
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 text-xs text-[var(--muted)]">
            Fluctuation rules: <span className="font-medium">kW</span> spike &gt; 25%, <span className="font-medium">Voltage</span>{' '}
            outside ±5% (nominal={Number.isFinite(fluctuation.nominalVoltage) ? fmt(fluctuation.nominalVoltage, 0) : '—'}V),{' '}
            <span className="font-medium">Current</span> surge &gt; 25%. Red markers indicate detected events.
          </div>
        </div>

        <div className="card card-hover p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-[var(--text)]">Fluctuation Alerts</div>
            <div className="text-xs text-[var(--muted)]">{fluctuation.alerts.length} recent</div>
          </div>
          <div className="max-h-[22rem] overflow-auto">
            {fluctuation.alerts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No fluctuations detected in the selected window.
              </div>
            ) : (
              <div className="space-y-2">
                {fluctuation.alerts.map((a) => (
                  <div key={a.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-[var(--muted)]">{new Date(a.ts).toLocaleString()}</div>
                      <Badge color={severityColor(a.severity)}>{a.severity}</Badge>
                    </div>
                    <div className="mt-1 text-sm font-medium text-[var(--text)]">{a.message}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {a.metric.toUpperCase()} = <span className="font-mono">{fmt(a.value, a.metric === 'current' ? 2 : 1)}</span> (prev{' '}
                      <span className="font-mono">{fmt(a.prevValue, a.metric === 'current' ? 2 : 1)}</span>) Δ{' '}
                      <span className="font-mono">{fmt(a.delta, a.metric === 'current' ? 2 : 1)}</span>
                      {a.deltaPct !== null ? ` (${(a.deltaPct * 100).toFixed(1)}%)` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trends */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card card-hover p-5">
          <div className="mb-2 text-sm font-semibold text-[var(--text)]">kW (Active Power) vs Time</div>
          <MultiAxisTrendChart
            data={powerTrendData}
            height={260}
            series={[
              { key: 'kw', label: 'kW', color: 'var(--chart-1)', yAxisId: 'left' },
              { key: 'pf', label: 'PF', color: 'var(--chart-4)', yAxisId: 'right' },
              { key: 'kvar', label: 'kVAR', color: 'var(--chart-3)', yAxisId: 'right' },
            ]}
          />
        </div>

        <div className="card card-hover p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-[var(--text)]">kWh (Energy Consumption)</div>
            <SegmentedControl
              value={energyView}
              onChange={setEnergyView}
              options={[
                { id: 'hourly', label: 'Hourly' },
                { id: 'daily', label: 'Daily' },
                { id: 'monthly', label: 'Monthly' },
              ]}
            />
          </div>
          <div className="h-72 min-h-[220px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={energyByPeriod} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={65} />
                <YAxis tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} kWh`, 'Energy']} />
                <Legend />
                <Bar dataKey="kwh" name="kWh" fill="var(--chart-1)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card card-hover p-5 lg:col-span-2">
          <div className="mb-4">
            <div className="text-sm font-semibold text-[var(--text)]">Load profile & demand</div>
            <div className="mt-0.5 text-[11px] text-[var(--muted)]">
              Rolling 15-min demand (Node-RED log) and a typical 24-hour curve from recent energy intervals.
            </div>
          </div>

          <DemandTracker variant="embedded" />

          <div className="my-5 border-t border-[var(--border)]" />

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">24-hour load profile</div>
              <div className="text-[11px] text-[var(--muted)]">Demand by time-of-day (last ~24h of intervals)</div>
            </div>
            <button
              type="button"
              onClick={() => setShowLoadProfile((s) => !s)}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] shadow-sm transition hover:text-[var(--text)]"
            >
              {showLoadProfile ? 'Hide curve' : 'Show curve'}
            </button>
          </div>
          {showLoadProfile ? (
            <div className="h-72 min-h-[220px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={loadProfile24h} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`loadProfileShade-${loadProfileGradId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="tod"
                    tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
                    stroke="var(--chart-axis)"
                    interval={7}
                  />
                  <YAxis
                    tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                    stroke="var(--chart-axis)"
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--chart-tooltip-bg)',
                      border: '1px solid var(--chart-tooltip-border)',
                      borderRadius: 8,
                      color: 'var(--chart-tooltip-text)',
                    }}
                    formatter={(v) => [`${fmt(Number(v), 1)} kW`, 'Demand']}
                  />
                  <Area
                    type="monotone"
                    dataKey="demandKw"
                    name="kW"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    fill={`url(#loadProfileShade-${loadProfileGradId})`}
                    isAnimationActive={false}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
              24-hour curve hidden.
            </div>
          )}
        </div>

        <div className="card card-hover p-5 lg:col-span-2">
          <div className="mb-2 text-sm font-semibold text-[var(--text)]">Peak Demand Tracking (daily max)</div>
          <div className="h-72 min-h-[220px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakDemandByDay30d} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={3} />
                <YAxis tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v) => [`${fmt(Number(v), 1)} kW`, 'Peak']} />
                <Bar dataKey="peakKw" name="Peak kW" fill="var(--chart-1)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Per-meter table */}
      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="text-sm font-semibold text-[var(--text)]">All Power Meters ({PLC_METERS.length})</div>
          <div className="text-xs text-[var(--muted)]">Live readings from DB16 — click a row for full detail</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[11px] font-medium text-[var(--muted)]">
                <th className="px-4 py-2">Meter</th>
                <th className="px-4 py-2">Model</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-3 py-2 text-right">P (kW)</th>
                <th className="px-3 py-2 text-right">Q (kVAR)</th>
                <th className="px-3 py-2 text-right">S (kVA)</th>
                <th className="px-3 py-2 text-right">V<sub>LL</sub> (V)</th>
                <th className="px-3 py-2 text-right">I<sub>avg</sub> (A)</th>
                <th className="px-3 py-2 text-right">PF</th>
                <th className="px-3 py-2 text-right">Hz</th>
                <th className="px-3 py-2 text-right">E (kWh)</th>
              </tr>
            </thead>
            <tbody>
              {PLC_METERS.map((meter) => {
                const data = snap?.meters[meter.id]
                const online = meterHasData(data)
                return (
                  <tr
                    key={meter.id}
                    className="border-b border-[var(--border)] last:border-0 transition hover:bg-[var(--card)]"
                  >
                    <td className="px-4 py-2">
                      <Link
                        to={`/meters/${meter.id}`}
                        className="font-medium text-[var(--text)] hover:text-[var(--accent-green)]"
                      >
                        {meter.name}
                      </Link>
                      <div className="text-[11px] text-[var(--muted)]">{meter.location}</div>
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--muted)]">{meter.model}</td>
                    <td className="px-4 py-2">
                      <Badge color={online ? 'green' : 'red'}>{online ? 'ON' : 'OFF'}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--text)]">
                      {fmt(data?.Real_power ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--text)]">
                      {fmt(data?.Reactive_power ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--text)]">
                      {fmt(data?.Apparent_power ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--text)]">
                      {fmt(data?.Voltage_Lave ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--text)]">
                      {fmt(data?.Current_Ave ?? 0, 2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--text)]">
                      {fmt(data?.Power_factor ?? 0, 3)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--text)]">
                      {fmt(data?.Frequency ?? 0, 2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--text)]">
                      {fmt(data?.Real_energy ?? 0, 1)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production line total energy */}
      {totalEnergyLines.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <div className="text-sm font-semibold text-[var(--text)]">Production Line Energy Totals</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-medium text-[var(--muted)]">
                  <th className="px-4 py-2">Production Line</th>
                  <th className="px-4 py-2 text-right">Total Energy (kWh)</th>
                </tr>
              </thead>
              <tbody>
                {totalEnergyLines.map(([name, kwh]) => {
                  const def = PLC_PRODUCTION_METERS.find((x) => x.name === name)
                  const ids = def?.meterIds ?? []
                  const isExpandable = ids.length > 0
                  const isOpen = expandedLine === name
                  return (
                    <Fragment key={name}>
                      <tr
                        className={[
                          'border-b border-[var(--border)] last:border-0',
                          isExpandable ? 'cursor-pointer hover:bg-[color-mix(in_srgb,var(--text)_3%,transparent)]' : '',
                        ].join(' ')}
                        onClick={() => {
                          if (!isExpandable) return
                          setExpandedLine((cur) => (cur === name ? null : name))
                        }}
                      >
                        <td className="px-4 py-2 text-[var(--text)]">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{name}</span>
                            {isExpandable ? (
                              <span className="text-[11px] text-[var(--muted)]">
                                {isOpen ? 'Hide meters' : 'Show meters'}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-[var(--text)]">
                          {kwh.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="border-b border-[var(--border)]">
                          <td colSpan={2} className="px-4 py-3">
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span>Powermeters under {name}</span>
                                  {def ? (
                                    <Link
                                      to={`/lines/${def.id}`}
                                      className="text-[11px] font-medium text-[var(--primary)] hover:underline"
                                    >
                                      Open line dashboard
                                    </Link>
                                  ) : null}
                                </div>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {ids.map((meterId) => {
                                  const meter = findPlcMeter(meterId)
                                  const d = snap?.meters[meterId]
                                  return (
                                    <div
                                      key={meterId}
                                      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <Link
                                            to={`/meters/${meterId}`}
                                            className="truncate text-sm font-semibold text-[var(--text)] hover:text-[var(--primary)]"
                                          >
                                            {meter?.name ?? meterId}
                                          </Link>
                                          <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                                            {meter?.model ?? '—'}
                                          </div>
                                        </div>
                                        <Badge color={meterHasData(d) ? 'green' : 'red'}>
                                          {meterHasData(d) ? 'ON' : 'OFF'}
                                        </Badge>
                                      </div>
                                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                                        <div>
                                          <div className="text-[11px] text-[var(--muted)]">kW</div>
                                          <div className="font-mono text-[var(--text)]">{fmt(d?.Real_power ?? 0, 1)}</div>
                                        </div>
                                        <div>
                                          <div className="text-[11px] text-[var(--muted)]">V</div>
                                          <div className="font-mono text-[var(--text)]">{fmt(d?.Voltage_Lave ?? 0, 0)}</div>
                                        </div>
                                        <div>
                                          <div className="text-[11px] text-[var(--muted)]">A</div>
                                          <div className="font-mono text-[var(--text)]">{fmt(d?.Current_Ave ?? 0, 1)}</div>
                                        </div>
                                        <div>
                                          <div className="text-[11px] text-[var(--muted)]">E (kWh)</div>
                                          <div className="font-mono text-[var(--text)]">{fmt(d?.Real_energy ?? 0, 1)}</div>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent alerts */}
      {activeAlerts.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="text-sm font-semibold text-[var(--text)]">Active Alerts</div>
            <Link to="/alerts" className="text-xs font-medium text-[var(--accent-green)] hover:opacity-90">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-medium text-[var(--muted)]">
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Meter</th>
                  <th className="px-4 py-2">Severity</th>
                  <th className="px-4 py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {activeAlerts.slice(0, 10).map((a) => (
                  <tr key={a.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-[var(--muted)]">
                      {new Date(a.ts).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-[var(--text)]">{a.meterName}</td>
                    <td className="px-4 py-2">
                      <Badge color={severityColor(a.severity)}>{a.severity}</Badge>
                    </td>
                    <td className="max-w-[40rem] truncate px-4 py-2 text-[var(--text)]">{a.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

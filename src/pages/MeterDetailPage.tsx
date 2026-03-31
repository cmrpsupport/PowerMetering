import { Link, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useLatestReading, useMeter, useReadings } from '../hooks/queries'
import { Badge, type BadgeColor } from '../components/ui/Badge'
import { StatCard } from '../components/ui/StatCard'
import MultiAxisTrendChart, { type TrendSeries } from '../components/charts/MultiAxisTrendChart'

/* ── helpers ────────────────────────────────────────────── */

type Tab = 'power' | 'voltage' | 'current' | 'pf' | 'multi'

function statusColor(status: string): BadgeColor {
  if (status === 'online') return 'green'
  if (status === 'warning') return 'yellow'
  return 'red'
}

function fmt(n: number, unit: string, digits = 2) {
  if (!Number.isFinite(n)) return '\u2014'
  return `${n.toFixed(digits)} ${unit}`
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'power', label: 'Power' },
  { key: 'voltage', label: 'Voltage' },
  { key: 'current', label: 'Current' },
  { key: 'pf', label: 'Power Factor' },
  { key: 'multi', label: 'Multi-Overlay' },
]

/* ── Single-parameter chart ─────────────────────────────── */

function ParameterChart({
  data,
  dataKey,
  label,
  unit,
  color,
}: {
  data: Record<string, unknown>[]
  dataKey: string
  label: string
  unit: string
  color: string
}) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
          <XAxis
            dataKey="ts"
            tickFormatter={(v) =>
              new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
            minTickGap={36}
          />
          <YAxis width={50} />
          <Tooltip
            labelFormatter={(v) => new Date(String(v)).toLocaleString()}
            formatter={(value) => [`${Number(value).toFixed(2)} ${unit}`, label]}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── main page ──────────────────────────────────────────── */

export function MeterDetailPage() {
  const { meterId = '' } = useParams()
  const meterQ = useMeter(meterId)
  const latestQ = useLatestReading(meterId)
  const [minutes, setMinutes] = useState(60)
  const [activeTab, setActiveTab] = useState<Tab>('power')
  const readingsQ = useReadings(meterId, minutes)

  const meter = meterQ.data
  const latest = latestQ.data
  const readings = (readingsQ.data ?? []) as Record<string, unknown>[]

  const subtitle = useMemo(() => {
    if (!meter) return null
    return (
      <span className="inline-flex items-center gap-2">
        <Badge color={statusColor(meter.status)}>{meter.status}</Badge>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Last seen: {new Date(meter.lastSeenAt).toLocaleString()}
        </span>
      </span>
    )
  }, [meter])

  const multiSeries = useMemo<TrendSeries[]>(
    () => [
      { key: 'powerKw', label: 'Power (kW)', color: '#4f46e5', yAxisId: 'left' },
      { key: 'voltageV', label: 'Voltage (V)', color: '#f59e0b', yAxisId: 'right' },
      { key: 'currentA', label: 'Current (A)', color: '#10b981', yAxisId: 'left' },
      { key: 'pf', label: 'Power Factor', color: '#ef4444', yAxisId: 'right' },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      {/* Breadcrumb + controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/meters"
              className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50"
            >
              Meters
            </Link>
            <span className="text-sm text-slate-400">/</span>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {meter?.name ?? meterId}
            </div>
          </div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {meter?.site ?? ''}
          </div>
          <div className="mt-2">{subtitle}</div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400">Window</label>
          <select
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value={30}>30m</option>
            <option value={60}>1h</option>
            <option value={120}>2h</option>
            <option value={360}>6h</option>
          </select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Power" value={fmt(latest?.powerKw ?? NaN, 'kW', 1)} subtitle="Live (2s)" />
        <StatCard title="Energy" value={fmt(latest?.energyKwh ?? NaN, 'kWh', 1)} subtitle="Cumulative" />
        <StatCard title="Voltage" value={fmt(latest?.voltageV ?? NaN, 'V', 1)} subtitle="Line-line" />
        <StatCard
          title="Current"
          value={fmt(latest?.currentA ?? NaN, 'A', 1)}
          subtitle={<span>PF {latest ? latest.pf.toFixed(3) : '\u2014'}</span>}
        />
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {TABS.find((t) => t.key === activeTab)?.label ?? ''}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Refresh: 10s
              </div>
            </div>
            {meter?.status === 'offline' ? (
              <Badge color="red">Offline</Badge>
            ) : (
              <Badge color="green">Streaming</Badge>
            )}
          </div>

          {activeTab === 'power' && (
            <ParameterChart
              data={readings}
              dataKey="powerKw"
              label="Power"
              unit="kW"
              color="#4f46e5"
            />
          )}

          {activeTab === 'voltage' && (
            <ParameterChart
              data={readings}
              dataKey="voltageV"
              label="Voltage"
              unit="V"
              color="#f59e0b"
            />
          )}

          {activeTab === 'current' && (
            <ParameterChart
              data={readings}
              dataKey="currentA"
              label="Current"
              unit="A"
              color="#10b981"
            />
          )}

          {activeTab === 'pf' && (
            <ParameterChart
              data={readings}
              dataKey="pf"
              label="Power Factor"
              unit=""
              color="var(--accent-red)"
            />
          )}

          {activeTab === 'multi' && (
            <MultiAxisTrendChart data={readings} series={multiSeries} height={320} />
          )}
        </div>
      </div>
    </div>
  )
}

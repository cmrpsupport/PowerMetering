import { Link, useParams } from 'react-router-dom'
import { usePlcFullSnapshot } from '../hooks/queries'
import { findPlcMeter } from '../constants/plcMeters'
import { Badge } from '../components/ui/Badge'
import type { PlcMeterData } from '../types'

function fmt(n: number, decimals = 2): string {
  if (!Number.isFinite(n) || n === 0) return '\u2014'
  return n.toFixed(decimals)
}

function ParamRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2 last:border-0">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="font-mono text-sm text-[var(--text)]">
        {fmt(value)} <span className="text-[var(--muted)]">{unit}</span>
      </span>
    </div>
  )
}

function ParamSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--card)] px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{title}</span>
      </div>
      {children}
    </div>
  )
}

export function MeterDetailPage() {
  const { meterId = '' } = useParams()
  const snapQ = usePlcFullSnapshot()

  const meter = findPlcMeter(meterId)
  const data: PlcMeterData | undefined = snapQ.data?.meters[meterId]
  const connected = snapQ.data?.connected === true
  const hasData = data && (data.Real_power !== 0 || data.Voltage_Lave !== 0 || data.Current_Ave !== 0)

  if (!meter) {
    return (
      <div className="space-y-4">
        <Link to="/dashboard" className="text-sm text-[var(--accent-green)] hover:opacity-90">
          &larr; Back to Monitoring
        </Link>
        <div className="card p-8 text-center text-[var(--muted)]">
          Meter <span className="font-mono">{meterId}</span> not found.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
              Monitoring
            </Link>
            <span className="text-sm text-[var(--muted)]">/</span>
            <span className="text-sm font-semibold text-[var(--text)]">{meter.name}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
            <span>{meter.model}</span>
            <span>&middot;</span>
            <span>{meter.location}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={hasData ? 'green' : 'red'}>{hasData ? 'ONLINE' : 'OFFLINE'}</Badge>
          {snapQ.data?.ts && (
            <span className="text-xs text-[var(--muted)]">
              {new Date(snapQ.data.ts).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {!connected && (
        <div className="card border-[var(--accent-red)] bg-[color-mix(in_srgb,var(--accent-red)_8%,var(--bg))] p-4 text-sm text-[var(--accent-red)]">
          PLC not connected. {snapQ.data?.warning}
        </div>
      )}

      {/* Key stats - big numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <div className="text-[11px] font-medium text-[var(--muted)]">Real Power</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{fmt(data?.Real_power ?? 0, 1)} <span className="text-sm text-[var(--muted)]">kW</span></div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] font-medium text-[var(--muted)]">Voltage L-L Avg</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{fmt(data?.Voltage_Lave ?? 0, 1)} <span className="text-sm text-[var(--muted)]">V</span></div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] font-medium text-[var(--muted)]">Current Avg</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{fmt(data?.Current_Ave ?? 0, 2)} <span className="text-sm text-[var(--muted)]">A</span></div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] font-medium text-[var(--muted)]">Power Factor</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{fmt(data?.Power_factor ?? 0, 3)}</div>
        </div>
      </div>

      {/* Detailed parameter sections */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ParamSection title="Power">
          <ParamRow label="Real Power (P)" value={data?.Real_power ?? 0} unit="kW" />
          <ParamRow label="Reactive Power (Q)" value={data?.Reactive_power ?? 0} unit="kVAR" />
          <ParamRow label="Apparent Power (S)" value={data?.Apparent_power ?? 0} unit="kVA" />
        </ParamSection>

        <ParamSection title="Energy">
          <ParamRow label="Real Energy" value={data?.Real_energy ?? 0} unit="kWh" />
          <ParamRow label="Reactive Energy" value={data?.Reactive_energy ?? 0} unit="kVARh" />
          <ParamRow label="Apparent Energy" value={data?.Apparent_energy ?? 0} unit="kVAh" />
        </ParamSection>

        <ParamSection title="Voltage (Line-Line)">
          <ParamRow label="V AB" value={data?.Voltage_ab ?? 0} unit="V" />
          <ParamRow label="V BC" value={data?.Voltage_bc ?? 0} unit="V" />
          <ParamRow label="V CA" value={data?.Voltage_ca ?? 0} unit="V" />
          <ParamRow label="V L-L Average" value={data?.Voltage_Lave ?? 0} unit="V" />
        </ParamSection>

        <ParamSection title="Voltage (Line-Neutral)">
          <ParamRow label="V AN" value={data?.Voltage_an ?? 0} unit="V" />
          <ParamRow label="V BN" value={data?.Voltage_bn ?? 0} unit="V" />
          <ParamRow label="V CN" value={data?.Voltage_cn ?? 0} unit="V" />
          <ParamRow label="V L-N Average" value={data?.Voltage_Nave ?? 0} unit="V" />
        </ParamSection>

        <ParamSection title="Current">
          <ParamRow label="Phase A" value={data?.Current_a ?? 0} unit="A" />
          <ParamRow label="Phase B" value={data?.Current_b ?? 0} unit="A" />
          <ParamRow label="Phase C" value={data?.Current_c ?? 0} unit="A" />
          <ParamRow label="Average" value={data?.Current_Ave ?? 0} unit="A" />
        </ParamSection>

        <ParamSection title="General">
          <ParamRow label="Power Factor" value={data?.Power_factor ?? 0} unit="" />
          <ParamRow label="Frequency" value={data?.Frequency ?? 0} unit="Hz" />
        </ParamSection>
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { PLC_METERS } from '../constants/plcMeters'
import { useNodeRedHealth, usePlcFullSnapshot } from '../hooks/queries'
import type { PlcMeterData } from '../types'

function fmt(n: number, decimals = 1): string {
  if (!Number.isFinite(n) || n === 0) return '—'
  return n.toFixed(decimals)
}

/** Format numeric values where zero is meaningful (e.g. kWh totals). */
function fmtQty(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(decimals)
}

function meterHasData(data: PlcMeterData | undefined): boolean {
  if (!data) return false
  return data.Real_power !== 0 || data.Voltage_Lave !== 0 || data.Current_Ave !== 0
}

function MeterTable({
  meters,
  snapMeters,
  padToRows,
}: {
  meters: typeof PLC_METERS
  snapMeters: Record<string, PlcMeterData> | undefined
  padToRows?: number
}) {
  const padCount = Math.max(0, (padToRows ?? 0) - meters.length)
  return (
    <div className="card overflow-hidden rounded-none border-0 bg-[color-mix(in_srgb,var(--card)_92%,#0b1220)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] table-fixed text-xs">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-[color-mix(in_srgb,var(--border)_75%,transparent)] bg-[color-mix(in_srgb,var(--muted)_6%,#0b1220)] text-left text-[11px] font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--muted)_85%,var(--text))]">
              <th className="w-[36%] px-3 py-3">Meter / Location</th>
              <th className="w-[12%] px-3 py-3">Status</th>
              <th className="w-[10%] px-3 py-3 text-right">kW</th>
              <th className="w-[12%] px-3 py-3 text-right">kWh</th>
              <th className="w-[10%] px-3 py-3 text-center">V</th>
              <th className="w-[10%] px-3 py-3 text-center">I</th>
              <th className="w-[10%] px-3 py-3 text-center">PF</th>
            </tr>
          </thead>
          <tbody>
            {meters.map((meter) => {
              const data = snapMeters?.[meter.id]
              const online = meterHasData(data)
              const dot = online
                ? 'bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.08)]'
                : 'bg-slate-500/70 shadow-[0_0_0_3px_rgba(148,163,184,0.06)]'
              return (
                <tr
                  key={meter.id}
                  className="border-b border-[color-mix(in_srgb,var(--border)_55%,transparent)] last:border-0 hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)]"
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className={['h-2 w-2 shrink-0 rounded-full', dot].join(' ')} aria-hidden />
                      <div className="min-w-0">
                        <Link
                          to={`/meters/${meter.id}`}
                          className="block truncate font-semibold text-[color-mix(in_srgb,var(--primary)_55%,var(--text))] hover:underline"
                        >
                          {meter.name}
                        </Link>
                        <div className="truncate text-[10px] leading-tight text-[var(--muted)]">{meter.location}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={[
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide',
                        online
                          ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-500/35 bg-slate-500/10 text-slate-300',
                      ].join(' ')}
                    >
                      {online ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-[var(--text)]">
                    {online ? fmt(data?.Real_power ?? 0, 1) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[var(--muted)]">
                    {online ? fmtQty(data?.Real_energy ?? 0, 0) : '—'}
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-[var(--muted)]">
                    {online ? fmt(data?.Voltage_Lave ?? 0, 0) : '—'}
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-[var(--muted)]">
                    {online ? fmt(data?.Current_Ave ?? 0, 1) : '—'}
                  </td>
                  <td
                    className={[
                      'px-3 py-3 text-center font-mono font-semibold',
                      online && (data?.Power_factor ?? 0) < 0.9
                        ? 'text-amber-300'
                        : online
                          ? 'text-emerald-300'
                          : 'text-[var(--muted)]',
                    ].join(' ')}
                  >
                    {online ? fmt(data?.Power_factor ?? 0, 3) : '—'}
                  </td>
                </tr>
              )
            })}

            {/* Spacer rows: keep both columns the same height (no empty block). */}
            {padCount > 0
              ? Array.from({ length: padCount }).map((_, i) => (
                  <tr
                    key={`pad-${i}`}
                    aria-hidden
                    className="border-b border-[color-mix(in_srgb,var(--border)_55%,transparent)] opacity-0 last:border-0"
                  >
                    <td className="px-3 py-3">.</td>
                    <td className="px-3 py-3">.</td>
                    <td className="px-3 py-3 text-right">.</td>
                    <td className="px-3 py-3 text-right">.</td>
                    <td className="px-3 py-3 text-center">.</td>
                    <td className="px-3 py-3 text-center">.</td>
                    <td className="px-3 py-3 text-center">.</td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function RealTimeDataPage() {
  const snapQ = usePlcFullSnapshot()
  const healthQ = useNodeRedHealth()
  const plcUp = healthQ.data?.plcLink?.up === true
  const snap = snapQ.data

  const metersOnline = useMemo(() => {
    const m = snap?.meters
    if (!m) return 0
    return PLC_METERS.filter((def) => meterHasData(m[def.id])).length
  }, [snap?.meters])

  const [leftMeters, rightMeters] = useMemo(() => {
    const mid = Math.ceil(PLC_METERS.length / 2)
    return [PLC_METERS.slice(0, mid), PLC_METERS.slice(mid)]
  }, [])
  const padToRows = Math.max(leftMeters.length, rightMeters.length)

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-[var(--text)]">Live Meters</div>
          <div className="mt-0.5 text-xs text-[var(--muted)]">
            Live parameter monitoring. Data refreshes continuously.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_4%,transparent)] px-3 py-1.5 text-xs font-medium text-[var(--text)] shadow-sm hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
          >
            Filter
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_4%,transparent)] px-3 py-1.5 text-xs font-medium text-[var(--text)] shadow-sm hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
          >
            Export
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
        <div>
          All Power Meters ({PLC_METERS.length}) · Online: {metersOnline}/{PLC_METERS.length}
        </div>
        <div>
          PLC:{' '}
          <span className={plcUp ? 'text-emerald-400' : 'text-red-400'}>{plcUp ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="card overflow-hidden border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--card)_92%,#0b1220)]">
        <div className="grid grid-cols-1 gap-px bg-[color-mix(in_srgb,var(--border)_60%,transparent)] lg:grid-cols-2">
          <MeterTable meters={leftMeters} snapMeters={snap?.meters} padToRows={padToRows} />
          <MeterTable meters={rightMeters} snapMeters={snap?.meters} padToRows={padToRows} />
        </div>
      </div>
    </div>
  )
}


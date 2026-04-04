import type { PqLevel } from '../../lib/pqStandards'

const levelUi = (level: PqLevel) => {
  switch (level) {
    case 'critical':
      return {
        label: 'CRITICAL',
        bar: 'bg-red-500',
        text: 'text-red-100',
        border: 'border-red-500/50',
        glow: 'shadow-[0_0_24px_rgba(239,68,68,0.25)]',
      }
    case 'warning':
      return {
        label: 'WARNING',
        bar: 'bg-amber-400',
        text: 'text-amber-950',
        border: 'border-amber-400/50',
        glow: 'shadow-[0_0_20px_rgba(251,191,36,0.2)]',
      }
    default:
      return {
        label: 'NORMAL',
        bar: 'bg-emerald-500',
        text: 'text-emerald-950',
        border: 'border-emerald-500/45',
        glow: 'shadow-[0_0_16px_rgba(16,185,129,0.18)]',
      }
  }
}

export function PqGlobalStatusBar(props: {
  level: PqLevel
  lastUpdate: string | null
  activeAlarms: number
  worstEvent: string
  plcConnected: boolean
}) {
  const { level, lastUpdate, activeAlarms, worstEvent, plcConnected } = props
  const ui = levelUi(plcConnected ? level : 'critical')

  return (
    <div
      className={[
        'sticky top-0 z-30 flex min-w-0 flex-col gap-2 border-b px-3 py-2.5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:gap-4',
        'border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_92%,transparent)]',
        ui.border,
        ui.glow,
        !plcConnected ? 'animate-pulse' : '',
      ].join(' ')}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className={['flex h-9 min-w-[120px] items-center justify-center rounded-lg px-3 text-xs font-bold tracking-wide', ui.bar, ui.text].join(' ')}>
          PQ: {ui.label}
        </div>
        <div className="min-w-0 text-xs text-[var(--muted)]">
          <span className="text-[var(--text)]">Worst: </span>
          <span className="font-medium text-[var(--text)]">{worstEvent}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
        <span>
          Last update:{' '}
          <span className="tabular-nums text-[var(--text)]">{lastUpdate ?? '—'}</span>
        </span>
        <span>
          PQ alarms:{' '}
          <span className={activeAlarms > 0 ? 'font-semibold text-amber-400' : 'text-[var(--text)]'}>{activeAlarms}</span>
        </span>
        <span>
          PLC:{' '}
          <span className={plcConnected ? 'font-medium text-emerald-400' : 'font-medium text-red-400'}>
            {plcConnected ? 'Connected' : 'Disconnected'}
          </span>
        </span>
      </div>
    </div>
  )
}

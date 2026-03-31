import type { MeterStatus } from '../../types'

type Props = {
  x: number
  y: number
  label: string
  powerKw?: number
  voltageV?: number
  status: MeterStatus
}

const STATUS_COLORS: Record<MeterStatus, { fill: string; stroke: string }> = {
  online: { fill: 'color-mix(in srgb, var(--accent-green) 16%, var(--card))', stroke: 'var(--accent-green)' },
  offline: { fill: 'var(--card)', stroke: 'var(--border)' },
  warning: { fill: 'var(--card)', stroke: 'var(--border)' },
}

export default function MeterSymbol({
  x,
  y,
  label,
  powerKw,
  voltageV,
  status,
}: Props) {
  const r = 16
  const cfg = STATUS_COLORS[status]

  return (
    <g>
      {/* Circle */}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={cfg.fill}
        stroke={cfg.stroke}
        strokeWidth={2}
        className="dark:opacity-90"
      />

      {/* M label */}
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-[var(--text)]"
        fontSize={14}
        fontWeight={700}
      >
        M
      </text>

      {/* Meter name below */}
      <text
        x={x}
        y={y + r + 14}
        textAnchor="middle"
        className="fill-[var(--text)]"
        fontSize={10}
        fontWeight={600}
      >
        {label}
      </text>

      {/* Readings below name */}
      {powerKw !== undefined && (
        <text
          x={x}
          y={y + r + 26}
          textAnchor="middle"
          className="fill-[var(--muted)]"
          fontSize={9}
        >
          {powerKw.toFixed(1)} kW
        </text>
      )}
      {voltageV !== undefined && (
        <text
          x={x}
          y={y + r + 37}
          textAnchor="middle"
          className="fill-[var(--muted)]"
          fontSize={9}
        >
          {voltageV.toFixed(0)} V
        </text>
      )}
    </g>
  )
}

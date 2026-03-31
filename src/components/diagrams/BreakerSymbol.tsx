import type { BreakerState } from '../../types'

type Props = {
  x: number
  y: number
  state: BreakerState
  label: string
  onClick?: () => void
}

const STATE_CONFIG: Record<BreakerState, { fill: string; stroke: string; showX: boolean }> = {
  closed: { fill: 'var(--accent-green)', stroke: 'var(--accent-green)', showX: false },
  open: { fill: 'none', stroke: 'var(--border)', showX: false },
  tripped: { fill: 'var(--accent-red)', stroke: 'var(--accent-red)', showX: true },
}

export default function BreakerSymbol({ x, y, state, label, onClick }: Props) {
  const cfg = STATE_CONFIG[state]
  const size = 20

  return (
    <g
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick()
            }
          : undefined
      }
    >
      {/* Breaker body: a square rotated 45deg to form a diamond */}
      <rect
        x={x - size / 2}
        y={y - size / 2}
        width={size}
        height={size}
        rx={2}
        fill={cfg.fill}
        stroke={cfg.stroke}
        strokeWidth={2}
        transform={`rotate(45 ${x} ${y})`}
      />

      {/* Tripped X marker */}
      {cfg.showX && (
        <>
          <line
            x1={x - 7}
            y1={y - 7}
            x2={x + 7}
            y2={y + 7}
            stroke="#fff"
            strokeWidth={2.5}
          />
          <line
            x1={x + 7}
            y1={y - 7}
            x2={x - 7}
            y2={y + 7}
            stroke="#fff"
            strokeWidth={2.5}
          />
        </>
      )}

      {/* Label */}
      <text
        x={x + size / 2 + 8}
        y={y + 4}
        className="fill-[var(--text)]"
        fontSize={10}
        fontWeight={500}
      >
        {label}
      </text>

      {/* State label */}
      <text
        x={x + size / 2 + 8}
        y={y + 16}
        className="fill-[var(--muted)]"
        fontSize={9}
      >
        {state.toUpperCase()}
      </text>
    </g>
  )
}

type Thresholds = {
  warning: number
  critical: number
}

type Props = {
  value: number
  max: number
  label: string
  unit: string
  thresholds: Thresholds
}

export default function GaugeChart({
  value,
  max,
  label,
  unit,
  thresholds,
}: Props) {
  const clampedValue = Math.min(Math.max(value, 0), max)
  const ratio = clampedValue / max
  const warningRatio = thresholds.warning / max
  const criticalRatio = thresholds.critical / max

  // SVG arc geometry: semicircle from 180deg to 0deg (left to right)
  const cx = 120
  const cy = 110
  const r = 80
  const strokeW = 16

  // Convert ratio (0..1) to angle in radians (PI..0, left to right)
  function ratioToAngle(t: number) {
    return Math.PI * (1 - t)
  }

  function polarToXY(angle: number, radius: number) {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy - radius * Math.sin(angle),
    }
  }

  function arcPath(startRatio: number, endRatio: number, radius: number) {
    const startAngle = ratioToAngle(startRatio)
    const endAngle = ratioToAngle(endRatio)
    const start = polarToXY(startAngle, radius)
    const end = polarToXY(endAngle, radius)
    const largeArc = Math.abs(startAngle - endAngle) > Math.PI ? 1 : 0
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`
  }

  // Needle position
  const needleAngle = ratioToAngle(ratio)
  const needleTip = polarToXY(needleAngle, r - strokeW / 2 - 4)
  const needleBase1 = polarToXY(needleAngle + Math.PI / 2, 4)
  const needleBase2 = polarToXY(needleAngle - Math.PI / 2, 4)

  // Value color
  let valueColor = 'var(--accent-green)'
  if (value >= thresholds.critical) {
    valueColor = 'var(--accent-red)'
  } else if (value >= thresholds.warning) {
    valueColor = 'var(--text)'
  }

  return (
    <div className="flex flex-col items-center rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <svg
        viewBox="0 0 240 140"
        className="w-full max-w-[280px]"
        aria-label={`${label}: ${value} ${unit}`}
      >
        {/* Green zone: 0 to warning */}
        <path
          d={arcPath(0, Math.min(warningRatio, 1), r)}
          fill="none"
          stroke="var(--accent-green)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          opacity={0.3}
        />
        {/* Amber zone: warning to critical */}
        <path
          d={arcPath(warningRatio, Math.min(criticalRatio, 1), r)}
          fill="none"
          stroke="var(--text)"
          strokeWidth={strokeW}
          strokeLinecap="butt"
          opacity={0.3}
        />
        {/* Red zone: critical to max */}
        <path
          d={arcPath(criticalRatio, 1, r)}
          fill="none"
          stroke="var(--accent-red)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          opacity={0.3}
        />

        {/* Active value arc */}
        {ratio > 0 && (
          <path
            d={arcPath(0, ratio, r)}
            fill="none"
            stroke={valueColor}
            strokeWidth={strokeW}
            strokeLinecap="round"
          />
        )}

        {/* Needle */}
        <polygon
          points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
          fill={valueColor}
        />
        <circle cx={cx} cy={cy} r={6} fill={valueColor} />

        {/* Value text */}
        <text
          x={cx}
          y={cy + 2}
          textAnchor="middle"
          dominantBaseline="hanging"
          className="fill-slate-800 text-2xl font-bold dark:fill-slate-100"
          fontSize="24"
          fontWeight="700"
        >
          {value.toFixed(1)}
        </text>
        <text
          x={cx}
          y={cy + 28}
          textAnchor="middle"
          dominantBaseline="hanging"
          className="fill-slate-500 dark:fill-slate-400"
          fontSize="12"
        >
          {unit}
        </text>

        {/* Min / Max labels */}
        <text
          x={cx - r - 4}
          y={cy + 14}
          textAnchor="middle"
          className="fill-slate-400 dark:fill-slate-500"
          fontSize="10"
        >
          0
        </text>
        <text
          x={cx + r + 4}
          y={cy + 14}
          textAnchor="middle"
          className="fill-slate-400 dark:fill-slate-500"
          fontSize="10"
        >
          {max}
        </text>
      </svg>
      <span className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
    </div>
  )
}

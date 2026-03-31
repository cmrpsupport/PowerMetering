type Props = {
  x: number
  y: number
  width: number
  label: string
  voltageKv: number
  color?: string
}

export default function BusBar({
  x,
  y,
  width,
  label,
  voltageKv,
  color = '#334155',
}: Props) {
  return (
    <g>
      {/* Bus bar thick line */}
      <rect
        x={x}
        y={y - 4}
        width={width}
        height={8}
        rx={2}
        fill={color}
        className="dark:opacity-90"
      />

      {/* Label above */}
      <text
        x={x + width / 2}
        y={y - 14}
        textAnchor="middle"
        className="fill-slate-700 dark:fill-slate-200"
        fontSize={12}
        fontWeight={600}
      >
        {label}
      </text>

      {/* Voltage below */}
      <text
        x={x + width / 2}
        y={y + 20}
        textAnchor="middle"
        className="fill-slate-500 dark:fill-slate-400"
        fontSize={10}
      >
        {voltageKv} kV
      </text>
    </g>
  )
}

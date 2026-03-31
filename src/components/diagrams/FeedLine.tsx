type Props = {
  x: number
  y1: number
  y2: number
  color?: string
}

export default function FeedLine({ x, y1, y2, color = '#64748b' }: Props) {
  return (
    <line
      x1={x}
      y1={y1}
      x2={x}
      y2={y2}
      stroke={color}
      strokeWidth={2}
      className="dark:opacity-80"
    />
  )
}

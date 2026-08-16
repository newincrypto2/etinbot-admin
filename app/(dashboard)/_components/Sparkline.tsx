// Mini-wykres trendu w kaflu KPI. Server component — czysty inline SVG,
// bez JS po stronie klienta (wzorzec z makiety etinbot-panel-2.html).

export function Sparkline({
  points,
  color = '#2E7CF0',
  width = 140,
  height = 30,
}: {
  points: number[]
  color?: string
  width?: number
  height?: number
}) {
  if (!points || points.length < 2) return null

  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const step = width / (points.length - 1)

  const coords = points.map((p, i) => {
    const x = i * step
    const y = height - 3 - ((p - min) / range) * (height - 8)
    return [x, y] as const
  })

  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width} ${height} L0 ${height} Z`
  const [lastX, lastY] = coords[coords.length - 1]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      height={height}
      width="100%"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="mt-2 block"
    >
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} />
      <circle cx={lastX} cy={lastY} r={2.4} fill={color} />
    </svg>
  )
}

// Reusable SVG arc ring — replaces progress bars throughout the app.
// value: current value, max: maximum value, size: px, strokeWidth: px,
// color: stroke color, bg: track color, label: text inside ring.

export default function ArcRing({
  value = 0,
  max = 100,
  size = 80,
  strokeWidth = 7,
  color = 'var(--career)',
  bg = 'var(--bg-3)',
  label,
  sublabel,
  fontSize,
}) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(Math.max(value / max, 0), 1)
  const offset = circ * (1 - pct)
  const cx = size / 2
  const cy = size / 2

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ display: 'block' }}>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={bg}
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      {/* Center label */}
      {(label !== undefined || sublabel) && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1.2,
        }}>
          {label !== undefined && (
            <span style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 700,
              fontSize: fontSize || Math.max(size * 0.22, 12),
              color: 'var(--text)',
              letterSpacing: '-0.02em',
            }}>
              {label}
            </span>
          )}
          {sublabel && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              marginTop: 2,
            }}>
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

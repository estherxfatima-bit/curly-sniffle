import { useEffect, useState } from 'react'

const COLORS = [
  'var(--career)', 'var(--creative)', 'var(--finance)',
  'var(--wellness)', 'var(--personal)',
]

function rand(min, max) { return Math.random() * (max - min) + min }

export default function Confetti({ active, count = 60 }) {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (!active) { setParticles([]); return }
    const ps = Array.from({ length: count }, (_, i) => ({
      id: i,
      left: rand(0, 100),
      color: COLORS[Math.floor(rand(0, COLORS.length))],
      duration: rand(1.8, 3.2),
      delay: rand(0, 0.8),
      size: rand(6, 11),
      rotate: rand(0, 360),
    }))
    setParticles(ps)
    const t = setTimeout(() => setParticles([]), 4000)
    return () => clearTimeout(t)
  }, [active])

  if (!particles.length) return null

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999, overflow: 'hidden' }}>
      {particles.map(p => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.left}%`,
            top: '-12px',
            width: p.size,
            height: p.size,
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}

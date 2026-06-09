import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import AIPlanningPanel from './AIPlanningPanel'
import { Sparkles } from 'lucide-react'

export default function AppLayout({ children }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 769)
  const [showAI, setShowAI] = useState(false)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 769)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return (
    <div className="app-layout">
      {!isMobile && <Sidebar />}
      <main className="main-content fade-in">
        {children}
      </main>
      {isMobile && <MobileNav />}

      {/* AI panel overlay */}
      {showAI && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 199, backdropFilter: 'blur(2px)' }} onClick={() => setShowAI(false)} />
          <AIPlanningPanel onClose={() => setShowAI(false)} />
        </>
      )}

      {/* Floating AI trigger button */}
      <button
        onClick={() => setShowAI(v => !v)}
        title="AI Planning Panel"
        style={{
          position: 'fixed',
          bottom: isMobile ? 76 : 28,
          right: 24,
          width: 48, height: 48,
          borderRadius: '50%',
          background: 'var(--career)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(26,79,255,0.35)',
          zIndex: 190,
          transition: 'transform 0.15s, opacity 0.15s',
          transform: showAI ? 'rotate(45deg) scale(0.9)' : 'scale(1)',
        }}
      >
        <Sparkles size={20} />
      </button>
    </div>
  )
}

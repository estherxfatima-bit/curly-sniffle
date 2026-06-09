import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'

export default function AppLayout({ children }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 769)

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
    </div>
  )
}

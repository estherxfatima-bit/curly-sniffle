import { useEffect } from 'react'

// Tracks how many mounted modals/panels currently want the body scroll locked,
// so that closing one of several simultaneously-open overlays doesn't
// accidentally unlock scroll while another is still open.
let lockCount = 0

// Locks document body scroll while `active` is true (defaults to true, i.e.
// for the lifetime of the calling component). Safe to use from multiple
// modals/panels at once (reference-counted) and safe to toggle on/off when a
// single component conditionally renders more than one overlay.
export default function useLockBodyScroll(active = true) {
  useEffect(() => {
    if (!active) return
    lockCount += 1
    document.body.style.overflow = 'hidden'
    return () => {
      lockCount = Math.max(0, lockCount - 1)
      if (lockCount === 0) {
        document.body.style.overflow = ''
      }
    }
  }, [active])
}

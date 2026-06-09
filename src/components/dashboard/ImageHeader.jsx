import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Camera } from 'lucide-react'

export default function ImageHeader({ user, imageUrl, onUpdate, greeting }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `${user.id}/dashboard.${ext}`
      const { error } = await supabase.storage
        .from('dashboard-images')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage
        .from('dashboard-images')
        .getPublicUrl(path)
      // cache-bust
      const url = `${publicUrl}?t=${Date.now()}`
      await supabase.from('profiles').upsert({ id: user.id, image_url: url }, { onConflict: 'id' })
      onUpdate(url)
    } catch (err) {
      console.error('Image upload failed:', err)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const hasImage = !!imageUrl

  return (
    <div style={{
      position: 'relative',
      height: 180,
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      marginBottom: 24,
    }}>
      {/* Background */}
      {hasImage ? (
        <img
          src={imageUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg, #f0e9e2 0%, #e4d8ce 45%, #d8cabe 100%)',
        }} />
      )}

      {/* Bottom gradient overlay — always shown */}
      <div style={{
        position: 'absolute', inset: 0,
        background: hasImage
          ? 'linear-gradient(to top, rgba(13,8,5,0.62) 0%, rgba(13,8,5,0.08) 55%, transparent 100%)'
          : 'linear-gradient(to top, rgba(45,37,32,0.18) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Greeting overlaid at bottom */}
      {greeting && (
        <div style={{
          position: 'absolute', bottom: 20, left: 28, right: 80,
        }}>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 'clamp(1.3rem, 3vw, 1.9rem)',
            fontWeight: 600,
            color: hasImage ? '#fff' : 'var(--text)',
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            textShadow: hasImage ? '0 1px 8px rgba(0,0,0,0.4)' : 'none',
          }}>
            {greeting}
          </p>
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(0,0,0,0.38)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: '#fff',
          borderRadius: 8,
          padding: '6px 11px',
          fontSize: 11,
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 5,
          cursor: uploading ? 'default' : 'pointer',
          transition: 'opacity 0.15s',
          opacity: uploading ? 0.6 : 1,
        }}
      >
        <Camera size={12} />
        {uploading ? 'Uploading…' : imageUrl ? 'Change' : 'Add image'}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </div>
  )
}

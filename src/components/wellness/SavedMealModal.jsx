import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

export default function SavedMealModal({ meal, userId, onClose, onSave }) {
  useLockBodyScroll()
  const isNew = !meal?.id
  const fileRef = useRef(null)
  const [form, setForm] = useState({
    name: meal?.name || '',
    image_url: meal?.image_url || '',
    ingredients: (meal?.ingredients || []).join('\n'),
  })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `${userId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('meal-images')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('meal-images').getPublicUrl(path)
      set('image_url', publicUrl)
    } catch (err) {
      console.error('Meal image upload failed:', err)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const ingredients = form.ingredients.split('\n').map(s => s.trim()).filter(Boolean)
    await onSave({
      name: form.name.trim(),
      image_url: form.image_url || null,
      ingredients,
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal scale-in" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.3rem' }}>{isNew ? 'Add meal' : 'Edit meal'}</h2>
          <button className="btn-icon btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="form-group">
          <label>Name</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Meal name…" autoFocus />
        </div>

        <div className="form-group">
          <label>Photo (optional)</label>
          {form.image_url && (
            <img src={form.image_url} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 8 }} />
          )}
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : form.image_url ? 'Change photo' : 'Upload photo'}
            </button>
            {form.image_url && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => set('image_url', '')}>Remove</button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </div>

        <div className="form-group">
          <label>Ingredients (one per line)</label>
          <textarea
            value={form.ingredients}
            onChange={e => set('ingredients', e.target.value)}
            placeholder={'2 chicken breasts\nBroccoli\nSoy sauce'}
            style={{ width: '100%', minHeight: 120, fontSize: 13 }}
          />
        </div>

        <div className="flex gap-2 justify-end mt-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-wellness" style={{ color: '#fff' }} onClick={save} disabled={saving || uploading}>
            {saving ? 'Saving…' : isNew ? 'Add meal' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

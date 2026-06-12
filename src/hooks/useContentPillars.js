import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CONTENT_PILLARS } from '../lib/constants'

// Pillar names are now user-managed (content_pillars table). Falls back to the
// default pillar names if the user hasn't visited the Pillars tab yet.
export function useContentPillars(userId) {
  const [pillars, setPillars] = useState(CONTENT_PILLARS)

  useEffect(() => {
    if (!userId) return
    supabase.from('content_pillars').select('name').eq('user_id', userId).order('position').order('created_at')
      .then(({ data }) => {
        if (data && data.length) setPillars(data.map(p => p.name))
      })
  }, [userId])

  return pillars
}

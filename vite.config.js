import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Force a single React instance across all dependencies.
    // Without this, packages like recharts or @supabase/auth-ui-react can
    // resolve their own internal copy of React, causing the
    // "Cannot read properties of null (reading 'useState')" duplicate-instance error.
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
})

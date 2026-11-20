/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves the app from https://douappast.github.io/padel-tricount/
  base: '/padel-tricount/',
  plugins: [react()],
  // Single bundle (~290 kB gzip: MUI, React, Supabase). Code splitting was tried and
  // made the first load larger because shared MUI code got duplicated.
  build: { chunkSizeWarningLimit: 1100 },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'supabase/tests/**/*.test.ts'],
    testTimeout: 20_000,
  },
})

/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves the app from https://douappast.github.io/padel-tricount/
  base: '/padel-tricount/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'supabase/tests/**/*.test.ts'],
    testTimeout: 20_000,
  },
})

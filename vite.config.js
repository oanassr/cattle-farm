import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// base = '/cattle-farm/' للنشر على GitHub Pages تحت مسار المستودع.
// للنشر على نطاق جذر (Vercel/Netlify) اضبط BASE=/ عبر متغير البيئة.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/cattle-farm/',
  plugins: [react()],
})

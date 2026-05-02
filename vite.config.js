import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const sbUrl = env.VITE_SUPABASE_URL || ''
  const sbKey = env.VITE_SUPABASE_ANON_KEY || ''
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'window.__VITE_SB_URL': JSON.stringify(sbUrl),
      'window.__VITE_SB_KEY': JSON.stringify(sbKey),
    },
    server: {
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true }
      }
    }
  }
})

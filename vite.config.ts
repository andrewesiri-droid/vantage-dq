import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Raise warning threshold slightly — we're splitting, so chunks should be smaller
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // ── VENDOR: React core ─────────────────────────────────────────
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }

          // ── VENDOR: Radix UI components ────────────────────────────────
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }

          // ── VENDOR: Supabase ───────────────────────────────────────────
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }

          // ── VENDOR: Charts + data viz ─────────────────────────────────
          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory')) {
            return 'vendor-charts';
          }

          // ── VENDOR: Everything else in node_modules ───────────────────
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
          }

          // ── APP: DQ Modules (heaviest components) ─────────────────────
          if (id.includes('/components/modules/')) {
            return 'modules';
          }

          // ── APP: Tools (Workshop, Deep Dive, Export) ───────────────────
          if (id.includes('/components/tools/') ||
              id.includes('/components/layout/WorkshopPanel') ||
              id.includes('/components/layout/AICoPilot')) {
            return 'tools';
          }

          // ── APP: Collaboration (invite, presence, participant) ─────────
          if (id.includes('/components/collaboration/') ||
              id.includes('/hooks/useWorkshopSync') ||
              id.includes('/hooks/useSupabaseAuth')) {
            return 'collaboration';
          }

          // ── APP: Pages ─────────────────────────────────────────────────
          if (id.includes('/pages/')) {
            return 'pages';
          }
        },
      },
    },
  },
});

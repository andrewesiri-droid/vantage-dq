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
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-framer';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('src/components/onboarding')) {
            return 'onboarding';
          }
          if (id.includes('src/hooks/useDQAI') || id.includes('src/lib/dq/dq-extraction') || id.includes('src/lib/issues')) {
            return 'ai-engine';
          }
          if (id.includes('modules/ScenarioPlanning') || id.includes('modules/ValueOfInformation') || 
              id.includes('modules/InfluenceDiagram') || id.includes('modules/DecisionRiskTimeline') ||
              id.includes('modules/TornadoChart') || id.includes('modules/GameTheory')) {
            return 'modules-phase2';
          }
          if (id.includes('modules/StakeholderAlignment') || id.includes('modules/DecisionLineage') ||
              id.includes('modules/ExecutiveRecommendation') || id.includes('modules/PostDecisionTracker')) {
            return 'modules-phase1b';
          }
          if (id.includes('src/components/modules')) {
            return 'modules-phase1';
          }
        },
      },
    },
  },
});

import { Routes, Route, Navigate, useNavigate } from 'react-router';
import { useEffect, useState, createContext, useContext } from 'react';
import { enableDemoMode, isDemoMode, getDemoUser, initializeDemoData } from '@/lib/demoData';
import { HomePage } from '@/pages/HomePage';
import { Dashboard } from '@/pages/Dashboard';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { SessionPage } from '@/pages/SessionPage';
import { LoginPage } from '@/pages/LoginPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { DemoBanner } from '@/components/layout/DemoBanner';
import { ProjectorPage } from '@/pages/ProjectorPage';
import { JoinPage } from '@/pages/JoinPage';

// Demo context
interface DemoContextType { demoMode: boolean; setDemoMode: (v: boolean) => void; user: any; authUser: any; signOut: () => void; }
const DemoContext = createContext<DemoContextType>({ demoMode: false, setDemoMode: () => {}, user: null, authUser: null, signOut: () => {} });
export const useDemoContext = () => useContext(DemoContext);

function AppInner() {
  const _navigate = useNavigate(); void _navigate;
  const { user: authUser, signOut } = useSupabaseAuth();
  const [demoMode, setDemoModeState] = useState(isDemoMode());
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  const setDemoMode = (v: boolean) => {
    if (v) { enableDemoMode(); }
    setDemoModeState(v);
  };

  // On first load, check if backend is available
  useEffect(() => {
    const checkBackend = async () => {
      try {
        // Try to reach the backend health check
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('/api/ping', { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          // Backend is available
          const data = await res.json();
          if (data.ok) {
            setChecking(false);
            return; // Normal mode
          }
        }
      } catch {
        // Backend unreachable — enable demo mode
      }

      // No backend — auto-enable demo
      enableDemoMode();
      initializeDemoData();
      setDemoModeState(true);
      setUser(getDemoUser());
      setChecking(false);
    };

    checkBackend();
  }, []);

  // Also check if user has previously enabled demo
  useEffect(() => {
    if (isDemoMode()) {
      setDemoModeState(true);
      setUser(getDemoUser());
      setChecking(false);
    }
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F9FC' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs" style={{ color: '#64748B' }}>Loading Vantage DQ...</p>
        </div>
      </div>
    );
  }

  return (
    <DemoContext.Provider value={{ demoMode, setDemoMode, user, authUser, signOut }}>
      <div className="relative">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/session/:slug" element={<SessionPage />} />
          <Route path="/session/:slug/projector" element={<ProjectorPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/join/:token" element={<JoinPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <DemoBanner />
      </div>
    </DemoContext.Provider>
  );
}

export default function App() {
  return <AppInner />;
}

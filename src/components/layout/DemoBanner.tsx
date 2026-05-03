import { useState } from 'react';
import { useNavigate } from 'react-router';
import { isDemoMode } from '@/lib/demoData';
import { AlertTriangle, X, LogIn } from 'lucide-react';

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  if (!isDemoMode() || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-lg max-w-[calc(100vw-2rem)]"
      style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0B1D3A 100%)', border: '1px solid rgba(201,168,76,0.4)' }}>
      <AlertTriangle size={14} style={{ color: '#C9A84C', flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-white">Demo Mode</p>
        <p className="text-[10px] text-white/60 hidden sm:block">Data is local only. Sign in for cloud save & collaboration.</p>
      </div>
      <button
        onClick={() => navigate('/login')}
        className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg shrink-0 transition-all hover:opacity-80"
        style={{ background: '#C9A84C', color: '#0B1D3A' }}>
        <LogIn size={11} /> Sign In
      </button>
      <button onClick={() => setDismissed(true)} className="text-white/40 hover:text-white shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

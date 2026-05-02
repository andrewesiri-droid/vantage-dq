import { useState } from 'react';
import { isDemoMode } from '@/lib/demoData';
import { AlertTriangle, X } from 'lucide-react';

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (!isDemoMode() || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-lg"
      style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0B1D3A 100%)', border: '1px solid rgba(201,168,76,0.4)' }}>
      <AlertTriangle size={14} style={{ color: '#C9A84C' }} />
      <div>
        <p className="text-[11px] font-bold text-white">Demo Mode</p>
        <p className="text-[10px] text-white/60">All data is local. Sign in to enable cloud save and collaboration.</p>
      </div>
      <button onClick={() => setDismissed(true)} className="text-white/40 hover:text-white ml-2">
        <X size={14} />
      </button>
    </div>
  );
}

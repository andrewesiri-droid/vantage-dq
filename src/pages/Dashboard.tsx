import { useNavigate } from 'react-router';
import { useDemoContext } from '@/App';
import { demoApi, enableDemoMode, initializeDemoData, getDemoData } from '@/lib/demoData';
import { DS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Shield, Plus, ArrowRight, Clock, FileText, Play } from 'lucide-react';
import { useState, useEffect } from 'react';

export function Dashboard() {
  const navigate = useNavigate();
  const { demoMode, setDemoMode } = useDemoContext();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (demoMode) {
      const data = getDemoData();
      setSessions([data.session].filter(Boolean));
      setLoading(false);
      return;
    }
    setLoading(false);
  }, [demoMode]);

  const startDemo = () => {
    enableDemoMode();
    initializeDemoData();
    setDemoMode(true);
    navigate('/session/demo-apac-entry');
  };

  return (
    <div className="min-h-screen" style={{ background: DS.bg }}>
      {/* Header */}
      <header className="border-b px-8 py-4 flex items-center justify-between" style={{ background: DS.brand, borderColor: DS.chromeMid }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: DS.accent }}>
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wide">VANTAGE DQ</div>
            <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Decision Quality Platform</div>
          </div>
        </div>
        <Button size="sm" variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 text-xs"
          onClick={() => navigate('/')}>← Home</Button>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black mb-1" style={{ color: DS.ink }}>Dashboard</h1>
            <p className="text-sm" style={{ color: DS.inkSub }}>Your active decision sessions</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={startDemo} variant="outline" className="gap-2 text-xs">
              <Play size={13} /> Demo Session
            </Button>
            <Button onClick={() => navigate('/onboarding')} className="gap-2 text-xs" style={{ background: DS.accent }}>
              <Plus size={13} /> New Session
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20" style={{ color: DS.inkDis }}>
            <div className="text-xs">Loading sessions…</div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border-2 border-dashed" style={{ borderColor: DS.borderLight }}>
            <FileText size={40} className="mx-auto mb-4 opacity-20" style={{ color: DS.inkDis }} />
            <p className="text-sm font-medium mb-1" style={{ color: DS.inkSub }}>No sessions yet</p>
            <p className="text-xs mb-6" style={{ color: DS.inkDis }}>Start a new decision session or try the demo</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={startDemo} variant="outline" className="gap-2 text-xs"><Play size={12} /> Try Demo</Button>
              <Button onClick={() => navigate('/onboarding')} className="gap-2 text-xs" style={{ background: DS.accent }}><Plus size={12} /> New Session</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl cursor-pointer hover:shadow-md transition-all border"
                style={{ background: DS.canvas, borderColor: DS.borderLight }}
                onClick={() => navigate(`/session/${s.slug || 'demo-apac-entry'}`)}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: DS.accentSoft }}>
                  <Shield size={18} style={{ color: DS.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" style={{ color: DS.ink }}>{s.name || s.decisionStatement || 'Unnamed Session'}</div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] flex items-center gap-1" style={{ color: DS.inkDis }}>
                      <Clock size={10} /> {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : 'Recent'}
                    </span>
                    {s.owner && <span className="text-[10px]" style={{ color: DS.inkDis }}>Owner: {s.owner}</span>}
                  </div>
                </div>
                <ArrowRight size={16} style={{ color: DS.inkDis }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

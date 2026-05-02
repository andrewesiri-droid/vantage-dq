import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useDemoContext } from '@/App';
import { demoApi, enableDemoMode, initializeDemoData, getDemoData } from '@/lib/demoData';
import { DS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Shield, Plus, ArrowRight, Clock, Users, BarChart3,
  FileText, Loader2, Trash2, Play
} from 'lucide-react';
import { useState, useEffect } from 'react';

export function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { demoMode, setDemoMode } = useDemoContext();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If in demo mode, load from localStorage
    if (demoMode) {
      const data = getDemoData();
      setSessions([data.session]);
      setLoading(false);
      return;
    }

    // If user is logged in via auth, load from backend
    if (user) {
      // Try to fetch from backend
      fetch('/api/session/list')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => { setSessions(data || []); setLoading(false); })
        .catch(() => {
          // Backend failed — auto-enable demo
          enableDemoMode();
          initializeDemoData();
          setDemoMode(true);
          const data = getDemoData();
          setSessions([data.session]);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [user, demoMode]);

  const handleDelete = (id: number) => {
    if (demoMode) {
      // In demo, just reset to fresh
      initializeDemoData();
      const data = getDemoData();
      setSessions([data.session]);
    }
  };

  const handleEnableDemo = () => {
    enableDemoMode();
    initializeDemoData();
    setDemoMode(true);
    const data = getDemoData();
    setSessions([data.session]);
  };

  const displayUser = user || (demoMode ? { name: 'Demo Executive' } : null);

  return (
    <div className="min-h-screen" style={{ background: DS.bg }}>
      {/* Header */}
      <div className="border-b" style={{ background: DS.canvas }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: DS.accent }}>
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold" style={{ color: DS.ink }}>Vantage<span style={{ color: DS.accent }}>DQ</span></h1>
              <p className="text-[9px] tracking-widest uppercase" style={{ color: DS.inkDis }}>Decision Quality Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {displayUser && (
              <span className="text-[11px]" style={{ color: DS.inkSub }}>{displayUser.name || 'User'}</span>
            )}
            {demoMode && (
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: '#FEF3C7', color: '#D97706' }}>DEMO</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-1" style={{ color: DS.ink }}>
            Welcome{displayUser ? `, ${displayUser.name?.split(' ')[0] || 'back'}` : ''}
          </h2>
          <p className="text-xs" style={{ color: DS.inkSub }}>
            {demoMode
              ? 'You are in demo mode. All data is stored locally in your browser.'
              : sessions.length === 0
                ? 'Start your first decision quality analysis.'
                : `You have ${sessions.length} decision session${sessions.length !== 1 ? 's' : ''}.`}
          </p>
        </div>

        {/* Enable demo banner (only when not in demo and not logged in) */}
        {!demoMode && !user && (
          <div className="mb-6 p-4 rounded-xl flex items-center gap-4" style={{ background: 'linear-gradient(135deg, #FDF8E8 0%, #FFFBEB 100%)', border: '1px solid #FDE68A' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FEF3C7' }}>
              <Play size={18} style={{ color: '#D97706' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: '#92400E' }}>Try the Demo</p>
              <p className="text-[11px]" style={{ color: '#B45309' }}>Explore the APAC Market Entry case study with all 12 modules populated.</p>
            </div>
            <Button size="sm" className="text-xs gap-1 shrink-0" style={{ background: '#D97706' }} onClick={handleEnableDemo}>
              <Play size={12} /> Launch Demo
            </Button>
          </div>
        )}

        {/* New Session CTA */}
        <button
          onClick={() => navigate('/onboarding')}
          className="w-full mb-8 rounded-xl p-6 text-left transition-all hover:shadow-lg hover:scale-[1.01] group"
          style={{ background: `linear-gradient(135deg, ${DS.accentSoft} 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid ${DS.accent}` }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform" style={{ background: DS.accent }}>
              <Plus size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold" style={{ color: DS.ink }}>Start a New Decision Session</h3>
              <p className="text-[11px]" style={{ color: DS.inkSub }}>AI Deep Dive · 5-Question Wizard · Clean Slate · Pre-loaded Example</p>
            </div>
            <ArrowRight size={18} style={{ color: DS.accent }} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Sessions list */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 size={20} className="animate-spin mx-auto mb-2" style={{ color: DS.accent }} />
            <p className="text-xs" style={{ color: DS.inkSub }}>Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={32} className="mx-auto mb-3" style={{ color: DS.inkDis }} />
            <p className="text-sm font-medium mb-1" style={{ color: DS.inkSub }}>No sessions yet</p>
            <p className="text-xs" style={{ color: DS.inkDis }}>Click "Start a New Decision Session" above to begin.</p>
          </div>
        ) : (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: DS.inkTer }}>Your Sessions</p>
            <div className="space-y-2">
              {sessions.map((session: any) => (
                <Card key={session.id} className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={() => navigate(`/session/${session.slug}`)}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: DS.accentSoft }}>
                      <BarChart3 size={16} style={{ color: DS.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold truncate" style={{ color: DS.ink }}>{session.name}</h4>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0 capitalize" style={{
                          background: session.status === 'draft' ? '#FEF3C7' : session.status === 'active' ? '#ECFDF5' : '#F1F5F9',
                          color: session.status === 'draft' ? '#D97706' : session.status === 'active' ? '#059669' : '#64748B',
                        }}>{session.status}</span>
                      </div>
                      <p className="text-[10px] truncate" style={{ color: DS.inkSub }}>{session.decisionStatement || 'No decision statement'}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] flex items-center gap-1" style={{ color: DS.inkDis }}>
                          <Clock size={8} /> {new Date(session.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight size={14} style={{ color: DS.inkDis }} className="group-hover:translate-x-1 transition-transform" />
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={12} className="text-red-400" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

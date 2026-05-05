import { useState } from 'react';
import { useNavigate } from 'react-router';
import { DS } from '@/constants';
import { enableDemoMode } from '@/lib/demoData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles, ChevronLeft, CheckCircle, Loader2,
  Globe, AlertTriangle, GitBranch, Table2, Users, Clock, BarChart3
} from 'lucide-react';

interface PreloadedExampleProps { onBack: () => void; }

const MODULES_INCLUDED = [
  { icon: Globe,         label: 'Problem Frame',          desc: 'Full APAC market entry context with Frame Check' },
  { icon: AlertTriangle, label: 'Issue Generation',        desc: '10 issues across all 12 categories with voting' },
  { icon: GitBranch,     label: 'Decision Hierarchy',      desc: '9 decisions: 2 given, 5 focus, 3 deferred' },
  { icon: Table2,        label: 'Strategy Table',          desc: '3 strategies with distinctiveness check' },
  { icon: BarChart3,     label: 'Qualitative Assessment',  desc: '8 criteria scored across 3 strategies' },
  { icon: Users,         label: 'Stakeholder Alignment',   desc: '8 stakeholders mapped on influence/interest grid' },
  { icon: Clock,         label: 'Decision Risk Timeline',  desc: '6 risks with likelihood, impact, and mitigation' },
];

export function PreloadedExample({ onBack }: PreloadedExampleProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLoad = () => {
    setLoading(true);
    // Enable demo mode — loads full APAC data into localStorage
    enableDemoMode();
    setTimeout(() => {
      navigate('/session/demo-apac-entry');
    }, 800);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: DS.bg }}>
        <div className="text-center">
          <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: '#C9A84C' }} />
          <h3 className="text-lg font-bold" style={{ color: DS.ink }}>Loading example session...</h3>
          <p className="text-xs" style={{ color: DS.inkSub }}>Populating all modules with APAC market entry data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: DS.bg }}>
      {/* Header */}
      <div className="flex items-center px-6 py-4 border-b" style={{ background: DS.brand }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronLeft size={16} className="text-white/70" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: '#C9A84C' }} />
            <span className="text-sm font-bold text-white">Pre-loaded Example</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1" style={{ color: DS.ink }}>APAC Market Entry Strategy</h2>
          <p className="text-xs" style={{ color: DS.inkSub }}>
            A fully populated example based on a real Fortune 500 decision. Explore to understand how each module works.
          </p>
        </div>

        {/* Case overview */}
        <Card className="border-0 shadow-md mb-6" style={{ background: `linear-gradient(135deg, ${DS.accentSoft} 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid ${DS.accent}` }}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe size={16} style={{ color: DS.accent }} />
              <span className="text-sm font-bold" style={{ color: DS.accent }}>Case Overview</span>
            </div>
            <p className="text-xs leading-relaxed mb-3" style={{ color: DS.ink }}>
              <strong>Decision:</strong> Which market entry strategy maximises risk-adjusted NPV for APAC expansion within a $25M Year 1 capital constraint?
            </p>
            <div className="flex flex-wrap gap-2">
              {['SaaS · $180M ARR', 'Zero APAC presence', '$25M cap', '12-month target', 'Board mandate'].map(tag => (
                <Badge key={tag} variant="outline" className="text-[9px] h-4" style={{ borderColor: DS.accent + '40', color: DS.accentLight }}>{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* What's included */}
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: DS.inkTer }}>What's Included</p>
        <div className="grid grid-cols-1 gap-2 mb-8">
          {MODULES_INCLUDED.map(mod => (
            <Card key={mod.label} className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: DS.accentSoft }}>
                  <mod.icon size={14} style={{ color: DS.accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: DS.ink }}>{mod.label}</p>
                  <p className="text-[10px]" style={{ color: DS.inkSub }}>{mod.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onBack} className="text-xs gap-1">
            <ChevronLeft size={14} /> Back
          </Button>
          <Button size="sm" className="text-xs gap-2" style={{ background: '#C9A84C' }} onClick={handleLoad}>
            <Sparkles size={14} /> Load Example Session
          </Button>
        </div>
      </div>
    </div>
  );
}

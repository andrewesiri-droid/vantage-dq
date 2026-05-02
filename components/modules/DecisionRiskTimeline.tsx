import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, Plus, Trash2, AlertTriangle, Shield, TrendingUp } from 'lucide-react';

interface RiskItem { id: number; label: string; likelihood: string; impact: string; timeframe: string; owner: string; mitigation: string; }

const DEMO_RISKS: RiskItem[] = [
  { id: 1, label: 'Regulatory rejection in Japan', likelihood: 'Medium', impact: 'Critical', timeframe: 'Months 3-6', owner: 'Legal', mitigation: 'Engage regulatory consultant early. Pre-submission meeting.' },
  { id: 2, label: 'Partner fails to deliver', likelihood: 'Medium', impact: 'High', timeframe: 'Months 6-12', owner: 'CSO', mitigation: 'Contractual milestones with exit clauses.' },
  { id: 3, label: 'FX volatility erodes returns', likelihood: 'High', impact: 'Medium', timeframe: 'Months 1-18', owner: 'CFO', mitigation: 'Hedge 70% of committed capital.' },
  { id: 4, label: 'Competitor price war', likelihood: 'Low', impact: 'High', timeframe: 'Months 12-24', owner: 'CEO', mitigation: 'Differentiate on service quality.' },
  { id: 5, label: 'Talent acquisition failure', likelihood: 'Medium', impact: 'Medium', timeframe: 'Months 6-9', owner: 'COO', mitigation: 'Use partner GTM initially.' },
  { id: 6, label: 'Technology integration delays', likelihood: 'High', impact: 'Medium', timeframe: 'Months 3-9', owner: 'CTO', mitigation: 'Architecture review before commit.' },
];

export function DecisionRiskTimeline({ sessionId, data, hooks }: ModuleProps) {
  const [risks, setRisks] = useState<RiskItem[]>(DEMO_RISKS);
  const [newLabel, setNewLabel] = useState('');
  const [newLikelihood, setNewLikelihood] = useState('Medium');
  const [newImpact, setNewImpact] = useState('High');

  useEffect(() => {
    if (data?.riskItems && data.riskItems.length > 0) {
      setRisks(data.riskItems.map((r: any) => ({
        id: r.id, label: r.label, likelihood: r.likelihood, impact: r.impact,
        timeframe: r.timeframe || '', owner: r.owner || '', mitigation: r.mitigation || '',
      })));
    }
  }, [data?.riskItems]);

  const addRisk = () => {
    if (!newLabel.trim() || !sessionId) return;
    const newR: RiskItem = { id: Date.now(), label: newLabel.trim(), likelihood: newLikelihood, impact: newImpact, timeframe: '', owner: '', mitigation: '' };
    setRisks(p => [...p, newR]);
    hooks?.createRisk?.({ sessionId, label: newLabel.trim(), likelihood: newLikelihood, impact: newImpact });
    setNewLabel('');
  };

  const deleteRisk = (id: number) => {
    setRisks(p => p.filter(r => r.id !== id));
    hooks?.deleteRisk?.({ id });
  };

  const score = (r: RiskItem) => {
    const l: Record<string, number> = { Low: 1, Medium: 2, High: 3 };
    const i: Record<string, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };
    return (l[r.likelihood] || 1) * (i[r.impact] || 1);
  };

  const sorted = [...risks].sort((a, b) => score(b) - score(a));
  const criticalCount = risks.filter(r => r.impact === 'Critical').length;
  const highCount = risks.filter(r => r.impact === 'High').length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
          <Clock size={22} style={{ color: '#DB2777' }} /> Decision Risk Timeline
        </h2>
        <p className="text-xs mt-1" style={{ color: DS.inkSub }}>{risks.length} risks &middot; {criticalCount} critical &middot; {highCount} high</p>
      </div>
      <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, #FFF1F2 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid #E11D48` }}>
        <CardContent className="pt-4 space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Risk description" className="text-xs bg-white" />
            <Select value={newLikelihood} onValueChange={setNewLikelihood}><SelectTrigger className="text-[10px] h-8 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Low" className="text-xs">Low Likelihood</SelectItem><SelectItem value="Medium" className="text-xs">Medium</SelectItem><SelectItem value="High" className="text-xs">High</SelectItem></SelectContent></Select>
            <Select value={newImpact} onValueChange={setNewImpact}><SelectTrigger className="text-[10px] h-8 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Low" className="text-xs">Low Impact</SelectItem><SelectItem value="Medium" className="text-xs">Medium</SelectItem><SelectItem value="High" className="text-xs">High</SelectItem><SelectItem value="Critical" className="text-xs">Critical</SelectItem></SelectContent></Select>
            <Button size="sm" className="h-8" style={{ background: '#E11D48' }} onClick={addRisk} disabled={!newLabel.trim()}><Plus size={12} /></Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="pt-4 text-center">
          <div className="text-2xl font-bold" style={{ color: criticalCount > 0 ? '#DC2626' : '#059669' }}>{criticalCount}</div>
          <p className="text-[10px]" style={{ color: DS.inkTer }}>Critical Risks</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="pt-4 text-center">
          <Shield size={16} className="mx-auto mb-1" style={{ color: DS.accent }} />
          <p className="text-[10px] font-medium" style={{ color: DS.ink }}>Risk-Adjusted Readiness</p>
          <p className="text-[10px]" style={{ color: DS.inkSub }}>{criticalCount === 0 ? 'Proceed with confidence' : 'Address critical risks first'}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="pt-4 text-center">
          <TrendingUp size={16} className="mx-auto mb-1" style={{ color: DS.information.fill }} />
          <p className="text-[10px] font-medium" style={{ color: DS.ink }}>Avg Risk Score</p>
          <p className="text-lg font-bold" style={{ color: DS.ink }}>{risks.length > 0 ? (risks.reduce((a, r) => a + score(r), 0) / risks.length).toFixed(1) : '—'}</p>
        </CardContent></Card>
      </div>

      <div className="space-y-2">
        {sorted.map(risk => {
          const s = score(risk);
          const color = s >= 9 ? '#DC2626' : s >= 6 ? '#F59E0B' : s >= 3 ? '#3B82F6' : '#059669';
          return (
            <Card key={risk.id} className="overflow-hidden border-0 shadow-sm"><CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + '15' }}>
                  <AlertTriangle size={14} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: DS.ink }}>{risk.label}</span>
                    <Badge style={{ background: color + '15', color }} variant="outline" className="text-[9px] h-4">Score: {s}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px]" style={{ color: DS.inkTer }}>
                    <span>Likelihood: <span style={{ color }}>{risk.likelihood}</span></span>
                    <span>Impact: <span style={{ color }}>{risk.impact}</span></span>
                    <span>Timeframe: {risk.timeframe || '—'}</span>
                    <span>Owner: {risk.owner || '—'}</span>
                  </div>
                  {risk.mitigation && <p className="text-[10px] mt-1.5 p-1.5 rounded" style={{ background: DS.bg, color: DS.inkSub }}><strong>Mitigation:</strong> {risk.mitigation}</p>}
                </div>
                <button onClick={() => deleteRisk(risk.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
              </div>
            </CardContent></Card>
          );
        })}
      </div>
    </div>
  );
}

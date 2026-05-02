import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS, H_TIERS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GitBranch, Plus, Trash2, Lock, Star, PauseCircle, BrainCircuit, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';

interface DecisionItem { id: number; label: string; choices: string[]; tier: string; owner: string; rationale: string; }

const TIER_ICONS: Record<string, typeof Lock> = { given: Lock, focus: Star, deferred: PauseCircle };

const DEMO_DECISIONS: DecisionItem[] = [
  { id: 1, label: 'Proceed with APAC expansion', choices: ['Yes — board mandate confirmed'], tier: 'given', owner: 'Board', rationale: 'Board-approved in FY25 strategic plan' },
  { id: 2, label: 'Maximum Year 1 capital budget', choices: ['$25M ceiling — non-negotiable'], tier: 'given', owner: 'CFO', rationale: 'Capital ceiling set by board' },
  { id: 3, label: 'Market Entry Mode', choices: ['Direct subsidiary', 'Strategic partnership', 'Acquire local player', 'Agent / reseller'], tier: 'focus', owner: 'CSO', rationale: 'Most consequential variable' },
  { id: 4, label: 'Geographic Priority', choices: ['Singapore first', 'Japan first', 'Australia first', 'Multi-market simultaneous'], tier: 'focus', owner: 'CEO', rationale: 'Sets operational blueprint' },
  { id: 5, label: 'Investment Level Year 1', choices: ['$10M conservative', '$20M base case', '$25M aggressive (cap)'], tier: 'focus', owner: 'CFO', rationale: 'Choices within board-set ceiling' },
  { id: 6, label: 'Technology Localisation', choices: ['Build in-house', 'License local tech', 'Partner with regional SaaS'], tier: 'focus', owner: 'CTO', rationale: 'Critical path for 12-month entry' },
  { id: 7, label: 'Long-term Ownership Model', choices: ['Wholly-owned', 'JV 50/50', 'Majority-owned JV'], tier: 'deferred', owner: 'Legal', rationale: 'Depends on entry mode chosen' },
  { id: 8, label: 'Brand Strategy in APAC', choices: ['Global brand', 'Co-brand', 'Standalone local brand'], tier: 'deferred', owner: 'CMO', rationale: 'Flows from partnership model' },
  { id: 9, label: 'Regional HQ Location', choices: ['Singapore', 'Hong Kong', 'Sydney'], tier: 'deferred', owner: 'COO', rationale: 'Defer pending regulatory clarity' },
];

export function DecisionHierarchy({ sessionId, data, hooks }: ModuleProps) {
  const [decisions, setDecisions] = useState<DecisionItem[]>(DEMO_DECISIONS);
  const [newLabel, setNewLabel] = useState('');
  const [newTier, setNewTier] = useState('focus');
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (data?.decisions && data.decisions.length > 0) {
      setDecisions(data.decisions.map((d: any) => ({
        id: d.id, label: d.label, choices: d.choices || [], tier: d.tier, owner: d.owner || '', rationale: d.rationale || '',
      })));
    }
  }, [data?.decisions]);

  const focusCount = decisions.filter(d => d.tier === 'focus').length;

  const addDecision = () => {
    if (!newLabel.trim() || !sessionId) return;
    const newD: DecisionItem = { id: Date.now(), label: newLabel.trim(), choices: ['Option A', 'Option B'], tier: newTier, owner: '', rationale: '' };
    setDecisions(prev => [...prev, newD]);
    hooks?.createDecision?.({ sessionId, label: newLabel.trim(), choices: ['Option A', 'Option B'], tier: newTier });
    setNewLabel('');
  };

  const remove = (id: number) => {
    setDecisions(prev => prev.filter(d => d.id !== id));
    hooks?.deleteDecision?.({ id });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
            <GitBranch size={22} style={{ color: DS.accent }} /> Decision Hierarchy
          </h2>
          <p className="text-xs mt-1" style={{ color: DS.inkSub }}>{decisions.length} decisions &middot; {focusCount}/5 focus &middot; {decisions.filter(d => d.tier === 'given').length} given &middot; {decisions.filter(d => d.tier === 'deferred').length} deferred</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-[10px] gap-1" onClick={() => setAiOpen(!aiOpen)}>
          <BrainCircuit size={12} /> {aiOpen ? 'Hide AI' : 'AI Analysis'}
        </Button>
      </div>

      {/* AI Panel */}
      {aiOpen && (
        <Card className="border-0 shadow-md" style={{ background: `linear-gradient(135deg, #F5F3FF 0%, #FFFFFF 100%)`, borderLeft: `4px solid #7C3AED` }}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2"><BrainCircuit size={14} style={{ color: '#7C3AED' }} /><span className="text-xs font-bold" style={{ color: '#6D28D9' }}>AI Structure Analysis</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {focusCount > 5 ? (
                <div className="p-2.5 rounded-lg" style={{ background: '#FEF2F2' }}>
                  <p className="text-[10px] font-semibold" style={{ color: '#DC2626' }}><AlertTriangle size={10} className="inline mr-1" /> Focus Five Exceeded</p>
                  <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>{focusCount} focus decisions exceeds the recommended 5. Cognitive overload risk. Consider deferring lower-priority decisions.</p>
                </div>
              ) : focusCount === 5 ? (
                <div className="p-2.5 rounded-lg" style={{ background: '#ECFDF5' }}>
                  <p className="text-[10px] font-semibold" style={{ color: '#059669' }}><CheckCircle2 size={10} className="inline mr-1" /> Focus Five Full</p>
                  <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>Exactly 5 focus decisions. At capacity — any new focus decision should trigger a deferral.</p>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg" style={{ background: '#F0FDFA' }}>
                  <p className="text-[10px] font-semibold" style={{ color: '#059669' }}><CheckCircle2 size={10} className="inline mr-1" /> Focus Capacity Available</p>
                  <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>{5 - focusCount} slots remaining in Focus Five. Ensure all focus decisions have defined choices.</p>
                </div>
              )}
              <div className="p-2.5 rounded-lg" style={{ background: '#FFFBEB' }}>
                <p className="text-[10px] font-semibold" style={{ color: '#D97706' }}><Lightbulb size={10} className="inline mr-1" /> Recommendation</p>
                <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>{decisions.filter(d => d.tier === 'focus' && d.choices.length < 2).length} focus decisions have fewer than 2 choices. Add alternatives to enable meaningful trade-offs.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="flex-1 h-2 rounded-full transition-all" style={{ background: i < focusCount ? DS.accent : DS.borderLight }} />
        ))}
        <span className="text-[10px] font-bold ml-1" style={{ color: focusCount >= 5 ? DS.danger : DS.accent }}>{focusCount}/5</span>
      </div>

      <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${DS.accentSoft} 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid ${DS.accent}` }}>
        <CardContent className="pt-4 flex gap-2">
          <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="New decision label" className="text-xs bg-white flex-1" />
          <Select value={newTier} onValueChange={setNewTier}>
            <SelectTrigger className="w-[140px] h-8 text-[10px] bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>{H_TIERS.map(t => <SelectItem key={t.key} value={t.key} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" className="h-8 gap-1" style={{ background: DS.accent }} onClick={addDecision} disabled={!newLabel.trim() || (newTier === 'focus' && focusCount >= 5)}><Plus size={12} /></Button>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {H_TIERS.map(tier => {
          const tierDecisions = decisions.filter(d => d.tier === tier.key);
          if (tierDecisions.length === 0) return null;
          const Icon = TIER_ICONS[tier.key];
          return (
            <div key={tier.key}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: tier.soft }}>
                  <Icon size={14} style={{ color: tier.color }} />
                </div>
                <span className="text-xs font-bold" style={{ color: tier.color }}>{tier.label}</span>
                <Badge style={{ background: tier.soft, color: tier.color, borderColor: tier.line }} variant="outline" className="text-[9px] h-4">{tierDecisions.length}</Badge>
                {'cap' in tier && <span className="text-[10px] ml-auto font-bold" style={{ color: focusCount >= (tier.cap || 5) ? DS.danger : tier.color }}>{focusCount}/{tier.cap} Focus Five</span>}
              </div>
              <div className="space-y-2">
                {tierDecisions.map(d => (
                  <Card key={d.id} className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold" style={{ color: DS.ink }}>{d.label}</span>
                            <Badge style={{ background: tier.soft, color: tier.color, borderColor: tier.line }} variant="outline" className="text-[9px] h-4">{tier.shortLabel}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {d.choices.map((c, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: tier.soft, color: tier.dark }}>{c}</span>)}
                          </div>
                          <p className="text-[10px] mt-1.5" style={{ color: DS.inkTer }}>Owner: {d.owner || '—'}{d.rationale && ` · ${d.rationale}`}</p>
                        </div>
                        <button onClick={() => remove(d.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={12} /></button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Info, Plus, Trash2, Sparkles, CheckCircle, XCircle, TrendingUp } from 'lucide-react';

interface VOIItem { id: number; name: string; prior: number; vBest: number; vWorst: number; cost: number; evpi: number; evsi: number; classification?: string; bestAction?: string; }

const calcEVPI = (prior: number, vBest: number, vWorst: number) => Math.max(0, prior * (vBest - vWorst));
const calcEVSI = (prior: number, vBest: number, vWorst: number, cost: number) => Math.max(0, calcEVPI(prior, vBest, vWorst) * 0.7 - cost);

export function ValueOfInformation({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [analyses, setAnalyses] = useState<VOIItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newPrior, setNewPrior] = useState('0.5');
  const [newVBest, setNewVBest] = useState('');
  const [newVWorst, setNewVWorst] = useState('');
  const [newCost, setNewCost] = useState('');
  const [portfolio, setPortfolio] = useState<any>(null);

  useEffect(() => {
    if (data?.voiAnalyses?.length) {
      setAnalyses(data.voiAnalyses.map((a: any) => ({
        id: a.id, name: a.name, prior: a.priorProbability || 0.5, vBest: a.valueWithInfo || 0, vWorst: a.valueWithoutInfo || 0, cost: a.costOfInfo || 0,
        evpi: a.voiResult || calcEVPI(a.priorProbability || 0.5, a.valueWithInfo || 0, a.valueWithoutInfo || 0),
        evsi: (a.voiResult || 0) - (a.costOfInfo || 0), classification: a.classification || '', bestAction: a.bestAction || '',
      })));
    }
  }, [data?.voiAnalyses]);

  const add = () => {
    if (!newName.trim()) return;
    const prior = parseFloat(newPrior) || 0.5;
    const vBest = parseFloat(newVBest) || 0;
    const vWorst = parseFloat(newVWorst) || 0;
    const cost = parseFloat(newCost) || 0;
    const evpi = calcEVPI(prior, vBest, vWorst);
    const evsi = calcEVSI(prior, vBest, vWorst, cost);
    const n: VOIItem = { id: Date.now(), name: newName.trim(), prior, vBest, vWorst, cost, evpi, evsi };
    setAnalyses(p => [...p, n]);
    hooks?.createVOI?.({ sessionId, name: newName.trim(), priorProbability: prior, valueWithInfo: vBest, valueWithoutInfo: vWorst, costOfInfo: cost, voiResult: evpi });
    setNewName(''); setNewVBest(''); setNewVWorst(''); setNewCost('');
  };

  const remove = (id: number) => { setAnalyses(p => p.filter(a => a.id !== id)); hooks?.deleteVOI?.({ id }); };

  const aiAnalyse = () => {
    const uncs = (data?.uncertainties || []).map((u: any) => `${u.label} [impact=${u.impact}]`).join(', ');
    const existing = analyses.map(a => a.name).join(', ');
    const prompt = `Conduct a Value of Information analysis for this decision.\nDecision: ${data?.session?.decisionStatement || ''}\nKey uncertainties: ${uncs}\nExisting analyses: ${existing}\n\nFor each key uncertainty estimate whether resolving it would change the decision.\n\nReturn JSON with key: assessments (array of {label, isDecisionCritical (boolean), classification (do_now/do_not/timing_dependent), bestAction (string), timeToLearn (string), estimatedEVPI (number), costRange (string)}), portfolioInsight (string), priorityOrder (array of labels).`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
      if (result?.assessments?.length) {
        const newItems: VOIItem[] = result.assessments.map((a: any, i: number) => ({
          id: Date.now() + i, name: a.label, prior: 0.5, vBest: a.estimatedEVPI ? a.estimatedEVPI * 1.5 : 30, vWorst: 15, cost: 2, evpi: a.estimatedEVPI || 10, evsi: (a.estimatedEVPI || 10) - 2, classification: a.classification, bestAction: a.bestAction,
        }));
        setAnalyses(p => [...p, ...newItems.filter(n => !p.some(e => e.name === n.name))]);
        setPortfolio(result);
      }
    });
  };

  const sorted = [...analyses].sort((a, b) => b.evsi - a.evsi);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}><Info size={22} style={{ color: DS.information.fill }} /> Value of Information</h2>
          <p className="text-xs mt-1" style={{ color: DS.inkSub }}>{analyses.length} analyses · Prioritise what to learn before committing</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" style={{ background: DS.information.fill }} onClick={aiAnalyse} disabled={busy}><Sparkles size={12} /> AI Analyse</Button>
      </div>

      {/* Portfolio insight */}
      {portfolio && (
        <Card className="border-0 shadow-sm" style={{ borderLeft: `4px solid ${DS.information.fill}` }}>
          <CardContent className="pt-3 pb-3 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>Portfolio Insight</div>
            {portfolio.portfolioInsight && <p className="text-xs" style={{ color: DS.inkSub }}>{portfolio.portfolioInsight}</p>}
            {portfolio.priorityOrder?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {portfolio.priorityOrder.slice(0, 5).map((label: string, i: number) => (
                  <Badge key={i} style={{ background: DS.information.soft, color: DS.information.dark, border: 'none' }}>#{i+1} {label.slice(0, 30)}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add analysis */}
      <Card className="border-0 shadow-sm" style={{ borderLeft: `4px solid ${DS.information.fill}`, background: DS.information.soft }}>
        <CardContent className="pt-3 pb-3 space-y-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Uncertainty / study name" className="text-xs bg-white h-8" />
          <div className="grid grid-cols-4 gap-2">
            <div><label className="text-[9px] font-bold" style={{ color: DS.inkDis }}>PRIOR PROB</label><Input type="number" value={newPrior} onChange={e => setNewPrior(e.target.value)} min="0" max="1" step="0.1" className="text-xs bg-white h-7 mt-0.5" /></div>
            <div><label className="text-[9px] font-bold" style={{ color: DS.inkDis }}>V. WITH INFO ($M)</label><Input type="number" value={newVBest} onChange={e => setNewVBest(e.target.value)} placeholder="45" className="text-xs bg-white h-7 mt-0.5" /></div>
            <div><label className="text-[9px] font-bold" style={{ color: DS.inkDis }}>V. WITHOUT ($M)</label><Input type="number" value={newVWorst} onChange={e => setNewVWorst(e.target.value)} placeholder="25" className="text-xs bg-white h-7 mt-0.5" /></div>
            <div><label className="text-[9px] font-bold" style={{ color: DS.inkDis }}>COST ($M)</label><Input type="number" value={newCost} onChange={e => setNewCost(e.target.value)} placeholder="2" className="text-xs bg-white h-7 mt-0.5" /></div>
          </div>
          <Button size="sm" className="h-7 gap-1 text-xs" style={{ background: DS.information.fill }} onClick={add} disabled={!newName.trim()}><Plus size={11} /> Add Analysis</Button>
        </CardContent>
      </Card>

      {/* VoI table */}
      {sorted.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>Prioritised by EVSI</div>
          {sorted.map((a, rank) => {
            const doNow = a.evsi > 0 && a.classification !== 'do_not';
            const classColor = a.classification === 'do_now' ? DS.success : a.classification === 'do_not' ? DS.danger : DS.warning;
            return (
              <Card key={a.id} className="border-0 shadow-sm">
                <CardContent className="pt-2.5 pb-2.5">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: doNow ? DS.information.fill : DS.inkDis }}>#{rank+1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs font-semibold" style={{ color: DS.ink }}>{a.name}</span>
                        {doNow ? <CheckCircle size={12} style={{ color: DS.success }} /> : <XCircle size={12} style={{ color: DS.danger }} />}
                        {a.classification && <Badge style={{ background: `${classColor}20`, color: classColor, border: 'none' }}>{a.classification.replace('_', ' ')}</Badge>}
                      </div>
                      <div className="flex gap-4 text-[10px]" style={{ color: DS.inkSub }}>
                        <span>EVPI: <strong style={{ color: DS.information.fill }}>${a.evpi.toFixed(1)}M</strong></span>
                        <span>EVSI: <strong style={{ color: a.evsi > 0 ? DS.success : DS.danger }}>${a.evsi.toFixed(1)}M</strong></span>
                        <span>Cost: <strong>${a.cost.toFixed(1)}M</strong></span>
                      </div>
                      {a.bestAction && <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>→ {a.bestAction}</p>}
                    </div>
                    <button onClick={() => remove(a.id)} className="shrink-0"><Trash2 size={11} style={{ color: DS.inkDis }} /></button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

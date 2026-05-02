import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Info, Plus, Trash2, Calculator, CheckCircle, XCircle } from 'lucide-react';

interface VOIItem { id: number; name: string; prior: number; vBest: number; vWorst: number; cost: number; evpi: number; evsi: number; }

const DEMO_VOI: VOIItem[] = [
  { id: 1, name: 'APAC Market Research Study', prior: 0.18, vBest: 45, vWorst: 25, cost: 3, evpi: 20, evsi: 14.2 },
  { id: 2, name: 'Japan Regulatory Consultation', prior: 0.5, vBest: 30, vWorst: 15, cost: 2, evpi: 15, evsi: 10.5 },
  { id: 3, name: 'Partner Due Diligence', prior: 0.4, vBest: 35, vWorst: 20, cost: 1.5, evpi: 15, evsi: 11.8 },
];

export function ValueOfInformation({ sessionId, data, hooks }: ModuleProps) {
  const [analyses, setAnalyses] = useState<VOIItem[]>(DEMO_VOI);
  const [newName, setNewName] = useState('');
  const [newPrior, setNewPrior] = useState('0.5');
  const [newVBest, setNewVBest] = useState('');
  const [newVWorst, setNewVWorst] = useState('');
  const [newCost, setNewCost] = useState('');

  useEffect(() => {
    if (data?.voiAnalyses && data.voiAnalyses.length > 0) {
      setAnalyses(data.voiAnalyses.map((a: any) => ({
        id: a.id, name: a.name, prior: a.priorProbability || 0.5,
        vBest: a.valueWithInfo || 0, vWorst: a.valueWithoutInfo || 0,
        cost: a.costOfInfo || 0, evpi: a.voiResult || 0, evsi: (a.voiResult || 0) - (a.costOfInfo || 0),
      })));
    }
  }, [data?.voiAnalyses]);

  const calcEVSI = (prior: number, vBest: number, vWorst: number, cost: number) => {
    const evpi = Math.max(0, vBest - vWorst);
    const evsi = Math.max(0, evpi * 0.7 - cost);
    return { evpi, evsi };
  };

  const add = () => {
    if (!newName.trim() || !newVBest || !newVWorst || !sessionId) return;
    const prior = parseFloat(newPrior) || 0.5;
    const vw = parseFloat(newVBest);
    const vwo = parseFloat(newVWorst);
    const cost = parseFloat(newCost) || 0;
    const { evpi, evsi } = calcEVSI(prior, vw, vwo, cost);
    const newA: VOIItem = { id: Date.now(), name: newName.trim(), prior, vBest: vw, vWorst: vwo, cost, evpi, evsi };
    setAnalyses(p => [...p, newA]);
    hooks?.createVOI?.({ sessionId, name: newName.trim(), priorProbability: prior, valueWithInfo: vw, valueWithoutInfo: vwo, costOfInfo: cost, voiResult: evpi });
    setNewName(''); setNewVBest(''); setNewVWorst(''); setNewCost('');
  };

  const remove = (id: number) => {
    setAnalyses(p => p.filter(a => a.id !== id));
    hooks?.deleteVOI?.({ id });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
          <Info size={22} style={{ color: '#0891B2' }} /> Value of Information
        </h2>
        <p className="text-xs mt-1" style={{ color: DS.inkSub }}>Calculate EVPI and EVSI to prioritise information gathering</p>
      </div>
      <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, #ECFEFF 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid #0891B2` }}>
        <CardContent className="pt-4 space-y-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Analysis name" className="text-xs bg-white" />
          <div className="grid grid-cols-4 gap-2">
            <Input type="number" step={0.05} min={0} max={1} value={newPrior} onChange={e => setNewPrior(e.target.value)} placeholder="Prior P" className="text-xs bg-white" />
            <Input type="number" value={newVBest} onChange={e => setNewVBest(e.target.value)} placeholder="Value with info ($M)" className="text-xs bg-white" />
            <Input type="number" value={newVWorst} onChange={e => setNewVWorst(e.target.value)} placeholder="Value without ($M)" className="text-xs bg-white" />
            <Input type="number" value={newCost} onChange={e => setNewCost(e.target.value)} placeholder="Cost ($M)" className="text-xs bg-white" />
          </div>
          <Button size="sm" style={{ background: '#0891B2' }} onClick={add} disabled={!newName.trim() || !newVBest || !newVWorst}><Plus size={12} /> Calculate</Button>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {analyses.map(a => (
          <Card key={a.id} className="overflow-hidden border-0 shadow-md"><CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold" style={{ color: DS.ink }}>{a.name}</span>
              <button onClick={() => remove(a.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={10} /></button>
            </div>
            <div className="space-y-1.5">
              {[{ l: 'Prior Probability', v: `${(a.prior * 100).toFixed(0)}%`, c: '#0891B2' }, { l: 'Value With Info', v: `$${a.vBest}M`, c: '#059669' }, { l: 'Value Without', v: `$${a.vWorst}M`, c: '#64748B' }, { l: 'EVPI', v: `$${a.evpi.toFixed(1)}M`, c: '#2563EB' }, { l: 'EVSI', v: `$${a.evsi.toFixed(1)}M`, c: a.evsi > a.cost ? '#059669' : '#DC2626' }].map(item => (
                <div key={item.l} className="flex justify-between text-xs"><span style={{ color: DS.inkTer }}>{item.l}</span><span className="font-bold" style={{ color: item.c }}>{item.v}</span></div>
              ))}
              <Badge style={{ background: a.evsi > a.cost ? '#ECFDF5' : '#FEF2F2', color: a.evsi > a.cost ? '#059669' : '#DC2626' }} variant="outline" className="text-[10px] w-full justify-center mt-2 h-5">
                {a.evsi > a.cost ? <><CheckCircle size={10} className="mr-1" /> Worth the investment</> : <><XCircle size={10} className="mr-1" /> Not worth the cost</>}
              </Badge>
            </div>
          </CardContent></Card>
        ))}
      </div>
      <Card className="border-0 shadow-sm"><CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-2"><Calculator size={14} style={{ color: '#0891B2' }} /><span className="text-xs font-bold" style={{ color: DS.ink }}>Methodology</span></div>
        <div className="space-y-1 text-xs" style={{ color: DS.inkSub }}>
          <p><strong>EVPI</strong> = Value with perfect information − Value without information</p>
          <p><strong>EVSI</strong> = Expected value with study − Value without info − Cost of study</p>
          <p className="mt-2 font-medium" style={{ color: '#0891B2' }}>A study is worth conducting when EVSI {'>'} Cost of Information</p>
        </div>
      </CardContent></Card>
    </div>
  );
}

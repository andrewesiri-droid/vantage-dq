import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Compass, Plus, Trash2 } from 'lucide-react';

interface ScenItem { id: number; name: string; description: string; probability: number; drivers: string[]; color: string; }

const DEMO_SCENARIOS: ScenItem[] = [
  { id: 1, name: 'Bull Case — Rapid Adoption', description: 'APAC markets embrace solution faster than forecast. Strong partnerships and limited competitive response.', probability: 0.25, drivers: ['Low competitive response', 'Strong partner execution', 'Favourable regulatory'], color: '#059669' },
  { id: 2, name: 'Base Case — Measured Growth', description: 'Steady market entry with moderate competitive pressure. Partnership model delivers as planned.', probability: 0.50, drivers: ['Moderate competition', 'On-time execution', 'Stable FX'], color: '#2563EB' },
  { id: 3, name: 'Bear Case — Stalled Entry', description: 'Regulatory delays, strong competitive response, and partner underperformance stall growth.', probability: 0.25, drivers: ['Aggressive competition', 'Regulatory delays', 'Partner issues'], color: '#DC2626' },
];

const SCENARIO_COLORS = ['#7C3AED', '#0891B2', '#D97706', '#DB2777', '#059669', '#2563EB'];

export function ScenarioPlanning({ sessionId, data, hooks }: ModuleProps) {
  const [scenarios, setScenarios] = useState<ScenItem[]>(DEMO_SCENARIOS);
  const [newName, setNewName] = useState('');
  const [newProb, setNewProb] = useState('0.33');

  useEffect(() => {
    if (data?.scenarios && data.scenarios.length > 0) {
      setScenarios(data.scenarios.map((s: any) => ({
        id: s.id, name: s.name, description: s.description || '',
        probability: s.probability || 0.33, drivers: s.drivers || [],
        color: s.color || SCENARIO_COLORS[0],
      })));
    }
  }, [data?.scenarios]);

  const addScen = () => {
    if (!newName.trim() || !sessionId) return;
    const newS: ScenItem = { id: Date.now(), name: newName.trim(), description: '', probability: parseFloat(newProb) || 0.33, drivers: [], color: SCENARIO_COLORS[scenarios.length % SCENARIO_COLORS.length] };
    setScenarios(p => [...p, newS]);
    hooks?.createScenario?.({ sessionId, name: newName.trim(), probability: parseFloat(newProb) || 0.33 });
    setNewName('');
  };

  const removeScen = (id: number) => {
    setScenarios(p => p.filter(s => s.id !== id));
    hooks?.deleteScenario?.({ id });
  };

  const totalProb = scenarios.reduce((a, s) => a + s.probability, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
          <Compass size={22} style={{ color: DS.reasoning.fill }} /> Scenario Planning
        </h2>
        <p className="text-xs mt-1" style={{ color: DS.inkSub }}>{scenarios.length} scenarios &middot; Total probability: {(totalProb * 100).toFixed(0)}%</p>
      </div>
      <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${DS.reasoning.soft} 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid ${DS.reasoning.fill}` }}>
        <CardContent className="pt-4 flex gap-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Scenario name" className="text-xs bg-white flex-1" />
          <Input type="number" min={0} max={1} step={0.05} value={newProb} onChange={e => setNewProb(e.target.value)} placeholder="Probability" className="text-xs bg-white w-24" />
          <Button size="sm" style={{ background: DS.reasoning.fill }} onClick={addScen} disabled={!newName.trim()}><Plus size={12} /></Button>
        </CardContent>
      </Card>

      <div className="h-5 rounded-full overflow-hidden flex shadow-inner" style={{ background: DS.borderLight }}>
        {scenarios.map(s => <div key={s.id} className="h-full flex items-center justify-center text-[9px] text-white font-bold transition-all" style={{ width: `${totalProb > 0 ? (s.probability / totalProb) * 100 : 0}%`, background: s.color }}>{s.name.slice(0, 10)}</div>)}
      </div>
      {Math.abs(totalProb - 1) > 0.01 && <p className="text-[10px]" style={{ color: totalProb > 1 ? '#DC2626' : '#D97706' }}>Probabilities sum to {(totalProb * 100).toFixed(0)}% (should be 100%)</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {scenarios.map(s => (
          <Card key={s.id} className="overflow-hidden border-0 shadow-md"><div className="h-1.5" style={{ background: s.color }} /><CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold" style={{ color: DS.ink }}>{s.name}</span>
              <div className="flex items-center gap-1">
                <Badge style={{ background: s.color + '15', color: s.color }} variant="outline" className="text-[10px] h-4">{(s.probability * 100).toFixed(0)}%</Badge>
                <button onClick={() => removeScen(s.id)} className="text-gray-400 hover:text-red-500 ml-1"><Trash2 size={10} /></button>
              </div>
            </div>
            <p className="text-xs mb-3" style={{ color: DS.inkSub }}>{s.description}</p>
            <div className="space-y-1">{(s.drivers || []).map((d, i) => <div key={i} className="flex items-center gap-1"><span style={{ color: s.color }}>•</span><span className="text-[10px]" style={{ color: DS.inkSub }}>{d}</span></div>)}</div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}

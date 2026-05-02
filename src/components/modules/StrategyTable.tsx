import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table2, Plus, Trash2, Layers, CheckCircle } from 'lucide-react';

interface StrategyItem { id: number; name: string; description: string; colorIdx: number; selections: Record<string, number>; }

const DEMO_STRATEGIES: StrategyItem[] = [
  { id: 1, name: 'Alpha', description: 'Full commitment — direct subsidiary build. Maximum control, maximum capital.', colorIdx: 0, selections: {} },
  { id: 2, name: 'Beta', description: 'Asset-light — strategic partnership model. Balanced risk and speed.', colorIdx: 1, selections: {} },
  { id: 3, name: 'Gamma', description: 'Aggressive M&A — acquire to enter fast. Highest speed, highest risk.', colorIdx: 2, selections: {} },
];

export function StrategyTable({ sessionId, data, hooks }: ModuleProps) {
  const [strategies, setStrategies] = useState<StrategyItem[]>(DEMO_STRATEGIES);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const focusDecisions = (data?.decisions || []).filter((d: any) => d.tier === 'focus').map((d: any) => ({
    id: String(d.id), label: d.label, choices: d.choices || ['Option A', 'Option B'],
  }));

  useEffect(() => {
    if (data?.strategies && data.strategies.length > 0) {
      setStrategies(data.strategies.map((s: any) => ({
        id: s.id, name: s.name, description: s.description || '', colorIdx: s.colorIdx || 0,
        selections: s.selections || {},
      })));
    }
  }, [data?.strategies]);

  const addStrategy = () => {
    if (!newName.trim() || !sessionId) return;
    const newS: StrategyItem = { id: Date.now(), name: newName.trim(), description: newDesc, colorIdx: strategies.length % 6, selections: {} };
    setStrategies(p => [...p, newS]);
    hooks?.createStrategy?.({ sessionId, name: newName.trim(), description: newDesc });
    setNewName(''); setNewDesc('');
  };

  const updateSelection = (sid: number, did: string, idx: number) => {
    setStrategies(p => p.map(s => s.id === sid ? { ...s, selections: { ...s.selections, [did]: idx } } : s));
  };

  const removeStrategy = (id: number) => {
    setStrategies(p => p.filter(s => s.id !== id));
    hooks?.deleteStrategy?.({ id });
  };

  const completeness = (s: StrategyItem) => {
    const f = focusDecisions.filter((d: any) => s.selections[d.id] !== undefined).length;
    return { filled: f, total: focusDecisions.length, pct: focusDecisions.length ? Math.round((f / focusDecisions.length) * 100) : 0 };
  };

  const distinctiveness = () => {
    if (strategies.length < 2) return [];
    const diffs: { pair: string; diffCount: number; total: number }[] = [];
    for (let i = 0; i < strategies.length; i++) {
      for (let j = i + 1; j < strategies.length; j++) {
        let diffCount = 0;
        focusDecisions.forEach((d: any) => { if (strategies[i].selections[d.id] !== strategies[j].selections[d.id]) diffCount++; });
        diffs.push({ pair: `${strategies[i].name} vs ${strategies[j].name}`, diffCount, total: focusDecisions.length });
      }
    }
    return diffs;
  };

  const sColors = [
    { fill: '#C9A84C', soft: '#FDF8E8', dark: '#8B6914' },
    { fill: '#2563EB', soft: '#EFF6FF', dark: '#1D4ED8' },
    { fill: '#059669', soft: '#ECFDF5', dark: '#047857' },
    { fill: '#DC2626', soft: '#FEF2F2', dark: '#B91C1C' },
    { fill: '#7C3AED', soft: '#F5F3FF', dark: '#5B21B6' },
    { fill: '#0891B2', soft: '#ECFEFF', dark: '#0E7490' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
          <Table2 size={22} style={{ color: DS.alternatives.fill }} /> Strategy Table
        </h2>
        <p className="text-xs mt-1" style={{ color: DS.inkSub }}>{strategies.length} strategies &middot; {focusDecisions.length} focus decisions</p>
      </div>

      <Tabs defaultValue="builder">
        <TabsList className="text-[10px]">
          <TabsTrigger value="builder" className="text-[10px] gap-1"><Layers size={10} /> Builder</TabsTrigger>
          <TabsTrigger value="distinctiveness" className="text-[10px] gap-1"><CheckCircle size={10} /> Distinctiveness</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="mt-3 space-y-4">
          <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${DS.alternatives.soft} 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid ${DS.alternatives.fill}` }}>
            <CardContent className="pt-4 flex gap-2">
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Strategy name" className="text-xs bg-white" />
              <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description" className="text-xs bg-white" />
              <Button size="sm" style={{ background: DS.alternatives.fill }} onClick={addStrategy} disabled={!newName.trim()}><Plus size={12} /></Button>
            </CardContent>
          </Card>

          {focusDecisions.length === 0 && (
            <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center">
              <p className="text-xs" style={{ color: DS.inkSub }}>No Focus decisions defined yet. Go to Decision Hierarchy to create Focus decisions.</p>
            </CardContent></Card>
          )}

          {strategies.map(s => {
            const c = sColors[s.colorIdx % sColors.length];
            const comp = completeness(s);
            return (
              <Card key={s.id} className="overflow-hidden border-0 shadow-md" style={{ borderTop: `3px solid ${c.fill}` }}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: c.fill }} />
                      <span className="text-sm font-bold" style={{ color: DS.ink }}>{s.name}</span>
                      <span className="text-xs" style={{ color: DS.inkTer }}>{s.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge style={{ background: comp.pct === 100 ? c.soft : '#FEF3C7', color: comp.pct === 100 ? c.dark : '#D97706' }} variant="outline" className="text-[10px]">{comp.filled}/{comp.total} choices</Badge>
                      <button onClick={() => removeStrategy(s.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  {focusDecisions.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr style={{ background: DS.bg }}>
                          <th className="text-left p-2 font-semibold" style={{ color: DS.inkTer }}>Focus Decision</th>
                          {focusDecisions.map((d: any) => <th key={d.id} className="p-2 font-medium min-w-[140px]" style={{ color: DS.inkSub }}>{d.label}</th>)}
                        </tr></thead>
                        <tbody>
                          <tr>
                            <td className="p-2 font-medium" style={{ color: DS.ink }}>Choice</td>
                            {focusDecisions.map((d: any) => (
                              <td key={d.id} className="p-2">
                                <Select value={s.selections[d.id] !== undefined ? String(s.selections[d.id]) : ''} onValueChange={v => updateSelection(s.id, d.id, parseInt(v))}>
                                  <SelectTrigger className="text-[10px] h-7"><SelectValue placeholder="Select..." /></SelectTrigger>
                                  <SelectContent>{d.choices.map((ch: string, i: number) => <SelectItem key={i} value={String(i)} className="text-xs">{ch}</SelectItem>)}</SelectContent>
                                </Select>
                                {s.selections[d.id] !== undefined && <span className="text-[10px] block mt-0.5 font-medium" style={{ color: c.dark }}>{d.choices[s.selections[d.id]]}</span>}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="distinctiveness" className="mt-3">
          <Card className="border-0 shadow-sm"><CardContent className="pt-5">
            <p className="text-xs font-bold mb-3" style={{ color: DS.ink }}>Distinctiveness Check</p>
            <p className="text-[10px] mb-3" style={{ color: DS.inkTer }}>Strategies should differ on at least 50% of focus decisions to be genuinely distinct.</p>
            {distinctiveness().map((d, i) => (
              <div key={i} className="flex items-center gap-3 mb-2 p-2 rounded-lg" style={{ background: d.diffCount >= d.total / 2 ? '#ECFDF5' : '#FEF2F2' }}>
                <span className="text-xs font-medium" style={{ color: DS.ink }}>{d.pair}</span>
                <span className="text-[10px] ml-auto font-bold" style={{ color: d.diffCount >= d.total / 2 ? '#059669' : '#DC2626' }}>{d.diffCount}/{d.total} different</span>
                <Badge style={{ background: d.diffCount >= d.total / 2 ? '#ECFDF5' : '#FEF2F2', color: d.diffCount >= d.total / 2 ? '#059669' : '#DC2626' }} variant="outline" className="text-[9px] h-4">{d.diffCount >= d.total / 2 ? 'Distinct' : 'Too Similar'}</Badge>
              </div>
            ))}
            {distinctiveness().length === 0 && <p className="text-xs" style={{ color: DS.inkSub }}>Need at least 2 strategies to check distinctiveness.</p>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

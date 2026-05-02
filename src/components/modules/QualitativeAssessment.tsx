import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS, RATING_LABELS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Plus, Trash2 } from 'lucide-react';

interface CriterionItem { id: number; label: string; type: string; weight: string; }
interface StrategyItem { id: number; name: string; colorIdx: number; }

const DEMO_CRITERIA: CriterionItem[] = [
  { id: 1, label: 'Risk-adjusted NPV (3-year)', type: 'financial', weight: 'critical' },
  { id: 2, label: 'Time to first revenue', type: 'financial', weight: 'high' },
  { id: 3, label: 'Capital efficiency', type: 'financial', weight: 'critical' },
  { id: 4, label: 'Strategic flexibility', type: 'strategic', weight: 'high' },
  { id: 5, label: 'Competitive positioning', type: 'strategic', weight: 'high' },
  { id: 6, label: 'Execution complexity', type: 'operational', weight: 'medium' },
  { id: 7, label: 'Regulatory risk exposure', type: 'risk', weight: 'critical' },
  { id: 8, label: 'Stakeholder alignment', type: 'strategic', weight: 'medium' },
];

const sColors = [
  { fill: '#C9A84C', soft: '#FDF8E8', dark: '#8B6914' },
  { fill: '#2563EB', soft: '#EFF6FF', dark: '#1D4ED8' },
  { fill: '#059669', soft: '#ECFDF5', dark: '#047857' },
  { fill: '#DC2626', soft: '#FEF2F2', dark: '#B91C1C' },
  { fill: '#7C3AED', soft: '#F5F3FF', dark: '#5B21B6' },
  { fill: '#0891B2', soft: '#ECFEFF', dark: '#0E7490' },
];

export function QualitativeAssessment({ sessionId, data, hooks }: ModuleProps) {
  const [criteria, setCriteria] = useState<CriterionItem[]>(DEMO_CRITERIA);
  const [strategies, setStrategies] = useState<StrategyItem[]>([
    { id: 1, name: 'Alpha', colorIdx: 0 },
    { id: 2, name: 'Beta', colorIdx: 1 },
    { id: 3, name: 'Gamma', colorIdx: 2 },
  ]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    if (data?.criteria && data.criteria.length > 0) {
      setCriteria(data.criteria.map((c: any) => ({ id: c.id, label: c.label, type: c.type, weight: c.weight })));
    }
    if (data?.strategies && data.strategies.length > 0) {
      setStrategies(data.strategies.map((s: any) => ({ id: s.id, name: s.name, colorIdx: s.colorIdx || 0 })));
    }
    if (data?.assessmentScores && data.assessmentScores.length > 0) {
      const sc: Record<string, number> = {};
      data.assessmentScores.forEach((row: any) => {
        sc[`${row.strategyId}_${row.criterionId}`] = row.score;
      });
      setScores(sc);
    }
  }, [data?.criteria, data?.strategies, data?.assessmentScores]);

  const key = (sid: number, cid: number) => `${sid}_${cid}`;

  const setScore = (sid: number, cid: number, val: number) => {
    setScores(p => ({ ...p, [key(sid, cid)]: val }));
    if (sessionId) {
      hooks?.setScore?.({ sessionId, strategyId: sid, criterionId: cid, score: val });
    }
  };

  const avgScore = (sid: number) => {
    const vals = criteria.map(c => scores[key(sid, c.id)]).filter(v => v !== undefined) as number[];
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const addCriterion = () => {
    if (!newLabel.trim() || !sessionId) return;
    const newC: CriterionItem = { id: Date.now(), label: newLabel.trim(), type: 'strategic', weight: 'medium' };
    setCriteria(p => [...p, newC]);
    hooks?.createCriterion?.({ sessionId, label: newLabel.trim(), type: 'strategic', weight: 'medium' });
    setNewLabel('');
  };

  const deleteCriterion = (id: number) => {
    setCriteria(p => p.filter(c => c.id !== id));
    hooks?.deleteCriterion?.({ id });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
            <BarChart3 size={22} style={{ color: DS.values.fill }} /> Qualitative Assessment
          </h2>
          <p className="text-xs mt-1" style={{ color: DS.inkSub }}>{criteria.length} criteria &middot; {strategies.length} strategies &middot; 1–5 scale</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${DS.values.soft} 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid ${DS.values.fill}` }}>
        <CardContent className="pt-4 flex gap-2">
          <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="New criterion" className="text-xs bg-white flex-1" />
          <Button size="sm" style={{ background: DS.values.fill }} onClick={addCriterion} disabled={!newLabel.trim()}><Plus size={12} /></Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md"><CardContent className="pt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr style={{ background: DS.bg }}>
            <th className="text-left p-2 font-semibold" style={{ color: DS.inkSub }}>Criterion</th>
            {strategies.map(s => <th key={s.id} className="p-2 text-center font-medium" style={{ color: sColors[s.colorIdx % sColors.length].dark }}>{s.name}</th>)}
            <th className="p-2" />
          </tr></thead>
          <tbody>
            {criteria.map(c => (
              <tr key={c.id} className="border-t" style={{ borderColor: DS.borderLight }}>
                <td className="p-2">
                  <div className="text-xs font-medium" style={{ color: DS.ink }}>{c.label}</div>
                  <div className="text-[10px]" style={{ color: DS.inkTer }}>{c.type} &middot; {c.weight}</div>
                </td>
                {strategies.map(s => {
                  const v = scores[key(s.id, c.id)];
                  const r = RATING_LABELS.find(rv => rv.value === v);
                  return (
                    <td key={s.id} className="p-2 text-center">
                      <Select value={v !== undefined ? String(v) : ''} onValueChange={val => setScore(s.id, c.id, parseInt(val))}>
                        <SelectTrigger className="text-[10px] h-6 w-full"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>{RATING_LABELS.map(rv => <SelectItem key={rv.value} value={String(rv.value)} className="text-xs">{rv.value} &mdash; {rv.label}</SelectItem>)}</SelectContent>
                      </Select>
                      {r && <Badge style={{ background: r.soft, color: r.color }} variant="outline" className="text-[8px] mt-1 h-4">{r.label}</Badge>}
                    </td>
                  );
                })}
                <td className="p-2"><button onClick={() => deleteCriterion(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={10} /></button></td>
              </tr>
            ))}
            <tr className="border-t font-semibold" style={{ background: DS.bg, borderColor: DS.borderLight }}>
              <td className="p-2">Average</td>
              {strategies.map(s => <td key={s.id} className="p-2 text-center text-sm" style={{ color: sColors[s.colorIdx % sColors.length].dark }}>{avgScore(s.id)?.toFixed(2) || '—'}</td>)}
              <td />
            </tr>
          </tbody>
        </table>
      </CardContent></Card>

      <div className="flex flex-wrap gap-2">
        {RATING_LABELS.map(r => (
          <div key={r.value} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: r.soft }}>
            <span className="text-[10px] font-bold" style={{ color: r.color }}>{r.value}</span>
            <span className="text-[10px]" style={{ color: r.color }}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

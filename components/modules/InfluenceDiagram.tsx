import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS, UNCERTAINTY_TYPES, IMPACT_LEVELS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Network, Plus, Trash2 } from 'lucide-react';

interface UncItem { id: number; label: string; type: string; impact: string; control: string; description: string; }

const DEMO_UNCS: UncItem[] = [
  { id: 1, label: 'APAC market growth rate', type: 'Market', impact: 'Critical', control: 'None', description: 'Actual TAM growth may differ from 18% estimate' },
  { id: 2, label: 'Japan regulatory timeline', type: 'Regulatory', impact: 'High', control: 'Low', description: 'Unknown approval process for foreign tech companies' },
  { id: 3, label: 'Partner reliability', type: 'Operational', impact: 'High', control: 'Some', description: 'Strategic partner may not deliver on commitments' },
  { id: 4, label: 'Currency volatility', type: 'Financial', impact: 'Medium', control: 'None', description: 'FX exposure on $25M capital deployment' },
  { id: 5, label: 'Competitor response timing', type: 'Competitive', impact: 'Critical', control: 'None', description: 'Incumbents may accelerate expansion or cut prices' },
  { id: 6, label: 'Technical integration complexity', type: 'Technical', impact: 'High', control: 'High', description: 'Localisation effort may exceed estimates' },
];

const typeColor = (t: string) => {
  const m: Record<string, string> = { Market: '#2563EB', Regulatory: '#D97706', Technical: '#7C3AED', Financial: '#059669', Competitive: '#DC2626', Operational: '#0891B2', Political: '#DB2777', Stakeholder: '#64748B' };
  return m[t] || '#94A3B8';
};

export function InfluenceDiagram({ sessionId, data, hooks }: ModuleProps) {
  const [uncs, setUncs] = useState<UncItem[]>(DEMO_UNCS);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('Market');
  const [newImpact, setNewImpact] = useState('High');

  useEffect(() => {
    if (data?.uncertainties && data.uncertainties.length > 0) {
      setUncs(data.uncertainties.map((u: any) => ({
        id: u.id, label: u.label, type: u.type, impact: u.impact, control: u.control || 'Some', description: u.description || '',
      })));
    }
  }, [data?.uncertainties]);

  const add = () => {
    if (!newLabel.trim() || !sessionId) return;
    const newU: UncItem = { id: Date.now(), label: newLabel.trim(), type: newType, impact: newImpact, control: 'Some', description: '' };
    setUncs(p => [...p, newU]);
    hooks?.createUncertainty?.({ sessionId, label: newLabel.trim(), type: newType, impact: newImpact });
    setNewLabel('');
  };

  const remove = (id: number) => {
    setUncs(p => p.filter(u => u.id !== id));
    hooks?.deleteUncertainty?.({ id });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
            <Network size={22} style={{ color: DS.information.fill }} /> Influence Diagram
          </h2>
          <p className="text-xs mt-1" style={{ color: DS.inkSub }}>{uncs.length} uncertainties mapped</p>
        </div>
      </div>
      <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${DS.information.soft} 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid ${DS.information.fill}` }}>
        <CardContent className="pt-4 space-y-2">
          <div className="grid grid-cols-5 gap-2">
            <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Uncertainty" className="text-xs bg-white" />
            <Select value={newType} onValueChange={setNewType}><SelectTrigger className="text-[10px] h-8 bg-white"><SelectValue /></SelectTrigger><SelectContent>{UNCERTAINTY_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent></Select>
            <Select value={newImpact} onValueChange={setNewImpact}><SelectTrigger className="text-[10px] h-8 bg-white"><SelectValue /></SelectTrigger><SelectContent>{IMPACT_LEVELS.map(l => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}</SelectContent></Select>
            <Button size="sm" className="h-8" style={{ background: DS.information.fill }} onClick={add} disabled={!newLabel.trim()}><Plus size={12} /></Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md"><CardContent className="pt-4">
        <svg width="100%" viewBox="0 0 600 360" className="rounded-lg" style={{ background: DS.bg }}>
          <rect x={240} y={150} width={120} height={50} rx={10} fill={DS.information.fill} opacity={0.1} stroke={DS.information.fill} strokeWidth={2} />
          <text x={300} y={178} textAnchor="middle" fontSize={12} fontWeight="bold" fill={DS.information.fill}>DECISION</text>
          {uncs.map((u, i) => {
            const angle = (Math.PI * 2 * i) / Math.max(uncs.length, 1) - Math.PI / 2;
            const r = 130; const x = 300 + r * Math.cos(angle); const y = 175 + r * Math.sin(angle);
            const c = typeColor(u.type);
            return (
              <g key={u.id}>
                <line x1={300} y1={175} x2={x} y2={y} stroke={c} strokeWidth={u.impact === 'Critical' ? 2.5 : u.impact === 'High' ? 2 : 1} opacity={0.4} />
                <circle cx={x} cy={y} r={u.impact === 'Critical' ? 24 : u.impact === 'High' ? 20 : 16} fill={c} opacity={0.1} stroke={c} strokeWidth={1.5} />
                <text x={x} y={y - 3} textAnchor="middle" fontSize={7} fontWeight="bold" fill={c}>{u.label.slice(0, 16)}</text>
                <text x={x} y={y + 9} textAnchor="middle" fontSize={6} fill={DS.inkDis}>{u.type}</text>
              </g>
            );
          })}
        </svg>
      </CardContent></Card>

      <div className="space-y-2">
        {uncs.map(u => (
          <Card key={u.id} className="overflow-hidden border-0 shadow-sm"><CardContent className="p-3 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: typeColor(u.type) }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium" style={{ color: DS.ink }}>{u.label}</span>
                <Badge style={{ background: typeColor(u.type) + '15', color: typeColor(u.type) }} variant="outline" className="text-[9px] h-4">{u.type}</Badge>
                <Badge style={{ background: u.impact === 'Critical' ? '#FEF2F2' : u.impact === 'High' ? '#FEF3C7' : '#F1F5F9', color: u.impact === 'Critical' ? '#DC2626' : u.impact === 'High' ? '#D97706' : '#64748B' }} variant="outline" className="text-[9px] h-4">{u.impact}</Badge>
              </div>
            </div>
            <button onClick={() => remove(u.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}

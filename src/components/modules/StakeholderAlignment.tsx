import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, Trash2, MapPin, BarChart3, CheckSquare } from 'lucide-react';

interface StakeholderItem { id: number; name: string; role: string; influence: number; interest: number; alignment: string; concerns: string; }

const DEMO_STAKEHOLDERS: StakeholderItem[] = [
  { id: 1, name: 'CEO', role: 'Chief Executive Officer', influence: 95, interest: 90, alignment: 'supportive', concerns: 'Speed of execution and capital allocation' },
  { id: 2, name: 'CFO', role: 'Chief Financial Officer', influence: 90, interest: 95, alignment: 'cautious', concerns: 'ROI timeline and capital efficiency' },
  { id: 3, name: 'CSO', role: 'Chief Strategy Officer', influence: 75, interest: 95, alignment: 'supportive', concerns: 'Market timing and competitive response' },
  { id: 4, name: 'CTO', role: 'Chief Technology Officer', influence: 70, interest: 70, alignment: 'neutral', concerns: 'Technical integration complexity' },
  { id: 5, name: 'General Counsel', role: 'Legal & Compliance', influence: 65, interest: 80, alignment: 'concerned', concerns: 'Regulatory risk and data residency' },
  { id: 6, name: 'Board of Directors', role: 'Governance', influence: 98, interest: 85, alignment: 'supportive', concerns: 'Strategic alignment and risk oversight' },
  { id: 7, name: 'Regional GM APAC', role: 'Operations Lead', influence: 60, interest: 90, alignment: 'supportive', concerns: 'Local talent and execution bandwidth' },
  { id: 8, name: 'Head of Sales', role: 'Revenue Owner', influence: 55, interest: 75, alignment: 'neutral', concerns: 'Sales cycle length and pricing model' },
];

const alignmentColor = (a: string) => {
  const map: Record<string, { color: string; soft: string }> = {
    supportive: { color: '#059669', soft: '#ECFDF5' },
    cautious: { color: '#D97706', soft: '#FFFBEB' },
    concerned: { color: '#DC2626', soft: '#FEF2F2' },
    neutral: { color: '#64748B', soft: '#F1F5F9' },
    opposed: { color: '#7F1D1D', soft: '#FEF2F2' },
  };
  return map[a] || map.neutral;
};

export function StakeholderAlignment({ sessionId, data, hooks }: ModuleProps) {
  const [stakeholders, setStakeholders] = useState<StakeholderItem[]>(DEMO_STAKEHOLDERS);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');

  useEffect(() => {
    if (data?.stakeholderEntries && data.stakeholderEntries.length > 0) {
      setStakeholders(data.stakeholderEntries.map((s: any) => ({
        id: s.id, name: s.name, role: s.role || '',
        influence: s.influence || 50, interest: s.interest || 50,
        alignment: s.alignment || 'neutral', concerns: s.concerns || '',
      })));
    }
  }, [data?.stakeholderEntries]);

  const addStakeholder = () => {
    if (!newName.trim() || !sessionId) return;
    const newS: StakeholderItem = { id: Date.now(), name: newName.trim(), role: newRole, influence: 50, interest: 50, alignment: 'neutral', concerns: '' };
    setStakeholders(p => [...p, newS]);
    hooks?.createStakeholder?.({ sessionId, name: newName.trim(), role: newRole });
    setNewName(''); setNewRole('');
  };

  const deleteSt = (id: number) => {
    setStakeholders(p => p.filter(s => s.id !== id));
    hooks?.deleteStakeholder?.({ id });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
          <Users size={22} style={{ color: '#7C3AED' }} /> Stakeholder Alignment
        </h2>
        <p className="text-xs mt-1" style={{ color: DS.inkSub }}>{stakeholders.length} stakeholders mapped</p>
      </div>

      <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, #F5F3FF 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid #7C3AED` }}>
        <CardContent className="pt-4 flex gap-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" className="text-xs bg-white" />
          <Input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Role" className="text-xs bg-white" />
          <Button size="sm" style={{ background: '#7C3AED' }} onClick={addStakeholder} disabled={!newName.trim()}><Plus size={12} /></Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="map">
        <TabsList className="text-[10px]">
          <TabsTrigger value="map" className="text-[10px] gap-1"><MapPin size={10} /> Influence Map</TabsTrigger>
          <TabsTrigger value="analysis" className="text-[10px] gap-1"><BarChart3 size={10} /> Analysis</TabsTrigger>
          <TabsTrigger value="actions" className="text-[10px] gap-1"><CheckSquare size={10} /> Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="mt-3">
          <Card className="border-0 shadow-md"><CardContent className="pt-4">
            <svg width="100%" viewBox="0 0 500 380" className="rounded-lg" style={{ background: DS.bg }}>
              <line x1="50" y1="340" x2="480" y2="340" stroke={DS.inkDis} strokeWidth={1} />
              <line x1="50" y1="30" x2="50" y2="340" stroke={DS.inkDis} strokeWidth={1} />
              <text x="265" y="365" textAnchor="middle" fontSize={11} fontWeight="bold" fill={DS.inkSub}>Interest →</text>
              <text x="25" y="185" textAnchor="middle" fontSize={11} fontWeight="bold" fill={DS.inkSub} transform="rotate(-90 25 185)">Influence →</text>
              <text x="270" y="50" textAnchor="middle" fontSize={10} fill={DS.inkDis}>Keep Satisfied</text>
              <text x="120" y="50" textAnchor="middle" fontSize={10} fill={DS.inkDis}>Key Players</text>
              <text x="120" y="330" textAnchor="middle" fontSize={10} fill={DS.inkDis}>Monitor</text>
              <text x="270" y="330" textAnchor="middle" fontSize={10} fill={DS.inkDis}>Keep Informed</text>
              {stakeholders.map((s) => {
                const x = 55 + (s.interest / 100) * 400; const y = 335 - (s.influence / 100) * 290;
                const ac = alignmentColor(s.alignment);
                return (
                  <g key={s.id}>
                    <circle cx={x} cy={y} r={16} fill={ac.soft} stroke={ac.color} strokeWidth={1.5} />
                    <text x={x} y={y + 3} textAnchor="middle" fontSize={8} fontWeight="bold" fill={ac.color}>{s.name.slice(0, 3)}</text>
                  </g>
                );
              })}
            </svg>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="analysis" className="mt-3 space-y-2">
          {stakeholders.map(s => {
            const ac = alignmentColor(s.alignment);
            return (
              <Card key={s.id} className="overflow-hidden border-0 shadow-sm"><CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: ac.soft, color: ac.color }}>{s.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: DS.ink }}>{s.name}</span>
                      <span className="text-[10px]" style={{ color: DS.inkTer }}>{s.role}</span>
                      <Badge style={{ background: ac.soft, color: ac.color, borderColor: ac.color + '30' }} variant="outline" className="text-[9px] h-4 ml-auto capitalize">{s.alignment}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: DS.inkTer }}>Influence:</span>
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: DS.borderLight }}><div className="h-full rounded-full" style={{ width: `${s.influence}%`, background: '#7C3AED' }} /></div>
                        <span className="text-[10px] font-bold" style={{ color: '#7C3AED' }}>{s.influence}</span>
                      </div>
                      <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: DS.inkTer }}>Interest:</span>
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: DS.borderLight }}><div className="h-full rounded-full" style={{ width: `${s.interest}%`, background: '#2563EB' }} /></div>
                        <span className="text-[10px] font-bold" style={{ color: '#2563EB' }}>{s.interest}</span>
                      </div>
                    </div>
                    {s.concerns && <p className="text-[10px] mt-1.5 p-1.5 rounded" style={{ background: DS.bg, color: DS.inkSub }}><strong>Key Concern:</strong> {s.concerns}</p>}
                  </div>
                  <button onClick={() => deleteSt(s.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
                </div>
              </CardContent></Card>
            );
          })}
        </TabsContent>

        <TabsContent value="actions" className="mt-3">
          <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, #ECFDF5 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid #059669` }}>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-bold" style={{ color: '#047857' }}>Recommended Alignment Actions</p>
              {stakeholders.filter(s => s.alignment !== 'supportive').map(s => {
                const ac = alignmentColor(s.alignment);
                return (
                  <div key={s.id} className="flex items-start gap-2 p-2 rounded" style={{ background: ac.soft }}>
                    <span className="text-[10px] font-bold mt-0.5" style={{ color: ac.color }}>{s.name}</span>
                    <div>
                      <p className="text-[10px] font-medium capitalize" style={{ color: ac.color }}>{s.alignment} — needs attention</p>
                      <p className="text-[10px]" style={{ color: DS.inkSub }}>{s.concerns}</p>
                    </div>
                  </div>
                );
              })}
              {stakeholders.filter(s => s.alignment !== 'supportive').length === 0 && <p className="text-xs" style={{ color: '#059669' }}>All stakeholders are supportive. Excellent alignment.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

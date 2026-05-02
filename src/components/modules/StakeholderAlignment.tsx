import { useState, useEffect, useMemo } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, Plus, Trash2, MapPin, BarChart3, CheckSquare, BrainCircuit,
  Target, Shield, MessageSquare, TrendingUp, TrendingDown, ArrowRight,
  UserCircle, AlertTriangle, CheckCircle2, Lightbulb, Star
} from 'lucide-react';

// ============================================================================
// TYPES — 10-field structured stakeholder
// ============================================================================
interface StakeholderItem {
  id: number;
  name: string;
  role: string;
  influence: number;
  interest: number;
  alignment: string;
  concerns: string;
  engagementStrategy: string;
  decisionAuthority: string;
  supportNeeded: string;
}

// ============================================================================
// DEMO DATA
// ============================================================================
const DEMO_STAKEHOLDERS: StakeholderItem[] = [
  { id: 1, name: 'CEO', role: 'Chief Executive Officer', influence: 95, interest: 90, alignment: 'supportive', concerns: 'Speed of execution and maintaining board confidence through the entry process', engagementStrategy: 'Direct weekly briefings. Frame as legacy-defining strategic move.', decisionAuthority: 'Final decision + capital approval', supportNeeded: 'Board presentation deck, competitor response playbook' },
  { id: 2, name: 'CFO', role: 'Chief Financial Officer', influence: 90, interest: 95, alignment: 'cautious', concerns: 'ROI timeline, capital efficiency, FX exposure on $25M deployment', engagementStrategy: 'Provide detailed financial model with scenario analysis. Stress-test each strategy.', decisionAuthority: 'Capital allocation + financial risk', supportNeeded: 'NPV model with sensitivity analysis, currency hedging plan' },
  { id: 3, name: 'CSO', role: 'Chief Strategy Officer', influence: 75, interest: 95, alignment: 'supportive', concerns: 'Market timing and competitive response speed. Fear of missing the window.', engagementStrategy: 'Co-create strategy table. Make them architect of the approach.', decisionAuthority: 'Strategy selection + partner evaluation', supportNeeded: 'Competitive intelligence report, partner scorecard' },
  { id: 4, name: 'CTO', role: 'Chief Technology Officer', influence: 70, interest: 70, alignment: 'neutral', concerns: 'Technical integration complexity, hiring APAC engineering talent, data residency architecture', engagementStrategy: 'Technical roadmap with clear phases. Autonomy on architecture decisions.', decisionAuthority: 'Technology approach + localisation', supportNeeded: 'Architecture review timeline, APAC engineering hiring plan' },
  { id: 5, name: 'General Counsel', role: 'Legal & Compliance', influence: 65, interest: 80, alignment: 'concerned', concerns: 'Japan data residency, regulatory risk, IP protection in partnerships, contractual liability', engagementStrategy: 'Early involvement in partnership structuring. Clear risk appetite boundaries.', decisionAuthority: 'Regulatory + contractual risk veto', supportNeeded: 'Regulatory study budget, partnership term sheet template' },
  { id: 6, name: 'Board of Directors', role: 'Governance', influence: 98, interest: 85, alignment: 'supportive', concerns: 'Strategic alignment, risk oversight, investor narrative for next funding round', engagementStrategy: 'Quarterly deep-dive with scenario updates. Clear go/no-go gates.', decisionAuthority: 'Strategic direction + CEO mandate', supportNeeded: 'Board pack with risk-adjusted returns, milestone dashboard' },
  { id: 7, name: 'Regional GM APAC', role: 'Operations Lead (to be hired)', influence: 60, interest: 90, alignment: 'supportive', concerns: 'Local talent availability, execution bandwidth, cultural integration, authority clarity', engagementStrategy: 'Hire before decision. Include in strategy development. Give P&L ownership.', decisionAuthority: 'Execution + local market decisions', supportNeeded: 'Hiring budget, clear mandate letter, autonomy framework' },
  { id: 8, name: 'Head of Sales', role: 'Revenue Owner', influence: 55, interest: 75, alignment: 'neutral', concerns: 'Sales cycle length in APAC, pricing model adaptation, partner GTM quality vs direct control', engagementStrategy: 'Sales compensation clarity. APAC revenue target with timeline. Input on partner selection.', decisionAuthority: 'GTM approach + pricing', supportNeeded: 'APAC pricing study, partner GTM quality framework, comp plan' },
];

// ============================================================================
// HELPERS
// ============================================================================
const alignmentConfig = (a: string) => {
  const map: Record<string, { color: string; soft: string; label: string; action: string }> = {
    supportive: { color: '#059669', soft: '#ECFDF5', label: 'Supportive', action: 'Leverage as champion' },
    cautious: { color: '#D97706', soft: '#FFFBEB', label: 'Cautious', action: 'Address concerns with data' },
    concerned: { color: '#DC2626', soft: '#FEF2F2', label: 'Concerned', action: 'Direct engagement required' },
    neutral: { color: '#64748B', soft: '#F1F5F9', label: 'Neutral', action: 'Convert to supportive' },
    opposed: { color: '#7F1D1D', soft: '#FEF2F2', label: 'Opposed', action: 'Urgent intervention needed' },
  };
  return map[a] || map.neutral;
};

const quadrant = (influence: number, interest: number) => {
  if (influence >= 60 && interest >= 60) return { label: 'Key Player', color: '#DC2626', soft: '#FEF2F2', desc: 'High influence + high interest — manage closely' };
  if (influence >= 60 && interest < 60) return { label: 'Keep Satisfied', color: '#D97706', soft: '#FFFBEB', desc: 'High influence + low interest — keep satisfied, do not overwhelm' };
  if (influence < 60 && interest >= 60) return { label: 'Keep Informed', color: '#2563EB', soft: '#EFF6FF', desc: 'Low influence + high interest — keep informed, protect from surprises' };
  return { label: 'Monitor', color: '#64748B', soft: '#F1F5F9', desc: 'Low influence + low interest — monitor periodically' };
};

// ============================================================================
// AI ANALYSIS ENGINE
// ============================================================================
function generateAIInsights(stakeholders: StakeholderItem[]) {
  const insights: { type: 'critical' | 'warning' | 'info'; title: string; body: string }[] = [];
  const keyPlayers = stakeholders.filter(s => s.influence >= 60 && s.interest >= 60);
  const unsatisfied = stakeholders.filter(s => s.alignment !== 'supportive');
  const highInfluenceOpposed = stakeholders.filter(s => s.influence >= 80 && s.alignment !== 'supportive');

  if (highInfluenceOpposed.length > 0) {
    insights.push({ type: 'critical', title: `${highInfluenceOpposed.length} High-Influence Stakeholder${highInfluenceOpposed.length > 1 ? 's' : ''} Not Fully Supportive`, body: `${highInfluenceOpposed.map(s => s.name).join(', ')} have significant influence but are ${highInfluenceOpposed[0].alignment}. Address before commitment.` });
  }
  if (unsatisfied.length > 3) {
    insights.push({ type: 'warning', title: `${unsatisfied.length} Stakeholders Need Attention`, body: 'More than half of mapped stakeholders are not fully supportive. Broad engagement campaign recommended.' });
  }
  if (keyPlayers.length > 5) {
    insights.push({ type: 'warning', title: `${keyPlayers.length} Key Players — Coordination Risk`, body: 'Too many stakeholders in the "manage closely" quadrant. Decision process may slow down. Consider delegating to sub-groups.' });
  }
  const noStrategy = stakeholders.filter(s => !s.engagementStrategy || s.engagementStrategy.length < 15);
  if (noStrategy.length > 0) {
    insights.push({ type: 'info', title: `${noStrategy.length} Stakeholders Lack Engagement Strategy`, body: 'Every non-supportive stakeholder should have a targeted engagement plan. Add specific actions for each.' });
  }
  const alignmentScore = Math.round((stakeholders.filter(s => s.alignment === 'supportive').length / stakeholders.length) * 100);
  insights.push({ type: alignmentScore >= 70 ? 'info' : alignmentScore >= 50 ? 'warning' : 'critical', title: `Alignment Score: ${alignmentScore}%`, body: alignmentScore >= 70 ? 'Strong alignment base. Focus on converting neutral stakeholders.' : alignmentScore >= 50 ? 'Moderate alignment. Structured engagement required before decision commitment.' : 'Weak alignment. Do not commit until alignment is strengthened.' });
  return insights;
}

// ============================================================================
// COMPONENT
// ============================================================================
export function StakeholderAlignment({ sessionId, data, hooks }: ModuleProps) {
  const [stakeholders, setStakeholders] = useState<StakeholderItem[]>(DEMO_STAKEHOLDERS);
  const [aiOpen, setAiOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('matrix');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');

  useEffect(() => {
    if (data?.stakeholderEntries && data.stakeholderEntries.length > 0) {
      setStakeholders(data.stakeholderEntries.map((s: any) => ({
        id: s.id, name: s.name, role: s.role || '', influence: s.influence || 50, interest: s.interest || 50,
        alignment: s.alignment || 'neutral', concerns: s.concerns || '', engagementStrategy: s.engagementStrategy || '',
        decisionAuthority: s.decisionAuthority || '', supportNeeded: s.supportNeeded || '',
      })));
    }
  }, [data?.stakeholderEntries]);

  const addStakeholder = () => {
    if (!newName.trim()) return;
    const newS: StakeholderItem = {
      id: Date.now(), name: newName.trim(), role: newRole, influence: 50, interest: 50,
      alignment: 'neutral', concerns: '', engagementStrategy: '', decisionAuthority: '', supportNeeded: '',
    };
    setStakeholders(p => [...p, newS]);
    hooks?.createStakeholder?.({ sessionId, name: newName.trim(), role: newRole });
    setNewName(''); setNewRole('');
  };

  const deleteSt = (id: number) => {
    setStakeholders(p => p.filter(s => s.id !== id));
    hooks?.deleteStakeholder?.({ id });
  };

  const updateField = (id: number, field: keyof StakeholderItem, value: any) => {
    setStakeholders(p => p.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const aiInsights = useMemo(() => generateAIInsights(stakeholders), [stakeholders]);
  const alignmentScore = Math.round((stakeholders.filter(s => s.alignment === 'supportive').length / stakeholders.length) * 100);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
            <Users size={22} style={{ color: '#7C3AED' }} /> Stakeholder Alignment
          </h2>
          <p className="text-xs mt-1" style={{ color: DS.inkSub }}>{stakeholders.length} stakeholders &middot; {stakeholders.filter(s => s.alignment === 'supportive').length} supportive &middot; Alignment: {alignmentScore}%</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-[10px] gap-1" onClick={() => setAiOpen(!aiOpen)}>
          <BrainCircuit size={12} /> {aiOpen ? 'Hide AI Analysis' : 'AI Analysis'}
        </Button>
      </div>

      {/* AI Panel */}
      {aiOpen && (
        <Card className="border-0 shadow-md" style={{ background: `linear-gradient(135deg, #F5F3FF 0%, #FFFFFF 100%)`, borderLeft: `4px solid #7C3AED` }}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BrainCircuit size={14} style={{ color: '#7C3AED' }} />
              <span className="text-xs font-bold" style={{ color: '#6D28D9' }}>AI Stakeholder Analysis</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: alignmentScore >= 70 ? '#ECFDF5' : alignmentScore >= 50 ? '#FFFBEB' : '#FEF2F2', color: alignmentScore >= 70 ? '#059669' : alignmentScore >= 50 ? '#D97706' : '#DC2626' }}>{alignmentScore}% aligned</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {aiInsights.map((insight, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: insight.type === 'critical' ? '#FEF2F2' : insight.type === 'warning' ? '#FFFBEB' : '#F0FDFA' }}>
                  {insight.type === 'critical' ? <AlertTriangle size={12} style={{ color: '#DC2626', marginTop: 2 }} /> : insight.type === 'warning' ? <AlertTriangle size={12} style={{ color: '#D97706', marginTop: 2 }} /> : <Lightbulb size={12} style={{ color: '#059669', marginTop: 2 }} />}
                  <div>
                    <p className="text-[10px] font-semibold" style={{ color: insight.type === 'critical' ? '#DC2626' : insight.type === 'warning' ? '#D97706' : '#059669' }}>{insight.title}</p>
                    <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: DS.inkSub }}>{insight.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Stakeholder */}
      <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, #F5F3FF 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid #7C3AED` }}>
        <CardContent className="pt-4 flex gap-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (e.g. CFO, Board Chair)" className="text-xs bg-white" />
          <Input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Role / Function" className="text-xs bg-white" />
          <Button size="sm" style={{ background: '#7C3AED' }} onClick={addStakeholder} disabled={!newName.trim()}><Plus size={12} /></Button>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="text-[10px]">
          <TabsTrigger value="matrix" className="text-[10px] gap-1"><MapPin size={10} /> Power/Interest Matrix</TabsTrigger>
          <TabsTrigger value="cards" className="text-[10px] gap-1"><UserCircle size={10} /> Stakeholder Cards</TabsTrigger>
          <TabsTrigger value="actions" className="text-[10px] gap-1"><CheckSquare size={10} /> Action Plan</TabsTrigger>
        </TabsList>

        {/* MATRIX TAB */}
        <TabsContent value="matrix" className="mt-3">
          <Card className="border-0 shadow-md"><CardContent className="pt-4">
            <div className="relative w-full overflow-hidden rounded-lg" style={{ background: DS.bg, minHeight: 420 }}>
              {/* SVG Quadrant Background */}
              <svg width="100%" height="420" viewBox="0 0 600 420" className="rounded-lg">
                {/* Quadrant backgrounds */}
                <rect x="60" y="10" width="245" height="195" fill="#FEF2F2" stroke="#FECACA" strokeWidth={1} rx="4" />
                <rect x="315" y="10" width="245" height="195" fill="#FFFBEB" stroke="#FDE68A" strokeWidth={1} rx="4" />
                <rect x="60" y="215" width="245" height="185" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth={1} rx="4" />
                <rect x="315" y="215" width="245" height="185" fill="#F0FDFA" stroke="#A7F3D0" strokeWidth={1} rx="4" />

                {/* Labels */}
                <text x="182" y="30" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#DC2626">Key Players</text>
                <text x="182" y="48" textAnchor="middle" fontSize="9" fill="#EF4444">High Influence · High Interest</text>
                <text x="437" y="30" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#D97706">Keep Satisfied</text>
                <text x="437" y="48" textAnchor="middle" fontSize="9" fill="#F59E0B">High Influence · Low Interest</text>
                <text x="182" y="235" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#64748B">Monitor</text>
                <text x="182" y="253" textAnchor="middle" fontSize="9" fill="#94A3B8">Low Influence · Low Interest</text>
                <text x="437" y="235" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#059669">Keep Informed</text>
                <text x="437" y="253" textAnchor="middle" fontSize="9" fill="#10B981">Low Influence · High Interest</text>

                {/* Axis lines */}
                <line x1="60" y1="400" x2="560" y2="400" stroke="#94A3B8" strokeWidth={2} />
                <line x1="60" y1="10" x2="60" y2="400" stroke="#94A3B8" strokeWidth={2} />
                <text x="310" y="415" textAnchor="middle" fontSize="10" fill="#64748B">Interest →</text>
                <text x="35" y="205" textAnchor="middle" fontSize="10" fill="#64748B" transform="rotate(-90 35 205)">Influence →</text>

                {/* Stakeholder dots */}
                {stakeholders.map((s) => {
                  const x = 65 + (s.interest / 100) * 490;
                  const y = 395 - (s.influence / 100) * 380;
                  const ac = alignmentConfig(s.alignment);
                  const q = quadrant(s.influence, s.interest);
                  return (
                    <g key={s.id}>
                      <circle cx={x} cy={y} r={18} fill={ac.soft} stroke={ac.color} strokeWidth={2} />
                      <text x={x} y={y + 4} textAnchor="middle" fontSize="9" fontWeight="bold" fill={ac.color}>{s.name.slice(0, 3)}</text>
                      {/* Tooltip on hover — simplified label */}
                      <text x={x} y={y - 24} textAnchor="middle" fontSize="8" fill={DS.inkSub}>{s.name}</text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3">
              {['supportive', 'cautious', 'concerned', 'neutral', 'opposed'].map(a => {
                const ac = alignmentConfig(a);
                const count = stakeholders.filter(s => s.alignment === a).length;
                return (
                  <div key={a} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: ac.color }} />
                    <span className="text-[10px]" style={{ color: DS.inkSub }}>{ac.label} ({count})</span>
                  </div>
                );
              })}
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* CARDS TAB */}
        <TabsContent value="cards" className="mt-3 space-y-3">
          {stakeholders.map(s => {
            const ac = alignmentConfig(s.alignment);
            const q = quadrant(s.influence, s.interest);
            const isEditing = editingId === s.id;
            return (
              <Card key={s.id} className="overflow-hidden border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: ac.soft, color: ac.color }}>{s.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: DS.ink }}>{s.name}</span>
                        <span className="text-[10px]" style={{ color: DS.inkTer }}>{s.role}</span>
                        <Badge style={{ background: ac.soft, color: ac.color, borderColor: ac.color + '30' }} variant="outline" className="text-[9px] h-4 capitalize">{s.alignment}</Badge>
                        <Badge style={{ background: q.soft, color: q.color, borderColor: q.color + '30' }} variant="outline" className="text-[9px] h-4">{q.label}</Badge>
                      </div>

                      {/* Influence / Interest bars */}
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5 flex-1">
                          <span className="text-[10px] w-12" style={{ color: DS.inkTer }}>Influence</span>
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${s.influence}%`, background: '#7C3AED' }} />
                          </div>
                          <span className="text-[10px] font-bold w-6" style={{ color: '#7C3AED' }}>{s.influence}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1">
                          <span className="text-[10px] w-12" style={{ color: DS.inkTer }}>Interest</span>
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${s.interest}%`, background: '#2563EB' }} />
                          </div>
                          <span className="text-[10px] font-bold w-6" style={{ color: '#2563EB' }}>{s.interest}</span>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="mt-3 space-y-2">
                          <Textarea value={s.concerns} onChange={e => updateField(s.id, 'concerns', e.target.value)} placeholder="Key concerns" className="text-[10px]" rows={1} />
                          <Textarea value={s.engagementStrategy} onChange={e => updateField(s.id, 'engagementStrategy', e.target.value)} placeholder="Engagement strategy" className="text-[10px]" rows={1} />
                          <Textarea value={s.decisionAuthority} onChange={e => updateField(s.id, 'decisionAuthority', e.target.value)} placeholder="Decision authority" className="text-[10px]" rows={1} />
                          <Textarea value={s.supportNeeded} onChange={e => updateField(s.id, 'supportNeeded', e.target.value)} placeholder="Support needed" className="text-[10px]" rows={1} />
                          <div className="flex gap-2">
                            <div className="flex-1"><label className="text-[9px] block mb-1" style={{ color: DS.inkTer }}>Influence</label><Slider value={[s.influence]} onValueChange={v => updateField(s.id, 'influence', v[0])} max={100} step={5} /></div>
                            <div className="flex-1"><label className="text-[9px] block mb-1" style={{ color: DS.inkTer }}>Interest</label><Slider value={[s.interest]} onValueChange={v => updateField(s.id, 'interest', v[0])} max={100} step={5} /></div>
                          </div>
                          <Button size="sm" className="h-7 text-[10px]" onClick={() => setEditingId(null)}>Done</Button>
                        </div>
                      ) : (
                        <div className="mt-2 space-y-1.5">
                          {s.concerns && <p className="text-[10px] p-1.5 rounded" style={{ background: '#FEF2F2', color: '#991B1B' }}><strong>Concern:</strong> {s.concerns}</p>}
                          {s.engagementStrategy && <p className="text-[10px] p-1.5 rounded" style={{ background: '#F0FDFA', color: '#065F46' }}><strong>Strategy:</strong> {s.engagementStrategy}</p>}
                          {s.decisionAuthority && <p className="text-[10px] p-1.5 rounded" style={{ background: DS.bg, color: DS.inkSub }}><strong>Authority:</strong> {s.decisionAuthority}</p>}
                          {s.supportNeeded && <p className="text-[10px] p-1.5 rounded" style={{ background: '#FFFBEB', color: '#92400E' }}><strong>Needs:</strong> {s.supportNeeded}</p>}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => setEditingId(isEditing ? null : s.id)}>
                          {isEditing ? 'Close' : 'Edit'}
                        </Button>
                        <button onClick={() => deleteSt(s.id)} className="text-gray-400 hover:text-red-500 ml-auto"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ACTIONS TAB */}
        <TabsContent value="actions" className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, #FEF2F2 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid #DC2626` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3"><AlertTriangle size={14} style={{ color: '#DC2626' }} /><span className="text-xs font-bold" style={{ color: '#DC2626' }}>Urgent: Non-Supportive</span></div>
                {stakeholders.filter(s => s.alignment !== 'supportive').length === 0 ? (
                  <p className="text-xs" style={{ color: '#059669' }}><CheckCircle2 size={12} className="inline mr-1" /> All stakeholders are supportive. Excellent alignment.</p>
                ) : (
                  <div className="space-y-2">
                    {stakeholders.filter(s => s.alignment !== 'supportive').map(s => {
                      const ac = alignmentConfig(s.alignment);
                      const q = quadrant(s.influence, s.interest);
                      return (
                        <div key={s.id} className="p-2.5 rounded-lg" style={{ background: ac.soft }}>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold" style={{ color: ac.color }}>{s.name}</span>
                            <Badge style={{ background: ac.soft, color: ac.color, borderColor: ac.color + '30' }} variant="outline" className="text-[8px] h-4">{ac.label}</Badge>
                            <Badge style={{ background: q.soft, color: q.color, borderColor: q.color + '30' }} variant="outline" className="text-[8px] h-4">{q.label}</Badge>
                          </div>
                          <p className="text-[10px] mt-1" style={{ color: ac.color }}><strong>Action:</strong> {ac.action}</p>
                          {s.engagementStrategy && <p className="text-[9px] mt-0.5" style={{ color: DS.inkSub }}>{s.engagementStrategy}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, #F0FDFA 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid #059669` }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3"><CheckCircle2 size={14} style={{ color: '#059669' }} /><span className="text-xs font-bold" style={{ color: '#059669' }}>Leverage: Supportive Champions</span></div>
                <div className="space-y-2">
                  {stakeholders.filter(s => s.alignment === 'supportive').map(s => (
                    <div key={s.id} className="p-2 rounded-lg flex items-center gap-2" style={{ background: '#ECFDF5' }}>
                      <Star size={12} style={{ color: '#059669' }} />
                      <span className="text-[11px] font-semibold" style={{ color: '#065F46' }}>{s.name}</span>
                      {s.engagementStrategy && <span className="text-[9px]" style={{ color: DS.inkSub }}>— {s.engagementStrategy}</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

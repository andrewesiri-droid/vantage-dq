import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { toastAIError, toastSaved } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Plus, Trash2, Users, ChevronDown, ChevronUp } from 'lucide-react';

interface SH { id: number; name: string; role: string; influence: number; interest: number; alignment: string; concerns: string; engagementAction: string; }

const ALIGN_MAP: Record<string, { color: string; soft: string; label: string; priority: number }> = {
  opposed:    { color: '#EF4444', soft: '#FEF2F2', label: 'Opposed',    priority: 1 },
  concerned:  { color: '#F97316', soft: '#FFF7ED', label: 'Concerned',  priority: 2 },
  cautious:   { color: '#F59E0B', soft: '#FFFBEB', label: 'Cautious',   priority: 3 },
  neutral:    { color: '#64748B', soft: '#F8FAFC', label: 'Neutral',    priority: 4 },
  supportive: { color: '#22C55E', soft: '#F0FDF4', label: 'Supportive', priority: 5 },
  champion:   { color: '#047857', soft: '#ECFDF5', label: 'Champion',   priority: 6 },
};

const INFLUENCE_LABELS = ['Low', 'Medium', 'High', 'Very High', 'Critical'];

function influenceLabel(v: number) { return INFLUENCE_LABELS[Math.floor(v / 25)] || 'Critical'; }

export function StakeholderAlignment({ sessionId, data, hooks }: ModuleProps) {
  const [stakeholders, setStakeholders] = useState<SH[]>([]);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'analysis'>('list');

  useEffect(() => {
    if (data?.stakeholderEntries?.length) {
      setStakeholders(data.stakeholderEntries.map((s: any) => ({
        id: s.id, name: s.name, role: s.role || '',
        influence: s.influence || 50, interest: s.interest || 50,
        alignment: s.alignment || 'neutral', concerns: s.concerns || '',
        engagementAction: s.engagementAction || '',
      })));
    }
  }, [data?.stakeholderEntries]);

  const add = () => {
    if (!newName.trim()) return;
    const n: SH = { id: Date.now(), name: newName.trim(), role: newRole.trim(), influence: 50, interest: 50, alignment: 'neutral', concerns: '', engagementAction: '' };
    setStakeholders(p => [...p, n]);
    hooks?.createStakeholder?.({ sessionId, name: newName.trim(), role: newRole.trim(), influence: 50, interest: 50, alignment: 'neutral' });
    setNewName(''); setNewRole('');
    setExpandedId(n.id);
  };

  const remove = (id: number) => { setStakeholders(p => p.filter(s => s.id !== id)); hooks?.deleteStakeholder?.({ id }); };
  const update = (id: number, field: string, val: any) => setStakeholders(p => p.map(s => s.id === id ? { ...s, [field]: val } : s));

  const aiGenerate = async () => {
    const existing = stakeholders.map(s => s.name).join(', ');
    const prompt = `Identify key stakeholders for this decision.\nDecision: ${data?.session?.decisionStatement || ''}\nContext: ${(data?.session?.context || '').slice(0, 200)}\nExisting: ${existing}\n\nReturn JSON: { stakeholders: [{name, role, influence: 0-100, interest: 0-100, alignment (champion/supportive/neutral/cautious/concerned/opposed), concerns, engagementAction}] }`;
    setBusy(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, module: 'stakeholder' }) });
      const d = await res.json();
      const text = (d.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]);
        const newSHs = (result?.stakeholders || []).map((s: any, i: number) => ({
          id: Date.now()+i, name: s.name||'', role: s.role||'',
          influence: Math.min(100, Math.max(0, Number(s.influence)||50)),
          interest: Math.min(100, Math.max(0, Number(s.interest)||50)),
          alignment: s.alignment||'neutral', concerns: s.concerns||'', engagementAction: s.engagementAction||'',
        }));
        setStakeholders(p => [...p, ...newSHs]);
      }
    } catch(e) { console.error(e); } finally { setBusy(false); }
  };

  const aiAnalyse = async () => {
    const shSummary = stakeholders.map(s => `${s.name} (${s.role}): influence=${s.influence}, alignment=${s.alignment}, concerns="${s.concerns}"`).join('\n');
    const prompt = `Analyse stakeholder alignment.\nDecision: ${data?.session?.decisionStatement||''}\nStakeholders:\n${shSummary}\n\nReturn JSON: { alignmentScore: 0-100, riskLevel: Green|Amber|Red, readinessStatement: string, criticalGaps: [string], engagementPriorities: [{name, action, urgency: critical|high|medium}], insight: string }`;
    setBusy(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, module: 'stakeholder' }) });
      const d = await res.json();
      const text = (d.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) { setAnalysis(JSON.parse(match[0])); setActiveTab('analysis'); }
    } catch(e) { console.error(e); } finally { setBusy(false); }
  };

  const sorted = [...stakeholders].sort((a, b) => (ALIGN_MAP[a.alignment]?.priority || 4) - (ALIGN_MAP[b.alignment]?.priority || 4));
  const supporters = stakeholders.filter(s => ['champion','supportive'].includes(s.alignment)).length;
  const alignPct = stakeholders.length ? Math.round((supporters / stakeholders.length) * 100) : 0;
  const highRisk = stakeholders.filter(s => ['concerned','opposed'].includes(s.alignment) && s.influence >= 60);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 07</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Stakeholder Alignment</h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiGenerate} disabled={busy}>
            <Sparkles size={11} /> {busy ? 'Generating…' : 'AI Generate'}
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.commitment.fill }} onClick={aiAnalyse} disabled={busy || !stakeholders.length}>
            <Sparkles size={11} /> {busy ? 'Analysing…' : 'Analyse Alignment'}
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      {stakeholders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
            <div className="text-lg font-black" style={{ color: DS.ink }}>{stakeholders.length}</div>
            <div className="text-[9px] font-bold uppercase" style={{ color: DS.inkDis }}>Total</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <div className="text-lg font-black" style={{ color: '#047857' }}>{supporters}</div>
            <div className="text-[9px] font-bold uppercase" style={{ color: '#047857' }}>Supportive</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            <div className="text-lg font-black" style={{ color: '#EF4444' }}>{stakeholders.filter(s => ['concerned','opposed'].includes(s.alignment)).length}</div>
            <div className="text-[9px] font-bold uppercase" style={{ color: '#EF4444' }}>At Risk</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: alignPct >= 70 ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${alignPct >= 70 ? '#BBF7D0' : '#FDE68A'}` }}>
            <div className="text-lg font-black" style={{ color: alignPct >= 70 ? '#047857' : '#D97706' }}>{alignPct}%</div>
            <div className="text-[9px] font-bold uppercase" style={{ color: DS.inkDis }}>Aligned</div>
          </div>
        </div>
      )}

      {/* High risk alert */}
      {highRisk.length > 0 && (
        <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <span className="text-xs font-bold" style={{ color: '#EF4444' }}>⚠ High-influence resistors:</span>
          <span className="text-xs" style={{ color: '#EF4444' }}>{highRisk.map(s => s.name).join(', ')} — must be addressed before commitment</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: DS.borderLight }}>
        {[{id:'list',label:'Stakeholders'},{id:'analysis',label:'AI Analysis'}].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className="px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: activeTab === tab.id ? DS.commitment.fill : DS.inkTer, borderBottom: activeTab === tab.id ? `2px solid ${DS.commitment.fill}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Add row */}
      {activeTab === 'list' && (
        <div className="flex gap-2 p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
          <Input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Name…" className="flex-1 text-xs h-8 bg-white" />
          <Input value={newRole} onChange={e => setNewRole(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Role / position…" className="flex-1 text-xs h-8 bg-white" />
          <Button size="sm" className="h-8 px-3 gap-1 text-xs shrink-0" style={{ background: DS.commitment.fill }} onClick={add} disabled={!newName.trim()}>
            <Plus size={12} /> Add
          </Button>
        </div>
      )}

      {/* Stakeholder list */}
      {activeTab === 'list' && (
        <div className="space-y-2">
          {stakeholders.length === 0 && (
            <div className="text-center py-12 rounded-xl" style={{ background: DS.bg, border: `1px dashed ${DS.border}` }}>
              <Users size={28} className="mx-auto mb-3" style={{ color: DS.inkDis }} />
              <p className="text-sm font-medium mb-1" style={{ color: DS.inkSub }}>No stakeholders yet</p>
              <p className="text-xs mb-4" style={{ color: DS.inkDis }}>Add stakeholders manually or use AI Generate</p>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={aiGenerate} disabled={busy}>
                <Sparkles size={11} /> AI Generate Stakeholders
              </Button>
            </div>
          )}
          {sorted.map(s => {
            const al = ALIGN_MAP[s.alignment] || ALIGN_MAP.neutral;
            const isExpanded = expandedId === s.id;
            return (
              <div key={s.id} className="rounded-xl overflow-hidden border transition-all" style={{ borderColor: isExpanded ? al.color + '60' : DS.borderLight }}>
                {/* Row header */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" style={{ background: isExpanded ? al.soft : DS.canvas }}
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}>
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: al.color }}>
                    {s.name.slice(0,2).toUpperCase()}
                  </div>
                  {/* Name + role */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: DS.ink }}>{s.name}</span>
                      <span className="text-[10px]" style={{ color: DS.inkDis }}>{s.role}</span>
                    </div>
                    {s.concerns && !isExpanded && (
                      <p className="text-[10px] truncate" style={{ color: DS.inkDis }}>{s.concerns}</p>
                    )}
                  </div>
                  {/* Influence bar */}
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-bold uppercase" style={{ color: DS.inkDis }}>Influence</span>
                    <div className="w-16 h-1.5 rounded-full" style={{ background: DS.borderLight }}>
                      <div className="h-full rounded-full" style={{ width: `${s.influence}%`, background: al.color }} />
                    </div>
                    <span className="text-[9px] font-bold" style={{ color: DS.inkSub }}>{influenceLabel(s.influence)}</span>
                  </div>
                  {/* Alignment badge */}
                  <div className="px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0" style={{ background: al.soft, color: al.color }}>
                    {al.label}
                  </div>
                  {/* Expand icon */}
                  <div style={{ color: DS.inkDis }}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-4" style={{ background: al.soft }}>
                    {/* Alignment selector */}
                    <div>
                      <div className="text-[9px] font-bold uppercase mb-2" style={{ color: DS.inkDis }}>ALIGNMENT</div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(ALIGN_MAP).map(([key, val]) => (
                          <button key={key} onClick={() => update(s.id, 'alignment', key)}
                            className="text-[10px] px-3 py-1 rounded-full font-medium transition-all"
                            style={{ background: s.alignment === key ? val.color : '#fff', color: s.alignment === key ? '#fff' : val.color, border: `1px solid ${val.color}40` }}>
                            {val.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Influence */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[9px] font-bold uppercase" style={{ color: DS.inkDis }}>INFLUENCE</div>
                          <span className="text-[10px] font-bold" style={{ color: al.color }}>{influenceLabel(s.influence)} ({s.influence})</span>
                        </div>
                        <input type="range" min="0" max="100" value={s.influence} onChange={e => update(s.id, 'influence', parseInt(e.target.value))}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: al.color }} />
                      </div>
                      {/* Interest */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[9px] font-bold uppercase" style={{ color: DS.inkDis }}>INTEREST</div>
                          <span className="text-[10px] font-bold" style={{ color: al.color }}>{influenceLabel(s.interest)} ({s.interest})</span>
                        </div>
                        <input type="range" min="0" max="100" value={s.interest} onChange={e => update(s.id, 'interest', parseInt(e.target.value))}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: al.color }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>KEY CONCERNS</div>
                        <textarea value={s.concerns} onChange={e => update(s.id, 'concerns', e.target.value)} rows={3}
                          placeholder="What concerns do they have?" className="w-full text-xs p-2 rounded-lg border resize-none bg-white"
                          style={{ borderColor: DS.borderLight }} />
                      </div>
                      <div>
                        <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>ENGAGEMENT ACTION</div>
                        <textarea value={s.engagementAction} onChange={e => update(s.id, 'engagementAction', e.target.value)} rows={3}
                          placeholder="Specific action — who does what by when?" className="w-full text-xs p-2 rounded-lg border resize-none bg-white"
                          style={{ borderColor: DS.borderLight }} />
                      </div>
                    </div>

                    <button onClick={() => remove(s.id)} className="text-[10px] flex items-center gap-1.5 hover:opacity-80" style={{ color: DS.danger }}>
                      <Trash2 size={11} /> Remove stakeholder
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Analysis tab */}
      {activeTab === 'analysis' && (
        <div className="space-y-4">
          {!analysis ? (
            <div className="text-center py-12 rounded-xl" style={{ background: DS.bg, border: `1px dashed ${DS.border}` }}>
              <Sparkles size={28} className="mx-auto mb-3" style={{ color: DS.commitment.fill }} />
              <p className="text-sm font-medium mb-1" style={{ color: DS.inkSub }}>Run Alignment Analysis</p>
              <p className="text-xs mb-4" style={{ color: DS.inkDis }}>AI will assess readiness for commitment and flag critical gaps</p>
              <Button size="sm" className="gap-1.5 text-xs" style={{ background: DS.commitment.fill }} onClick={aiAnalyse} disabled={busy || !stakeholders.length}>
                <Sparkles size={11} /> Analyse Alignment
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Score */}
              <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: analysis.riskLevel === 'Green' ? '#F0FDF4' : analysis.riskLevel === 'Amber' ? '#FFFBEB' : '#FEF2F2', border: `1px solid ${analysis.riskLevel === 'Green' ? '#BBF7D0' : analysis.riskLevel === 'Amber' ? '#FDE68A' : '#FECACA'}` }}>
                <div className="text-4xl font-black" style={{ color: analysis.riskLevel === 'Green' ? '#047857' : analysis.riskLevel === 'Amber' ? '#D97706' : '#EF4444' }}>{analysis.alignmentScore}</div>
                <div className="flex-1">
                  <div className="text-sm font-bold mb-0.5" style={{ color: DS.ink }}>Alignment Score — {analysis.riskLevel} Risk</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{analysis.readinessStatement}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0" onClick={aiAnalyse} disabled={busy}>
                  <Sparkles size={10} /> Re-run
                </Button>
              </div>

              {/* Critical gaps */}
              {analysis.criticalGaps?.length > 0 && (
                <div className="rounded-xl p-4 space-y-2" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <div className="text-[10px] font-bold uppercase" style={{ color: '#EF4444' }}>Critical Gaps</div>
                  {analysis.criticalGaps.map((g: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs" style={{ color: '#EF4444' }}>
                      <span className="shrink-0 mt-0.5">•</span><span>{g}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Engagement priorities */}
              {analysis.engagementPriorities?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase" style={{ color: DS.inkDis }}>Engagement Priorities</div>
                  {analysis.engagementPriorities.map((p: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                      <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${p.urgency === 'critical' ? 'bg-red-100 text-red-600' : p.urgency === 'high' ? 'bg-orange-100 text-orange-600' : 'bg-yellow-100 text-yellow-600'}`}>
                        {p.urgency}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold mb-0.5" style={{ color: DS.ink }}>{p.name}</div>
                        <div className="text-xs" style={{ color: DS.inkSub }}>{p.action}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {analysis.insight && (
                <div className="rounded-xl p-3" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
                  <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.accent }}>Key Insight</div>
                  <p className="text-xs" style={{ color: DS.ink }}>{analysis.insight}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

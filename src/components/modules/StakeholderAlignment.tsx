import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Plus, Trash2, Lightbulb, ChevronRight, Users, AlertTriangle, CheckCircle } from 'lucide-react';

interface SH { id: number; name: string; role: string; influence: number; interest: number; alignment: string; concerns: string; engagementAction: string; }

const ALIGN_MAP: Record<string, { color: string; soft: string; label: string }> = {
  champion:   { color: '#047857', soft: '#ECFDF5', label: 'Champion' },
  supportive: { color: DS.success, soft: DS.successSoft, label: 'Supportive' },
  neutral:    { color: '#64748B', soft: '#F1F5F9', label: 'Neutral' },
  cautious:   { color: DS.warning, soft: DS.warnSoft, label: 'Cautious' },
  concerned:  { color: '#EA580C', soft: '#FFF7ED', label: 'Concerned' },
  opposed:    { color: DS.danger, soft: DS.dangerSoft, label: 'Opposed' },
};

const TABS = [
  { id: 'map', label: 'Alignment Map' },
  { id: 'actions', label: 'Engagement Actions' },
  { id: 'analysis', label: 'AI Analysis' },
];

const DQ_PRINCIPLES: Record<string, string> = {
  map: 'Stakeholder alignment is a DQ quality gate. A decision with a strong analytical foundation but weak stakeholder alignment will not be committed to or executed. Map alignment honestly — not how you wish it were.',
  actions: 'Engagement actions should be specific and assigned. "Brief the CFO on the financial model" is an action. "Engage stakeholders" is not. The most important stakeholders to act on are the high-influence ones who are not yet supportive.',
  analysis: 'The alignment score measures readiness for commitment, not just support. A 60% supportive rate with 2 high-influence holdouts is worse than 50% supportive with all holdouts being low-influence.',
};

export function StakeholderAlignment({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [activeTab, setActiveTab] = useState('map');
  const [stakeholders, setStakeholders] = useState<SH[]>([]);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

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
  };

  const remove = (id: number) => { setStakeholders(p => p.filter(s => s.id !== id)); hooks?.deleteStakeholder?.({ id }); };
  const update = (id: number, field: string, val: any) => setStakeholders(p => p.map(s => s.id === id ? { ...s, [field]: val } : s));

  const aiGenerate = () => {
    const existing = stakeholders.map(s => s.name).join(', ');
    const prompt = `Identify key stakeholders for this decision.\nDecision: ${data?.session?.decisionStatement || ''}\nContext: ${(data?.session?.context || '').slice(0, 200)}\nExisting: ${existing}\n\nReturn JSON: { stakeholders: [{name, role, influence: 0-100, interest: 0-100, alignment (champion/supportive/neutral/cautious/concerned/opposed), concerns, engagementAction}] }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      const newSHs = (result?.stakeholders || []).map((s: any, i: number) => ({
        id: Date.now()+i, name: s.name||'', role: s.role||'',
        influence: Math.min(100, Math.max(0, Number(s.influence)||50)),
        interest: Math.min(100, Math.max(0, Number(s.interest)||50)),
        alignment: s.alignment||'neutral', concerns: s.concerns||'', engagementAction: s.engagementAction||'',
      }));
      setStakeholders(p => [...p, ...newSHs]);
    });
  };

  const aiAnalyse = () => {
    const shSummary = stakeholders.map(s => `${s.name} (${s.role}): inf=${s.influence}, int=${s.interest}, align=${s.alignment}, concerns="${s.concerns}"`).join('\n');
    const prompt = `Analyse stakeholder alignment for this decision.\nDecision: ${data?.session?.decisionStatement||''}\n\nStakeholders:\n${shSummary}\n\nReturn JSON: { alignmentScore: 0-100, riskLevel: Green|Amber|Red, readinessStatement: string, criticalGaps: [string], engagementPriorities: [{name, action, urgency: critical|high|medium}], insight: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) { setAnalysis(result); setActiveTab('analysis'); }
    });
  };

  const supporters = stakeholders.filter(s => ['champion','supportive'].includes(s.alignment)).length;
  const resistors = stakeholders.filter(s => ['concerned','opposed'].includes(s.alignment)).length;
  const alignPct = stakeholders.length ? Math.round((supporters / stakeholders.length) * 100) : 0;
  const selected = selectedId ? stakeholders.find(s => s.id === selectedId) : null;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 07</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Stakeholder Alignment</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={add} disabled={!newName.trim()}>
            <Plus size={11} /> Add Stakeholder
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiGenerate} disabled={busy}>
            <Sparkles size={11} /> AI Generate
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.commitment.fill }} onClick={aiAnalyse} disabled={busy}>
            <Sparkles size={11} /> Analyse Alignment
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-5" style={{ borderColor: DS.borderLight }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: activeTab === tab.id ? DS.commitment.fill : DS.inkTer, borderBottom: activeTab === tab.id ? `2px solid ${DS.commitment.fill}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* === ALIGNMENT MAP TAB === */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          {/* Add row */}
          <div className="flex gap-2 p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
            <Input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
              placeholder="Name or role title…" className="flex-1 text-xs h-8 bg-white" />
            <Input value={newRole} onChange={e => setNewRole(e.target.value)}
              placeholder="Position…" className="flex-1 text-xs h-8 bg-white" />
            <Button size="sm" className="h-8 px-3 gap-1 text-xs shrink-0" style={{ background: DS.commitment.fill }} onClick={add} disabled={!newName.trim()}>
              <Plus size={12} /> Add
            </Button>
          </div>

          {/* Stats */}
          {stakeholders.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span style={{ color: DS.inkDis }}>{stakeholders.length} stakeholders</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: DS.bg }}>
                <div className="h-full rounded-full" style={{ width: `${alignPct}%`, background: DS.success }} />
              </div>
              <span className="font-bold" style={{ color: alignPct >= 70 ? DS.success : DS.warning }}>{alignPct}% aligned</span>
            </div>
          )}

          <div className="flex gap-4">
            {/* Map canvas */}
            <div className="flex-1 relative rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight, background: '#F7F8FA', height: stakeholders.length > 0 ? 320 : 280 }}>
              {stakeholders.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: DS.borderLight }}>
                    <Users size={20} style={{ color: DS.inkDis }} />
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: DS.inkSub }}>No stakeholders mapped yet</p>
                  <p className="text-xs mb-4 text-center max-w-xs" style={{ color: DS.inkDis }}>Map who has a stake in this decision — who must approve it, who must implement it, and who could block it.</p>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={aiGenerate} disabled={busy}>
                    <Sparkles size={11} /> AI Generate Stakeholders
                  </Button>
                </div>
              ) : (
                <>
                  {/* Axis labels */}
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-[8px] font-bold" style={{ color: DS.inkDis }}>INTEREST →</div>
                  <div className="absolute left-2 top-1/2 transform -translate-y-1/2 text-[8px] font-bold" style={{ color: DS.inkDis, writingMode: 'vertical-rl', transform: 'rotate(180deg) translateY(50%)' }}>↑ INFLUENCE</div>
                  {/* Grid lines */}
                  <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: DS.borderLight }} />
                  <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: DS.borderLight }} />
                  {/* Stakeholder dots */}
                  {stakeholders.map(s => {
                    const al = ALIGN_MAP[s.alignment] || ALIGN_MAP.neutral;
                    const x = 8 + (s.interest / 100) * 84;
                    const y = 8 + ((100 - s.influence) / 100) * 84;
                    const isSelected = selectedId === s.id;
                    return (
                      <button key={s.id} className="absolute flex flex-col items-center transition-transform hover:scale-110"
                        style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }}
                        onClick={() => setSelectedId(isSelected ? null : s.id)}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md"
                          style={{ background: al.color, border: isSelected ? '3px solid white' : '2px solid white', boxShadow: isSelected ? `0 0 0 3px ${al.color}` : '0 2px 8px rgba(0,0,0,0.15)' }}>
                          {s.name.slice(0,2).toUpperCase()}
                        </div>
                        <span className="text-[8px] mt-0.5 px-1 rounded bg-white shadow-sm font-medium" style={{ color: DS.ink }}>{s.name.slice(0,12)}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            {/* Detail panel */}
            <div className="w-64 shrink-0 space-y-2">
              {selected ? (
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
                  <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: ALIGN_MAP[selected.alignment]?.color || DS.inkSub }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-white/20">{selected.name.slice(0,2).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white">{selected.name}</div>
                      <div className="text-[9px] text-white/70">{selected.role}</div>
                    </div>
                    <button onClick={() => setSelectedId(null)} className="text-white/60 hover:text-white">×</button>
                  </div>
                  <div className="p-3 space-y-2.5">
                    <div>
                      <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>ALIGNMENT</div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(ALIGN_MAP).map(([key, val]) => (
                          <button key={key} onClick={() => update(selected.id, 'alignment', key)}
                            className="text-[9px] px-2 py-0.5 rounded-full font-medium transition-all"
                            style={{ background: selected.alignment === key ? val.color : val.soft, color: selected.alignment === key ? '#fff' : val.color }}>
                            {val.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>INFLUENCE</div>
                        <input type="range" min="0" max="100" value={selected.influence} onChange={e => update(selected.id, 'influence', parseInt(e.target.value))} className="w-full h-1" style={{ accentColor: DS.commitment.fill }} />
                        <div className="text-[9px] font-bold" style={{ color: DS.ink }}>{selected.influence}</div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>INTEREST</div>
                        <input type="range" min="0" max="100" value={selected.interest} onChange={e => update(selected.id, 'interest', parseInt(e.target.value))} className="w-full h-1" style={{ accentColor: DS.commitment.fill }} />
                        <div className="text-[9px] font-bold" style={{ color: DS.ink }}>{selected.interest}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>KEY CONCERNS</div>
                      <textarea value={selected.concerns} onChange={e => update(selected.id, 'concerns', e.target.value)} rows={2}
                        placeholder="What concerns do they have?" className="w-full text-[10px] p-1.5 rounded border resize-none" style={{ borderColor: DS.borderLight }} />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>ENGAGEMENT ACTION</div>
                      <textarea value={selected.engagementAction} onChange={e => update(selected.id, 'engagementAction', e.target.value)} rows={2}
                        placeholder="Specific action to take…" className="w-full text-[10px] p-1.5 rounded border resize-none" style={{ borderColor: DS.borderLight }} />
                    </div>
                    <button onClick={() => remove(selected.id)} className="text-[9px] flex items-center gap-1" style={{ color: DS.danger }}>
                      <Trash2 size={10} /> Remove stakeholder
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-4 text-center" style={{ background: DS.bg, border: `1px dashed ${DS.border}` }}>
                  <p className="text-xs" style={{ color: DS.inkDis }}>Click any stakeholder card to edit their details</p>
                </div>
              )}

              {/* Alignment legend */}
              <div className="rounded-xl p-3" style={{ background: DS.bg }}>
                {Object.entries(ALIGN_MAP).map(([key, val]) => {
                  const count = stakeholders.filter(s => s.alignment === key).length;
                  if (count === 0) return null;
                  return (
                    <div key={key} className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: val.color }} />
                      <span className="text-[10px]" style={{ color: DS.inkSub }}>{val.label}</span>
                      <span className="text-[10px] font-bold ml-auto" style={{ color: val.color }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DQPrinciple text={DQ_PRINCIPLES.map} color={DS.commitment.fill} />
        </div>
      )}

      {/* === ENGAGEMENT ACTIONS TAB === */}
      {activeTab === 'actions' && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: DS.inkSub }}>Specific actions for each stakeholder who is not yet fully supportive. Assign owners and deadlines.</p>
          {['champion','supportive','neutral','cautious','concerned','opposed'].map(align => {
            const group = stakeholders.filter(s => s.alignment === align);
            if (!group.length) return null;
            const al = ALIGN_MAP[align];
            return (
              <div key={align}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: al.color }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: al.color }}>{al.label}</span>
                  <span className="text-[9px]" style={{ color: DS.inkDis }}>{group.length} stakeholders</span>
                </div>
                <div className="space-y-1.5 pl-4">
                  {group.map(s => (
                    <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: al.color }}>
                        {s.name.slice(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold" style={{ color: DS.ink }}>{s.name}</span>
                          <span className="text-[9px]" style={{ color: DS.inkDis }}>{s.role}</span>
                        </div>
                        {s.concerns && <p className="text-[10px] mb-1.5 italic" style={{ color: DS.inkDis }}>Concern: {s.concerns}</p>}
                        <textarea value={s.engagementAction} onChange={e => update(s.id, 'engagementAction', e.target.value)}
                          placeholder="Specific engagement action — who does what by when?" rows={2}
                          className="w-full text-[10px] p-1.5 rounded border resize-none" style={{ borderColor: DS.borderLight }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {stakeholders.length === 0 && (
            <div className="text-center py-12" style={{ color: DS.inkDis }}>
              <p className="text-xs">Add stakeholders on the Alignment Map tab first</p>
            </div>
          )}
          <DQPrinciple text={DQ_PRINCIPLES.actions} color={DS.commitment.fill} />
        </div>
      )}

      {/* === AI ANALYSIS TAB === */}
      {activeTab === 'analysis' && (
        <div className="space-y-4">
          {!analysis ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <Users size={32} className="mx-auto mb-3 opacity-20" style={{ color: DS.commitment.fill }} />
              <p className="text-sm font-medium mb-1" style={{ color: DS.ink }}>AI Alignment Analysis</p>
              <p className="text-xs mb-4" style={{ color: DS.inkTer }}>Analyses your stakeholder map and generates engagement priorities for commitment readiness.</p>
              <Button style={{ background: DS.commitment.fill }} onClick={aiAnalyse} disabled={busy} className="gap-2">
                <Sparkles size={14} /> Analyse Alignment
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: analysis.riskLevel === 'Green' ? DS.successSoft : analysis.riskLevel === 'Amber' ? DS.warnSoft : DS.dangerSoft, border: `1px solid ${analysis.riskLevel === 'Green' ? DS.success : analysis.riskLevel === 'Amber' ? DS.warning : DS.danger}30` }}>
                <div className="text-4xl font-black" style={{ color: analysis.riskLevel === 'Green' ? DS.success : analysis.riskLevel === 'Amber' ? DS.warning : DS.danger }}>{analysis.alignmentScore}</div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold" style={{ color: DS.ink }}>Alignment Score</span>
                    <Badge style={{ background: analysis.riskLevel === 'Green' ? DS.success : analysis.riskLevel === 'Amber' ? DS.warning : DS.danger, color: '#fff', border: 'none' }}>{analysis.riskLevel}</Badge>
                  </div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{analysis.readinessStatement}</p>
                </div>
              </div>
              {(analysis.criticalGaps||[]).length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>CRITICAL GAPS</div>
                  {analysis.criticalGaps.map((g: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: DS.dangerSoft }}>
                      <AlertTriangle size={12} style={{ color: DS.danger, flexShrink: 0, marginTop: 1 }} />
                      <p className="text-xs" style={{ color: DS.inkSub }}>{g}</p>
                    </div>
                  ))}
                </div>
              )}
              {(analysis.engagementPriorities||[]).length > 0 && (
                <div className="space-y-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>ENGAGEMENT PRIORITIES</div>
                  {analysis.engagementPriorities.map((ep: any, i: number) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0" style={{ background: ep.urgency === 'critical' ? DS.danger : ep.urgency === 'high' ? DS.warning : DS.inkDis }}>{i+1}</div>
                      <div><div className="text-xs font-semibold" style={{ color: DS.ink }}>{ep.name}</div><div className="text-[10px]" style={{ color: DS.inkSub }}>{ep.action}</div></div>
                    </div>
                  ))}
                </div>
              )}
              {analysis.insight && <div className="p-3 rounded-xl" style={{ background: DS.accentSoft }}><p className="text-xs" style={{ color: DS.inkSub }}>{analysis.insight}</p></div>}
            </div>
          )}
          <DQPrinciple text={DQ_PRINCIPLES.analysis} color={DS.commitment.fill} />
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: DS.inkDis }}>
          <span>{stakeholders.length} stakeholders</span>
          <span>·</span>
          <span style={{ color: DS.success }}>{supporters} supportive</span>
          <span>·</span>
          <span style={{ color: resistors > 0 ? DS.danger : DS.inkDis }}>{resistors} resistant</span>
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" style={{ background: DS.commitment.fill }}
          onClick={() => setActiveTab(TABS[Math.min(TABS.findIndex(t=>t.id===activeTab)+1,TABS.length-1)].id)}>
          Next <ChevronRight size={11} />
        </Button>
      </div>
    </div>
  );
}

function DQPrinciple({ text, color = DS.commitment.fill }: { text: string; color?: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl mt-2" style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
      <Lightbulb size={14} style={{ color, flexShrink: 0, marginTop: 2 }} />
      <div>
        <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color }}>DQ PRINCIPLE</div>
        <p className="text-[11px] leading-relaxed" style={{ color: DS.inkSub }}>{text}</p>
      </div>
    </div>
  );
}

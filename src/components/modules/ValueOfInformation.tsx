import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { toastAIError, toastSaved } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Plus, Trash2, TrendingUp, CheckCircle, X, Clock } from 'lucide-react';

interface Uncertainty {
  id: number; label: string; description: string;
  impactOnValue: number; abilityToReduce: number; likelihoodChangesDecision: number;
  evpiEstimate: number;
}

interface InfoOption {
  id: number; uncertaintyId: number; label: string; type: string;
  cost: number; duration: number; accuracy: number; verdict?: string; netVOI?: number;
}

const VERDICT_CONFIG: Record<string,{label:string;color:string;soft:string}> = {
  'do-now':    { label: 'Do Now',    color: DS.success, soft: DS.successSoft },
  'do-not':    { label: 'Do Not',    color: DS.danger,  soft: DS.dangerSoft },
  'do-later':  { label: 'Do Later',  color: DS.accent,  soft: DS.accentSoft },
  'conditional':{ label: 'If Triggered', color: DS.warning, soft: DS.warnSoft },
};

function voiScore(u: Uncertainty) {
  return Math.round(((u.impactOnValue * 0.4) + (u.abilityToReduce * 0.3) + (u.likelihoodChangesDecision * 0.3)) * 20);
}

export function ValueOfInformation({ sessionId, data }: ModuleProps) {
  const [uncertainties, setUncertainties] = useState<Uncertainty[]>([]);
  const [infoOptions, setInfoOptions] = useState<InfoOption[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [screening, setScreening] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'uncertainties'|'screening'|'summary'>('uncertainties');
  const [totalValue, setTotalValue] = useState(0);
  const [reversibility, setReversibility] = useState('partially');
  const [urgency, setUrgency] = useState('moderate');

  useEffect(() => {
    if (data?.uncertainties?.length && !uncertainties.length) {
      setUncertainties(data.uncertainties.map((u: any, i: number) => ({
        id: u.id || i, label: u.label || 'Uncertainty', description: u.description || '',
        impactOnValue: 3, abilityToReduce: 3, likelihoodChangesDecision: 3, evpiEstimate: 0,
      })));
    }
  }, [data]);

  const add = () => {
    if (!newLabel.trim()) return;
    setUncertainties(p => [...p, { id: Date.now(), label: newLabel.trim(), description: '', impactOnValue: 3, abilityToReduce: 3, likelihoodChangesDecision: 3, evpiEstimate: 0 }]);
    setNewLabel('');
  };
  const remove = (id: number) => setUncertainties(p => p.filter(u => u.id !== id));
  const update = (id: number, field: string, val: any) => setUncertainties(p => p.map(u => u.id === id ? { ...u, [field]: val } : u));

  const addOption = (uncertaintyId: number) => setInfoOptions(p => [...p, { id: Date.now(), uncertaintyId, label: 'New Study', type: 'Market research', cost: 0, duration: 4, accuracy: 70 }]);
  const removeOption = (id: number) => setInfoOptions(p => p.filter(o => o.id !== id));
  const updateOption = (id: number, field: string, val: any) => setInfoOptions(p => p.map(o => o.id === id ? { ...o, [field]: val } : o));

  const aiScreen = async () => {
    const uList = uncertainties.map(u => `"${u.label}": impact=${u.impactOnValue}/5, reducible=${u.abilityToReduce}/5, changes_decision=${u.likelihoodChangesDecision}/5, EVPI=$${u.evpiEstimate}`).join('\n');
    const prompt = `VOI screening for this decision.\nDecision: ${data?.session?.decisionStatement||''}\nUrgency: ${urgency}\nReversibility: ${reversibility}\nValue at stake: $${totalValue.toLocaleString()}\n\nUncertainties:\n${uList}\n\nFor each uncertainty: is it decision-critical? Can we learn before the deadline? What study type? Return JSON: { screeningResults: [{uncertaintyLabel, isDecisionCritical, estimatedVOICategory: "High|Medium|Low|Zero", recommendedStudyType, canLearnBeforeDeadline: boolean, warningFlag}], topPriority: string, keyInsight: string, decisionReadiness: "Ready to commit|Critical gaps remain|Dangerous to proceed" }`;
    setBusy(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, module: 'voi' }) });
      const d = await res.json();
      const text = (d.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) { setScreening(JSON.parse(match[0])); setActiveTab('screening'); }
    } catch(e) { console.error(e); } finally { setBusy(false); }
  };

  const aiSummary = async () => {
    const optSummary = infoOptions.map(o => { const u = uncertainties.find(u => u.id === o.uncertaintyId); return `"${o.label}" for "${u?.label}": cost=$${o.cost}, ${o.duration}wks, ${o.accuracy}% accurate`; }).join('\n');
    const prompt = `Executive VOI summary.\nDecision: ${data?.session?.decisionStatement||''}\nValue at stake: $${totalValue.toLocaleString()}\nUrgency: ${urgency}\nReversibility: ${reversibility}\nInfo options:\n${optSummary}\n\nReturn JSON: { headline: string, readinessVerdict: string, recommendedStudies: [{name, rationale, duration}], rejectedStudies: [{name, reason}], commitNow: string, keyRisk: string }`;
    setBusy(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, module: 'voi' }) });
      const d = await res.json();
      const text = (d.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) { setSummary(JSON.parse(match[0])); setActiveTab('summary'); }
    } catch(e) { console.error(e); } finally { setBusy(false); }
  };

  const sorted = [...uncertainties].map(u => ({ ...u, score: voiScore(u) })).sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 11</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Value of Information</h2>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1 text-xs h-7 shrink-0" onClick={aiScreen} disabled={busy || !uncertainties.length}>
            <Sparkles size={11} /> {busy ? 'Screening…' : 'AI Screen'}
          </Button>
          <Button size="sm" className="gap-1 text-xs h-7 shrink-0" style={{ background: DS.information.fill }} onClick={aiSummary} disabled={busy || !infoOptions.length}>
            <Sparkles size={11} /> {busy ? 'Generating…' : 'AI Summary'}
          </Button>
        </div>
      </div>

      {/* Decision context strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl p-3" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
          <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>URGENCY</div>
          <select value={urgency} onChange={e => setUrgency(e.target.value)} className="w-full text-xs bg-transparent outline-none" style={{ color: DS.ink }}>
            <option value="urgent">Urgent</option>
            <option value="moderate">Moderate</option>
            <option value="flexible">Flexible</option>
          </select>
        </div>
        <div className="rounded-xl p-3" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
          <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>REVERSIBILITY</div>
          <select value={reversibility} onChange={e => setReversibility(e.target.value)} className="w-full text-xs bg-transparent outline-none" style={{ color: DS.ink }}>
            <option value="reversible">Reversible</option>
            <option value="partially">Partially</option>
            <option value="irreversible">Irreversible</option>
          </select>
        </div>
        <div className="rounded-xl p-3" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
          <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>VALUE AT STAKE ($)</div>
          <input type="number" value={totalValue || ''} onChange={e => setTotalValue(Number(e.target.value))} placeholder="e.g. 25000000" className="w-full text-xs bg-transparent outline-none" style={{ color: DS.ink }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto scrollbar-none" style={{ borderColor: DS.borderLight }}>
        {[{id:'uncertainties',label:'Uncertainties'},{id:'screening',label:'AI Screening'},{id:'summary',label:'Summary'}].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className="px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: activeTab === tab.id ? DS.information.fill : DS.inkTer, borderBottom: activeTab === tab.id ? `2px solid ${DS.information.fill}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Uncertainties tab */}
      {activeTab === 'uncertainties' && (
        <div className="space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Add uncertainty…" className="flex-1 text-xs h-8" />
            <Button size="sm" className="h-8 gap-1 text-xs" style={{ background: DS.information.fill }} onClick={add} disabled={!newLabel.trim()}><Plus size={12} /> Add</Button>
          </div>

          {uncertainties.length === 0 && (
            <div className="text-center py-10 rounded-xl" style={{ background: DS.bg, border: `1px dashed ${DS.border}` }}>
              <TrendingUp size={24} className="mx-auto mb-2" style={{ color: DS.inkDis }} />
              <p className="text-xs" style={{ color: DS.inkDis }}>Add key uncertainties or import from Scenario Planning</p>
            </div>
          )}

          {sorted.map(u => {
            const isExpanded = expandedId === u.id;
            const scoreColor = u.score >= 70 ? DS.danger : u.score >= 40 ? DS.warning : DS.success;
            const opts = infoOptions.filter(o => o.uncertaintyId === u.id);
            return (
              <div key={u.id} className="rounded-xl border overflow-hidden" style={{ borderColor: isExpanded ? scoreColor + '60' : DS.borderLight }}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" style={{ background: DS.canvas }} onClick={() => setExpandedId(isExpanded ? null : u.id)}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0" style={{ background: scoreColor + '15', color: scoreColor }}>{u.score}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: DS.ink }}>{u.label}</div>
                    <div className="text-[10px]" style={{ color: DS.inkDis }}>{opts.length} study option{opts.length !== 1 ? 's' : ''} · EVPI: ${u.evpiEstimate.toLocaleString()}</div>
                  </div>
                  <div className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: scoreColor + '15', color: scoreColor }}>
                    {u.score >= 70 ? 'High VOI' : u.score >= 40 ? 'Medium VOI' : 'Low VOI'}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 space-y-4 border-t" style={{ borderColor: DS.borderLight }}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { key: 'impactOnValue', label: 'Impact on Value' },
                        { key: 'abilityToReduce', label: 'Ability to Reduce' },
                        { key: 'likelihoodChangesDecision', label: 'Changes Decision?' },
                      ].map(dim => (
                        <div key={dim.key}>
                          <div className="text-[9px] font-bold uppercase mb-2" style={{ color: DS.inkDis }}>{dim.label}</div>
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map(v => (
                              <button key={v} onClick={() => update(u.id, dim.key, v)}
                                className="w-7 h-7 rounded-lg text-xs font-bold transition-all"
                                style={{ background: (u as any)[dim.key] >= v ? DS.information.fill : DS.bg, color: (u as any)[dim.key] >= v ? '#fff' : DS.inkDis }}>
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>EVPI ESTIMATE ($)</div>
                      <input type="number" value={u.evpiEstimate || ''} onChange={e => update(u.id, 'evpiEstimate', Number(e.target.value))} placeholder="Max value of perfect info" className="text-xs p-2 rounded-lg border bg-white w-full" style={{ borderColor: DS.borderLight }} />
                    </div>

                    {/* Study options */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[9px] font-bold uppercase" style={{ color: DS.inkDis }}>STUDY OPTIONS</div>
                        <button onClick={() => addOption(u.id)} className="text-[9px] flex items-center gap-1 font-bold" style={{ color: DS.information.fill }}><Plus size={10} /> Add option</button>
                      </div>
                      {opts.map(o => (
                        <div key={o.id} className="flex items-center gap-2 p-2 rounded-lg mb-1.5" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                          <input value={o.label} onChange={e => updateOption(o.id, 'label', e.target.value)} className="flex-1 text-xs bg-transparent outline-none font-medium" style={{ color: DS.ink }} />
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px]" style={{ color: DS.inkDis }}>$</span>
                            <input type="number" value={o.cost || ''} onChange={e => updateOption(o.id, 'cost', Number(e.target.value))} placeholder="Cost" className="w-16 text-xs bg-transparent outline-none text-right" style={{ color: DS.ink }} />
                            <span className="text-[9px]" style={{ color: DS.inkDis }}>wks</span>
                            <input type="number" value={o.duration || ''} onChange={e => updateOption(o.id, 'duration', Number(e.target.value))} placeholder="4" className="w-8 text-xs bg-transparent outline-none text-right" style={{ color: DS.ink }} />
                            <button onClick={() => removeOption(o.id)}><X size={10} style={{ color: DS.inkDis }} /></button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button onClick={() => remove(u.id)} className="text-[10px] flex items-center gap-1" style={{ color: DS.danger }}><Trash2 size={10} /> Remove</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Screening tab */}
      {activeTab === 'screening' && (
        <div className="space-y-3">
          {!screening ? (
            <div className="text-center py-10 rounded-xl" style={{ background: DS.bg, border: `1px dashed ${DS.border}` }}>
              <Sparkles size={24} className="mx-auto mb-2" style={{ color: DS.information.fill }} />
              <p className="text-xs mb-3" style={{ color: DS.inkDis }}>AI will screen each uncertainty for decision-relevance</p>
              <Button size="sm" className="gap-1.5 text-xs" style={{ background: DS.information.fill }} onClick={aiScreen} disabled={busy || !uncertainties.length}>
                <Sparkles size={11} /> AI Screen Uncertainties
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
                <div className="flex-1">
                  <div className="text-xs font-bold mb-1" style={{ color: DS.ink }}>{screening.decisionReadiness}</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{screening.keyInsight}</p>
                  {screening.topPriority && <p className="text-xs mt-1 font-medium" style={{ color: DS.accent }}>Top priority: {screening.topPriority}</p>}
                </div>
                <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0" onClick={aiScreen} disabled={busy}><Sparkles size={10} /> Re-run</Button>
              </div>
              {(screening.screeningResults || []).map((r: any, i: number) => {
                const cat = r.estimatedVOICategory;
                const catColor = cat === 'High' ? DS.danger : cat === 'Medium' ? DS.warning : cat === 'Low' ? DS.information.fill : DS.inkDis;
                return (
                  <div key={i} className="rounded-xl p-3 border" style={{ borderColor: DS.borderLight, background: DS.canvas }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold flex-1" style={{ color: DS.ink }}>{r.uncertaintyLabel}</span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: catColor + '15', color: catColor }}>{cat} VOI</span>
                      {r.isDecisionCritical ? <CheckCircle size={12} style={{ color: DS.success }} /> : <X size={12} style={{ color: DS.danger }} />}
                    </div>
                    <p className="text-[10px] mb-1" style={{ color: DS.inkSub }}>{r.decisionCriticalRationale}</p>
                    {r.recommendedStudyType && <p className="text-[10px] font-medium" style={{ color: DS.information.fill }}>→ {r.recommendedStudyType}</p>}
                    {r.warningFlag && <p className="text-[10px] mt-1" style={{ color: DS.warning }}>⚠ {r.warningFlag}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Summary tab */}
      {activeTab === 'summary' && (
        <div className="space-y-3">
          {!summary ? (
            <div className="text-center py-10 rounded-xl" style={{ background: DS.bg, border: `1px dashed ${DS.border}` }}>
              <p className="text-xs mb-3" style={{ color: DS.inkDis }}>Add study options first, then generate executive summary</p>
              <Button size="sm" className="gap-1.5 text-xs" style={{ background: DS.information.fill }} onClick={aiSummary} disabled={busy || !infoOptions.length}>
                <Sparkles size={11} /> Generate Summary
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl p-4" style={{ background: DS.information.soft, border: `1px solid ${DS.information.fill}30` }}>
                <div className="text-sm font-bold mb-1" style={{ color: DS.ink }}>{summary.headline}</div>
                <p className="text-xs" style={{ color: DS.inkSub }}>{summary.readinessVerdict}</p>
              </div>
              {summary.recommendedStudies?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase" style={{ color: DS.inkDis }}>Recommended Studies</div>
                  {summary.recommendedStudies.map((s: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: DS.successSoft, border: `1px solid ${DS.success}30` }}>
                      <CheckCircle size={14} style={{ color: DS.success, flexShrink: 0, marginTop: 1 }} />
                      <div><div className="text-xs font-semibold" style={{ color: DS.ink }}>{s.name} · {s.duration}wks</div><div className="text-[10px]" style={{ color: DS.inkSub }}>{s.rationale}</div></div>
                    </div>
                  ))}
                </div>
              )}
              {summary.commitNow && (
                <div className="rounded-xl p-3" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
                  <div className="text-[10px] font-bold uppercase mb-1" style={{ color: DS.accent }}>Commitment Guidance</div>
                  <p className="text-xs" style={{ color: DS.ink }}>{summary.commitNow}</p>
                </div>
              )}
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={aiSummary} disabled={busy}><Sparkles size={10} /> Re-generate</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

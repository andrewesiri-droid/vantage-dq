import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Plus, Trash2, ChevronRight, Lightbulb, X, CheckCircle } from 'lucide-react';

interface Strategy {
  id: number; name: string; colorIdx: number;
  objective: string; rationale: string; assumptions: string;
  uncertainties: string; risks: string;
  selections: Record<string, number>;
}
interface FocusDec { id: string; label: string; choices: string[]; }

const OVERVIEW_TABS = [
  { id: 'compare', label: 'Compare & Contrast' },
  { id: 'analysis', label: 'Strategy Analysis' },
];

const DQ_PRINCIPLE = 'Good strategies are genuinely distinct. Each strategy should represent a coherent path — not a variation of the same idea. If two strategies make the same choices on most Focus Decisions, they are the same strategy.';

export function StrategyTable({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [activeStratId, setActiveStratId] = useState<number | null>(null);
  const [overviewTab, setOverviewTab] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [recommendation, setRecommendation] = useState<any>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const focusDecisions: FocusDec[] = (data?.decisions || [])
    .filter((d: any) => d.tier === 'focus')
    .map((d: any) => ({ id: String(d.id), label: d.label, choices: d.choices || [] }));

  useEffect(() => {
    if (data?.strategies?.length) {
      const mapped = data.strategies.map((s: any) => ({
        id: s.id, name: s.name, colorIdx: s.colorIdx || 0,
        objective: s.objective || '', rationale: s.rationale || s.description || '',
        assumptions: s.assumptions || '', uncertainties: s.uncertainties || '',
        risks: s.risks || '', selections: s.selections || {},
      }));
      setStrategies(mapped);
      if (!activeStratId && mapped.length > 0) setActiveStratId(mapped[0].id);
    }
  }, [data?.strategies]);

  const sColors = DS.sColors;
  const col = (idx: number) => sColors[idx % sColors.length];

  const addStrategy = () => {
    if (!newName.trim()) return;
    const n: Strategy = { id: Date.now(), name: newName.trim(), colorIdx: strategies.length % 6, objective: '', rationale: '', assumptions: '', uncertainties: '', risks: '', selections: {} };
    setStrategies(p => [...p, n]);
    setActiveStratId(n.id);
    setOverviewTab(null);
    hooks?.createStrategy?.({ sessionId, name: newName.trim() });
    setNewName('');
  };

  const removeStrategy = (id: number) => {
    setStrategies(p => p.filter(s => s.id !== id));
    if (activeStratId === id) {
      const remaining = strategies.filter(s => s.id !== id);
      setActiveStratId(remaining.length > 0 ? remaining[0].id : null);
    }
    hooks?.deleteStrategy?.({ id });
  };

  const updateStrategy = (id: number, field: string, val: string) =>
    setStrategies(p => p.map(s => s.id === id ? { ...s, [field]: val } : s));

  const setSelection = (sid: number, did: string, idx: number) =>
    setStrategies(p => p.map(s => s.id === sid ? { ...s, selections: { ...s.selections, [did]: idx } } : s));

  const completeness = (s: Strategy) => {
    if (!focusDecisions.length) return 0;
    return Math.round((focusDecisions.filter(d => s.selections[d.id] !== undefined).length / focusDecisions.length) * 100);
  };

  const aiSuggest = () => {
    const decMenu = focusDecisions.map((d, i) => `D${i + 1}: "${d.label}" — options: ${d.choices.map((c, j) => j + '=' + c).join(', ')}`).join('\n');
    const prompt = `Suggest 3 genuinely distinct strategies.\nDecision: ${data?.session?.decisionStatement || ''}\nFocus decisions:\n${decMenu}\nExisting: ${strategies.map(s => s.name).join(', ')}\n\nReturn JSON: { strategies: [{name, rationale, objective, assumptions, selections (D1/D2... → choice index)}] }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
      const newStrats: Strategy[] = (result?.strategies || []).map((s: any, i: number) => {
        const sel: Record<string, number> = {};
        if (s.selections) focusDecisions.forEach((d, di) => { if (s.selections[`D${di + 1}`] !== undefined) sel[d.id] = Number(s.selections[`D${di + 1}`]); });
        return { id: Date.now() + i, name: s.name || `Strategy ${i + 1}`, colorIdx: (strategies.length + i) % 6, objective: s.objective || '', rationale: s.rationale || '', assumptions: s.assumptions || '', uncertainties: '', risks: '', selections: sel };
      });
      setStrategies(p => [...p, ...newStrats]);
      if (newStrats.length > 0 && !activeStratId) setActiveStratId(newStrats[0].id);
    });
  };

  const aiPickBest = () => {
    const prompt = `Recommend the best strategy.\nDecision: ${data?.session?.decisionStatement || ''}\nStrategies: ${strategies.map(s => `${s.name}: ${s.rationale}`).join('; ')}\nCriteria: ${(data?.criteria || []).map((c: any) => c.label).join(', ')}\n\nReturn JSON: { recommendation: string, confidence: High|Medium|Low, reasoning: string, keyTradeoff: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
      if (result && !result.error) setRecommendation(result);
    });
  };

  const aiAnalyse = () => {
    const prompt = `Analyse each strategy.\nDecision: ${data?.session?.decisionStatement || ''}\nStrategies:\n${strategies.map(s => `${s.name}: ${s.rationale}`).join('\n')}\n\nReturn JSON: { analyses: [{name, strengths:[string], weaknesses:[string], distinctiveRisk:string}], crossCuttingInsight: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
      if (result && !result.error) { setAnalysisResult(result); setOverviewTab('analysis'); setActiveStratId(null); }
    });
  };

  const activeStat = activeStratId ? strategies.find(s => s.id === activeStratId) : null;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 04</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Strategy Table</h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiPickBest} disabled={busy || strategies.length < 2}>+ AI Pick Best</Button>
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.alternatives.fill }} onClick={aiSuggest} disabled={busy}><Sparkles size={11} /> AI Suggest</Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiAnalyse} disabled={busy || !strategies.length}>AI Analyse</Button>
        </div>
      </div>

      {/* Recommendation banner */}
      {recommendation && (
        <div className="rounded-xl p-3 mb-4 flex items-start gap-3" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
          <CheckCircle size={15} style={{ color: DS.accent, flexShrink: 0, marginTop: 1 }} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-bold" style={{ color: DS.ink }}>Recommended: {recommendation.recommendation}</span>
              <Badge style={{ background: DS.accentSoft, color: DS.accent, border: 'none', fontSize: 9 }}>{recommendation.confidence}</Badge>
            </div>
            <p className="text-[10px]" style={{ color: DS.inkSub }}>{recommendation.reasoning}</p>
          </div>
          <button onClick={() => setRecommendation(null)}><X size={12} style={{ color: DS.inkDis }} /></button>
        </div>
      )}

      {/* Add strategy bar */}
      <div className="flex gap-2 mb-4 p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
        <Input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addStrategy()}
          placeholder="New strategy name…" className="flex-1 text-xs h-8 bg-white" />
        <Button size="sm" className="h-8 px-3 gap-1 text-xs shrink-0" style={{ background: DS.alternatives.fill }} onClick={addStrategy} disabled={!newName.trim()}>
          <Plus size={12} /> Add Strategy
        </Button>
      </div>

      {/* Tab bar — one tab per strategy + overview tabs */}
      <div className="flex border-b mb-0 overflow-x-auto" style={{ borderColor: DS.borderLight }}>
        {strategies.map(s => {
          const c = col(s.colorIdx);
          const isActive = activeStratId === s.id && !overviewTab;
          const pct = completeness(s);
          return (
            <button key={s.id}
              onClick={() => { setActiveStratId(s.id); setOverviewTab(null); }}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors shrink-0 relative group"
              style={{ color: isActive ? c.fill : DS.inkTer, borderBottom: isActive ? `2px solid ${c.fill}` : '2px solid transparent', marginBottom: -1, background: isActive ? `${c.fill}08` : 'transparent' }}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.fill }} />
              {s.name}
              <span className="text-[8px] opacity-60">{pct}%</span>
              <button onClick={e => { e.stopPropagation(); removeStrategy(s.id); }}
                className="ml-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity">
                <X size={10} style={{ color: DS.inkDis }} />
              </button>
            </button>
          );
        })}
        {/* Overview tabs */}
        {OVERVIEW_TABS.map(tab => (
          <button key={tab.id}
            onClick={() => { setOverviewTab(tab.id); setActiveStratId(null); }}
            className="px-3 py-2.5 text-xs font-medium transition-colors shrink-0"
            style={{ color: overviewTab === tab.id ? DS.alternatives.fill : DS.inkTer, borderBottom: overviewTab === tab.id ? `2px solid ${DS.alternatives.fill}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
        {strategies.length === 0 && (
          <div className="px-3 py-2.5 text-xs" style={{ color: DS.inkDis }}>Add strategies above to get started</div>
        )}
      </div>

      {/* === STRATEGY DETAIL VIEW === */}
      {activeStat && !overviewTab && (() => {
        const s = activeStat;
        const c = col(s.colorIdx);
        return (
          <div className="border rounded-b-xl overflow-hidden" style={{ borderColor: DS.borderLight, borderTop: 'none' }}>
            <div className="grid grid-cols-2 gap-0">
              {/* LEFT: Strategy info */}
              <div className="border-r p-5 space-y-4" style={{ borderColor: DS.borderLight }}>
                <div className="pb-3 border-b" style={{ borderColor: DS.borderLight }}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ background: c.fill }} />
                    <span className="text-sm font-bold" style={{ color: DS.ink }}>{s.name}</span>
                    <Badge style={{ background: `${c.fill}18`, color: c.fill, border: 'none', fontSize: 8 }}>{completeness(s)}% complete</Badge>
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: c.fill }}>OBJECTIVE</div>
                  <Textarea value={s.objective} onChange={e => updateStrategy(s.id, 'objective', e.target.value)}
                    placeholder="What is this strategy trying to achieve?" rows={2}
                    className="text-xs resize-none" />
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: c.fill }}>RATIONALE</div>
                  <Textarea value={s.rationale} onChange={e => updateStrategy(s.id, 'rationale', e.target.value)}
                    placeholder="Core logic and reasoning for this strategy" rows={3}
                    className="text-xs resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.inkDis }}>KEY ASSUMPTIONS</div>
                    <Textarea value={s.assumptions} onChange={e => updateStrategy(s.id, 'assumptions', e.target.value)}
                      placeholder="What must be true?" rows={3}
                      className="text-[10px] resize-none" />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.inkDis }}>KEY UNCERTAINTIES</div>
                    <Textarea value={s.uncertainties} onChange={e => updateStrategy(s.id, 'uncertainties', e.target.value)}
                      placeholder="What could shift the outcome?" rows={3}
                      className="text-[10px] resize-none" />
                  </div>
                </div>
              </div>

              {/* RIGHT: Focus Decision selections */}
              <div className="p-5">
                <div className="text-[9px] font-bold uppercase tracking-wider mb-3" style={{ color: DS.inkDis }}>
                  FOCUS DECISIONS — select one choice per decision
                </div>
                {focusDecisions.length === 0 ? (
                  <div className="text-center py-8 rounded-xl" style={{ background: DS.bg }}>
                    <p className="text-xs" style={{ color: DS.inkDis }}>Define Focus Decisions in the Decision Hierarchy module first</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {focusDecisions.map((d, i) => {
                      const selectedIdx = s.selections[d.id];
                      return (
                        <div key={d.id}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[9px] font-bold w-4 text-center shrink-0" style={{ color: DS.alternatives.fill }}>{i + 1}</span>
                            <span className="text-[10px] font-semibold" style={{ color: DS.ink }}>{d.label}</span>
                            {selectedIdx === undefined && <span className="text-[8px] ml-auto" style={{ color: DS.danger }}>Not selected</span>}
                          </div>
                          <div className="flex flex-col gap-1 pl-6">
                            {d.choices.map((choice, ci) => {
                              const isSelected = selectedIdx === ci;
                              return (
                                <button key={ci} onClick={() => setSelection(s.id, d.id, ci)}
                                  className="w-full text-left text-[10px] px-3 py-2 rounded-lg transition-all"
                                  style={{
                                    background: isSelected ? c.fill : DS.bg,
                                    color: isSelected ? '#fff' : DS.inkSub,
                                    border: `1px solid ${isSelected ? c.fill : DS.borderLight}`,
                                    fontWeight: isSelected ? 600 : 400,
                                  }}>
                                  {choice}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom nav */}
            <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: DS.borderLight, background: DS.bg }}>
              <div className="flex gap-2">
                {strategies.map(st => {
                  const cc = col(st.colorIdx);
                  return (
                    <button key={st.id} onClick={() => setActiveStratId(st.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-medium transition-all"
                      style={{ background: activeStratId === st.id ? cc.fill : cc.soft, color: activeStratId === st.id ? '#fff' : cc.fill }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: activeStratId === st.id ? '#fff' : cc.fill }} />
                      {st.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { const idx = strategies.findIndex(st => st.id === s.id); const next = strategies[(idx + 1) % strategies.length]; setActiveStratId(next.id); }}
                  className="text-[10px] flex items-center gap-1 px-2 py-1 rounded" style={{ color: DS.inkDis }}>
                  Next strategy <ChevronRight size={11} />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* === COMPARE TAB === */}
      {overviewTab === 'compare' && (
        <div className="border rounded-b-xl p-5 space-y-4" style={{ borderColor: DS.borderLight, borderTop: 'none' }}>
          <p className="text-xs" style={{ color: DS.inkSub }}>Side-by-side comparison of all strategies across each Focus Decision.</p>
          {focusDecisions.length === 0 || strategies.length === 0 ? (
            <div className="text-center py-10" style={{ color: DS.inkDis }}><p className="text-xs">Add strategies and focus decisions to compare</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate" style={{ borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider w-40" style={{ color: DS.inkTer, borderBottom: `2px solid ${DS.borderLight}` }}>Decision</th>
                    {strategies.map(s => {
                      const c = col(s.colorIdx);
                      return (
                        <th key={s.id} className="px-3 py-2 text-center" style={{ borderBottom: `2px solid ${DS.borderLight}` }}>
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: c.fill }} />
                            <span className="text-[10px] font-bold" style={{ color: c.fill }}>{s.name}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {focusDecisions.map((d, i) => (
                    <tr key={d.id} style={{ borderBottom: `1px solid ${DS.borderLight}` }}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold w-4" style={{ color: DS.alternatives.fill }}>{i + 1}</span>
                          <span className="text-[10px] font-medium" style={{ color: DS.ink }}>{d.label}</span>
                        </div>
                      </td>
                      {strategies.map(s => {
                        const c = col(s.colorIdx);
                        const choice = d.choices[s.selections[d.id] ?? -1];
                        return (
                          <td key={s.id} className="px-3 py-2 text-center" style={{ borderBottom: `1px solid ${DS.borderLight}` }}>
                            <span className="text-[10px] px-2 py-1 rounded-lg" style={{ background: choice ? `${c.fill}15` : DS.bg, color: choice ? c.fill : DS.inkDis, fontWeight: choice ? 600 : 400 }}>
                              {choice || '—'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td className="px-3 py-2 text-[10px] font-bold uppercase" style={{ color: DS.inkTer }}>Completeness</td>
                    {strategies.map(s => {
                      const c = col(s.colorIdx); const pct = completeness(s);
                      return <td key={s.id} className="px-3 py-2 text-center"><span className="text-sm font-black" style={{ color: pct === 100 ? DS.success : DS.warning }}>{pct}%</span></td>;
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === ANALYSIS TAB === */}
      {overviewTab === 'analysis' && (
        <div className="border rounded-b-xl p-5 space-y-4" style={{ borderColor: DS.borderLight, borderTop: 'none' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>AI analysis of strengths, weaknesses and distinctive risks.</p>
            <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.alternatives.fill }} onClick={aiAnalyse} disabled={busy}>
              <Sparkles size={11} /> {busy ? 'Analysing…' : 'Run Analysis'}
            </Button>
          </div>
          {!analysisResult ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <Sparkles size={28} className="mx-auto mb-3 opacity-20" style={{ color: DS.alternatives.fill }} />
              <p className="text-sm font-medium mb-4" style={{ color: DS.ink }}>Click Run Analysis to evaluate all strategies</p>
              <Button style={{ background: DS.alternatives.fill }} onClick={aiAnalyse} disabled={busy} className="gap-2"><Sparkles size={14} /> Run Analysis</Button>
            </div>
          ) : (
            <>
              {analysisResult.crossCuttingInsight && (
                <div className="p-3 rounded-xl" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
                  <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.accent }}>CROSS-CUTTING INSIGHT</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{analysisResult.crossCuttingInsight}</p>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {(analysisResult.analyses || []).map((a: any, i: number) => {
                  const strat = strategies.find(s => s.name === a.name);
                  const c = strat ? col(strat.colorIdx) : col(i);
                  return (
                    <div key={i} className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight, borderTop: `3px solid ${c.fill}` }}>
                      <div className="px-3 py-2 font-bold text-xs" style={{ background: DS.bg, color: c.fill }}>{a.name}</div>
                      <div className="p-3 space-y-2">
                        <div>
                          <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.success }}>STRENGTHS</div>
                          {(a.strengths || []).map((s: string, j: number) => <p key={j} className="text-[10px]" style={{ color: DS.inkSub }}>✓ {s}</p>)}
                        </div>
                        <div>
                          <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.danger }}>WEAKNESSES</div>
                          {(a.weaknesses || []).map((w: string, j: number) => <p key={j} className="text-[10px]" style={{ color: DS.inkSub }}>✗ {w}</p>)}
                        </div>
                        {a.distinctiveRisk && <p className="text-[9px] italic" style={{ color: DS.warning }}>⚠ {a.distinctiveRisk}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* DQ Principle */}
      <div className="flex items-start gap-3 p-3 rounded-xl mt-4" style={{ background: `${DS.alternatives.fill}10`, border: `1px solid ${DS.alternatives.fill}25` }}>
        <Lightbulb size={14} style={{ color: DS.alternatives.fill, flexShrink: 0, marginTop: 2 }} />
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.alternatives.fill }}>DQ PRINCIPLE</div>
          <p className="text-[11px] leading-relaxed" style={{ color: DS.inkSub }}>{DQ_PRINCIPLE}</p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-4 mt-2 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: DS.inkDis }}>
          <span>{strategies.length} strategies</span>
          <span>·</span><span>{focusDecisions.length} focus decisions</span>
          <span>·</span><span>{strategies.filter(s => completeness(s) === 100).length} complete</span>
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" style={{ background: DS.alternatives.fill }}
          onClick={() => { setOverviewTab('compare'); setActiveStratId(null); }}>
          Compare All <ChevronRight size={11} />
        </Button>
      </div>
    </div>
  );
}

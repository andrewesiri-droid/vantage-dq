import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Plus, Trash2, ChevronRight, Lightbulb, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface Strategy {
  id: number; name: string; colorIdx: number;
  objective: string; rationale: string; assumptions: string;
  uncertainties: string; risks: string; flexibility: string;
  selections: Record<string, number>;
}
interface FocusDec { id: string; label: string; choices: string[]; }

const TABS = [
  { id: 'builder', label: 'Builder' },
  { id: 'review', label: 'Review' },
  { id: 'compare', label: 'Compare & Contrast' },
  { id: 'analysis', label: 'Strategy Analysis' },
];

const DQ_PRINCIPLES: Record<string, string> = {
  builder: 'Good strategies are genuinely distinct. Each strategy should represent a coherent path — not a variation of the same idea with different names. Test for distinctiveness: if two strategies make the same choices on most Focus Decisions, they are the same strategy.',
  review: 'The strategy review checks for internal coherence and feasibility. A strategy is incoherent if its choices contradict each other. It is infeasible if any choice violates a known constraint.',
  compare: 'Compare and contrast reveals the real trade-offs. The goal is not to pick the "best" strategy — it is to understand what you gain and lose with each path, and to make that trade-off explicit.',
  analysis: 'AI strategy analysis uses the decision context, criteria, and issues to evaluate strategies on dimensions the team may not have considered. Use it to challenge, not to decide.',
};

export function StrategyTable({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [activeTab, setActiveTab] = useState('builder');
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [newName, setNewName] = useState('');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [distinctCheck, setDistinctCheck] = useState<any>(null);

  const focusDecisions: FocusDec[] = (data?.decisions || [])
    .filter((d: any) => d.tier === 'focus')
    .map((d: any) => ({ id: String(d.id), label: d.label, choices: d.choices || [] }));

  useEffect(() => {
    if (data?.strategies?.length) {
      setStrategies(data.strategies.map((s: any) => ({
        id: s.id, name: s.name, colorIdx: s.colorIdx || 0,
        objective: s.objective || '', rationale: s.rationale || s.description || '',
        assumptions: s.assumptions || '', uncertainties: s.uncertainties || '',
        risks: s.risks || '', flexibility: s.flexibility || '',
        selections: s.selections || {},
      })));
    }
  }, [data?.strategies]);

  const addStrategy = () => {
    if (!newName.trim()) return;
    const n: Strategy = { id: Date.now(), name: newName.trim(), colorIdx: strategies.length % 6, objective: '', rationale: '', assumptions: '', uncertainties: '', risks: '', flexibility: '', selections: {} };
    setStrategies(p => [...p, n]);
    hooks?.createStrategy?.({ sessionId, name: newName.trim() });
    setNewName('');
  };

  const removeStrategy = (id: number) => { setStrategies(p => p.filter(s => s.id !== id)); hooks?.deleteStrategy?.({ id }); };
  const updateStrategy = (id: number, field: string, val: string) => setStrategies(p => p.map(s => s.id === id ? { ...s, [field]: val } : s));
  const setSelection = (sid: number, did: string, idx: number) => setStrategies(p => p.map(s => s.id === sid ? { ...s, selections: { ...s.selections, [did]: idx } } : s));

  const completeness = (s: Strategy) => {
    const filled = focusDecisions.filter(d => s.selections[d.id] !== undefined).length;
    return focusDecisions.length ? Math.round((filled / focusDecisions.length) * 100) : 0;
  };

  const aiSuggest = () => {
    const decMenu = focusDecisions.map((d, i) => `D${i+1}: "${d.label}" — options: ${d.choices.map((c, j) => j+'='+c).join(', ')}`).join('\n');
    const existing = strategies.map(s => s.name).join(', ');
    const prompt = `Suggest 3 genuinely distinct strategies for this decision.\nDecision: ${data?.session?.decisionStatement || ''}\nContext: ${(data?.session?.context || '').slice(0,200)}\nFocus decisions:\n${decMenu}\nExisting: ${existing}\n\nReturn JSON: { strategies: [{name, rationale, objective, assumptions, selections (object with D1/D2/D3... mapped to choice index 0,1,2...)}] }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      const newStrats: Strategy[] = (result?.strategies || []).map((s: any, i: number) => {
        const sel: Record<string, number> = {};
        if (s.selections) focusDecisions.forEach((d, di) => {
          const key = `D${di+1}`;
          if (s.selections[key] !== undefined) sel[d.id] = Number(s.selections[key]);
        });
        return { id: Date.now()+i, name: s.name||`Strategy ${i+1}`, colorIdx: (strategies.length+i)%6, objective: s.objective||'', rationale: s.rationale||'', assumptions: s.assumptions||'', uncertainties: '', risks: '', flexibility: '', selections: sel };
      });
      setStrategies(p => [...p, ...newStrats]);
    });
  };

  const aiPickBest = () => {
    const critList = (data?.criteria || []).map((c: any) => c.label).join(', ');
    const stratList = strategies.map(s => `${s.name}: ${s.rationale||s.objective}`).join('; ');
    const prompt = `Recommend the best strategy.\nDecision: ${data?.session?.decisionStatement||''}\nStrategies: ${stratList}\nCriteria: ${critList}\nIssues: ${(data?.issues||[]).filter((i:any)=>i.severity==='Critical').map((i:any)=>i.text).slice(0,4).join('; ')}\n\nReturn JSON: { recommendation: string, confidence: High|Medium|Low, reasoning: string, keyTradeoff: string, alternativeIf: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) { setRecommendation(result); }
    });
  };

  const aiDistinct = () => {
    const summary = strategies.map(s => s.name + ': ' + focusDecisions.map(d => d.choices[s.selections[d.id]??-1]||'?').join(' / ')).join('\n');
    const prompt = `Check distinctiveness of these strategies.\n${summary}\n\nReturn JSON: { distinctivenessScore: 0-100, verdict: string, pairs: [{stratA, stratB, overlap: 0-100, issue, fix}], overallVerdict: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) { setDistinctCheck(result); setActiveTab('compare'); }
    });
  };

  const aiAnalyse = () => {
    const strats = strategies.map(s => `${s.name}: ${s.rationale||''}, assumptions: ${s.assumptions||''}`).join('\n');
    const prompt = `Provide a strategic analysis of each strategy.\nDecision: ${data?.session?.decisionStatement||''}\nStrategies:\n${strats}\nCriteria: ${(data?.criteria||[]).map((c:any)=>c.label).join(', ')}\n\nReturn JSON: { analyses: [{name, strengths: [string], weaknesses: [string], bestScenario: string, worstScenario: string, distinctiveRisk: string}], crossCuttingInsight: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) { setAnalysisResult(result); setActiveTab('analysis'); }
    });
  };

  const sColors = DS.sColors;
  const col = (idx: number) => sColors[idx % sColors.length];

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 04</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Strategy Table</h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiPickBest} disabled={busy||strategies.length<2}>
            + AI Pick Best Strategy
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiDistinct} disabled={busy||strategies.length<2}>
            <Sparkles size={11} /> Validate
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.alternatives.fill }} onClick={aiSuggest} disabled={busy}>
            <Sparkles size={11} /> AI Suggest Strategies
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiAnalyse} disabled={busy||!strategies.length}>
            AI Fill Existing
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-5" style={{ borderColor: DS.borderLight }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: activeTab === tab.id ? DS.alternatives.fill : DS.inkTer, borderBottom: activeTab === tab.id ? `2px solid ${DS.alternatives.fill}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Strategy selector chips */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>STRATEGIES:</span>
        {strategies.map(s => (
          <button key={s.id} onClick={() => setActiveTab('builder')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
            style={{ background: col(s.colorIdx).soft, color: col(s.colorIdx).fill, border: `1px solid ${col(s.colorIdx).fill}30` }}>
            <span className="w-2 h-2 rounded-full" style={{ background: col(s.colorIdx).fill }} />
            {s.name} <span className="opacity-60">{completeness(s)}%</span>
          </button>
        ))}
        <button onClick={() => { setNewName(''); document.getElementById('new-strat-input')?.focus(); }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all hover:opacity-80"
          style={{ background: DS.bg, color: DS.inkSub, border: `1px dashed ${DS.border}` }}>
          <Plus size={10} /> New Strategy
        </button>
      </div>

      {/* Recommendation banner */}
      {recommendation && (
        <div className="rounded-xl p-3 mb-4 flex items-start gap-3" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
          <CheckCircle size={16} style={{ color: DS.accent, flexShrink: 0, marginTop: 1 }} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-bold" style={{ color: DS.ink }}>Recommended: {recommendation.recommendation}</span>
              <Badge style={{ background: DS.accentSoft, color: DS.accent, border: 'none', fontSize: 9 }}>{recommendation.confidence}</Badge>
            </div>
            <p className="text-[10px]" style={{ color: DS.inkSub }}>{recommendation.reasoning}</p>
            {recommendation.keyTradeoff && <p className="text-[10px] mt-0.5 italic" style={{ color: DS.inkDis }}>Trade-off: {recommendation.keyTradeoff}</p>}
          </div>
          <button onClick={() => setRecommendation(null)} className="shrink-0"><X size={12} style={{ color: DS.inkDis }} /></button>
        </div>
      )}

      {/* === BUILDER TAB === */}
      {activeTab === 'builder' && (
        <div className="space-y-4">
          {/* Add strategy */}
          <div className="flex gap-2 p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
            <Input id="new-strat-input" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addStrategy()}
              placeholder="New strategy name…" className="flex-1 text-xs h-8 bg-white" />
            <Button size="sm" className="h-8 px-3 gap-1 text-xs" style={{ background: DS.alternatives.fill }} onClick={addStrategy} disabled={!newName.trim()}>
              <Plus size={12} /> Add
            </Button>
          </div>

          {/* Focus decisions header */}
          {focusDecisions.length > 0 && (
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
              {/* Column headers */}
              <div className="flex" style={{ background: DS.brand }}>
                <div className="w-48 shrink-0 px-4 py-3 text-[10px] font-bold text-white/70 uppercase tracking-wider">Strategy</div>
                {focusDecisions.map((d, i) => (
                  <div key={d.id} className="flex-1 min-w-32 px-3 py-3 border-l" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <span className="text-[9px] text-white/50 mr-1">{i+1}</span>
                    <span className="text-[10px] font-semibold text-white">{d.label}</span>
                  </div>
                ))}
                <button className="px-3 py-3 text-[10px] text-white/50 hover:text-white/80 transition-colors flex items-center gap-1 shrink-0">
                  <Plus size={10} /> Add Focus Decision
                </button>
              </div>

              {/* Strategy rows */}
              {strategies.map(s => {
                const c = col(s.colorIdx);
                const pct = completeness(s);
                return (
                  <div key={s.id} className="flex border-t" style={{ borderColor: DS.borderLight }}>
                    {/* Strategy info column */}
                    <div className="w-48 shrink-0 p-3" style={{ borderRight: `1px solid ${DS.borderLight}`, borderLeft: `3px solid ${c.fill}` }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.fill }} />
                        <span className="text-xs font-bold truncate" style={{ color: DS.ink }}>{s.name}</span>
                        <button onClick={() => removeStrategy(s.id)} className="ml-auto opacity-40 hover:opacity-100"><X size={10} style={{ color: DS.danger }} /></button>
                      </div>
                      <div className="text-[9px] font-bold mb-0.5" style={{ color: c.fill }}>
                        {pct < 50 ? 'partial' : pct < 100 ? 'mostly complete' : 'complete'}
                      </div>
                      <Textarea value={s.objective} onChange={e => updateStrategy(s.id, 'objective', e.target.value)}
                        placeholder="Objective — what is this strategy trying to achieve?" rows={2} className="text-[9px] resize-none mb-1.5 p-1.5" />
                      <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.inkDis }}>RATIONALE</div>
                      <Textarea value={s.rationale} onChange={e => updateStrategy(s.id, 'rationale', e.target.value)}
                        placeholder="Core logic and reasoning" rows={2} className="text-[9px] resize-none mb-1.5 p-1.5" />
                      <div className="grid grid-cols-2 gap-1">
                        <div>
                          <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.inkDis }}>KEY ASSUMPTIONS</div>
                          <Textarea value={s.assumptions} onChange={e => updateStrategy(s.id, 'assumptions', e.target.value)}
                            placeholder="Must be true for success?" rows={2} className="text-[9px] resize-none p-1.5" />
                        </div>
                        <div>
                          <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.inkDis }}>KEY UNCERTAINTIES</div>
                          <Textarea value={s.uncertainties} onChange={e => updateStrategy(s.id, 'uncertainties', e.target.value)}
                            placeholder="What could shift this?" rows={2} className="text-[9px] resize-none p-1.5" />
                        </div>
                      </div>
                    </div>

                    {/* Decision columns */}
                    {focusDecisions.map(d => (
                      <div key={d.id} className="flex-1 min-w-32 p-2 border-l flex flex-col gap-1" style={{ borderColor: DS.borderLight }}>
                        {d.choices.map((choice, i) => (
                          <button key={i} onClick={() => setSelection(s.id, d.id, i)}
                            className="w-full text-left text-[10px] px-2 py-1.5 rounded-lg transition-all"
                            style={{
                              background: s.selections[d.id] === i ? c.fill : DS.bg,
                              color: s.selections[d.id] === i ? '#fff' : DS.inkSub,
                              border: `1px solid ${s.selections[d.id] === i ? c.fill : DS.borderLight}`,
                              fontWeight: s.selections[d.id] === i ? 600 : 400,
                            }}>
                            {choice}
                          </button>
                        ))}
                        <button className="text-[9px] mt-0.5" style={{ color: DS.inkDis }}>+ option</button>
                      </div>
                    ))}
                  </div>
                );
              })}

              {strategies.length === 0 && (
                <div className="text-center py-10 bg-white">
                  <p className="text-xs" style={{ color: DS.inkDis }}>No strategies yet — add above or use AI Suggest</p>
                </div>
              )}
            </div>
          )}

          {focusDecisions.length === 0 && (
            <div className="text-center py-12 rounded-xl" style={{ background: DS.bg, border: `1px dashed ${DS.border}` }}>
              <p className="text-xs font-medium mb-1" style={{ color: DS.inkSub }}>No Focus Decisions defined yet</p>
              <p className="text-xs" style={{ color: DS.inkDis }}>Go to Decision Hierarchy and define your Focus Five first</p>
            </div>
          )}

          <DQPrinciple text={DQ_PRINCIPLES.builder} color={DS.alternatives.fill} />
        </div>
      )}

      {/* === REVIEW TAB === */}
      {activeTab === 'review' && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: DS.inkSub }}>Review each strategy for internal coherence and completeness.</p>
          {strategies.map(s => {
            const c = col(s.colorIdx);
            const pct = completeness(s);
            return (
              <div key={s.id} className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight, borderLeft: `4px solid ${c.fill}` }}>
                <div className="flex items-center gap-3 px-4 py-3" style={{ background: DS.bg }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: c.fill }} />
                  <span className="text-sm font-bold" style={{ color: DS.ink }}>{s.name}</span>
                  <Badge style={{ background: pct >= 80 ? DS.successSoft : DS.warnSoft, color: pct >= 80 ? DS.success : DS.warning, border: 'none' }}>{pct}% complete</Badge>
                  <div className="ml-auto flex gap-2">
                    {focusDecisions.filter(d => s.selections[d.id] === undefined).map(d => (
                      <span key={d.id} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: DS.dangerSoft, color: DS.danger }}>Missing: {d.label.slice(0,20)}</span>
                    ))}
                  </div>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 bg-white">
                  <div>
                    <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>OBJECTIVE</div>
                    <p className="text-xs" style={{ color: s.objective ? DS.ink : DS.inkDis }}>{s.objective || 'Not defined'}</p>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>RATIONALE</div>
                    <p className="text-xs" style={{ color: s.rationale ? DS.ink : DS.inkDis }}>{s.rationale || 'Not defined'}</p>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>DECISIONS</div>
                    <div className="flex flex-wrap gap-1">
                      {focusDecisions.map(d => {
                        const choice = d.choices[s.selections[d.id] ?? -1];
                        return <span key={d.id} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: choice ? c.soft : DS.dangerSoft, color: choice ? c.fill : DS.danger }}>{choice || '? ' + d.label.slice(0,12)}</span>;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <DQPrinciple text={DQ_PRINCIPLES.review} color={DS.alternatives.fill} />
        </div>
      )}

      {/* === COMPARE TAB === */}
      {activeTab === 'compare' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>Compare strategies side by side to understand the real trade-offs.</p>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiDistinct} disabled={busy}>
              <Sparkles size={11} /> Check Distinctiveness
            </Button>
          </div>

          {distinctCheck && (
            <div className="rounded-xl p-4" style={{ background: distinctCheck.distinctivenessScore >= 70 ? DS.successSoft : DS.warnSoft, border: `1px solid ${distinctCheck.distinctivenessScore >= 70 ? DS.success : DS.warning}30` }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-3xl font-black" style={{ color: distinctCheck.distinctivenessScore >= 70 ? DS.success : DS.warning }}>{distinctCheck.distinctivenessScore}</div>
                <div>
                  <div className="text-xs font-bold" style={{ color: DS.ink }}>Distinctiveness Score</div>
                  <p className="text-[10px]" style={{ color: DS.inkSub }}>{distinctCheck.verdict}</p>
                </div>
              </div>
              {(distinctCheck.pairs || []).map((p: any, i: number) => (
                <div key={i} className="text-[10px] mb-1" style={{ color: DS.inkSub }}>
                  <strong>{p.stratA}</strong> vs <strong>{p.stratB}</strong>: {p.overlap}% overlap — {p.issue}. Fix: {p.fix}
                </div>
              ))}
            </div>
          )}

          {/* Side by side comparison */}
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(strategies.length, 3)}, 1fr)` }}>
            {strategies.map(s => {
              const c = col(s.colorIdx);
              return (
                <div key={s.id} className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
                  <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: c.fill }}>
                    <span className="text-xs font-bold text-white">{s.name}</span>
                    <span className="text-[9px] text-white/60 ml-auto">{completeness(s)}%</span>
                  </div>
                  <div className="p-3 space-y-2 bg-white">
                    {focusDecisions.map(d => {
                      const choice = d.choices[s.selections[d.id] ?? -1];
                      return (
                        <div key={d.id}>
                          <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.inkDis }}>{d.label.slice(0,25)}</div>
                          <div className="text-[10px] font-medium px-2 py-1 rounded" style={{ background: choice ? c.soft : DS.bg, color: choice ? c.dark : DS.inkDis }}>{choice || '—'}</div>
                        </div>
                      );
                    })}
                    {s.rationale && <div className="text-[9px] italic pt-1 border-t" style={{ color: DS.inkDis, borderColor: DS.borderLight }}>{s.rationale.slice(0, 80)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <DQPrinciple text={DQ_PRINCIPLES.compare} color={DS.alternatives.fill} />
        </div>
      )}

      {/* === ANALYSIS TAB === */}
      {activeTab === 'analysis' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>AI-powered analysis across all strategies.</p>
            <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.alternatives.fill }} onClick={aiAnalyse} disabled={busy}>
              <Sparkles size={11} /> {busy ? 'Analysing…' : 'Run Analysis'}
            </Button>
          </div>

          {!analysisResult ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <Sparkles size={32} className="mx-auto mb-3 opacity-20" style={{ color: DS.alternatives.fill }} />
              <p className="text-sm font-medium mb-1" style={{ color: DS.ink }}>AI Strategy Analysis</p>
              <p className="text-xs mb-4" style={{ color: DS.inkTer }}>Evaluates each strategy on strengths, weaknesses, best/worst scenarios, and distinctive risks.</p>
              <Button style={{ background: DS.alternatives.fill }} onClick={aiAnalyse} disabled={busy} className="gap-2">
                <Sparkles size={14} /> Run Analysis
              </Button>
            </div>
          ) : (
            <>
              {analysisResult.crossCuttingInsight && (
                <div className="p-3 rounded-xl" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.accent }}>CROSS-CUTTING INSIGHT</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{analysisResult.crossCuttingInsight}</p>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {(analysisResult.analyses || []).map((a: any, i: number) => {
                  const strat = strategies.find(s => s.name === a.name);
                  const c = strat ? col(strat.colorIdx) : col(i);
                  return (
                    <div key={i} className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight, borderTop: `3px solid ${c.fill}` }}>
                      <div className="px-3 py-2 font-bold text-xs" style={{ background: DS.bg, color: DS.ink }}>{a.name}</div>
                      <div className="p-3 space-y-2">
                        <div>
                          <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.success }}>STRENGTHS</div>
                          {(a.strengths||[]).map((s: string, j: number) => <p key={j} className="text-[10px]" style={{ color: DS.inkSub }}>✓ {s}</p>)}
                        </div>
                        <div>
                          <div className="text-[8px] font-bold uppercase mb-0.5" style={{ color: DS.danger }}>WEAKNESSES</div>
                          {(a.weaknesses||[]).map((w: string, j: number) => <p key={j} className="text-[10px]" style={{ color: DS.inkSub }}>✗ {w}</p>)}
                        </div>
                        {a.distinctiveRisk && <p className="text-[9px] italic" style={{ color: DS.warning }}>⚠ {a.distinctiveRisk}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <DQPrinciple text={DQ_PRINCIPLES.analysis} color={DS.alternatives.fill} />
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: DS.inkDis }}>
          <span>{strategies.length} strategies</span>
          <span>·</span>
          <span>{focusDecisions.length} focus decisions</span>
          <span>·</span>
          <span>{strategies.filter(s => completeness(s) === 100).length} complete</span>
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" style={{ background: DS.alternatives.fill }}
          onClick={() => setActiveTab(TABS[Math.min(TABS.findIndex(t => t.id === activeTab)+1, TABS.length-1)].id)}>
          Next <ChevronRight size={11} />
        </Button>
      </div>
    </div>
  );
}

function DQPrinciple({ text, color = DS.alternatives.fill }: { text: string; color?: string }) {
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

import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS, RATING_LABELS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Lightbulb, ChevronRight, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface CritItem { id: number; label: string; type: string; weight: string; description?: string; }
interface StratItem { id: number; name: string; colorIdx: number; description?: string; }

const TABS = [
  { id: 'matrix', label: 'Scoring Matrix' },
  { id: 'radar', label: 'Radar' },
  { id: 'brief', label: 'Decision Brief' },
  { id: 'analysis', label: 'AI Analysis' },
];

const W: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const TYPE_COLORS: Record<string, string> = {
  financial: '#2563EB', strategic: '#7C3AED', operational: '#0891B2',
  risk: '#DC2626', commercial: '#D97706', technical: '#059669',
  social: '#DB2777', environmental: '#065F46',
};

const DQ_PRINCIPLES: Record<string, string> = {
  matrix: 'Score each strategy against each criterion independently. The scoring should reflect evidence, not preference. If you cannot articulate why a strategy scores 4 vs 3 on a criterion, the criterion may not be well-defined.',
  radar: 'The radar chart reveals the shape of each strategy\'s strengths and weaknesses. Strategies with similar shapes may not be genuinely distinct. Strategies with complementary shapes may be candidates for hybridisation.',
  brief: 'The Decision Brief is the output of the assessment: a clear, evidence-based recommendation with explicit trade-off acknowledgement. A good brief states not just what to do, but what is being given up.',
  analysis: 'AI analysis checks for groupthink, confirms trade-offs are real, and identifies if any criteria are non-discriminating. Non-discriminating criteria should be removed.',
};

export function QualitativeAssessment({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [activeTab, setActiveTab] = useState('matrix');
  const [criteria, setCriteria] = useState<CritItem[]>([]);
  const [strategies, setStrategies] = useState<StratItem[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [activeCell, setActiveCell] = useState<{ sid: number; cid: number } | null>(null);
  const [rationales, setRationales] = useState<Record<string, string>>({});
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [totalScored, setTotalScored] = useState(0);
  const [totalCells, setTotalCells] = useState(0);

  useEffect(() => {
    if (data?.criteria?.length) setCriteria(data.criteria.map((c: any) => ({ id: c.id, label: c.label, type: c.type, weight: c.weight, description: c.description || '' })));
    if (data?.strategies?.length) setStrategies(data.strategies.map((s: any) => ({ id: s.id, name: s.name, colorIdx: s.colorIdx || 0, description: s.description || '' })));
    if (data?.assessmentScores?.length) {
      const m: Record<string, number> = {};
      data.assessmentScores.forEach((s: any) => { m[`${s.strategyId}_${s.criterionId}`] = s.score; });
      setScores(m);
    }
  }, [data?.criteria, data?.strategies, data?.assessmentScores]);

  useEffect(() => {
    const total = criteria.length * strategies.length;
    const scored = Object.keys(scores).filter(k => scores[k] > 0).length;
    setTotalCells(total);
    setTotalScored(scored);
  }, [scores, criteria, strategies]);

  const getScore = (sid: number, cid: number) => scores[`${sid}_${cid}`] || 0;
  const setScore = (sid: number, cid: number, val: number) => {
    const key = `${sid}_${cid}`;
    setScores(p => ({ ...p, [key]: val }));
    hooks?.setScore?.({ sessionId, strategyId: sid, criterionId: cid, score: val });
  };

  const weightedTotal = (sid: number) => criteria.reduce((sum, c) => sum + getScore(sid, c.id) * (W[c.weight] || 1), 0);
  const maxPossible = criteria.reduce((sum, c) => sum + 5 * (W[c.weight] || 1), 0);
  const pct = (sid: number) => maxPossible ? Math.round((weightedTotal(sid) / maxPossible) * 100) : 0;

  const sColors = DS.sColors;
  const col = (idx: number) => sColors[idx % sColors.length];

  const aiInitAssessment = () => {
    const critList = criteria.map((c, i) => `${i+1}. ${c.label} [${c.weight}] — ${c.description || c.type}`).join('\n');
    const stratList = strategies.map((s, i) => `${i+1}. ${s.name}: ${s.description || ''}`).join('\n');
    const prompt = `Score these strategies on each criterion for this decision.\nDecision: "${data?.session?.decisionStatement || ''}"\n\nCriteria:\n${critList}\n\nStrategies:\n${stratList}\n\nReturn JSON: { scores: [{strategyIndex: 1-based, criterionIndex: 1-based, score: 1-5, rationale: string}] }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      const newScores = { ...scores };
      const newRationales = { ...rationales };
      (result?.scores || []).forEach((s: any) => {
        const strat = strategies[s.strategyIndex - 1];
        const crit = criteria[s.criterionIndex - 1];
        if (strat && crit) {
          const key = `${strat.id}_${crit.id}`;
          newScores[key] = Math.min(5, Math.max(1, Number(s.score) || 3));
          if (s.rationale) newRationales[key] = s.rationale;
          hooks?.setScore?.({ sessionId, strategyId: strat.id, criterionId: crit.id, score: newScores[key] });
        }
      });
      setScores(newScores);
      setRationales(newRationales);
    });
  };

  const aiAnalyse = () => {
    const matrix = strategies.map(s => s.name + ': ' + criteria.map(c => c.label + '=' + getScore(s.id, c.id)).join(', ')).join('\n');
    const prompt = `Analyse this assessment matrix for DQ quality.\nDecision: ${data?.session?.decisionStatement||''}\n\nMatrix:\n${matrix}\n\nReturn JSON: { qualityScore: 0-100, dominantStrategy: string, tradeOffInsights: [string], flags: [{type, severity: critical|warning, criterion, message}], recommendation: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) { setAnalysisResult(result); setActiveTab('analysis'); }
    });
  };

  const generateBrief = () => {
    const matrix = strategies.map(s => `${s.name}: weighted score ${weightedTotal(s.id)}/${maxPossible} (${pct(s.id)}%)`).join(', ');
    const topStrat = [...strategies].sort((a, b) => pct(b.id) - pct(a.id))[0];
    const prompt = `Write a Decision Brief based on this assessment.\nDecision: ${data?.session?.decisionStatement||''}\nScores: ${matrix}\nTop strategy: ${topStrat?.name}\nCriteria: ${criteria.map(c=>c.label).join(', ')}\n\nReturn JSON: { recommendedStrategy: string, headline: string, rationale: string, keyTradeoff: string, criticalAssumption: string, conditionsToRevisit: [string], nextStep: string, dqNote: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) { setBrief(result); setActiveTab('brief'); }
    });
  };

  const activeCellKey = activeCell ? `${activeCell.sid}_${activeCell.cid}` : null;
  const activeCellScore = activeCellKey ? (scores[activeCellKey] || 0) : 0;
  const activeCrit = activeCell ? criteria.find(c => c.id === activeCell.cid) : null;
  const activeStrat = activeCell ? strategies.find(s => s.id === activeCell.sid) : null;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 06</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Qualitative Assessment</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]" style={{ color: DS.inkDis }}>{totalScored}/{totalCells}</span>
          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${totalCells ? Math.round((totalScored/totalCells)*100) : 0}%`, background: DS.alternatives.fill }} />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">Score Guide</Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">Weights</Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiInitAssessment} disabled={busy}>
            <Sparkles size={11} /> AI Initial Assessment
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiAnalyse} disabled={busy}>
            + AI Analysis
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.alternatives.fill }} onClick={generateBrief} disabled={busy}>
            Decision Brief
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-0" style={{ borderColor: DS.borderLight }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: activeTab === tab.id ? DS.alternatives.fill : DS.inkTer, borderBottom: activeTab === tab.id ? `2px solid ${DS.alternatives.fill}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* === SCORING MATRIX TAB === */}
      {activeTab === 'matrix' && (
        <div className="flex gap-4">
          {/* Main grid */}
          <div className="flex-1 min-w-0 overflow-x-auto">
            <table className="w-full border-separate" style={{ borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider w-52" style={{ color: DS.inkTer, borderBottom: `2px solid ${DS.borderLight}` }}>Criterion</th>
                  {strategies.map(s => {
                    const c = col(s.colorIdx);
                    return (
                      <th key={s.id} className="px-3 py-3 text-center w-36" style={{ borderBottom: `2px solid ${DS.borderLight}` }}>
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: c.fill }} />
                            <span className="text-[11px] font-bold" style={{ color: c.fill }}>{s.name}</span>
                          </div>
                          <span className="text-[9px]" style={{ color: DS.inkDis }}>{s.description?.slice(0,30)||''}</span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkTer, borderBottom: `2px solid ${DS.borderLight}` }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((c, ci) => (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${DS.borderLight}` }}>
                    <td className="px-3 py-3 w-52" style={{ borderBottom: `1px solid ${DS.borderLight}` }}>
                      <div className="text-xs font-semibold mb-0.5" style={{ color: DS.ink }}>{c.label}</div>
                      <div className="flex items-center gap-1.5">
                        <Badge style={{ background: `${TYPE_COLORS[c.type]}15`, color: TYPE_COLORS[c.type], border: 'none', fontSize: 8 }}>{c.weight.toUpperCase()}</Badge>
                        <Badge style={{ background: `${TYPE_COLORS[c.type]}15`, color: TYPE_COLORS[c.type], border: 'none', fontSize: 8 }}>{c.type.toUpperCase()}</Badge>
                      </div>
                      {c.description && <p className="text-[9px] mt-1" style={{ color: DS.inkDis }}>{c.description.slice(0,50)}</p>}
                    </td>
                    {strategies.map(s => {
                      const sc = getScore(s.id, c.id);
                      const cc = col(s.colorIdx);
                      const isActive = activeCell?.sid === s.id && activeCell?.cid === c.id;
                      const rl = RATING_LABELS.find(r => r.value === sc);
                      return (
                        <td key={s.id} className="px-3 py-2 text-center" style={{ borderBottom: `1px solid ${DS.borderLight}` }}>
                          <button className="w-full flex flex-col items-center gap-1" onClick={() => setActiveCell(isActive ? null : { sid: s.id, cid: c.id })}>
                            <div className="flex justify-center gap-0.5">
                              {[1,2,3,4,5].map(v => (
                                <div key={v} className="w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center transition-all hover:scale-110 cursor-pointer"
                                  style={{ background: sc >= v ? cc.fill : DS.bg, color: sc >= v ? '#fff' : DS.inkDis, border: `1px solid ${sc >= v ? cc.fill : DS.border}` }}
                                  onClick={e => { e.stopPropagation(); setScore(s.id, c.id, v); }}>
                                  {v}
                                </div>
                              ))}
                            </div>
                            {sc === 0 ? (
                              <span className="text-[9px]" style={{ color: DS.inkDis }}>Not scored</span>
                            ) : (
                              <span className="text-[9px] font-medium" style={{ color: rl?.color || DS.inkSub }}>{rl?.label}</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center" style={{ borderBottom: `1px solid ${DS.borderLight}` }}>
                      {/* Relative comparison bar */}
                      <div className="flex flex-col gap-0.5">
                        {strategies.map(s => {
                          const sc = getScore(s.id, c.id);
                          const c2 = col(s.colorIdx);
                          return sc > 0 ? (
                            <div key={s.id} className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c2.fill }} />
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: DS.bg }}>
                                <div className="h-full rounded-full" style={{ width: `${(sc/5)*100}%`, background: c2.fill }} />
                              </div>
                              <span className="text-[9px] font-bold w-3" style={{ color: c2.fill }}>{sc}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Totals row */}
                <tr>
                  <td className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkTer }}>Weighted Total</td>
                  {strategies.map(s => {
                    const c = col(s.colorIdx);
                    const p = pct(s.id);
                    return (
                      <td key={s.id} className="px-3 py-3 text-center">
                        <div className="text-xl font-black" style={{ color: p >= 70 ? DS.success : p >= 45 ? DS.warning : DS.danger }}>{p}%</div>
                        <div className="text-[9px]" style={{ color: DS.inkDis }}>{weightedTotal(s.id)}/{maxPossible}</div>
                      </td>
                    );
                  })}
                  <td />
                </tr>
              </tbody>
            </table>

            <div className="pt-3">
              <DQPrinciple text={DQ_PRINCIPLES.matrix} color={DS.alternatives.fill} />
            </div>
          </div>

          {/* Score panel */}
          {activeCell && activeCrit && activeStrat && (
            <div className="w-56 shrink-0">
              <div className="sticky top-0 space-y-3">
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
                  <div className="px-3 py-2 flex items-center justify-between" style={{ background: DS.bg, borderBottom: `1px solid ${DS.borderLight}` }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>SCORE PANEL</span>
                    <button onClick={() => setActiveCell(null)}><X size={12} style={{ color: DS.inkDis }} /></button>
                  </div>
                  <div className="p-3 space-y-2">
                    <div>
                      <div className="text-[9px]" style={{ color: DS.inkDis }}>Criterion</div>
                      <div className="text-xs font-semibold" style={{ color: DS.ink }}>{activeCrit.label}</div>
                    </div>
                    <div>
                      <div className="text-[9px]" style={{ color: DS.inkDis }}>Strategy</div>
                      <div className="text-xs font-semibold" style={{ color: col(activeStrat.colorIdx).fill }}>{activeStrat.name}</div>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[1,2,3,4,5].map(v => {
                        const rl = RATING_LABELS.find(r => r.value === v);
                        const isSelected = activeCellScore === v;
                        const c = col(activeStrat.colorIdx);
                        return (
                          <button key={v} onClick={() => setScore(activeCell.sid, activeCell.cid, v)}
                            className="flex flex-col items-center p-1 rounded-lg transition-all"
                            style={{ background: isSelected ? c.fill : DS.bg, border: `1px solid ${isSelected ? c.fill : DS.border}` }}>
                            <span className="text-sm font-black" style={{ color: isSelected ? '#fff' : DS.ink }}>{v}</span>
                          </button>
                        );
                      })}
                    </div>
                    {activeCellScore > 0 && (
                      <div className="text-[10px] font-medium" style={{ color: RATING_LABELS.find(r => r.value === activeCellScore)?.color }}>
                        {RATING_LABELS.find(r => r.value === activeCellScore)?.label}: {RATING_LABELS.find(r => r.value === activeCellScore)?.desc}
                      </div>
                    )}
                    <textarea value={rationales[activeCellKey!] || ''} onChange={e => setRationales(p => ({ ...p, [activeCellKey!]: e.target.value }))}
                      placeholder="Rationale…" rows={3} className="w-full text-[10px] resize-none p-2 rounded border"
                      style={{ borderColor: DS.borderLight }} />
                  </div>
                </div>

                {/* Score guide */}
                <div className="rounded-xl p-3 border" style={{ borderColor: DS.borderLight }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>SCORE GUIDE</div>
                  {RATING_LABELS.map(rl => (
                    <div key={rl.value} className="flex items-start gap-2 mb-1.5">
                      <div className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ background: rl.color }}>{rl.value}</div>
                      <div>
                        <span className="text-[10px] font-bold" style={{ color: rl.color }}>{rl.label}</span>
                        <span className="text-[9px]" style={{ color: DS.inkDis }}> — {rl.desc.split('.')[0]}</span>
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 p-2 rounded" style={{ background: DS.accentSoft }}>
                    <div className="text-[8px] font-bold uppercase" style={{ color: DS.accent }}>DQ TIP</div>
                    <p className="text-[9px]" style={{ color: DS.inkSub }}>If all strategies score similarly on a criterion, that criterion may not be decision-relevant. Push for differentiation.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === RADAR TAB === */}
      {activeTab === 'radar' && (
        <div className="space-y-4 py-3">
          <p className="text-xs" style={{ color: DS.inkSub }}>Visual comparison of strategy scores across all criteria.</p>
          {/* Simple bar chart since we can't use SVG radar easily */}
          <div className="space-y-3">
            {criteria.map(c => (
              <div key={c.id}>
                <div className="text-xs font-medium mb-1.5" style={{ color: DS.ink }}>{c.label}</div>
                <div className="flex items-center gap-2">
                  {strategies.map(s => {
                    const sc = getScore(s.id, c.id);
                    const cc = col(s.colorIdx);
                    return (
                      <div key={s.id} className="flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: cc.fill }} />
                          <span className="text-[9px]" style={{ color: cc.fill }}>{s.name}</span>
                          <span className="text-[9px] font-bold ml-auto" style={{ color: sc >= 4 ? DS.success : sc >= 3 ? DS.inkSub : DS.danger }}>{sc || '—'}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: DS.bg }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${(sc/5)*100}%`, background: cc.fill }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <DQPrinciple text={DQ_PRINCIPLES.radar} color={DS.alternatives.fill} />
        </div>
      )}

      {/* === DECISION BRIEF TAB === */}
      {activeTab === 'brief' && (
        <div className="space-y-4 py-3">
          {!brief ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <Sparkles size={32} className="mx-auto mb-3 opacity-20" style={{ color: DS.alternatives.fill }} />
              <p className="text-sm font-medium mb-1" style={{ color: DS.ink }}>Generate Decision Brief</p>
              <p className="text-xs mb-4" style={{ color: DS.inkTer }}>AI writes a clear recommendation with trade-off acknowledgement based on your scores.</p>
              <Button style={{ background: DS.alternatives.fill }} onClick={generateBrief} disabled={busy} className="gap-2">
                <Sparkles size={14} /> Generate Brief
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl p-4" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.accent }}>RECOMMENDATION</div>
                <div className="text-lg font-black mb-1" style={{ color: DS.ink }}>{brief.recommendedStrategy}</div>
                <p className="text-sm" style={{ color: DS.inkSub }}>{brief.headline}</p>
              </div>
              {[['RATIONALE', brief.rationale], ['KEY TRADE-OFF', brief.keyTradeoff], ['CRITICAL ASSUMPTION', brief.criticalAssumption], ['NEXT STEP', brief.nextStep]].map(([title, val]) => val ? (
                <div key={title as string} className="p-3 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.inkDis }}>{title}</div>
                  <p className="text-xs" style={{ color: DS.ink }}>{val}</p>
                </div>
              ) : null)}
              {brief.conditionsToRevisit?.length > 0 && (
                <div className="p-3 rounded-xl" style={{ background: DS.warnSoft, border: `1px solid ${DS.warning}30` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.warning }}>CONDITIONS TO REVISIT THIS DECISION</div>
                  {brief.conditionsToRevisit.map((c: string, i: number) => (
                    <p key={i} className="text-xs" style={{ color: DS.inkSub }}>• {c}</p>
                  ))}
                </div>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={generateBrief} disabled={busy}>
                <Sparkles size={11} /> Regenerate
              </Button>
            </div>
          )}
          <DQPrinciple text={DQ_PRINCIPLES.brief} color={DS.alternatives.fill} />
        </div>
      )}

      {/* === AI ANALYSIS TAB === */}
      {activeTab === 'analysis' && (
        <div className="space-y-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>AI checks for groupthink, validates trade-offs, and identifies non-discriminating criteria.</p>
            <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.alternatives.fill }} onClick={aiAnalyse} disabled={busy}>
              <Sparkles size={11} /> {busy ? 'Analysing…' : 'Run Analysis'}
            </Button>
          </div>
          {!analysisResult ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <p className="text-sm font-medium mb-1" style={{ color: DS.ink }}>Run AI Analysis</p>
              <p className="text-xs mb-4" style={{ color: DS.inkTer }}>Checks for groupthink, validates trade-offs are real, and identifies non-discriminating criteria.</p>
              <Button style={{ background: DS.alternatives.fill }} onClick={aiAnalyse} disabled={busy} className="gap-2"><Sparkles size={14} /> Analyse</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: DS.alternatives.soft, border: `1px solid ${DS.alternatives.line}` }}>
                <div className="text-4xl font-black" style={{ color: analysisResult.qualityScore >= 70 ? DS.success : DS.warning }}>{analysisResult.qualityScore}</div>
                <div>
                  <div className="text-xs font-bold" style={{ color: DS.ink }}>Assessment Quality</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{analysisResult.recommendation}</p>
                  {analysisResult.dominantStrategy && <p className="text-[10px]" style={{ color: DS.success }}>Leading: {analysisResult.dominantStrategy}</p>}
                </div>
              </div>
              {(analysisResult.flags||[]).map((f: any, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: f.severity === 'critical' ? DS.dangerSoft : DS.warnSoft }}>
                  <AlertTriangle size={13} style={{ color: f.severity === 'critical' ? DS.danger : DS.warning, flexShrink: 0, marginTop: 1 }} />
                  <div><div className="text-[10px] font-semibold" style={{ color: DS.ink }}>{f.criterion}</div><div className="text-[9px]" style={{ color: DS.inkSub }}>{f.message}</div></div>
                </div>
              ))}
              {(analysisResult.tradeOffInsights||[]).map((t: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs p-2.5 rounded-lg" style={{ background: DS.bg }}>
                  <CheckCircle size={12} style={{ color: DS.information.fill, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ color: DS.inkSub }}>{t}</span>
                </div>
              ))}
            </div>
          )}
          <DQPrinciple text={DQ_PRINCIPLES.analysis} color={DS.alternatives.fill} />
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: DS.inkDis }}>
          <span>{totalScored}/{totalCells} cells scored</span>
          <span>·</span>
          <span>{strategies.length} strategies</span>
          <span>·</span>
          <span>{criteria.length} criteria</span>
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

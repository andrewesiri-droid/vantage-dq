import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS, DQ_ELEMENTS, DQ_SCORE_BANDS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Sparkles, Lightbulb, ChevronRight, ChevronDown, CheckCircle, AlertTriangle, X } from 'lucide-react';

const TABS = [
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'radar', label: 'Radar' },
  { id: 'narrative', label: 'DQ Narrative' },
  { id: 'improvements', label: 'Improvement Plan' },
];

const DQ_PRINCIPLES: Record<string, string> = {
  scorecard: 'The DQ Scorecard is a diagnostic, not a grade. A score of 45 on Information means the team should gather more evidence — not that they have failed. Use it to direct effort before commitment, not to judge quality after the fact.',
  radar: 'The radar shape matters as much as the overall score. A flat shape with all elements at 50 is worse than a shape with one element at 80 and one at 30 — because it means the team has not identified where the real weakness is.',
  narrative: 'The DQ narrative translates numbers into action. It answers: what does our score mean, what is the weakest link, and what must improve before we can commit with confidence?',
  improvements: 'Prioritise improvements by impact and effort. Raising the weakest element by 20 points will increase the overall score more than raising a strong element. The weakest link determines the ceiling.',
};

export function DQScorecard({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [activeTab, setActiveTab] = useState('scorecard');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [expandedEl, setExpandedEl] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<any>(null);
  const [improvements, setImprovements] = useState<any>(null);

  useEffect(() => {
    if (data?.session?.dqScores && Object.keys(data.session.dqScores).length > 0) {
      setScores(data.session.dqScores);
    } else {
      setScores({ frame: 0, alternatives: 0, information: 0, values: 0, reasoning: 0, commitment: 0 });
    }
  }, [data?.session?.dqScores]);

  const setScore = (key: string, val: number) => {
    const next = { ...scores, [key]: Math.min(100, Math.max(0, val)) };
    setScores(next);
    if (sessionId) hooks?.updateSession?.({ id: sessionId, data: { dqScores: next } });
  };

  const vals = Object.values(scores) as number[];
  const overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  const band = DQ_SCORE_BANDS.find(b => overall >= b.min && overall <= b.max) || DQ_SCORE_BANDS[4];
  const weakest = DQ_ELEMENTS.reduce((a, b) => (scores[a.key] || 0) < (scores[b.key] || 0) ? a : b, DQ_ELEMENTS[0]);
  const scoredCount = Object.values(scores).filter(v => v > 0).length;

  const aiAutoPopulate = () => {
    const ctx = {
      decisionStatement: data?.session?.decisionStatement || '',
      issues: (data?.issues || []).length,
      criticalIssues: (data?.issues || []).filter((i: any) => i.severity === 'Critical').length,
      strategies: (data?.strategies || []).length,
      criteria: (data?.criteria || []).length,
      stakeholders: (data?.stakeholderEntries || []).length,
      focusDecisions: (data?.decisions || []).filter((d: any) => d.tier === 'focus').length,
    };
    const prompt = `Score this decision on all 6 DQ elements (0-100 each).\n\nData: ${JSON.stringify(ctx)}\n\nScoring guide: 0-19=High-Risk, 20-44=Weak, 45-69=Adequate, 70-89=Strong, 90-100=Elite\n\nReturn JSON: { frame, alternatives, information, values, reasoning, commitment, rationale: {frame, alternatives, information, values, reasoning, commitment} }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (!result || result.error) return;
      const newScores: Record<string, number> = {};
      DQ_ELEMENTS.forEach(el => { if (typeof result[el.key] === 'number') newScores[el.key] = Math.min(100, Math.max(0, result[el.key])); });
      if (Object.keys(newScores).length) {
        setScores(p => ({ ...p, ...newScores }));
        if (sessionId) hooks?.updateSession?.({ id: sessionId, data: { dqScores: { ...scores, ...newScores } } });
      }
    });
  };

  const aiNarrative = () => {
    const scoreSummary = DQ_ELEMENTS.map(el => `${el.short}: ${scores[el.key] || 0}`).join(', ');
    const prompt = `Write an executive DQ narrative.\nDecision: ${data?.session?.decisionStatement||''}\nOverall: ${overall}/100 (${band.label})\nScores: ${scoreSummary}\n\nReturn JSON: { overallVerdict: string, readinessStatement: string, weakestLinkAnalysis: string, priorityActions: [{action, element, urgency: now|soon|later}], decidingNow: string, conditionalNote: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) { setNarrative(result); setActiveTab('narrative'); }
    });
  };

  const aiImprovements = () => {
    const weakElements = DQ_ELEMENTS.filter(el => (scores[el.key] || 0) < 70).map(el => `${el.short}: ${scores[el.key] || 0}`).join(', ');
    const prompt = `Create a DQ improvement plan.\nDecision: ${data?.session?.decisionStatement||''}\nElements below 70: ${weakElements}\n\nReturn JSON: { improvements: [{element, currentScore, targetScore, actions: [{action, effort: low|medium|high, impact: low|medium|high, timeframe: string}], quickWin: string}] }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) { setImprovements(result); setActiveTab('improvements'); }
    });
  };

  const gauge = (size: number, value: number) => {
    const r = (size - 16) / 2;
    const cx = size / 2, cy = size / 2;
    const circ = Math.PI * r;
    const offset = circ - (value / 100) * circ;
    const color = value >= 70 ? DS.success : value >= 45 ? DS.warning : value > 0 ? DS.danger : DS.borderLight;
    return { r, cx, cy, circ, offset, color };
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 06</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>DQ Scorecard</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge style={{ background: band.soft, color: band.color, border: 'none', fontWeight: 700 }}>{band.label}</Badge>
          <span className="text-[10px]" style={{ color: DS.inkDis }}>{scoredCount}/6 elements scored</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.reasoning.fill }} onClick={aiAutoPopulate} disabled={busy}>
            <Sparkles size={11} /> AI Auto-Populate
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiNarrative} disabled={busy}>
            Generate Narrative
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiImprovements} disabled={busy}>
            Improvement Plan
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-5" style={{ borderColor: DS.borderLight }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: activeTab === tab.id ? DS.reasoning.fill : DS.inkTer, borderBottom: activeTab === tab.id ? `2px solid ${DS.reasoning.fill}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
            {tab.id === 'narrative' && narrative && <span className="w-1.5 h-1.5 rounded-full ml-1 inline-block" style={{ background: DS.success }} />}
            {tab.id === 'improvements' && improvements && <span className="w-1.5 h-1.5 rounded-full ml-1 inline-block" style={{ background: DS.warning }} />}
          </button>
        ))}
      </div>

      {/* === SCORECARD TAB === */}
      {activeTab === 'scorecard' && (
        <div className="space-y-4">
          {/* Overall gauge */}
          <div className="flex items-center gap-6 p-5 rounded-2xl" style={{ background: `linear-gradient(135deg, ${DS.reasoning.soft}, ${DS.canvas})`, border: `1px solid ${DS.reasoning.line}` }}>
            <div className="shrink-0">
              {(() => { const g = gauge(140, overall); return (
                <svg width={140} height={140}>
                  <circle cx={g.cx} cy={g.cy} r={g.r} fill="none" stroke={DS.borderLight} strokeWidth={12} />
                  <circle cx={g.cx} cy={g.cy} r={g.r} fill="none" stroke={g.color} strokeWidth={12} strokeLinecap="round"
                    strokeDasharray={g.circ} strokeDashoffset={g.offset} transform={`rotate(-90 ${g.cx} ${g.cy})`} />
                  <text x={g.cx} y={g.cy-6} textAnchor="middle" fontSize={38} fontWeight="800" fill={DS.ink}>{overall}</text>
                  <text x={g.cx} y={g.cy+16} textAnchor="middle" fontSize={10} fill={DS.inkTer}>out of 100</text>
                </svg>
              ); })()}
            </div>
            <div className="flex-1">
              <div className="text-2xl font-black mb-0.5" style={{ color: band.color }}>{band.label}</div>
              <p className="text-sm mb-3" style={{ color: DS.inkSub }}>{band.desc}</p>
              {overall > 0 && weakest && (
                <div className="flex items-center gap-2 text-xs p-2.5 rounded-lg" style={{ background: DS.dangerSoft }}>
                  <AlertTriangle size={13} style={{ color: DS.danger, flexShrink: 0 }} />
                  <span style={{ color: DS.danger }}>Weakest link: <strong>{weakest.short}</strong> ({scores[weakest.key]||0}/100) — raising this has the highest impact on overall DQ</span>
                </div>
              )}
            </div>
            {/* Mini element scores */}
            <div className="shrink-0 grid grid-cols-3 gap-2">
              {DQ_ELEMENTS.map(el => {
                const sc = scores[el.key] || 0;
                const g = gauge(56, sc);
                return (
                  <div key={el.key} className="text-center cursor-pointer" onClick={() => { setExpandedEl(el.key); }}>
                    <svg width={56} height={56}>
                      <circle cx={g.cx} cy={g.cy} r={g.r} fill="none" stroke={DS.borderLight} strokeWidth={5} />
                      <circle cx={g.cx} cy={g.cy} r={g.r} fill="none" stroke={g.color} strokeWidth={5} strokeLinecap="round"
                        strokeDasharray={g.circ} strokeDashoffset={g.offset} transform={`rotate(-90 ${g.cx} ${g.cy})`} />
                      <text x={g.cx} y={g.cy+4} textAnchor="middle" fontSize={13} fontWeight="800" fill={g.color}>{sc}</text>
                    </svg>
                    <div className="text-[8px] font-bold" style={{ color: DS.inkTer }}>{el.short.slice(0,4)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Element detail cards */}
          <div className="space-y-2">
            {DQ_ELEMENTS.map(el => {
              const sc = scores[el.key] || 0;
              const isExpanded = expandedEl === el.key;
              const bandColor = sc >= 70 ? DS.success : sc >= 45 ? DS.warning : sc > 0 ? DS.danger : DS.inkDis;
              const bandLabel = sc >= 70 ? 'Strong' : sc >= 45 ? 'Adequate' : sc > 0 ? 'Weak' : 'Not scored';
              return (
                <div key={el.key} className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
                  {/* Progress bar top */}
                  <div className="h-1" style={{ background: `linear-gradient(to right, ${el.fill} ${sc}%, ${DS.borderLight} ${sc}%)` }} />
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedEl(isExpanded ? null : el.key)}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: el.fill }}>{el.num}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold" style={{ color: DS.ink }}>{el.short}</div>
                      <div className="text-[9px]" style={{ color: DS.inkTer }}>{el.label}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge style={{ background: `${bandColor}15`, color: bandColor, border: 'none', fontSize: 8 }}>{bandLabel}</Badge>
                      <span className="text-xl font-black w-8 text-right" style={{ color: bandColor }}>{sc}</span>
                      {isExpanded ? <ChevronDown size={14} style={{ color: DS.inkDis }} /> : <ChevronRight size={14} style={{ color: DS.inkDis }} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3" style={{ background: DS.canvas }}>
                      <p className="text-[11px] leading-relaxed" style={{ color: DS.inkSub }}>{el.desc}</p>

                      {/* Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px]" style={{ color: DS.inkDis }}>
                          <span>0 — High-Risk</span><span>45 — Adequate</span><span>70 — Strong</span><span>100 — Elite</span>
                        </div>
                        <Slider value={[sc]} min={0} max={100} step={5} onValueChange={([v]) => setScore(el.key, v)} className="w-full" />
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold" style={{ color: bandColor }}>{bandLabel}: {sc}/100</span>
                          <div className="flex gap-1">
                            {[20, 45, 70, 90].map(v => (
                              <button key={v} onClick={() => setScore(el.key, v)} className="text-[9px] px-1.5 py-0.5 rounded transition-all hover:opacity-80"
                                style={{ background: sc === v ? el.fill : DS.bg, color: sc === v ? '#fff' : DS.inkDis, border: `1px solid ${sc === v ? el.fill : DS.border}` }}>
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Diagnostic questions */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {el.questions.map((q, i) => (
                          <div key={i} className="flex items-start gap-1.5 p-2 rounded-lg text-[10px]" style={{ background: DS.bg }}>
                            <span style={{ color: el.fill, flexShrink: 0 }}>?</span>
                            <span style={{ color: DS.inkSub }}>{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DQPrinciple text={DQ_PRINCIPLES.scorecard} color={DS.reasoning.fill} />
        </div>
      )}

      {/* === RADAR TAB === */}
      {activeTab === 'radar' && (
        <div className="space-y-4 py-3">
          <p className="text-xs" style={{ color: DS.inkSub }}>Visual shape of your DQ profile across all six elements.</p>
          <div className="space-y-3">
            {DQ_ELEMENTS.map(el => {
              const sc = scores[el.key] || 0;
              const bandColor = sc >= 70 ? DS.success : sc >= 45 ? DS.warning : sc > 0 ? DS.danger : DS.inkDis;
              return (
                <div key={el.key} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-right">
                    <div className="text-[10px] font-bold" style={{ color: DS.ink }}>{el.short}</div>
                    <div className="text-[9px]" style={{ color: DS.inkDis }}>{el.num}</div>
                  </div>
                  <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: DS.bg }}>
                    <div className="h-full rounded-full transition-all flex items-center justify-end pr-2" style={{ width: `${sc}%`, background: el.fill, minWidth: sc > 0 ? 32 : 0 }}>
                      {sc > 10 && <span className="text-[9px] font-bold text-white">{sc}</span>}
                    </div>
                  </div>
                  <div className="w-16 shrink-0 flex items-center gap-1">
                    <Badge style={{ background: `${bandColor}15`, color: bandColor, border: 'none', fontSize: 8 }}>
                      {sc >= 70 ? 'Strong' : sc >= 45 ? 'Ok' : sc > 0 ? 'Weak' : '—'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
          <DQPrinciple text={DQ_PRINCIPLES.radar} color={DS.reasoning.fill} />
        </div>
      )}

      {/* === NARRATIVE TAB === */}
      {activeTab === 'narrative' && (
        <div className="space-y-4 py-3">
          {!narrative ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <Sparkles size={32} className="mx-auto mb-3 opacity-20" style={{ color: DS.reasoning.fill }} />
              <p className="text-sm font-medium mb-1" style={{ color: DS.ink }}>Generate DQ Narrative</p>
              <p className="text-xs mb-4" style={{ color: DS.inkTer }}>AI writes an executive narrative explaining your scores and what needs to improve before commitment.</p>
              <Button style={{ background: DS.reasoning.fill }} onClick={aiNarrative} disabled={busy} className="gap-2">
                <Sparkles size={14} /> Generate Narrative
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl p-4" style={{ background: DS.reasoning.soft, border: `1px solid ${DS.reasoning.line}` }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.reasoning.fill }}>OVERALL VERDICT</div>
                <p className="text-sm font-bold mb-1" style={{ color: DS.ink }}>{narrative.overallVerdict}</p>
                <p className="text-xs" style={{ color: DS.inkSub }}>{narrative.readinessStatement}</p>
              </div>
              {narrative.weakestLinkAnalysis && (
                <div className="p-3 rounded-xl" style={{ background: DS.dangerSoft, border: `1px solid ${DS.danger}20` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.danger }}>WEAKEST LINK ANALYSIS</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{narrative.weakestLinkAnalysis}</p>
                </div>
              )}
              {(narrative.priorityActions||[]).length > 0 && (
                <div className="space-y-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>PRIORITY ACTIONS</div>
                  {narrative.priorityActions.map((a: any, i: number) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 mt-0.5"
                        style={{ background: a.urgency === 'now' ? DS.danger : a.urgency === 'soon' ? DS.warning : DS.inkDis }}>
                        {i+1}
                      </div>
                      <div>
                        <div className="text-xs font-medium" style={{ color: DS.ink }}>{a.action}</div>
                        <div className="text-[9px]" style={{ color: DS.inkDis }}>{a.element} · {a.urgency}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {narrative.decidingNow && (
                <div className="p-3 rounded-xl" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.accent }}>DECIDING NOW</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{narrative.decidingNow}</p>
                </div>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiNarrative} disabled={busy}>
                <Sparkles size={11} /> Regenerate
              </Button>
            </div>
          )}
          <DQPrinciple text={DQ_PRINCIPLES.narrative} color={DS.reasoning.fill} />
        </div>
      )}

      {/* === IMPROVEMENTS TAB === */}
      {activeTab === 'improvements' && (
        <div className="space-y-4 py-3">
          {!improvements ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <p className="text-sm font-medium mb-1" style={{ color: DS.ink }}>Generate Improvement Plan</p>
              <p className="text-xs mb-4" style={{ color: DS.inkTer }}>Specific, prioritised actions to improve each weak DQ element.</p>
              <Button style={{ background: DS.reasoning.fill }} onClick={aiImprovements} disabled={busy} className="gap-2">
                <Sparkles size={14} /> Generate Plan
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {(improvements.improvements||[]).map((imp: any, i: number) => {
                const el = DQ_ELEMENTS.find(e => e.short.toLowerCase() === imp.element?.toLowerCase() || e.key === imp.element?.toLowerCase());
                return (
                  <div key={i} className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight, borderLeft: `4px solid ${el?.fill || DS.reasoning.fill}` }}>
                    <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: DS.bg }}>
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black text-white shrink-0" style={{ background: el?.fill || DS.reasoning.fill }}>{el?.num || i+1}</div>
                      <span className="text-xs font-bold" style={{ color: DS.ink }}>{imp.element}</span>
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-[9px]" style={{ color: DS.inkDis }}>{imp.currentScore} →</span>
                        <span className="text-[9px] font-bold" style={{ color: DS.success }}>{imp.targetScore}</span>
                      </div>
                    </div>
                    <div className="px-4 py-3 space-y-1.5 bg-white">
                      {(imp.actions||[]).map((a: any, j: number) => (
                        <div key={j} className="flex items-start gap-2 text-[10px]">
                          <Badge style={{ background: a.effort === 'low' ? DS.successSoft : a.effort === 'medium' ? DS.warnSoft : DS.dangerSoft, color: a.effort === 'low' ? DS.success : a.effort === 'medium' ? DS.warning : DS.danger, border: 'none', fontSize: 8, flexShrink: 0 }}>{a.effort}</Badge>
                          <span style={{ color: DS.inkSub }}>{a.action}</span>
                          {a.timeframe && <span className="ml-auto shrink-0" style={{ color: DS.inkDis }}>{a.timeframe}</span>}
                        </div>
                      ))}
                      {imp.quickWin && (
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t text-[10px]" style={{ borderColor: DS.borderLight, color: DS.success }}>
                          <CheckCircle size={10} /> Quick win: {imp.quickWin}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiImprovements} disabled={busy}>
                <Sparkles size={11} /> Regenerate
              </Button>
            </div>
          )}
          <DQPrinciple text={DQ_PRINCIPLES.improvements} color={DS.reasoning.fill} />
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: DS.inkDis }}>
          <span>Overall: <strong style={{ color: band.color }}>{overall}/100</strong></span>
          <span>·</span>
          <span>{scoredCount}/6 scored</span>
          <span>·</span>
          <span>Weakest: {weakest.short} ({scores[weakest.key]||0})</span>
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" style={{ background: DS.reasoning.fill }}
          onClick={() => setActiveTab(TABS[Math.min(TABS.findIndex(t => t.id === activeTab)+1, TABS.length-1)].id)}>
          Next <ChevronRight size={11} />
        </Button>
      </div>
    </div>
  );
}

function DQPrinciple({ text, color = DS.reasoning.fill }: { text: string; color?: string }) {
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

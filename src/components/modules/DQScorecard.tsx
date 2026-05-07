import { checkFrameGate } from '@/lib/dq-data-contracts';
      const _contract = buildContractPrompt('dq-scorecard', data);
import { buildContractPrompt } from '@/lib/dq-data-contracts';
import { computeMechanicalRecommendation } from '@/lib/dq-data-contracts';
import { useState, useEffect } from 'react';
import { useDQAI } from '@/hooks/useDQAI';
import { DQTrustBadge } from '@/components/ui/dq-trust-badge';
import type { ModuleProps } from '@/types';
import { DS, DQ_ELEMENTS, DQ_SCORE_BANDS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Lightbulb, ChevronRight } from 'lucide-react';

const SCORE_OPTIONS = [0, 20, 40, 60, 80, 100];

const TABS = [
  { id: 'scorecard', label: 'DQ Scorecard' },
  { id: 'chain', label: 'Chain Analysis' },
  { id: 'report', label: 'Full Report' },
];

export function DQScorecard({ sessionId, data, hooks }: ModuleProps) {
  const [busy, setBusy] = useState(false);
  const frameGate = checkFrameGate(data);
  const { call: dqCall, busy: dqBusy, lastResult: dqResult } = useDQAI();
  const [activeTab, setActiveTab] = useState('scorecard');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [commitChallenge, setCommitChallenge] = useState<any>(null);
  const mechanicalRec = computeMechanicalRecommendation(data);
  const hasAssessmentScores = (data?.assessmentScores?.length || 0) > 0;
  const commitmentContradiction = hasAssessmentScores && mechanicalRec.traceable && mechanicalRec.confidence === 'Low' && (scores.commitment || 0) >= 60;
  const marginWarning = hasAssessmentScores && mechanicalRec.traceable && mechanicalRec.margin < 10 && mechanicalRec.margin > 0;
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
    const next = { ...scores, [key]: val };
    setScores(next);
    if (sessionId) hooks?.updateSession?.({ id: sessionId, data: { dqScores: next } });
  };

  const vals = Object.values(scores) as number[];
  const overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  const band = DQ_SCORE_BANDS.find(b => overall >= b.min && overall <= b.max) || DQ_SCORE_BANDS[4];
  const weakest = DQ_ELEMENTS.reduce((a, b) => (scores[a.key] || 0) < (scores[b.key] || 0) ? a : b, DQ_ELEMENTS[0]);
  const scoredCount = Object.values(scores).filter(v => v > 0).length;
  const scoreColor = (s: number) => s >= 70 ? DS.success : s >= 45 ? DS.warning : s > 0 ? DS.danger : DS.inkDis;
  const scoreLabel = (s: number) => s >= 80 ? 'Elite' : s >= 60 ? 'Strong' : s >= 40 ? 'Adequate' : s > 0 ? 'Weak' : 'Unscored';

  const aiChallengeCommitment = async () => {
    const prompt = `${_contract}\n\nYou are a devil's advocate challenging a premature commitment decision.

Decision: ${data?.session?.decisionStatement || ''}
Commitment DQ score: ${scores.commitment || 0}/100
Mechanical recommendation confidence: ${mechanicalRec.confidence}
Strategy margin: ${mechanicalRec.margin} points
Critical unresolved issues: ${(data?.issues || []).filter((i: any) => i.severity === 'Critical' && i.status === 'open').map((i: any) => i.text).join('; ') || 'None'}
Lowest DQ element: ${Object.entries(scores).sort((a,b) => a[1]-b[1])[0]?.[0] || 'Unknown'} at ${Math.min(...Object.values(scores).filter(Boolean))}

Make the strongest case for WHY THIS DECISION IS NOT READY TO COMMIT.
Be specific. Reference the actual data.

Return JSON: {
  headline: string,
  reasons: [string],
  lowestElement: string,
  criticalQuestion: string,
  verdict: "Not ready|Proceed with conditions|Ready with caveats"
}`;
    try {
      const result = await dqCall(prompt, { module: 'dq-scorecard', dqElement: 'Commitment', sessionData: data || {} });
      if (result?.data) setCommitChallenge(result.data);
    } catch(e) { console.error(e); }
  };

  const aiAutoPopulate = async () => {
    const ctx = {
      decisionStatement: data?.session?.decisionStatement || '',
      issues: (data?.issues || []).length,
      strategies: (data?.strategies || []).length,
      criteria: (data?.criteria || []).length,
      focusDecisions: (data?.decisions || []).filter((d: any) => d.tier === 'focus').length,
    };
    const prompt = `You are an elite DQ facilitator.

THE 6 DQ ELEMENTS AND WHAT EACH MEASURES:

FRAME (Appropriate Frame):
- Measures: Is the right decision being made? Is it framed as an open question with clear scope?
- Score high (80+) if: Decision statement is a genuine open question, scope is explicit, owner and deadline exist
- Score low (<40) if: Decision is a goal in disguise, scope is undefined, or the frame excludes viable alternatives

ALTERNATIVES (Creative Alternatives):
- Measures: Are there genuinely distinct, creative alternatives being considered?
- Score high (80+) if: 3+ genuinely distinct alternatives, null option considered, no alternative is dominant by construction
- Score low (<40) if: Only 1-2 alternatives, they're variations of same approach, or the preferred answer is baked in

INFORMATION (Meaningful Information):
- Measures: Is the right information available to distinguish between alternatives?
- Score high (80+) if: Key uncertainties are identified, critical data gaps are named, no false precision
- Score low (<40) if: Key uncertainties are unknown/ignored, data is assumed without validation

VALUES (Clear Values):
- Measures: Are the right criteria being used, weighted correctly, reflecting real stakeholder values?
- Score high (80+) if: Criteria reflect genuine trade-offs, weights are defensible, no double-counting
- Score low (<40) if: Financial proxies substitute for real values, criteria aren't independent

REASONING (Sound Reasoning):
- Measures: Does the analysis logically connect information and values to conclusions?
- Score high (80+) if: Recommendations are traceable to data, assumptions are explicit, alternative interpretations acknowledged
- Score low (<40) if: Conclusions jump from data, assumptions are hidden, analysis confirms prior belief

COMMITMENT (Commitment to Action):
- Measures: Is the team ready to commit to a decision and execute?
- Score high (80+) if: All six elements are strong, stakeholders aligned, implementation plan exists
- Score low (<40) if: Any element is below 40, unresolved blockers, team not aligned

THE CEILING RULE:
The weakest element sets the ceiling for overall DQ quality.
A 90/90/90/90/90/20 decision has overall quality of ~20 — you cannot commit.

Score this decision on all 6 DQ elements (0-100, use multiples of 20).\nData: ${JSON.stringify(ctx)}\nScoring: 0=Unscored, 20=High-Risk, 40=Weak, 60=Adequate, 80=Strong, 100=Elite\nReturn JSON: { frame, alternatives, information, values, reasoning, commitment }`;
    setBusy(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, module: 'dq-scorecard' }) });
      dqCall(prompt, { module: 'dq-scorecard', dqElement: 'All 6 Elements', sessionData: data || {} }).then(r => { if (r?.trust) console.log('[DQ Trust dq-scorecard]', r.trust.label); });
      const d = await res.json();
      const _text = (d.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const _m = _text.match(/\{[\s\S]*\}/);
      if (_m) {
        let result = JSON.parse(_m[0]);
      if (!result || result.error) return;
      const newScores: Record<string, number> = {};
      DQ_ELEMENTS.forEach(el => {
        if (typeof result[el.key] === 'number') {
          newScores[el.key] = Math.round(result[el.key] / 20) * 20;
        }
      });
      if (Object.keys(newScores).length) {
        setScores(p => ({ ...p, ...newScores }));
        if (sessionId) hooks?.updateSession?.({ id: sessionId, data: { dqScores: { ...scores, ...newScores } } });
      }
      }
    } catch(e) { console.error('[dq-scorecard]', e); } finally { setBusy(false); }
  };

  const aiNarrative = async () => {
    const scoreSummary = DQ_ELEMENTS.map(el => `${el.short}: ${scores[el.key] || 0}`).join(', ');
    const prompt = `Executive DQ narrative.\nDecision: ${data?.session?.decisionStatement || ''}\nOverall: ${overall}/100 (${band.label})\nScores: ${scoreSummary}\nReturn JSON: { overallVerdict: string, readinessStatement: string, weakestLinkAnalysis: string, priorityActions: [{action, element, urgency: now|soon|later}], decidingNow: string }`;
    setBusy(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, module: 'dq-scorecard' }) });
      dqCall(prompt, { module: 'dq-scorecard', dqElement: 'All 6 Elements', sessionData: data || {} }).then(r => { if (r?.trust) console.log('[DQ Trust dq-scorecard]', r.trust.label); });
      const d = await res.json();
      const _text = (d.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const _m = _text.match(/\{[\s\S]*\}/);
      if (_m) {
        let result = JSON.parse(_m[0]);
      if (result && !result.error) { setNarrative(result); setActiveTab('report'); }
      }
    } catch(e) { console.error('[dq-scorecard]', e); } finally { setBusy(false); }
  };

  const aiImprovements = async () => {
    const weakEls = DQ_ELEMENTS.filter(el => (scores[el.key] || 0) < 60).map(el => `${el.short}: ${scores[el.key] || 0}`).join(', ');
    const prompt = `DQ improvement plan for: ${weakEls}.\nReturn JSON: { improvements: [{element, currentScore, targetScore, actions: [{action, effort: low|medium|high, timeframe}], quickWin}] }`;
    setBusy(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, module: 'dq-scorecard' }) });
      dqCall(prompt, { module: 'dq-scorecard', dqElement: 'All 6 Elements', sessionData: data || {} }).then(r => { if (r?.trust) console.log('[DQ Trust dq-scorecard]', r.trust.label); });
      const d = await res.json();
      const _text = (d.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const _m = _text.match(/\{[\s\S]*\}/);
      if (_m) {
        let result = JSON.parse(_m[0]);
      if (result && !result.error) { setImprovements(result); setActiveTab('chain'); }
      }
    } catch(e) { console.error('[dq-scorecard]', e); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-0">
            {frameGate.score < 30 && (
        <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
          <span className="text-lg">🔒</span>
          <span className="text-[10px] font-bold" style={{ color: '#D97706' }}>AI locked — complete Problem Frame first (score {frameGate.score}/30)</span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 06</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>DQ Scorecard</h2>
        </div>
        <div className="flex items-center gap-2">
          {scoredCount < 6 && <Badge style={{ background: DS.warnSoft, color: DS.warning, border: 'none', fontWeight: 700 }}>{6 - scoredCount} ELEMENTS UNSCORED</Badge>}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button size="sm" className="gap-1 text-xs h-7 shrink-0" style={{ background: DS.reasoning.fill }} onClick={aiAutoPopulate} disabled={busy}>
            <Sparkles size={11} /> {busy ? 'Populating…' : 'AI Auto-Populate'}
          </Button>
          <Button size="sm" variant="outline" className="gap-1 text-xs h-7 shrink-0" onClick={aiNarrative} disabled={busy}>Generate DQ Report</Button>
          <Button size="sm" className="gap-1 text-xs h-7 shrink-0" style={{ background: '#7F1D1D', color: '#fff' }} onClick={aiChallengeCommitment} disabled={busy}>
            👿 Challenge Commitment
          </Button>
        </div>
      </div>

      {/* Mechanical rec contradiction warning */}
      {commitChallenge && (
        <div className="rounded-xl overflow-hidden border-2" style={{ borderColor: '#7F1D1D' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ background: '#7F1D1D' }}>
            <div className="flex items-center gap-2">
              <span className="text-lg">👿</span>
              <span className="text-sm font-bold text-white">Commitment Challenge</span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: commitChallenge.verdict === 'Not ready' ? '#EF4444' : '#F59E0B' }}>{commitChallenge.verdict}</span>
            </div>
            <button onClick={() => setCommitChallenge(null)} className="text-white opacity-60 hover:opacity-100 text-xs">✕</button>
          </div>
          <div className="p-4 space-y-3" style={{ background: '#FEF2F2' }}>
            <p className="text-sm font-bold italic" style={{ color: '#7F1D1D' }}>"{commitChallenge.headline}"</p>
            {(commitChallenge.reasons || []).map((r: string, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs shrink-0" style={{ color: '#EF4444' }}>✗</span>
                <p className="text-xs" style={{ color: DS.ink }}>{r}</p>
              </div>
            ))}
            {commitChallenge.criticalQuestion && (
              <div className="rounded-xl p-3" style={{ background: '#FEE2E2', border: '1px solid #FECACA' }}>
                <div className="text-[9px] font-bold uppercase mb-1" style={{ color: '#EF4444' }}>CRITICAL QUESTION BEFORE COMMITTING</div>
                <p className="text-xs font-semibold" style={{ color: DS.ink }}>{commitChallenge.criticalQuestion}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {commitmentContradiction && (
        <div className="rounded-xl p-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <div className="text-[10px] font-bold mb-1" style={{ color: '#EF4444' }}>⚠ CONTRADICTION DETECTED</div>
          <p className="text-xs" style={{ color: DS.ink }}>Commitment score is {scores.commitment}/100 but mechanical recommendation shows Low Confidence — strategies are not sufficiently differentiated to justify commitment.</p>
        </div>
      )}
      {marginWarning && (
        <div className="rounded-xl p-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <div className="text-[10px] font-bold mb-1" style={{ color: '#D97706' }}>⚠ THIN MARGIN</div>
          <p className="text-xs" style={{ color: DS.ink }}>{mechanicalRec.recommendedStrategy} leads by only {mechanicalRec.margin} points — strategies are nearly equivalent. High commitment requires stronger differentiation.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-5 overflow-x-auto scrollbar-none" style={{ borderColor: DS.borderLight }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: activeTab === tab.id ? DS.reasoning.fill : DS.inkTer, borderBottom: activeTab === tab.id ? `2px solid ${DS.reasoning.fill}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
            {tab.id === 'report' && narrative && <span className="w-1.5 h-1.5 rounded-full ml-1.5 inline-block" style={{ background: DS.success }} />}
          </button>
        ))}
      </div>

      {/* === DQ SCORECARD TAB === */}
      {activeTab === 'scorecard' && (
        <div className="space-y-5">
          {/* Overall banner */}
          <div className="rounded-2xl p-5 flex items-center gap-6" style={{ background: `linear-gradient(135deg, ${DS.reasoning.soft}, ${DS.canvas})`, border: `1px solid ${DS.reasoning.line}` }}>
            <div className="text-center shrink-0">
              <div className="text-6xl font-black" style={{ color: scoreColor(overall) }}>{overall}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: DS.inkDis }}>OVERALL DQ</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-black" style={{ color: band.color }}>{band.label}</span>
                <Badge style={{ background: band.soft, color: band.color, border: 'none' }}>{scoredCount}/6 scored</Badge>
              </div>
              <p className="text-xs mb-3" style={{ color: DS.inkSub }}>{band.desc}</p>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: DS.bg }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${overall}%`, background: `linear-gradient(to right, ${DS.danger}, ${DS.warning} 45%, ${DS.success} 70%)` }} />
              </div>
              <div className="flex justify-between text-[9px] mt-1" style={{ color: DS.inkDis }}>
                <span>0</span><span>20 Weak</span><span>40 Adequate</span><span>60 Strong</span><span>80+ Elite</span>
              </div>
            </div>
            {overall > 0 && (
              <div className="shrink-0 text-center px-4 border-l" style={{ borderColor: DS.borderLight }}>
                <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>WEAKEST LINK</div>
                <div className="text-sm font-bold" style={{ color: DS.danger }}>{weakest.short}</div>
                <div className="text-2xl font-black" style={{ color: DS.danger }}>{scores[weakest.key] || 0}</div>
              </div>
            )}
          </div>

          {/* 3 × 2 card grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {DQ_ELEMENTS.map(el => {
              const sc = scores[el.key] || 0;
              const color = scoreColor(sc);
              const label = scoreLabel(sc);
              const size = 52; const r = 20; const cx = 26; const cy = 26;
              const circ = Math.PI * r;
              const offset = circ - (sc / 100) * circ;
              return (
                <div key={el.key} className="rounded-2xl overflow-hidden border flex flex-col" style={{ borderColor: DS.borderLight, background: '#fff' }}>
                  {/* Top fill bar */}
                  <div className="h-1.5 w-full" style={{ background: DS.bg }}>
                    <div className="h-full transition-all" style={{ width: `${sc}%`, background: el.fill }} />
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    {/* Header: label + gauge */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: el.fill }}>ELEMENT {el.num}</div>
                        <div className="text-sm font-bold mt-0.5 leading-tight" style={{ color: DS.ink }}>{el.label}</div>
                      </div>
                      <svg width={size} height={size} className="shrink-0">
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke={DS.borderLight} strokeWidth={5} />
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke={sc > 0 ? el.fill : DS.borderLight} strokeWidth={5}
                          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
                          transform={`rotate(-90 ${cx} ${cy})`} />
                        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fontWeight="800" fill={sc > 0 ? el.fill : DS.inkDis}>{sc}</text>
                      </svg>
                    </div>

                    {/* Description */}
                    <p className="text-[10px] leading-relaxed mb-3 flex-1" style={{ color: DS.inkSub }}>
                      {(el.desc || '').slice(0, 90)}{(el.desc || '').length > 90 ? '…' : ''}
                    </p>

                    {/* Score label */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>SCORE THIS ELEMENT</div>
                      <Badge style={{ background: `${color}18`, color, border: 'none', fontSize: 8, fontWeight: 700 }}>{label}</Badge>
                    </div>

                    {/* Score buttons: 0 20 40 60 80 100 */}
                    <div className="flex gap-1">
                      {SCORE_OPTIONS.map(v => {
                        const isSelected = sc === v;
                        const btnColor = v >= 80 ? DS.success : v >= 60 ? '#16a34a' : v >= 40 ? DS.warning : v > 0 ? DS.danger : DS.inkDis;
                        return (
                          <button key={v} onClick={() => setScore(el.key, v)}
                            className="flex-1 py-2 rounded-lg text-[9px] font-bold transition-all hover:opacity-90"
                            style={{
                              background: isSelected ? el.fill : DS.bg,
                              color: isSelected ? '#fff' : btnColor,
                              border: `1.5px solid ${isSelected ? el.fill : DS.borderLight}`,
                              transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                              boxShadow: isSelected ? `0 2px 8px ${el.fill}40` : 'none',
                            }}>
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DQ Gate principle */}
          <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: `${DS.reasoning.fill}10`, border: `1px solid ${DS.reasoning.fill}25` }}>
            <Lightbulb size={14} style={{ color: DS.reasoning.fill, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.reasoning.fill }}>DQ GATE</div>
              <p className="text-[11px] leading-relaxed" style={{ color: DS.inkSub }}>
                Would a senior decision advisor sign off on this quality level? A score below 40 on any element means commitment is premature. The weakest element determines the ceiling.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* === CHAIN ANALYSIS TAB === */}
      {activeTab === 'chain' && (
        <div className="space-y-4">
      {dqResult?.trust && <DQTrustBadge trust={dqResult.trust} meta={dqResult.meta} />}
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>Radar view + improvement plan for elements below 60.</p>
            <Button size="sm" className="gap-1 text-xs h-7 shrink-0" style={{ background: DS.reasoning.fill }} onClick={aiImprovements} disabled={busy}>
              <Sparkles size={11} /> {busy ? 'Generating…' : 'Generate Plan'}
            </Button>
          </div>
          <div className="space-y-2.5">
            {DQ_ELEMENTS.map(el => {
              const sc = scores[el.key] || 0;
              const color = scoreColor(sc);
              return (
                <div key={el.key} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-right">
                    <div className="text-[10px] font-bold" style={{ color: DS.ink }}>{el.short}</div>
                    <div className="text-[8px]" style={{ color: DS.inkDis }}>{el.num}</div>
                  </div>
                  <div className="flex-1 h-7 rounded-lg overflow-hidden relative" style={{ background: DS.bg }}>
                    <div className="h-full rounded-lg flex items-center transition-all" style={{ width: `${sc}%`, background: el.fill, minWidth: sc > 0 ? 36 : 0 }}>
                      {sc > 12 && <span className="text-[10px] font-bold text-white pl-2">{sc}</span>}
                    </div>
                    <div className="absolute top-0 bottom-0 w-px opacity-40" style={{ left: '40%', background: DS.warning }} />
                    <div className="absolute top-0 bottom-0 w-px opacity-40" style={{ left: '60%', background: DS.success }} />
                  </div>
                  <div className="w-16 shrink-0">
                    <Badge style={{ background: `${color}18`, color, border: 'none', fontSize: 8 }}>{scoreLabel(sc)}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
          {improvements ? (
            <div className="space-y-3 mt-4">
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>IMPROVEMENT PLAN</div>
              {(improvements.improvements || []).map((imp: any, i: number) => {
                const el = DQ_ELEMENTS.find(e => e.short.toLowerCase().startsWith((imp.element || '').toLowerCase().slice(0, 4)));
                return (
                  <div key={i} className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight, borderLeft: `4px solid ${el?.fill || DS.reasoning.fill}` }}>
                    <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: DS.bg }}>
                      <span className="text-xs font-bold" style={{ color: DS.ink }}>{imp.element}</span>
                      <span className="text-[10px]" style={{ color: DS.inkDis }}>{imp.currentScore} → <strong style={{ color: DS.success }}>{imp.targetScore}</strong></span>
                      {imp.quickWin && <span className="text-[9px] ml-auto" style={{ color: DS.success }}>⚡ {imp.quickWin}</span>}
                    </div>
                    <div className="px-4 py-3 space-y-1.5">
                      {(imp.actions || []).map((a: any, j: number) => (
                        <div key={j} className="flex items-start gap-2 text-[10px]">
                          <Badge style={{ background: a.effort === 'low' ? DS.successSoft : a.effort === 'medium' ? DS.warnSoft : DS.dangerSoft, color: a.effort === 'low' ? DS.success : a.effort === 'medium' ? DS.warning : DS.danger, border: 'none', fontSize: 8, flexShrink: 0 }}>{a.effort}</Badge>
                          <span style={{ color: DS.inkSub }}>{a.action}</span>
                          {a.timeframe && <span className="ml-auto shrink-0" style={{ color: DS.inkDis }}>{a.timeframe}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 rounded-xl" style={{ background: DS.bg }}>
              <p className="text-xs" style={{ color: DS.inkDis }}>Click Generate Plan for specific improvement actions</p>
            </div>
          )}
        </div>
      )}

      {/* === FULL REPORT TAB === */}
      {activeTab === 'report' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>Executive DQ narrative for stakeholders and board.</p>
            <Button size="sm" className="gap-1 text-xs h-7 shrink-0" style={{ background: DS.reasoning.fill }} onClick={aiNarrative} disabled={busy}>
              <Sparkles size={11} /> {busy ? 'Generating…' : narrative ? 'Regenerate' : 'Generate Report'}
            </Button>
          </div>
          {!narrative ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <Sparkles size={32} className="mx-auto mb-3 opacity-20" style={{ color: DS.reasoning.fill }} />
              <p className="text-sm font-medium mb-1" style={{ color: DS.ink }}>Generate DQ Report</p>
              <p className="text-xs mb-4" style={{ color: DS.inkTer }}>AI writes an executive narrative explaining your scores and what must improve before commitment.</p>
              <Button style={{ background: DS.reasoning.fill }} onClick={aiNarrative} disabled={busy} className="gap-2"><Sparkles size={14} /> Generate Report</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl p-4" style={{ background: DS.reasoning.soft, border: `1px solid ${DS.reasoning.line}` }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.reasoning.fill }}>OVERALL VERDICT</div>
                <p className="text-sm font-bold mb-1" style={{ color: DS.ink }}>{narrative.overallVerdict}</p>
                <p className="text-xs" style={{ color: DS.inkSub }}>{narrative.readinessStatement}</p>
              </div>
              {narrative.weakestLinkAnalysis && <div className="p-3 rounded-xl" style={{ background: DS.dangerSoft }}><div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.danger }}>WEAKEST LINK</div><p className="text-xs" style={{ color: DS.inkSub }}>{narrative.weakestLinkAnalysis}</p></div>}
              {(narrative.priorityActions || []).length > 0 && (
                <div className="space-y-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>PRIORITY ACTIONS</div>
                  {narrative.priorityActions.map((a: any, i: number) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0" style={{ background: a.urgency === 'now' ? DS.danger : a.urgency === 'soon' ? DS.warning : DS.inkDis }}>{i + 1}</div>
                      <div><div className="text-xs font-medium" style={{ color: DS.ink }}>{a.action}</div><div className="text-[9px]" style={{ color: DS.inkDis }}>{a.element} · {a.urgency}</div></div>
                    </div>
                  ))}
                </div>
              )}
              {narrative.decidingNow && <div className="p-3 rounded-xl" style={{ background: DS.accentSoft }}><div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.accent }}>DECIDING NOW</div><p className="text-xs" style={{ color: DS.inkSub }}>{narrative.decidingNow}</p></div>}
            </div>
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: DS.inkDis }}>
          <span>Overall: <strong style={{ color: band.color }}>{overall}/100 — {band.label}</strong></span>
          <span>·</span><span>{scoredCount}/6 scored</span>
          {overall > 0 && <><span>·</span><span>Weakest: {weakest.short} ({scores[weakest.key] || 0})</span></>}
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" style={{ background: DS.reasoning.fill }}
          onClick={() => setActiveTab(TABS[Math.min(TABS.findIndex(t => t.id === activeTab) + 1, TABS.length - 1)].id)}>
          Next <ChevronRight size={11} />
        </Button>
      </div>
    </div>
  );
}

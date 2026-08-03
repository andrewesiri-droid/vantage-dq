import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import {
  Sparkles, Target, CheckCircle2, ChevronDown,
  ChevronRight, AlertTriangle, FileText, Shield,
} from 'lucide-react';
import type { ValidatedProblemFrame } from '@/lib/dq/problemFrameSchema';

interface Props {
  acceptedItems?: any[];
  sessionData?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
  onValidated?: (output: any) => void;
}

interface ReasoningStep {
  step: number;
  title: string;
  finding: string;
  evidence: string;
  moduleSource: string;
}

interface Lineage {
  recommendedStrategy: string;
  recommendedStrategyRationale: string;
  reasoningChain: ReasoningStep[];
  confidenceVsOutcomeRisk: string;
  ifWeAreWrong: string[];
  earlyWarningIndicators: string[];
  boardReadinessVerdict: string;
  criticalAssumptions: string[];
  dissentingViews: string[];
  executiveSummary: string;
}

function safeArray(v: any): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) return v.split('\n').filter(Boolean);
  return [];
}

function getFrame(sd: any, ai: any[]): ValidatedProblemFrame | null {
  const raw = sd?.problemFrame ?? ai?.find((i: any) => i.targetType === 'problem_frame')?.data ?? null;
  if (!raw) return null;
  return {
    decisionStatement: raw.decisionStatement ?? '',
    context: raw.context ?? '',
    background: raw.background ?? '',
    trigger: raw.trigger ?? '',
    scopeIn: safeArray(raw.scopeIn),
    scopeOut: safeArray(raw.scopeOut),
    constraints: safeArray(raw.constraints),
    assumptions: safeArray(raw.assumptions),
    successCriteria: safeArray(raw.successCriteria),
    failureConsequences: raw.failureConsequences ?? '',
  };
}

async function callAI(prompt: string): Promise<any> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 5000, temperature: 0, system: 'You are a Decision Quality advisor grounded in established Decision Analysis methodology. PRINCIPLE — WEAKEST LINK: A decision is only as strong as its weakest DQ element. PRINCIPLE — PROCESS OVER OUTCOME: Quality is judged at decision time, not by outcome. PRINCIPLE — HANDOFF RULE: End every recommendation naming what the human must own, what you cannot determine, and what would change your analysis. Never recommend a strategy not in the Strategy Table. Never invent data not in the session. Be rigorous, honest, and traceable. Respond ONLY with valid JSON.', messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  const d = await r.json();
  const raw = d.content?.find((b: any) => b.type === 'text')?.text ?? '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

export default function DecisionLineage({ acceptedItems, sessionData, persistedState, onPersistState, onValidated }: Props) {
  const [lineage, setLineage] = useState<Lineage | null>(() => persistedState?.lineage ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const frame = useMemo(() => getFrame(sessionData, acceptedItems ?? []), [sessionData, acceptedItems]);
  const strategies = useMemo(() => sessionData?.strategies ?? persistedState?.strategies ?? [], [sessionData, persistedState]);

  useEffect(() => { onPersistState?.({ lineage }); }, [lineage]);

  const handleGenerate = useCallback(async () => {
    if (!frame) { setError('Problem Frame not found.'); return; }
    if (!strategies.length) { setError('No strategies found — complete Strategy Formation first.'); return; }

    setLoading(true); setError(null);

    const structuring = sessionData?.structuringOutput;
    const scores = sessionData?.assessmentScores ?? persistedState?.scores ?? [];
    const dqScore = sessionData?.dqScorecard?.overallScore ?? persistedState?.overallScore;
    const scenarioRobustness = sessionData?.scenarioRobustness ?? persistedState?.robustness ?? [];
    const risks = sessionData?.risks ?? persistedState?.risks ?? [];
    const stakeholders = sessionData?.stakeholders ?? persistedState?.stakeholders ?? [];

    // Find highest scored strategy
    const strategyScores = strategies.map((s: any) => {
      const stratScores = scores.filter((sc: any) => sc.strategyId === s.id || sc.strategyName === s.name);
      const avg = stratScores.length > 0 ? stratScores.reduce((sum: number, sc: any) => sum + sc.score, 0) / stratScores.length : 0;
      return { name: s.name, avg, riskPosture: s.riskPosture };
    }).sort((a: any, b: any) => b.avg - a.avg);

    const topStrategy = strategyScores[0]?.name ?? strategies[0]?.name;

    const prompt = `You are a DQ advisor. Synthesize a complete decision reasoning chain and recommendation.

CRITICAL RULE: Your recommendation MUST be one of these exact strategy names: ${strategies.map((s: any) => s.name).join(', ')}

DECISION: ${frame.decisionStatement}
TRIGGER: ${frame.trigger}
CONSTRAINTS: ${frame.constraints.join(', ') || 'None'}
FAILURE CONSEQUENCES: ${frame.failureConsequences || 'Not stated'}

STRATEGIES ANALYZED:
${strategies.map((s: any, i: number) => `${i + 1}. ${s.name} (${s.riskPosture})\n   Objective: ${s.objective}\n   Optimizes: ${s.tradeOffProfile?.optimizes}\n   Sacrifices: ${s.tradeOffProfile?.sacrifices}`).join('\n\n')}

EVALUATION SCORES (weighted averages):
${strategyScores.map((s: any) => `${s.name}: ${s.avg.toFixed(1)}/5`).join('\n')}

FOCUS DECISIONS:
${structuring?.focusDecisions?.map((d: any) => d.title).join('\n') ?? 'Not structured'}

KEY UNCERTAINTIES:
${structuring?.criticalUncertainties?.map((u: any) => u.title).join('\n') ?? 'Not identified'}

KEY TENSIONS:
${structuring?.tensions?.map((t: any) => `${t.sideA} vs ${t.sideB}`).join('\n') ?? 'None identified'}

SCENARIO ROBUSTNESS:
${scenarioRobustness.map((r: any) => `${r.strategyName}: ${r.robustnessScore}/100 — ${r.recommendation}`).join('\n') || 'Not assessed'}

CRITICAL RISKS:
${risks.filter((r: any) => r.severity === 'critical' || r.severity === 'high').map((r: any) => r.title).join('\n') || 'None identified'}

STAKEHOLDER ALIGNMENT:
${stakeholders.filter((s: any) => s.reviewStatus === 'accepted').map((s: any) => `${s.name}: ${s.alignment}`).join('\n') || 'Not assessed'}

DQ SCORE: ${dqScore ?? 'Not assessed'}

Build a complete decision lineage:

1. Reasoning chain: 5-7 steps showing how analysis led to recommendation
2. Confidence vs outcome risk: separate "we are confident in our analysis" from "the outcome is still uncertain"
3. If we are wrong: what would cause this recommendation to fail
4. Early warning indicators: specific signals to watch
5. Board readiness: honest assessment of whether this decision is ready to commit

Return ONLY valid JSON:
{
  "recommendedStrategy": "MUST be exact name from strategy list above",
  "recommendedStrategyRationale": "3-4 sentences explaining why this strategy",
  "reasoningChain": [
    { "step": 1, "title": "Step title", "finding": "What the analysis showed", "evidence": "Which module/data supports this", "moduleSource": "module name" }
  ],
  "confidenceVsOutcomeRisk": "Separate analysis confidence from outcome uncertainty",
  "ifWeAreWrong": ["what would cause this to fail"],
  "earlyWarningIndicators": ["specific measurable signal to watch"],
  "boardReadinessVerdict": "honest 1-2 sentence verdict on decision readiness",
  "criticalAssumptions": ["assumption that if wrong changes the recommendation"],
  "dissentingViews": ["alternative perspective worth noting"],
  "executiveSummary": "3-4 sentence executive summary"
}`;

    try {
      const result = await callAI(prompt);
      setLineage(result as Lineage);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [frame, strategies, sessionData, persistedState]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden" style={{ background: DS.bg }}>
      {frame?.decisionStatement && (
        <div className="shrink-0 px-6 py-3 flex items-start gap-3" style={{ background: DS.accentLight, borderBottom: `1px solid ${DS.accent}30` }}>
          <Target size={14} style={{ color: DS.accent, marginTop: 3, flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: DS.accent }}>Decision</p>
            <p className="text-sm font-semibold" style={{ color: DS.ink, lineHeight: '1.4' }}>{frame.decisionStatement}</p>
          </div>
        </div>
      )}

      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5" style={{ background: DS.surface, borderBottom: `1px solid ${DS.border}` }}>
        <button onClick={handleGenerate} disabled={loading || !frame || !strategies.length}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
          style={{ background: loading ? DS.surfaceAlt : DS.accent, color: loading ? DS.inkTer : '#fff' }}>
          <Sparkles size={12} /> {loading ? 'Synthesizing…' : 'Generate Decision Lineage'}
        </button>
        {lineage && (
          <div className="flex items-center gap-2 ml-2 px-3 py-1.5 rounded-lg" style={{ background: DS.accentLight }}>
            <span className="text-xs font-bold" style={{ color: DS.accent }}>Recommendation: {lineage.recommendedStrategy}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {error && <div className="rounded-xl p-3" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5' }}><p className="text-xs font-semibold" style={{ color: '#DC2626' }}>Error: {error}</p></div>}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <motion.div className="w-8 h-8 rounded-full border-2" style={{ borderColor: DS.accent, borderTopColor: 'transparent' }} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
            <p className="text-sm" style={{ color: DS.inkTer }}>Synthesizing decision reasoning chain…</p>
          </div>
        )}

        {!loading && !lineage && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-5xl">🔗</div>
            <p className="text-sm font-semibold" style={{ color: DS.inkTer }}>No lineage yet</p>
            <p className="text-xs text-center max-w-sm" style={{ color: DS.inkFaint }}>
              Generate a traceable reasoning chain showing how each module of analysis led to the recommendation. This is the "show your work" document.
            </p>
          </div>
        )}

        {!loading && lineage && (
          <>
            {/* Hero recommendation */}
            <div className="rounded-2xl p-6" style={{ background: DS.accent, color: '#fff' }}>
              <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">Recommendation</p>
              <p className="text-2xl font-bold mb-3">{lineage.recommendedStrategy}</p>
              <p className="text-sm opacity-90 leading-relaxed">{lineage.recommendedStrategyRationale}</p>
            </div>

            {/* Executive summary */}
            <div className="rounded-xl p-5" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: DS.inkTer }}>Executive Summary</p>
              <p className="text-sm" style={{ color: DS.ink, lineHeight: '1.7' }}>{lineage.executiveSummary}</p>
            </div>

            {/* Reasoning chain */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: DS.inkTer }}>Reasoning Chain</p>
              <div className="space-y-2">
                {lineage.reasoningChain.map((step, i) => (
                  <div key={i} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${DS.border}` }}>
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" style={{ background: DS.surfaceAlt }} onClick={() => setExpandedStep(expandedStep === i ? null : i)}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: DS.accent, color: '#fff' }}>{step.step}</div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold" style={{ color: DS.ink }}>{step.title}</p>
                        <p className="text-xs" style={{ color: DS.inkTer }}>{step.moduleSource}</p>
                      </div>
                      <motion.div animate={{ rotate: expandedStep === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown size={14} style={{ color: DS.inkTer }} />
                      </motion.div>
                    </div>
                    <AnimatePresence>
                      {expandedStep === i && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                          <div className="px-4 pb-4 pt-3 space-y-2" style={{ borderTop: `1px solid ${DS.border}` }}>
                            <p className="text-sm" style={{ color: DS.ink, lineHeight: '1.6' }}>{step.finding}</p>
                            <p className="text-xs italic" style={{ color: DS.inkFaint }}>Evidence: {step.evidence}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>

            {/* Confidence vs outcome risk */}
            <div className="rounded-xl p-4" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <p className="text-xs font-bold mb-2" style={{ color: '#1D4ED8' }}>📊 Confidence vs Outcome Risk</p>
              <p className="text-sm" style={{ color: DS.ink, lineHeight: '1.6' }}>{lineage.confidenceVsOutcomeRisk}</p>
            </div>

            {/* If we are wrong */}
            {lineage.ifWeAreWrong?.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: '#FEF3C7', border: '1px solid #FCD34D' }}>
                <p className="text-xs font-bold mb-2" style={{ color: '#92400E' }}>⚠️ If We Are Wrong</p>
                {lineage.ifWeAreWrong.map((item, i) => <p key={i} className="text-xs mb-1 pl-2" style={{ color: '#78350F' }}>· {item}</p>)}
              </div>
            )}

            {/* Early warning indicators */}
            {lineage.earlyWarningIndicators?.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
                <p className="text-xs font-bold mb-2" style={{ color: DS.inkTer }}>📡 Early Warning Indicators</p>
                {lineage.earlyWarningIndicators.map((item, i) => <p key={i} className="text-xs mb-1 pl-2" style={{ color: DS.inkTer }}>· {item}</p>)}
              </div>
            )}

            {/* Board readiness */}
            <div className="rounded-xl p-4" style={{ background: DS.surface, border: `2px solid ${DS.accent}30` }}>
              <p className="text-xs font-bold mb-2" style={{ color: DS.accent }}>🏛️ Board Readiness Verdict</p>
              <p className="text-sm" style={{ color: DS.ink, lineHeight: '1.6' }}>{lineage.boardReadinessVerdict}</p>
            </div>

            {/* Proceed */}
            <div className="rounded-xl p-4" style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={() => onValidated?.(lineage)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                style={{ background: DS.accent, color: '#fff', boxShadow: `0 4px 14px ${DS.accent}40` }}>
                <CheckCircle2 size={16} /> Proceed to Export Report
              </motion.button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import {
  Sparkles, Target, CheckCircle2, ChevronDown,
  TrendingUp, Shield, AlertTriangle, Brain,
  FileText, Download, Award,
} from 'lucide-react';
import type { ValidatedProblemFrame } from '@/lib/dq/problemFrameSchema';

interface Props {
  acceptedItems?: any[];
  sessionData?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
  onValidated?: (output: any) => void;
}

interface Recommendation {
  recommendedStrategy: string;
  recommendedStrategyRationale: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  confidenceRationale: string;
  keyConditions: string[];
  criticalAssumptions: string[];
  immediateNextSteps: string[];
  monitoringTriggers: string[];
  contingencyPlan: string;
  dissentingViews: string[];
  executiveSummary: string;
  decisionStatement: string;
}

function safeArray(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) return val.split('\n').filter(Boolean);
  return [];
}

function getFrame(sessionData: any, acceptedItems: any[]): ValidatedProblemFrame | null {
  const raw = sessionData?.problemFrame ?? acceptedItems?.find((i: any) => i.targetType === 'problem_frame')?.data ?? null;
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
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 5000,
      temperature: 0,
      system: 'You are a Decision Quality advisor preparing an executive recommendation. Be direct, honest, and action-oriented. Respond ONLY with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const raw = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

const CONFIDENCE_META = {
  high:   { color: '#059669', bg: '#DCFCE7', label: 'High Confidence' },
  medium: { color: '#D97706', bg: '#FEF3C7', label: 'Medium Confidence' },
  low:    { color: '#DC2626', bg: '#FEF2F2', label: 'Low Confidence' },
};

function Section({ title, icon, items, color }: { title: string; icon: string; items: string[]; color: string }) {
  if (!items.length) return null;
  return (
    <div className="rounded-xl p-4" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color }}>
        {icon} {title}
      </p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: color + '20', color }}>
              {i + 1}
            </div>
            <p className="text-sm" style={{ color: DS.ink, lineHeight: '1.5' }}>{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExecutiveRecommendation({ acceptedItems, sessionData, persistedState, onPersistState, onValidated }: Props) {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(() => persistedState?.recommendation ?? null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const frame = useMemo(() => getFrame(sessionData, acceptedItems ?? []), [sessionData, acceptedItems]);
  useEffect(() => { onPersistState?.({ recommendation }); }, [recommendation]);

  const handleGenerate = useCallback(async () => {
    if (!frame) { setAiError('Problem Frame not found.'); return; }
    setAiLoading(true); setAiError(null);

    const strategies = sessionData?.strategies ?? [];
    const structuring = sessionData?.structuringOutput;
    const scorecardDims = persistedState?.dimensions ?? [];
    const overallDQScore = scorecardDims.length > 0
      ? Math.round(scorecardDims.reduce((s: number, d: any) => s + d.score, 0) / scorecardDims.length)
      : null;

    // Find dominant strategy from evaluation
    const evaluationScores = persistedState?.scores ?? [];
    const strategyScoreTotals = strategies.map((s: any) => ({
      id: s.id, name: s.name,
      total: evaluationScores.filter((sc: any) => sc.strategyId === s.id).reduce((sum: number, sc: any) => sum + sc.score, 0),
      count: evaluationScores.filter((sc: any) => sc.strategyId === s.id).length,
    })).sort((a: any, b: any) => (b.count > 0 ? b.total / b.count : 0) - (a.count > 0 ? a.total / a.count : 0));

    const leadingStrategy = strategyScoreTotals[0]?.name ?? 'Not yet determined';

    const prompt = `You are a Decision Quality advisor. Synthesize all analysis into an executive recommendation.

DECISION: ${frame.decisionStatement}
TRIGGER: ${frame.trigger}
CONSTRAINTS: ${frame.constraints.join(', ') || 'None'}
FAILURE CONSEQUENCES: ${frame.failureConsequences || 'Not stated'}

STRATEGIES ANALYZED: ${strategies.map((s: any) => `${s.name} (${s.riskPosture})`).join(', ')}
LEADING STRATEGY FROM EVALUATION: ${leadingStrategy}
OVERALL DQ SCORE: ${overallDQScore ?? 'Not assessed'}

FOCUS DECISIONS:
${structuring?.focusDecisions?.map((d: any) => d.title).join('\n') ?? 'Not structured'}

CRITICAL UNCERTAINTIES:
${structuring?.criticalUncertainties?.map((u: any) => u.title).join('\n') ?? 'Not identified'}

KEY TENSIONS:
${structuring?.tensions?.map((t: any) => `${t.sideA} vs ${t.sideB}`).join('\n') ?? 'None identified'}

Based on all the analysis, provide an executive recommendation:

1. Recommend the best strategy and why
2. State confidence level and why
3. List the key conditions that must be true
4. List critical assumptions to monitor
5. Define immediate next steps (specific, actionable)
6. Define monitoring triggers (when to revisit)
7. Provide a contingency plan
8. Note any dissenting perspectives

Return ONLY valid JSON:
{
  "recommendedStrategy": "strategy name",
  "recommendedStrategyRationale": "3-4 sentence rationale",
  "confidenceLevel": "high|medium|low",
  "confidenceRationale": "why this confidence level",
  "keyConditions": ["condition that must be true"],
  "criticalAssumptions": ["assumption to monitor"],
  "immediateNextSteps": ["specific actionable step with owner"],
  "monitoringTriggers": ["event that should trigger review"],
  "contingencyPlan": "what to do if conditions change",
  "dissentingViews": ["alternative perspective"],
  "executiveSummary": "3-4 sentence executive summary of the recommendation",
  "decisionStatement": "the decision that has been made"
}`;

    try {
      const result = await callAI(prompt);
      setRecommendation(result as Recommendation);
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  }, [frame, sessionData, persistedState]);

  const confMeta = recommendation ? CONFIDENCE_META[recommendation.confidenceLevel] : null;

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
        <button onClick={handleGenerate} disabled={aiLoading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
          style={{ background: aiLoading ? DS.surfaceAlt : DS.accent, color: aiLoading ? DS.inkTer : '#fff' }}>
          <Sparkles size={12} /> {aiLoading ? 'Synthesizing…' : 'Generate Recommendation'}
        </button>
        {recommendation && (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs font-bold" style={{ color: DS.ink }}>Recommended:</span>
            <span className="text-xs px-3 py-1 rounded-full font-bold" style={{ background: DS.accentLight, color: DS.accent }}>
              {recommendation.recommendedStrategy}
            </span>
            {confMeta && (
              <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: confMeta.bg, color: confMeta.color }}>
                {confMeta.label}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {aiError && <div className="rounded-xl p-3" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5' }}><p className="text-xs font-semibold" style={{ color: '#DC2626' }}>Error: {aiError}</p></div>}

        {aiLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <motion.div className="w-8 h-8 rounded-full border-2" style={{ borderColor: DS.accent, borderTopColor: 'transparent' }}
              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
            <p className="text-sm" style={{ color: DS.inkTer }}>Synthesizing decision intelligence into recommendation…</p>
          </div>
        )}

        {!aiLoading && !recommendation && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-5xl">📋</div>
            <p className="text-sm font-semibold" style={{ color: DS.inkTer }}>No recommendation yet</p>
            <p className="text-xs text-center max-w-sm" style={{ color: DS.inkFaint }}>
              Click "Generate Recommendation" to synthesize all analysis into an executive-grade recommendation package.
            </p>
          </div>
        )}

        {!aiLoading && recommendation && (
          <>
            {/* Hero recommendation card */}
            <div className="rounded-2xl p-6" style={{ background: DS.accent, color: '#fff' }}>
              <div className="flex items-center gap-2 mb-3">
                <Award size={18} />
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">Recommendation</p>
              </div>
              <p className="text-xl font-bold mb-2">{recommendation.recommendedStrategy}</p>
              <p className="text-sm opacity-90 leading-relaxed">{recommendation.recommendedStrategyRationale}</p>
              {confMeta && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  {recommendation.confidenceLevel === 'high' ? '✅' : recommendation.confidenceLevel === 'medium' ? '⚠️' : '❗'} {confMeta.label}
                  <span className="opacity-70">— {recommendation.confidenceRationale}</span>
                </div>
              )}
            </div>

            {/* Executive summary */}
            <div className="rounded-xl p-5" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: DS.inkTer }}>📄 Executive Summary</p>
              <p className="text-sm" style={{ color: DS.ink, lineHeight: '1.7' }}>{recommendation.executiveSummary}</p>
            </div>

            <Section title="Key Conditions" icon="🔑" items={recommendation.keyConditions} color="#1D4ED8" />
            <Section title="Critical Assumptions to Monitor" icon="💭" items={recommendation.criticalAssumptions} color="#7C3AED" />
            <Section title="Immediate Next Steps" icon="🚀" items={recommendation.immediateNextSteps} color="#059669" />
            <Section title="Monitoring Triggers" icon="📡" items={recommendation.monitoringTriggers} color="#D97706" />

            {recommendation.contingencyPlan && (
              <div className="rounded-xl p-4" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#DC2626' }}>🔄 Contingency Plan</p>
                <p className="text-sm" style={{ color: DS.ink, lineHeight: '1.6' }}>{recommendation.contingencyPlan}</p>
              </div>
            )}

            {recommendation.dissentingViews?.length > 0 && (
              <Section title="Dissenting Views" icon="🗣️" items={recommendation.dissentingViews} color="#64748B" />
            )}

            {/* Complete */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-5 text-center"
              style={{ background: '#DCFCE7', border: '1px solid #86EFAC' }}>
              <CheckCircle2 size={24} style={{ color: '#059669', margin: '0 auto 8px' }} />
              <p className="text-base font-bold" style={{ color: '#065F46' }}>Phase 1 Complete</p>
              <p className="text-sm mt-1" style={{ color: '#059669' }}>
                Decision intelligence captured → Structured → Evaluated → Recommended
              </p>
              <button onClick={() => onValidated?.(recommendation)}
                className="mt-4 px-6 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: '#059669', color: '#fff' }}>
                Proceed to Phase 2 Analysis →
              </button>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

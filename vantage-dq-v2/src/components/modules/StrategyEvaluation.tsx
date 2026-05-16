import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import {
  Sparkles, Target, CheckCircle2, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Brain, BarChart2,
  ChevronDown, Info, Zap, Shield,
} from 'lucide-react';
import type { ValidatedProblemFrame } from '@/lib/dq/problemFrameSchema';
import { ContractGate } from '@/components/dq/ContractGate';

// ── Types ────────────────────────────────────────────────────

interface Props {
  acceptedItems?: any[];
  sessionData?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
  onValidated?: (output: EvaluationOutput) => void;
}

type ScoreValue = 1 | 2 | 3 | 4 | 5;
type Confidence = 'high' | 'medium' | 'low';
type StrategyRating = 'dominant' | 'robust' | 'fragile' | 'polarizing' | 'dominated' | 'unrated';

interface Criterion {
  id: string;
  title: string;
  weight: 1 | 2 | 3 | 4 | 5;
  type: string;
  source: 'structuring' | 'frame' | 'user';
}

interface Score {
  criterionId: string;
  strategyId: string;
  score: ScoreValue;
  rationale: string;
  confidence: Confidence;
  evidenceFlags: string[];
}

interface StrategyAnalysis {
  strategyId: string;
  rating: StrategyRating;
  strengths: string[];
  weaknesses: string[];
  keyAssumptions: string[];
  vulnerabilities: string[];
  weightedScore: number;
  confidenceLevel: Confidence;
}

interface EvaluationOutput {
  scores: Score[];
  analyses: StrategyAnalysis[];
  tradeOffs: string[];
  dominantStrategy?: string;
  recommendation: string;
}

// ── Helpers ──────────────────────────────────────────────────

function makeId() { return `ev_${Math.random().toString(36).slice(2, 9)}`; }

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

function getStrategies(sessionData: any, persistedState: any): any[] {
  return persistedState?.strategies ?? sessionData?.strategies ?? [];
}

function getCriteria(sessionData: any): Criterion[] {
  const fromStructuring = sessionData?.structuringOutput?.criteria ?? [];
  return fromStructuring.map((c: any) => ({
    id: c.id ?? makeId(),
    title: c.title,
    weight: c.weight ?? 3,
    type: c.type ?? 'value',
    source: 'structuring' as const,
  }));
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
      system: 'You are a world-class Decision Quality analyst. Evaluate strategies rigorously and honestly. Expose trade-offs, vulnerabilities, and hidden assumptions. Respond ONLY with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const raw = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ── Score cell ────────────────────────────────────────────────

function ScoreCell({ score, color, onClick }: { score: Score | undefined; color: string; onClick: () => void }) {
  if (!score) return (
    <button onClick={onClick} className="w-full h-full flex items-center justify-center rounded-lg text-xs font-medium transition-all"
      style={{ background: DS.surfaceAlt, color: DS.inkFaint, minHeight: 48, border: `1px dashed ${DS.border}` }}>
      Score
    </button>
  );

  const bg = score.score >= 4 ? '#DCFCE7' : score.score >= 3 ? '#FEF3C7' : '#FEE2E2';
  const textColor = score.score >= 4 ? '#059669' : score.score >= 3 ? '#D97706' : '#DC2626';
  const confDot = score.confidence === 'high' ? '#059669' : score.confidence === 'medium' ? '#D97706' : '#DC2626';

  return (
    <button onClick={onClick} className="w-full h-full flex flex-col items-center justify-center rounded-lg transition-all"
      style={{ background: bg, minHeight: 48, border: `1.5px solid ${color}30` }}>
      <span className="text-lg font-bold" style={{ color: textColor }}>{score.score}</span>
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: confDot }} />
        <span className="text-xs" style={{ color: textColor, opacity: 0.7 }}>/5</span>
      </div>
    </button>
  );
}

// ── Score edit modal ──────────────────────────────────────────

function ScoreModal({ criterion, strategy, existing, strategyColor, onSave, onClose }: {
  criterion: Criterion; strategy: any; existing?: Score;
  strategyColor: string; onSave: (score: Score) => void; onClose: () => void;
}) {
  const [score, setScore] = useState<ScoreValue>(existing?.score ?? 3);
  const [rationale, setRationale] = useState(existing?.rationale ?? '');
  const [confidence, setConfidence] = useState<Confidence>(existing?.confidence ?? 'medium');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
        className="rounded-2xl p-6 w-full max-w-md space-y-4"
        style={{ background: DS.surface, boxShadow: DS.shadowLg }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: DS.inkTer }}>Scoring</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: strategyColor }}>{strategy.name}</span>
            <span className="text-sm" style={{ color: DS.inkTer }}>×</span>
            <span className="text-sm font-semibold" style={{ color: DS.ink }}>{criterion.title}</span>
          </div>
        </div>

        {/* Score selector */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: DS.inkTer }}>Score (1 = poor, 5 = excellent)</p>
          <div className="flex gap-2">
            {([1, 2, 3, 4, 5] as ScoreValue[]).map(v => (
              <button key={v} onClick={() => setScore(v)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: score === v ? (v >= 4 ? '#DCFCE7' : v >= 3 ? '#FEF3C7' : '#FEE2E2') : DS.surfaceAlt,
                  color: score === v ? (v >= 4 ? '#059669' : v >= 3 ? '#D97706' : '#DC2626') : DS.inkTer,
                  border: `2px solid ${score === v ? (v >= 4 ? '#86EFAC' : v >= 3 ? '#FCD34D' : '#FCA5A5') : DS.border}`,
                }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Rationale */}
        <div>
          <p className="text-xs font-semibold mb-1.5" style={{ color: DS.inkTer }}>Rationale</p>
          <textarea rows={3} value={rationale} onChange={e => setRationale(e.target.value)}
            placeholder="Why does this strategy score this way on this criterion?"
            className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
            style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}`, color: DS.ink, outline: 'none', lineHeight: '1.5' }} />
        </div>

        {/* Confidence */}
        <div>
          <p className="text-xs font-semibold mb-1.5" style={{ color: DS.inkTer }}>Confidence in this score</p>
          <div className="flex gap-2">
            {(['high', 'medium', 'low'] as Confidence[]).map(c => (
              <button key={c} onClick={() => setConfidence(c)}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium capitalize"
                style={{
                  background: confidence === c ? (c === 'high' ? '#DCFCE7' : c === 'medium' ? '#FEF3C7' : '#FEE2E2') : DS.surfaceAlt,
                  color: confidence === c ? (c === 'high' ? '#059669' : c === 'medium' ? '#D97706' : '#DC2626') : DS.inkTer,
                  border: `1px solid ${confidence === c ? (c === 'high' ? '#86EFAC' : c === 'medium' ? '#FCD34D' : '#FCA5A5') : DS.border}`,
                }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={() => onSave({ criterionId: criterion.id, strategyId: strategy.id, score, rationale, confidence, evidenceFlags: [] })}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold flex-1 justify-center"
            style={{ background: DS.accent, color: '#fff' }}>
            Save Score
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm" style={{ background: DS.surfaceAlt, color: DS.inkTer }}>Cancel</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Strategy analysis card ────────────────────────────────────

const RATING_META: Record<StrategyRating, { label: string; color: string; bg: string; icon: string }> = {
  dominant:   { label: 'Dominant',    color: '#059669', bg: '#DCFCE7', icon: '👑' },
  robust:     { label: 'Robust',      color: '#1D4ED8', bg: '#EFF6FF', icon: '🛡️' },
  fragile:    { label: 'Fragile',     color: '#D97706', bg: '#FEF3C7', icon: '⚠️' },
  polarizing: { label: 'Polarizing',  color: '#7C3AED', bg: '#F5F3FF', icon: '⚡' },
  dominated:  { label: 'Dominated',   color: '#DC2626', bg: '#FEF2F2', icon: '❌' },
  unrated:    { label: 'Unrated',     color: '#64748B', bg: '#F8FAFC', icon: '◯' },
};

function AnalysisCard({ analysis, strategy, color }: { analysis: StrategyAnalysis; strategy: any; color: string }) {
  const [expanded, setExpanded] = useState(false);
  const ratingMeta = RATING_META[analysis.rating];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${color}30` }}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(e => !e)}
        style={{ background: color + '08' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: color + '20' }}>
          {ratingMeta.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color }}>{strategy?.name ?? 'Unknown'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: ratingMeta.bg, color: ratingMeta.color }}>{ratingMeta.label}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: DS.surfaceAlt, color: DS.inkTer }}>
              Score: {analysis.weightedScore.toFixed(1)}
            </span>
          </div>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} style={{ color: DS.inkTer }} />
        </motion.div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4" style={{ borderTop: `1px solid ${DS.border}` }}>
              {analysis.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-1.5" style={{ color: '#059669' }}>✅ Strengths</p>
                  {analysis.strengths.map((s, i) => <p key={i} className="text-xs mb-1 pl-3" style={{ color: DS.inkTer }}>· {s}</p>)}
                </div>
              )}
              {analysis.weaknesses.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-1.5" style={{ color: '#DC2626' }}>⚠️ Weaknesses</p>
                  {analysis.weaknesses.map((w, i) => <p key={i} className="text-xs mb-1 pl-3" style={{ color: DS.inkTer }}>· {w}</p>)}
                </div>
              )}
              {analysis.vulnerabilities.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-1.5" style={{ color: '#D97706' }}>🔍 Vulnerabilities</p>
                  {analysis.vulnerabilities.map((v, i) => <p key={i} className="text-xs mb-1 pl-3" style={{ color: DS.inkTer }}>· {v}</p>)}
                </div>
              )}
              {analysis.keyAssumptions.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-1.5" style={{ color: '#7C3AED' }}>💭 Key Assumptions</p>
                  {analysis.keyAssumptions.map((a, i) => <p key={i} className="text-xs mb-1 pl-3" style={{ color: DS.inkTer }}>· {a}</p>)}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────

export default function StrategyEvaluation({ acceptedItems, sessionData, persistedState, onPersistState, onValidated }: Props) {
  const [scores, setScores] = useState<Score[]>(() => persistedState?.scores ?? []);
  const [criteria, setCriteria] = useState<Criterion[]>(() => persistedState?.criteria ?? []);
  const [analyses, setAnalyses] = useState<StrategyAnalysis[]>(() => persistedState?.analyses ?? []);
  const [tradeOffs, setTradeOffs] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'matrix' | 'analysis' | 'tradeoffs'>('matrix');
  const [modalData, setModalData] = useState<{ criterion: Criterion; strategy: any } | null>(null);

  const frame = useMemo(() => getFrame(sessionData, acceptedItems ?? []), [sessionData, acceptedItems]);
  const strategies = useMemo(() => getStrategies(sessionData, persistedState), [sessionData, persistedState]);

  // Load criteria from structuring output if not already loaded
  useEffect(() => {
    if (criteria.length === 0) {
      const fromStructuring = getCriteria(sessionData);
      if (fromStructuring.length > 0) setCriteria(fromStructuring);
      else if (frame?.successCriteria.length) {
        setCriteria(frame.successCriteria.map((c, i) => ({
          id: `cr_${i}`, title: c, weight: 3, type: 'value', source: 'frame' as const,
        })));
      }
    }
  }, [sessionData, frame]);

  useEffect(() => { onPersistState?.({ scores, criteria, analyses }); }, [scores, criteria, analyses]);

  // ── Weighted scores ──────────────────────────────────────────

  const weightedScores = useMemo(() => {
    return strategies.map((s: any) => {
      const stratScores = scores.filter(sc => sc.strategyId === s.id);
      const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
      if (!stratScores.length || !totalWeight) return { strategyId: s.id, score: 0 };
      const weighted = stratScores.reduce((sum, sc) => {
        const crit = criteria.find(c => c.id === sc.criterionId);
        return sum + sc.score * (crit?.weight ?? 1);
      }, 0);
      return { strategyId: s.id, score: weighted / totalWeight };
    });
  }, [scores, criteria, strategies]);

  // ── AI: Auto-score ───────────────────────────────────────────

  const handleAutoScore = useCallback(async () => {
    if (!frame || !strategies.length || !criteria.length) {
      setAiError('Need strategies and criteria before scoring.'); return;
    }
    setAiLoading(true); setAiError(null);

    const strategySummary = strategies.map((s: any) =>
      `ID: ${s.id}\nName: ${s.name}\nObjective: ${s.objective}\nRationale: ${s.rationale}\nRisk: ${s.riskPosture}\nOptimizes: ${s.tradeOffProfile?.optimizes}\nSacrifices: ${s.tradeOffProfile?.sacrifices}`
    ).join('\n\n');

    const criteriaSummary = criteria.map(c => `ID: ${c.id}\nCriterion: ${c.title}\nWeight: ${c.weight}/5`).join('\n');

    const prompt = `You are a Decision Quality analyst. Score each strategy against each criterion.

DECISION: ${frame.decisionStatement}
CONSTRAINTS: ${frame.constraints.join(', ')}

STRATEGIES:
${strategySummary}

CRITERIA:
${criteriaSummary}

SCORING RULES:
- Score 1-5 (1=poor, 3=neutral, 5=excellent)
- Be honest and differentiated — not all 3s
- Include specific rationale for each score
- Flag low confidence where evidence is weak
- A strategy that violates a constraint scores 1 on feasibility

Return ONLY valid JSON:
{
  "scores": [
    {
      "criterionId": "",
      "strategyId": "",
      "score": 3,
      "rationale": "specific reason for this score",
      "confidence": "high|medium|low",
      "evidenceFlags": []
    }
  ]
}`;

    try {
      const result = await callAI(prompt);
      setScores(result.scores ?? []);
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  }, [frame, strategies, criteria]);

  // ── AI: Dominance analysis ───────────────────────────────────

  const handleDominanceAnalysis = useCallback(async () => {
    if (!scores.length) { setAiError('Score strategies first.'); return; }
    setAiLoading(true); setAiError(null);

    const scoreSummary = strategies.map((s: any) => {
      const ws = weightedScores.find(w => w.strategyId === s.id);
      const stratScores = scores.filter(sc => sc.strategyId === s.id)
        .map(sc => `${criteria.find(c => c.id === sc.criterionId)?.title}: ${sc.score}/5 (${sc.confidence}) — ${sc.rationale}`)
        .join('\n  ');
      return `Strategy: ${s.name} (weighted: ${ws?.score.toFixed(1)})\n  ${stratScores}`;
    }).join('\n\n');

    const prompt = `You are a Decision Quality analyst. Analyze strategy performance and identify patterns.

DECISION: ${frame?.decisionStatement}

SCORED STRATEGIES:
${scoreSummary}

ANALYZE:
1. Which strategy is dominant (best across most criteria)?
2. Which strategies are robust (perform well even under uncertainty)?
3. Which are fragile (depend on narrow assumptions)?
4. Which are dominated (worse than another on most criteria)?
5. What are the key trade-offs between strategies?
6. What does each strategy uniquely optimize?

RATING OPTIONS: dominant, robust, fragile, polarizing, dominated

Return ONLY valid JSON:
{
  "analyses": [
    {
      "strategyId": "",
      "rating": "robust",
      "strengths": [],
      "weaknesses": [],
      "keyAssumptions": [],
      "vulnerabilities": [],
      "weightedScore": 0,
      "confidenceLevel": "medium"
    }
  ],
  "tradeOffs": ["trade-off description"],
  "dominantStrategy": "strategy name or null",
  "recommendation": "2-3 sentence synthesis of what the scores reveal"
}`;

    try {
      const result = await callAI(prompt);
      setAnalyses(result.analyses ?? []);
      setTradeOffs(result.tradeOffs ?? []);
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  }, [scores, strategies, criteria, weightedScores, frame]);

  // ── Save score ───────────────────────────────────────────────

  const saveScore = useCallback((score: Score) => {
    setScores(p => {
      const existing = p.findIndex(s => s.criterionId === score.criterionId && s.strategyId === score.strategyId);
      if (existing >= 0) { const n = [...p]; n[existing] = score; return n; }
      return [...p, score];
    });
    setModalData(null);
  }, []);

  const STRATEGY_COLORS = ['#4F6AF5', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2'];

  const scoredCount = new Set(scores.map(s => s.strategyId)).size;
  const isReady = scoredCount >= 2 && analyses.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden" style={{ background: DS.bg }}>

      {/* Modal */}
      <AnimatePresence>
        {modalData && (
          <ScoreModal
            criterion={modalData.criterion}
            strategy={modalData.strategy}
            existing={scores.find(s => s.criterionId === modalData.criterion.id && s.strategyId === modalData.strategy.id)}
            strategyColor={STRATEGY_COLORS[strategies.indexOf(modalData.strategy) % STRATEGY_COLORS.length]}
            onSave={saveScore}
            onClose={() => setModalData(null)}
          />
        )}
      </AnimatePresence>

      {/* Decision banner */}
      {frame?.decisionStatement && (
        <div className="shrink-0 px-6 py-3 flex items-start gap-3" style={{ background: DS.accentLight, borderBottom: `1px solid ${DS.accent}30` }}>
          <Target size={14} style={{ color: DS.accent, marginTop: 3, flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: DS.accent }}>Decision</p>
            <p className="text-sm font-semibold" style={{ color: DS.ink, lineHeight: '1.4' }}>{frame.decisionStatement}</p>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 flex-wrap" style={{ background: DS.surface, borderBottom: `1px solid ${DS.border}` }}>
        <ContractGate moduleId="assessment" sessionData={sessionData ?? {}}>
          {({ blocked, blockers }) => (
            <div>
              <button onClick={handleAutoScore} disabled={aiLoading || !strategies.length || blocked}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: aiLoading || blocked ? DS.surfaceAlt : DS.accent, color: aiLoading || blocked ? DS.inkTer : '#fff' }}>
                <Sparkles size={12} /> {aiLoading ? 'Scoring…' : blocked ? 'Missing inputs' : 'AI Score All Strategies'}
              </button>
              {blocked && <p className="text-xs mt-1" style={{ color: '#D97706' }}>⚠️ {blockers[0]}</p>}
            </div>
          )}
        </ContractGate>
        <button onClick={handleDominanceAnalysis} disabled={aiLoading || scores.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: DS.surfaceAlt, color: DS.ink, border: `1px solid ${DS.border}` }}>
          <Brain size={12} /> Dominance Analysis
        </button>
        <div className="flex-1" />
        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${DS.border}` }}>
          {(['matrix', 'analysis', 'tradeoffs'] as const).map(v => (
            <button key={v} onClick={() => setActiveView(v)}
              className="px-3 py-1.5 text-xs font-medium capitalize"
              style={{ background: activeView === v ? DS.accent : DS.surface, color: activeView === v ? '#fff' : DS.inkTer }}>
              {v === 'tradeoffs' ? 'Trade-offs' : v === 'matrix' ? 'Score Matrix' : 'Analysis'}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-5">

          {aiError && (
            <div className="rounded-xl p-3 mb-4" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5' }}>
              <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>Error: {aiError}</p>
            </div>
          )}

          {aiLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <motion.div className="w-8 h-8 rounded-full border-2" style={{ borderColor: DS.accent, borderTopColor: 'transparent' }}
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
              <p className="text-sm" style={{ color: DS.inkTer }}>
                {activeView === 'matrix' ? 'Scoring strategies against criteria…' : 'Running dominance analysis…'}
              </p>
            </div>
          )}

          {!aiLoading && (
            <>
              {/* Score Matrix */}
              {activeView === 'matrix' && (
                <div>
                  {strategies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <div className="text-4xl">📊</div>
                      <p className="text-sm font-medium" style={{ color: DS.inkTer }}>No strategies to evaluate</p>
                      <p className="text-xs text-center max-w-xs" style={{ color: DS.inkFaint }}>Complete Strategy Formation first to populate strategies here.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse" style={{ minWidth: 600 }}>
                        <thead>
                          <tr>
                            <th className="text-left p-3 text-xs font-bold uppercase tracking-widest" style={{ color: DS.inkTer, width: 200 }}>Criterion</th>
                            <th className="text-center p-2 text-xs font-bold uppercase tracking-widest" style={{ color: DS.inkTer, width: 40 }}>Wt</th>
                            {strategies.map((s: any, i: number) => (
                              <th key={s.id} className="text-center p-3 text-xs font-bold" style={{ color: STRATEGY_COLORS[i % STRATEGY_COLORS.length], minWidth: 100 }}>
                                {s.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {criteria.map((c, ci) => (
                            <tr key={c.id} style={{ background: ci % 2 === 0 ? DS.surface : DS.surfaceAlt }}>
                              <td className="p-3">
                                <p className="text-xs font-semibold" style={{ color: DS.ink }}>{c.title}</p>
                                <p className="text-xs" style={{ color: DS.inkFaint }}>{c.type}</p>
                              </td>
                              <td className="p-2 text-center">
                                <div className="flex gap-0.5 justify-center">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i < c.weight ? DS.accent : DS.border }} />
                                  ))}
                                </div>
                              </td>
                              {strategies.map((s: any, si: number) => {
                                const score = scores.find(sc => sc.criterionId === c.id && sc.strategyId === s.id);
                                return (
                                  <td key={s.id} className="p-2">
                                    <ScoreCell
                                      score={score}
                                      color={STRATEGY_COLORS[si % STRATEGY_COLORS.length]}
                                      onClick={() => setModalData({ criterion: c, strategy: s })}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          {/* Weighted totals row */}
                          <tr style={{ background: DS.accentLight, borderTop: `2px solid ${DS.accent}30` }}>
                            <td className="p-3">
                              <p className="text-xs font-bold" style={{ color: DS.accent }}>Weighted Score</p>
                            </td>
                            <td />
                            {strategies.map((s: any, si: number) => {
                              const ws = weightedScores.find(w => w.strategyId === s.id);
                              const sc = ws?.score ?? 0;
                              return (
                                <td key={s.id} className="p-2 text-center">
                                  <span className="text-base font-bold" style={{ color: STRATEGY_COLORS[si % STRATEGY_COLORS.length] }}>
                                    {sc > 0 ? sc.toFixed(1) : '—'}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                      <p className="text-xs mt-2" style={{ color: DS.inkFaint }}>Click any cell to score or edit. AI can score all at once.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Dominance analysis */}
              {activeView === 'analysis' && (
                <div className="space-y-3">
                  {analyses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="text-4xl">🧠</div>
                      <p className="text-sm font-medium" style={{ color: DS.inkTer }}>No analysis yet</p>
                      <p className="text-xs text-center max-w-xs" style={{ color: DS.inkFaint }}>Score strategies first, then run Dominance Analysis.</p>
                    </div>
                  ) : (
                    analyses.map(analysis => {
                      const strategy = strategies.find((s: any) => s.id === analysis.strategyId);
                      const si = strategies.indexOf(strategy);
                      return (
                        <AnalysisCard key={analysis.strategyId} analysis={analysis} strategy={strategy}
                          color={STRATEGY_COLORS[si % STRATEGY_COLORS.length]} />
                      );
                    })
                  )}
                </div>
              )}

              {/* Trade-offs */}
              {activeView === 'tradeoffs' && (
                <div className="space-y-4">
                  {tradeOffs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="text-4xl">⚖️</div>
                      <p className="text-sm font-medium" style={{ color: DS.inkTer }}>No trade-off analysis yet</p>
                      <p className="text-xs text-center" style={{ color: DS.inkFaint }}>Run Dominance Analysis to surface trade-offs.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: DS.inkTer }}>Key Trade-offs Between Strategies</p>
                      {tradeOffs.map((t, i) => (
                        <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: DS.accentLight, color: DS.accent }}>{i + 1}</div>
                          <p className="text-sm" style={{ color: DS.ink, lineHeight: '1.6' }}>{t}</p>
                        </div>
                      ))}

                      {/* Strategy comparison bars */}
                      <p className="text-xs font-bold uppercase tracking-widest mt-6" style={{ color: DS.inkTer }}>Weighted Score Comparison</p>
                      {strategies.map((s: any, si: number) => {
                        const ws = weightedScores.find(w => w.strategyId === s.id);
                        const sc = ws?.score ?? 0;
                        const color = STRATEGY_COLORS[si % STRATEGY_COLORS.length];
                        return (
                          <div key={s.id} className="rounded-xl p-4" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold" style={{ color }}>{s.name}</span>
                              <span className="text-lg font-bold" style={{ color }}>{sc > 0 ? sc.toFixed(1) : '—'}</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: DS.border }}>
                              <motion.div className="h-full rounded-full" style={{ background: color }}
                                initial={{ width: 0 }} animate={{ width: `${(sc / 5) * 100}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }} />
                            </div>
                            <p className="text-xs mt-1.5 italic" style={{ color: DS.inkFaint }}>
                              ↑ {s.tradeOffProfile?.optimizes} · ↓ {s.tradeOffProfile?.sacrifices}
                            </p>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

              {/* Proceed gate */}
              {scores.length > 0 && (
                <div className="mt-6 rounded-xl p-4" style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
                  {isReady ? (
                    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      onClick={() => onValidated?.({ scores, analyses, tradeOffs, recommendation: '' })}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                      style={{ background: DS.accent, color: '#fff', boxShadow: `0 4px 14px ${DS.accent}40` }}>
                      <CheckCircle2 size={16} /> Proceed to Scenario Planning
                    </motion.button>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: DS.inkTer }}>Before proceeding:</p>
                      {scoredCount < 2 && <p className="text-xs mb-1" style={{ color: DS.inkTer }}>· Score at least 2 strategies</p>}
                      {analyses.length === 0 && <p className="text-xs mb-1" style={{ color: DS.inkTer }}>· Run Dominance Analysis</p>}
                      <button onClick={() => onValidated?.({ scores, analyses, tradeOffs, recommendation: '' })}
                        className="mt-3 w-full py-2 rounded-lg text-xs" style={{ background: DS.surface, color: DS.inkTer, border: `1px solid ${DS.border}` }}>
                        Override & Proceed
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right panel */}
        <div className="w-56 shrink-0 hidden lg:flex flex-col gap-3 p-4 overflow-y-auto" style={{ borderLeft: `1px solid ${DS.border}`, background: DS.surface }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: DS.inkTer }}>Strategies</p>
          {strategies.map((s: any, si: number) => {
            const ws = weightedScores.find(w => w.strategyId === s.id);
            const analysis = analyses.find(a => a.strategyId === s.id);
            const color = STRATEGY_COLORS[si % STRATEGY_COLORS.length];
            return (
              <div key={s.id} className="rounded-xl p-3" style={{ background: color + '08', border: `1.5px solid ${color}30` }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold" style={{ color }}>{s.name}</p>
                  {ws && ws.score > 0 && <span className="text-xs font-bold" style={{ color }}>{ws.score.toFixed(1)}</span>}
                </div>
                {analysis && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: RATING_META[analysis.rating].bg, color: RATING_META[analysis.rating].color }}>
                    {RATING_META[analysis.rating].icon} {RATING_META[analysis.rating].label}
                  </span>
                )}
              </div>
            );
          })}

          {analyses.length > 0 && (
            <div className="rounded-xl p-3 mt-2" style={{ background: DS.accentLight, border: `1px solid ${DS.accent}30` }}>
              <p className="text-xs font-semibold mb-1" style={{ color: DS.accent }}>🏆 Leading Strategy</p>
              {(() => {
                const top = [...weightedScores].sort((a, b) => b.score - a.score)[0];
                const s = strategies.find((s: any) => s.id === top?.strategyId);
                return s ? <p className="text-xs font-bold" style={{ color: DS.ink }}>{s.name}</p> : null;
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

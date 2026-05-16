import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import {
  Sparkles, Target, CheckCircle2, AlertTriangle,
  ChevronDown, Brain, BarChart2, Shield, TrendingUp,
} from 'lucide-react';
import type { ValidatedProblemFrame } from '@/lib/dq/problemFrameSchema';

// ── Types ────────────────────────────────────────────────────

interface Props {
  acceptedItems?: any[];
  sessionData?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
  onValidated?: (output: ScorecardOutput) => void;
}

type DQDimensionId = 'frame' | 'alternatives' | 'information' | 'values' | 'reasoning' | 'commitment';

interface DimensionScore {
  dimensionId: DQDimensionId;
  score: number; // 0-100
  rating: 'excellent' | 'good' | 'adequate' | 'poor' | 'missing';
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  evidence: string[];
}

interface ScorecardOutput {
  dimensions: DimensionScore[];
  overallScore: number;
  overallRating: string;
  criticalGaps: string[];
  readyForRecommendation: boolean;
  executiveSummary: string;
}

// ── DQ Dimension definitions ──────────────────────────────────

const DQ_DIMENSIONS: Record<DQDimensionId, {
  label: string; icon: string; color: string; bg: string;
  definition: string; keyQuestions: string[];
}> = {
  frame: {
    label: 'Frame', icon: '🎯', color: '#4F6AF5', bg: '#EEF2FF',
    definition: 'Is the decision clearly and correctly framed?',
    keyQuestions: [
      'Is the decision statement solution-neutral?',
      'Are constraints and givens clearly defined?',
      'Is scope properly bounded?',
      'Are success criteria defined?',
    ],
  },
  alternatives: {
    label: 'Alternatives', icon: '♟️', color: '#059669', bg: '#ECFDF5',
    definition: 'Are there materially distinct, creative, viable alternatives?',
    keyQuestions: [
      'Are strategies materially different?',
      'Is there a "do nothing" or baseline alternative?',
      'Do strategies span the solution space?',
      'Are strategies internally consistent?',
    ],
  },
  information: {
    label: 'Information', icon: '📊', color: '#0891B2', bg: '#ECFEFF',
    definition: 'Is the right information available and reliable?',
    keyQuestions: [
      'Are key uncertainties identified?',
      'Is critical data available?',
      'Are information gaps flagged?',
      'Is the quality of data assessed?',
    ],
  },
  values: {
    label: 'Values', icon: '⚖️', color: '#D97706', bg: '#FEF3C7',
    definition: 'Are decision criteria clear, complete, and agreed upon?',
    keyQuestions: [
      'Are evaluation criteria explicit?',
      'Do criteria reflect what stakeholders care about?',
      'Are criteria measurable?',
      'Are trade-offs acknowledged?',
    ],
  },
  reasoning: {
    label: 'Reasoning', icon: '🧠', color: '#7C3AED', bg: '#F5F3FF',
    definition: 'Is the analytical logic sound and well-structured?',
    keyQuestions: [
      'Is the scoring methodology consistent?',
      'Are dominant/dominated strategies identified?',
      'Are key sensitivities analyzed?',
      'Is the reasoning transparent?',
    ],
  },
  commitment: {
    label: 'Commitment', icon: '🤝', color: '#DC2626', bg: '#FEF2F2',
    definition: 'Is there alignment and readiness to act on the decision?',
    keyQuestions: [
      'Are stakeholders aligned?',
      'Is there a clear decision owner?',
      'Are next steps defined?',
      'Is there commitment to act?',
    ],
  },
};

const RATING_META: Record<string, { color: string; bg: string; label: string }> = {
  excellent: { color: '#059669', bg: '#DCFCE7', label: 'Excellent' },
  good:      { color: '#1D4ED8', bg: '#EFF6FF', label: 'Good' },
  adequate:  { color: '#D97706', bg: '#FEF3C7', label: 'Adequate' },
  poor:      { color: '#DC2626', bg: '#FEF2F2', label: 'Poor' },
  missing:   { color: '#94A3B8', bg: '#F8FAFC', label: 'Not assessed' },
};

// ── Helpers ──────────────────────────────────────────────────

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
      max_tokens: 4000,
      temperature: 0,
      system: 'You are a Decision Quality auditor. Score decision quality honestly and rigorously across the 6 DQ dimensions. Respond ONLY with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const raw = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ── Radar chart (SVG) ─────────────────────────────────────────

function RadarChart({ dimensions }: { dimensions: DimensionScore[] }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 75;
  const count = 6;

  const points = dimensions.map((d, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    const val = (d.score / 100) * r;
    return { x: cx + val * Math.cos(angle), y: cy + val * Math.sin(angle) };
  });

  const gridPoints = (pct: number) => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    const val = pct * r;
    return `${cx + val * Math.cos(angle)},${cy + val * Math.sin(angle)}`;
  }).join(' ');

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  const labelPoints = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    const val = r + 18;
    return { x: cx + val * Math.cos(angle), y: cy + val * Math.sin(angle) };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid */}
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <polygon key={pct} points={gridPoints(pct)} fill="none" stroke={DS.border} strokeWidth="1" />
      ))}
      {/* Axes */}
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)} stroke={DS.border} strokeWidth="1" />;
      })}
      {/* Data */}
      <path d={path} fill={DS.accent + '30'} stroke={DS.accent} strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill={DS.accent} />
      ))}
      {/* Labels */}
      {labelPoints.map((p, i) => {
        const dim = dimensions[i];
        const meta = DQ_DIMENSIONS[dim?.dimensionId];
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fontWeight="600" fill={DS.inkTer}>
            {meta?.icon} {dim?.score ?? 0}
          </text>
        );
      })}
    </svg>
  );
}

// ── Dimension card ────────────────────────────────────────────

function DimensionCard({ dimension, meta }: { dimension: DimensionScore; meta: typeof DQ_DIMENSIONS[DQDimensionId] }) {
  const [expanded, setExpanded] = useState(false);
  const rating = RATING_META[dimension.rating];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${dimension.score >= 70 ? meta.color + '40' : dimension.score >= 40 ? '#FCD34D' : '#FCA5A5'}` }}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(e => !e)}
        style={{ background: meta.bg + '60' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: meta.bg }}>
          {meta.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color: meta.color }}>{meta.label}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: rating.bg, color: rating.color }}>{rating.label}</span>
          </div>
          <p className="text-xs" style={{ color: DS.inkTer }}>{meta.definition}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-xl font-bold" style={{ color: meta.color }}>{dimension.score}</span>
          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: DS.border }}>
            <motion.div className="h-full rounded-full" style={{ background: meta.color }}
              initial={{ width: 0 }} animate={{ width: `${dimension.score}%` }} transition={{ duration: 0.6 }} />
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
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4" style={{ borderTop: `1px solid ${DS.border}` }}>
              {dimension.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-2" style={{ color: '#059669' }}>✅ Strengths</p>
                  {dimension.strengths.map((s, i) => <p key={i} className="text-xs mb-1 pl-2" style={{ color: DS.inkTer }}>· {s}</p>)}
                </div>
              )}
              {dimension.gaps.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-2" style={{ color: '#DC2626' }}>⚠️ Gaps</p>
                  {dimension.gaps.map((g, i) => <p key={i} className="text-xs mb-1 pl-2" style={{ color: DS.inkTer }}>· {g}</p>)}
                </div>
              )}
              {dimension.recommendations.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-2" style={{ color: DS.accent }}>💡 Recommendations</p>
                  {dimension.recommendations.map((r, i) => <p key={i} className="text-xs mb-1 pl-2" style={{ color: DS.inkTer }}>· {r}</p>)}
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

export default function DQScorecard({ acceptedItems, sessionData, persistedState, onPersistState, onValidated }: Props) {
  const [dimensions, setDimensions] = useState<DimensionScore[]>(() => persistedState?.dimensions ?? []);
  const [executiveSummary, setExecutiveSummary] = useState(persistedState?.executiveSummary ?? '');
  const [criticalGaps, setCriticalGaps] = useState<string[]>(persistedState?.criticalGaps ?? []);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const frame = useMemo(() => getFrame(sessionData, acceptedItems ?? []), [sessionData, acceptedItems]);

  useEffect(() => { onPersistState?.({ dimensions, executiveSummary, criticalGaps }); }, [dimensions, executiveSummary, criticalGaps]);

  const overallScore = useMemo(() =>
    dimensions.length > 0 ? Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length) : 0,
    [dimensions]
  );

  const overallRating = overallScore >= 80 ? 'Excellent' : overallScore >= 65 ? 'Good' : overallScore >= 50 ? 'Adequate' : overallScore > 0 ? 'Poor' : 'Not assessed';
  const overallColor = overallScore >= 80 ? '#059669' : overallScore >= 65 ? '#1D4ED8' : overallScore >= 50 ? '#D97706' : '#DC2626';

  const handleRunAudit = useCallback(async () => {
    if (!frame) { setAiError('Problem Frame not found.'); return; }
    setAiLoading(true); setAiError(null);

    const structuring = sessionData?.structuringOutput;
    const strategies = sessionData?.strategies ?? persistedState?.strategies ?? [];
    const evaluationScores = persistedState?.scores ?? [];

    const prompt = `You are a Decision Quality auditor. Score this decision across all 6 DQ dimensions.

DECISION: ${frame.decisionStatement}
TRIGGER: ${frame.trigger}

WHAT HAS BEEN COMPLETED:
Problem Frame: ${frame.decisionStatement ? '✓ Complete' : '✗ Missing'}
- Decision statement: ${frame.decisionStatement || 'Missing'}
- Context: ${frame.context ? '✓' : '✗'}
- Constraints: ${frame.constraints.join(', ') || 'None'}
- Success criteria: ${frame.successCriteria.join(', ') || 'None'}

Decision Structuring:
- Focus decisions: ${structuring?.focusDecisions?.length ?? 0} identified
- Uncertainties: ${structuring?.criticalUncertainties?.length ?? 0} identified
- Tensions: ${structuring?.tensions?.length ?? 0} identified
- Criteria: ${structuring?.criteria?.length ?? 0} identified

Strategy Formation:
- Strategies developed: ${strategies.length}
- Strategy names: ${strategies.map((s: any) => s.name).join(', ') || 'None'}

Strategy Evaluation:
- Strategies scored: ${new Set(evaluationScores.map((s: any) => s.strategyId)).size}

SCORE EACH DIMENSION 0-100:

Frame (0-100): Quality of problem framing, decision statement, scope, constraints, criteria
Alternatives (0-100): Quality and distinctiveness of strategic alternatives
Information (0-100): Adequacy of information, uncertainty identification, data quality
Values (0-100): Clarity and completeness of evaluation criteria and trade-off logic
Reasoning (0-100): Quality of analytical reasoning, scoring, dominance analysis
Commitment (0-100): Evidence of stakeholder alignment and readiness to act

RATING OPTIONS: excellent (80-100), good (65-79), adequate (50-64), poor (0-49)

Return ONLY valid JSON:
{
  "dimensions": [
    {
      "dimensionId": "frame",
      "score": 75,
      "rating": "good",
      "strengths": ["specific strength"],
      "gaps": ["specific gap"],
      "recommendations": ["specific recommendation"],
      "evidence": ["what evidence supports this score"]
    }
  ],
  "criticalGaps": ["most important gap to address"],
  "executiveSummary": "2-3 sentence honest assessment of decision quality"
}`;

    try {
      const result = await callAI(prompt);
      setDimensions(result.dimensions ?? []);
      setCriticalGaps(result.criticalGaps ?? []);
      setExecutiveSummary(result.executiveSummary ?? '');
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  }, [frame, sessionData, persistedState]);

  const isReady = overallScore >= 50 && dimensions.length === 6;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden" style={{ background: DS.bg }}>

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
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5" style={{ background: DS.surface, borderBottom: `1px solid ${DS.border}` }}>
        <button onClick={handleRunAudit} disabled={aiLoading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
          style={{ background: aiLoading ? DS.surfaceAlt : DS.accent, color: aiLoading ? DS.inkTer : '#fff' }}>
          <Sparkles size={12} /> {aiLoading ? 'Auditing…' : 'Run DQ Audit'}
        </button>
        <div className="flex-1" />
        {overallScore > 0 && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: DS.inkTer }}>DQ Score</p>
              <p className="text-2xl font-bold leading-none" style={{ color: overallColor }}>{overallScore}</p>
            </div>
            <div className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: overallColor + '20', color: overallColor }}>
              {overallRating}
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {aiError && (
            <div className="rounded-xl p-3" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5' }}>
              <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>Error: {aiError}</p>
            </div>
          )}

          {aiLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <motion.div className="w-8 h-8 rounded-full border-2" style={{ borderColor: DS.accent, borderTopColor: 'transparent' }}
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
              <p className="text-sm" style={{ color: DS.inkTer }}>Auditing decision quality…</p>
            </div>
          )}

          {!aiLoading && dimensions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="text-5xl">🏆</div>
              <p className="text-sm font-semibold" style={{ color: DS.inkTer }}>DQ Audit not run yet</p>
              <p className="text-xs text-center max-w-sm" style={{ color: DS.inkFaint }}>
                Click "Run DQ Audit" to score your decision quality across all 6 dimensions. This audit reviews everything completed so far.
              </p>
            </div>
          )}

          {!aiLoading && dimensions.length > 0 && (
            <>
              {/* Executive summary */}
              {executiveSummary && (
                <div className="rounded-xl p-5" style={{ background: DS.surface, border: `2px solid ${overallColor}30` }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: DS.inkTer }}>Executive Summary</p>
                  <p className="text-sm" style={{ color: DS.ink, lineHeight: '1.7' }}>{executiveSummary}</p>
                </div>
              )}

              {/* Critical gaps */}
              {criticalGaps.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: '#FEF3C7', border: '1px solid #FCD34D' }}>
                  <p className="text-xs font-bold mb-2" style={{ color: '#92400E' }}>⚠️ Critical Gaps to Address</p>
                  {criticalGaps.map((g, i) => (
                    <p key={i} className="text-xs mb-1 pl-2" style={{ color: '#78350F' }}>· {g}</p>
                  ))}
                </div>
              )}

              {/* Dimension cards */}
              <div className="space-y-3">
                {dimensions.map(d => {
                  const meta = DQ_DIMENSIONS[d.dimensionId];
                  if (!meta) return null;
                  return <DimensionCard key={d.dimensionId} dimension={d} meta={meta} />;
                })}
              </div>

              {/* Proceed gate */}
              <div className="rounded-xl p-4" style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
                {isReady ? (
                  <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    onClick={() => onValidated?.({ dimensions, overallScore, overallRating, criticalGaps, readyForRecommendation: true, executiveSummary })}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                    style={{ background: DS.accent, color: '#fff', boxShadow: `0 4px 14px ${DS.accent}40` }}>
                    <CheckCircle2 size={16} /> Proceed to Stakeholder Alignment
                  </motion.button>
                ) : (
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: DS.inkTer }}>
                      {overallScore < 50 ? `DQ score of ${overallScore} is below 50 — address critical gaps before proceeding` : 'Complete the audit to proceed'}
                    </p>
                    <button onClick={() => onValidated?.({ dimensions, overallScore, overallRating, criticalGaps, readyForRecommendation: false, executiveSummary })}
                      className="w-full py-2 rounded-lg text-xs" style={{ background: DS.surface, color: DS.inkTer, border: `1px solid ${DS.border}` }}>
                      Override & Proceed Anyway
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right panel — radar + dim scores */}
        <div className="w-56 shrink-0 hidden lg:flex flex-col items-center gap-4 p-4 overflow-y-auto" style={{ borderLeft: `1px solid ${DS.border}`, background: DS.surface }}>
          {dimensions.length === 6 && (
            <>
              <RadarChart dimensions={dimensions} />
              <div className="w-full space-y-2">
                {dimensions.map(d => {
                  const meta = DQ_DIMENSIONS[d.dimensionId];
                  if (!meta) return null;
                  return (
                    <div key={d.dimensionId} className="flex items-center gap-2">
                      <span className="text-sm w-5">{meta.icon}</span>
                      <span className="text-xs flex-1" style={{ color: DS.inkTer }}>{meta.label}</span>
                      <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: DS.border }}>
                        <div className="h-full rounded-full" style={{ background: meta.color, width: `${d.score}%` }} />
                      </div>
                      <span className="text-xs font-bold w-7 text-right" style={{ color: meta.color }}>{d.score}</span>
                    </div>
                  );
                })}
              </div>
              <div className="w-full rounded-xl p-3 text-center" style={{ background: overallColor + '15', border: `1px solid ${overallColor}30` }}>
                <p className="text-3xl font-bold" style={{ color: overallColor }}>{overallScore}</p>
                <p className="text-xs font-semibold" style={{ color: overallColor }}>{overallRating}</p>
                <p className="text-xs mt-1" style={{ color: DS.inkFaint }}>Overall DQ Score</p>
              </div>
            </>
          )}
          {dimensions.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8">
              <div className="text-3xl">🏆</div>
              <p className="text-xs text-center" style={{ color: DS.inkFaint }}>Run the audit to see your DQ radar chart</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

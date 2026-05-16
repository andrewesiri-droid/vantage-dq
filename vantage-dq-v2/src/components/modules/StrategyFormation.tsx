import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import {
  Sparkles, Plus, Check, X, ChevronDown, Target,
  CheckCircle2, AlertTriangle, Zap, Shield, TrendingUp,
  Clock, Users, Brain, ArrowRight, Info,
} from 'lucide-react';
import type { ValidatedProblemFrame } from '@/lib/dq/problemFrameSchema';
import { ContractGate } from '@/components/dq/ContractGate';

// ── Types ────────────────────────────────────────────────────

interface Props {
  acceptedItems?: any[];
  sessionData?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
  onValidated?: (strategies: Strategy[]) => void;
}

type RiskPosture = 'aggressive' | 'balanced' | 'conservative';
type FlexibilityLevel = 'high' | 'medium' | 'low';
type StrategyReviewStatus = 'draft' | 'accepted' | 'rejected';

interface StrategyChoice {
  dimension: string;
  choice: string;
}

interface Strategy {
  id: string;
  name: string;
  tagline: string;
  objective: string;
  rationale: string;
  strategicChoices: StrategyChoice[];
  assumptions: string[];
  keyUncertainties: string[];
  tradeOffProfile: { optimizes: string; sacrifices: string };
  riskPosture: RiskPosture;
  flexibilityLevel: FlexibilityLevel;
  source: 'ai' | 'user';
  reviewStatus: StrategyReviewStatus;
  coherenceFlags?: string[];
  color: string;
}

interface CoherenceCheck {
  strategyId: string;
  issues: string[];
  similarTo?: string[];
  violatesConstraints: boolean;
  rating: 'strong' | 'weak' | 'inconsistent';
}

// ── Strategy colors ───────────────────────────────────────────

const STRATEGY_COLORS = [
  '#4F6AF5', '#059669', '#D97706', '#DC2626',
  '#7C3AED', '#0891B2', '#B45309', '#E11D48',
];

const RISK_META: Record<RiskPosture, { label: string; color: string; bg: string; icon: string }> = {
  aggressive:   { label: 'Aggressive',   color: '#DC2626', bg: '#FEF2F2', icon: '🔥' },
  balanced:     { label: 'Balanced',     color: '#D97706', bg: '#FEF3C7', icon: '⚖️' },
  conservative: { label: 'Conservative', color: '#059669', bg: '#ECFDF5', icon: '🛡️' },
};

const FLEX_META: Record<FlexibilityLevel, { label: string; color: string }> = {
  high:   { label: 'High flexibility',   color: '#059669' },
  medium: { label: 'Medium flexibility', color: '#D97706' },
  low:    { label: 'Low flexibility',    color: '#DC2626' },
};

// ── Helpers ──────────────────────────────────────────────────

function makeId() { return `str_${Math.random().toString(36).slice(2, 9)}`; }

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

function getStructuringOutput(sessionData: any) {
  return sessionData?.structuringOutput ?? null;
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
      temperature: 0.2, // Slightly higher — strategies benefit from creativity
      system: 'You are a world-class Decision Quality facilitator and strategic advisor. Design materially distinct strategic pathways — not variations. Each strategy must represent a fundamentally different way of winning. Respond ONLY with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const raw = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ── Strategy card ─────────────────────────────────────────────

function StrategyCard({ strategy, index, onAccept, onReject, onEdit }: {
  strategy: Strategy;
  index: number;
  onAccept: () => void;
  onReject: () => void;
  onEdit: (field: string, value: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const riskMeta = RISK_META[strategy.riskPosture];
  const flexMeta = FLEX_META[strategy.flexibilityLevel];
  const isAccepted = strategy.reviewStatus === 'accepted';
  const isRejected = strategy.reviewStatus === 'rejected';
  const hasFlags = (strategy.coherenceFlags?.length ?? 0) > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-xl overflow-hidden"
      style={{
        border: `2px solid ${isAccepted ? strategy.color : isRejected ? '#FCA5A5' : DS.border}`,
        background: isRejected ? '#FFF5F5' : DS.surface,
        opacity: isRejected ? 0.5 : 1,
      }}
    >
      {/* Strategy header */}
      <div
        className="flex items-start gap-4 p-5 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Number badge */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: strategy.color + '20', color: strategy.color }}
        >
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-base font-bold" style={{ color: DS.ink }}>{strategy.name}</h3>
            {strategy.source === 'ai' && (
              <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: DS.accentLight, color: DS.accent }}>
                <Sparkles size={9} /> AI
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: riskMeta.bg, color: riskMeta.color }}>
              {riskMeta.icon} {riskMeta.label}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: DS.surfaceAlt, color: flexMeta.color }}>
              {flexMeta.label}
            </span>
          </div>
          <p className="text-sm font-medium italic" style={{ color: DS.inkTer }}>{strategy.tagline}</p>

          {/* Trade-off preview */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: '#EFF6FF' }}>
              <TrendingUp size={11} style={{ color: '#1D4ED8' }} />
              <span className="text-xs font-medium" style={{ color: '#1D4ED8' }}>↑ {strategy.tradeOffProfile.optimizes}</span>
            </div>
            <span className="text-xs" style={{ color: DS.inkFaint }}>vs</span>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: '#FEF2F2' }}>
              <span className="text-xs font-medium" style={{ color: '#DC2626' }}>↓ {strategy.tradeOffProfile.sacrifices}</span>
            </div>
          </div>

          {/* Coherence flags */}
          {hasFlags && (
            <div className="flex items-start gap-1.5 mt-2 p-2 rounded-lg" style={{ background: '#FEF3C7' }}>
              <AlertTriangle size={12} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
              <div>
                {strategy.coherenceFlags!.map((f, i) => (
                  <p key={i} className="text-xs" style={{ color: '#92400E' }}>{f}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex-shrink-0">
          <ChevronDown size={18} style={{ color: DS.inkTer }} />
        </motion.div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-5 space-y-4" style={{ borderTop: `1px solid ${DS.border}` }}>

              {/* Objective + Rationale */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div className="rounded-xl p-4" style={{ background: DS.surfaceAlt }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: DS.inkTer }}>🎯 Objective</p>
                  <p className="text-sm" style={{ color: DS.ink, lineHeight: '1.6' }}>{strategy.objective}</p>
                </div>
                <div className="rounded-xl p-4" style={{ background: DS.surfaceAlt }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: DS.inkTer }}>💡 Rationale</p>
                  <p className="text-sm" style={{ color: DS.ink, lineHeight: '1.6' }}>{strategy.rationale}</p>
                </div>
              </div>

              {/* Strategic choices */}
              {strategy.strategicChoices.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: DS.inkTer }}>⚙️ Strategic Choices</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {strategy.strategicChoices.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-lg" style={{ background: strategy.color + '10', border: `1px solid ${strategy.color}30` }}>
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: strategy.color }} />
                        <div>
                          <p className="text-xs font-semibold" style={{ color: strategy.color }}>{c.dimension}</p>
                          <p className="text-xs mt-0.5" style={{ color: DS.ink }}>{c.choice}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assumptions + Uncertainties */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategy.assumptions.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: DS.inkTer }}>💭 Assumptions</p>
                    <div className="space-y-1.5">
                      {strategy.assumptions.map((a, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#9333EA' }} />
                          <p className="text-xs" style={{ color: DS.inkTer }}>{a}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {strategy.keyUncertainties.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: DS.inkTer }}>❓ Key Uncertainties</p>
                    <div className="space-y-1.5">
                      {strategy.keyUncertainties.map((u, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#D97706' }} />
                          <p className="text-xs" style={{ color: DS.inkTer }}>{u}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              {!isRejected && (
                <div className="flex gap-2 pt-2">
                  {!isAccepted ? (
                    <button onClick={onAccept} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: '#DCFCE7', color: '#059669' }}>
                      <Check size={12} /> Accept Strategy
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: '#DCFCE7', color: '#059669' }}>
                      <CheckCircle2 size={12} /> Accepted
                    </div>
                  )}
                  <button onClick={onReject} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                    <X size={12} /> Reject
                  </button>
                </div>
              )}
              {isRejected && (
                <button onClick={onAccept} className="w-full py-2 rounded-lg text-xs" style={{ background: DS.surfaceAlt, color: DS.inkTer }}>Restore</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Tension map ───────────────────────────────────────────────

function TensionMap({ strategies }: { strategies: Strategy[] }) {
  const accepted = strategies.filter(s => s.reviewStatus === 'accepted');
  if (accepted.length < 2) return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <p className="text-sm" style={{ color: DS.inkTer }}>Accept 2+ strategies to see tension map</p>
    </div>
  );

  // Build dimension comparison
  const allDimensions = ['timing', 'capital', 'risk', 'partnership', 'optionality'];
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: DS.inkTer }}>How strategies differ on key dimensions</p>
      {accepted.map(s => (
        <div key={s.id} className="rounded-xl p-4" style={{ border: `2px solid ${s.color}30`, background: s.color + '08' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
            <p className="text-sm font-bold" style={{ color: s.color }}>{s.name}</p>
            <span className="text-xs" style={{ color: DS.inkFaint }}>— {s.tagline}</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-center">
              <p className="text-xs font-medium" style={{ color: RISK_META[s.riskPosture].color }}>{RISK_META[s.riskPosture].icon}</p>
              <p className="text-xs" style={{ color: DS.inkTer }}>Risk</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium" style={{ color: FLEX_META[s.flexibilityLevel].color }}>◆</p>
              <p className="text-xs" style={{ color: DS.inkTer }}>Flexibility</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium" style={{ color: '#1D4ED8' }}>↑ {s.tradeOffProfile.optimizes}</p>
              <p className="text-xs" style={{ color: '#DC2626' }}>↓ {s.tradeOffProfile.sacrifices}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function StrategyFormation({ acceptedItems, sessionData, persistedState, onPersistState, onValidated }: Props) {
  const [strategies, setStrategies] = useState<Strategy[]>(() => persistedState?.strategies ?? []);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'strategies' | 'tensions'>('strategies');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStrategyName, setNewStrategyName] = useState('');
  const [coherenceResults, setCoherenceResults] = useState<CoherenceCheck[]>([]);

  const frame = useMemo(() => getFrame(sessionData, acceptedItems ?? []), [sessionData, acceptedItems]);
  const structuring = useMemo(() => getStructuringOutput(sessionData), [sessionData]);

  // Persist state
  useEffect(() => { onPersistState?.({ strategies }); }, [strategies]);

  const acceptedStrategies = strategies.filter(s => s.reviewStatus === 'accepted');
  const isReady = acceptedStrategies.length >= 2;

  // ── AI: Generate strategies ──────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!frame) { setAiError('Problem Frame not found.'); return; }
    setAiLoading(true); setAiError(null);

    const focusDecisions = structuring?.focusDecisions?.map((d: any) => d.title).join('\n') ?? 'Not yet structured';
    const uncertainties = structuring?.criticalUncertainties?.map((u: any) => u.title).join('\n') ?? 'Not identified';
    const tensions = structuring?.tensions?.map((t: any) => `${t.sideA} vs ${t.sideB}`).join('\n') ?? 'None identified';
    const criteria = structuring?.criteria?.map((c: any) => c.title).join('\n') ?? frame.successCriteria.join('\n');

    const prompt = `You are a world-class strategic advisor. Design 3-4 materially distinct strategic alternatives for this decision.

DECISION: ${frame.decisionStatement}
TRIGGER: ${frame.trigger}
CONSTRAINTS: ${frame.constraints.join(', ') || 'None stated'}

FOCUS DECISIONS:
${focusDecisions}

CRITICAL UNCERTAINTIES:
${uncertainties}

KEY TENSIONS:
${tensions}

EVALUATION CRITERIA:
${criteria}

DESIGN PRINCIPLES:
1. Each strategy must be a FUNDAMENTALLY different way of winning — not cosmetic variations
2. Strategies should differ on: timing, capital intensity, risk exposure, partnership model, optionality, sequencing, value focus
3. Each strategy must have a clear philosophy, risk posture, and worldview
4. Name strategies descriptively (e.g. "Aggressive Appraisal", "Phased Farm-Down", "Capital Preservation") — NOT "Option A/B/C"
5. Trade-offs must be explicit and honest
6. Flag any strategy that violates constraints

STRATEGY STRUCTURE:
- name: memorable strategic name
- tagline: one-line philosophy (e.g. "Move fast, capture first-mover advantage")
- objective: what success looks like for this strategy
- rationale: why this strategy exists and what worldview it assumes
- strategicChoices: 4-6 defining choices (dimension + choice)
- assumptions: 3-4 things that must be true
- keyUncertainties: 2-3 uncertainties that could derail this strategy
- tradeOffProfile: { optimizes: "what it maximizes", sacrifices: "what it gives up" }
- riskPosture: "aggressive" | "balanced" | "conservative"
- flexibilityLevel: "high" | "medium" | "low"
- coherenceFlags: [] (empty unless strategy has issues)

Return ONLY valid JSON:
{
  "strategies": [
    {
      "name": "",
      "tagline": "",
      "objective": "",
      "rationale": "",
      "strategicChoices": [{ "dimension": "", "choice": "" }],
      "assumptions": [],
      "keyUncertainties": [],
      "tradeOffProfile": { "optimizes": "", "sacrifices": "" },
      "riskPosture": "balanced",
      "flexibilityLevel": "medium",
      "coherenceFlags": []
    }
  ]
}`;

    try {
      const result = await callAI(prompt);
      const newStrategies: Strategy[] = (result.strategies ?? []).map((s: any, i: number) => ({
        id: makeId(),
        name: s.name ?? `Strategy ${i + 1}`,
        tagline: s.tagline ?? '',
        objective: s.objective ?? '',
        rationale: s.rationale ?? '',
        strategicChoices: s.strategicChoices ?? [],
        assumptions: s.assumptions ?? [],
        keyUncertainties: s.keyUncertainties ?? [],
        tradeOffProfile: s.tradeOffProfile ?? { optimizes: '', sacrifices: '' },
        riskPosture: s.riskPosture ?? 'balanced',
        flexibilityLevel: s.flexibilityLevel ?? 'medium',
        source: 'ai' as const,
        reviewStatus: 'draft' as const,
        coherenceFlags: s.coherenceFlags ?? [],
        color: STRATEGY_COLORS[i % STRATEGY_COLORS.length],
      }));
      setStrategies(newStrategies);
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  }, [frame, structuring]);

  // ── AI: Check coherence ──────────────────────────────────────

  const handleCoherenceCheck = useCallback(async () => {
    if (!strategies.length) return;
    setAiLoading(true); setAiError(null);

    const stratSummary = strategies.map(s =>
      `ID: ${s.id}\nName: ${s.name}\nRisk: ${s.riskPosture}\nOptimizes: ${s.tradeOffProfile.optimizes}\nSacrifices: ${s.tradeOffProfile.sacrifices}\nAssumptions: ${s.assumptions.join('; ')}`
    ).join('\n\n');

    const prompt = `You are a DQ facilitator. Check these strategies for coherence issues.

CONSTRAINTS: ${frame?.constraints.join(', ') || 'None'}

STRATEGIES:
${stratSummary}

Check for:
1. Internal inconsistency (choices that contradict each other)
2. Too similar to another strategy
3. Violates stated constraints
4. Unrealistic assumptions
5. Missing critical dimension

Return ONLY valid JSON:
{
  "checks": [
    {
      "strategyId": "",
      "issues": [],
      "similarTo": [],
      "violatesConstraints": false,
      "rating": "strong | weak | inconsistent"
    }
  ]
}`;

    try {
      const result = await callAI(prompt);
      const checks: CoherenceCheck[] = result.checks ?? [];

      // Apply coherence flags back to strategies
      setStrategies(prev => prev.map(s => {
        const check = checks.find(c => c.strategyId === s.id);
        if (!check) return s;
        return { ...s, coherenceFlags: check.issues };
      }));
      setCoherenceResults(checks);
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  }, [strategies, frame]);

  // ── Add strategy manually ────────────────────────────────────

  const handleAddManual = useCallback(() => {
    if (!newStrategyName.trim()) return;
    const s: Strategy = {
      id: makeId(),
      name: newStrategyName.trim(),
      tagline: 'User-defined strategy',
      objective: '',
      rationale: '',
      strategicChoices: [],
      assumptions: [],
      keyUncertainties: [],
      tradeOffProfile: { optimizes: '', sacrifices: '' },
      riskPosture: 'balanced',
      flexibilityLevel: 'medium',
      source: 'user',
      reviewStatus: 'draft',
      color: STRATEGY_COLORS[strategies.length % STRATEGY_COLORS.length],
    };
    setStrategies(p => [...p, s]);
    setNewStrategyName('');
    setShowAddForm(false);
  }, [newStrategyName, strategies.length]);

  const updateStatus = useCallback((id: string, status: StrategyReviewStatus) => {
    setStrategies(p => p.map(s => s.id === id ? { ...s, reviewStatus: status } : s));
  }, []);

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
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 flex-wrap" style={{ background: DS.surface, borderBottom: `1px solid ${DS.border}` }}>
        <ContractGate moduleId="strategy" sessionData={sessionData ?? {}}>
          {({ blocked, blockers }) => (
            <div>
              <button onClick={handleGenerate} disabled={aiLoading || !frame || blocked}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: aiLoading || blocked ? DS.surfaceAlt : DS.accent, color: aiLoading || blocked ? DS.inkTer : '#fff' }}
                title={blocked ? blockers.join(' | ') : ''}>
                <Sparkles size={12} /> {aiLoading ? 'Designing…' : blocked ? 'Missing inputs' : 'Design Strategic Alternatives'}
              </button>
              {blocked && <p className="text-xs mt-1" style={{ color: '#D97706' }}>⚠️ {blockers[0]}</p>}
            </div>
          )}
        </ContractGate>
        <button onClick={handleCoherenceCheck} disabled={aiLoading || strategies.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: DS.surfaceAlt, color: DS.ink, border: `1px solid ${DS.border}` }}>
          <Brain size={12} /> Coherence Check
        </button>
        <button onClick={() => setShowAddForm(s => !s)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: '#DCFCE7', color: '#059669' }}>
          <Plus size={12} /> Add Strategy
        </button>
        <div className="flex-1" />
        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${DS.border}` }}>
          {(['strategies', 'tensions'] as const).map(v => (
            <button key={v} onClick={() => setActiveView(v)}
              className="px-3 py-1.5 text-xs font-medium capitalize"
              style={{ background: activeView === v ? DS.accent : DS.surface, color: activeView === v ? '#fff' : DS.inkTer }}>
              {v === 'tensions' ? 'Tension Map' : 'Strategies'}
            </button>
          ))}
        </div>
        {/* Stats */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: DS.surfaceAlt, color: DS.inkTer }}>{strategies.length} total</span>
          {acceptedStrategies.length > 0 && (
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#DCFCE7', color: '#059669' }}>{acceptedStrategies.length} accepted</span>
          )}
        </div>
      </div>

      {/* Structuring context bar */}
      {structuring && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 overflow-x-auto" style={{ background: DS.surfaceAlt, borderBottom: `1px solid ${DS.border}` }}>
          <span className="text-xs font-semibold flex-shrink-0" style={{ color: DS.inkTer }}>From Decision Structuring:</span>
          {structuring.focusDecisions?.slice(0, 2).map((d: any, i: number) => (
            <span key={i} className="text-xs px-2 py-1 rounded-full flex-shrink-0" style={{ background: '#EEF2FF', color: '#4F6AF5' }}>🎯 {d.title}</span>
          ))}
          {structuring.criteria?.slice(0, 2).map((c: any, i: number) => (
            <span key={i} className="text-xs px-2 py-1 rounded-full flex-shrink-0" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>📊 {c.title}</span>
          ))}
          {structuring.tensions?.slice(0, 1).map((t: any, i: number) => (
            <span key={i} className="text-xs px-2 py-1 rounded-full flex-shrink-0" style={{ background: '#FFF1F2', color: '#E11D48' }}>⚡ {t.sideA} vs {t.sideB}</span>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Add form */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl p-4 space-y-3" style={{ background: DS.surface, border: `2px solid ${DS.accent}` }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: DS.accent }}>Add Strategy</p>
                <input value={newStrategyName} onChange={e => setNewStrategyName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddManual()}
                  placeholder="Strategy name (e.g. Aggressive Appraisal, Phased Farm-Down…)"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}`, color: DS.ink, outline: 'none' }} />
                <div className="flex gap-2">
                  <button onClick={handleAddManual} className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: DS.accent, color: '#fff' }}>
                    <Plus size={12} /> Add
                  </button>
                  <button onClick={() => setShowAddForm(false)} className="px-3 py-2 rounded-lg text-xs" style={{ background: DS.surfaceAlt, color: DS.inkTer }}>Cancel</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {aiError && (
            <div className="rounded-xl p-3" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5' }}>
              <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>Error: {aiError}</p>
            </div>
          )}

          {aiLoading && strategies.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <motion.div className="w-8 h-8 rounded-full border-2" style={{ borderColor: DS.accent, borderTopColor: 'transparent' }}
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
              <p className="text-sm" style={{ color: DS.inkTer }}>Designing strategic alternatives…</p>
              <p className="text-xs" style={{ color: DS.inkFaint }}>This may take a moment — we're designing real strategies, not generic options.</p>
            </div>
          )}

          {activeView === 'strategies' && (
            <>
              {strategies.length === 0 && !aiLoading && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="text-4xl">♟️</div>
                  <p className="text-sm font-semibold" style={{ color: DS.inkTer }}>No strategies yet</p>
                  <p className="text-xs text-center max-w-sm" style={{ color: DS.inkFaint }}>
                    Click "Design Strategic Alternatives" to have AI create materially distinct strategic pathways based on your Decision Structuring output.
                  </p>
                </div>
              )}
              <AnimatePresence mode="popLayout">
                {strategies.map((s, i) => (
                  <StrategyCard key={s.id} strategy={s} index={i}
                    onAccept={() => updateStatus(s.id, 'accepted')}
                    onReject={() => updateStatus(s.id, 'rejected')}
                    onEdit={(field, value) => setStrategies(p => p.map(st => st.id === s.id ? { ...st, [field]: value } : st))}
                  />
                ))}
              </AnimatePresence>
            </>
          )}

          {activeView === 'tensions' && <TensionMap strategies={strategies} />}

          {/* Proceed gate */}
          {strategies.length > 0 && (
            <div className="mt-4 rounded-xl p-4" style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
              {isReady ? (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => onValidated?.(acceptedStrategies)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                  style={{ background: DS.accent, color: '#fff', boxShadow: `0 4px 14px ${DS.accent}40` }}>
                  <CheckCircle2 size={16} /> Proceed to Strategy Evaluation
                </motion.button>
              ) : (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: DS.inkTer }}>Before proceeding to Strategy Evaluation:</p>
                  <p className="text-xs mb-1" style={{ color: DS.inkTer }}>· Accept at least 2 strategies ({acceptedStrategies.length} accepted so far)</p>
                  <button onClick={() => onValidated?.(acceptedStrategies)}
                    className="mt-3 w-full py-2 rounded-lg text-xs font-medium"
                    style={{ background: DS.surface, color: DS.inkTer, border: `1px solid ${DS.border}` }}>
                    Override & Proceed Anyway
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right summary */}
        <div className="w-60 shrink-0 hidden lg:flex flex-col gap-4 p-4 overflow-y-auto" style={{ borderLeft: `1px solid ${DS.border}`, background: DS.surface }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: DS.inkTer }}>Strategy Summary</p>
            {strategies.filter(s => s.reviewStatus !== 'rejected').map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 mb-2 p-2 rounded-lg" style={{ background: s.reviewStatus === 'accepted' ? s.color + '10' : DS.surfaceAlt, border: `1px solid ${s.reviewStatus === 'accepted' ? s.color + '30' : DS.border}` }}>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: DS.ink }}>{s.name}</p>
                  <p className="text-xs" style={{ color: RISK_META[s.riskPosture].color }}>{RISK_META[s.riskPosture].icon} {RISK_META[s.riskPosture].label}</p>
                </div>
                {s.reviewStatus === 'accepted' && <CheckCircle2 size={12} style={{ color: '#059669', flexShrink: 0 }} />}
              </div>
            ))}
          </div>

          {acceptedStrategies.length >= 2 && (
            <div className="rounded-xl p-3" style={{ background: '#DCFCE7', border: '1px solid #86EFAC' }}>
              <p className="text-xs font-semibold" style={{ color: '#059669' }}>✅ Ready for Evaluation</p>
              <p className="text-xs mt-1" style={{ color: '#059669' }}>{acceptedStrategies.length} strategies ready to score</p>
            </div>
          )}

          {coherenceResults.length > 0 && (
            <div className="rounded-xl p-3 space-y-2" style={{ border: `1px solid ${DS.border}` }}>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: DS.inkTer }}>Coherence</p>
              {coherenceResults.map(r => {
                const s = strategies.find(s => s.id === r.strategyId);
                if (!s) return null;
                return (
                  <div key={r.strategyId} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: r.rating === 'strong' ? '#059669' : r.rating === 'weak' ? '#D97706' : '#DC2626' }} />
                    <span className="text-xs flex-1 truncate" style={{ color: DS.inkTer }}>{s.name}</span>
                    <span className="text-xs capitalize" style={{ color: r.rating === 'strong' ? '#059669' : r.rating === 'weak' ? '#D97706' : '#DC2626' }}>{r.rating}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

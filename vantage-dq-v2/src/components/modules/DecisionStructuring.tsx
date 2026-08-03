import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import {
  Sparkles, ChevronDown, CheckCircle2, AlertTriangle,
  Target, Zap, BarChart2, Send, Brain, Plus, X, Check,
  ArrowRight, Info,
} from 'lucide-react';
import type { ValidatedProblemFrame } from '@/lib/dq/problemFrameSchema';

// ── Types ────────────────────────────────────────────────────

interface Props {
  acceptedItems?: any[];
  sessionData?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
  onValidated?: (output: StructuringOutput) => void;
}

type DecisionType = 'focus' | 'tactical' | 'deferred' | 'given';
type UncertaintyImpact = 'high' | 'medium' | 'low';
type TensionType = 'speed_vs_value' | 'risk_vs_return' | 'flexibility_vs_commitment' | 'cost_vs_quality' | 'stakeholder_vs_timing' | 'custom';

interface StructuredDecision {
  id: string;
  title: string;
  type: DecisionType;
  rationale: string;
  source: 'ai' | 'user';
  reviewStatus: 'needs_review' | 'accepted' | 'rejected';
  linkedItems?: string[];
  choices?: string[]; // 2-4 mutually exclusive options for this decision
}

interface StructuredUncertainty {
  id: string;
  title: string;
  impact: UncertaintyImpact;
  canChangeStrategy: boolean;
  owner?: string;
  type: 'market' | 'technical' | 'regulatory' | 'stakeholder' | 'financial' | 'operational';
  source: 'ai' | 'user';
  reviewStatus: 'needs_review' | 'accepted' | 'rejected';
  downstreamTargets: string[];
}

interface StructuredTension {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  type: TensionType;
  severity: 1 | 2 | 3 | 4 | 5;
  source: 'ai' | 'user';
  reviewStatus: 'needs_review' | 'accepted' | 'rejected';
}

interface StructuredCriterion {
  id: string;
  title: string;
  weight: 1 | 2 | 3 | 4 | 5;
  type: 'value' | 'risk' | 'feasibility' | 'timing' | 'stakeholder' | 'strategic_fit';
  source: 'ai' | 'user';
  reviewStatus: 'needs_review' | 'accepted' | 'rejected';
}

interface StructuringOutput {
  focusDecisions: StructuredDecision[];
  tacticalDecisions: StructuredDecision[];
  deferredDecisions: StructuredDecision[];
  givens: StructuredDecision[];
  criticalUncertainties: StructuredUncertainty[];
  tensions: StructuredTension[];
  criteria: StructuredCriterion[];
}

type ActiveZone = 'decisions' | 'uncertainties' | 'tensions' | 'criteria' | 'routing';

// ── Helpers ──────────────────────────────────────────────────

function makeId() { return `ds_${Math.random().toString(36).slice(2, 9)}`; }

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

function getRaisedItems(sessionData: any, acceptedItems: any[]): any[] {
  if (sessionData?.raisedItems) return sessionData.raisedItems;
  return (acceptedItems ?? []).filter(i => i.targetType === 'raised_item' || i.targetType === 'issue');
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
      system: 'You are a Decision Quality facilitator grounded in the methodology of established Decision Analysis methodology. PRINCIPLE 1 — PROCESS OVER OUTCOME: Judge decision quality at the time of the decision, not by outcome. PRINCIPLE 2 — CLARITY OF ACTION: Every output must move the human toward a clear, confident, defensible choice. PRINCIPLE 3 — WEAKEST LINK: A decision is only as strong as its weakest DQ element — always surface the weakest link. PRINCIPLE 4 — AI vs HUMAN OWNERSHIP: Surface, structure, and stress-test — but never own values, feasibility, or commitment. PRINCIPLE 5 — HANDOFF RULE: End every recommendation by naming what the human must own, what you cannot determine, and what would change your analysis. FORBIDDEN: Never invent data not in the session. Never give strong recommendations on weak frames. Never hide assumptions as facts. You are operating in the FRAME + ALTERNATIVES link. Structure decision intelligence into Focus Decisions, Uncertainties, Tensions, and Criteria. Flag the weakest link. Extract all relevant focus decisions — do not artificially limit the count. Respond ONLY with valid JSON — no markdown, no preamble.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const raw = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// ── Decision type meta ────────────────────────────────────────

const DECISION_TYPE_META: Record<DecisionType, { label: string; color: string; bg: string; icon: string; description: string }> = {
  focus:    { label: 'Focus Decision',    color: '#4F6AF5', bg: '#EEF2FF', icon: '🎯', description: 'Must be resolved to move forward' },
  tactical: { label: 'Tactical Decision', color: '#7C3AED', bg: '#F5F3FF', icon: '⚙️', description: 'Implementation choice, depends on focus decisions' },
  deferred: { label: 'Deferred',          color: '#D97706', bg: '#FEF3C7', icon: '⏳', description: 'Intentionally postponed — decide later' },
  given:    { label: 'Given / Fixed',     color: '#0F766E', bg: '#F0FDFA', icon: '📌', description: 'Already decided or non-negotiable' },
};

const IMPACT_META: Record<UncertaintyImpact, { color: string; bg: string }> = {
  high:   { color: '#DC2626', bg: '#FEF2F2' },
  medium: { color: '#D97706', bg: '#FEF3C7' },
  low:    { color: '#059669', bg: '#ECFDF5' },
};

// ── Item card components ──────────────────────────────────────

function DecisionCard({ item, onAccept, onReject }: { item: StructuredDecision; onAccept: () => void; onReject: () => void }) {
  const meta = DECISION_TYPE_META[item.type];
  const isAccepted = item.reviewStatus === 'accepted';
  const isRejected = item.reviewStatus === 'rejected';
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="rounded-xl p-4"
      style={{ border: `1.5px solid ${isAccepted ? '#86EFAC' : isRejected ? '#FCA5A5' : item.reviewStatus === 'needs_review' ? '#FCD34D' : DS.border}`, background: isRejected ? '#FFF5F5' : DS.surface, opacity: isRejected ? 0.6 : 1 }}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: meta.bg }}>{meta.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
            {item.source === 'ai' && <span className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: DS.accentLight, color: DS.accent, fontSize: 10 }}><Sparkles size={8} /> AI</span>}
          </div>
          <p className="text-sm font-medium" style={{ color: DS.ink }}>{item.title}</p>
          {item.rationale && <p className="text-xs mt-1 italic" style={{ color: DS.inkFaint }}>{item.rationale}</p>}
        </div>
      </div>
      {!isRejected && (
        <div className="flex gap-2 mt-3">
          {!isAccepted
            ? <button onClick={onAccept} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: '#DCFCE7', color: '#059669' }}><Check size={11} /> Accept</button>
            : <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: '#DCFCE7', color: '#059669' }}><CheckCircle2 size={11} /> Accepted</div>}
          <button onClick={onReject} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#DC2626' }}><X size={11} /></button>
        </div>
      )}
      {isRejected && <button onClick={onAccept} className="mt-3 w-full py-1.5 rounded-lg text-xs" style={{ background: DS.surfaceAlt, color: DS.inkTer }}>Restore</button>}
    </motion.div>
  );
}

function UncertaintyCard({ item, onAccept, onReject }: { item: StructuredUncertainty; onAccept: () => void; onReject: () => void }) {
  const impactMeta = IMPACT_META[item.impact];
  const isAccepted = item.reviewStatus === 'accepted';
  const isRejected = item.reviewStatus === 'rejected';
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="rounded-xl p-4"
      style={{ border: `1.5px solid ${isAccepted ? '#86EFAC' : isRejected ? '#FCA5A5' : '#FCD34D'}`, background: isRejected ? '#FFF5F5' : DS.surface, opacity: isRejected ? 0.6 : 1 }}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: impactMeta.bg }}>❓</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: impactMeta.bg, color: impactMeta.color }}>{item.impact.toUpperCase()} impact</span>
            {item.canChangeStrategy && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#FEE2E2', color: '#DC2626' }}>⚡ Strategy-changing</span>}
            {item.source === 'ai' && <span className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: DS.accentLight, color: DS.accent, fontSize: 10 }}><Sparkles size={8} /> AI</span>}
          </div>
          <p className="text-sm font-medium" style={{ color: DS.ink }}>{item.title}</p>
          {item.downstreamTargets?.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <Send size={10} style={{ color: DS.inkFaint }} />
              {item.downstreamTargets.map(t => <span key={t} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: DS.accentLight, color: DS.accent, fontSize: 10 }}>{t.replace(/_/g, ' ')}</span>)}
            </div>
          )}
        </div>
      </div>
      {!isRejected && (
        <div className="flex gap-2 mt-3">
          {!isAccepted
            ? <button onClick={onAccept} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: '#DCFCE7', color: '#059669' }}><Check size={11} /> Accept</button>
            : <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: '#DCFCE7', color: '#059669' }}><CheckCircle2 size={11} /> Accepted</div>}
          <button onClick={onReject} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#DC2626' }}><X size={11} /></button>
        </div>
      )}
    </motion.div>
  );
}

function TensionCard({ item, onAccept, onReject }: { item: StructuredTension; onAccept: () => void; onReject: () => void }) {
  const isAccepted = item.reviewStatus === 'accepted';
  const isRejected = item.reviewStatus === 'rejected';
  const severityColor = item.severity >= 4 ? '#DC2626' : item.severity >= 3 ? '#D97706' : '#059669';
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="rounded-xl p-4"
      style={{ border: `1.5px solid ${isAccepted ? '#86EFAC' : isRejected ? '#FCA5A5' : '#FCD34D'}`, background: isRejected ? '#FFF5F5' : DS.surface, opacity: isRejected ? 0.6 : 1 }}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#FFF1F2', color: '#E11D48' }}>⚡ Tension</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: DS.surfaceAlt, color: severityColor }}>Severity {item.severity}/5</span>
        {item.source === 'ai' && <span className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: DS.accentLight, color: DS.accent, fontSize: 10 }}><Sparkles size={8} /> AI</span>}
      </div>
      <p className="text-sm font-semibold mb-2" style={{ color: DS.ink }}>{item.title}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 p-2 rounded-lg text-center" style={{ background: '#EEF2FF' }}>
          <p className="text-xs font-medium" style={{ color: '#4F6AF5' }}>{item.sideA}</p>
        </div>
        <span className="text-xs font-bold" style={{ color: DS.inkTer }}>vs</span>
        <div className="flex-1 p-2 rounded-lg text-center" style={{ background: '#FFF1F2' }}>
          <p className="text-xs font-medium" style={{ color: '#E11D48' }}>{item.sideB}</p>
        </div>
      </div>
      {!isRejected && (
        <div className="flex gap-2 mt-3">
          {!isAccepted
            ? <button onClick={onAccept} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: '#DCFCE7', color: '#059669' }}><Check size={11} /> Accept</button>
            : <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: '#DCFCE7', color: '#059669' }}><CheckCircle2 size={11} /> Accepted</div>}
          <button onClick={onReject} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#DC2626' }}><X size={11} /></button>
        </div>
      )}
    </motion.div>
  );
}

function CriterionCard({ item, onAccept, onReject }: { item: StructuredCriterion; onAccept: () => void; onReject: () => void }) {
  const isAccepted = item.reviewStatus === 'accepted';
  const isRejected = item.reviewStatus === 'rejected';
  const typeColors: Record<string, { bg: string; color: string }> = {
    value: { bg: '#EFF6FF', color: '#1D4ED8' },
    risk: { bg: '#FEF2F2', color: '#DC2626' },
    feasibility: { bg: '#F0FDF4', color: '#16A34A' },
    timing: { bg: '#F0F9FF', color: '#0284C7' },
    stakeholder: { bg: '#ECFDF5', color: '#059669' },
    strategic_fit: { bg: '#EEF2FF', color: '#4F6AF5' },
  };
  const tc = typeColors[item.type] ?? { bg: DS.surfaceAlt, color: DS.inkTer };
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="rounded-xl p-4"
      style={{ border: `1.5px solid ${isAccepted ? '#86EFAC' : isRejected ? '#FCA5A5' : DS.border}`, background: isRejected ? '#FFF5F5' : DS.surface, opacity: isRejected ? 0.6 : 1 }}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: tc.bg, color: tc.color }}>📊 {item.type.replace(/_/g, ' ')}</span>
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full" style={{ background: i < item.weight ? '#4F6AF5' : DS.border }} />
          ))}
        </div>
        {item.source === 'ai' && <span className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: DS.accentLight, color: DS.accent, fontSize: 10 }}><Sparkles size={8} /> AI</span>}
      </div>
      <p className="text-sm font-medium" style={{ color: DS.ink }}>{item.title}</p>
      {!isRejected && (
        <div className="flex gap-2 mt-3">
          {!isAccepted
            ? <button onClick={onAccept} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: '#DCFCE7', color: '#059669' }}><Check size={11} /> Accept</button>
            : <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: '#DCFCE7', color: '#059669' }}><CheckCircle2 size={11} /> Accepted</div>}
          <button onClick={onReject} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#DC2626' }}><X size={11} /></button>
        </div>
      )}
    </motion.div>
  );
}

// ── Zone tab ─────────────────────────────────────────────────

function ZoneTab({ id, label, icon, count, active, onClick }: {
  id: ActiveZone; label: string; icon: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap"
      style={{
        background: active ? DS.surface : 'transparent',
        color: active ? DS.accent : DS.inkTer,
        borderBottom: active ? `2px solid ${DS.accent}` : '2px solid transparent',
      }}>
      <span>{icon}</span>
      <span>{label}</span>
      {count > 0 && (
        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: active ? DS.accentLight : DS.surfaceAlt, color: active ? DS.accent : DS.inkTer }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Routing map ───────────────────────────────────────────────

function RoutingMap({ decisions, uncertainties, tensions, criteria }: {
  decisions: StructuredDecision[]; uncertainties: StructuredUncertainty[];
  tensions: StructuredTension[]; criteria: StructuredCriterion[];
}) {
  const routes: { module: string; color: string; icon: string; items: string[] }[] = [
    {
      module: 'Strategy Table', color: '#7C3AED', icon: '♟️',
      items: decisions.filter(d => d.reviewStatus === 'accepted' && d.type === 'focus').map(d => d.title),
    },
    {
      module: 'Scenario Planning', color: '#D97706', icon: '🔭',
      items: uncertainties.filter(u => u.reviewStatus === 'accepted' && u.canChangeStrategy).map(u => u.title),
    },
    {
      module: 'Value of Information', color: '#0891B2', icon: '💡',
      items: uncertainties.filter(u => u.reviewStatus === 'accepted' && u.impact === 'high').map(u => u.title),
    },
    {
      module: 'Qualitative Assessment', color: '#1D4ED8', icon: '📊',
      items: criteria.filter(c => c.reviewStatus === 'accepted').map(c => c.title),
    },
    {
      module: 'Stakeholder Alignment', color: '#059669', icon: '👥',
      items: tensions.filter(t => t.reviewStatus === 'accepted').map(t => t.title),
    },
  ].filter(r => r.items.length > 0);

  if (!routes.length) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="text-3xl">🗺️</div>
      <p className="text-sm font-medium" style={{ color: DS.inkTer }}>Accept items in other zones to see routing</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: DS.inkTer }}>Downstream routing based on accepted items</p>
      {routes.map(route => (
        <div key={route.module} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${DS.border}` }}>
          <div className="flex items-center gap-3 px-4 py-3" style={{ background: DS.surfaceAlt, borderBottom: `1px solid ${DS.border}` }}>
            <span className="text-lg">{route.icon}</span>
            <span className="text-sm font-semibold" style={{ color: DS.ink }}>{route.module}</span>
            <ArrowRight size={14} style={{ color: DS.inkFaint, marginLeft: 'auto' }} />
          </div>
          <div className="p-3 space-y-1.5">
            {route.items.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: route.color }} />
                <p className="text-xs" style={{ color: DS.inkTer }}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function DecisionStructuring({ acceptedItems, sessionData, persistedState, onPersistState, onValidated }: Props) {
  const [activeZone, setActiveZone] = useState<ActiveZone>('decisions');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [decisions, setDecisions] = useState<StructuredDecision[]>(() => persistedState?.decisions ?? []);
  const [uncertainties, setUncertainties] = useState<StructuredUncertainty[]>(() => persistedState?.uncertainties ?? []);
  const [tensions, setTensions] = useState<StructuredTension[]>(() => persistedState?.tensions ?? []);
  const [criteria, setCriteria] = useState<StructuredCriterion[]>(() => persistedState?.criteria ?? []);

  const frame = useMemo(() => getFrame(sessionData, acceptedItems ?? []), [sessionData, acceptedItems]);

  useEffect(() => {
    onPersistState?.({ decisions, uncertainties, tensions, criteria });
  }, [decisions, uncertainties, tensions, criteria]);
  const raisedItems = useMemo(() => getRaisedItems(sessionData, acceptedItems ?? []), [sessionData, acceptedItems]);

  // ── Accept/reject helpers ────────────────────────────────────

  const updateDecision = useCallback((id: string, status: 'accepted' | 'rejected') =>
    setDecisions(p => p.map(d => d.id === id ? { ...d, reviewStatus: status } : d)), []);
  const updateUncertainty = useCallback((id: string, status: 'accepted' | 'rejected') =>
    setUncertainties(p => p.map(u => u.id === id ? { ...u, reviewStatus: status } : u)), []);
  const updateTension = useCallback((id: string, status: 'accepted' | 'rejected') =>
    setTensions(p => p.map(t => t.id === id ? { ...t, reviewStatus: status } : t)), []);
  const updateCriterion = useCallback((id: string, status: 'accepted' | 'rejected') =>
    setCriteria(p => p.map(c => c.id === id ? { ...c, reviewStatus: status } : c)), []);

  // ── AI: Structure everything ─────────────────────────────────

  const handleStructure = useCallback(async () => {
    if (!frame) { setAiError('Problem Frame not found.'); return; }
    setAiLoading(true); setAiError(null);

    const raisedSummary = raisedItems.length > 0
      ? raisedItems.map((i: any) => `[${i.classification ?? i.type ?? 'item'}] ${i.title ?? i.label ?? ''}`).join('\n')
      : 'No raised items yet — structure from Problem Frame only';

    const prompt = `You are a Decision Quality facilitator. Structure the decision intelligence below into organized sections.

DECISION: ${frame.decisionStatement}
TRIGGER: ${frame.trigger}
CONSTRAINTS: ${frame.constraints.join(', ') || 'None'}
ASSUMPTIONS: ${frame.assumptions.join(', ') || 'None'}
SUCCESS CRITERIA: ${frame.successCriteria.join(', ') || 'None'}

RAISED INTELLIGENCE:
${raisedSummary}

Structure this into:

1. DECISIONS — classify each as: focus (must resolve now), tactical (implementation choice), deferred (decide later), given (already decided)
2. UNCERTAINTIES — rank by impact (high/medium/low), flag if strategy-changing, suggest downstream: scenario_planning, voi, risk_timeline
3. TENSIONS — identify trade-offs with two competing sides and severity 1-5
4. CRITERIA — evaluation dimensions with weight 1-5 and type: value, risk, feasibility, timing, stakeholder, strategic_fit

RULES:
- Focus decisions: extract ALL decisions that truly must be resolved to move forward — no artificial limit
- Every focus decision MUST have 2-4 choices: mutually exclusive options a strategy could take on this decision
- Choices should be short, specific, and action-oriented reflecting the actual decision context
- Uncertainties: extract ALL strategy-changing unknowns — no limit
- Tensions: extract ALL real trade-offs — no limit
- Criteria: extract ALL evaluation dimensions relevant to this decision — no limit
- Strategy-changing uncertainties: those where resolution would change the preferred strategy
- Tensions must have specific sideA vs sideB language grounded in the actual decision
- Criteria should be measurable and specific to this decision

Return ONLY valid JSON:
{
  "decisions": [
    { "title": "", "type": "focus|tactical|deferred|given", "rationale": "", "choices": ["Option A", "Option B", "Option C"] }
  ],
  "uncertainties": [
    { "title": "", "impact": "high|medium|low", "canChangeStrategy": true, "type": "market|technical|regulatory|stakeholder|financial|operational", "downstreamTargets": ["scenario_planning"] }
  ],
  "tensions": [
    { "title": "", "sideA": "", "sideB": "", "type": "custom", "severity": 3 }
  ],
  "criteria": [
    { "title": "", "weight": 3, "type": "value|risk|feasibility|timing|stakeholder|strategic_fit" }
  ]
}`;

    try {
      const result = await callAI(prompt);

      setDecisions((result.decisions ?? []).map((d: any) => ({
        id: makeId(), title: d.title, type: d.type ?? 'focus',
        rationale: d.rationale ?? '', source: 'ai' as const, reviewStatus: 'needs_review' as const,
        choices: d.choices ?? [],
      })));

      setUncertainties((result.uncertainties ?? []).map((u: any) => ({
        id: makeId(), title: u.title, impact: u.impact ?? 'medium',
        canChangeStrategy: u.canChangeStrategy ?? false,
        type: u.type ?? 'market', source: 'ai' as const,
        reviewStatus: 'needs_review' as const,
        downstreamTargets: u.downstreamTargets ?? [],
      })));

      setTensions((result.tensions ?? []).map((t: any) => ({
        id: makeId(), title: t.title, sideA: t.sideA ?? '', sideB: t.sideB ?? '',
        type: t.type ?? 'custom', severity: t.severity ?? 3,
        source: 'ai' as const, reviewStatus: 'needs_review' as const,
      })));

      setCriteria((result.criteria ?? []).map((c: any) => ({
        id: makeId(), title: c.title, weight: c.weight ?? 3,
        type: c.type ?? 'value', source: 'ai' as const,
        reviewStatus: 'needs_review' as const,
      })));

    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  }, [frame, raisedItems]);

  // ── Counts ───────────────────────────────────────────────────

  const counts = {
    decisions: decisions.filter(d => d.reviewStatus !== 'rejected').length,
    uncertainties: uncertainties.filter(u => u.reviewStatus !== 'rejected').length,
    tensions: tensions.filter(t => t.reviewStatus !== 'rejected').length,
    criteria: criteria.filter(c => c.reviewStatus !== 'rejected').length,
  };

  const acceptedCounts = {
    decisions: decisions.filter(d => d.reviewStatus === 'accepted').length,
    uncertainties: uncertainties.filter(u => u.reviewStatus === 'accepted').length,
    tensions: tensions.filter(t => t.reviewStatus === 'accepted').length,
    criteria: criteria.filter(c => c.reviewStatus === 'accepted').length,
  };

  const totalAccepted = Object.values(acceptedCounts).reduce((a, b) => a + b, 0);
  const focusDecisions = decisions.filter(d => d.type === 'focus' && d.reviewStatus === 'accepted');
  const isReady = focusDecisions.length >= 1 && acceptedCounts.uncertainties >= 1 && acceptedCounts.criteria >= 2;

  const ZONES: { id: ActiveZone; label: string; icon: string; count: number }[] = [
    { id: 'decisions',     label: 'Focus Decisions',    icon: '🎯', count: counts.decisions },
    { id: 'uncertainties', label: 'Uncertainties',      icon: '❓', count: counts.uncertainties },
    { id: 'tensions',      label: 'Tensions',           icon: '⚡', count: counts.tensions },
    { id: 'criteria',      label: 'Criteria',           icon: '📊', count: counts.criteria },
    { id: 'routing',       label: 'Routing Map',        icon: '🗺️', count: 0 },
  ];

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
        <button onClick={handleStructure} disabled={aiLoading || !frame}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
          style={{ background: aiLoading ? DS.surfaceAlt : DS.accent, color: aiLoading ? DS.inkTer : '#fff' }}>
          <Sparkles size={12} /> {aiLoading ? 'Structuring…' : 'Structure Decision Intelligence'}
        </button>
        <div className="flex-1" />
        {/* Summary pills */}
        <div className="flex items-center gap-1.5">
          {[
            { label: `${focusDecisions.length} focus`, color: '#4F6AF5', show: focusDecisions.length > 0 },
            { label: `${acceptedCounts.uncertainties} uncertainties`, color: '#D97706', show: acceptedCounts.uncertainties > 0 },
            { label: `${acceptedCounts.tensions} tensions`, color: '#E11D48', show: acceptedCounts.tensions > 0 },
            { label: `${acceptedCounts.criteria} criteria`, color: '#1D4ED8', show: acceptedCounts.criteria > 0 },
          ].filter(p => p.show).map(p => (
            <span key={p.label} className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: DS.surfaceAlt, color: p.color }}>{p.label}</span>
          ))}
        </div>
      </div>

      {/* Zone tabs */}
      <div className="shrink-0 flex items-center overflow-x-auto" style={{ borderBottom: `1px solid ${DS.border}`, background: DS.surface }}>
        {ZONES.map(zone => (
          <ZoneTab key={zone.id} {...zone} active={activeZone === zone.id} onClick={() => setActiveZone(zone.id)} />
        ))}
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Zone content */}
        <div className="flex-1 overflow-y-auto p-5">
          {aiError && (
            <div className="rounded-xl p-3 mb-4" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5' }}>
              <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>Error: {aiError}</p>
            </div>
          )}

          {aiLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <motion.div className="w-8 h-8 rounded-full border-2" style={{ borderColor: DS.accent, borderTopColor: 'transparent' }}
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
              <p className="text-sm" style={{ color: DS.inkTer }}>Structuring decision intelligence…</p>
            </div>
          )}

          {!aiLoading && (
            <>
              {activeZone === 'decisions' && (
                <div className="space-y-5">
                  {[
                    { type: 'focus' as DecisionType, items: decisions.filter(d => d.type === 'focus') },
                    { type: 'tactical' as DecisionType, items: decisions.filter(d => d.type === 'tactical') },
                    { type: 'deferred' as DecisionType, items: decisions.filter(d => d.type === 'deferred') },
                    { type: 'given' as DecisionType, items: decisions.filter(d => d.type === 'given') },
                  ].filter(g => g.items.length > 0).map(group => {
                    const meta = DECISION_TYPE_META[group.type];
                    return (
                      <div key={group.type}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm">{meta.icon}</span>
                          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}s</span>
                          <span className="text-xs" style={{ color: DS.inkFaint }}>— {meta.description}</span>
                        </div>
                        <div className="space-y-2">
                          <AnimatePresence>
                            {group.items.map(d => (
                              <DecisionCard key={d.id} item={d}
                                onAccept={() => updateDecision(d.id, 'accepted')}
                                onReject={() => updateDecision(d.id, 'rejected')} />
                            ))}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })}
                  {decisions.length === 0 && !aiLoading && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="text-4xl">🎯</div>
                      <p className="text-sm font-medium" style={{ color: DS.inkTer }}>No decisions structured yet</p>
                      <p className="text-xs text-center max-w-xs" style={{ color: DS.inkFaint }}>Click "Structure Decision Intelligence" to identify focus decisions, tactical choices, and givens.</p>
                    </div>
                  )}
                </div>
              )}

              {activeZone === 'uncertainties' && (
                <div className="space-y-3">
                  {['high', 'medium', 'low'].map(impact => {
                    const items = uncertainties.filter(u => u.impact === impact);
                    if (!items.length) return null;
                    return (
                      <div key={impact}>
                        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: IMPACT_META[impact as UncertaintyImpact].color }}>
                          {impact.toUpperCase()} IMPACT
                        </p>
                        <div className="space-y-2">
                          <AnimatePresence>
                            {items.map(u => <UncertaintyCard key={u.id} item={u} onAccept={() => updateUncertainty(u.id, 'accepted')} onReject={() => updateUncertainty(u.id, 'rejected')} />)}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })}
                  {uncertainties.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="text-4xl">❓</div>
                      <p className="text-sm font-medium" style={{ color: DS.inkTer }}>No uncertainties identified yet</p>
                    </div>
                  )}
                </div>
              )}

              {activeZone === 'tensions' && (
                <div className="space-y-3">
                  <AnimatePresence>
                    {tensions.map(t => <TensionCard key={t.id} item={t} onAccept={() => updateTension(t.id, 'accepted')} onReject={() => updateTension(t.id, 'rejected')} />)}
                  </AnimatePresence>
                  {tensions.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="text-4xl">⚡</div>
                      <p className="text-sm font-medium" style={{ color: DS.inkTer }}>No tensions identified yet</p>
                    </div>
                  )}
                </div>
              )}

              {activeZone === 'criteria' && (
                <div className="space-y-3">
                  <AnimatePresence>
                    {criteria.sort((a, b) => b.weight - a.weight).map(c => <CriterionCard key={c.id} item={c} onAccept={() => updateCriterion(c.id, 'accepted')} onReject={() => updateCriterion(c.id, 'rejected')} />)}
                  </AnimatePresence>
                  {criteria.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="text-4xl">📊</div>
                      <p className="text-sm font-medium" style={{ color: DS.inkTer }}>No criteria identified yet</p>
                    </div>
                  )}
                </div>
              )}

              {activeZone === 'routing' && (
                <RoutingMap decisions={decisions} uncertainties={uncertainties} tensions={tensions} criteria={criteria} />
              )}
            </>
          )}

          {/* Proceed gate */}
          {totalAccepted > 0 && (
            <div className="mt-6 rounded-xl p-4" style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
              {isReady ? (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => onValidated?.({ focusDecisions: decisions.filter(d => d.reviewStatus === 'accepted' && d.type === 'focus'), tacticalDecisions: decisions.filter(d => d.reviewStatus === 'accepted' && d.type === 'tactical'), deferredDecisions: decisions.filter(d => d.reviewStatus === 'accepted' && d.type === 'deferred'), givens: decisions.filter(d => d.reviewStatus === 'accepted' && d.type === 'given'), criticalUncertainties: uncertainties.filter(u => u.reviewStatus === 'accepted'), tensions: tensions.filter(t => t.reviewStatus === 'accepted'), criteria: criteria.filter(c => c.reviewStatus === 'accepted') })}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                  style={{ background: DS.accent, color: '#fff', boxShadow: `0 4px 14px ${DS.accent}40` }}>
                  <CheckCircle2 size={16} /> Proceed to Strategy Formation
                </motion.button>
              ) : (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: DS.inkTer }}>Before proceeding to Strategy Formation:</p>
                  {!focusDecisions.length && <p className="text-xs mb-1" style={{ color: DS.inkTer }}>· Accept at least 1 focus decision</p>}
                  {!acceptedCounts.uncertainties && <p className="text-xs mb-1" style={{ color: DS.inkTer }}>· Accept at least 1 uncertainty</p>}
                  {acceptedCounts.criteria < 2 && <p className="text-xs mb-1" style={{ color: DS.inkTer }}>· Accept at least 2 evaluation criteria</p>}
                  <button onClick={() => onValidated?.({ focusDecisions: decisions.filter(d => d.reviewStatus === 'accepted' && d.type === 'focus'), tacticalDecisions: [], deferredDecisions: [], givens: [], criticalUncertainties: uncertainties.filter(u => u.reviewStatus === 'accepted'), tensions: tensions.filter(t => t.reviewStatus === 'accepted'), criteria: criteria.filter(c => c.reviewStatus === 'accepted') })}
                    className="mt-3 w-full py-2 rounded-lg text-xs font-medium"
                    style={{ background: DS.surface, color: DS.inkTer, border: `1px solid ${DS.border}` }}>
                    Override & Proceed Anyway
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right summary panel */}
        <div className="w-60 shrink-0 hidden xl:flex flex-col gap-4 p-4 overflow-y-auto" style={{ borderLeft: `1px solid ${DS.border}`, background: DS.surface }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: DS.inkTer }}>Structure Summary</p>
            <div className="space-y-2">
              {[
                { label: 'Focus Decisions', val: decisions.filter(d => d.type === 'focus' && d.reviewStatus === 'accepted').length, total: decisions.filter(d => d.type === 'focus').length, color: '#4F6AF5' },
                { label: 'Uncertainties', val: acceptedCounts.uncertainties, total: counts.uncertainties, color: '#D97706' },
                { label: 'Tensions', val: acceptedCounts.tensions, total: counts.tensions, color: '#E11D48' },
                { label: 'Criteria', val: acceptedCounts.criteria, total: counts.criteria, color: '#1D4ED8' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-xs flex-1" style={{ color: DS.inkTer }}>{s.label}</span>
                  <span className="text-xs font-semibold" style={{ color: s.val > 0 ? s.color : DS.inkFaint }}>
                    {s.val}/{s.total}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Strategy-changing uncertainties callout */}
          {uncertainties.some(u => u.canChangeStrategy && u.reviewStatus === 'accepted') && (
            <div className="rounded-xl p-3" style={{ background: '#FEF3C7', border: '1px solid #FCD34D' }}>
              <p className="text-xs font-semibold mb-1.5" style={{ color: '#92400E' }}>⚡ Strategy-Changing</p>
              {uncertainties.filter(u => u.canChangeStrategy && u.reviewStatus === 'accepted').map(u => (
                <p key={u.id} className="text-xs mb-1" style={{ color: '#78350F' }}>· {u.title}</p>
              ))}
            </div>
          )}

          {/* Readiness */}
          <div className="rounded-xl p-3" style={{ background: isReady ? '#DCFCE7' : DS.surfaceAlt, border: `1px solid ${isReady ? '#86EFAC' : DS.border}` }}>
            <p className="text-xs font-semibold" style={{ color: isReady ? '#059669' : DS.inkTer }}>
              {isReady ? '✅ Ready for Strategy' : 'Not yet ready'}
            </p>
            {!isReady && (
              <p className="text-xs mt-1" style={{ color: DS.inkFaint }}>
                Need: 1 focus decision, 1 uncertainty, 2 criteria
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

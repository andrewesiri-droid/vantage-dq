import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import { useDQAI } from '@/hooks/useDQAI';
import {
  Target, Save, CheckCircle2, Sparkles, ChevronDown,
  ChevronRight, Clock, Layers, Trophy, AlertTriangle,
  User, Calendar, Lightbulb, TrendingUp,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface FrameData {
  // Core
  frameType: 'problem' | 'opportunity';
  decisionStatement: string;
  // Owner & time
  decisionOwner: string;
  deadline: string;
  // Why Now
  trigger: string;
  background: string;
  context: string;
  // Boundaries
  scopeIn: string;
  scopeOut: string;
  constraints: string;
  assumptions: string;
  // Perspective
  perspective: string;
  // Success
  successCriteria: string;
  failureConsequences: string;
}

interface DQDimension { id: string; label: string; score: number; issue?: string; }
interface AIInsight { text: string; type: 'warning' | 'tip' | 'good'; }
interface Props { sessionId?: number; data?: any; hooks?: any; persistedState?: any; onPersistState?: (state: any) => void; }

const EMPTY: FrameData = {
  frameType: 'problem',
  decisionStatement: '',
  decisionOwner: '',
  deadline: '',
  trigger: '',
  background: '',
  context: '',
  scopeIn: '',
  scopeOut: '',
  constraints: '',
  assumptions: '',
  perspective: '',
  successCriteria: '',
  failureConsequences: '',
};

// ─────────────────────────────────────────────────────────────
// SECTION GROUPS
// ─────────────────────────────────────────────────────────────

const GROUPS = [
  {
    id: 'why',
    label: 'Why Now',
    subtitle: 'The situation forcing a decision',
    icon: Clock,
    color: '#6366F1',
    colorLight: '#EEF2FF',
    fields: [
      {
        key: 'trigger',
        label: 'Driver for a Decision Now',
        placeholder: 'What situation is driving the need for a decision at this time? What changes if we delay?',
        rows: 3,
        required: true,
        dqNote: 'DQ: name the trigger — decisions floated in time lack urgency and commitment',
      },
      {
        key: 'background',
        label: 'Background & History',
        placeholder: 'Relevant context, prior decisions, and history the team needs to understand…',
        rows: 3,
        required: false,
        dqNote: null,
      },
      {
        key: 'context',
        label: 'Key Questions to Answer',
        placeholder: 'What are the 2–5 key questions decision makers need this evaluation to answer?',
        rows: 3,
        required: true,
        dqNote: 'These guide which alternatives to consider — without them, the analysis has no anchor',
      },
    ],
  },
  {
    id: 'boundaries',
    label: 'Boundaries',
    subtitle: 'What is fixed vs. flexible',
    icon: Layers,
    color: '#0891B2',
    colorLight: '#ECFEFF',
    fields: [
      {
        key: 'scopeIn',
        label: 'In Scope',
        placeholder: 'What is explicitly included in this decision? (one item per line)',
        rows: 2,
        required: false,
        dqNote: null,
      },
      {
        key: 'scopeOut',
        label: 'Out of Scope',
        placeholder: 'What is explicitly excluded? Decisions already made? (one item per line)',
        rows: 2,
        required: false,
        dqNote: 'DQ: what is OUT of scope is as important as what is in scope',
      },
      {
        key: 'constraints',
        label: 'Givens & Constraints',
        placeholder: 'Non-negotiable boundaries — budget, time, regulatory, strategic givens…',
        rows: 2,
        required: true,
        dqNote: null,
      },
      {
        key: 'assumptions',
        label: 'Assumptions',
        placeholder: 'What are we assuming to be true that, if wrong, would change this decision?',
        rows: 2,
        required: false,
        dqNote: 'Surface assumptions now — hidden assumptions are the most common source of poor decisions',
      },
    ],
  },
  {
    id: 'perspective',
    label: 'Perspective',
    subtitle: 'Whose lens and what alternatives exist',
    icon: TrendingUp,
    color: '#7C3AED',
    colorLight: '#F5F3FF',
    fields: [
      {
        key: 'perspective',
        label: 'Decision Perspective',
        placeholder: 'From whose vantage point is this framed? What assumptions are baked into that perspective? How might others frame this same situation differently?',
        rows: 4,
        required: false,
        dqNote: 'DQ framing triad: Purpose + Scope + Perspective. Perspective is the lens — it shapes everything',
      },
    ],
  },
  {
    id: 'success',
    label: 'Success',
    subtitle: 'What we are optimizing for',
    icon: Trophy,
    color: '#059669',
    colorLight: '#ECFDF5',
    fields: [
      {
        key: 'successCriteria',
        label: 'Values & Objectives',
        placeholder: 'What are the decision criteria and objectives by which we should compare alternatives? (quantitative and qualitative)',
        rows: 3,
        required: true,
        dqNote: 'Values are the human\'s to define — AI can make tradeoffs explicit but cannot decide what the org values',
      },
      {
        key: 'failureConsequences',
        label: 'Cost of a Wrong Decision',
        placeholder: 'What happens if we choose poorly? What is the downside of inaction vs. wrong action?',
        rows: 2,
        required: false,
        dqNote: null,
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// DQ COMPUTATION — now includes Ownership and Perspective
// ─────────────────────────────────────────────────────────────

function computeDimensions(d: FrameData): DQDimension[] {
  const stmt = d.decisionStatement.trim();
  return [
    {
      id: 'clarity', label: 'Clarity',
      score: stmt.length > 80 ? 90 : stmt.length > 30 ? 60 : stmt.length > 0 ? 25 : 0,
      issue: stmt.length < 30 ? 'Decision statement too brief' : undefined,
    },
    {
      id: 'focus', label: 'Decision Focus',
      score: /^(how|should|whether|we need|what strategy|what is the best)/i.test(stmt) ? 88
        : stmt.length > 0 ? 50 : 0,
      issue: stmt.length > 0 && !/^(how|should|whether|we need|what strategy|what is the best)/i.test(stmt)
        ? 'Frame as an open question, not a conclusion' : undefined,
    },
    {
      id: 'ownership', label: 'Ownership',
      score: d.decisionOwner.trim().length > 0 && d.deadline.trim().length > 0 ? 95
        : d.decisionOwner.trim().length > 0 || d.deadline.trim().length > 0 ? 50 : 0,
      issue: !d.decisionOwner.trim() ? 'No decision owner — DQ: one person, not a committee'
        : !d.deadline.trim() ? 'No deadline — commitment is impossible without one' : undefined,
    },
    {
      id: 'scope', label: 'Scope',
      score: (d.scopeIn.length > 20 ? 50 : 0) + (d.scopeOut.length > 20 ? 50 : 0),
      issue: d.scopeIn.length === 0 && d.scopeOut.length === 0 ? 'Scope not defined — in AND out of scope required' : undefined,
    },
    {
      id: 'perspective', label: 'Perspective',
      score: d.perspective.trim().length > 50 ? 85 : d.perspective.trim().length > 0 ? 40 : 0,
      issue: !d.perspective.trim() ? 'Whose lens? Unstated perspective hides bias' : undefined,
    },
    {
      id: 'success', label: 'Success',
      score: d.successCriteria.length > 30 ? 90 : d.successCriteria.length > 0 ? 45 : 0,
      issue: !d.successCriteria ? 'No values or objectives — cannot compare alternatives' : undefined,
    },
  ];
}

function overallScore(dims: DQDimension[]) {
  return Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length);
}

function scoreColor(score: number) {
  return score >= 75 ? DS.success : score >= 45 ? DS.warning : DS.danger;
}

function fieldCompletion(frame: FrameData) {
  const required = ['decisionStatement', 'decisionOwner', 'deadline', 'trigger', 'context', 'constraints', 'successCriteria'];
  const filled = required.filter(k => (frame as any)[k]?.trim().length > 2).length;
  return { total: required.length, filled };
}

// ─────────────────────────────────────────────────────────────
// OPPORTUNITY STATEMENT VALIDATOR
// Based on DQ methodology requirements
// ─────────────────────────────────────────────────────────────

function validateOpportunityStatement(frame: FrameData): { pass: boolean; label: string; color: string }[] {
  const stmt = frame.decisionStatement.trim();
  return [
    {
      label: 'Open question (not a conclusion)',
      pass: /^(how|should|whether|what|which)/i.test(stmt) && stmt.endsWith('?') || stmt.length === 0,
      color: DS.success,
    },
    {
      label: 'Decision owner named',
      pass: frame.decisionOwner.trim().length > 1,
      color: DS.success,
    },
    {
      label: 'Deadline defined',
      pass: frame.deadline.trim().length > 1,
      color: DS.success,
    },
    {
      label: 'Trigger / why now',
      pass: frame.trigger.trim().length > 20,
      color: DS.success,
    },
    {
      label: 'Scope bounded (in + out)',
      pass: frame.scopeIn.trim().length > 5 && frame.scopeOut.trim().length > 5,
      color: DS.success,
    },
    {
      label: 'Perspective stated',
      pass: frame.perspective.trim().length > 20,
      color: DS.success,
    },
    {
      label: 'Success criteria defined',
      pass: frame.successCriteria.trim().length > 20,
      color: DS.success,
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

function CompletionDot({ value }: { value: string }) {
  const filled = value.trim().length > 10;
  const partial = value.trim().length > 0 && !filled;
  return (
    <div
      className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
      style={{
        background: filled ? DS.success : partial ? DS.warning : DS.border,
        transition: 'background 0.3s',
      }}
    />
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = scoreColor(score);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke={DS.border} strokeWidth="5" />
        <motion.circle
          cx="36" cy="36" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-bold leading-none" style={{ color }}>{score}</span>
        <span className="text-xs" style={{ color: DS.inkTer }}>DQ</span>
      </div>
    </div>
  );
}

function SectionGroup({
  group, frame, onChange, defaultOpen,
}: {
  group: typeof GROUPS[0];
  frame: FrameData;
  onChange: (key: keyof FrameData, val: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = group.icon;
  const filledCount = group.fields.filter(f => (frame as any)[f.key]?.trim().length > 10).length;
  const totalCount = group.fields.length;
  const allFilled = filledCount === totalCount;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${DS.border}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: open ? group.colorLight : DS.surface }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: open ? group.color : DS.surfaceAlt }}
        >
          <Icon size={15} style={{ color: open ? '#fff' : DS.inkTer }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm" style={{ color: DS.ink }}>{group.label}</span>
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{
                background: allFilled ? DS.successLight : DS.surfaceAlt,
                color: allFilled ? '#059669' : DS.inkTer,
              }}
            >
              {filledCount}/{totalCount}
            </span>
          </div>
          <p className="text-xs" style={{ color: DS.inkTer }}>{group.subtitle}</p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} style={{ color: DS.inkTer }} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="p-4 space-y-4" style={{ borderTop: `1px solid ${DS.border}` }}>
              {group.fields.map(field => (
                <div key={field.key} className="flex gap-2">
                  <CompletionDot value={(frame as any)[field.key]} />
                  <div className="flex-1">
                    <label className="block text-xs font-semibold mb-1" style={{ color: DS.ink }}>
                      {field.label}
                      {field.required && <span className="ml-1" style={{ color: group.color }}>*</span>}
                    </label>
                    {field.dqNote && (
                      <p className="text-xs mb-1.5 italic" style={{ color: DS.inkFaint }}>{field.dqNote}</p>
                    )}
                    <textarea
                      rows={field.rows}
                      value={(frame as any)[field.key]}
                      onChange={e => onChange(field.key as keyof FrameData, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg px-3 py-2 text-sm resize-none transition-all"
                      style={{
                        background: DS.surfaceAlt,
                        border: `1.5px solid ${DS.border}`,
                        color: DS.ink,
                        outline: 'none',
                        lineHeight: '1.6',
                      }}
                      onFocus={e => (e.target.style.borderColor = group.color)}
                      onBlur={e => (e.target.style.borderColor = DS.border)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AIPanel({
  insights, loading, onAnalyze, dqHandoff, onViewResults,
}: {
  insights: AIInsight[];
  loading: boolean;
  onAnalyze: () => void;
  dqHandoff: string | null;
  onViewResults: () => void;
}) {
  const iconMap = { warning: '⚠️', tip: '💡', good: '✅' };
  const bgMap = { warning: DS.warningLight, tip: DS.accentLight, good: DS.successLight };
  const colorMap = { warning: '#92400E', tip: DS.accent, good: '#065F46' };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${DS.border}` }}>
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: DS.accentLight, borderBottom: `1px solid ${DS.border}` }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: DS.accent }} />
          <span className="text-xs font-semibold" style={{ color: DS.accent }}>AI Facilitator</span>
        </div>
        <button
          onClick={insights.length > 0 ? onViewResults : onAnalyze}
          disabled={loading}
          className="text-xs px-3 py-1 rounded-full font-semibold transition-all"
          style={{
            background: loading ? DS.border : DS.accent,
            color: loading ? DS.inkTer : '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Analyzing…' : insights.length > 0 ? `View ${insights.length} Insights` : 'Analyze Frame'}
        </button>
      </div>

      <div className="p-3 space-y-2" style={{ background: DS.surface }}>
        {insights.length === 0 && !loading && (
          <div className="text-center py-5">
            <Sparkles size={20} style={{ color: DS.border, margin: '0 auto 8px' }} />
            <p className="text-xs" style={{ color: DS.inkFaint }}>
              Fill in the frame then click Analyze for DQ-grounded AI feedback.
            </p>
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2 py-5 justify-center">
            <motion.div
              className="w-4 h-4 rounded-full border-2"
              style={{ borderColor: DS.accent, borderTopColor: 'transparent' }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
            />
            <span className="text-xs" style={{ color: DS.inkTer }}>Analyzing your frame…</span>
          </div>
        )}
        <AnimatePresence>
          {insights.map((ins, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex gap-2 p-2.5 rounded-lg text-xs"
              style={{ background: bgMap[ins.type] }}
            >
              <span className="text-sm flex-shrink-0">{iconMap[ins.type]}</span>
              <span style={{ color: colorMap[ins.type], lineHeight: '1.5' }}>{ins.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* DQ Handoff */}
        <AnimatePresence>
          {dqHandoff && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg text-xs mt-1"
              style={{
                background: '#F5F3FF',
                border: '1px solid #DDD6FE',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb size={11} style={{ color: '#7C3AED' }} />
                <span className="font-semibold" style={{ color: '#7C3AED' }}>Human owns this</span>
              </div>
              <p style={{ color: '#5B21B6', lineHeight: '1.5' }}>{dqHandoff}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function ProblemFrame({ sessionId, data, hooks, persistedState, onPersistState }: Props) {
  const [frame, setFrame] = useState<FrameData>(() => {
    // Restore from persisted state first (navigation back)
    if (persistedState?.frame) return persistedState.frame;
    if (data) {
      return {
        frameType: data.frameType ?? 'problem',
        decisionStatement: data.decisionStatement ?? '',
        decisionOwner: data.decisionOwner ?? '',
        deadline: data.deadline ?? '',
        context: data.context ?? '',
        background: data.background ?? '',
        trigger: data.trigger ?? '',
        scopeIn: Array.isArray(data.scopeIn) ? data.scopeIn.join('\n') : data.scopeIn ?? '',
        scopeOut: Array.isArray(data.scopeOut) ? data.scopeOut.join('\n') : data.scopeOut ?? '',
        constraints: Array.isArray(data.constraints) ? data.constraints.join('\n') : data.constraints ?? '',
        assumptions: Array.isArray(data.assumptions) ? data.assumptions.join('\n') : data.assumptions ?? '',
        perspective: data.perspective ?? '',
        successCriteria: Array.isArray(data.successCriteria) ? data.successCriteria.join('\n') : data.successCriteria ?? '',
        failureConsequences: data.failureConsequences ?? '',
      };
    }
    return EMPTY;
  });

  const [saved, setSaved] = useState(false);
  const [validated, setValidated] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [dqHandoff, setDqHandoff] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const { call, loading: aiLoading, error: aiError } = useDQAI();

  const dimensions = computeDimensions(frame);
  const overall = overallScore(dimensions);
  const { filled, total } = fieldCompletion(frame);
  const isComplete = filled === total;
  const opportunityChecks = validateOpportunityStatement(frame);
  const passCount = opportunityChecks.filter(c => c.pass).length;

  const handleChange = useCallback((key: keyof FrameData, val: string) => {
    setFrame(p => {
      const next = { ...p, [key]: val };
      onPersistState?.({ frame: next });
      return next;
    });
    setSaved(false);
    setValidated(false);
  }, [onPersistState]);

  const handleSave = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  // Real Claude AI call via useDQAI + DQ constitution
  const handleAnalyze = useCallback(async () => {
    setInsights([]);
    setDqHandoff(null);
    setShowResults(false);

    const prompt = `Analyze this decision frame and return JSON with this exact shape:
{
  "insights": [{ "text": string, "type": "warning"|"tip"|"good" }],
  "dqHandoff": string
}

Frame Type: ${frame.frameType}
Decision Statement: "${frame.decisionStatement}"
Decision Owner: "${frame.decisionOwner}"
Deadline: "${frame.deadline}"
Trigger: "${frame.trigger}"
Key Questions: "${frame.context}"
Scope In: "${frame.scopeIn}"
Scope Out: "${frame.scopeOut}"
Constraints: "${frame.constraints}"
Assumptions: "${frame.assumptions}"
Perspective: "${frame.perspective}"
Success Criteria: "${frame.successCriteria}"
Failure Consequences: "${frame.failureConsequences}"

Rules:
- insights: 3-5 items, specific and incisive — reference the actual content, not generic advice
- Check: Is the decision statement a genuine open question or a disguised conclusion?
- Check: Is there one named owner? A concrete deadline?
- Check: Are scope boundaries explicit — in AND out?
- Check: Is perspective stated — whose lens is this?
- Check: Do success criteria reflect real values or proxy metrics?
- Check: Are assumptions surfaced or hidden?
- dqHandoff: one sentence naming what the human must own that AI cannot determine for them
- Return ONLY valid JSON, no markdown`;

    const result = await call(prompt, {
      moduleId: 'problem-frame',
      dqElement: 'Frame',
      sessionData: { session: { decisionStatement: frame.decisionStatement }, frame },
    });

    if (result) {
      // Try result.data first, then fall back to top-level result
      const d = (result.data && (result.data as any).insights)
        ? result.data as any
        : result as any;
      if (Array.isArray(d.insights)) setInsights(d.insights);
      if (d.dqHandoff) setDqHandoff(d.dqHandoff);
      if (Array.isArray(d.insights) && d.insights.length > 0) setShowResults(true);
    }
  }, [frame, call]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden" style={{ background: DS.bg, fontFamily: DS.fontDisplay }}>

      {/* ── AI Results Drawer ── */}
      {showResults && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'stretch',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setShowResults(false)}
            style={{ flex: 1, background: 'rgba(0,0,0,0.4)', cursor: 'pointer' }}
          />
          {/* Drawer */}
          <div style={{
            width: 480, background: DS.surface,
            borderLeft: `1px solid ${DS.border}`,
            display: 'flex', flexDirection: 'column',
            boxShadow: DS.shadowLg,
            overflowY: 'auto',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${DS.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: DS.accentLight,
              position: 'sticky', top: 0, zIndex: 1,
            }}>
              <div className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: DS.accent }} />
                <span style={{ fontWeight: 700, fontSize: 15, color: DS.accent }}>AI Frame Analysis</span>
                <span style={{
                  background: DS.accent, color: '#fff',
                  borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700,
                }}>{insights.length}</span>
              </div>
              <button
                onClick={() => setShowResults(false)}
                style={{
                  background: 'transparent', border: 'none',
                  color: DS.inkTer, cursor: 'pointer', fontSize: 18, lineHeight: 1,
                }}
              >×</button>
            </div>

            {/* Insights */}
            <div style={{ padding: '16px 20px', flex: 1 }}>
              <p style={{ fontSize: 12, color: DS.inkTer, marginBottom: 16 }}>
                Based on Decision Analysis's DQ framing methodology. Review each insight and use it to guide your team discussion.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {insights.map((ins, i) => {
                  const iconMap = { warning: '⚠️', tip: '💡', good: '✅' };
                  const bgMap = { warning: DS.warningLight, tip: DS.accentLight, good: DS.successLight };
                  const colorMap = { warning: '#92400E', tip: DS.accentDark, good: '#065F46' };
                  const borderMap = { warning: '#FCD34D', tip: DS.accent, good: DS.success };
                  return (
                    <div key={i} style={{
                      background: bgMap[ins.type],
                      border: `1px solid ${borderMap[ins.type]}30`,
                      borderRadius: 10, padding: '12px 14px',
                    }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{iconMap[ins.type]}</span>
                        <p style={{
                          fontSize: 13, color: colorMap[ins.type],
                          lineHeight: 1.6, margin: 0, flex: 1,
                        }}>{ins.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DQ Handoff */}
              {dqHandoff && (
                <div style={{
                  marginTop: 20, padding: '14px 16px',
                  background: '#F5F3FF', border: '1px solid #DDD6FE',
                  borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Lightbulb size={13} style={{ color: '#7C3AED' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>
                      Human owns this
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#5B21B6', lineHeight: 1.6, margin: 0 }}>
                    {dqHandoff}
                  </p>
                </div>
              )}

              {/* Re-analyze button */}
              <button
                onClick={() => { setShowResults(false); handleAnalyze(); }}
                style={{
                  marginTop: 20, width: '100%',
                  padding: '10px', borderRadius: 8,
                  background: DS.accentLight, border: `1px solid ${DS.accent}30`,
                  color: DS.accent, fontWeight: 600, fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Re-analyze Frame
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Left: Main workspace ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Top bar */}
        <div
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderBottom: `1px solid ${DS.border}`, background: DS.surface }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: DS.accentLight }}>
              <Target size={15} style={{ color: DS.accent }} />
            </div>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: DS.ink }}>Problem Frame</h2>
              <p className="text-xs" style={{ color: DS.inkTer }}>Define the decision before exploring options</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: total }).map((_, i) => (
                <div
                  key={i}
                  className="w-5 h-1.5 rounded-full transition-all duration-300"
                  style={{ background: i < filled ? DS.accent : DS.border }}
                />
              ))}
            </div>
            <AnimatePresence>
              {saved && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: DS.success }}
                >
                  <CheckCircle2 size={12} /> Saved
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: DS.accentLight, color: DS.accent }}
            >
              <Save size={12} /> Save
            </button>
          </div>
        </div>

        {/* ── Frame Type Toggle ── */}
        <div className="px-6 pt-5 pb-3 shrink-0" style={{ background: DS.surface }}>
          <p className="text-xs font-semibold mb-2" style={{ color: DS.inkTer }}>What kind of frame is this?</p>
          <div className="flex gap-2">
            {(['problem', 'opportunity'] as const).map(type => (
              <button
                key={type}
                onClick={() => handleChange('frameType', type)}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: frame.frameType === type ? DS.accent : DS.surfaceAlt,
                  color: frame.frameType === type ? '#fff' : DS.inkTer,
                  border: `1.5px solid ${frame.frameType === type ? DS.accent : DS.border}`,
                }}
              >
                {type === 'problem' ? '🔴 Problem to Solve' : '🟢 Opportunity to Capture'}
              </button>
            ))}
          </div>
          {frame.frameType === 'opportunity' && (
            <p className="text-xs mt-2 italic" style={{ color: DS.inkFaint }}>
              DQ: frame as "How should we capture…?" — not "We should pursue X" (that's a conclusion, not a decision)
            </p>
          )}
        </div>

        {/* ── Decision Statement — hero field ── */}
        <div className="px-6 pb-4 shrink-0" style={{ background: DS.surface, borderBottom: `1px solid ${DS.border}` }}>
          <div className="flex items-start gap-2 mb-2">
            <div
              className="w-2 h-2 rounded-full mt-2 flex-shrink-0 transition-all duration-300"
              style={{
                background: frame.decisionStatement.length > 30 ? DS.success
                  : frame.decisionStatement.length > 0 ? DS.warning : DS.border
              }}
            />
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: DS.inkTer }}>
              {frame.frameType === 'opportunity' ? 'Opportunity Statement' : 'Decision Statement'}
              <span className="ml-1" style={{ color: DS.accent }}>*</span>
            </label>
          </div>
          <textarea
            rows={3}
            value={frame.decisionStatement}
            onChange={e => handleChange('decisionStatement', e.target.value)}
            placeholder={
              frame.frameType === 'opportunity'
                ? 'How should we capture the opportunity to…? (open question, solution-neutral)'
                : 'What is the overarching decision? (open question — "How should we…" / "Whether to…")'
            }
            className="w-full rounded-xl px-4 py-3 text-base font-medium resize-none transition-all"
            style={{
              background: DS.surfaceAlt,
              border: `2px solid ${frame.decisionStatement.length > 30 ? DS.success : DS.border}`,
              color: DS.ink,
              outline: 'none',
              lineHeight: '1.6',
              fontSize: 15,
            }}
            onFocus={e => (e.target.style.borderColor = DS.accent)}
            onBlur={e => (e.target.style.borderColor = frame.decisionStatement.length > 30 ? DS.success : DS.border)}
          />

          {/* ── Owner + Deadline row ── */}
          <div className="flex gap-3 mt-3">
            <div className="flex-1">
              <label className="flex items-center gap-1 text-xs font-semibold mb-1.5" style={{ color: DS.ink }}>
                <User size={11} style={{ color: DS.accent }} />
                Decision Owner <span style={{ color: DS.accent }}>*</span>
              </label>
              <input
                type="text"
                value={frame.decisionOwner}
                onChange={e => handleChange('decisionOwner', e.target.value)}
                placeholder="One person — not a committee"
                className="w-full rounded-lg px-3 py-2 text-sm transition-all"
                style={{
                  background: DS.surfaceAlt,
                  border: `1.5px solid ${frame.decisionOwner.trim() ? DS.success : DS.border}`,
                  color: DS.ink,
                  outline: 'none',
                }}
                onFocus={e => (e.target.style.borderColor = DS.accent)}
                onBlur={e => (e.target.style.borderColor = frame.decisionOwner.trim() ? DS.success : DS.border)}
              />
            </div>
            <div className="flex-1">
              <label className="flex items-center gap-1 text-xs font-semibold mb-1.5" style={{ color: DS.ink }}>
                <Calendar size={11} style={{ color: DS.accent }} />
                Decision Deadline <span style={{ color: DS.accent }}>*</span>
              </label>
              <input
                type="text"
                value={frame.deadline}
                onChange={e => handleChange('deadline', e.target.value)}
                placeholder="e.g. Q3 2025 or June 30"
                className="w-full rounded-lg px-3 py-2 text-sm transition-all"
                style={{
                  background: DS.surfaceAlt,
                  border: `1.5px solid ${frame.deadline.trim() ? DS.success : DS.border}`,
                  color: DS.ink,
                  outline: 'none',
                }}
                onFocus={e => (e.target.style.borderColor = DS.accent)}
                onBlur={e => (e.target.style.borderColor = frame.deadline.trim() ? DS.success : DS.border)}
              />
            </div>
          </div>
          <p className="text-xs mt-1.5 italic" style={{ color: DS.inkFaint }}>
            DQ: commitment is impossible without a named owner and a concrete deadline
          </p>
        </div>

        {/* Section groups */}
        <div className="flex-1 p-6 space-y-3">
          {GROUPS.map((group, i) => (
            <SectionGroup
              key={group.id}
              group={group}
              frame={frame}
              onChange={handleChange}
              defaultOpen={i === 0}
            />
          ))}

          {/* Validate button */}
          <AnimatePresence>
            {isComplete && !validated && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => setValidated(true)}
                className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mt-2"
                style={{ background: DS.accent, color: '#fff', boxShadow: `0 4px 14px ${DS.accent}40` }}
              >
                <CheckCircle2 size={16} /> Validate Frame & Continue to Issues
              </motion.button>
            )}
          </AnimatePresence>

          {validated && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 p-4 rounded-xl"
              style={{ background: DS.successLight, border: '1px solid #86EFAC' }}
            >
              <CheckCircle2 size={18} style={{ color: DS.success, flexShrink: 0 }} />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: '#065F46' }}>Frame validated</p>
                <p className="text-xs" style={{ color: '#059669' }}>
                  Ready to generate issues and explore alternatives
                </p>
              </div>
              <ChevronRight size={16} style={{ color: DS.success, flexShrink: 0 }} />
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Right: Intelligence panel ── */}
      <div
        className="w-72 shrink-0 hidden lg:flex flex-col gap-0 overflow-hidden"
        style={{ borderLeft: `1px solid ${DS.border}`, background: DS.surface }}
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Score ring */}
        <div
          className="rounded-xl p-4 flex items-center gap-4"
          style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}` }}
        >
          <ScoreRing score={overall} />
          <div className="flex-1">
            <p className="text-xs font-semibold mb-1" style={{ color: DS.ink }}>Frame Quality</p>
            <p className="text-xs" style={{ color: DS.inkTer }}>
              {overall < 30 ? 'Just getting started'
                : overall < 60 ? 'Taking shape'
                : overall < 80 ? 'Nearly complete'
                : 'Well framed'}
            </p>
            <div className="flex gap-1 mt-2">
              {dimensions.map(dim => (
                <div
                  key={dim.id}
                  title={dim.label}
                  className="flex-1 h-1 rounded-full"
                  style={{ background: scoreColor(dim.score) }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Dimension breakdown */}
        <div className="rounded-xl p-4 space-y-3" style={{ border: `1px solid ${DS.border}` }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: DS.inkTer }}>
            DQ Dimensions
          </p>
          {dimensions.map(dim => (
            <div key={dim.id}>
              <div className="flex justify-between mb-1">
                <span className="text-xs" style={{ color: DS.inkTer }}>{dim.label}</span>
                <span className="text-xs font-semibold" style={{ color: scoreColor(dim.score) }}>{dim.score}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: DS.border }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: scoreColor(dim.score) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${dim.score}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              {dim.issue && (
                <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: DS.danger }}>
                  <AlertTriangle size={10} /> {dim.issue}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* DQ Frame Requirements */}
        <div className="rounded-xl p-4 space-y-2" style={{ border: `1px solid ${DS.border}` }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: DS.inkTer }}>
              DQ Frame Requirements
            </p>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: passCount === 7 ? DS.successLight : DS.warningLight,
                color: passCount === 7 ? '#065F46' : '#92400E',
              }}
            >
              {passCount}/7
            </span>
          </div>
          {opportunityChecks.map((check, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                style={{
                  background: check.pass ? DS.successLight : DS.surfaceAlt,
                  border: `1px solid ${check.pass ? '#86EFAC' : DS.border}`,
                }}
              >
                {check.pass && <CheckCircle2 size={10} style={{ color: DS.success }} />}
              </div>
              <span className="text-xs" style={{ color: check.pass ? DS.ink : DS.inkTer }}>
                {check.label}
              </span>
            </div>
          ))}
        </div>

        </div>
        {/* AI Panel — always visible at bottom */}
        <div className="shrink-0 p-4 pt-0">
        <AIPanel
          insights={insights}
          loading={aiLoading}
          onAnalyze={handleAnalyze}
          dqHandoff={dqHandoff}
          onViewResults={() => setShowResults(true)}
        />
        </div>
      </div>
    </div>
  );
}

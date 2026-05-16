import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import {
  Target, Save, CheckCircle2, Sparkles, ChevronDown,
  ChevronRight, Clock, Layers, Trophy, AlertTriangle,
  Users, Zap, Circle,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface FrameData {
  decisionStatement: string;
  trigger: string;
  context: string;
  background: string;
  scopeIn: string;
  scopeOut: string;
  constraints: string;
  assumptions: string;
  successCriteria: string;
  failureConsequences: string;
}

interface DQDimension { id: string; label: string; score: number; issue?: string; }
interface AIInsight { text: string; type: 'warning' | 'tip' | 'good'; }
interface Props { sessionId?: number; data?: any; hooks?: any; persistedState?: any; onPersistState?: (state: any) => void; }

const EMPTY: FrameData = {
  decisionStatement: '', trigger: '', context: '', background: '',
  scopeIn: '', scopeOut: '', constraints: '', assumptions: '',
  successCriteria: '', failureConsequences: '',
};

// ── Section groups ───────────────────────────────────────────

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
      },
      {
        key: 'background',
        label: 'Background & History',
        placeholder: 'Relevant context, prior decisions, and history the team needs to understand…',
        rows: 3,
        required: false,
      },
      {
        key: 'context',
        label: 'Key Questions to Answer',
        placeholder: 'What are the 2–5 key questions decision makers need this evaluation to answer? These guide which alternatives to consider.',
        rows: 3,
        required: true,
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
      },
      {
        key: 'scopeOut',
        label: 'Out of Scope',
        placeholder: 'What is explicitly excluded? Decisions already made? (one item per line)',
        rows: 2,
        required: false,
      },
      {
        key: 'constraints',
        label: 'Givens & Constraints',
        placeholder: 'Decisions already effectively made, or non-negotiable boundaries (budget, time, regulatory, strategic…)',
        rows: 2,
        required: true,
      },
      {
        key: 'assumptions',
        label: 'Assumptions',
        placeholder: 'What are we assuming to be true that, if wrong, would change this decision?',
        rows: 2,
        required: false,
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
        placeholder: 'What are the decision criteria, objectives or metrics by which we should compare alternatives? (quantitative and qualitative)',
        rows: 3,
        required: true,
      },
      {
        key: 'failureConsequences',
        label: 'Cost of a Wrong Decision',
        placeholder: 'What happens if we choose poorly? What is the downside of inaction vs. wrong action?',
        rows: 2,
        required: false,
      },
    ],
  },
];

// ── DQ computation ───────────────────────────────────────────

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
      score: /^(how|should|whether|we need|what strategy)/i.test(stmt) ? 85 : stmt.length > 0 ? 55 : 0,
      issue: !/^(how|should|whether|we need|what strategy)/i.test(stmt) && stmt.length > 0 ? 'May not be framed as a decision' : undefined,
    },
    {
      id: 'scope', label: 'Scope',
      score: (d.scopeIn.length > 20 ? 50 : 0) + (d.scopeOut.length > 20 ? 50 : 0),
      issue: d.scopeIn.length === 0 && d.scopeOut.length === 0 ? 'Scope not defined' : undefined,
    },
    {
      id: 'context', label: 'Context',
      score: Math.min(100, (d.context.length > 50 ? 40 : 0) + (d.background.length > 50 ? 30 : 0) + (d.trigger.length > 20 ? 30 : 0)),
      issue: d.context.length === 0 ? 'No key questions defined' : undefined,
    },
    {
      id: 'success', label: 'Success',
      score: d.successCriteria.length > 30 ? 90 : d.successCriteria.length > 0 ? 45 : 0,
      issue: d.successCriteria.length === 0 ? 'No success criteria defined' : undefined,
    },
  ];
}

function overallScore(dims: DQDimension[]) {
  return Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length);
}

function scoreColor(score: number) {
  return score >= 75 ? '#059669' : score >= 45 ? '#D97706' : '#DC2626';
}

function fieldCompletion(frame: FrameData): { total: number; filled: number } {
  const required = ['decisionStatement', 'trigger', 'context', 'constraints', 'successCriteria'];
  const filled = required.filter(k => (frame as any)[k]?.trim().length > 10).length;
  return { total: required.length, filled };
}

// ── Sub-components ───────────────────────────────────────────

function CompletionDot({ value }: { value: string }) {
  const filled = value.trim().length > 10;
  const partial = value.trim().length > 0 && !filled;
  return (
    <div
      className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
      style={{
        background: filled ? '#059669' : partial ? '#D97706' : DS.border,
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
      {/* Header */}
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
                background: allFilled ? '#DCFCE7' : DS.surfaceAlt,
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

      {/* Fields */}
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
                      {field.required && (
                        <span className="ml-1" style={{ color: group.color }}>*</span>
                      )}
                    </label>
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
  insights, loading, onAnalyze,
}: {
  insights: AIInsight[];
  loading: boolean;
  onAnalyze: () => void;
}) {
  const iconMap = { warning: '⚠️', tip: '💡', good: '✅' };
  const bgMap = { warning: '#FEF3C7', tip: DS.accentLight, good: '#DCFCE7' };
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
          onClick={onAnalyze}
          disabled={loading}
          className="text-xs px-3 py-1 rounded-full font-semibold transition-all"
          style={{
            background: loading ? DS.border : DS.accent,
            color: loading ? DS.inkTer : '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>

      <div className="p-3 space-y-2" style={{ background: DS.surface }}>
        {insights.length === 0 && !loading && (
          <div className="text-center py-5">
            <Sparkles size={20} style={{ color: DS.border, margin: '0 auto 8px' }} />
            <p className="text-xs" style={{ color: DS.inkFaint }}>
              Fill in the frame then click Analyze for AI feedback.
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
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export default function ProblemFrame({ sessionId, data, hooks }: Props) {
  const [frame, setFrame] = useState<FrameData>(() => {
    if (data) {
      return {
        decisionStatement: data.decisionStatement ?? '',
        context: data.context ?? '',
        background: data.background ?? '',
        trigger: data.trigger ?? '',
        scopeIn: Array.isArray(data.scopeIn) ? data.scopeIn.join('\n') : data.scopeIn ?? '',
        scopeOut: Array.isArray(data.scopeOut) ? data.scopeOut.join('\n') : data.scopeOut ?? '',
        constraints: Array.isArray(data.constraints) ? data.constraints.join('\n') : data.constraints ?? '',
        assumptions: Array.isArray(data.assumptions) ? data.assumptions.join('\n') : data.assumptions ?? '',
        successCriteria: Array.isArray(data.successCriteria) ? data.successCriteria.join('\n') : data.successCriteria ?? '',
        failureConsequences: data.failureConsequences ?? '',
      };
    }
    return EMPTY;
  });

  const [saved, setSaved] = useState(false);
  const [validated, setValidated] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [insights, setInsights] = useState<AIInsight[]>([]);

  const dimensions = computeDimensions(frame);
  const overall = overallScore(dimensions);
  const { filled, total } = fieldCompletion(frame);
  const isComplete = filled === total;

  const handleChange = useCallback((key: keyof FrameData, val: string) => {
    setFrame(p => ({ ...p, [key]: val }));
    setSaved(false);
    setValidated(false);
  }, []);

  const handleSave = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  const handleAnalyze = useCallback(async () => {
    setAiLoading(true);
    setInsights([]);
    await new Promise(r => setTimeout(r, 1200));
    const generated: AIInsight[] = [];
    if (frame.decisionStatement.length < 30)
      generated.push({ type: 'warning', text: 'Decision statement is too brief. Start with "How should we…", "Whether to…", or "What strategy should…"' });
    else if (!/^(how|should|whether|we need|what strategy)/i.test(frame.decisionStatement.trim()))
      generated.push({ type: 'tip', text: 'Consider rephrasing as a question to make the decision explicit.' });
    else
      generated.push({ type: 'good', text: 'Decision statement is clearly framed and solution-neutral.' });
    if (!frame.trigger)
      generated.push({ type: 'warning', text: 'No decision trigger defined. What is forcing a decision now? Without this, the team may lack urgency.' });
    if (!frame.context)
      generated.push({ type: 'tip', text: 'Add the key questions this evaluation needs to answer. These guide which alternatives to consider.' });
    if (!frame.successCriteria)
      generated.push({ type: 'warning', text: 'No values or objectives defined. Without these, you cannot compare alternatives objectively.' });
    if (frame.constraints)
      generated.push({ type: 'good', text: 'Constraints and givens are documented — this sharpens your strategy space.' });
    if (frame.scopeIn && frame.scopeOut)
      generated.push({ type: 'good', text: 'Both in-scope and out-of-scope are defined. This prevents scope creep.' });
    setInsights(generated);
    setAiLoading(false);
  }, [frame]);

  const scoreColor_ = scoreColor(overall);

  return (
    <div className="flex h-full min-h-0 overflow-hidden" style={{ background: DS.bg, fontFamily: DS.fontDisplay }}>

      {/* ── Left: Main workspace ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Top bar */}
        <div
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderBottom: `1px solid ${DS.border}`, background: DS.surface }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: DS.accentLight }}
            >
              <Target size={15} style={{ color: DS.accent }} />
            </div>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: DS.ink }}>Problem Frame</h2>
              <p className="text-xs" style={{ color: DS.inkTer }}>Define the decision before exploring options</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress pills */}
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
                  style={{ color: '#059669' }}
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

        {/* Decision Statement — hero field */}
        <div className="px-6 pt-6 pb-4 shrink-0" style={{ background: DS.surface, borderBottom: `1px solid ${DS.border}` }}>
          <div className="flex items-start gap-2 mb-2">
            <div
              className="w-2 h-2 rounded-full mt-2 flex-shrink-0 transition-all duration-300"
              style={{ background: frame.decisionStatement.length > 30 ? '#059669' : frame.decisionStatement.length > 0 ? '#D97706' : DS.border }}
            />
            <label className="text-xs font-bold uppercase tracking-widest" style={{ color: DS.inkTer }}>
              Decision Statement <span style={{ color: DS.accent }}>*</span>
            </label>
          </div>
          <textarea
            rows={3}
            value={frame.decisionStatement}
            onChange={e => handleChange('decisionStatement', e.target.value)}
            placeholder="What is the overarching decision to be decided? (Solution-neutral, written as a question — e.g. 'How should we…' / 'Whether to…')"
            className="w-full rounded-xl px-4 py-3 text-base font-medium resize-none transition-all"
            style={{
              background: DS.surfaceAlt,
              border: `2px solid ${frame.decisionStatement.length > 30 ? '#059669' : DS.border}`,
              color: DS.ink,
              outline: 'none',
              lineHeight: '1.6',
              fontSize: 15,
            }}
            onFocus={e => (e.target.style.borderColor = DS.accent)}
            onBlur={e => (e.target.style.borderColor = frame.decisionStatement.length > 30 ? '#059669' : DS.border)}
          />
        </div>

        {/* Three section groups */}
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
              style={{ background: '#DCFCE7', border: '1px solid #86EFAC' }}
            >
              <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0 }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#065F46' }}>Frame validated</p>
                <p className="text-xs" style={{ color: '#059669' }}>Ready to generate issues and explore alternatives</p>
              </div>
              <ChevronRight size={16} style={{ color: '#059669', marginLeft: 'auto', flexShrink: 0 }} />
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Right: Intelligence panel ── */}
      <div
        className="w-72 shrink-0 hidden lg:flex flex-col gap-4 p-4 overflow-y-auto"
        style={{ borderLeft: `1px solid ${DS.border}`, background: DS.surface }}
      >
        {/* Score ring */}
        <div
          className="rounded-xl p-4 flex items-center gap-4"
          style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}` }}
        >
          <ScoreRing score={overall} />
          <div className="flex-1">
            <p className="text-xs font-semibold mb-1" style={{ color: DS.ink }}>Frame Quality</p>
            <p className="text-xs" style={{ color: DS.inkTer }}>
              {overall < 30 ? 'Just getting started' : overall < 60 ? 'Taking shape' : overall < 80 ? 'Nearly complete' : 'Well framed'}
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
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: DS.inkTer }}>Dimensions</p>
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
                <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#DC2626' }}>
                  <AlertTriangle size={10} /> {dim.issue}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* AI Panel */}
        <AIPanel insights={insights} loading={aiLoading} onAnalyze={handleAnalyze} />

        {/* Completion checklist */}
        <div className="rounded-xl p-4 space-y-2" style={{ border: `1px solid ${DS.border}` }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: DS.inkTer }}>Required Fields</p>
          {[
            { key: 'decisionStatement', label: 'Decision Statement' },
            { key: 'trigger', label: 'Decision Driver' },
            { key: 'context', label: 'Key Questions' },
            { key: 'constraints', label: 'Givens & Constraints' },
            { key: 'successCriteria', label: 'Values & Objectives' },
          ].map(f => {
            const done = (frame as any)[f.key]?.trim().length > 10;
            return (
              <div key={f.key} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: done ? '#DCFCE7' : DS.surfaceAlt, border: `1px solid ${done ? '#86EFAC' : DS.border}` }}
                >
                  {done && <CheckCircle2 size={10} style={{ color: '#059669' }} />}
                </div>
                <span className="text-xs" style={{ color: done ? DS.ink : DS.inkTer }}>{f.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

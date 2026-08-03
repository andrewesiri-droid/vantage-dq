import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import {
  Sparkles, Target, CheckCircle2, Plus, X, Check,
  Users, ChevronDown, AlertTriangle, Brain,
} from 'lucide-react';
import type { ValidatedProblemFrame } from '@/lib/dq/problemFrameSchema';

interface Props {
  acceptedItems?: any[];
  sessionData?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
  onValidated?: (output: any) => void;
}

type Alignment = 'champion' | 'supporter' | 'neutral' | 'skeptic' | 'blocker';
type Influence = 1 | 2 | 3 | 4 | 5;

interface Stakeholder {
  id: string;
  name: string;
  role: string;
  alignment: Alignment;
  influence: Influence;
  interest: Influence;
  concerns: string[];
  engagementStrategy: string;
  source: 'ai' | 'user';
  reviewStatus: 'draft' | 'accepted' | 'rejected';
}

const ALIGNMENT_META: Record<Alignment, { label: string; color: string; bg: string; icon: string }> = {
  champion:  { label: 'Champion',  color: '#059669', bg: '#DCFCE7', icon: '🚀' },
  supporter: { label: 'Supporter', color: '#1D4ED8', bg: '#EFF6FF', icon: '👍' },
  neutral:   { label: 'Neutral',   color: '#D97706', bg: '#FEF3C7', icon: '😐' },
  skeptic:   { label: 'Skeptic',   color: '#EA580C', bg: '#FFF7ED', icon: '🤔' },
  blocker:   { label: 'Blocker',   color: '#DC2626', bg: '#FEF2F2', icon: '🚫' },
};

function makeId() { return `sh_${Math.random().toString(36).slice(2, 9)}`; }

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
      system: 'You are a Decision Quality facilitator grounded in the methodology of established Decision Analysis methodology. PRINCIPLE 1 — PROCESS OVER OUTCOME: Judge decision quality at the time of the decision, not by outcome. PRINCIPLE 2 — CLARITY OF ACTION: Every output must move the human toward a clear, confident, defensible choice. PRINCIPLE 3 — WEAKEST LINK: A decision is only as strong as its weakest DQ element — always surface the weakest link. PRINCIPLE 4 — AI vs HUMAN OWNERSHIP: Surface, structure, and stress-test — but never own values, feasibility, or commitment. PRINCIPLE 5 — HANDOFF RULE: End every recommendation by naming what the human must own, what you cannot determine, and what would change your analysis. FORBIDDEN: Never invent data not in the session. Never give strong recommendations on weak frames. Never hide assumptions as facts. You are operating in the VALUES link. Stakeholder alignment is about surfacing whose values are at stake and who can block commitment. Name who is not in the room. Flag where alignment is compliance not commitment. The human must own what the organization actually values. Respond ONLY with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const raw = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

function StakeholderCard({ stakeholder, onAccept, onReject }: {
  stakeholder: Stakeholder; onAccept: () => void; onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = ALIGNMENT_META[stakeholder.alignment];
  const isAccepted = stakeholder.reviewStatus === 'accepted';
  const isRejected = stakeholder.reviewStatus === 'rejected';

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="rounded-xl overflow-hidden"
      style={{ border: `1.5px solid ${isAccepted ? '#86EFAC' : isRejected ? '#FCA5A5' : DS.border}`, background: DS.surface, opacity: isRejected ? 0.6 : 1 }}>
      <div className="flex items-start gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ background: meta.bg }}>
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-bold" style={{ color: DS.ink }}>{stakeholder.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
            {stakeholder.source === 'ai' && <span className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: DS.accentLight, color: DS.accent, fontSize: 10 }}><Sparkles size={8} /> AI</span>}
          </div>
          <p className="text-xs" style={{ color: DS.inkTer }}>{stakeholder.role}</p>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: DS.inkFaint }}>Influence:</span>
              <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="w-2 h-2 rounded-full" style={{ background: i < stakeholder.influence ? meta.color : DS.border }} />)}</div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: DS.inkFaint }}>Interest:</span>
              <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="w-2 h-2 rounded-full" style={{ background: i < stakeholder.interest ? DS.accent : DS.border }} />)}</div>
            </div>
          </div>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} style={{ color: DS.inkTer }} />
        </motion.div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
            <div className="px-4 pb-4 pt-3 space-y-3" style={{ borderTop: `1px solid ${DS.border}` }}>
              {stakeholder.concerns.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-1.5" style={{ color: DS.inkTer }}>Key Concerns</p>
                  {stakeholder.concerns.map((c, i) => <p key={i} className="text-xs mb-1 pl-2" style={{ color: DS.inkTer }}>· {c}</p>)}
                </div>
              )}
              {stakeholder.engagementStrategy && (
                <div className="p-3 rounded-lg" style={{ background: DS.accentLight }}>
                  <p className="text-xs font-bold mb-1" style={{ color: DS.accent }}>💡 Engagement Strategy</p>
                  <p className="text-xs" style={{ color: DS.ink }}>{stakeholder.engagementStrategy}</p>
                </div>
              )}
              {!isRejected && (
                <div className="flex gap-2">
                  {!isAccepted
                    ? <button onClick={onAccept} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: '#DCFCE7', color: '#059669' }}><Check size={11} /> Accept</button>
                    : <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: '#DCFCE7', color: '#059669' }}><CheckCircle2 size={11} /> Accepted</div>}
                  <button onClick={onReject} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#DC2626' }}><X size={11} /></button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Influence/Interest matrix ─────────────────────────────────

function StakeholderMatrix({ stakeholders }: { stakeholders: Stakeholder[] }) {
  const accepted = stakeholders.filter(s => s.reviewStatus === 'accepted');
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${DS.border}` }}>
      <div className="px-4 py-3" style={{ background: DS.surfaceAlt, borderBottom: `1px solid ${DS.border}` }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: DS.inkTer }}>Influence / Interest Matrix</p>
      </div>
      <div className="p-4 relative" style={{ background: DS.surface, height: 240 }}>
        {/* Quadrant labels */}
        <div className="absolute top-2 left-2 text-xs" style={{ color: DS.inkFaint }}>Low influence, high interest</div>
        <div className="absolute top-2 right-2 text-xs text-right" style={{ color: DS.inkFaint }}>High influence, high interest</div>
        <div className="absolute bottom-2 left-2 text-xs" style={{ color: DS.inkFaint }}>Low influence, low interest</div>
        <div className="absolute bottom-2 right-2 text-xs text-right" style={{ color: DS.inkFaint }}>High influence, low interest</div>
        {/* Grid lines */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-px h-full" style={{ background: DS.border }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-full h-px" style={{ background: DS.border }} />
        </div>
        {/* Stakeholder dots */}
        {accepted.map(s => {
          const meta = ALIGNMENT_META[s.alignment];
          const x = ((s.influence - 1) / 4) * 80 + 10;
          const y = (1 - (s.interest - 1) / 4) * 80 + 10;
          return (
            <div key={s.id} className="absolute flex flex-col items-center gap-0.5" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ background: meta.bg, border: `2px solid ${meta.color}` }} title={s.name}>
                {meta.icon}
              </div>
              <span className="text-xs font-semibold whitespace-nowrap" style={{ color: meta.color, fontSize: 9 }}>{s.name.split(' ')[0]}</span>
            </div>
          );
        })}
        {accepted.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs" style={{ color: DS.inkFaint }}>Accept stakeholders to see them here</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StakeholderAlignment({ acceptedItems, sessionData, persistedState, onPersistState, onValidated }: Props) {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>(() => persistedState?.stakeholders ?? []);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<Alignment | 'all'>('all');

  const frame = useMemo(() => getFrame(sessionData, acceptedItems ?? []), [sessionData, acceptedItems]);
  useEffect(() => { onPersistState?.({ stakeholders }); }, [stakeholders]);

  const accepted = stakeholders.filter(s => s.reviewStatus === 'accepted');
  const hasBlockers = accepted.some(s => s.alignment === 'blocker');

  const handleGenerate = useCallback(async () => {
    if (!frame) { setAiError('Problem Frame not found.'); return; }
    setAiLoading(true); setAiError(null);
    const strategies = sessionData?.strategies ?? [];

    const prompt = `You are a DQ facilitator. Identify key stakeholders for this decision.

DECISION: ${frame.decisionStatement}
TRIGGER: ${frame.trigger}
CONSTRAINTS: ${frame.constraints.join(', ') || 'None'}
STRATEGIES BEING CONSIDERED: ${strategies.map((s: any) => s.name).join(', ') || 'Not yet defined'}

Identify 6-8 key stakeholders. For each:
- name: their role/title (not personal names)
- role: their position relative to this decision
- alignment: champion|supporter|neutral|skeptic|blocker
- influence: 1-5 (ability to affect the decision)
- interest: 1-5 (how much they care about the outcome)
- concerns: 2-3 specific concerns they have
- engagementStrategy: how to engage them effectively

Return ONLY valid JSON:
{
  "stakeholders": [
    {
      "name": "Role/Title",
      "role": "Position relative to decision",
      "alignment": "neutral",
      "influence": 4,
      "interest": 3,
      "concerns": ["concern 1", "concern 2"],
      "engagementStrategy": "How to engage them"
    }
  ]
}`;

    try {
      const result = await callAI(prompt);
      setStakeholders((result.stakeholders ?? []).map((s: any) => ({
        id: makeId(), ...s, source: 'ai' as const, reviewStatus: 'draft' as const,
      })));
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  }, [frame, sessionData]);

  const update = useCallback((id: string, status: 'accepted' | 'rejected') => {
    setStakeholders(p => p.map(s => s.id === id ? { ...s, reviewStatus: status } : s));
  }, []);

  const displayed = activeFilter === 'all' ? stakeholders : stakeholders.filter(s => s.alignment === activeFilter);
  const counts = Object.keys(ALIGNMENT_META).reduce((acc, k) => {
    acc[k] = stakeholders.filter(s => s.alignment === k).length;
    return acc;
  }, {} as Record<string, number>);

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
          <Sparkles size={12} /> {aiLoading ? 'Analyzing…' : 'Identify Stakeholders'}
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          {(['all', ...Object.keys(ALIGNMENT_META)] as (Alignment | 'all')[]).map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className="px-2 py-1 rounded-full text-xs font-medium capitalize"
              style={{ background: activeFilter === f ? DS.accent : DS.surfaceAlt, color: activeFilter === f ? '#fff' : DS.inkTer }}>
              {f === 'all' ? `All (${stakeholders.length})` : `${ALIGNMENT_META[f as Alignment].icon} ${counts[f] ?? 0}`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {aiError && <div className="rounded-xl p-3" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5' }}><p className="text-xs font-semibold" style={{ color: '#DC2626' }}>Error: {aiError}</p></div>}

          {aiLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <motion.div className="w-8 h-8 rounded-full border-2" style={{ borderColor: DS.accent, borderTopColor: 'transparent' }}
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
              <p className="text-sm" style={{ color: DS.inkTer }}>Identifying stakeholders…</p>
            </div>
          )}

          {!aiLoading && stakeholders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="text-4xl">👥</div>
              <p className="text-sm font-semibold" style={{ color: DS.inkTer }}>No stakeholders mapped yet</p>
              <p className="text-xs text-center max-w-xs" style={{ color: DS.inkFaint }}>Click "Identify Stakeholders" to map who is affected by and can affect this decision.</p>
            </div>
          )}

          {hasBlockers && (
            <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
              <AlertTriangle size={14} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
              <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>Blockers identified — engagement strategy required before proceeding</p>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {displayed.map(s => (
              <StakeholderCard key={s.id} stakeholder={s}
                onAccept={() => update(s.id, 'accepted')}
                onReject={() => update(s.id, 'rejected')} />
            ))}
          </AnimatePresence>

          {stakeholders.length > 0 && (
            <div className="mt-4 rounded-xl p-4" style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
              {accepted.length >= 3 && !hasBlockers ? (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => onValidated?.({ stakeholders: accepted })}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                  style={{ background: DS.accent, color: '#fff', boxShadow: `0 4px 14px ${DS.accent}40` }}>
                  <CheckCircle2 size={16} /> Proceed to Executive Recommendation
                </motion.button>
              ) : (
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: DS.inkTer }}>
                    {hasBlockers ? 'Address blockers before proceeding' : `Accept at least 3 stakeholders (${accepted.length} so far)`}
                  </p>
                  <button onClick={() => onValidated?.({ stakeholders: accepted })}
                    className="mt-2 w-full py-2 rounded-lg text-xs" style={{ background: DS.surface, color: DS.inkTer, border: `1px solid ${DS.border}` }}>
                    Override & Proceed
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-64 shrink-0 hidden lg:flex flex-col gap-4 p-4 overflow-y-auto" style={{ borderLeft: `1px solid ${DS.border}`, background: DS.surface }}>
          <StakeholderMatrix stakeholders={stakeholders} />
          <div className="rounded-xl p-3 space-y-2" style={{ border: `1px solid ${DS.border}` }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: DS.inkTer }}>Alignment Summary</p>
            {Object.entries(ALIGNMENT_META).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="text-sm">{v.icon}</span>
                <span className="text-xs flex-1" style={{ color: DS.inkTer }}>{v.label}</span>
                <span className="text-xs font-bold" style={{ color: (counts[k] ?? 0) > 0 ? v.color : DS.inkFaint }}>{counts[k] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

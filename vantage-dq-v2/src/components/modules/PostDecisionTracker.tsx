import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DS } from '@/constants';
import { Sparkles, Target, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ValidatedProblemFrame } from '@/lib/dq/problemFrameSchema';

interface Props {
  acceptedItems?: any[];
  sessionData?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
  onValidated?: (output: any) => void;
}

type OutcomeRating = 'better_than_expected' | 'as_expected' | 'worse_than_expected' | 'too_early';
type AssumptionOutcome = 'proved_correct' | 'proved_wrong' | 'partially_correct' | 'not_yet_known';

interface TrackerEntry {
  id: string;
  type: 'assumption' | 'prediction' | 'risk' | 'criterion';
  description: string;
  predictedOutcome: string;
  actualOutcome: string;
  status: AssumptionOutcome;
  notes: string;
  reviewDate: string;
}

interface PostDecisionRecord {
  decisionMade: string;
  recommendedStrategy: string;
  decisionDate: string;
  reviewDate: string;
  overallOutcome: OutcomeRating;
  outcomeNarrative: string;
  trackerEntries: TrackerEntry[];
  lessonsLearned: string[];
  whatWeGotRight: string[];
  whatWeGotWrong: string[];
  recommendationsForFuture: string[];
}

function safeArray(v: any): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) return v.split('\n').filter(Boolean);
  return [];
}

function getFrame(sd: any, ai: any[]): ValidatedProblemFrame | null {
  const raw = sd?.problemFrame ?? ai?.find((i: any) => i.targetType === 'problem_frame')?.data ?? null;
  if (!raw) return null;
  return { decisionStatement: raw.decisionStatement ?? '', context: raw.context ?? '', background: raw.background ?? '', trigger: raw.trigger ?? '', scopeIn: safeArray(raw.scopeIn), scopeOut: safeArray(raw.scopeOut), constraints: safeArray(raw.constraints), assumptions: safeArray(raw.assumptions), successCriteria: safeArray(raw.successCriteria), failureConsequences: raw.failureConsequences ?? '' };
}

const OUTCOME_META: Record<OutcomeRating, { label: string; color: string; bg: string; icon: string }> = {
  better_than_expected: { label: 'Better than expected', color: '#059669', bg: '#DCFCE7', icon: '🚀' },
  as_expected:          { label: 'As expected',          color: '#1D4ED8', bg: '#EFF6FF', icon: '✅' },
  worse_than_expected:  { label: 'Worse than expected',  color: '#DC2626', bg: '#FEF2F2', icon: '⚠️' },
  too_early:            { label: 'Too early to tell',    color: '#D97706', bg: '#FEF3C7', icon: '⏳' },
};

const ASSUMPTION_META: Record<AssumptionOutcome, { label: string; color: string; icon: string }> = {
  proved_correct:    { label: 'Proved correct',   color: '#059669', icon: '✅' },
  proved_wrong:      { label: 'Proved wrong',     color: '#DC2626', icon: '❌' },
  partially_correct: { label: 'Partially correct',color: '#D97706', icon: '🔶' },
  not_yet_known:     { label: 'Not yet known',    color: '#64748B', icon: '❓' },
};

function makeId() { return `pdt_${Math.random().toString(36).slice(2, 9)}`; }

export default function PostDecisionTracker({ acceptedItems, sessionData, persistedState, onPersistState, onValidated }: Props) {
  const [record, setRecord] = useState<PostDecisionRecord | null>(() => persistedState?.record ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frame = useMemo(() => getFrame(sessionData, acceptedItems ?? []), [sessionData, acceptedItems]);
  const recommendation = sessionData?.recommendation ?? persistedState?.lineage;
  const strategies = useMemo(() => sessionData?.strategies ?? persistedState?.strategies ?? [], [sessionData, persistedState]);

  useEffect(() => { onPersistState?.({ record }); }, [record]);

  const initRecord = useCallback(() => {
    if (!frame) return;
    const assumptions = frame.assumptions ?? [];
    const criteria = safeArray(sessionData?.structuringOutput?.criteria?.map((c: any) => c.title));
    const risks = (sessionData?.risks ?? persistedState?.risks ?? [])
      .filter((r: any) => r.severity === 'critical' || r.severity === 'high')
      .map((r: any) => r.title);

    const entries: TrackerEntry[] = [
      ...assumptions.map((a: string) => ({
        id: makeId(), type: 'assumption' as const,
        description: a, predictedOutcome: 'True',
        actualOutcome: '', status: 'not_yet_known' as const, notes: '',
        reviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      })),
      ...(criteria ?? []).map((c: string) => ({
        id: makeId(), type: 'criterion' as const,
        description: c, predictedOutcome: 'Met',
        actualOutcome: '', status: 'not_yet_known' as const, notes: '',
        reviewDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      })),
      ...risks.map((r: string) => ({
        id: makeId(), type: 'risk' as const,
        description: r, predictedOutcome: 'Mitigated',
        actualOutcome: '', status: 'not_yet_known' as const, notes: '',
        reviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      })),
    ];

    setRecord({
      decisionMade: frame.decisionStatement,
      recommendedStrategy: recommendation?.recommendedStrategy ?? strategies[0]?.name ?? '',
      decisionDate: new Date().toISOString().split('T')[0],
      reviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      overallOutcome: 'too_early',
      outcomeNarrative: '',
      trackerEntries: entries,
      lessonsLearned: [],
      whatWeGotRight: [],
      whatWeGotWrong: [],
      recommendationsForFuture: [],
    });
  }, [frame, recommendation, strategies, sessionData, persistedState]);

  const updateEntry = useCallback((id: string, updates: Partial<TrackerEntry>) => {
    setRecord(r => r ? { ...r, trackerEntries: r.trackerEntries.map(e => e.id === id ? { ...e, ...updates } : e) } : r);
  }, []);

  const knowCount = record?.trackerEntries.filter(e => e.status !== 'not_yet_known').length ?? 0;
  const totalCount = record?.trackerEntries.length ?? 0;

  const outcomeColors = {
    better_than_expected: '#059669',
    as_expected: '#1D4ED8',
    worse_than_expected: '#DC2626',
    too_early: '#D97706',
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden" style={{ background: DS.bg }}>
      {frame?.decisionStatement && (
        <div className="shrink-0 px-6 py-3 flex items-start gap-3" style={{ background: DS.accentLight, borderBottom: `1px solid ${DS.accent}30` }}>
          <Target size={14} style={{ color: DS.accent, marginTop: 3, flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: DS.accent }}>Decision Being Tracked</p>
            <p className="text-sm font-semibold" style={{ color: DS.ink, lineHeight: '1.4' }}>{frame.decisionStatement}</p>
          </div>
        </div>
      )}

      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5" style={{ background: DS.surface, borderBottom: `1px solid ${DS.border}` }}>
        {!record ? (
          <button onClick={initRecord} disabled={!frame}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
            style={{ background: DS.accent, color: '#fff' }}>
            <CheckCircle2 size={12} /> Initialize Post-Decision Tracker
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold" style={{ color: DS.ink }}>Tracking {totalCount} items</span>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#DCFCE7', color: '#059669' }}>{knowCount} resolved</span>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#FEF3C7', color: '#D97706' }}>{totalCount - knowCount} pending</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {!record && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-5xl">📈</div>
            <p className="text-sm font-semibold" style={{ color: DS.inkTer }}>Post-Decision Tracker not initialized</p>
            <p className="text-xs text-center max-w-sm" style={{ color: DS.inkFaint }}>
              Track assumptions, criteria, and risks after the decision is made. Come back to update outcomes as they become known. This turns decisions into organizational learning.
            </p>
          </div>
        )}

        {record && (
          <>
            {/* Header card */}
            <div className="rounded-2xl p-5" style={{ background: DS.surface, border: `2px solid ${DS.accent}20` }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: DS.inkTer }}>Recommended Strategy</p>
                  <p className="text-lg font-bold" style={{ color: DS.ink }}>{record.recommendedStrategy}</p>
                  <p className="text-xs mt-1" style={{ color: DS.inkTer }}>Decision date: {record.decisionDate} · Review: {record.reviewDate}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: DS.inkTer }}>Overall Outcome</p>
                  <div className="flex gap-2 flex-wrap">
                    {(Object.keys(OUTCOME_META) as OutcomeRating[]).map(k => {
                      const m = OUTCOME_META[k];
                      return (
                        <button key={k} onClick={() => setRecord(r => r ? { ...r, overallOutcome: k } : r)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: record.overallOutcome === k ? m.bg : DS.surfaceAlt, color: record.overallOutcome === k ? m.color : DS.inkTer, border: `1.5px solid ${record.overallOutcome === k ? m.color : DS.border}` }}>
                          {m.icon} {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold mb-1.5" style={{ color: DS.inkTer }}>Outcome Narrative</p>
                <textarea rows={3} value={record.outcomeNarrative}
                  onChange={e => setRecord(r => r ? { ...r, outcomeNarrative: e.target.value } : r)}
                  placeholder="Describe what actually happened after the decision was made…"
                  className="w-full rounded-xl px-3 py-2 text-sm resize-none"
                  style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}`, color: DS.ink, outline: 'none', lineHeight: '1.6' }} />
              </div>
            </div>

            {/* Tracker entries */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: DS.inkTer }}>Assumptions, Criteria & Risks</p>
              <div className="space-y-2">
                {record.trackerEntries.map(entry => {
                  const am = ASSUMPTION_META[entry.status];
                  const typeColor = entry.type === 'assumption' ? '#9333EA' : entry.type === 'criterion' ? '#1D4ED8' : '#DC2626';
                  const typeBg = entry.type === 'assumption' ? '#FAF5FF' : entry.type === 'criterion' ? '#EFF6FF' : '#FEF2F2';
                  return (
                    <div key={entry.id} className="rounded-xl p-4" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
                      <div className="flex items-start gap-3">
                        <span className="text-lg flex-shrink-0">{am.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize" style={{ background: typeBg, color: typeColor }}>{entry.type}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: DS.surfaceAlt, color: am.color }}>{am.label}</span>
                          </div>
                          <p className="text-sm font-medium mb-2" style={{ color: DS.ink }}>{entry.description}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs font-semibold mb-1" style={{ color: DS.inkTer }}>Actual Outcome</p>
                              <input value={entry.actualOutcome}
                                onChange={e => updateEntry(entry.id, { actualOutcome: e.target.value })}
                                placeholder="What actually happened…"
                                className="w-full rounded-lg px-2 py-1.5 text-xs"
                                style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}`, color: DS.ink, outline: 'none' }} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold mb-1" style={{ color: DS.inkTer }}>Status</p>
                              <select value={entry.status} onChange={e => updateEntry(entry.id, { status: e.target.value as AssumptionOutcome })}
                                className="w-full rounded-lg px-2 py-1.5 text-xs"
                                style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}`, color: DS.ink, outline: 'none' }}>
                                {(Object.keys(ASSUMPTION_META) as AssumptionOutcome[]).map(k => (
                                  <option key={k} value={k}>{ASSUMPTION_META[k].label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lessons learned */}
            <div className="rounded-xl p-4" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: DS.inkTer }}>Lessons Learned</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: '✅ What we got right', key: 'whatWeGotRight', color: '#059669' },
                  { label: '❌ What we got wrong', key: 'whatWeGotWrong', color: '#DC2626' },
                  { label: '💡 For future decisions', key: 'recommendationsForFuture', color: DS.accent },
                ].map(section => (
                  <div key={section.key}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: section.color }}>{section.label}</p>
                    <textarea rows={4} value={(record as any)[section.key]?.join('\n') ?? ''}
                      onChange={e => setRecord(r => r ? { ...r, [section.key]: e.target.value.split('\n').filter(Boolean) } : r)}
                      placeholder="One item per line…"
                      className="w-full rounded-lg px-3 py-2 text-xs resize-none"
                      style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}`, color: DS.ink, outline: 'none', lineHeight: '1.5' }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={() => onValidated?.(record)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                style={{ background: DS.accent, color: '#fff' }}>
                <CheckCircle2 size={16} /> Save Post-Decision Record
              </motion.button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

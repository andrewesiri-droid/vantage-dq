/**
 * PostDecisionTracker — Track outcomes vs predictions
 * After a decision is committed, track what actually happened.
 */
import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Sparkles, CheckCircle, X, AlertTriangle, TrendingUp } from 'lucide-react';
import { ModuleDataBanner } from '@/components/ui/module-data-banner';
import { toastAIError, toastSaved } from '@/lib/toast';
import { useDQAI } from '@/hooks/useDQAI';
import { DQTrustBadge } from '@/components/ui/dq-trust-badge';

interface OutcomeEntry {
  id: number;
  type: 'assumption' | 'uncertainty' | 'risk' | 'milestone';
  label: string;
  predicted: string;
  actual: string;
  status: 'confirmed' | 'wrong' | 'partial' | 'pending';
  impact: 'positive' | 'negative' | 'neutral' | 'pending';
  learnedAt: string;
}

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmed', color: DS.success, soft: DS.successSoft },
  wrong: { label: 'Wrong', color: DS.danger, soft: DS.dangerSoft },
  partial: { label: 'Partial', color: DS.warning, soft: DS.warnSoft },
  pending: { label: 'Pending', color: DS.inkDis, soft: DS.bg },
};

export function PostDecisionTracker({ sessionId, data, hooks }: ModuleProps) {
  const [outcomes, setOutcomes] = useState<OutcomeEntry[]>([]);
  // Load persisted outcomes
  useEffect(() => {
    if (data?.outcomeTracking?.length && !outcomes.length) {
      setOutcomes(data.outcomeTracking.map((o: any) => ({
        id: o.id, type: o.type, label: o.label, predicted: o.predicted,
        actual: o.actual, status: o.status, impact: o.impact, learnedAt: o.learnedAt || o.learned_at || '',
      })));
      if (data.outcomeTracking.length > 0) setDecisionStatus('tracking');
    }
  }, [data?.outcomeTracking]);
  const [decisionStatus, setDecisionStatus] = useState<'draft'|'committed'|'tracking'|'complete'>('draft');
  const [commitDate, setCommitDate] = useState('');
  const [review, setReview] = useState<any>(null);
  const { call: dqCall, busy, lastResult } = useDQAI();

  const session = data?.session || {};
  const strategies = data?.strategies || [];
  const preferred = strategies.find((s: any) => s.isPreferred) || strategies[0];

  const initOutcomes = () => {
    const entries: OutcomeEntry[] = [];
    // Pull assumptions from preferred strategy
    if (preferred?.assumptions) {
      preferred.assumptions.split('\n').filter(Boolean).slice(0, 3).forEach((a: string, i: number) => {
        entries.push({ id: Date.now() + i, type: 'assumption', label: a.slice(0, 80), predicted: 'Will hold true', actual: '', status: 'pending', impact: 'pending', learnedAt: '' });
      });
    }
    // Pull uncertainties
    (data?.uncertainties || []).slice(0, 3).forEach((u: any, i: number) => {
      entries.push({ id: Date.now() + 100 + i, type: 'uncertainty', label: u.label, predicted: 'Unknown at decision time', actual: '', status: 'pending', impact: 'pending', learnedAt: '' });
    });
    // Pull risks
    (data?.riskItems || []).filter((r: any) => r.impact === 'Critical' || r.impact === 'High').slice(0, 2).forEach((r: any, i: number) => {
      entries.push({ id: Date.now() + 200 + i, type: 'risk', label: r.label, predicted: 'Mitigated by: ' + (r.mitigation || 'no mitigation'), actual: '', status: 'pending', impact: 'pending', learnedAt: '' });
    });
    setOutcomes(entries);
    setDecisionStatus('tracking');
    toastSaved();
  };

  const updateOutcome = (id: number, field: string, val: string) => {
    setOutcomes(p => p.map(o => o.id === id ? { ...o, [field]: val } : o));
    if (hooks?.updateOutcome) {
      const updated = outcomes.find(o => o.id === id);
      if (updated) hooks.updateOutcome({ id, ...updated, [field]: val, sessionId });
    }
  };

  const aiReview = async () => {
    const outcomesSummary = outcomes.map(o => `[${o.type}] ${o.label}: predicted=${o.predicted}, actual=${o.actual || 'pending'}, status=${o.status}`).join('\n');
    const prompt = `Post-decision learning review.
Decision: ${session.decisionStatement || ''}
Strategy chosen: ${preferred?.name || ''}
Commit date: ${commitDate}
Outcomes tracked:
${outcomesSummary}

Generate a post-decision learning review:
1. Which assumptions proved correct vs wrong?
2. Which uncertainties resolved favorably vs unfavorably?
3. What would we do differently?
4. What patterns should inform future decisions?
5. Decision quality retrospective — was the DQ process adequate?

Return JSON: {
  learningScore: 0-100,
  correctAssumptions: [string],
  wrongAssumptions: [string],
  keyLearnings: [string],
  wouldDoDifferently: [string],
  patternForFuture: string,
  dqRetrospective: string,
  meta: { confidenceLevel: string, dqWarnings: [], assumptionsMade: [], caveat: string }
}`;

    const result = await dqCall(prompt, { module: 'post-decision', dqElement: 'Reasoning', sessionData: data || {} });
    if (result?.data) setReview(result.data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>DECISION OS</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Post-Decision Tracker</h2>
          <p className="text-xs mt-0.5" style={{ color: DS.inkSub }}>Track outcomes vs predictions — close the learning loop</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {decisionStatus === 'draft' && (
            <div className="flex items-center gap-2">
              <input type="date" value={commitDate} onChange={e => setCommitDate(e.target.value)} className="text-xs h-8 px-2 rounded-lg border" style={{ borderColor: DS.borderLight }} />
              <Button size="sm" className="gap-1.5 text-xs h-8" style={{ background: DS.success }} onClick={initOutcomes} disabled={!commitDate || !preferred}>
                <CheckCircle size={11} /> Commit Decision
              </Button>
            </div>
          )}
          {decisionStatus === 'tracking' && (
            <Button size="sm" className="gap-1.5 text-xs h-8" style={{ background: DS.accent }} onClick={aiReview} disabled={busy}>
              <Sparkles size={11} /> {busy ? 'Reviewing…' : 'AI Learning Review'}
            </Button>
          )}
        </div>
      </div>

      {/* Status banner */}
      <div className="grid grid-cols-4 gap-2">
        {(['draft','committed','tracking','complete'] as const).map(s => (
          <div key={s} className="rounded-xl p-2 text-center cursor-pointer" onClick={() => setDecisionStatus(s)}
            style={{ background: decisionStatus === s ? DS.accent : DS.bg, border: `1px solid ${decisionStatus === s ? DS.accent : DS.borderLight}` }}>
            <div className="text-[9px] font-bold uppercase" style={{ color: decisionStatus === s ? '#fff' : DS.inkDis }}>{s}</div>
          </div>
        ))}
      </div>

      {decisionStatus === 'draft' && (
        <div className="text-center py-12 rounded-xl" style={{ background: DS.bg, border: `1px dashed ${DS.border}` }}>
          <TrendingUp size={28} className="mx-auto mb-3" style={{ color: DS.inkDis }} />
          <p className="text-sm font-semibold mb-1" style={{ color: DS.ink }}>Decision not yet committed</p>
          <p className="text-xs mb-4" style={{ color: DS.inkDis }}>Set a commit date and click Commit Decision to start tracking outcomes vs predictions</p>
          {!preferred && <p className="text-xs" style={{ color: DS.warning }}>⚠ No preferred strategy selected — mark one in Strategy Table first</p>}
        </div>
      )}

      {decisionStatus !== 'draft' && outcomes.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase mb-2" style={{ color: DS.inkDis }}>OUTCOME TRACKING</div>
          {outcomes.map(o => {
            const sc = STATUS_CONFIG[o.status];
            return (
              <div key={o.id} className="rounded-xl border p-3" style={{ borderColor: sc.color + '40', background: sc.soft }}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: DS.bg, color: DS.inkDis }}>{o.type}</span>
                  <span className="text-xs font-semibold flex-1" style={{ color: DS.ink }}>{o.label}</span>
                  <select value={o.status} onChange={e => updateOutcome(o.id, 'status', e.target.value)} className="text-[9px] px-2 py-1 rounded-lg border bg-white" style={{ borderColor: DS.borderLight, color: sc.color }}>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="wrong">Wrong</option>
                    <option value="partial">Partial</option>
                  </select>
                  <select value={o.impact} onChange={e => updateOutcome(o.id, 'impact', e.target.value)} className="text-[9px] px-2 py-1 rounded-lg border bg-white" style={{ borderColor: DS.borderLight }}>
                    <option value="pending">Impact?</option>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>PREDICTED</div>
                    <p className="text-[10px]" style={{ color: DS.inkSub }}>{o.predicted}</p>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>ACTUAL</div>
                    <textarea value={o.actual} onChange={e => updateOutcome(o.id, 'actual', e.target.value)} rows={2} placeholder="What actually happened?" className="w-full text-[10px] p-1.5 rounded-lg border resize-none bg-white" style={{ borderColor: DS.borderLight }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lastResult?.trust && <DQTrustBadge trust={lastResult.trust} meta={lastResult.meta} />}

      {review && (
        <div className="space-y-3">
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
            <div className="text-3xl font-black" style={{ color: DS.accent }}>{review.learningScore}</div>
            <div>
              <div className="text-xs font-bold" style={{ color: DS.ink }}>Learning Score</div>
              <p className="text-xs" style={{ color: DS.inkSub }}>{review.dqRetrospective}</p>
            </div>
          </div>
          {review.keyLearnings?.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: DS.successSoft, border: `1px solid ${DS.success}30` }}>
              <div className="text-[9px] font-bold uppercase mb-2" style={{ color: DS.success }}>Key Learnings</div>
              {review.keyLearnings.map((l: string, i: number) => <p key={i} className="text-xs mb-1" style={{ color: DS.ink }}>✓ {l}</p>)}
            </div>
          )}
          {review.wouldDoDifferently?.length > 0 && (
            <div className="rounded-xl p-3" style={{ background: DS.warnSoft, border: `1px solid ${DS.warning}30` }}>
              <div className="text-[9px] font-bold uppercase mb-2" style={{ color: DS.warning }}>Would Do Differently</div>
              {review.wouldDoDifferently.map((l: string, i: number) => <p key={i} className="text-xs mb-1" style={{ color: DS.ink }}>→ {l}</p>)}
            </div>
          )}
          {review.patternForFuture && (
            <div className="rounded-xl p-3" style={{ background: DS.information.soft, border: `1px solid ${DS.information.fill}30` }}>
              <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.information.fill }}>Pattern for Future Decisions</div>
              <p className="text-xs" style={{ color: DS.ink }}>{review.patternForFuture}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DS } from '@/constants';
import { Sparkles, Target, Plus, X, CheckCircle2 } from 'lucide-react';
import type { ValidatedProblemFrame } from '@/lib/dq/problemFrameSchema';

interface Props {
  acceptedItems?: any[];
  sessionData?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
  onValidated?: (output: any) => void;
}

interface TornadoVariable {
  id: string;
  name: string;
  baseValue: number;
  lowValue: number;
  highValue: number;
  unit: string;
  source: 'ai' | 'user';
}

function makeId() { return `tv_${Math.random().toString(36).slice(2, 9)}`; }

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
      max_tokens: 3000,
      temperature: 0,
      system: 'You are a Decision Quality analyst specializing in sensitivity analysis. Respond ONLY with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const raw = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

export default function TornadoChart({ acceptedItems, sessionData, persistedState, onPersistState, onValidated }: Props) {
  const [variables, setVariables] = useState<TornadoVariable[]>(() => persistedState?.variables ?? []);
  const [baseMetric, setBaseMetric] = useState(persistedState?.baseMetric ?? 'NPV ($M)');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const frame = useMemo(() => getFrame(sessionData, acceptedItems ?? []), [sessionData, acceptedItems]);
  useEffect(() => { onPersistState?.({ variables, baseMetric }); }, [variables, baseMetric]);

  // Sort by impact (range)
  const sorted = useMemo(() =>
    [...variables].sort((a, b) => Math.abs(b.highValue - b.lowValue) - Math.abs(a.highValue - a.lowValue)),
    [variables]
  );

  const maxRange = useMemo(() => Math.max(...sorted.map(v => Math.max(Math.abs(v.highValue), Math.abs(v.lowValue))), 1), [sorted]);

  const handleGenerate = useCallback(async () => {
    if (!frame) { setAiError('Problem Frame not found.'); return; }
    setAiLoading(true); setAiError(null);

    const uncertainties = sessionData?.structuringOutput?.criticalUncertainties?.map((u: any) => u.title).join('\n') ?? 'Not identified';

    const prompt = `You are a DQ analyst. Generate tornado chart variables for this decision.

DECISION: ${frame.decisionStatement}
CRITICAL UNCERTAINTIES:
${uncertainties}

Generate 6-8 key variables for a tornado/sensitivity chart.
For each variable provide realistic low/base/high values that show impact on decision value.

The base metric is: ${baseMetric}

Return ONLY valid JSON:
{
  "variables": [
    {
      "name": "Variable name",
      "baseValue": 100,
      "lowValue": 60,
      "highValue": 150,
      "unit": "$M or % or other unit"
    }
  ]
}`;

    try {
      const result = await callAI(prompt);
      setVariables((result.variables ?? []).map((v: any) => ({ id: makeId(), ...v, source: 'ai' as const })));
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  }, [frame, sessionData, baseMetric]);

  const barWidth = 500;
  const center = barWidth / 2;

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
          <Sparkles size={12} /> {aiLoading ? 'Generating…' : 'Generate Tornado Variables'}
        </button>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-xs font-semibold" style={{ color: DS.inkTer }}>Base metric:</span>
          <input value={baseMetric} onChange={e => setBaseMetric(e.target.value)}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}`, color: DS.ink, outline: 'none', width: 120 }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {aiError && <div className="rounded-xl p-3 mb-4" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5' }}><p className="text-xs font-semibold" style={{ color: '#DC2626' }}>Error: {aiError}</p></div>}

        {aiLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <motion.div className="w-8 h-8 rounded-full border-2" style={{ borderColor: DS.accent, borderTopColor: 'transparent' }}
              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
            <p className="text-sm" style={{ color: DS.inkTer }}>Generating sensitivity variables…</p>
          </div>
        )}

        {!aiLoading && variables.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-5xl">🌪️</div>
            <p className="text-sm font-semibold" style={{ color: DS.inkTer }}>No variables yet</p>
            <p className="text-xs text-center max-w-xs" style={{ color: DS.inkFaint }}>Generate tornado variables to see which uncertainties have the most impact on your decision outcome.</p>
          </div>
        )}

        {!aiLoading && sorted.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: DS.surface, border: `1px solid ${DS.border}` }}>
            <div className="px-6 py-4" style={{ borderBottom: `1px solid ${DS.border}` }}>
              <p className="text-sm font-bold" style={{ color: DS.ink }}>Tornado Chart — Impact on {baseMetric}</p>
              <p className="text-xs mt-1" style={{ color: DS.inkTer }}>Variables sorted by range of impact (widest = most sensitive)</p>
            </div>
            <div className="p-6 space-y-3">
              {/* Header */}
              <div className="flex items-center" style={{ paddingLeft: 180 }}>
                <div className="flex-1 flex justify-between text-xs" style={{ color: DS.inkFaint }}>
                  <span>Low</span>
                  <span>Base: {sorted[0]?.baseValue}{sorted[0]?.unit}</span>
                  <span>High</span>
                </div>
              </div>

              {sorted.map((v, i) => {
                const lowPct = (Math.abs(v.lowValue) / maxRange) * 45;
                const highPct = (Math.abs(v.highValue) / maxRange) * 45;
                const isFirst = i === 0;
                return (
                  <div key={v.id} className="flex items-center gap-4">
                    <div className="text-xs font-medium text-right flex-shrink-0" style={{ width: 170, color: DS.ink }}>
                      {v.name}
                      {isFirst && <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#D97706' }}>Most sensitive</span>}
                    </div>
                    <div className="flex-1 flex items-center" style={{ height: 32 }}>
                      {/* Low bar (left, red) */}
                      <div className="flex justify-end" style={{ width: '45%' }}>
                        <motion.div
                          className="h-7 rounded-l-lg flex items-center justify-end pr-2"
                          style={{ background: '#FCA5A5', width: `${lowPct}%` }}
                          initial={{ width: 0 }}
                          animate={{ width: `${lowPct}%` }}
                          transition={{ duration: 0.6, delay: i * 0.05 }}
                        >
                          <span className="text-xs font-semibold" style={{ color: '#7F1D1D' }}>{v.lowValue}{v.unit}</span>
                        </motion.div>
                      </div>
                      {/* Center line */}
                      <div className="w-0.5 h-7 mx-0.5 flex-shrink-0" style={{ background: DS.inkTer }} />
                      {/* High bar (right, green) */}
                      <div style={{ width: '45%' }}>
                        <motion.div
                          className="h-7 rounded-r-lg flex items-center pl-2"
                          style={{ background: '#86EFAC', width: `${highPct}%` }}
                          initial={{ width: 0 }}
                          animate={{ width: `${highPct}%` }}
                          transition={{ duration: 0.6, delay: i * 0.05 }}
                        >
                          <span className="text-xs font-semibold" style={{ color: '#065F46' }}>{v.highValue}{v.unit}</span>
                        </motion.div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-6 py-3" style={{ borderTop: `1px solid ${DS.border}`, background: DS.surfaceAlt }}>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded" style={{ background: '#FCA5A5' }} />
                <span className="text-xs" style={{ color: DS.inkTer }}>Pessimistic case</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded" style={{ background: '#86EFAC' }} />
                <span className="text-xs" style={{ color: DS.inkTer }}>Optimistic case</span>
              </div>
              <span className="text-xs ml-auto" style={{ color: DS.inkFaint }}>Width = sensitivity to this variable</span>
            </div>
          </div>
        )}

        {variables.length > 0 && (
          <div className="mt-4 rounded-xl p-4" style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onClick={() => onValidated?.({ variables })}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
              style={{ background: DS.accent, color: '#fff' }}>
              <CheckCircle2 size={16} /> Complete Sensitivity Analysis
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}

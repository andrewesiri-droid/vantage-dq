import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import { Sparkles, Target, CheckCircle2, Info } from 'lucide-react';
import type { ValidatedProblemFrame } from '@/lib/dq/problemFrameSchema';

interface Props {
  acceptedItems?: any[];
  sessionData?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
  onValidated?: (output: any) => void;
}

interface Player {
  name: string;
  role: string;
  objective: string;
}

interface PayoffCell {
  ourPayoff: number;   // -5 to +5
  theirPayoff: number; // -5 to +5
  label: string;
  analysis: string;
}

interface GameMatrix {
  ourStrategies: string[];
  theirStrategies: string[];
  cells: PayoffCell[][];
  dominantStrategy?: string;
  nashEquilibrium?: string;
  recommendation: string;
}

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
      system: 'You are a Decision Quality analyst specializing in game theory and strategic interaction analysis. Respond ONLY with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const raw = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

function payoffColor(val: number): string {
  if (val >= 3) return '#059669';
  if (val >= 1) return '#16A34A';
  if (val === 0) return '#D97706';
  if (val >= -2) return '#EA580C';
  return '#DC2626';
}

function payoffBg(val: number): string {
  if (val >= 3) return '#DCFCE7';
  if (val >= 1) return '#F0FDF4';
  if (val === 0) return '#FEF3C7';
  if (val >= -2) return '#FFF7ED';
  return '#FEF2F2';
}

export default function GameTheory({ acceptedItems, sessionData, persistedState, onPersistState, onValidated }: Props) {
  const [players, setPlayers] = useState<{ us: Player; them: Player }>(() => persistedState?.players ?? {
    us: { name: 'Our Team', role: 'Decision maker', objective: 'Maximize value' },
    them: { name: 'Counterparty', role: 'Other player', objective: 'Unknown' },
  });
  const [matrix, setMatrix] = useState<GameMatrix | null>(() => persistedState?.matrix ?? null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);

  const frame = useMemo(() => getFrame(sessionData, acceptedItems ?? []), [sessionData, acceptedItems]);
  useEffect(() => { onPersistState?.({ players, matrix }); }, [players, matrix]);

  const handleGenerate = useCallback(async () => {
    if (!frame) { setAiError('Problem Frame not found.'); return; }
    setAiLoading(true); setAiError(null);

    const strategies = sessionData?.strategies ?? [];
    const stakeholders = persistedState?.stakeholders ?? [];

    // Find most relevant counterparty from stakeholders
    const blockers = stakeholders.filter((s: any) => s.alignment === 'blocker' || s.alignment === 'skeptic');
    const counterparty = blockers[0]?.name ?? 'Government/Regulator';

    const prompt = `You are a game theory analyst. Build a payoff matrix for this strategic interaction.

DECISION: ${frame.decisionStatement}
OUR STRATEGIES: ${strategies.map((s: any) => s.name).join(', ') || 'Not yet defined'}
KEY COUNTERPARTY: ${counterparty}
CONSTRAINTS: ${frame.constraints.join(', ') || 'None'}

Build a game theory payoff matrix showing:
- Our 3-4 key strategic moves
- Their 2-3 likely responses
- Payoffs for each combination (-5 worst to +5 best)
- Nash equilibrium if one exists
- Dominant strategy recommendation

Payoff scale: -5 = very bad, -3 = bad, 0 = neutral, 3 = good, 5 = excellent

Return ONLY valid JSON:
{
  "counterpartyName": "${counterparty}",
  "counterpartyObjective": "what they are trying to achieve",
  "ourStrategies": ["strategy 1", "strategy 2", "strategy 3"],
  "theirStrategies": ["response 1", "response 2"],
  "cells": [
    [
      { "ourPayoff": 3, "theirPayoff": -1, "label": "outcome label", "analysis": "why this outcome" },
      { "ourPayoff": 1, "theirPayoff": 2, "label": "outcome label", "analysis": "why this outcome" }
    ]
  ],
  "dominantStrategy": "our best strategy regardless of their move",
  "nashEquilibrium": "the stable outcome if both play optimally",
  "recommendation": "2-3 sentence strategic recommendation based on the game analysis"
}`;

    try {
      const result = await callAI(prompt);
      setMatrix(result as GameMatrix);
      setPlayers(p => ({ ...p, them: { ...p.them, name: result.counterpartyName, objective: result.counterpartyObjective } }));
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  }, [frame, sessionData, persistedState]);

  const selected = selectedCell && matrix ? matrix.cells[selectedCell.row]?.[selectedCell.col] : null;

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
          <Sparkles size={12} /> {aiLoading ? 'Analyzing…' : 'Build Payoff Matrix'}
        </button>
        {matrix?.dominantStrategy && (
          <div className="flex items-center gap-2 ml-2 px-3 py-1.5 rounded-lg" style={{ background: '#DCFCE7' }}>
            <span className="text-xs font-bold" style={{ color: '#059669' }}>Dominant: {matrix.dominantStrategy}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {aiError && <div className="rounded-xl p-3" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5' }}><p className="text-xs font-semibold" style={{ color: '#DC2626' }}>Error: {aiError}</p></div>}

          {aiLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <motion.div className="w-8 h-8 rounded-full border-2" style={{ borderColor: DS.accent, borderTopColor: 'transparent' }}
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
              <p className="text-sm" style={{ color: DS.inkTer }}>Building game theory matrix…</p>
            </div>
          )}

          {!aiLoading && !matrix && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="text-5xl">♟️</div>
              <p className="text-sm font-semibold" style={{ color: DS.inkTer }}>No payoff matrix yet</p>
              <p className="text-xs text-center max-w-xs" style={{ color: DS.inkFaint }}>
                Build a game theory payoff matrix to analyze strategic interactions with counterparties like government, partners, or competitors.
              </p>
            </div>
          )}

          {!aiLoading && matrix && (
            <>
              {/* Players */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl p-4" style={{ background: DS.accentLight, border: `1px solid ${DS.accent}30` }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: DS.accent }}>🏢 Us</p>
                  <p className="text-sm font-bold" style={{ color: DS.ink }}>{players.us.name}</p>
                  <p className="text-xs" style={{ color: DS.inkTer }}>{players.us.objective}</p>
                </div>
                <div className="rounded-xl p-4" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#DC2626' }}>🎭 Counterparty</p>
                  <p className="text-sm font-bold" style={{ color: DS.ink }}>{players.them.name}</p>
                  <p className="text-xs" style={{ color: DS.inkTer }}>{players.them.objective}</p>
                </div>
              </div>

              {/* Payoff matrix */}
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${DS.border}` }}>
                <div className="px-4 py-3" style={{ background: DS.surfaceAlt, borderBottom: `1px solid ${DS.border}` }}>
                  <p className="text-xs font-bold" style={{ color: DS.ink }}>Payoff Matrix — (Our payoff, Their payoff)</p>
                  <p className="text-xs mt-0.5" style={{ color: DS.inkTer }}>Click any cell for details. Scale: -5 (worst) to +5 (best)</p>
                </div>
                <div className="overflow-x-auto p-4">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="p-2 text-xs text-left" style={{ color: DS.inkTer, width: 160 }}>Our Strategy ↓ / Their Move →</th>
                        {matrix.theirStrategies.map((s, i) => (
                          <th key={i} className="p-2 text-xs text-center font-semibold" style={{ color: '#DC2626', minWidth: 120 }}>{s}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.ourStrategies.map((ourStr, ri) => (
                        <tr key={ri}>
                          <td className="p-2 text-xs font-semibold" style={{ color: DS.accent }}>{ourStr}</td>
                          {matrix.theirStrategies.map((_, ci) => {
                            const cell = matrix.cells[ri]?.[ci];
                            if (!cell) return <td key={ci} />;
                            const isSelected = selectedCell?.row === ri && selectedCell?.col === ci;
                            const isNash = matrix.nashEquilibrium?.includes(ourStr) && matrix.nashEquilibrium?.includes(matrix.theirStrategies[ci]);
                            return (
                              <td key={ci} className="p-2">
                                <button
                                  onClick={() => setSelectedCell(isSelected ? null : { row: ri, col: ci })}
                                  className="w-full rounded-xl p-3 text-center transition-all"
                                  style={{
                                    background: isSelected ? DS.accent + '20' : payoffBg(cell.ourPayoff),
                                    border: `2px solid ${isSelected ? DS.accent : isNash ? '#059669' : 'transparent'}`,
                                  }}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <span className="text-sm font-bold" style={{ color: payoffColor(cell.ourPayoff) }}>{cell.ourPayoff > 0 ? '+' : ''}{cell.ourPayoff}</span>
                                    <span className="text-xs" style={{ color: DS.inkFaint }}>,</span>
                                    <span className="text-sm font-bold" style={{ color: payoffColor(cell.theirPayoff) }}>{cell.theirPayoff > 0 ? '+' : ''}{cell.theirPayoff}</span>
                                  </div>
                                  <p className="text-xs mt-0.5 font-medium" style={{ color: DS.inkTer }}>{cell.label}</p>
                                  {isNash && <span className="text-xs" style={{ color: '#059669' }}>Nash ⚖️</span>}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Selected cell detail */}
              <AnimatePresence>
                {selected && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="rounded-xl p-4" style={{ background: DS.surface, border: `2px solid ${DS.accent}` }}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: DS.accent }}>Cell Analysis</p>
                    <p className="text-sm font-semibold mb-2" style={{ color: DS.ink }}>{selected.label}</p>
                    <p className="text-sm" style={{ color: DS.inkTer, lineHeight: '1.6' }}>{selected.analysis}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Recommendation */}
              {matrix.recommendation && (
                <div className="rounded-xl p-4" style={{ background: '#DCFCE7', border: '1px solid #86EFAC' }}>
                  <p className="text-xs font-bold mb-2" style={{ color: '#059669' }}>🏆 Strategic Recommendation</p>
                  <p className="text-sm" style={{ color: DS.ink, lineHeight: '1.6' }}>{matrix.recommendation}</p>
                </div>
              )}

              <div className="rounded-xl p-4" style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => onValidated?.({ matrix, players })}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                  style={{ background: DS.accent, color: '#fff' }}>
                  <CheckCircle2 size={16} /> Complete Game Theory Analysis
                </motion.button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

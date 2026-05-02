import { useState, useMemo, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Swords, Target } from 'lucide-react';

interface PayoffMatrix { [key: string]: [number, number] }

const DEFAULT_PAYOFFS: PayoffMatrix = {
  '0_0': [2, 1], '0_1': [4, 3], '0_2': [5, 2],
  '1_0': [3, 2], '1_1': [3, 3], '1_2': [4, 3],
  '2_0': [0, 5], '2_1': [0, 4], '2_2': [1, 3],
};

export function GameTheoryModule({ sessionId, data, hooks }: ModuleProps) {
  const [players, setPlayers] = useState(['Our Company', 'Competitor']);
  const [p1Strats, setP1Strats] = useState(['Enter Direct', 'Partner Entry', 'Stay Out']);
  const [p2Strats, setP2Strats] = useState(['Aggressive Defense', 'Accommodate', 'Ignore']);
  const [payoffs, setPayoffs] = useState<PayoffMatrix>(DEFAULT_PAYOFFS);

  useEffect(() => {
    if (data?.gameTheoryModels && data.gameTheoryModels.length > 0) {
      const m = data.gameTheoryModels[0];
      if (m.players) setPlayers(m.players);
      if (m.strategies) {
        const s = m.strategies as Record<string, string[]>;
        if (s.p1) setP1Strats(s.p1);
        if (s.p2) setP2Strats(s.p2);
      }
      if (m.payoffs) {
        const p = m.payoffs as Record<string, number[]>;
        const mapped: PayoffMatrix = {};
        Object.entries(p).forEach(([k, v]) => { if (v.length >= 2) mapped[k] = [v[0], v[1]]; });
        if (Object.keys(mapped).length > 0) setPayoffs(mapped);
      }
    }
  }, [data?.gameTheoryModels]);

  const equilibria = useMemo(() => {
    const eqs: string[] = [];
    for (let i = 0; i < p1Strats.length; i++) {
      for (let j = 0; j < p2Strats.length; j++) {
        const [p1Payoff, p2Payoff] = payoffs[`${i}_${j}`] || [0, 0];
        let p1Best = true, p2Best = true;
        for (let k = 0; k < p1Strats.length; k++) if (k !== i) { const alt = payoffs[`${k}_${j}`]; if (alt && alt[0] > p1Payoff) p1Best = false; }
        for (let k = 0; k < p2Strats.length; k++) if (k !== j) { const alt = payoffs[`${i}_${k}`]; if (alt && alt[1] > p2Payoff) p2Best = false; }
        if (p1Best && p2Best) eqs.push(`${p1Strats[i]} vs ${p2Strats[j]}`);
      }
    }
    return eqs;
  }, [payoffs, p1Strats, p2Strats]);

  const dominance = useMemo(() => {
    const p1Dom: string[] = [];
    for (let i = 0; i < p1Strats.length; i++) {
      for (let k = 0; k < p1Strats.length; k++) if (i !== k) {
        let dominates = true;
        for (let j = 0; j < p2Strats.length; j++) {
          const a = payoffs[`${i}_${j}`]?.[0] || 0; const b = payoffs[`${k}_${j}`]?.[0] || 0;
          if (a <= b) { dominates = false; break; }
        }
        if (dominates) p1Dom.push(`${p1Strats[k]} is dominated by ${p1Strats[i]}`);
      }
    }
    return p1Dom;
  }, [payoffs, p1Strats, p2Strats]);

  const updatePayoff = (i: number, j: number, player: 0 | 1, val: number) => {
    setPayoffs(p => { const key = `${i}_${j}`; const current = p[key] || [0, 0]; current[player] = val; return { ...p, [key]: [current[0], current[1]] }; });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
          <Swords size={20} style={{ color: DS.accent }} /> Game Theory
        </h2>
        <p className="text-xs mt-1" style={{ color: DS.inkSub }}>Model competitive interactions and identify equilibria</p>
      </div>

      <Card><CardContent className="pt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: DS.canvasAlt }}>
              <th className="p-2 text-left font-semibold" style={{ color: DS.inkSub }}>{players[0]} \ {players[1]}</th>
              {p2Strats.map((s, j) => <th key={j} className="p-2 text-center font-medium min-w-[100px]" style={{ color: DS.inkSub }}>{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {p1Strats.map((s1, i) => (
              <tr key={i} className="border-t" style={{ borderColor: DS.canvasBdr }}>
                <td className="p-2 font-medium" style={{ color: DS.ink }}>{s1}</td>
                {p2Strats.map((s2, j) => {
                  const [p1, p2] = payoffs[`${i}_${j}`] || [0, 0];
                  const isEq = equilibria.some(e => e.includes(s1) && e.includes(s2));
                  return (
                    <td key={j} className="p-2 text-center" style={{ background: isEq ? DS.accentSoft : 'transparent' }}>
                      <div className="flex items-center justify-center gap-1">
                        <input type="number" value={p1} onChange={e => updatePayoff(i, j, 0, parseInt(e.target.value) || 0)} className="w-10 text-center text-[10px] border rounded p-0.5" />
                        <span style={{ color: DS.inkDis }}>,</span>
                        <input type="number" value={p2} onChange={e => updatePayoff(i, j, 1, parseInt(e.target.value) || 0)} className="w-10 text-center text-[10px] border rounded p-0.5" />
                      </div>
                      {isEq && <Badge style={{ background: DS.accentSoft, color: DS.accentDim }} variant="outline" className="text-[8px] h-4 mt-1">Nash Eq</Badge>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>

      {equilibria.length > 0 && (
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2"><Target size={14} style={{ color: DS.success }} /><span className="text-xs font-bold" style={{ color: DS.ink }}>Nash Equilibria</span></div>
          <div className="space-y-1">
            {equilibria.map((eq, i) => <div key={i} className="flex items-center gap-2 p-2 rounded" style={{ background: DS.successSoft }}>
              <Badge style={{ background: DS.successSoft, color: DS.success }} variant="outline" className="text-[9px] h-4">#{i + 1}</Badge>
              <span className="text-xs" style={{ color: DS.ink }}>{eq}</span>
            </div>)}
          </div>
        </CardContent></Card>
      )}

      {dominance.length > 0 && (
        <Card><CardContent className="pt-4">
          <span className="text-xs font-bold" style={{ color: DS.ink }}>Dominant Strategies</span>
          <div className="mt-1 space-y-1">{dominance.map((d, i) => <p key={i} className="text-xs" style={{ color: DS.inkSub }}>• {d}</p>)}</div>
        </CardContent></Card>
      )}
    </div>
  );
}

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import {
  Sparkles, Target, CheckCircle2, ChevronDown,
  AlertTriangle, Plus, Brain,
} from 'lucide-react';
import type { ValidatedProblemFrame } from '@/lib/dq/problemFrameSchema';

interface Props {
  acceptedItems?: any[];
  sessionData?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
  onValidated?: (output: any) => void;
}

type ScenarioType = 'optimistic' | 'base' | 'pessimistic' | 'shock' | 'custom';
type Performance = 'excellent' | 'good' | 'adequate' | 'poor' | 'fails';

interface Scenario {
  id: string;
  name: string;
  type: ScenarioType;
  probability: number;
  description: string;
  keyAssumptions: string[];
  uncertaintyDrivers: string[];
  source: 'ai' | 'user';
}

interface ScenarioResult {
  scenarioId: string;
  strategyId: string;
  strategyName: string;
  performance: Performance;
  value: number;
  rationale: string;
}

interface RobustnessAnalysis {
  strategyId: string;
  strategyName: string;
  robustnessScore: number;
  performsWellIn: string[];
  failsIn: string[];
  recommendation: string;
  color: string;
}

const SCENARIO_META: Record<ScenarioType, { label: string; color: string; bg: string; icon: string }> = {
  optimistic:  { label: 'Optimistic',  color: '#059669', bg: '#DCFCE7', icon: '🌅' },
  base:        { label: 'Base Case',   color: '#1D4ED8', bg: '#EFF6FF', icon: '📊' },
  pessimistic: { label: 'Pessimistic', color: '#D97706', bg: '#FEF3C7', icon: '🌧️' },
  shock:       { label: 'Black Swan',  color: '#DC2626', bg: '#FEF2F2', icon: '⚡' },
  custom:      { label: 'Custom',      color: '#7C3AED', bg: '#F5F3FF', icon: '🔭' },
};

const PERF_META: Record<Performance, { color: string; bg: string; icon: string }> = {
  excellent: { color: '#059669', bg: '#DCFCE7', icon: '🟢' },
  good:      { color: '#1D4ED8', bg: '#EFF6FF', icon: '🔵' },
  adequate:  { color: '#D97706', bg: '#FEF3C7', icon: '🟡' },
  poor:      { color: '#EA580C', bg: '#FFF7ED', icon: '🟠' },
  fails:     { color: '#DC2626', bg: '#FEF2F2', icon: '🔴' },
};

const STRATEGY_COLORS = ['#4F6AF5','#059669','#D97706','#DC2626','#7C3AED','#0891B2'];

function safeArray(v: any): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) return v.split('\n').filter(Boolean);
  return [];
}

function getFrame(sd: any, ai: any[]): ValidatedProblemFrame | null {
  const raw = sd?.problemFrame ?? ai?.find((i: any) => i.targetType === 'problem_frame')?.data ?? null;
  if (!raw) return null;
  return { decisionStatement: raw.decisionStatement??'', context: raw.context??'', background: raw.background??'', trigger: raw.trigger??'', scopeIn: safeArray(raw.scopeIn), scopeOut: safeArray(raw.scopeOut), constraints: safeArray(raw.constraints), assumptions: safeArray(raw.assumptions), successCriteria: safeArray(raw.successCriteria), failureConsequences: raw.failureConsequences??'' };
}

async function callAI(prompt: string): Promise<any> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
    body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:5000, temperature:0.1, system:'You are a DQ scenario planning analyst. Respond ONLY with valid JSON.', messages:[{role:'user',content:prompt}] }),
  });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  const d = await r.json();
  const raw = d.content?.find((b:any)=>b.type==='text')?.text??'';
  return JSON.parse(raw.replace(/```json|```/g,'').trim());
}

function makeId() { return `sc_${Math.random().toString(36).slice(2,9)}`; }

export default function ScenarioPlanning({ acceptedItems, sessionData, persistedState, onPersistState, onValidated }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>(()=>persistedState?.scenarios??[]);
  const [results, setResults] = useState<ScenarioResult[]>(()=>persistedState?.results??[]);
  const [robustness, setRobustness] = useState<RobustnessAnalysis[]>(()=>persistedState?.robustness??[]);
  const [view, setView] = useState<'scenarios'|'matrix'|'robustness'>('scenarios');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [expanded, setExpanded] = useState<string|null>(null);

  const frame = useMemo(()=>getFrame(sessionData, acceptedItems??[]),[sessionData,acceptedItems]);
  const strategies = useMemo(()=>sessionData?.strategies??persistedState?.strategies??[],[sessionData,persistedState]);

  useEffect(()=>{ onPersistState?.({scenarios,results,robustness}); },[scenarios,results,robustness]);

  const handleGenerate = useCallback(async()=>{
    if (!frame) { setError('Problem Frame not found.'); return; }
    setLoading(true); setError(null);
    const unc = sessionData?.structuringOutput?.criticalUncertainties?.map((u:any)=>u.title).join('\n')||'Not identified';
    const prompt = `Build 4 distinct scenarios for this decision.

DECISION: ${frame.decisionStatement}
TRIGGER: ${frame.trigger}
CRITICAL UNCERTAINTIES:\n${unc}
CONSTRAINTS: ${frame.constraints.join(', ')||'None'}

Build 4 scenarios covering the range of plausible futures:
1. Optimistic — favorable conditions
2. Base Case — most likely conditions
3. Pessimistic — unfavorable but plausible
4. Black Swan — low probability, high impact shock

Rules:
- Scenarios are NOT forecasts — they are plausible futures
- Each must be internally consistent
- Probabilities must sum to ~100%
- Scenarios must differ meaningfully on the key uncertainties

Return ONLY valid JSON:
{
  "scenarios": [
    {
      "name": "Scenario name",
      "type": "optimistic|base|pessimistic|shock",
      "probability": 25,
      "description": "2-3 sentence narrative of this future",
      "keyAssumptions": ["assumption 1", "assumption 2"],
      "uncertaintyDrivers": ["what drives this scenario"]
    }
  ]
}`;
    try {
      const r = await callAI(prompt);
      setScenarios((r.scenarios??[]).map((s:any)=>({id:makeId(),...s,source:'ai'as const})));
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  },[frame,sessionData]);

  const handleStressTest = useCallback(async()=>{
    if (!scenarios.length||!strategies.length) { setError('Need scenarios and strategies first.'); return; }
    setLoading(true); setError(null);
    const scenSummary = scenarios.map(s=>`ID:${s.id} Name:${s.name} Type:${s.type} Prob:${s.probability}%\n${s.description}`).join('\n\n');
    const stratSummary = strategies.map((s:any,i:number)=>`ID:${s.id??i} Name:${s.name}\nObjective:${s.objective}\nRisk:${s.riskPosture}\nOptimizes:${s.tradeOffProfile?.optimizes}`).join('\n\n');
    const prompt = `Stress test strategies against scenarios.

DECISION: ${frame?.decisionStatement}

SCENARIOS:\n${scenSummary}

STRATEGIES:\n${stratSummary}

For each scenario-strategy combination, assess performance.
Performance scale: excellent, good, adequate, poor, fails
Value scale: -5 (disastrous) to +5 (excellent)

Then assess overall robustness for each strategy.

Return ONLY valid JSON:
{
  "results": [
    { "scenarioId": "", "strategyId": "", "strategyName": "", "performance": "good", "value": 3, "rationale": "why" }
  ],
  "robustness": [
    { "strategyId": "", "strategyName": "", "robustnessScore": 75, "performsWellIn": ["scenario name"], "failsIn": ["scenario name"], "recommendation": "2-3 sentences" }
  ]
}`;
    try {
      const r = await callAI(prompt);
      setResults(r.results??[]);
      setRobustness((r.robustness??[]).map((rb:any,i:number)=>({...rb,color:STRATEGY_COLORS[i%STRATEGY_COLORS.length]})));
      setView('matrix');
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  },[scenarios,strategies,frame]);

  const isReady = results.length > 0 && robustness.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden" style={{background:DS.bg}}>
      {frame?.decisionStatement && (
        <div className="shrink-0 px-6 py-3 flex items-start gap-3" style={{background:DS.accentLight,borderBottom:`1px solid ${DS.accent}30`}}>
          <Target size={14} style={{color:DS.accent,marginTop:3,flexShrink:0}}/>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{color:DS.accent}}>Decision</p>
            <p className="text-sm font-semibold" style={{color:DS.ink,lineHeight:'1.4'}}>{frame.decisionStatement}</p>
          </div>
        </div>
      )}

      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 flex-wrap" style={{background:DS.surface,borderBottom:`1px solid ${DS.border}`}}>
        <button onClick={handleGenerate} disabled={loading||!frame} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold" style={{background:loading?DS.surfaceAlt:DS.accent,color:loading?DS.inkTer:'#fff'}}>
          <Sparkles size={12}/> {loading?'Working…':'Generate Scenarios'}
        </button>
        <button onClick={handleStressTest} disabled={loading||!scenarios.length||!strategies.length} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{background:DS.surfaceAlt,color:DS.ink,border:`1px solid ${DS.border}`}}>
          <Brain size={12}/> Stress Test Strategies
        </button>
        <div className="flex-1"/>
        <div className="flex rounded-lg overflow-hidden" style={{border:`1px solid ${DS.border}`}}>
          {(['scenarios','matrix','robustness'] as const).map(v=>(
            <button key={v} onClick={()=>setView(v)} className="px-3 py-1.5 text-xs font-medium capitalize" style={{background:view===v?DS.accent:DS.surface,color:view===v?'#fff':DS.inkTer}}>
              {v==='matrix'?'Stress Matrix':v==='robustness'?'Robustness':v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && <div className="rounded-xl p-3" style={{background:'#FEE2E2',border:'1px solid #FCA5A5'}}><p className="text-xs font-semibold" style={{color:'#DC2626'}}>Error: {error}</p></div>}

          {loading && <div className="flex flex-col items-center justify-center py-20 gap-3">
            <motion.div className="w-8 h-8 rounded-full border-2" style={{borderColor:DS.accent,borderTopColor:'transparent'}} animate={{rotate:360}} transition={{repeat:Infinity,duration:0.8,ease:'linear'}}/>
            <p className="text-sm" style={{color:DS.inkTer}}>Analyzing scenarios…</p>
          </div>}

          {!loading && view==='scenarios' && (
            <>
              {scenarios.length===0 && <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="text-5xl">🔭</div>
                <p className="text-sm font-semibold" style={{color:DS.inkTer}}>No scenarios yet</p>
                <p className="text-xs text-center max-w-xs" style={{color:DS.inkFaint}}>Generate 4 scenarios covering optimistic, base, pessimistic, and shock futures. Then stress test your strategies against each.</p>
              </div>}
              {scenarios.map(sc=>{
                const meta=SCENARIO_META[sc.type];
                const isExp=expanded===sc.id;
                return (
                  <div key={sc.id} className="rounded-xl overflow-hidden" style={{border:`1.5px solid ${meta.color}30`,background:DS.surface}}>
                    <div className="flex items-start gap-3 px-4 py-3 cursor-pointer" onClick={()=>setExpanded(isExp?null:sc.id)}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background:meta.bg}}>{meta.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold" style={{color:DS.ink}}>{sc.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{background:meta.bg,color:meta.color}}>{meta.label}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{background:DS.surfaceAlt,color:DS.inkTer}}>{sc.probability}%</span>
                          {sc.source==='ai'&&<span className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{background:DS.accentLight,color:DS.accent,fontSize:10}}><Sparkles size={8}/>AI</span>}
                        </div>
                        <p className="text-xs" style={{color:DS.inkTer,lineHeight:'1.5'}}>{sc.description}</p>
                      </div>
                      <motion.div animate={{rotate:isExp?180:0}} transition={{duration:0.2}}><ChevronDown size={16} style={{color:DS.inkTer}}/></motion.div>
                    </div>
                    <AnimatePresence>
                      {isExp&&<motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}} style={{overflow:'hidden'}}>
                        <div className="px-4 pb-4 pt-3 grid grid-cols-2 gap-4" style={{borderTop:`1px solid ${DS.border}`}}>
                          {sc.keyAssumptions.length>0&&<div><p className="text-xs font-bold mb-2" style={{color:DS.inkTer}}>Key Assumptions</p>{sc.keyAssumptions.map((a,i)=><p key={i} className="text-xs mb-1 pl-2" style={{color:DS.inkTer}}>· {a}</p>)}</div>}
                          {sc.uncertaintyDrivers.length>0&&<div><p className="text-xs font-bold mb-2" style={{color:DS.inkTer}}>Uncertainty Drivers</p>{sc.uncertaintyDrivers.map((u,i)=><p key={i} className="text-xs mb-1 pl-2" style={{color:DS.inkTer}}>· {u}</p>)}</div>}
                        </div>
                      </motion.div>}
                    </AnimatePresence>
                  </div>
                );
              })}
            </>
          )}

          {!loading && view==='matrix' && (
            results.length===0
              ? <div className="flex flex-col items-center justify-center py-16 gap-3"><div className="text-4xl">📋</div><p className="text-sm" style={{color:DS.inkTer}}>Run "Stress Test Strategies" to populate the matrix</p></div>
              : <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{minWidth:500}}>
                    <thead>
                      <tr>
                        <th className="text-left p-3 text-xs font-bold uppercase tracking-widest" style={{color:DS.inkTer,width:180}}>Scenario / Strategy →</th>
                        {strategies.map((s:any,i:number)=>(
                          <th key={s.id??i} className="text-center p-2 text-xs font-bold" style={{color:STRATEGY_COLORS[i%STRATEGY_COLORS.length],minWidth:100}}>{s.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.map((sc,si)=>{
                        const meta=SCENARIO_META[sc.type];
                        return (
                          <tr key={sc.id} style={{background:si%2===0?DS.surface:DS.surfaceAlt}}>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span>{meta.icon}</span>
                                <div><p className="text-xs font-semibold" style={{color:DS.ink}}>{sc.name}</p><p className="text-xs" style={{color:DS.inkFaint}}>{sc.probability}%</p></div>
                              </div>
                            </td>
                            {strategies.map((st:any,sti:number)=>{
                              const res=results.find(r=>r.scenarioId===sc.id&&(r.strategyId===(st.id??String(sti))||r.strategyName===st.name));
                              if(!res) return <td key={st.id??sti} className="p-2 text-center"><span className="text-xs" style={{color:DS.inkFaint}}>—</span></td>;
                              const pm=PERF_META[res.performance];
                              return (
                                <td key={st.id??sti} className="p-2">
                                  <div className="flex flex-col items-center gap-1 p-2 rounded-lg" style={{background:pm.bg}}>
                                    <span className="text-base">{pm.icon}</span>
                                    <span className="text-xs font-bold" style={{color:pm.color}}>{res.value>0?'+':''}{res.value}</span>
                                    <span className="text-xs capitalize" style={{color:pm.color}}>{res.performance}</span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
          )}

          {!loading && view==='robustness' && (
            robustness.length===0
              ? <div className="flex flex-col items-center justify-center py-16 gap-3"><div className="text-4xl">🛡️</div><p className="text-sm" style={{color:DS.inkTer}}>Run "Stress Test Strategies" to see robustness</p></div>
              : <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{color:DS.inkTer}}>Strategy Robustness — sorted by score</p>
                  {[...robustness].sort((a,b)=>b.robustnessScore-a.robustnessScore).map(rb=>(
                    <div key={rb.strategyId} className="rounded-xl p-4" style={{background:DS.surface,border:`1.5px solid ${rb.color}30`}}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{background:rb.color}}/>
                          <span className="text-sm font-bold" style={{color:DS.ink}}>{rb.strategyName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full overflow-hidden" style={{background:DS.border}}>
                            <motion.div className="h-full rounded-full" style={{background:rb.color}} initial={{width:0}} animate={{width:`${rb.robustnessScore}%`}} transition={{duration:0.6}}/>
                          </div>
                          <span className="text-sm font-bold w-8 text-right" style={{color:rb.color}}>{rb.robustnessScore}</span>
                        </div>
                      </div>
                      <p className="text-xs mb-3" style={{color:DS.inkTer}}>{rb.recommendation}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {rb.performsWellIn.length>0&&<div><p className="text-xs font-semibold mb-1" style={{color:'#059669'}}>✅ Performs well in:</p>{rb.performsWellIn.map((s,i)=><p key={i} className="text-xs pl-2" style={{color:DS.inkTer}}>· {s}</p>)}</div>}
                        {rb.failsIn.length>0&&<div><p className="text-xs font-semibold mb-1" style={{color:'#DC2626'}}>⚠️ Struggles in:</p>{rb.failsIn.map((s,i)=><p key={i} className="text-xs pl-2" style={{color:DS.inkTer}}>· {s}</p>)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
          )}

          {isReady&&(
            <div className="mt-4 rounded-xl p-4" style={{background:DS.surfaceAlt,border:`1px solid ${DS.border}`}}>
              <motion.button initial={{opacity:0}} animate={{opacity:1}} onClick={()=>onValidated?.({scenarios,results,robustness})}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                style={{background:DS.accent,color:'#fff',boxShadow:`0 4px 14px ${DS.accent}40`}}>
                <CheckCircle2 size={16}/> Complete Scenario Planning
              </motion.button>
            </div>
          )}
        </div>

        <div className="w-52 shrink-0 hidden lg:flex flex-col gap-3 p-4 overflow-y-auto" style={{borderLeft:`1px solid ${DS.border}`,background:DS.surface}}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{color:DS.inkTer}}>Scenarios</p>
          {scenarios.map(sc=>{
            const meta=SCENARIO_META[sc.type];
            return (
              <div key={sc.id} className="rounded-xl p-3" style={{background:meta.bg+'60',border:`1px solid ${meta.color}20`}}>
                <p className="text-xs font-bold" style={{color:meta.color}}>{meta.icon} {sc.name}</p>
                <p className="text-xs mt-0.5" style={{color:DS.inkTer}}>{sc.probability}% probability</p>
              </div>
            );
          })}
          {robustness.length>0&&(
            <div className="mt-2 rounded-xl p-3" style={{background:DS.accentLight,border:`1px solid ${DS.accent}30`}}>
              <p className="text-xs font-semibold mb-1" style={{color:DS.accent}}>🛡️ Most Robust</p>
              {[...robustness].sort((a,b)=>b.robustnessScore-a.robustnessScore).slice(0,1).map(rb=>(
                <p key={rb.strategyId} className="text-xs font-bold" style={{color:DS.ink}}>{rb.strategyName}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

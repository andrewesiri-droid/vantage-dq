import { useState, useEffect } from 'react';
import { useDQAI } from '@/hooks/useDQAI';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { ModuleDataBanner } from '@/components/ui/module-data-banner';
import { toastAIError, toastSaved } from '@/lib/toast';
import { validateModuleData, buildContractPrompt } from '@/lib/dq-data-contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

interface Uncertainty { id: number; label: string; type: string; impact: string; description: string; }
interface Scenario { id: number; name: string; description: string; probability: number; assumptions: string; earlyWarning: string; color: string; strategyImplications: string; }

const SCENARIO_COLORS = ['#7C3AED','#2563EB','#0D9488','#D97706','#DC2626','#0891B2','#7F1D1D','#065F46'];
const UNC_TYPES = ['Market','Regulatory','Technical','Financial','Competitive','Operational','Political','Environmental'];
const IMPACT_ORDER = ['Critical','High','Medium','Low'];

function impactColor(impact: string) {
  return impact === 'Critical' ? DS.danger : impact === 'High' ? DS.warning : impact === 'Medium' ? DS.information.fill : DS.inkDis;
}

export function ScenarioPlanning({ sessionId, data, hooks }: ModuleProps) {
  const [uncertainties, setUncertainties] = useState<Uncertainty[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [newUncLabel, setNewUncLabel] = useState('');
  const [stressResult, setStressResult] = useState<any>(null);
  const [axisInsight, setAxisInsight] = useState('');
  const [busy, setBusy] = useState(false);
  const { call: dqCall, busy: dqBusy } = useDQAI();
  const [expandedUncId, setExpandedUncId] = useState<number | null>(null);
  const [expandedScenId, setExpandedScenId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'uncertainties'|'scenarios'|'stress'>('uncertainties');

  useEffect(() => {
    if (data?.uncertainties?.length) {
      setUncertainties(data.uncertainties.map((u: any) => ({ id: u.id, label: u.label, type: u.type || 'Market', impact: u.impact || 'High', description: u.description || '' })));
    }
    if (data?.scenarios?.length) {
      setScenarios(data.scenarios.map((s: any, i: number) => ({ id: s.id, name: s.name, description: s.description || '', probability: s.probability || 0.25, assumptions: '', earlyWarning: '', color: s.color || SCENARIO_COLORS[i % SCENARIO_COLORS.length], strategyImplications: '' })));
    }
  }, [data?.uncertainties, data?.scenarios]);

  const addUnc = () => {
    if (!newUncLabel.trim()) return;
    const n: Uncertainty = { id: Date.now(), label: newUncLabel.trim(), type: 'Market', impact: 'High', description: '' };
    setUncertainties(p => [...p, n]);
    hooks?.createUncertainty?.({ sessionId, label: newUncLabel.trim(), type: 'Market', impact: 'High' });
    setNewUncLabel('');
  };
  const removeUnc = (id: number) => { setUncertainties(p => p.filter(u => u.id !== id)); hooks?.deleteUncertainty?.({ id }); };
  const updateUnc = (id: number, field: string, val: string) => setUncertainties(p => p.map(u => u.id === id ? { ...u, [field]: val } : u));
  const updateScen = (id: number, field: string, val: any) => setScenarios(p => p.map(s => s.id === id ? { ...s, [field]: val } : s));

  const aiGenerateUnc = async () => {
    const prompt = `Identify 6-8 key external uncertainties for this decision.\nDecision: ${data?.session?.decisionStatement || ''}\nContext: ${(data?.session?.context || '').slice(0, 250)}\nExisting issues: ${(data?.issues || []).slice(0, 5).map((i: any) => i.text).join('; ')}\n\nReturn JSON: { uncertainties: [{label, type: Market|Regulatory|Technical|Financial|Competitive|Operational, impact: Critical|High|Medium, description}] }`;
    setBusy(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, module: 'scenario' }) });
      const d = await res.json();
      const text = (d.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]);
        const newUncs = (result.uncertainties || []).map((u: any, i: number) => ({ id: Date.now() + i, label: u.label || '', type: u.type || 'Market', impact: u.impact || 'High', description: u.description || '' }));
        setUncertainties(p => [...p, ...newUncs]);
      }
    } catch(e) { console.error(e); } finally { setBusy(false); }
  };

  const aiGenerateScenarios = async () => {
    const uncList = uncertainties.map(u => `- ${u.label} [${u.type}, impact: ${u.impact}]${u.description ? ': ' + u.description : ''}`).join('\n');
    const prompt = `UNCERTAINTY vs ASSUMPTION (CRITICAL DISTINCTION):
- Uncertainty: Something we do NOT know and cannot control (external, future, variable)
  → "What will the regulatory approval timeline be?" 
- Assumption: Something we TREAT AS TRUE for planning purposes (could be wrong)
  → "We assume English is acceptable for initial Singapore sales"
- Rule: Uncertainties drive scenario axes. Assumptions drive sensitivity analysis.
- Common error: Calling a decision "uncertainty" (e.g. "which strategy we choose")

WHAT MAKES A GOOD SCENARIO AXIS:
- Must be: HIGH IMPACT (significantly changes decision value) AND HIGH UNCERTAINTY (genuinely unknown)
- Must NOT be: something we control, something already decided, a low-impact variable
- Test: "If this resolved differently, would our preferred strategy change?" If yes → strong axis

WHAT IS A SCENARIO:
- Definition: A coherent, internally consistent description of a plausible future world
- Must: tell a story (not just a data point), be internally consistent, challenge strategies
- Must NOT: be optimistic/pessimistic versions of the same world (that's sensitivity analysis)
- Rule: Each scenario must have at least one strategy that wins and one that loses
- Quality test: Would a well-informed person say "yes, this could plausibly happen"?

PROBABILITY RULES:
- All scenarios must sum to 100%
- No scenario should be <5% (if too unlikely, remove it)
- Base case should typically be 40-60% probability
- Avoid three scenarios where one is clearly the "expected" case

You are a scenario planning expert using the GBN/Shell methodology.


Decision: ${data?.session?.decisionStatement || ''}
Context: ${(data?.session?.context || '').slice(0, 300)}

Uncertainties identified (${uncertainties.length} total):
${uncList}

INSTRUCTIONS:
1. From all uncertainties, select the 2 MOST decision-critical as scenario axes (highest impact + most uncertain)
2. Generate 4 distinct named scenarios that span the realistic possibility space
3. If there are more than 2 high-impact uncertainties, incorporate them as secondary drivers within each scenario narrative
4. Each scenario must be internally consistent and plausible
5. Scenarios should challenge the preferred strategy, not just validate it
6. Assign probabilities that sum to 1.0

Return JSON: {
  axisInsight: "Why these 2 axes were chosen and what other uncertainties they subsume",
  keyAxis1: "label of most critical uncertainty",
  keyAxis2: "label of second most critical uncertainty",  
  scenarios: [{
    name: "evocative 2-3 word name",
    description: "2-3 sentence narrative of this world",
    probability: 0.0-1.0,
    assumptions: "key conditions that make this scenario real",
    earlyWarning: "what signals would tell us this scenario is emerging",
    strategyImplications: "which strategies win/lose in this scenario and why"
  }]
}`;
    setBusy(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, module: 'scenario' }) });
      const d = await res.json();
      const text = (d.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]);
        if (result.axisInsight) setAxisInsight(result.axisInsight);
        if (result.scenarios?.length) {
          const newScens: Scenario[] = result.scenarios.map((s: any, i: number) => ({
            id: Date.now() + i, name: s.name || `Scenario ${i + 1}`,
            description: s.description || '', probability: Math.min(1, Math.max(0, Number(s.probability) || 0.25)),
            assumptions: s.assumptions || '', earlyWarning: s.earlyWarning || '',
            color: SCENARIO_COLORS[i % SCENARIO_COLORS.length],
            strategyImplications: s.strategyImplications || '',
          }));
          setScenarios(newScens);
          setActiveTab('scenarios');
        }
      }
    } catch(e) { console.error(e); } finally { setBusy(false); }
  };

  const aiStressTest = async () => {
    const validation = validateModuleData('scenario-planning', data);
    const strategies = data?.strategies || [];
    const stratList = strategies.length
      ? strategies.map((s: any) => `${s.name}: ${s.rationale || ''}`).join('\n')
      : 'No strategies defined — add strategies in Strategy Table first';
    const contractRules = buildContractPrompt('scenario-planning', data);
    const scenList = scenarios.map(s => `${s.name}: ${s.description}`).join('\n');
    const prompt = `${contractRules}

Stress test strategies across scenarios for this decision.
Decision: ${data?.session?.decisionStatement || ''}
${strategies.length ? `Strategies:\n${stratList}` : `No strategies defined. Infer 2-3 plausible strategic options from the decision context and test those.`}
Scenarios:
${scenList}

For each strategy: assess robustness across all scenarios. Which scenarios does it win in? Which does it fail in?
Return JSON: { profiles: [{name, robustness: "robust|conditional|fragile", winsIn: [scenario names], failsIn: [scenario names], failureCondition: string, recommendation: string}], mostRobust: string, insight: string, regretMatrix: string }`;
    setBusy(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, module: 'scenario' }) });
      const d = await res.json();
      const text = (d.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) { setStressResult(JSON.parse(match[0])); setActiveTab('stress'); }
    } catch(e) { console.error(e); } finally { setBusy(false); }
  };

  const totalProb = scenarios.reduce((a, s) => a + s.probability, 0);
  const sortedUnc = [...uncertainties].sort((a, b) => IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact));

  return (
    <div className="space-y-4">
      <ModuleDataBanner moduleId="scenario-planning" data={data} />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 10</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Scenario Planning</h2>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1 text-xs h-7 shrink-0" onClick={aiGenerateUnc} disabled={busy}>
            <Sparkles size={11} /> {busy ? 'Generating…' : 'AI Generate Uncertainties'}
          </Button>
          <Button size="sm" className="gap-1 text-xs h-7 shrink-0" style={{ background: DS.reasoning.fill }} onClick={aiGenerateScenarios} disabled={busy || uncertainties.length < 2}>
            <Sparkles size={11} /> {busy ? 'Building…' : 'AI Build Scenarios'}
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      {(uncertainties.length > 0 || scenarios.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
            <div className="text-lg font-black" style={{ color: DS.ink }}>{uncertainties.length}</div>
            <div className="text-[9px] font-bold uppercase" style={{ color: DS.inkDis }}>Uncertainties</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: DS.reasoning.soft, border: `1px solid ${DS.reasoning.line}` }}>
            <div className="text-lg font-black" style={{ color: DS.reasoning.fill }}>{scenarios.length}</div>
            <div className="text-[9px] font-bold uppercase" style={{ color: DS.reasoning.fill }}>Scenarios</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: Math.abs(totalProb - 1) < 0.05 ? DS.successSoft : DS.warnSoft, border: `1px solid ${Math.abs(totalProb - 1) < 0.05 ? DS.success : DS.warning}40` }}>
            <div className="text-lg font-black" style={{ color: Math.abs(totalProb - 1) < 0.05 ? DS.success : DS.warning }}>{Math.round(totalProb * 100)}%</div>
            <div className="text-[9px] font-bold uppercase" style={{ color: DS.inkDis }}>Probability</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto scrollbar-none" style={{ borderColor: DS.borderLight }}>
        {[
          { id: 'uncertainties', label: `Uncertainties (${uncertainties.length})` },
          { id: 'scenarios', label: `Scenarios (${scenarios.length})` },
          { id: 'stress', label: 'Strategy Stress Test' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className="px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: activeTab === tab.id ? DS.reasoning.fill : DS.inkTer, borderBottom: activeTab === tab.id ? `2px solid ${DS.reasoning.fill}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* UNCERTAINTIES TAB */}
      {activeTab === 'uncertainties' && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: DS.inkSub }}>
            Identify all key external uncertainties — things outside your control that could significantly affect the decision outcome. Add as many as relevant. AI will select the most decision-critical ones as scenario axes.
          </p>

          <div className="flex gap-1.5 flex-wrap">
            <Input value={newUncLabel} onChange={e => setNewUncLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addUnc()} placeholder="Add uncertainty…" className="flex-1 text-xs h-8" />
            <Button size="sm" className="h-8 gap-1 text-xs shrink-0" style={{ background: DS.reasoning.fill }} onClick={addUnc} disabled={!newUncLabel.trim()}>
              <Plus size={12} /> Add
            </Button>
          </div>

          {uncertainties.length === 0 && (
            <div className="text-center py-10 rounded-xl" style={{ background: DS.bg, border: `1px dashed ${DS.border}` }}>
              <TrendingUp size={24} className="mx-auto mb-2" style={{ color: DS.inkDis }} />
              <p className="text-xs mb-3" style={{ color: DS.inkDis }}>No uncertainties yet — add manually or use AI</p>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={aiGenerateUnc} disabled={busy}>
                <Sparkles size={11} /> AI Generate Uncertainties
              </Button>
            </div>
          )}

          {sortedUnc.map(u => {
            const isExpanded = expandedUncId === u.id;
            const ic = impactColor(u.impact);
            return (
              <div key={u.id} className="rounded-xl border overflow-hidden" style={{ borderColor: isExpanded ? ic + '60' : DS.borderLight }}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" style={{ background: DS.canvas }} onClick={() => setExpandedUncId(isExpanded ? null : u.id)}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ic }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium" style={{ color: DS.ink }}>{u.label}</span>
                    {u.description && !isExpanded && <p className="text-[10px] truncate" style={{ color: DS.inkDis }}>{u.description}</p>}
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: ic + '15', color: ic }}>{u.impact}</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full shrink-0" style={{ background: DS.bg, color: DS.inkDis }}>{u.type}</span>
                  <button onClick={e => { e.stopPropagation(); removeUnc(u.id); }}><Trash2 size={11} style={{ color: DS.inkDis }} /></button>
                  {isExpanded ? <ChevronUp size={13} style={{ color: DS.inkDis }} /> : <ChevronDown size={13} style={{ color: DS.inkDis }} />}
                </div>
                {isExpanded && (
                  <div className="px-4 pb-3 pt-2 space-y-3 border-t" style={{ borderColor: DS.borderLight }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>TYPE</div>
                        <div className="flex flex-wrap gap-1">
                          {UNC_TYPES.map(t => (
                            <button key={t} onClick={() => updateUnc(u.id, 'type', t)} className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ background: u.type === t ? DS.reasoning.fill : DS.bg, color: u.type === t ? '#fff' : DS.inkDis }}>
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>IMPACT</div>
                        <div className="flex gap-1">
                          {['Critical','High','Medium','Low'].map(v => (
                            <button key={v} onClick={() => updateUnc(u.id, 'impact', v)} className="flex-1 py-1 text-[9px] font-bold rounded-lg" style={{ background: u.impact === v ? impactColor(v) : DS.bg, color: u.impact === v ? '#fff' : DS.inkDis }}>
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>DESCRIPTION</div>
                      <textarea value={u.description} onChange={e => updateUnc(u.id, 'description', e.target.value)} rows={2} placeholder="Why is this uncertain and what's the range of outcomes?" className="w-full text-xs p-2 rounded-lg border resize-none bg-white" style={{ borderColor: DS.borderLight }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {uncertainties.length >= 2 && (
            <Button className="gap-1.5 w-full" style={{ background: DS.reasoning.fill }} onClick={aiGenerateScenarios} disabled={busy}>
              <Sparkles size={14} /> {busy ? 'Building scenarios…' : `AI Build Scenarios from ${uncertainties.length} Uncertainties`}
            </Button>
          )}
        </div>
      )}

      {/* SCENARIOS TAB */}
      {activeTab === 'scenarios' && (
        <div className="space-y-3">
          {axisInsight && (
            <div className="rounded-xl p-3" style={{ background: DS.reasoning.soft, border: `1px solid ${DS.reasoning.line}` }}>
              <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.reasoning.fill }}>AXIS SELECTION RATIONALE</div>
              <p className="text-xs" style={{ color: DS.inkSub }}>{axisInsight}</p>
            </div>
          )}

          {scenarios.length === 0 && (
            <div className="text-center py-10 rounded-xl" style={{ background: DS.bg, border: `1px dashed ${DS.border}` }}>
              <p className="text-xs mb-3" style={{ color: DS.inkDis }}>No scenarios yet — add uncertainties first then build scenarios</p>
              <Button size="sm" className="gap-1.5 text-xs" style={{ background: DS.reasoning.fill }} onClick={aiGenerateScenarios} disabled={busy || uncertainties.length < 2}>
                <Sparkles size={11} /> AI Build Scenarios
              </Button>
            </div>
          )}

          {/* Probability check */}
          {scenarios.length > 0 && Math.abs(totalProb - 1) > 0.05 && (
            <div className="text-xs px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: DS.warnSoft, color: DS.warning }}>
              <AlertTriangle size={12} /> Probabilities sum to {Math.round(totalProb * 100)}% — should total 100%
            </div>
          )}
          {scenarios.length > 0 && Math.abs(totalProb - 1) <= 0.05 && (
            <div className="text-xs px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: DS.successSoft, color: DS.success }}>
              <CheckCircle size={12} /> Probabilities sum to 100% ✓
            </div>
          )}

          {scenarios.map(s => {
            const isExpanded = expandedScenId === s.id;
            return (
              <div key={s.id} className="rounded-xl border overflow-hidden" style={{ borderColor: isExpanded ? s.color + '60' : DS.borderLight }}>
                <div className="h-1" style={{ background: s.color }} />
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" style={{ background: DS.canvas }} onClick={() => setExpandedScenId(isExpanded ? null : s.id)}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: s.color }}>
                    {Math.round(s.probability * 100)}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold" style={{ color: DS.ink }}>{s.name}</div>
                    {!isExpanded && <p className="text-[10px] truncate" style={{ color: DS.inkDis }}>{s.description}</p>}
                  </div>
                  {isExpanded ? <ChevronUp size={13} style={{ color: DS.inkDis }} /> : <ChevronDown size={13} style={{ color: DS.inkDis }} />}
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 space-y-3 border-t" style={{ borderColor: DS.borderLight }}>
                    <div>
                      <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>PROBABILITY</div>
                      <div className="flex items-center gap-3">
                        <input type="range" min="0" max="1" step="0.05" value={s.probability} onChange={e => updateScen(s.id, 'probability', Number(e.target.value))} className="flex-1" style={{ accentColor: s.color }} />
                        <span className="text-sm font-black w-10 text-right" style={{ color: s.color }}>{Math.round(s.probability * 100)}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>NARRATIVE</div>
                      <textarea value={s.description} onChange={e => updateScen(s.id, 'description', e.target.value)} rows={3} placeholder="Describe this scenario…" className="w-full text-xs p-2 rounded-lg border resize-none bg-white" style={{ borderColor: DS.borderLight }} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>KEY ASSUMPTIONS</div>
                        <textarea value={s.assumptions} onChange={e => updateScen(s.id, 'assumptions', e.target.value)} rows={2} placeholder="What must be true for this scenario?" className="w-full text-xs p-2 rounded-lg border resize-none bg-white" style={{ borderColor: DS.borderLight }} />
                      </div>
                      <div>
                        <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>EARLY WARNING SIGNALS</div>
                        <textarea value={s.earlyWarning} onChange={e => updateScen(s.id, 'earlyWarning', e.target.value)} rows={2} placeholder="What signals indicate this is emerging?" className="w-full text-xs p-2 rounded-lg border resize-none bg-white" style={{ borderColor: DS.borderLight }} />
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>STRATEGY IMPLICATIONS</div>
                      <textarea value={s.strategyImplications} onChange={e => updateScen(s.id, 'strategyImplications', e.target.value)} rows={2} placeholder="Which strategies win/lose in this scenario?" className="w-full text-xs p-2 rounded-lg border resize-none bg-white" style={{ borderColor: DS.borderLight }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {scenarios.length > 0 && (
            <Button className="gap-1.5 w-full" style={{ background: DS.reasoning.fill }} onClick={aiStressTest} disabled={busy || !scenarios.length}>
              <Sparkles size={14} /> {busy ? 'Testing…' : 'Stress Test Strategies Against These Scenarios'}
            </Button>
          )}
        </div>
      )}

      {/* STRESS TEST TAB */}
      {activeTab === 'stress' && (
        <div className="space-y-3">
          {!stressResult ? (
            <div className="text-center py-10 rounded-xl" style={{ background: DS.bg, border: `1px dashed ${DS.border}` }}>
              <p className="text-xs mb-3" style={{ color: DS.inkDis }}>Test how each strategy performs across all scenarios</p>
              <Button size="sm" className="gap-1.5 text-xs" style={{ background: DS.reasoning.fill }} onClick={aiStressTest} disabled={busy || !scenarios.length}>
                <Sparkles size={11} /> Run Stress Test
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {stressResult.mostRobust && (
                <div className="rounded-xl p-4" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
                  <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.accent }}>MOST ROBUST STRATEGY</div>
                  <div className="text-sm font-bold mb-1" style={{ color: DS.ink }}>{stressResult.mostRobust}</div>
                  {stressResult.insight && <p className="text-xs" style={{ color: DS.inkSub }}>{stressResult.insight}</p>}
                  {stressResult.regretMatrix && <p className="text-xs mt-1 italic" style={{ color: DS.inkDis }}>{stressResult.regretMatrix}</p>}
                </div>
              )}

              {(stressResult.profiles || []).map((p: any, i: number) => {
                const robColor = p.robustness === 'robust' ? DS.success : p.robustness === 'conditional' ? DS.warning : DS.danger;
                const robSoft = p.robustness === 'robust' ? DS.successSoft : p.robustness === 'conditional' ? DS.warnSoft : DS.dangerSoft;
                return (
                  <div key={i} className="rounded-xl p-4 border" style={{ borderColor: robColor + '40', background: robSoft }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold flex-1" style={{ color: DS.ink }}>{p.name}</span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: robColor + '20', color: robColor }}>{p.robustness}</span>
                    </div>
                    {p.winsIn?.length > 0 && <p className="text-[10px] mb-1" style={{ color: DS.success }}>✓ Wins in: {p.winsIn.join(', ')}</p>}
                    {p.failsIn?.length > 0 && <p className="text-[10px] mb-1" style={{ color: DS.danger }}>✗ Fails in: {p.failsIn.join(', ')}</p>}
                    {p.recommendation && <p className="text-[10px]" style={{ color: DS.inkSub }}>{p.recommendation}</p>}
                  </div>
                );
              })}

              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={aiStressTest} disabled={busy}>
                <Sparkles size={10} /> Re-run
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

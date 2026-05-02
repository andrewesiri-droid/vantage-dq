import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Plus, Trash2, Lightbulb, ChevronRight } from 'lucide-react';

interface Uncertainty { id: number; label: string; type: string; impact: string; description: string; }
interface Scenario { id: number; name: string; description: string; probability: number; assumptions: string; earlyWarning: string; color: string; pos?: string; }

const TABS = [
  { id: 'uncertainties', num: '1', label: 'Uncertainties' },
  { id: 'axes', num: '2a', label: 'Select Axes' },
  { id: 'multiscenario', num: '2b', label: 'Multi-Scenario' },
  { id: 'scenarios', num: '3', label: 'Scenarios' },
  { id: 'test', num: '4', label: 'Test Strategies' },
  { id: 'robustness', num: '5', label: 'Robustness' },
];

const SCENARIO_COLORS = ['#7C3AED','#2563EB','#0D9488','#D97706','#DC2626','#0891B2'];
const UNC_TYPES = ['Market','Regulatory','Technical','Financial','Competitive','Operational','Political','Environmental'];

export function ScenarioPlanning({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [activeTab, setActiveTab] = useState('uncertainties');
  const [uncertainties, setUncertainties] = useState<Uncertainty[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [axes, setAxes] = useState<any>(null);
  const [newUncLabel, setNewUncLabel] = useState('');
  const [stressResult, setStressResult] = useState<any>(null);
  const [robustness, setRobustness] = useState<any>(null);

  useEffect(() => {
    if (data?.uncertainties?.length) {
      setUncertainties(data.uncertainties.map((u:any)=>({ id:u.id, label:u.label, type:u.type||'Market', impact:u.impact||'High', description:u.description||'' })));
    }
    if (data?.scenarios?.length) {
      setScenarios(data.scenarios.map((s:any,i:number)=>({ id:s.id, name:s.name, description:s.description||'', probability:s.probability||0.25, assumptions:'', earlyWarning:'', color:s.color||SCENARIO_COLORS[i%SCENARIO_COLORS.length], pos:s.pos||'' })));
    }
  }, [data?.uncertainties, data?.scenarios]);

  const addUnc = () => {
    if (!newUncLabel.trim()) return;
    const n:Uncertainty = { id:Date.now(), label:newUncLabel.trim(), type:'Market', impact:'High', description:'' };
    setUncertainties(p=>[...p,n]);
    hooks?.createUncertainty?.({ sessionId, label:newUncLabel.trim(), type:'Market', impact:'High' });
    setNewUncLabel('');
  };
  const removeUnc = (id:number) => { setUncertainties(p=>p.filter(u=>u.id!==id)); hooks?.deleteUncertainty?.({ id }); };

  const aiGenerateUnc = () => {
    const prompt = `Identify the 6-8 most important external uncertainties for this decision.\nDecision: ${data?.session?.decisionStatement||''}\nContext: ${(data?.session?.context||'').slice(0,200)}\nIssues: ${(data?.issues||[]).filter((i:any)=>i.category==='uncertainty-external').map((i:any)=>i.text).slice(0,5).join('; ')}\n\nReturn JSON: { uncertainties: [{label, type (Market/Regulatory/Technical/Financial/Competitive/Operational), impact (Critical/High/Medium), description}] }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      const newUncs = (result?.uncertainties||[]).map((u:any,i:number)=>({ id:Date.now()+i, label:u.label||'', type:u.type||'Market', impact:u.impact||'High', description:u.description||'' }));
      setUncertainties(p=>[...p,...newUncs]);
    });
  };

  const aiGenerateScenarios = () => {
    const uncList = uncertainties.map(u=>`${u.label} [${u.type}, ${u.impact}]`).join(', ');
    const prompt = `Build a 2x2 scenario matrix from these uncertainties.\nDecision: ${data?.session?.decisionStatement||''}\nUncertainties: ${uncList}\n\nReturn JSON: { axis1: {label, low, high}, axis2: {label, low, high}, scenarios: [{pos: TL|TR|BL|BR, name, narrative, probability: 0-1, assumptions, earlyWarningIndicators}], insight: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result?.axis1) setAxes({ axis1: result.axis1, axis2: result.axis2, insight: result.insight });
      if (result?.scenarios?.length) {
        const newScens: Scenario[] = result.scenarios.map((s:any,i:number)=>({ id:Date.now()+i, name:s.name||`Scenario ${i+1}`, description:s.narrative||'', probability:Math.min(1,Math.max(0,Number(s.probability)||0.25)), assumptions:s.assumptions||'', earlyWarning:s.earlyWarningIndicators||'', color:SCENARIO_COLORS[i%SCENARIO_COLORS.length], pos:s.pos||'' }));
        setScenarios(newScens);
        setActiveTab('scenarios');
      }
    });
  };

  const aiStressTest = () => {
    const stratList = (data?.strategies||[]).map((s:any)=>s.name).join(', ');
    const scenList = scenarios.map(s=>`${s.pos||s.name}: ${s.description.slice(0,80)}`).join('; ');
    const prompt = `Stress test strategies across scenarios.\nStrategies: ${stratList}\nScenarios: ${scenList}\n\nReturn JSON: { profiles: [{name, robustness: robust|conditional|fragile, winsIn: [scenario names], failsIn: [scenario names], failureCondition: string}], mostRobust: string, insight: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) { setStressResult(result); setActiveTab('test'); }
    });
  };

  const aiRobustness = () => {
    const prompt = `Analyse strategy robustness across all scenarios.\nStrategies: ${(data?.strategies||[]).map((s:any)=>s.name+': '+(s.rationale||'')).join('; ')}\nScenarios: ${scenarios.map(s=>s.name+': '+s.description.slice(0,60)).join('; ')}\n\nReturn JSON: { robustnessMatrix: [{strategy, scores: [{scenario, score: 1-5, note}]}], winner: string, insight: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) { setRobustness(result); setActiveTab('robustness'); }
    });
  };

  const totalProb = scenarios.reduce((a,s)=>a+s.probability,0);
  const POS_LABELS: Record<string,{top:string;left:string}> = { TL:{top:'10%',left:'5%'}, TR:{top:'10%',left:'55%'}, BL:{top:'55%',left:'5%'}, BR:{top:'55%',left:'55%'} };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 05</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Scenario Planning</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={addUnc} disabled={!newUncLabel.trim()}>
            <Plus size={11} /> Add Uncertainty
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.reasoning.fill }} onClick={aiGenerateScenarios} disabled={busy||!uncertainties.length}>
            <Sparkles size={11} /> AI Generate
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-5 overflow-x-auto" style={{ borderColor: DS.borderLight }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1 px-3 py-2.5 text-xs font-medium transition-colors shrink-0"
            style={{ color: activeTab===tab.id ? DS.reasoning.fill : DS.inkTer, borderBottom: activeTab===tab.id ? `2px solid ${DS.reasoning.fill}` : '2px solid transparent', marginBottom: -1 }}>
            <span className="text-[8px] opacity-60">{tab.num}.</span> {tab.label}
          </button>
        ))}
      </div>

      {/* === UNCERTAINTIES === */}
      {activeTab === 'uncertainties' && (
        <div className="space-y-4">
          <div>
            <p className="text-xs mb-3" style={{ color: DS.inkSub }}>Identify the key <strong>external uncertainties</strong> that could affect this decision. These must be things outside management control — not decisions, risks, or constraints. AI will suggest which two are most decision-relevant for building your 2×2 scenario matrix.</p>
          </div>

          {/* Add row */}
          <div className="flex gap-2 p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
            <Input value={newUncLabel} onChange={e=>setNewUncLabel(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addUnc()}
              placeholder="Uncertainty label…" className="flex-1 text-xs h-8 bg-white" />
            <Button size="sm" className="h-8 px-3 gap-1 text-xs shrink-0" style={{ background: DS.reasoning.fill }} onClick={addUnc} disabled={!newUncLabel.trim()}>
              <Plus size={12} /> Add
            </Button>
          </div>

          {uncertainties.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-14" style={{ borderColor: DS.borderLight }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: DS.bg }}>
                <Lightbulb size={20} style={{ color: DS.inkDis }} />
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: DS.inkSub }}>No uncertainties yet</p>
              <p className="text-xs mb-4" style={{ color: DS.inkDis }}>Click <strong>AI Generate</strong> to identify key uncertainties from your decision context, or add them manually.</p>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={aiGenerateUnc} disabled={busy}>
                <Sparkles size={11} /> AI Generate
              </Button>
              <button className="mt-2 text-xs" style={{ color: DS.inkDis }} onClick={addUnc}>+ Add Manually</button>
            </div>
          ) : (
            <div className="space-y-2">
              {uncertainties.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl group" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                  <div className="flex-1">
                    <div className="text-xs font-medium" style={{ color: DS.ink }}>{u.label}</div>
                    {u.description && <p className="text-[10px] mt-0.5" style={{ color: DS.inkDis }}>{u.description}</p>}
                  </div>
                  <Badge style={{ background: DS.bg, color: DS.inkSub, border: `1px solid ${DS.border}`, fontSize:8 }}>{u.type}</Badge>
                  <Badge style={{ background: u.impact==='Critical'?DS.dangerSoft:u.impact==='High'?DS.warnSoft:DS.bg, color: u.impact==='Critical'?DS.danger:u.impact==='High'?DS.warning:DS.inkDis, border:'none', fontSize:8 }}>{u.impact}</Badge>
                  <button onClick={()=>removeUnc(u.id)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={11} style={{ color: DS.inkDis }} /></button>
                </div>
              ))}
            </div>
          )}

          {uncertainties.length > 0 && (
            <Button className="gap-1.5" style={{ background: DS.reasoning.fill }} onClick={aiGenerateScenarios} disabled={busy}>
              <Sparkles size={14} /> Generate 2×2 Scenarios from These Uncertainties
            </Button>
          )}
        </div>
      )}

      {/* === SCENARIOS === */}
      {activeTab === 'scenarios' && (
        <div className="space-y-4">
          {/* Axes */}
          {axes && (
            <div className="p-3 rounded-xl" style={{ background: DS.reasoning.soft, border: `1px solid ${DS.reasoning.line}` }}>
              <div className="grid grid-cols-2 gap-4">
                <div><div className="text-[9px] font-bold uppercase mb-0.5" style={{ color: DS.reasoning.fill }}>AXIS 1: {axes.axis1.label}</div><div className="text-[10px]" style={{ color: DS.inkSub }}>Low: {axes.axis1.low} · High: {axes.axis1.high}</div></div>
                <div><div className="text-[9px] font-bold uppercase mb-0.5" style={{ color: DS.reasoning.fill }}>AXIS 2: {axes.axis2.label}</div><div className="text-[10px]" style={{ color: DS.inkSub }}>Low: {axes.axis2.low} · High: {axes.axis2.high}</div></div>
              </div>
              {axes.insight && <p className="text-[10px] mt-2 italic" style={{ color: DS.inkSub }}>{axes.insight}</p>}
            </div>
          )}

          {/* 2x2 visual */}
          {scenarios.length >= 2 && (
            <div className="relative rounded-xl border overflow-hidden" style={{ borderColor: DS.borderLight, height: 240, background: '#F7F8FA' }}>
              <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: DS.borderLight }} />
              <div className="absolute top-0 bottom-0 left-1/2 w-px" style={{ background: DS.borderLight }} />
              {scenarios.map(s => {
                const pos = POS_LABELS[s.pos||'TL'] || POS_LABELS.TL;
                return (
                  <div key={s.id} className="absolute w-[44%] h-[44%] p-2 flex flex-col" style={{ top: pos.top, left: pos.left }}>
                    <div className="flex items-center gap-1.5 mb-1"><div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} /><span className="text-[10px] font-bold" style={{ color: DS.ink }}>{s.name}</span></div>
                    <p className="text-[9px] leading-relaxed flex-1 overflow-hidden" style={{ color: DS.inkSub }}>{s.description.slice(0,80)}</p>
                    <div className="text-[9px] font-bold" style={{ color: s.color }}>{Math.round(s.probability*100)}%</div>
                  </div>
                );
              })}
              {axes && <><div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-[8px] font-bold" style={{ color: DS.inkDis }}>{axes.axis1.label} →</div>
              <div className="absolute left-1 top-1/3 text-[8px] font-bold" style={{ color: DS.inkDis, writingMode:'vertical-rl' as const, transform:'rotate(180deg)' }}>↑ {axes.axis2?.label}</div></>}
            </div>
          )}

          {/* Scenario cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {scenarios.map(s => (
              <div key={s.id} className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
                <div className="h-1" style={{ background: s.color }} />
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                    <span className="text-xs font-bold" style={{ color: DS.ink }}>{s.name}</span>
                    <span className="text-[10px] font-bold ml-auto" style={{ color: s.color }}>{Math.round(s.probability*100)}%</span>
                  </div>
                  <Textarea value={s.description} onChange={e=>setScenarios(p=>p.map(sc=>sc.id===s.id?{...sc,description:e.target.value}:sc))} rows={2} className="text-[10px] resize-none" placeholder="Describe this scenario…" />
                  {s.earlyWarning && <p className="text-[9px]" style={{ color: DS.inkDis }}>📡 {s.earlyWarning}</p>}
                </div>
              </div>
            ))}
          </div>
          {Math.abs(totalProb-1)>0.05 && scenarios.length>0 && (
            <div className="text-[10px] px-3 py-2 rounded-lg" style={{ background: DS.warnSoft, color: DS.warning }}>⚠ Probabilities sum to {Math.round(totalProb*100)}% — should total 100%</div>
          )}
          <Button className="gap-1.5 text-xs" style={{ background: DS.reasoning.fill }} onClick={aiStressTest} disabled={busy||!scenarios.length}>
            <Sparkles size={12} /> Test Strategies Against These Scenarios
          </Button>
        </div>
      )}

      {/* === TEST STRATEGIES === */}
      {activeTab === 'test' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>Which strategy performs best across all scenarios?</p>
            <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.reasoning.fill }} onClick={aiStressTest} disabled={busy}>
              <Sparkles size={11} /> {busy?'Testing…':'Run Stress Test'}
            </Button>
          </div>
          {!stressResult ? (
            <div className="text-center py-12 rounded-xl" style={{ background: DS.bg }}>
              <p className="text-xs" style={{ color: DS.inkDis }}>Run the stress test to see which strategy is most robust</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stressResult.mostRobust && <div className="p-3 rounded-xl" style={{ background: DS.accentSoft, border:`1px solid ${DS.accent}30` }}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.accent }}>MOST ROBUST</div>
                <p className="text-xs font-semibold" style={{ color: DS.ink }}>{stressResult.mostRobust}</p>
                {stressResult.insight && <p className="text-[10px] mt-1" style={{ color: DS.inkSub }}>{stressResult.insight}</p>}
              </div>}
              {(stressResult.profiles||[]).map((p:any,i:number)=>(
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: DS.canvas, border:`1px solid ${DS.borderLight}` }}>
                  <Badge style={{ background: p.robustness==='robust'?DS.successSoft:p.robustness==='conditional'?DS.warnSoft:DS.dangerSoft, color: p.robustness==='robust'?DS.success:p.robustness==='conditional'?DS.warning:DS.danger, border:'none', fontSize:8 }}>{p.robustness}</Badge>
                  <span className="text-xs font-medium flex-1" style={{ color: DS.ink }}>{p.name}</span>
                  {p.failureCondition && <span className="text-[9px]" style={{ color: DS.inkDis }}>{p.failureCondition.slice(0,50)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === AXES, MULTI-SCENARIO, ROBUSTNESS stubs === */}
      {(activeTab === 'axes' || activeTab === 'multiscenario' || activeTab === 'robustness') && (
        <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
          <p className="text-sm font-medium mb-1" style={{ color: DS.ink }}>
            {activeTab === 'axes' ? 'Select Scenario Axes' : activeTab === 'multiscenario' ? 'Multi-Scenario Generation' : 'Robustness Analysis'}
          </p>
          <p className="text-xs mb-4" style={{ color: DS.inkTer }}>
            {activeTab === 'axes' ? 'AI selects the 2 most decision-relevant uncertainties as scenario axes.' : activeTab === 'multiscenario' ? 'Generate multiple scenario sets with different axis combinations.' : 'Detailed robustness scoring across all strategy-scenario combinations.'}
          </p>
          <Button style={{ background: DS.reasoning.fill }} onClick={activeTab==='robustness'?aiRobustness:aiGenerateScenarios} disabled={busy} className="gap-2">
            <Sparkles size={14} /> {busy?'Generating…':'Generate'}
          </Button>
          {activeTab === 'robustness' && robustness && (
            <div className="mt-4 space-y-2 text-left">
              <p className="text-xs font-bold" style={{ color: DS.reasoning.fill }}>Most Robust: {robustness.winner}</p>
              <p className="text-xs" style={{ color: DS.inkSub }}>{robustness.insight}</p>
            </div>
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: DS.inkDis }}>
          <span>{uncertainties.length} uncertainties</span><span>·</span><span>{scenarios.length} scenarios</span>
          {scenarios.length>0&&<span>·</span>}
          {scenarios.length>0&&<span style={{ color: Math.abs(totalProb-1)<0.05?DS.success:DS.warning }}>{Math.round(totalProb*100)}% probability</span>}
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" style={{ background: DS.reasoning.fill }}
          onClick={()=>setActiveTab(TABS[Math.min(TABS.findIndex(t=>t.id===activeTab)+1,TABS.length-1)].id)}>
          Next <ChevronRight size={11} />
        </Button>
      </div>
    </div>
  );
}

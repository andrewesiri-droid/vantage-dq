import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Plus, Trash2, Lightbulb, AlertTriangle, Shield, Clock, CheckCircle } from 'lucide-react';

interface RiskItem { id: number; label: string; likelihood: string; impact: string; timeframe: string; owner: string; mitigation: string; month: number; }

const IMPACT_COLORS: Record<string,{color:string;soft:string}> = {
  Critical: { color: '#7F1D1D', soft: '#FEF2F2' },
  High:     { color: DS.danger,  soft: DS.dangerSoft },
  Medium:   { color: DS.warning, soft: DS.warnSoft },
  Low:      { color: DS.success, soft: DS.successSoft },
};

const TABS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'readiness', label: 'Readiness' },
  { id: 'summary', label: 'Risk Summary' },
];

export function DecisionRiskTimeline({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [activeTab, setActiveTab] = useState('timeline');
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newLik, setNewLik] = useState('Medium');
  const [newImp, setNewImp] = useState('High');
  const [readiness, setReadiness] = useState<any>(null);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (data?.riskItems?.length) {
      setRisks(data.riskItems.map((r:any)=>({ id:r.id, label:r.label, likelihood:r.likelihood, impact:r.impact, timeframe:r.timeframe||'', owner:r.owner||'', mitigation:r.mitigation||'', month:r.month||0 })));
    }
  }, [data?.riskItems]);

  const add = () => {
    if (!newLabel.trim()) return;
    const n: RiskItem = { id:Date.now(), label:newLabel.trim(), likelihood:newLik, impact:newImp, timeframe:'', owner:'', mitigation:'', month:3 };
    setRisks(p=>[...p,n]);
    hooks?.createRisk?.({ sessionId, label:newLabel.trim(), likelihood:newLik, impact:newImp });
    setNewLabel('');
  };
  const remove = (id:number) => { setRisks(p=>p.filter(r=>r.id!==id)); hooks?.deleteRisk?.({ id }); };
  const update = (id:number, field:string, val:any) => setRisks(p=>p.map(r=>r.id===id?{...r,[field]:val}:r));

  const aiGenerate = () => {
    const stratName = (data?.strategies||[])[0]?.name||'primary strategy';
    const focusDecs = (data?.decisions||[]).filter((d:any)=>d.tier==='focus').map((d:any)=>d.label).join(', ');
    const prompt = `Create a risk timeline for this decision.\nDecision: ${data?.session?.decisionStatement||''}\nDeadline: ${data?.session?.deadline||''}\nPrimary strategy: ${stratName}\nFocus decisions: ${focusDecs}\n\nReturn JSON: { risks: [{label, likelihood (High/Medium/Low), impact (Critical/High/Medium/Low), timeframe (e.g. Months 1-3), month (integer 1-18), owner (role), mitigation}], peakRiskPeriod: string, criticalPath: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (!result?.risks?.length) return;
      const newRisks: RiskItem[] = result.risks.map((r:any,i:number)=>({ id:Date.now()+i, label:r.label, likelihood:r.likelihood||'Medium', impact:r.impact||'High', timeframe:r.timeframe||'', month:Number(r.month)||3, owner:r.owner||'', mitigation:r.mitigation||'' }));
      setRisks(p=>[...p,...newRisks]);
      if (result.peakRiskPeriod||result.criticalPath) setReadiness(p=>({...p, peakRiskPeriod:result.peakRiskPeriod, criticalPath:result.criticalPath}));
    });
  };

  const aiReadiness = () => {
    const riskSummary = risks.map(r=>`${r.label}: ${r.likelihood}/${r.impact} [${r.timeframe}] — ${r.mitigation||'no mitigation'}`).join('; ');
    const prompt = `Assess decision readiness from this risk profile.\nDecision: ${data?.session?.decisionStatement||''}\nRisks: ${riskSummary}\n\nReturn JSON: { readinessScore: 0-100, readinessLevel: Ready|Conditional|Not Ready, peakRiskPeriod: string, criticalPath: string, blockers: [string], mitigationGaps: [{risk, gap}], lastResponsibleMoment: string, recommendation: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) { setReadiness(result); setActiveTab('readiness'); }
    });
  };

  const maxMonth = 18;
  const months = Array.from({length:maxMonth},(_,i)=>i+1);
  const risksByMonth: Record<number,RiskItem[]> = {};
  risks.forEach(r => { const m=r.month||0; if(m>0&&m<=maxMonth) (risksByMonth[m]=risksByMonth[m]||[]).push(r); });

  const critCount = risks.filter(r=>r.impact==='Critical').length;
  const noMitCount = risks.filter(r=>!r.mitigation?.trim()).length;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 10</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Decision Risk Timeline</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={add} disabled={!newLabel.trim()}>
            <Plus size={11} /> Add Event
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiReadiness} disabled={busy||!risks.length}>
            <Shield size={11} /> AI Readiness Check
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.commitment.fill }} onClick={aiGenerate} disabled={busy}>
            <Sparkles size={11} /> AI Generate
          </Button>
        </div>
      </div>

      {/* Tabs + zoom */}
      <div className="flex border-b mb-0" style={{ borderColor: DS.borderLight }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: activeTab===tab.id?DS.commitment.fill:DS.inkTer, borderBottom: activeTab===tab.id?`2px solid ${DS.commitment.fill}`:'2px solid transparent', marginBottom:-1 }}>
            {tab.label}
          </button>
        ))}
        <div className="flex items-center gap-1 ml-auto pr-3">
          <span className="text-[9px]" style={{ color: DS.inkDis }}>Zoom</span>
          {[60,80,100,130,160].map(z=>(
            <button key={z} onClick={()=>setZoom(z)} className="text-[9px] px-1.5 py-0.5 rounded transition-all"
              style={{ background:zoom===z?DS.commitment.fill:DS.bg, color:zoom===z?'#fff':DS.inkSub }}>{z}%</button>
          ))}
        </div>
      </div>

      {/* === TIMELINE TAB === */}
      {activeTab === 'timeline' && (
        <div className="space-y-0">
          {/* Add row */}
          <div className="flex gap-2 p-3 border-b" style={{ borderColor: DS.borderLight, background: DS.bg }}>
            <Input value={newLabel} onChange={e=>setNewLabel(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()}
              placeholder="Risk event label…" className="flex-1 text-xs h-8 bg-white" />
            <Select value={newLik} onValueChange={setNewLik}><SelectTrigger className="h-8 text-[10px] bg-white w-24"><SelectValue /></SelectTrigger><SelectContent>{['High','Medium','Low'].map(l=><SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}</SelectContent></Select>
            <Select value={newImp} onValueChange={setNewImp}><SelectTrigger className="h-8 text-[10px] bg-white w-28"><SelectValue /></SelectTrigger><SelectContent>{['Critical','High','Medium','Low'].map(l=><SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}</SelectContent></Select>
            <Button size="sm" className="h-8 px-3 gap-1 text-xs shrink-0" style={{ background: DS.commitment.fill }} onClick={add} disabled={!newLabel.trim()}><Plus size={12} /> Add</Button>
          </div>

          {/* Timeline canvas */}
          {risks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ background:'#FAFBFC', borderBottom:`1px solid ${DS.borderLight}` }}>
              <Clock size={32} style={{ color: DS.inkDis, opacity:0.3 }} className="mb-3" />
              <p className="text-sm font-medium mb-1" style={{ color: DS.inkSub }}>No timeline events yet</p>
              <p className="text-xs text-center mb-4" style={{ color: DS.inkDis }}>Click <strong>AI Generate</strong> to build a timeline from your decisions and uncertainties, or<br/><strong>+ Add Event</strong> to add manually.</p>
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ background:'#FAFBFC', borderBottom:`1px solid ${DS.borderLight}` }}>
              <div style={{ transform:`scale(${zoom/100})`, transformOrigin:'top left', minWidth:900, padding:'16px 24px 24px' }}>
                {/* Month axis */}
                <div className="flex mb-4" style={{ gap:0 }}>
                  {months.map(m => (
                    <div key={m} className="flex-1 text-center" style={{ minWidth:46 }}>
                      <div className="text-[9px] font-medium" style={{ color:DS.inkDis }}>M{m}</div>
                    </div>
                  ))}
                </div>
                {/* Timeline track */}
                <div className="relative h-1 rounded-full mb-6" style={{ background:DS.borderLight }}>
                  <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width:'100%', background:`linear-gradient(to right, ${DS.success}, ${DS.warning}, ${DS.danger})`, opacity:0.3 }} />
                </div>
                {/* Risk events */}
                <div className="relative" style={{ height: Math.max(120, Object.values(risksByMonth).reduce((m,v)=>Math.max(m,v.length),0) * 80) }}>
                  {months.map(m => {
                    const monthRisks = risksByMonth[m] || [];
                    return monthRisks.map((r,i) => {
                      const ic = IMPACT_COLORS[r.impact] || IMPACT_COLORS.Medium;
                      return (
                        <div key={r.id} className="absolute rounded-xl px-2.5 py-2 shadow-sm"
                          style={{ left:`${((m-1)/maxMonth)*100}%`, top:`${i*90}px`, width:160, background:'#fff', border:`2px solid ${ic.color}`, transform:'translateX(-50%)' }}>
                          <div className="text-[9px] font-bold mb-0.5" style={{ color: ic.color }}>{r.impact.toUpperCase()}</div>
                          <div className="text-[10px] font-medium leading-snug mb-1" style={{ color: DS.ink }}>{r.label}</div>
                          <div className="flex items-center gap-1.5">
                            {r.owner && <span className="text-[8px]" style={{ color: DS.inkDis }}>{r.owner}</span>}
                          </div>
                          <button onClick={()=>remove(r.id)} className="absolute top-1 right-1 text-[9px] opacity-40 hover:opacity-100 transition-opacity" style={{ color:DS.danger }}>×</button>
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Risk list */}
          {risks.length > 0 && (
            <div className="divide-y" style={{ borderColor: DS.borderLight }}>
              {risks.map(r => {
                const ic = IMPACT_COLORS[r.impact] || IMPACT_COLORS.Medium;
                return (
                  <div key={r.id} className="flex items-start gap-3 px-4 py-3 group hover:bg-gray-50 transition-colors">
                    <AlertTriangle size={14} style={{ color:ic.color, flexShrink:0, marginTop:2 }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-medium" style={{ color:DS.ink }}>{r.label}</span>
                        <Badge style={{ background:ic.soft, color:ic.color, border:'none', fontSize:8 }}>{r.impact}</Badge>
                        <Badge style={{ background:DS.bg, color:DS.inkSub, border:`1px solid ${DS.border}`, fontSize:8 }}>{r.likelihood}</Badge>
                      </div>
                      <div className="flex gap-2 flex-wrap mb-1">
                        <Input value={r.timeframe} onChange={e=>update(r.id,'timeframe',e.target.value)} placeholder="Timeframe" className="text-[10px] h-6 w-28" />
                        <Input value={r.owner} onChange={e=>update(r.id,'owner',e.target.value)} placeholder="Owner" className="text-[10px] h-6 w-28" />
                        <Input type="number" value={r.month||''} onChange={e=>update(r.id,'month',parseInt(e.target.value)||0)} placeholder="Month" className="text-[10px] h-6 w-16" min="1" max="18" />
                      </div>
                      <Input value={r.mitigation} onChange={e=>update(r.id,'mitigation',e.target.value)} placeholder="Mitigation action…" className="text-[10px] h-6" />
                    </div>
                    <button onClick={()=>remove(r.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><Trash2 size={12} style={{ color:DS.inkDis }} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === READINESS TAB === */}
      {activeTab === 'readiness' && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>Is this decision ready to commit to? What are the last responsible moments?</p>
            <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.commitment.fill }} onClick={aiReadiness} disabled={busy}>
              <Shield size={11} /> {busy?'Checking…':'Readiness Check'}
            </Button>
          </div>
          {!readiness ? (
            <div className="text-center py-12 rounded-xl" style={{ background: DS.bg }}>
              <p className="text-xs" style={{ color: DS.inkDis }}>Run the readiness check to assess commitment timing</p>
            </div>
          ) : (
            <div className="space-y-3">
              {readiness.readinessScore !== undefined && (
                <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: readiness.readinessLevel==='Ready'?DS.successSoft:readiness.readinessLevel==='Conditional'?DS.warnSoft:DS.dangerSoft }}>
                  <div className="text-4xl font-black" style={{ color: readiness.readinessLevel==='Ready'?DS.success:readiness.readinessLevel==='Conditional'?DS.warning:DS.danger }}>{readiness.readinessScore}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold" style={{ color:DS.ink }}>Readiness Score</span>
                      <Badge style={{ background:readiness.readinessLevel==='Ready'?DS.success:readiness.readinessLevel==='Conditional'?DS.warning:DS.danger, color:'#fff', border:'none' }}>{readiness.readinessLevel}</Badge>
                    </div>
                    {readiness.recommendation && <p className="text-xs" style={{ color:DS.inkSub }}>{readiness.recommendation}</p>}
                  </div>
                </div>
              )}
              {readiness.peakRiskPeriod && <div className="p-3 rounded-xl" style={{ background:DS.warnSoft }}><div className="text-[9px] font-bold uppercase mb-0.5" style={{ color:DS.warning }}>PEAK RISK PERIOD</div><p className="text-xs" style={{ color:DS.inkSub }}>{readiness.peakRiskPeriod}</p></div>}
              {readiness.criticalPath && <div className="p-3 rounded-xl" style={{ background:DS.bg, border:`1px solid ${DS.borderLight}` }}><div className="text-[9px] font-bold uppercase mb-0.5" style={{ color:DS.inkDis }}>CRITICAL PATH</div><p className="text-xs" style={{ color:DS.inkSub }}>{readiness.criticalPath}</p></div>}
              {readiness.lastResponsibleMoment && <div className="p-3 rounded-xl" style={{ background:DS.dangerSoft, border:`1px solid ${DS.danger}20` }}><div className="text-[9px] font-bold uppercase mb-0.5" style={{ color:DS.danger }}>LAST RESPONSIBLE MOMENT</div><p className="text-xs" style={{ color:DS.inkSub }}>{readiness.lastResponsibleMoment}</p></div>}
              {(readiness.blockers||[]).length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color:DS.inkDis }}>BLOCKERS</div>
                  {readiness.blockers.map((b:string,i:number)=>(
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background:DS.dangerSoft }}>
                      <AlertTriangle size={11} style={{ color:DS.danger,flexShrink:0,marginTop:1 }} />
                      <p className="text-[10px]" style={{ color:DS.inkSub }}>{b}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* === RISK SUMMARY TAB === */}
      {activeTab === 'summary' && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {['Critical','High','Medium','Low'].map(imp=>{
              const count = risks.filter(r=>r.impact===imp).length;
              const ic = IMPACT_COLORS[imp];
              return (
                <div key={imp} className="text-center p-3 rounded-xl" style={{ background:ic.soft }}>
                  <div className="text-2xl font-black" style={{ color:ic.color }}>{count}</div>
                  <div className="text-[9px] font-bold uppercase" style={{ color:ic.color }}>{imp}</div>
                </div>
              );
            })}
          </div>
          {noMitCount > 0 && <div className="p-3 rounded-xl" style={{ background:DS.warnSoft }}><p className="text-xs" style={{ color:DS.warning }}>⚠ {noMitCount} risk{noMitCount>1?'s':''} without a mitigation action — assign owners before commitment.</p></div>}
          <div className="space-y-2">
            {risks.sort((a,b)=>(['Critical','High','Medium','Low'].indexOf(a.impact))-(['Critical','High','Medium','Low'].indexOf(b.impact))).map(r=>{
              const ic = IMPACT_COLORS[r.impact]||IMPACT_COLORS.Medium;
              return (
                <div key={r.id} className="flex items-start gap-2 p-3 rounded-xl" style={{ background:DS.canvas, border:`1px solid ${DS.borderLight}`, borderLeft:`3px solid ${ic.color}` }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium" style={{ color:DS.ink }}>{r.label}</span>
                      <Badge style={{ background:ic.soft, color:ic.color, border:'none', fontSize:8 }}>{r.impact}</Badge>
                      {r.timeframe&&<span className="text-[9px]" style={{ color:DS.inkDis }}>{r.timeframe}</span>}
                    </div>
                    {r.mitigation ? <p className="text-[10px]" style={{ color:DS.inkSub }}>→ {r.mitigation}</p> : <p className="text-[9px]" style={{ color:DS.danger }}>No mitigation defined</p>}
                  </div>
                  {r.owner&&<span className="text-[9px] shrink-0" style={{ color:DS.inkDis }}>{r.owner}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom stats */}
      <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: DS.inkDis }}>
          <span>{risks.length} risks</span><span>·</span>
          <span style={{ color:critCount>0?DS.danger:DS.inkDis }}>{critCount} critical</span><span>·</span>
          <span style={{ color:noMitCount>0?DS.warning:DS.inkDis }}>{noMitCount} without mitigation</span>
        </div>
      </div>
    </div>
  );
}

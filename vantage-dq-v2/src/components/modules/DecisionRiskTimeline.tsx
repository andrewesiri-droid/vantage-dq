import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import { Sparkles, Target, CheckCircle2, ChevronDown, AlertTriangle, Clock } from 'lucide-react';
import type { ValidatedProblemFrame } from '@/lib/dq/problemFrameSchema';

interface Props {
  acceptedItems?: any[];
  sessionData?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
  onValidated?: (output: any) => void;
}

type RiskTiming = 'immediate'|'near_term'|'medium_term'|'long_term';
type RiskSeverity = 'critical'|'high'|'medium'|'low';
type RiskStatus = 'open'|'mitigated'|'accepted'|'monitoring';

interface Risk {
  id: string;
  title: string;
  description: string;
  cause: string;
  impact: string;
  timing: RiskTiming;
  severity: RiskSeverity;
  likelihood: 1|2|3|4|5;
  consequence: 1|2|3|4|5;
  mitigation: string;
  owner: string;
  lastResponsibleMoment: string;
  linkedStrategy?: string;
  status: RiskStatus;
  source: 'ai'|'user';
}

const TIMING_META: Record<RiskTiming,{label:string;color:string;bg:string;days:string}> = {
  immediate:   {label:'Immediate',  color:'#DC2626',bg:'#FEF2F2',days:'0-30 days'},
  near_term:   {label:'Near Term',  color:'#EA580C',bg:'#FFF7ED',days:'1-3 months'},
  medium_term: {label:'Medium Term',color:'#D97706',bg:'#FEF3C7',days:'3-12 months'},
  long_term:   {label:'Long Term',  color:'#1D4ED8',bg:'#EFF6FF',days:'12+ months'},
};

const SEV_META: Record<RiskSeverity,{label:string;color:string;bg:string}> = {
  critical:{label:'Critical',color:'#DC2626',bg:'#FEF2F2'},
  high:    {label:'High',    color:'#EA580C',bg:'#FFF7ED'},
  medium:  {label:'Medium',  color:'#D97706',bg:'#FEF3C7'},
  low:     {label:'Low',     color:'#059669',bg:'#ECFDF5'},
};

function safeArray(v:any):string[]{if(Array.isArray(v))return v;if(typeof v==='string'&&v.trim())return v.split('\n').filter(Boolean);return[];}
function getFrame(sd:any,ai:any[]):ValidatedProblemFrame|null{const raw=sd?.problemFrame??ai?.find((i:any)=>i.targetType==='problem_frame')?.data??null;if(!raw)return null;return{decisionStatement:raw.decisionStatement??'',context:raw.context??'',background:raw.background??'',trigger:raw.trigger??'',scopeIn:safeArray(raw.scopeIn),scopeOut:safeArray(raw.scopeOut),constraints:safeArray(raw.constraints),assumptions:safeArray(raw.assumptions),successCriteria:safeArray(raw.successCriteria),failureConsequences:raw.failureConsequences??''};}
async function callAI(prompt:string):Promise<any>{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':import.meta.env.VITE_ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4000,temperature:0,system:'You are a DQ risk analyst. Risks are future events with consequences — not uncertainties. Respond ONLY with valid JSON.',messages:[{role:'user',content:prompt}]})});if(!r.ok)throw new Error(`API error ${r.status}`);const d=await r.json();const raw=d.content?.find((b:any)=>b.type==='text')?.text??'';return JSON.parse(raw.replace(/```json|```/g,'').trim());}
function makeId(){return`risk_${Math.random().toString(36).slice(2,9)}`;}

export default function DecisionRiskTimeline({acceptedItems,sessionData,persistedState,onPersistState,onValidated}:Props){
  const [risks,setRisks]=useState<Risk[]>(()=>persistedState?.risks??[]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [filter,setFilter]=useState<RiskTiming|'all'>('all');

  const frame=useMemo(()=>getFrame(sessionData,acceptedItems??[]),[sessionData,acceptedItems]);
  const strategies=useMemo(()=>sessionData?.strategies??persistedState?.strategies??[],[sessionData,persistedState]);

  useEffect(()=>{onPersistState?.({risks});},[risks]);

  const displayed=useMemo(()=>filter==='all'?risks:risks.filter(r=>r.timing===filter),[risks,filter]);
  const critical=risks.filter(r=>r.severity==='critical'||r.severity==='high');

  const handleGenerate=useCallback(async()=>{
    if(!frame){setError('Problem Frame not found.');return;}
    setLoading(true);setError(null);
    const strats=strategies.map((s:any)=>s.name).join(', ')||'Not defined';
    const raisedRisks=sessionData?.issueItems?.filter((i:any)=>i.classification==='risk').map((i:any)=>i.title).join('\n')||'None captured';
    const prompt=`You are a DQ risk analyst. Identify decision risks with timing and mitigation.

DECISION: ${frame.decisionStatement}
TRIGGER: ${frame.trigger}
CONSTRAINTS: ${frame.constraints.join(', ')||'None'}
STRATEGIES BEING CONSIDERED: ${strats}
FAILURE CONSEQUENCES: ${frame.failureConsequences||'Not stated'}

RISKS ALREADY RAISED IN ISSUE RAISING:
${raisedRisks}

Generate 6-10 decision risks. 

IMPORTANT DISTINCTIONS:
- Risks are future events/conditions with consequences — NOT uncertainties
- Risks have a timing dimension (when they could occur)
- Risks have a last responsible moment (when you must act)
- Include both execution risks and strategic risks

Risk timing:
- immediate: 0-30 days
- near_term: 1-3 months
- medium_term: 3-12 months
- long_term: 12+ months

Return ONLY valid JSON:
{
  "risks": [
    {
      "title": "Risk title",
      "description": "What could happen",
      "cause": "Root cause",
      "impact": "Consequence if it occurs",
      "timing": "immediate|near_term|medium_term|long_term",
      "severity": "critical|high|medium|low",
      "likelihood": 3,
      "consequence": 4,
      "mitigation": "How to reduce likelihood or impact",
      "owner": "Who should own this risk",
      "lastResponsibleMoment": "When must you act to prevent it",
      "linkedStrategy": "strategy name or null"
    }
  ]
}`;
    try{
      const r=await callAI(prompt);
      setRisks((r.risks??[]).map((risk:any)=>({id:makeId(),...risk,status:'open'as const,source:'ai'as const})));
    }catch(e:any){setError(e.message);}
    finally{setLoading(false);}
  },[frame,sessionData,strategies]);

  const updateStatus=(id:string,status:RiskStatus)=>{setRisks(p=>p.map(r=>r.id===id?{...r,status}:r));};

  const timingCounts=Object.keys(TIMING_META).reduce((acc,k)=>{acc[k]=risks.filter(r=>r.timing===k).length;return acc;},{} as Record<string,number>);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden" style={{background:DS.bg}}>
      {frame?.decisionStatement&&<div className="shrink-0 px-6 py-3 flex items-start gap-3" style={{background:DS.accentLight,borderBottom:`1px solid ${DS.accent}30`}}><Target size={14} style={{color:DS.accent,marginTop:3,flexShrink:0}}/><div className="flex-1 min-w-0"><p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{color:DS.accent}}>Decision</p><p className="text-sm font-semibold" style={{color:DS.ink,lineHeight:'1.4'}}>{frame.decisionStatement}</p></div></div>}

      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 flex-wrap" style={{background:DS.surface,borderBottom:`1px solid ${DS.border}`}}>
        <button onClick={handleGenerate} disabled={loading||!frame} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold" style={{background:loading?DS.surfaceAlt:DS.accent,color:loading?DS.inkTer:'#fff'}}>
          <Sparkles size={12}/> {loading?'Analyzing…':'Generate Risk Timeline'}
        </button>
        <div className="flex-1"/>
        <div className="flex items-center gap-1.5">
          {(['all',...Object.keys(TIMING_META)] as (RiskTiming|'all')[]).map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className="px-2 py-1 rounded-full text-xs font-medium"
              style={{background:filter===f?DS.accent:DS.surfaceAlt,color:filter===f?'#fff':DS.inkTer}}>
              {f==='all'?`All (${risks.length})`:`${TIMING_META[f as RiskTiming].label} (${timingCounts[f]??0})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error&&<div className="rounded-xl p-3" style={{background:'#FEE2E2',border:'1px solid #FCA5A5'}}><p className="text-xs font-semibold" style={{color:'#DC2626'}}>Error: {error}</p></div>}
          {loading&&<div className="flex flex-col items-center justify-center py-20 gap-3"><motion.div className="w-8 h-8 rounded-full border-2" style={{borderColor:DS.accent,borderTopColor:'transparent'}} animate={{rotate:360}} transition={{repeat:Infinity,duration:0.8,ease:'linear'}}/><p className="text-sm" style={{color:DS.inkTer}}>Building risk timeline…</p></div>}

          {!loading&&critical.length>0&&<div className="rounded-xl p-3 flex items-start gap-2" style={{background:'#FEF2F2',border:'1px solid #FCA5A5'}}><AlertTriangle size={14} style={{color:'#DC2626',flexShrink:0,marginTop:1}}/><p className="text-xs font-semibold" style={{color:'#DC2626'}}>{critical.length} critical/high risk{critical.length>1?'s':''} require immediate attention</p></div>}

          {!loading&&displayed.length===0&&<div className="flex flex-col items-center justify-center py-20 gap-3"><div className="text-5xl">⏱️</div><p className="text-sm font-semibold" style={{color:DS.inkTer}}>No risks yet</p><p className="text-xs text-center max-w-xs" style={{color:DS.inkFaint}}>Identify decision risks plotted on a timeline showing when they peak and when you must act.</p></div>}

          {!loading&&displayed.map(risk=>{
            const tm=TIMING_META[risk.timing];
            const sm=SEV_META[risk.severity];
            const isExp=expanded===risk.id;
            const riskScore=risk.likelihood*risk.consequence;
            return (
              <div key={risk.id} className="rounded-xl overflow-hidden" style={{border:`1.5px solid ${sm.color}30`,background:DS.surface,opacity:risk.status==='accepted'||risk.status==='mitigated'?0.7:1}}>
                <div className="flex items-start gap-3 px-4 py-3 cursor-pointer" onClick={()=>setExpanded(isExp?null:risk.id)}>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold" style={{background:sm.bg,color:sm.color}}>{riskScore}</div>
                    <span className="text-xs" style={{color:DS.inkFaint}}>score</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{background:sm.bg,color:sm.color}}>{sm.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{background:tm.bg,color:tm.color}}><Clock size={9}/>{tm.label} · {tm.days}</span>
                      {risk.source==='ai'&&<span className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{background:DS.accentLight,color:DS.accent,fontSize:10}}><Sparkles size={8}/>AI</span>}
                      {risk.status!=='open'&&<span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{background:DS.surfaceAlt,color:DS.inkTer}}>{risk.status}</span>}
                    </div>
                    <p className="text-sm font-medium" style={{color:DS.ink}}>{risk.title}</p>
                    <p className="text-xs mt-0.5" style={{color:DS.inkTer}}>{risk.impact}</p>
                  </div>
                  <motion.div animate={{rotate:isExp?180:0}} transition={{duration:0.2}}><ChevronDown size={16} style={{color:DS.inkTer}}/></motion.div>
                </div>
                <AnimatePresence>{isExp&&<motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}} style={{overflow:'hidden'}}>
                  <div className="px-4 pb-4 pt-3 space-y-3" style={{borderTop:`1px solid ${DS.border}`}}>
                    <div className="grid grid-cols-2 gap-3">
                      {risk.cause&&<div><p className="text-xs font-bold mb-1" style={{color:DS.inkTer}}>Root Cause</p><p className="text-xs" style={{color:DS.inkTer}}>{risk.cause}</p></div>}
                      <div><p className="text-xs font-bold mb-1" style={{color:DS.inkTer}}>Impact</p><p className="text-xs" style={{color:DS.inkTer}}>{risk.impact}</p></div>
                    </div>
                    {risk.mitigation&&<div className="p-3 rounded-lg" style={{background:'#EFF6FF'}}><p className="text-xs font-bold mb-1" style={{color:'#1D4ED8'}}>🛡️ Mitigation</p><p className="text-xs" style={{color:DS.ink}}>{risk.mitigation}</p></div>}
                    <div className="grid grid-cols-2 gap-3">
                      {risk.owner&&<div><p className="text-xs font-bold mb-1" style={{color:DS.inkTer}}>Owner</p><p className="text-xs" style={{color:DS.ink}}>{risk.owner}</p></div>}
                      {risk.lastResponsibleMoment&&<div><p className="text-xs font-bold mb-1" style={{color:'#DC2626'}}>⏰ Last Responsible Moment</p><p className="text-xs" style={{color:DS.ink}}>{risk.lastResponsibleMoment}</p></div>}
                    </div>
                    <div className="flex gap-2">
                      {(['open','mitigated','accepted','monitoring'] as RiskStatus[]).map(s=>(
                        <button key={s} onClick={()=>updateStatus(risk.id,s)} className="px-2 py-1 rounded-lg text-xs font-medium capitalize" style={{background:risk.status===s?DS.accent:DS.surfaceAlt,color:risk.status===s?'#fff':DS.inkTer}}>{s}</button>
                      ))}
                    </div>
                  </div>
                </motion.div>}</AnimatePresence>
              </div>
            );
          })}

          {risks.length>0&&<div className="mt-4 rounded-xl p-4" style={{background:DS.surfaceAlt,border:`1px solid ${DS.border}`}}>
            <motion.button initial={{opacity:0}} animate={{opacity:1}} onClick={()=>onValidated?.({risks})}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
              style={{background:DS.accent,color:'#fff',boxShadow:`0 4px 14px ${DS.accent}40`}}>
              <CheckCircle2 size={16}/> Complete Risk Timeline
            </motion.button>
          </div>}
        </div>

        <div className="w-52 shrink-0 hidden lg:flex flex-col gap-3 p-4 overflow-y-auto" style={{borderLeft:`1px solid ${DS.border}`,background:DS.surface}}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{color:DS.inkTer}}>Risk Summary</p>
          {Object.entries(TIMING_META).map(([k,v])=>(
            <div key={k} className="flex items-center gap-2 p-2 rounded-lg" style={{background:v.bg+'60'}}>
              <div className="w-2 h-2 rounded-full" style={{background:v.color}}/>
              <span className="text-xs flex-1" style={{color:v.color}}>{v.label}</span>
              <span className="text-xs font-bold" style={{color:(timingCounts[k]??0)>0?v.color:DS.inkFaint}}>{timingCounts[k]??0}</span>
            </div>
          ))}
          {critical.length>0&&<div className="rounded-xl p-3 mt-2" style={{background:'#FEF2F2',border:'1px solid #FCA5A5'}}>
            <p className="text-xs font-semibold mb-1" style={{color:'#DC2626'}}>⚠️ Critical Risks</p>
            {critical.slice(0,3).map(r=><p key={r.id} className="text-xs mb-0.5 truncate" style={{color:'#7F1D1D'}}>· {r.title}</p>)}
          </div>}
        </div>
      </div>
    </div>
  );
}

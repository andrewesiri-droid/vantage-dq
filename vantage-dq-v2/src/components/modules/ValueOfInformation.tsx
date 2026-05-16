import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import { Sparkles, Target, CheckCircle2, ChevronDown, Info } from 'lucide-react';
import type { ValidatedProblemFrame } from '@/lib/dq/problemFrameSchema';

interface Props {
  acceptedItems?: any[];
  sessionData?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
  onValidated?: (output: any) => void;
}

interface VOIItem {
  id: string;
  uncertainty: string;
  category: string;
  canChangeStrategy: boolean;
  decisionImpact: 1|2|3|4|5;
  informationCost: 'low'|'medium'|'high';
  timeToResolve: string;
  studyOption: string;
  voiScore: number;
  recommendation: 'study_now'|'study_if_time'|'decide_now'|'monitor';
  rationale: string;
  source: 'ai'|'user';
}

const REC_META: Record<string, {label:string;color:string;bg:string;icon:string}> = {
  study_now:      {label:'Study Now',        color:'#059669',bg:'#DCFCE7',icon:'🔬'},
  study_if_time:  {label:'Study If Time',    color:'#D97706',bg:'#FEF3C7',icon:'⏳'},
  decide_now:     {label:'Decide Now',       color:'#1D4ED8',bg:'#EFF6FF',icon:'✅'},
  monitor:        {label:'Monitor',          color:'#7C3AED',bg:'#F5F3FF',icon:'👁️'},
};

function safeArray(v:any):string[]{if(Array.isArray(v))return v;if(typeof v==='string'&&v.trim())return v.split('\n').filter(Boolean);return[];}
function getFrame(sd:any,ai:any[]):ValidatedProblemFrame|null{const raw=sd?.problemFrame??ai?.find((i:any)=>i.targetType==='problem_frame')?.data??null;if(!raw)return null;return{decisionStatement:raw.decisionStatement??'',context:raw.context??'',background:raw.background??'',trigger:raw.trigger??'',scopeIn:safeArray(raw.scopeIn),scopeOut:safeArray(raw.scopeOut),constraints:safeArray(raw.constraints),assumptions:safeArray(raw.assumptions),successCriteria:safeArray(raw.successCriteria),failureConsequences:raw.failureConsequences??''};}
async function callAI(prompt:string):Promise<any>{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':import.meta.env.VITE_ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4000,temperature:0,system:'You are a DQ Value of Information analyst. Respond ONLY with valid JSON.',messages:[{role:'user',content:prompt}]})});if(!r.ok)throw new Error(`API error ${r.status}`);const d=await r.json();const raw=d.content?.find((b:any)=>b.type==='text')?.text??'';return JSON.parse(raw.replace(/```json|```/g,'').trim());}
function makeId(){return`voi_${Math.random().toString(36).slice(2,9)}`;}

export default function ValueOfInformation({acceptedItems,sessionData,persistedState,onPersistState,onValidated}:Props){
  const [items,setItems]=useState<VOIItem[]>(()=>persistedState?.items??[]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [summary,setSummary]=useState(persistedState?.summary??'');

  const frame=useMemo(()=>getFrame(sessionData,acceptedItems??[]),[sessionData,acceptedItems]);
  const strategies=useMemo(()=>sessionData?.strategies??persistedState?.strategies??[],[sessionData,persistedState]);

  useEffect(()=>{onPersistState?.({items,summary});},[items,summary]);

  const sorted=useMemo(()=>[...items].sort((a,b)=>b.voiScore-a.voiScore),[items]);
  const studyNow=sorted.filter(i=>i.recommendation==='study_now');
  const decideNow=sorted.filter(i=>i.recommendation==='decide_now');

  const handleAnalyze=useCallback(async()=>{
    if(!frame){setError('Problem Frame not found.');return;}
    setLoading(true);setError(null);
    const unc=sessionData?.structuringOutput?.criticalUncertainties?.map((u:any)=>u.title).join('\n')||'Not identified';
    const strats=strategies.map((s:any)=>s.name).join(', ')||'Not yet defined';
    const prompt=`You are a DQ analyst. Assess the Value of Information for each key uncertainty.

DECISION: ${frame.decisionStatement}
TRIGGER: ${frame.trigger}
DEADLINE PRESSURE: ${frame.trigger}

KEY UNCERTAINTIES:
${unc}

STRATEGIES BEING CONSIDERED: ${strats}

For each uncertainty, assess:
1. Can resolving this change which strategy we prefer? (canChangeStrategy)
2. How much does it impact the decision? (decisionImpact 1-5)
3. How costly/difficult is the information to get? (informationCost: low/medium/high)
4. How long would it take to resolve? (timeToResolve: e.g. "2 weeks", "6 months")
5. What study or action could resolve it? (studyOption)
6. VOI Score (0-100): how valuable is this information? High = resolves decision-changing uncertainty cheaply and quickly
7. Recommendation: study_now|study_if_time|decide_now|monitor

RULES:
- If resolving uncertainty WON'T change strategy → decide_now, low VOI
- If resolving uncertainty is too expensive or slow relative to deadline → decide_now
- If resolving uncertainty IS cheap, fast, and decision-changing → study_now
- "Nice to know" ≠ high VOI. Focus on decision impact only.

Return ONLY valid JSON:
{
  "items": [
    {
      "uncertainty": "uncertainty description",
      "category": "technical|commercial|regulatory|stakeholder|financial",
      "canChangeStrategy": true,
      "decisionImpact": 4,
      "informationCost": "medium",
      "timeToResolve": "3 weeks",
      "studyOption": "what study or action would resolve this",
      "voiScore": 75,
      "recommendation": "study_now",
      "rationale": "why this recommendation"
    }
  ],
  "summary": "2-3 sentence overall VOI recommendation"
}`;
    try{
      const r=await callAI(prompt);
      setItems((r.items??[]).map((item:any)=>({id:makeId(),...item,source:'ai'as const})));
      setSummary(r.summary??'');
    }catch(e:any){setError(e.message);}
    finally{setLoading(false);}
  },[frame,sessionData,strategies]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden" style={{background:DS.bg}}>
      {frame?.decisionStatement&&<div className="shrink-0 px-6 py-3 flex items-start gap-3" style={{background:DS.accentLight,borderBottom:`1px solid ${DS.accent}30`}}><Target size={14} style={{color:DS.accent,marginTop:3,flexShrink:0}}/><div className="flex-1 min-w-0"><p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{color:DS.accent}}>Decision</p><p className="text-sm font-semibold" style={{color:DS.ink,lineHeight:'1.4'}}>{frame.decisionStatement}</p></div></div>}

      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5" style={{background:DS.surface,borderBottom:`1px solid ${DS.border}`}}>
        <button onClick={handleAnalyze} disabled={loading||!frame} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold" style={{background:loading?DS.surfaceAlt:DS.accent,color:loading?DS.inkTer:'#fff'}}>
          <Sparkles size={12}/> {loading?'Analyzing…':'Run VOI Analysis'}
        </button>
        <div className="flex-1"/>
        {items.length>0&&<div className="flex items-center gap-3">
          <span className="text-xs px-2 py-1 rounded-full font-medium" style={{background:'#DCFCE7',color:'#059669'}}>{studyNow.length} study now</span>
          <span className="text-xs px-2 py-1 rounded-full font-medium" style={{background:'#EFF6FF',color:'#1D4ED8'}}>{decideNow.length} decide now</span>
        </div>}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error&&<div className="rounded-xl p-3" style={{background:'#FEE2E2',border:'1px solid #FCA5A5'}}><p className="text-xs font-semibold" style={{color:'#DC2626'}}>Error: {error}</p></div>}
          {loading&&<div className="flex flex-col items-center justify-center py-20 gap-3"><motion.div className="w-8 h-8 rounded-full border-2" style={{borderColor:DS.accent,borderTopColor:'transparent'}} animate={{rotate:360}} transition={{repeat:Infinity,duration:0.8,ease:'linear'}}/><p className="text-sm" style={{color:DS.inkTer}}>Assessing value of information…</p></div>}

          {!loading&&items.length===0&&<div className="flex flex-col items-center justify-center py-20 gap-3"><div className="text-5xl">💡</div><p className="text-sm font-semibold" style={{color:DS.inkTer}}>No VOI analysis yet</p><p className="text-xs text-center max-w-xs" style={{color:DS.inkFaint}}>Determine which uncertainties are worth resolving before deciding, and which ones don't change the answer.</p></div>}

          {!loading&&summary&&<div className="rounded-xl p-4" style={{background:DS.accentLight,border:`1px solid ${DS.accent}30`}}><p className="text-xs font-bold mb-1.5" style={{color:DS.accent}}>💡 VOI Summary</p><p className="text-sm" style={{color:DS.ink,lineHeight:'1.6'}}>{summary}</p></div>}

          {!loading&&sorted.map(item=>{
            const rm=REC_META[item.recommendation]??REC_META.monitor;
            const isExp=expanded===item.id;
            return (
              <div key={item.id} className="rounded-xl overflow-hidden" style={{border:`1.5px solid ${rm.color}30`,background:DS.surface}}>
                <div className="flex items-start gap-3 px-4 py-3 cursor-pointer" onClick={()=>setExpanded(isExp?null:item.id)}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:rm.bg}}>
                    <span className="text-xl">{rm.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{background:rm.bg,color:rm.color}}>{rm.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{background:DS.surfaceAlt,color:DS.inkTer}}>VOI: {item.voiScore}</span>
                      {item.canChangeStrategy&&<span className="text-xs px-2 py-0.5 rounded-full" style={{background:'#FEF2F2',color:'#DC2626'}}>⚡ Strategy-changing</span>}
                    </div>
                    <p className="text-sm font-medium" style={{color:DS.ink}}>{item.uncertainty}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{background:DS.border}}>
                      <motion.div className="h-full rounded-full" style={{background:rm.color}} initial={{width:0}} animate={{width:`${item.voiScore}%`}} transition={{duration:0.6}}/>
                    </div>
                    <motion.div animate={{rotate:isExp?180:0}} transition={{duration:0.2}}><ChevronDown size={14} style={{color:DS.inkTer}}/></motion.div>
                  </div>
                </div>
                <AnimatePresence>{isExp&&<motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}} style={{overflow:'hidden'}}>
                  <div className="px-4 pb-4 pt-3 space-y-3" style={{borderTop:`1px solid ${DS.border}`}}>
                    <div className="grid grid-cols-3 gap-3">
                      {[{label:'Decision Impact',val:`${item.decisionImpact}/5`},{label:'Info Cost',val:item.informationCost},{label:'Time to Resolve',val:item.timeToResolve}].map(s=>(
                        <div key={s.label} className="text-center p-2 rounded-lg" style={{background:DS.surfaceAlt}}><p className="text-xs font-semibold" style={{color:DS.ink}}>{s.val}</p><p className="text-xs" style={{color:DS.inkTer}}>{s.label}</p></div>
                      ))}
                    </div>
                    {item.studyOption&&<div className="p-3 rounded-lg" style={{background:DS.accentLight}}><p className="text-xs font-bold mb-1" style={{color:DS.accent}}>📋 Study Option</p><p className="text-xs" style={{color:DS.ink}}>{item.studyOption}</p></div>}
                    <p className="text-xs italic" style={{color:DS.inkFaint}}>Rationale: {item.rationale}</p>
                  </div>
                </motion.div>}</AnimatePresence>
              </div>
            );
          })}

          {items.length>0&&<div className="mt-4 rounded-xl p-4" style={{background:DS.surfaceAlt,border:`1px solid ${DS.border}`}}>
            <motion.button initial={{opacity:0}} animate={{opacity:1}} onClick={()=>onValidated?.({items,summary})}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
              style={{background:DS.accent,color:'#fff',boxShadow:`0 4px 14px ${DS.accent}40`}}>
              <CheckCircle2 size={16}/> Complete VOI Analysis
            </motion.button>
          </div>}
        </div>

        <div className="w-52 shrink-0 hidden lg:flex flex-col gap-3 p-4 overflow-y-auto" style={{borderLeft:`1px solid ${DS.border}`,background:DS.surface}}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{color:DS.inkTer}}>VOI Priority</p>
          {sorted.slice(0,6).map((item,i)=>{
            const rm=REC_META[item.recommendation]??REC_META.monitor;
            return <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg" style={{background:rm.bg+'40'}}>
              <span className="text-sm">{rm.icon}</span>
              <div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate" style={{color:DS.ink}}>{item.uncertainty.slice(0,40)}…</p></div>
              <span className="text-xs font-bold flex-shrink-0" style={{color:rm.color}}>{item.voiScore}</span>
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}

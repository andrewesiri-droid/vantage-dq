import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
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

type NodeType = 'decision'|'uncertainty'|'value'|'calculation'|'external';

interface DiagramNode {
  id: string;
  type: NodeType;
  label: string;
  description: string;
  x: number;
  y: number;
}

interface DiagramEdge {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
}

const NODE_META: Record<NodeType,{label:string;color:string;bg:string;shape:string;icon:string}> = {
  decision:    {label:'Decision',    color:'#4F6AF5',bg:'#EEF2FF',shape:'rect',  icon:'⬛'},
  uncertainty: {label:'Uncertainty', color:'#D97706',bg:'#FEF3C7',shape:'circle',icon:'⬤'},
  value:       {label:'Value',       color:'#059669',bg:'#DCFCE7',shape:'diamond',icon:'◆'},
  calculation: {label:'Calculation', color:'#7C3AED',bg:'#F5F3FF',shape:'rect',  icon:'⬛'},
  external:    {label:'External',    color:'#64748B',bg:'#F8FAFC',shape:'circle',icon:'⬤'},
};

function safeArray(v:any):string[]{if(Array.isArray(v))return v;if(typeof v==='string'&&v.trim())return v.split('\n').filter(Boolean);return[];}
function getFrame(sd:any,ai:any[]):ValidatedProblemFrame|null{const raw=sd?.problemFrame??ai?.find((i:any)=>i.targetType==='problem_frame')?.data??null;if(!raw)return null;return{decisionStatement:raw.decisionStatement??'',context:raw.context??'',background:raw.background??'',trigger:raw.trigger??'',scopeIn:safeArray(raw.scopeIn),scopeOut:safeArray(raw.scopeOut),constraints:safeArray(raw.constraints),assumptions:safeArray(raw.assumptions),successCriteria:safeArray(raw.successCriteria),failureConsequences:raw.failureConsequences??''};}
async function callAI(prompt:string):Promise<any>{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':import.meta.env.VITE_ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:4000,temperature:0,system:'You are a DQ influence diagram analyst. Build clear, logical influence diagrams. Respond ONLY with valid JSON.',messages:[{role:'user',content:prompt}]})});if(!r.ok)throw new Error(`API error ${r.status}`);const d=await r.json();const raw=d.content?.find((b:any)=>b.type==='text')?.text??'';return JSON.parse(raw.replace(/```json|```/g,'').trim());}
function makeId(){return`nd_${Math.random().toString(36).slice(2,9)}`;}

function InfluenceDiagramSVG({nodes,edges,onNodeClick,selectedNode}:{nodes:DiagramNode[];edges:DiagramEdge[];onNodeClick:(n:DiagramNode)=>void;selectedNode:string|null}){
  const W=700,H=450;
  const getCenter=(n:DiagramNode)=>({x:n.x,y:n.y});

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{background:DS.surfaceAlt,borderRadius:12,border:`1px solid ${DS.border}`}}>
      {/* Arrow marker */}
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={DS.inkTer} />
        </marker>
      </defs>

      {/* Edges */}
      {edges.map(edge=>{
        const from=nodes.find(n=>n.id===edge.fromId);
        const to=nodes.find(n=>n.id===edge.toId);
        if(!from||!to)return null;
        const fc=getCenter(from),tc=getCenter(to);
        const dx=tc.x-fc.x,dy=tc.y-fc.y;
        const len=Math.sqrt(dx*dx+dy*dy);
        const offset=30;
        const ex=tc.x-(dx/len)*offset,ey=tc.y-(dy/len)*offset;
        return (
          <g key={edge.id}>
            <line x1={fc.x} y1={fc.y} x2={ex} y2={ey} stroke={DS.border} strokeWidth="1.5" markerEnd="url(#arrowhead)"/>
            {edge.label&&<text x={(fc.x+tc.x)/2} y={(fc.y+tc.y)/2-6} textAnchor="middle" fontSize="9" fill={DS.inkFaint}>{edge.label}</text>}
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map(node=>{
        const meta=NODE_META[node.type];
        const isSelected=selectedNode===node.id;
        const strokeColor=isSelected?meta.color:DS.border;
        const strokeWidth=isSelected?2.5:1.5;

        return (
          <g key={node.id} onClick={()=>onNodeClick(node)} style={{cursor:'pointer'}}>
            {node.type==='decision'||node.type==='calculation'
              ? <rect x={node.x-50} y={node.y-20} width={100} height={40} rx={6} fill={meta.bg} stroke={strokeColor} strokeWidth={strokeWidth}/>
              : node.type==='value'
              ? <polygon points={`${node.x},${node.y-24} ${node.x+48},${node.y} ${node.x},${node.y+24} ${node.x-48},${node.y}`} fill={meta.bg} stroke={strokeColor} strokeWidth={strokeWidth}/>
              : <circle cx={node.x} cy={node.y} r={28} fill={meta.bg} stroke={strokeColor} strokeWidth={strokeWidth}/>
            }
            <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="600" fill={meta.color} style={{pointerEvents:'none'}}>
              {node.label.length>16?node.label.slice(0,14)+'…':node.label}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {Object.entries(NODE_META).map(([type,meta],i)=>(
        <g key={type} transform={`translate(${10+i*130},${H-20})`}>
          <circle cx={6} cy={0} r={5} fill={meta.bg} stroke={meta.color} strokeWidth={1.5}/>
          <text x={14} y={4} fontSize="9" fill={DS.inkTer}>{meta.label}</text>
        </g>
      ))}
    </svg>
  );
}

export default function InfluenceDiagram({acceptedItems,sessionData,persistedState,onPersistState,onValidated}:Props){
  const [nodes,setNodes]=useState<DiagramNode[]>(()=>persistedState?.nodes??[]);
  const [edges,setEdges]=useState<DiagramEdge[]>(()=>persistedState?.edges??[]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [selectedNode,setSelectedNode]=useState<string|null>(null);

  const frame=useMemo(()=>getFrame(sessionData,acceptedItems??[]),[sessionData,acceptedItems]);
  const strategies=useMemo(()=>sessionData?.strategies??persistedState?.strategies??[],[sessionData,persistedState]);

  useEffect(()=>{onPersistState?.({nodes,edges});},[nodes,edges]);

  const selected=nodes.find(n=>n.id===selectedNode);

  const handleGenerate=useCallback(async()=>{
    if(!frame){setError('Problem Frame not found.');return;}
    setLoading(true);setError(null);
    const unc=sessionData?.structuringOutput?.criticalUncertainties?.map((u:any)=>u.title).join('\n')||'Not identified';
    const crit=sessionData?.structuringOutput?.criteria?.map((c:any)=>c.title).join('\n')||frame.successCriteria.join('\n')||'Not defined';
    const focusDec=sessionData?.structuringOutput?.focusDecisions?.map((d:any)=>d.title).join('\n')||'Not structured';
    const strats=strategies.map((s:any)=>s.name).join(', ')||'Not defined';

    const prompt=`Build an influence diagram for this decision.

DECISION: ${frame.decisionStatement}
FOCUS DECISIONS:\n${focusDec}
STRATEGIES: ${strats}
KEY UNCERTAINTIES:\n${unc}
VALUE CRITERIA:\n${crit}

Build an influence diagram with:
- Decision nodes (squares): the focus decisions
- Uncertainty nodes (circles): key uncertain variables
- Value nodes (diamonds): success criteria / value outcomes
- Calculation nodes: intermediate calculations linking variables to value
- External nodes: external factors outside our control

Arrange nodes logically left to right: decisions → calculations → value
Place external/uncertainty nodes around the main flow.

Use x coordinates 50-650, y coordinates 50-400.
Spread nodes to avoid overlap.

RULES:
- Every value node should connect to at least one decision or uncertainty
- Every strategy should appear as or connect to a decision node
- No circular dependencies
- Keep it clean — 8-15 nodes maximum

Return ONLY valid JSON:
{
  "nodes": [
    { "id": "n1", "type": "decision|uncertainty|value|calculation|external", "label": "Short label", "description": "What this node represents", "x": 100, "y": 200 }
  ],
  "edges": [
    { "id": "e1", "fromId": "n1", "toId": "n2", "label": "optional relationship label" }
  ]
}`;
    try{
      const r=await callAI(prompt);
      setNodes(r.nodes??[]);
      setEdges(r.edges??[]);
    }catch(e:any){setError(e.message);}
    finally{setLoading(false);}
  },[frame,sessionData,strategies]);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden" style={{background:DS.bg}}>
      {frame?.decisionStatement&&<div className="shrink-0 px-6 py-3 flex items-start gap-3" style={{background:DS.accentLight,borderBottom:`1px solid ${DS.accent}30`}}><Target size={14} style={{color:DS.accent,marginTop:3,flexShrink:0}}/><div className="flex-1 min-w-0"><p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{color:DS.accent}}>Decision</p><p className="text-sm font-semibold" style={{color:DS.ink,lineHeight:'1.4'}}>{frame.decisionStatement}</p></div></div>}

      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5" style={{background:DS.surface,borderBottom:`1px solid ${DS.border}`}}>
        <button onClick={handleGenerate} disabled={loading||!frame} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold" style={{background:loading?DS.surfaceAlt:DS.accent,color:loading?DS.inkTer:'#fff'}}>
          <Sparkles size={12}/> {loading?'Building…':'Build Influence Diagram'}
        </button>
        <div className="flex-1"/>
        {nodes.length>0&&<span className="text-xs px-2 py-1 rounded-full" style={{background:DS.surfaceAlt,color:DS.inkTer}}>{nodes.length} nodes · {edges.length} connections</span>}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error&&<div className="rounded-xl p-3" style={{background:'#FEE2E2',border:'1px solid #FCA5A5'}}><p className="text-xs font-semibold" style={{color:'#DC2626'}}>Error: {error}</p></div>}
          {loading&&<div className="flex flex-col items-center justify-center py-20 gap-3"><motion.div className="w-8 h-8 rounded-full border-2" style={{borderColor:DS.accent,borderTopColor:'transparent'}} animate={{rotate:360}} transition={{repeat:Infinity,duration:0.8,ease:'linear'}}/><p className="text-sm" style={{color:DS.inkTer}}>Building influence diagram…</p></div>}

          {!loading&&nodes.length===0&&<div className="flex flex-col items-center justify-center py-16 gap-3"><div className="text-5xl">🔗</div><p className="text-sm font-semibold" style={{color:DS.inkTer}}>No diagram yet</p><p className="text-xs text-center max-w-xs" style={{color:DS.inkFaint}}>Build a visual map showing how decisions, uncertainties, and value outcomes connect to each other.</p></div>}

          {!loading&&nodes.length>0&&(
            <>
              <InfluenceDiagramSVG nodes={nodes} edges={edges} onNodeClick={n=>setSelectedNode(n.id===selectedNode?null:n.id)} selectedNode={selectedNode}/>
              {selected&&(
                <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} className="rounded-xl p-4" style={{background:DS.surface,border:`2px solid ${NODE_META[selected.type].color}40`}}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{background:NODE_META[selected.type].bg,color:NODE_META[selected.type].color}}>{NODE_META[selected.type].label}</span>
                    <span className="text-sm font-bold" style={{color:DS.ink}}>{selected.label}</span>
                  </div>
                  <p className="text-sm" style={{color:DS.inkTer,lineHeight:'1.6'}}>{selected.description}</p>
                  <div className="mt-2">
                    <p className="text-xs font-semibold mb-1" style={{color:DS.inkTer}}>Connected to:</p>
                    {edges.filter(e=>e.fromId===selected.id||e.toId===selected.id).map(e=>{
                      const other=nodes.find(n=>n.id===(e.fromId===selected.id?e.toId:e.fromId));
                      const dir=e.fromId===selected.id?'→':'←';
                      return other?<p key={e.id} className="text-xs" style={{color:DS.inkTer}}>{dir} {other.label}</p>:null;
                    })}
                  </div>
                </motion.div>
              )}
              <div className="rounded-xl p-4" style={{background:DS.surfaceAlt,border:`1px solid ${DS.border}`}}>
                <motion.button initial={{opacity:0}} animate={{opacity:1}} onClick={()=>onValidated?.({nodes,edges})}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                  style={{background:DS.accent,color:'#fff',boxShadow:`0 4px 14px ${DS.accent}40`}}>
                  <CheckCircle2 size={16}/> Complete Influence Diagram
                </motion.button>
              </div>
            </>
          )}
        </div>

        {nodes.length>0&&<div className="w-52 shrink-0 hidden lg:flex flex-col gap-2 p-4 overflow-y-auto" style={{borderLeft:`1px solid ${DS.border}`,background:DS.surface}}>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{color:DS.inkTer}}>Node Types</p>
          {Object.entries(NODE_META).map(([type,meta])=>{
            const count=nodes.filter(n=>n.type===type).length;
            if(!count)return null;
            return <div key={type} className="flex items-center gap-2 p-2 rounded-lg" style={{background:meta.bg+'60'}}>
              <div className="w-2 h-2 rounded-full" style={{background:meta.color}}/>
              <span className="text-xs flex-1" style={{color:meta.color}}>{meta.label}</span>
              <span className="text-xs font-bold" style={{color:meta.color}}>{count}</span>
            </div>;
          })}
          <div className="mt-2 rounded-xl p-3" style={{background:DS.surfaceAlt,border:`1px solid ${DS.border}`}}>
            <p className="text-xs font-semibold mb-1" style={{color:DS.inkTer}}>Click any node for details</p>
            <p className="text-xs" style={{color:DS.inkFaint}}>Squares = decisions, Circles = uncertainties, Diamonds = value</p>
          </div>
        </div>}
      </div>
    </div>
  );
}

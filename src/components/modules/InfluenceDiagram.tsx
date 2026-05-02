import { useState, useEffect, useRef, useCallback } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Plus, Trash2, Link, RotateCcw, Lightbulb, Network, LayoutGrid, CheckCircle, AlertTriangle } from 'lucide-react';

const uid = (p='n') => `${p}_${Math.random().toString(36).slice(2,7)}_${Date.now().toString(36)}`;

interface INode { id: string; type: 'decision'|'uncertainty'|'deterministic'|'value'; label: string; x: number; y: number; impact?: string; }
interface IEdge { id: string; from: string; to: string; }

const NODE_TYPES = {
  decision:      { color: '#C9A84C', soft: '#FDF8E8', label: 'Decision',      shape: 'rect',  border: '#C9A84C' },
  uncertainty:   { color: '#F59E0B', soft: '#FFFBEB', label: 'Uncertainty',   shape: 'oval',  border: '#F59E0B' },
  deterministic: { color: '#0D9488', soft: '#F0FDFA', label: 'Deterministic', shape: 'rect',  border: '#0D9488' },
  value:         { color: '#E11D48', soft: '#FFF1F2', label: 'Value/Outcome', shape: 'hex',   border: '#E11D48' },
};

const TABS = [
  { id: 'diagram', label: 'Diagram' },
  { id: 'impact', label: 'Impact Matrix' },
  { id: 'registry', label: 'Node Registry' },
  { id: 'validate', label: 'Validate' },
];

export function InfluenceDiagram({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [activeTab, setActiveTab] = useState('diagram');
  const [nodes, setNodes] = useState<INode[]>([]);
  const [edges, setEdges] = useState<IEdge[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<INode['type']>('uncertainty');
  const [linkMode, setLinkMode] = useState(false);
  const [linkSrc, setLinkSrc] = useState<string|null>(null);
  const [dragging, setDragging] = useState<{id:string;ox:number;oy:number}|null>(null);
  const [zoom, setZoom] = useState(100);
  const [validation, setValidation] = useState<any>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data?.uncertainties?.length && !nodes.length) {
      const newNodes: INode[] = data.uncertainties.map((u: any, i: number) => ({
        id: uid('n'), type: 'uncertainty' as const, label: u.label, impact: u.impact,
        x: 120 + (i % 3) * 260, y: 80 + Math.floor(i/3) * 180,
      }));
      setNodes(newNodes);
    }
  }, [data?.uncertainties]);

  const addNode = () => {
    if (!newLabel.trim()) return;
    const n: INode = { id: uid('n'), type: newType, label: newLabel.trim(), x: 100 + Math.random()*500, y: 80 + Math.random()*300 };
    setNodes(p => [...p, n]);
    setNewLabel('');
  };

  const removeNode = (id: string) => { setNodes(p=>p.filter(n=>n.id!==id)); setEdges(p=>p.filter(e=>e.from!==id&&e.to!==id)); };

  const handleNodeClick = (id: string) => {
    if (!linkMode) return;
    if (!linkSrc) { setLinkSrc(id); return; }
    if (linkSrc !== id && !edges.some(e=>e.from===linkSrc&&e.to===id)) {
      setEdges(p=>[...p, {id:uid('e'), from:linkSrc, to:id}]);
    }
    setLinkSrc(null); setLinkMode(false);
  };

  const onMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (linkMode) { handleNodeClick(id); return; }
    const node = nodes.find(n=>n.id===id);
    if (!node) return;
    setDragging({id, ox:e.clientX-node.x, oy:e.clientY-node.y});
  }, [nodes, linkMode]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setNodes(p=>p.map(n=>n.id===dragging.id ? {...n,x:e.clientX-dragging.ox,y:e.clientY-dragging.oy} : n));
  }, [dragging]);

  const autoLayout = () => {
    const types: INode['type'][] = ['decision','uncertainty','deterministic','value'];
    setNodes(p => p.map(n => {
      const typeIdx = types.indexOf(n.type);
      const typeNodes = p.filter(x=>x.type===n.type);
      const posIdx = typeNodes.findIndex(x=>x.id===n.id);
      return { ...n, x: 80 + typeIdx * 240, y: 80 + posIdx * 160 };
    }));
  };

  const aiGenerate = () => {
    const focusDecs = (data?.decisions||[]).filter((d:any)=>d.tier==='focus').map((d:any)=>d.label).join(', ');
    const stratNames = (data?.strategies||[]).map((s:any)=>s.name).join(', ');
    const existing = nodes.map(n=>n.label).join(', ');
    const prompt = `Build a DQ influence diagram.\nDecision: ${data?.session?.decisionStatement||''}\nFocus Decisions: ${focusDecs}\nStrategies: ${stratNames}\nExisting nodes (do not duplicate): ${existing}\n\nReturn JSON: { nodes: [{label, type (decision/uncertainty/deterministic/value), col: 1-5, row: 1-4}], edges: [{from (exact label), to (exact label)}], insight: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (!result?.nodes?.length) return;
      const colCounters: Record<number,number> = {};
      const newNodes: INode[] = result.nodes.map((n: any) => {
        const col = Math.min(5, Math.max(1, n.col||3));
        colCounters[col] = (colCounters[col]||0)+1;
        const row = Math.min(4, Math.max(1, n.row||colCounters[col]));
        return { id: uid('n'), type: (n.type||'uncertainty') as INode['type'], label: n.label||'Node', x: 60+(col-1)*240+(Math.random()*20-10), y: 60+(row-1)*160 };
      });
      const allNodes = [...nodes, ...newNodes];
      const norm = (s:string) => s.toLowerCase().trim();
      const find = (label:string) => allNodes.find(n=>norm(n.label)===norm(label)) || allNodes.find(n=>norm(n.label).includes(norm(label).slice(0,10)));
      const newEdges: IEdge[] = (result.edges||[]).map((e:any) => {
        const f = find(e.from), t = find(e.to);
        return f&&t&&f.id!==t.id ? {id:uid('e'),from:f.id,to:t.id} : null;
      }).filter(Boolean) as IEdge[];
      const edgeKeys = new Set(edges.map(e=>e.from+'_'+e.to));
      setNodes(p=>[...p,...newNodes]);
      setEdges(p=>[...p,...newEdges.filter((e:IEdge)=>!edgeKeys.has(e.from+'_'+e.to))]);
    });
  };

  const aiValidate = () => {
    const nodeList = nodes.map(n=>`${n.label} [${n.type}]`).join(', ');
    const edgeList = edges.map(e=>{const f=nodes.find(n=>n.id===e.from),t=nodes.find(n=>n.id===e.to);return f&&t?`${f.label}→${t.label}`:null;}).filter(Boolean).join(', ');
    const prompt = `Validate this influence diagram.\nNodes: ${nodeList}\nEdges: ${edgeList}\nDecision: ${data?.session?.decisionStatement||''}\n\nReturn JSON: { validationScore: 0-100, checks: [{name, pass: boolean, note}], missingLinks: [string], redundantLinks: [string], verdict: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) { setValidation(result); setActiveTab('validate'); }
    });
  };

  const W = 1100, H = 500;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 09</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Influence Diagram</h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={addNode} disabled={!newLabel.trim()}>
            <Plus size={11} /> Add Node
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={autoLayout}>
            <LayoutGrid size={11} /> Auto Layout
          </Button>
          <Button size="sm" variant={linkMode?'default':'outline'} className="gap-1.5 text-xs h-7"
            style={linkMode?{background:DS.accent}:{}}
            onClick={() => { setLinkMode(!linkMode); setLinkSrc(null); }}>
            <Link size={11} /> {linkMode ? (linkSrc ? 'Click target…' : 'Click source…') : 'Draw Links'}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiValidate} disabled={busy||!nodes.length}>
            <CheckCircle size={11} /> Validate
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.information.fill }} onClick={aiGenerate} disabled={busy}>
            <Sparkles size={11} /> AI Generate
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-0" style={{ borderColor: DS.borderLight }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: activeTab===tab.id ? DS.information.fill : DS.inkTer, borderBottom: activeTab===tab.id ? `2px solid ${DS.information.fill}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
        {/* Zoom controls */}
        <div className="flex items-center gap-1 ml-auto pr-2">
          <span className="text-[9px]" style={{ color: DS.inkDis }}>Zoom</span>
          {[60,80,100,130,160].map(z => (
            <button key={z} onClick={() => setZoom(z)} className="text-[9px] px-1.5 py-0.5 rounded transition-all"
              style={{ background: zoom===z ? DS.information.fill : DS.bg, color: zoom===z ? '#fff' : DS.inkSub }}>
              {z}%
            </button>
          ))}
        </div>
      </div>

      {/* === DIAGRAM TAB === */}
      {activeTab === 'diagram' && (
        <div>
          {/* Add node row */}
          <div className="flex gap-2 p-2.5 border-b" style={{ borderColor: DS.borderLight, background: DS.bg }}>
            <Input value={newLabel} onChange={e=>setNewLabel(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addNode()}
              placeholder="Node label…" className="flex-1 text-xs h-7 bg-white" />
            <Select value={newType} onValueChange={v=>setNewType(v as INode['type'])}>
              <SelectTrigger className="h-7 text-[10px] bg-white w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(NODE_TYPES).map(([k,v])=><SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" className="h-7 px-2 gap-1 text-xs" style={{ background: DS.information.fill }} onClick={addNode} disabled={!newLabel.trim()}>
              <Plus size={11} /> Add
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setNodes([]); setEdges([]); }}>
              <RotateCcw size={11} /> Clear
            </Button>
          </div>

          {/* Legend */}
          <div className="flex gap-4 px-3 py-2 border-b" style={{ borderColor: DS.borderLight, background: DS.bg }}>
            {Object.entries(NODE_TYPES).map(([k,v])=>(
              <div key={k} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: v.soft, border: `1.5px solid ${v.color}` }} />
                <span className="text-[9px]" style={{ color: DS.inkSub }}>{v.label}</span>
              </div>
            ))}
          </div>

          {/* Canvas */}
          <div className="border-b overflow-auto" style={{ borderColor: DS.borderLight, height: 460, background: '#F7F8FA', backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            <div ref={canvasRef} style={{ position:'relative', width:Math.max(W,(nodes.reduce((m,n)=>Math.max(m,n.x+200),W))), height:Math.max(H,(nodes.reduce((m,n)=>Math.max(m,n.y+120),H))), transform:`scale(${zoom/100})`, transformOrigin:'top left' }}
              onMouseMove={onMouseMove} onMouseUp={() => setDragging(null)} onMouseLeave={() => setDragging(null)}>
              <svg style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none' }}>
                <defs>
                  {Object.entries(NODE_TYPES).map(([type,nt])=>(
                    <marker key={type} id={`arr-${type}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill={nt.color} opacity=".9" />
                    </marker>
                  ))}
                </defs>
                {edges.map(e => {
                  const f=nodes.find(n=>n.id===e.from), t=nodes.find(n=>n.id===e.to);
                  if (!f||!t) return null;
                  const nt=NODE_TYPES[f.type]||NODE_TYPES.uncertainty;
                  const fx=f.x+90, fy=f.y+30, tx=t.x+90, ty=t.y+30;
                  const mx=(fx+tx)/2, my=(fy+ty)/2-50;
                  return <path key={e.id} d={`M${fx},${fy} Q${mx},${my} ${tx},${ty}`} fill="none" stroke={nt.color} strokeWidth={2} strokeDasharray="5,3" opacity={.8} markerEnd={`url(#arr-${f.type})`} />;
                })}
                {/* Temp link line */}
                {linkSrc && (() => { const src=nodes.find(n=>n.id===linkSrc); return src ? <circle cx={src.x+90} cy={src.y+30} r={6} fill={DS.accent} opacity={.7} className="animate-pulse" /> : null; })()}
              </svg>

              {nodes.map(node => {
                const nt=NODE_TYPES[node.type]||NODE_TYPES.uncertainty;
                const isSrc=linkSrc===node.id;
                return (
                  <div key={node.id} style={{ position:'absolute', left:node.x, top:node.y, cursor:linkMode?'crosshair':'grab', userSelect:'none' }}
                    onMouseDown={e=>onMouseDown(e,node.id)}>
                    <div className="rounded-xl px-3 py-2.5 shadow-md transition-all group"
                      style={{ background:'#fff', border:`2px solid ${isSrc?DS.accent:nt.color}`, maxWidth:180, minWidth:120, boxShadow: isSrc?`0 0 0 3px ${DS.accent}30`:'0 2px 12px rgba(0,0,0,0.08)' }}>
                      <div className="text-[8px] font-bold uppercase tracking-wider mb-0.5" style={{ color: nt.color }}>{nt.label}</div>
                      <div className="text-[10px] font-semibold leading-snug" style={{ color: DS.ink }}>{node.label}</div>
                      {node.impact && <div className="text-[8px] mt-0.5" style={{ color: DS.inkDis }}>{node.impact} IMPACT</div>}
                    </div>
                    <button className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px]"
                      style={{ background: DS.danger }} onClick={() => removeNode(node.id)}>×</button>
                  </div>
                );
              })}

              {nodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Network size={36} style={{ color: DS.inkDis, opacity: 0.3 }} className="mb-3" />
                  <p className="text-sm font-medium mb-1" style={{ color: DS.inkSub }}>No timeline events yet</p>
                  <p className="text-xs" style={{ color: DS.inkDis }}>Click <strong>AI Generate</strong> to build a diagram from your decisions and uncertainties, or<br/>use <strong>+ Add Node</strong> to add manually.</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 px-3 py-2" style={{ background: DS.bg }}>
            <span className="text-[10px]" style={{ color: DS.inkDis }}>{nodes.length} nodes · {edges.length} connections</span>
          </div>
        </div>
      )}

      {/* === IMPACT MATRIX TAB === */}
      {activeTab === 'impact' && (
        <div className="p-4 space-y-3">
          <p className="text-xs" style={{ color: DS.inkSub }}>Which uncertainties have the most impact on the value outcome?</p>
          {nodes.filter(n=>n.type==='uncertainty').length === 0 ? (
            <div className="text-center py-12" style={{ color: DS.inkDis }}><p className="text-xs">Add uncertainty nodes to see the impact matrix</p></div>
          ) : (
            <div className="space-y-2">
              {nodes.filter(n=>n.type==='uncertainty').map(n=>{
                const outgoing = edges.filter(e=>e.from===n.id).length;
                const incoming = edges.filter(e=>e.to===n.id).length;
                const score = outgoing * 2 + incoming;
                return (
                  <div key={n.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium" style={{ color: DS.ink }}>{n.label}</div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]" style={{ color: DS.inkDis }}>
                      <span>→ {outgoing} links out</span>
                      <span>{incoming} links in ←</span>
                    </div>
                    <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: DS.bg }}>
                      <div className="h-full rounded-full" style={{ width:`${Math.min(100,(score/10)*100)}%`, background: score>=4?DS.danger:score>=2?DS.warning:DS.success }} />
                    </div>
                    <Badge style={{ background: score>=4?DS.dangerSoft:score>=2?DS.warnSoft:DS.successSoft, color: score>=4?DS.danger:score>=2?DS.warning:DS.success, border:'none', fontSize:8 }}>
                      {score>=4?'High':score>=2?'Medium':'Low'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === NODE REGISTRY TAB === */}
      {activeTab === 'registry' && (
        <div className="p-4 space-y-3">
          <p className="text-xs" style={{ color: DS.inkSub }}>All nodes in the diagram organised by type.</p>
          {Object.entries(NODE_TYPES).map(([type, nt]) => {
            const typeNodes = nodes.filter(n=>n.type===type);
            if (!typeNodes.length) return null;
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: nt.soft, border: `1.5px solid ${nt.color}` }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: nt.color }}>{nt.label}</span>
                  <span className="text-[9px]" style={{ color: DS.inkDis }}>{typeNodes.length}</span>
                </div>
                <div className="space-y-1 pl-4">
                  {typeNodes.map(n => (
                    <div key={n.id} className="flex items-center gap-2 p-2 rounded-lg group" style={{ background: DS.bg }}>
                      <span className="text-xs flex-1" style={{ color: DS.ink }}>{n.label}</span>
                      <span className="text-[9px]" style={{ color: DS.inkDis }}>
                        {edges.filter(e=>e.from===n.id).length}→ {edges.filter(e=>e.to===n.id).length}←
                      </span>
                      <button onClick={()=>removeNode(n.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={10} style={{ color: DS.danger }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* === VALIDATE TAB === */}
      {activeTab === 'validate' && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>AI checks the causal logic and completeness of your influence diagram.</p>
            <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.information.fill }} onClick={aiValidate} disabled={busy}>
              <Sparkles size={11} /> {busy?'Validating…':'Run Validation'}
            </Button>
          </div>
          {!validation ? (
            <div className="text-center py-12 rounded-xl" style={{ background: DS.bg }}>
              <p className="text-xs" style={{ color: DS.inkDis }}>Run validation to check causal logic</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: DS.information.soft, border: `1px solid ${DS.information.line}` }}>
                <div className="text-4xl font-black" style={{ color: validation.validationScore>=70?DS.success:DS.warning }}>{validation.validationScore}</div>
                <div><div className="text-xs font-bold" style={{ color: DS.ink }}>Diagram Quality</div><p className="text-xs" style={{ color: DS.inkSub }}>{validation.verdict}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(validation.checks||[]).map((c:any,i:number)=>(
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: c.pass?DS.successSoft:DS.warnSoft }}>
                    {c.pass?<CheckCircle size={12} style={{ color:DS.success,flexShrink:0,marginTop:1 }}/>:<AlertTriangle size={12} style={{ color:DS.warning,flexShrink:0,marginTop:1 }}/>}
                    <div><div className="text-[10px] font-semibold" style={{ color:DS.ink }}>{c.name}</div><div className="text-[9px]" style={{ color:DS.inkSub }}>{c.note}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { DQTrustBadge } from '@/components/ui/dq-trust-badge';
import { checkFrameGate } from '@/lib/dq-data-contracts';
import { buildContractPrompt } from '@/lib/dq-data-contracts';
import { useState, useEffect } from 'react';
import { useDQAI } from '@/hooks/useDQAI';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { ModuleDataBanner } from '@/components/ui/module-data-banner';
import { toastAIError, toastSaved } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Plus, Trash2, Shield, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface RiskItem { id: number; label: string; likelihood: string; impact: string; timeframe: string; owner: string; mitigation: string; month: number; }

const IMPACT_CONFIG: Record<string,{color:string;soft:string;rank:number}> = {
  Critical: { color: '#7F1D1D', soft: '#FEF2F2', rank: 4 },
  High:     { color: DS.danger, soft: DS.dangerSoft, rank: 3 },
  Medium:   { color: DS.warning, soft: DS.warnSoft, rank: 2 },
  Low:      { color: DS.success, soft: DS.successSoft, rank: 1 },
};

const LIKELIHOOD_CONFIG: Record<string,{color:string;rank:number}> = {
  High:   { color: DS.danger, rank: 3 },
  Medium: { color: DS.warning, rank: 2 },
  Low:    { color: DS.success, rank: 1 },
};

function riskScore(r: RiskItem) {
  return ((IMPACT_CONFIG[r.impact]?.rank || 2) * (LIKELIHOOD_CONFIG[r.likelihood]?.rank || 2));
}

export function DecisionRiskTimeline({ sessionId, data, hooks }: ModuleProps) {
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newLik, setNewLik] = useState('Medium');
  const [newImp, setNewImp] = useState('High');
  const [readiness, setReadiness] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const frameGate = checkFrameGate(data);
  const { call: dqCall, busy: dqBusy, lastResult: dqResult } = useDQAI();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'risks'|'readiness'>('risks');

  useEffect(() => {
    if (data?.riskItems?.length) {
      setRisks(data.riskItems.map((r: any) => ({ id: r.id, label: r.label, likelihood: r.likelihood || 'Medium', impact: r.impact || 'High', timeframe: r.timeframe || '', owner: r.owner || '', mitigation: r.mitigation || '', month: r.month || 3 })));
    }
  }, [data?.riskItems]);

  const add = () => {
    if (!newLabel.trim()) return;
    const n: RiskItem = { id: Date.now(), label: newLabel.trim(), likelihood: newLik, impact: newImp, timeframe: '', owner: '', mitigation: '', month: 3 };
    setRisks(p => [...p, n]);
    hooks?.createRisk?.({ sessionId, label: newLabel.trim(), likelihood: newLik, impact: newImp });
    setNewLabel('');
  };
  const remove = (id: number) => { setRisks(p => p.filter(r => r.id !== id)); hooks?.deleteRisk?.({ id }); };
  const update = (id: number, field: string, val: any) => setRisks(p => p.map(r => r.id === id ? { ...r, [field]: val } : r));

  const aiGenerate = async () => {
    const stratName = (data?.strategies || [])[0]?.name || 'primary strategy';
    const prompt = `Generate decision risks for: ${data?.session?.decisionStatement || ''}\nStrategy: ${stratName}\nDeadline: ${data?.session?.deadline || ''}\n\nReturn JSON: { risks: [{label, likelihood: High|Medium|Low, impact: Critical|High|Medium|Low, timeframe, month: 1-18, owner, mitigation}] }`;
    setBusy(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, module: 'risk' }) });
      const d = await res.json();
      const text = (d.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]);
        const newRisks = (result.risks || []).map((r: any, i: number) => ({ id: Date.now() + i, label: r.label, likelihood: r.likelihood || 'Medium', impact: r.impact || 'High', timeframe: r.timeframe || '', month: Number(r.month) || 3, owner: r.owner || '', mitigation: r.mitigation || '' }));
        setRisks(p => [...p, ...newRisks]);
      }
    } catch(e) { console.error(e); } finally { setBusy(false); }
  };

  const aiReadiness = async () => {
    const riskSummary = risks.map(r => `${r.label}: ${r.likelihood}/${r.impact} [${r.timeframe}] mitigation: ${r.mitigation || 'none'}`).join('\n');
    const prompt = `Assess decision readiness from risk profile.\nDecision: ${data?.session?.decisionStatement || ''}\nRisks:\n${riskSummary}\n\nReturn JSON: { readinessScore: 0-100, readinessLevel: "Ready|Conditional|Not Ready", peakRiskPeriod: string, blockers: [string], mitigationGaps: [{risk, gap}], lastResponsibleMoment: string, recommendation: string }`;
    setBusy(true);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, module: 'risk' }) });
      const d = await res.json();
      const text = (d.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) { setReadiness(JSON.parse(match[0])); setActiveTab('readiness'); }
    } catch(e) { console.error(e); } finally { setBusy(false); }
  };

  const sorted = [...risks].sort((a, b) => riskScore(b) - riskScore(a));
  const criticalCount = risks.filter(r => r.impact === 'Critical' || (r.impact === 'High' && r.likelihood === 'High')).length;
  const unmitigated = risks.filter(r => !r.mitigation.trim()).length;

  return (
    <div className="space-y-4">
      {dqResult?.trust && <DQTrustBadge trust={dqResult.trust} meta={dqResult.meta} />}
      {frameGate.score < 30 && (
        <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
          <span className="text-lg">🔒</span>
          <span className="text-[10px] font-bold" style={{ color: '#D97706' }}>AI locked — complete Problem Frame first (score {frameGate.score}/30)</span>
        </div>
      )}
      <ModuleDataBanner moduleId="risk-timeline" data={data} />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 12</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Decision Risk Timeline</h2>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1 text-xs h-7 shrink-0" onClick={aiGenerate} disabled={busy}>
            <Sparkles size={11} /> {busy ? 'Generating…' : 'AI Generate Risks'}
          </Button>
          <Button size="sm" className="gap-1 text-xs h-7 shrink-0" style={{ background: DS.danger }} onClick={aiReadiness} disabled={busy || !risks.length}>
            <Shield size={11} /> {busy ? 'Assessing…' : 'AI Readiness Check'}
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      {risks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
            <div className="text-lg font-black" style={{ color: DS.ink }}>{risks.length}</div>
            <div className="text-[9px] font-bold uppercase" style={{ color: DS.inkDis }}>Total Risks</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            <div className="text-lg font-black" style={{ color: DS.danger }}>{criticalCount}</div>
            <div className="text-[9px] font-bold uppercase" style={{ color: DS.danger }}>Critical</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: DS.warnSoft, border: `1px solid ${DS.warning}40` }}>
            <div className="text-lg font-black" style={{ color: DS.warning }}>{unmitigated}</div>
            <div className="text-[9px] font-bold uppercase" style={{ color: DS.warning }}>Unmitigated</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: DS.successSoft, border: `1px solid ${DS.success}40` }}>
            <div className="text-lg font-black" style={{ color: DS.success }}>{risks.length - unmitigated}</div>
            <div className="text-[9px] font-bold uppercase" style={{ color: DS.success }}>Mitigated</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto scrollbar-none" style={{ borderColor: DS.borderLight }}>
        {[{id:'risks',label:'Risk Register'},{id:'readiness',label:'Readiness Assessment'}].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className="px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: activeTab === tab.id ? DS.danger : DS.inkTer, borderBottom: activeTab === tab.id ? `2px solid ${DS.danger}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Risk register */}
      {activeTab === 'risks' && (
        <div className="space-y-3">
          {/* Add row */}
          <div className="flex gap-2 p-3 rounded-xl flex-wrap" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
            <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Risk label…" className="flex-1 text-xs h-8 bg-white min-w-40" />
            <select value={newLik} onChange={e => setNewLik(e.target.value)} className="text-xs h-8 px-2 rounded-lg border bg-white" style={{ borderColor: DS.borderLight }}>
              <option>High</option><option>Medium</option><option>Low</option>
            </select>
            <select value={newImp} onChange={e => setNewImp(e.target.value)} className="text-xs h-8 px-2 rounded-lg border bg-white" style={{ borderColor: DS.borderLight }}>
              <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
            </select>
            <Button size="sm" className="h-8 gap-1 text-xs shrink-0" style={{ background: DS.danger }} onClick={add} disabled={!newLabel.trim()}><Plus size={12} /> Add</Button>
          </div>

          {risks.length === 0 && (
            <div className="text-center py-10 rounded-xl" style={{ background: DS.bg, border: `1px dashed ${DS.border}` }}>
              <Shield size={24} className="mx-auto mb-2" style={{ color: DS.inkDis }} />
              <p className="text-xs mb-3" style={{ color: DS.inkDis }}>No risks identified yet</p>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={aiGenerate} disabled={busy}>
                <Sparkles size={11} /> AI Generate Risks
              </Button>
            </div>
          )}

          {sorted.map(r => {
            const ic = IMPACT_CONFIG[r.impact] || IMPACT_CONFIG.Medium;
            const lc = LIKELIHOOD_CONFIG[r.likelihood] || LIKELIHOOD_CONFIG.Medium;
            const isExpanded = expandedId === r.id;
            const score = riskScore(r);
            return (
              <div key={r.id} className="rounded-xl border overflow-hidden" style={{ borderColor: isExpanded ? ic.color + '60' : DS.borderLight }}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" style={{ background: DS.canvas }} onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                  {/* Risk score badge */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0" style={{ background: ic.soft, color: ic.color }}>{score}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: DS.ink }}>{r.label}</div>
                    <div className="text-[10px]" style={{ color: DS.inkDis }}>{r.timeframe || 'Timeframe not set'} · {r.owner || 'No owner'}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: lc.color + '15', color: lc.color }}>{r.likelihood}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: ic.soft, color: ic.color }}>{r.impact}</span>
                    {!r.mitigation && <AlertTriangle size={12} style={{ color: DS.warning }} />}
                    {isExpanded ? <ChevronUp size={14} style={{ color: DS.inkDis }} /> : <ChevronDown size={14} style={{ color: DS.inkDis }} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 space-y-3 border-t" style={{ borderColor: DS.borderLight, background: ic.soft }}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>LIKELIHOOD</div>
                        <div className="flex gap-1">
                          {['Low','Medium','High'].map(v => (
                            <button key={v} onClick={() => update(r.id, 'likelihood', v)} className="flex-1 py-1 text-[9px] font-bold rounded-lg transition-all"
                              style={{ background: r.likelihood === v ? LIKELIHOOD_CONFIG[v].color : '#fff', color: r.likelihood === v ? '#fff' : DS.inkDis, border: `1px solid ${LIKELIHOOD_CONFIG[v].color}40` }}>
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>IMPACT</div>
                        <div className="flex gap-1">
                          {['Low','Medium','High','Critical'].map(v => (
                            <button key={v} onClick={() => update(r.id, 'impact', v)} className="flex-1 py-1 text-[9px] font-bold rounded-lg transition-all"
                              style={{ background: r.impact === v ? IMPACT_CONFIG[v]?.color : '#fff', color: r.impact === v ? '#fff' : DS.inkDis, border: `1px solid ${(IMPACT_CONFIG[v]?.color || '#ccc') + '40'}` }}>
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>TIMEFRAME</div>
                        <input value={r.timeframe} onChange={e => update(r.id, 'timeframe', e.target.value)} placeholder="e.g. Months 3-6" className="w-full text-xs p-2 rounded-lg border bg-white" style={{ borderColor: DS.borderLight }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>OWNER</div>
                        <input value={r.owner} onChange={e => update(r.id, 'owner', e.target.value)} placeholder="Role responsible" className="w-full text-xs p-2 rounded-lg border bg-white" style={{ borderColor: DS.borderLight }} />
                      </div>
                      <div>
                        <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>MONTH (1-18)</div>
                        <input type="number" min="1" max="18" value={r.month} onChange={e => update(r.id, 'month', Number(e.target.value))} className="w-full text-xs p-2 rounded-lg border bg-white" style={{ borderColor: DS.borderLight }} />
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>MITIGATION ACTION</div>
                      <textarea value={r.mitigation} onChange={e => update(r.id, 'mitigation', e.target.value)} rows={2} placeholder="Specific mitigation — who does what by when?" className="w-full text-xs p-2 rounded-lg border resize-none bg-white" style={{ borderColor: DS.borderLight }} />
                    </div>
                    <button onClick={() => remove(r.id)} className="text-[10px] flex items-center gap-1" style={{ color: DS.danger }}><Trash2 size={10} /> Remove risk</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Readiness tab */}
      {activeTab === 'readiness' && (
        <div className="space-y-3">
          {!readiness ? (
            <div className="text-center py-10 rounded-xl" style={{ background: DS.bg, border: `1px dashed ${DS.border}` }}>
              <Shield size={24} className="mx-auto mb-2" style={{ color: DS.inkDis }} />
              <p className="text-xs mb-3" style={{ color: DS.inkDis }}>AI will assess decision readiness based on your risk profile</p>
              <Button size="sm" className="gap-1.5 text-xs" style={{ background: DS.danger }} onClick={aiReadiness} disabled={busy || !risks.length}>
                <Shield size={11} /> Run Readiness Check
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Score */}
              <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: readiness.readinessLevel === 'Ready' ? '#F0FDF4' : readiness.readinessLevel === 'Conditional' ? '#FFFBEB' : '#FEF2F2', border: `1px solid ${readiness.readinessLevel === 'Ready' ? '#BBF7D0' : readiness.readinessLevel === 'Conditional' ? '#FDE68A' : '#FECACA'}` }}>
                <div className="text-4xl font-black" style={{ color: readiness.readinessLevel === 'Ready' ? '#047857' : readiness.readinessLevel === 'Conditional' ? '#D97706' : '#EF4444' }}>{readiness.readinessScore}</div>
                <div className="flex-1">
                  <div className="text-sm font-bold mb-0.5" style={{ color: DS.ink }}>{readiness.readinessLevel}</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{readiness.recommendation}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0" onClick={aiReadiness} disabled={busy}><Sparkles size={10} /> Re-run</Button>
              </div>

              {readiness.blockers?.length > 0 && (
                <div className="rounded-xl p-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <div className="text-[10px] font-bold uppercase mb-2" style={{ color: DS.danger }}>Blockers</div>
                  {readiness.blockers.map((b: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs mb-1" style={{ color: DS.danger }}><span>•</span><span>{b}</span></div>
                  ))}
                </div>
              )}

              {readiness.mitigationGaps?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase" style={{ color: DS.inkDis }}>Mitigation Gaps</div>
                  {readiness.mitigationGaps.map((g: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl" style={{ background: DS.warnSoft, border: `1px solid ${DS.warning}30` }}>
                      <div className="text-xs font-semibold mb-0.5" style={{ color: DS.ink }}>{g.risk}</div>
                      <div className="text-xs" style={{ color: DS.inkSub }}>{g.gap}</div>
                    </div>
                  ))}
                </div>
              )}

              {readiness.lastResponsibleMoment && (
                <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
                  <div className="text-[9px] font-bold uppercase" style={{ color: DS.accent }}>Last Responsible Moment:</div>
                  <div className="text-xs font-semibold" style={{ color: DS.ink }}>{readiness.lastResponsibleMoment}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

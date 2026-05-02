import { useState, useMemo } from 'react';
import type { ModuleProps } from '@/types';
import { DS, DQ_ELEMENTS, DQ_SCORE_BANDS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Printer, Sparkles, CheckCircle, XCircle, Eye, EyeOff, Lightbulb } from 'lucide-react';

const MODULE_CHECKS = [
  { key: 'problem', label: 'Problem Definition', check: (d: any) => !!d.session?.decisionStatement, detail: (d: any) => d.session?.owner ? `Owner: ${d.session.owner}` : 'No owner set' },
  { key: 'issues', label: 'Issues Raised', check: (d: any) => (d.issues||[]).length >= 5, detail: (d: any) => `${(d.issues||[]).length} issues · ${(d.issues||[]).filter((i:any)=>i.severity==='Critical').length} critical` },
  { key: 'hierarchy', label: 'Decision Hierarchy', check: (d: any) => (d.decisions||[]).filter((d:any)=>d.tier==='focus').length > 0, detail: (d: any) => `${(d.decisions||[]).filter((d:any)=>d.tier==='focus').length} focus decisions · ${(d.criteria||[]).length} criteria` },
  { key: 'strategy', label: 'Strategy Table', check: (d: any) => (d.strategies||[]).length >= 2, detail: (d: any) => `${(d.strategies||[]).length} strategies` },
  { key: 'assessment', label: 'Qualitative Assessment', check: (d: any) => (d.assessmentScores||[]).length > 0, detail: (d: any) => `${(d.assessmentScores||[]).length} scores recorded` },
  { key: 'scorecard', label: 'DQ Scorecard', check: (d: any) => Object.keys(d.session?.dqScores||{}).length >= 6, detail: (d: any) => { const vals = Object.values(d.session?.dqScores||{}) as number[]; return vals.length ? `Score: ${Math.round(vals.reduce((a,b)=>a+b,0)/vals.length)}/100` : 'Not scored'; } },
];

export function ExportReport({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [pack, setPack] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);

  const session = data?.session || {};
  const issues = data?.issues || [];
  const decisions = data?.decisions || [];
  const strategies = data?.strategies || [];
  const criteria = data?.criteria || [];
  const dqScores = session.dqScores || {};
  const vals = Object.values(dqScores) as number[];
  const overall = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
  const band = DQ_SCORE_BANDS.find(b=>overall>=b.min&&overall<=b.max) || DQ_SCORE_BANDS[4];

  const checks = MODULE_CHECKS.map(m => ({ ...m, pass: m.check(data||{}), detail: m.detail(data||{}) }));
  const passedCount = checks.filter(c=>c.pass).length;
  const completionPct = Math.round((passedCount/checks.length)*100);

  const generate = () => {
    const prompt = `Generate a comprehensive executive decision package.\nDecision: ${session.decisionStatement||''}\nOwner: ${session.owner||''} | Deadline: ${session.deadline||''}\nContext: ${(session.context||'').slice(0,250)}\nStrategies: ${strategies.map((s:any)=>s.name).join(', ')}\nCriteria: ${criteria.map((c:any)=>c.label).join(', ')}\nIssues: ${issues.length} (${issues.filter((i:any)=>i.severity==='Critical').length} critical)\nDQ Score: ${overall}/100 (${band.label})\n\nReturn JSON: { onePager: string, recommendation: string, boardNarrative: string, keyRisks: [string], successMetrics: [string], nextSteps: [{action, owner, deadline}], riskRegister: [{risk, likelihood, impact, mitigation}], stakeholderMessages: {board: string, executiveTeam: string} }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw||'').match(/\{[\s\S]*\}/)?.[0]||''); } catch { return; } }
      if (result && !result.error) setPack(result);
    });
  };

  const print = () => {
    document.title = (session.name || session.decisionStatement?.slice(0,50) || 'Decision Package') + ' — Vantage DQ';
    window.print();
    document.title = 'Vantage DQ';
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 07</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Export & Report</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: completionPct >= 80 ? DS.success : DS.warning }}>{completionPct}% COMPLETE</span>
        </div>
        <div className="flex gap-2">
          {pack && <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={print}><Printer size={11} /> Print / PDF</Button>}
          {pack && <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => setPreviewing(!previewing)}>{previewing ? <EyeOff size={11} /> : <Eye size={11} />} Preview</Button>}
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.accent }} onClick={generate} disabled={busy}>
            <Sparkles size={11} /> {busy ? 'Generating…' : 'Generate Executive Package'}
          </Button>
        </div>
      </div>

      {/* Decision banner */}
      <div className="rounded-2xl p-6 mb-5" style={{ background: DS.brand }}>
        <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(201,168,76,0.7)' }}>VANTAGE DQ · DECISION PACKAGE</div>
        <h3 className="text-xl font-black text-white mb-1">{session.decisionStatement || session.name || 'Decision Package'}</h3>
        {session.owner && <div className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Decision Owner: {session.owner}</div>}
      </div>

      {/* Platform completion */}
      <div className="rounded-xl overflow-hidden border mb-5" style={{ borderColor: DS.borderLight }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: DS.borderLight, background: DS.bg }}>
          <h3 className="text-xs font-bold" style={{ color: DS.ink }}>Platform Completion</h3>
        </div>
        <div className="divide-y" style={{ borderColor: DS.borderLight }}>
          {checks.map(c => (
            <div key={c.key} className="flex items-center gap-3 px-4 py-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0`} style={{ background: c.pass ? DS.success : DS.bg, border: c.pass ? 'none' : `2px solid ${DS.borderLight}` }}>
                {c.pass && <CheckCircle size={12} className="text-white" />}
              </div>
              <span className="text-xs font-medium flex-1" style={{ color: c.pass ? DS.ink : DS.inkTer }}>{c.label}</span>
              <span className="text-[10px]" style={{ color: c.pass ? DS.inkDis : DS.warning }}>{c.detail}</span>
            </div>
          ))}
        </div>
        {/* Progress bar */}
        <div className="px-4 py-3 border-t" style={{ borderColor: DS.borderLight }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px]" style={{ color: DS.inkDis }}>Overall progress</span>
            <span className="text-[10px] font-bold" style={{ color: completionPct >= 80 ? DS.success : DS.warning }}>{completionPct}% complete</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: DS.bg }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${completionPct}%`, background: completionPct >= 80 ? DS.success : DS.warning }} />
          </div>
        </div>
      </div>

      {/* Executive package */}
      {pack && (
        <div className="space-y-3">
          {pack.recommendation && (
            <div className="p-4 rounded-xl" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.accent }}>RECOMMENDATION</div>
              <p className="text-sm font-bold" style={{ color: DS.ink }}>{pack.recommendation}</p>
            </div>
          )}
          {pack.onePager && (
            <div className="p-4 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>EXECUTIVE SUMMARY</div>
              <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: DS.inkSub }}>{pack.onePager}</p>
            </div>
          )}
          {pack.nextSteps?.length > 0 && (
            <div className="p-4 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
              <div className="text-[9px] font-bold uppercase tracking-wider mb-3" style={{ color: DS.inkDis }}>NEXT STEPS</div>
              {pack.nextSteps.map((s:any, i:number) => (
                <div key={i} className="flex items-start gap-2.5 mb-2.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0" style={{ background: DS.accent }}>{i+1}</div>
                  <div><div className="text-xs font-medium" style={{ color: DS.ink }}>{s.action}</div>{(s.owner||s.deadline) && <div className="text-[9px]" style={{ color: DS.inkDis }}>{s.owner}{s.deadline ? ` · by ${s.deadline}` : ''}</div>}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Print preview */}
      {previewing && pack && (
        <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto py-8 px-4 flex flex-col items-center">
          <div className="flex gap-3 mb-4 w-full max-w-3xl items-center">
            <span className="text-white text-sm font-bold flex-1">{session.name || 'Decision Package'} — Preview</span>
            <Button size="sm" style={{ background: DS.accent }} onClick={print} className="gap-1"><Printer size={12} /> Print / Save PDF</Button>
            <Button size="sm" variant="outline" className="gap-1 text-white border-white/30 hover:bg-white/10 hover:text-white" onClick={() => setPreviewing(false)}><EyeOff size={12} /> Close</Button>
          </div>
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl p-12" style={{ fontFamily: 'Georgia, serif', color: '#1a1a2e', lineHeight: 1.7 }}>
            <div style={{ borderBottom: '3px solid #0B1D3A', paddingBottom: 24, marginBottom: 32 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#6b75a0', marginBottom: 8 }}>Vantage DQ · Executive Decision Package</div>
              <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, marginBottom: 10 }}>{session.name || session.decisionStatement?.slice(0,70) || 'Decision Package'}</div>
              <div style={{ display: 'flex', gap: 24, fontSize: 12, color: '#6b75a0', flexWrap: 'wrap' as const }}>
                {session.owner && <span><strong>Owner:</strong> {session.owner}</span>}
                {session.deadline && <span><strong>Deadline:</strong> {session.deadline}</span>}
                <span><strong>Date:</strong> {new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</span>
                <span style={{ color: band.color }}><strong>DQ Score:</strong> {overall}/100 — {band.label}</span>
              </div>
            </div>
            {pack.recommendation && <div style={{ padding:'14px 18px', background:'#eff6ff', borderRadius:6, border:'1px solid #bfdbfe', marginBottom:28 }}>
              <div style={{ fontSize:11, fontWeight:700, marginBottom:6, color:'#2563eb', textTransform:'uppercase' as const, letterSpacing:1 }}>Recommendation</div>
              <div style={{ fontSize:14, fontWeight:600 }}>{pack.recommendation}</div>
            </div>}
            {pack.onePager && <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:1, marginBottom:10, color:'#2563eb' }}>Executive Summary</div>
              <div style={{ fontSize:13, whiteSpace:'pre-line' as const }}>{pack.onePager}</div>
            </div>}
            {pack.boardNarrative && <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:1, marginBottom:10, color:'#2563eb' }}>Board Narrative</div>
              <div style={{ fontSize:13, fontStyle:'italic' }}>{pack.boardNarrative}</div>
            </div>}
            {pack.riskRegister?.length > 0 && <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:1, marginBottom:10, color:'#2563eb' }}>Risk Register</div>
              <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:12 }}>
                <thead><tr style={{ background:'#f1f5f9' }}>{['Risk','Likelihood','Impact','Mitigation'].map(h=><th key={h} style={{ padding:'8px 12px', textAlign:'left' as const, fontWeight:700, borderBottom:'2px solid #e2e8f0' }}>{h}</th>)}</tr></thead>
                <tbody>{pack.riskRegister.map((r:any,i:number)=><tr key={i} style={{ borderBottom:'1px solid #e2e8f0', background:i%2===0?'#fff':'#f8fafc' }}>
                  <td style={{ padding:'8px 12px' }}>{r.risk}</td>
                  <td style={{ padding:'8px 12px', fontWeight:600, color:r.likelihood==='High'?'#dc2626':r.likelihood==='Medium'?'#d97706':'#059669' }}>{r.likelihood}</td>
                  <td style={{ padding:'8px 12px', fontWeight:600, color:r.impact==='High'?'#dc2626':r.impact==='Medium'?'#d97706':'#059669' }}>{r.impact}</td>
                  <td style={{ padding:'8px 12px' }}>{r.mitigation}</td>
                </tr>)}</tbody>
              </table>
            </div>}
            {pack.nextSteps?.length > 0 && <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:1, marginBottom:10, color:'#2563eb' }}>Next Steps</div>
              {pack.nextSteps.map((s:any,i:number)=><div key={i} style={{ marginBottom:10, padding:'10px 14px', background:'#f8faff', borderRadius:6, borderLeft:'3px solid #2563eb' }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:3 }}>{s.action}</div>
                <div style={{ fontSize:11, color:'#6b75a0', display:'flex', gap:16 }}>{s.owner&&<span>Owner: {s.owner}</span>}{s.deadline&&<span>By: {s.deadline}</span>}</div>
              </div>)}
            </div>}
            <div style={{ borderTop:'1px solid #e2e8f0', paddingTop:16, fontSize:10, color:'#9ca3af', display:'flex', justifyContent:'space-between' as const }}>
              <span>Generated by Vantage DQ</span><span>{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

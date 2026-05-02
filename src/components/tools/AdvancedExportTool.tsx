import { useState } from 'react';
import type { ModuleProps } from '@/types';
import { DS, DQ_ELEMENTS, DQ_SCORE_BANDS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Sparkles, Printer, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';

export function AdvancedExportTool({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [pack, setPack] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);
  const [format, setFormat] = useState<'executive' | 'board' | 'full'>('executive');

  const session = data?.session || {};
  const issues = data?.issues || [];
  const decisions = data?.decisions || [];
  const strategies = data?.strategies || [];
  const criteria = data?.criteria || [];
  const stakeholders = data?.stakeholderEntries || [];
  const dqScores = session.dqScores || {};
  const vals = Object.values(dqScores) as number[];
  const overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  const band = DQ_SCORE_BANDS.find(b => overall >= b.min && overall <= b.max) || DQ_SCORE_BANDS[4];

  const generate = () => {
    const prompt = `Generate a comprehensive decision export package for this decision.\nDecision: ${session.decisionStatement || ''}\nOwner: ${session.owner || ''} | Deadline: ${session.deadline || ''}\nContext: ${(session.context || '').slice(0, 250)}\nStrategies: ${strategies.map((s: any) => s.name + (s.objective ? ': ' + s.objective : '')).join('; ')}\nCriteria: ${criteria.map((c: any) => c.label).join(', ')}\nIssues: ${issues.length} (${issues.filter((i: any) => i.severity === 'Critical').length} critical)\nStakeholders: ${stakeholders.length}\nDQ Score: ${overall}/100 (${band.label})\nFormat requested: ${format}\n\nReturn JSON with no markdown:\n{\n  onePager: "3-paragraph executive summary",\n  recommendation: "2-sentence recommendation",\n  boardNarrative: "5-sentence board narrative using situation/complication/question/answer/next-steps structure",\n  keyRisks: ["risk 1", "risk 2", "risk 3"],\n  successMetrics: ["metric 1", "metric 2", "metric 3"],\n  nextSteps: [{action: string, owner: string, deadline: string}],\n  stakeholderMessages: {board: string, executiveTeam: string, projectTeam: string},\n  riskRegister: [{risk: string, likelihood: string, impact: string, mitigation: string}],\n  decisionRationale: string,\n  alternativesRejected: [{name: string, reason: string}]\n}`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
      if (result && !result.error) setPack(result);
    });
  };

  const print = () => {
    const title = session.name || session.decisionStatement?.slice(0, 50) || 'Decision Package';
    const orig = document.title;
    document.title = title + ' — Vantage DQ';
    window.print();
    document.title = orig;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
            <FileSpreadsheet size={22} style={{ color: '#F59E0B' }} /> Advanced Export
          </h2>
          <p className="text-xs mt-1" style={{ color: DS.inkSub }}>Generate board-ready decision packages, stakeholder briefs, and risk registers</p>
        </div>
        <div className="flex gap-2">
          {pack && <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setPreviewing(!previewing)}>{previewing ? <EyeOff size={12} /> : <Eye size={12} />} Preview</Button>}
          {pack && <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={print}><Printer size={12} /> Print</Button>}
          <Button size="sm" className="gap-1.5 text-xs" style={{ background: '#F59E0B' }} onClick={generate} disabled={busy}>
            <Sparkles size={12} /> {busy ? 'Generating…' : 'Generate Package'}
          </Button>
        </div>
      </div>

      {/* Format selector */}
      <div className="flex gap-2">
        {(['executive', 'board', 'full'] as const).map(f => (
          <button key={f} onClick={() => setFormat(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
            style={{ background: format === f ? '#F59E0B' : DS.bg, color: format === f ? '#fff' : DS.inkSub, border: `1px solid ${format === f ? '#F59E0B' : DS.border}` }}>
            {f === 'executive' ? 'Executive Summary' : f === 'board' ? 'Board Package' : 'Full Report'}
          </button>
        ))}
      </div>

      {/* DQ summary card */}
      <Card className="border-0 shadow-sm" style={{ borderLeft: `4px solid ${band.color}` }}>
        <CardContent className="pt-3 pb-3 flex items-center gap-4">
          <div className="text-4xl font-black" style={{ color: band.color }}>{overall}</div>
          <div>
            <div className="text-sm font-bold" style={{ color: DS.ink }}>{band.label} Decision Quality</div>
            <p className="text-xs" style={{ color: DS.inkSub }}>{band.desc}</p>
          </div>
          <div className="ml-auto flex gap-2">
            {DQ_ELEMENTS.map(el => (
              <div key={el.key} className="text-center">
                <div className="text-xs font-black" style={{ color: (dqScores[el.key] || 0) >= 70 ? DS.success : (dqScores[el.key] || 0) >= 45 ? DS.warning : DS.danger }}>{dqScores[el.key] || '—'}</div>
                <div className="text-[8px]" style={{ color: DS.inkDis }}>{el.short.slice(0, 4)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Package sections */}
      {pack && !previewing && (
        <div className="space-y-3">
          {pack.recommendation && (
            <Card className="border-0 shadow-sm" style={{ background: DS.accentSoft, borderLeft: `4px solid ${DS.accent}` }}>
              <CardContent className="pt-3 pb-3">
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.accent }}>Recommendation</div>
                <p className="text-sm font-medium" style={{ color: DS.ink }}>{pack.recommendation}</p>
              </CardContent>
            </Card>
          )}
          {pack.onePager && (
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-3 pb-3">
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.inkDis }}>Executive Summary</div>
                <p className="text-xs leading-relaxed" style={{ color: DS.inkSub }}>{pack.onePager}</p>
              </CardContent>
            </Card>
          )}
          {pack.keyRisks && (
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-3 pb-3">
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>Key Risks</div>
                {pack.keyRisks.map((r: string, i: number) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs mb-1">
                    <span style={{ color: DS.danger }}>⚠</span><span style={{ color: DS.inkSub }}>{r}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {pack.nextSteps && (
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-3 pb-3">
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>Next Steps</div>
                {pack.nextSteps.slice(0, 4).map((s: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs mb-1.5">
                    <span className="font-black w-4 shrink-0" style={{ color: DS.accent }}>{i+1}.</span>
                    <div><span style={{ color: DS.ink }}>{s.action}</span>{s.owner && <span style={{ color: DS.inkDis }}> — {s.owner}</span>}{s.deadline && <span style={{ color: DS.inkDis }}> by {s.deadline}</span>}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Print preview */}
      {previewing && pack && (
        <div className="fixed inset-0 z-50 bg-black/50 overflow-y-auto py-8 px-4 flex flex-col items-center">
          <div className="flex gap-3 mb-4 items-center w-full max-w-3xl">
            <span className="text-white text-sm font-bold flex-1">{session.name || 'Decision Package'} — Preview</span>
            <Button size="sm" style={{ background: DS.accent }} className="gap-1" onClick={print}><Printer size={12} /> Print / Save PDF</Button>
            <Button size="sm" variant="outline" className="gap-1 text-white border-white/30 hover:bg-white/10 hover:text-white" onClick={() => setPreviewing(false)}><EyeOff size={12} /> Close</Button>
          </div>
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl p-12" style={{ fontFamily: 'Georgia, serif', color: '#1a1a2e', lineHeight: 1.7 }}>
            <div style={{ borderBottom: '3px solid #0B1D3A', paddingBottom: 24, marginBottom: 32 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#6b75a0', marginBottom: 8 }}>Vantage DQ · Decision Package</div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, marginBottom: 10 }}>{session.name || session.decisionStatement?.slice(0, 70) || 'Decision Package'}</div>
              <div style={{ display: 'flex', gap: 24, fontSize: 12, color: '#6b75a0', flexWrap: 'wrap' }}>
                {session.owner && <span><strong>Owner:</strong> {session.owner}</span>}
                {session.deadline && <span><strong>Deadline:</strong> {session.deadline}</span>}
                <span><strong>Date:</strong> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <span><strong>DQ Score:</strong> {overall}/100 ({band.label})</span>
              </div>
            </div>
            {pack.recommendation && <div style={{ padding: '14px 18px', background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe', marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: '#2563eb', textTransform: 'uppercase', letterSpacing: 1 }}>Recommendation</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{pack.recommendation}</div>
            </div>}
            {pack.onePager && <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, color: '#2563eb' }}>Executive Summary</div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-line' }}>{pack.onePager}</div>
            </div>}
            {pack.boardNarrative && <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, color: '#2563eb' }}>Board Narrative</div>
              <div style={{ fontSize: 13, fontStyle: 'italic' }}>{pack.boardNarrative}</div>
            </div>}
            {pack.riskRegister?.length > 0 && <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, color: '#2563eb' }}>Risk Register</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ background: '#f1f5f9' }}>{['Risk', 'Likelihood', 'Impact', 'Mitigation'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>{h}</th>)}</tr></thead>
                <tbody>{pack.riskRegister.map((r: any, i: number) => <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '8px 12px' }}>{r.risk}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: r.likelihood === 'High' ? '#dc2626' : r.likelihood === 'Medium' ? '#d97706' : '#059669' }}>{r.likelihood}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: r.impact === 'High' ? '#dc2626' : r.impact === 'Medium' ? '#d97706' : '#059669' }}>{r.impact}</td>
                  <td style={{ padding: '8px 12px' }}>{r.mitigation}</td>
                </tr>)}</tbody>
              </table>
            </div>}
            {pack.nextSteps?.length > 0 && <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, color: '#2563eb' }}>Next Steps</div>
              {pack.nextSteps.map((s: any, i: number) => <div key={i} style={{ marginBottom: 10, padding: '10px 14px', background: '#f8faff', borderRadius: 6, borderLeft: '3px solid #2563eb' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{s.action}</div>
                <div style={{ fontSize: 11, color: '#6b75a0', display: 'flex', gap: 16 }}>
                  {s.owner && <span>Owner: {s.owner}</span>}{s.deadline && <span>By: {s.deadline}</span>}
                </div>
              </div>)}
            </div>}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, fontSize: 10, color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
              <span>Generated by Vantage DQ</span><span>{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}

      {!pack && !busy && (
        <div className="text-center py-16" style={{ color: DS.inkDis }}>
          <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Generate a board-ready decision package</p>
          <p className="text-xs mt-1">Select a format above then click Generate Package</p>
        </div>
      )}
    </div>
  );
}

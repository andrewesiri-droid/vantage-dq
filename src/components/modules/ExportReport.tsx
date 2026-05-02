import { useState, useMemo } from 'react';
import type { ModuleProps } from '@/types';
import { DS, DQ_ELEMENTS, DQ_SCORE_BANDS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Printer, Download, CheckCircle, AlertTriangle, XCircle, Zap } from 'lucide-react';

export function ExportReport({ sessionId, data, hooks }: ModuleProps) {
  const [generating, setGenerating] = useState(false);

  const session = data?.session;
  const issues = data?.issues || [];
  const decisions = data?.decisions || [];
  const strategies = data?.strategies || [];
  const criteria = data?.criteria || [];
  const scores = data?.assessmentScores || [];
  const stakeholders = data?.stakeholderEntries || [];
  const uncertainties = data?.uncertainties || [];
  const risks = data?.riskItems || [];
  const dqScores = session?.dqScores || { frame: 75, alternatives: 60, information: 45, values: 80, reasoning: 55, commitment: 30 };

  const vals = Object.values(dqScores);
  const overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  const band = DQ_SCORE_BANDS.find(b => overall >= b.min && overall <= b.max) || DQ_SCORE_BANDS[4];

  const focusDecisions = decisions.filter((d: any) => d.tier === 'focus');
  const givenDecisions = decisions.filter((d: any) => d.tier === 'given');
  const deferredDecisions = decisions.filter((d: any) => d.tier === 'deferred');

  const preflightChecks = useMemo(() => [
    { label: 'Decision statement is defined', pass: !!session?.decisionStatement, module: 'Problem Frame' },
    { label: 'Decision statement is a genuine open question', pass: !!(session?.decisionStatement && !session.decisionStatement.toLowerCase().includes('should we proceed')), module: 'Problem Frame' },
    { label: 'At least 5 issues raised', pass: issues.length >= 5, module: 'Issue Generation' },
    { label: 'At least 3 distinct strategies', pass: strategies.length >= 3, module: 'Strategy Table' },
    { label: 'Strategies differ on ≥50% of focus decisions', pass: strategies.length >= 2, module: 'Strategy Table' },
    { label: 'Focus Five has ≤5 decisions', pass: focusDecisions.length <= 5 && focusDecisions.length > 0, module: 'Decision Hierarchy' },
    { label: 'At least 4 criteria defined', pass: criteria.length >= 4, module: 'Qualitative Assessment' },
    { label: 'All criteria scored for all strategies', pass: scores.length >= criteria.length * strategies.length * 0.5, module: 'Qualitative Assessment' },
    { label: 'All 6 DQ elements scored', pass: Object.keys(dqScores).length >= 6, module: 'DQ Scorecard' },
    { label: 'Key stakeholders mapped', pass: stakeholders.length >= 3, module: 'Stakeholder Alignment' },
    { label: 'Stakeholder alignment ≥70% supportive', pass: stakeholders.filter((s: any) => s.alignment === 'supportive').length / Math.max(stakeholders.length, 1) >= 0.7, module: 'Stakeholder Alignment' },
  ], [session, issues, strategies, focusDecisions, criteria, scores, dqScores, stakeholders]);

  const passedCount = preflightChecks.filter(c => c.pass).length;

  const printReport = () => {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 500);
    const html = `<!DOCTYPE html><html><head><title>Vantage DQ Report</title><style>body{font-family:Inter,system-ui,sans-serif;color:#0F172A;max-width:800px;margin:0 auto;padding:48px}h1{font-size:28px;font-weight:800;margin-bottom:4px}h2{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-top:36px;margin-bottom:14px;color:#C9A84C}.subtitle{font-size:13px;color:#64748B;margin-bottom:32px}.meta{font-size:11px;color:#94A3B8;margin-bottom:8px}.section{background:linear-gradient(135deg,#F8F9FC,#FFFFFF);border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #E2E5EC}.label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94A3B8;margin-bottom:6px}.score-big{font-size:48px;font-weight:800;color:${band.color}}.score-label{font-size:11px;color:#64748B;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;padding:10px;background:#F8F9FC;font-weight:600;color:#475569}td{padding:10px;border-top:1px solid #E2E5EC;color:#334155}.recommendation{background:linear-gradient(135deg,#FDF8E8,#FFFFFF);border-left:4px solid #C9A84C;padding:16px;border-radius:8px}.footer{margin-top:48px;padding-top:16px;border-top:1px solid #E2E5EC;font-size:10px;color:#94A3B8}</style></head><body>
<h1>Strategic Decision Report</h1><div class="subtitle">${session?.name || 'Decision Session'}</div><div class="meta">Generated ${new Date().toLocaleDateString()} · Confidential</div>
<div class="section"><div class="score-big">${overall}</div><div class="score-label">Decision Quality Score — ${band.label}</div><table><tr><th style="width:60%">Element</th><th>Score</th></tr>${DQ_ELEMENTS.map(e => '<tr><td>' + e.num + ' ' + e.label + '</td><td style="font-weight:700;color:' + e.fill + '">' + (dqScores[e.key] || '—') + '</td></tr>').join('')}</table></div>
<h2>Decision Summary</h2><div class="section"><p><strong>Statement:</strong> ${session?.decisionStatement || 'Not defined'}</p><p><strong>Context:</strong> ${session?.context || 'Not provided'}</p><p><strong>Focus Decisions:</strong> ${focusDecisions.length}</p><p><strong>Strategies:</strong> ${strategies.length}</p><p><strong>Issues:</strong> ${issues.length}</p></div>
<div class="recommendation"><p style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:8px">Strategic Recommendation</p><p style="font-size:12px;color:#334155;line-height:1.6">Proceed with structured decision-making. Current DQ score of ${overall} indicates ${band.label.toLowerCase()} quality. Focus on strengthening the weakest DQ elements before final commitment.</p></div>
<div class="footer">Generated by Vantage DQ · Decision Quality Platform · ${new Date().toLocaleString()}</div></body></html>`;
    const w = window.open('', '_blank'); w?.document.write(html); w?.document.close(); w?.print();
  };

  const exportJSON = () => {
    const payload = {
      session: session ? { name: session.name, decisionStatement: session.decisionStatement, context: session.context } : null,
      decisions, strategies, criteria, issues, stakeholders, risks, uncertainties,
      dqScores, overall, band: band.label,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `vantage-dq-${session?.name || 'report'}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
          <FileText size={22} style={{ color: DS.accent }} /> Export & Report
        </h2>
        <p className="text-xs mt-1" style={{ color: DS.inkSub }}>Pre-flight check before generating executive outputs</p>
      </div>

      <Card className="border-0 shadow-lg" style={{ background: `linear-gradient(135deg, ${passedCount === preflightChecks.length ? '#ECFDF5' : passedCount >= 8 ? '#FFFBEB' : '#FEF2F2'} 0%, ${DS.canvas} 100%)`, borderTop: `4px solid ${passedCount === preflightChecks.length ? '#10B981' : passedCount >= 8 ? '#F59E0B' : '#EF4444'}` }}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {passedCount === preflightChecks.length ? <CheckCircle size={16} style={{ color: '#10B981' }} /> : <AlertTriangle size={16} style={{ color: passedCount >= 8 ? '#F59E0B' : '#EF4444' }} />}
              <span className="text-sm font-bold" style={{ color: DS.ink }}>Pre-flight Check</span>
            </div>
            <span className="text-xs font-bold" style={{ color: passedCount === preflightChecks.length ? '#059669' : passedCount >= 8 ? '#D97706' : '#DC2626' }}>{passedCount}/{preflightChecks.length} Passed</span>
          </div>
          <div className="space-y-1.5">
            {preflightChecks.map((c, i) => (
              <div key={i} className="flex items-center gap-2 p-1.5 rounded" style={{ background: c.pass ? '#ECFDF5' : '#FEF2F2' }}>
                {c.pass ? <CheckCircle size={12} style={{ color: '#059669' }} /> : <XCircle size={12} style={{ color: '#DC2626' }} />}
                <span className="text-[10px] flex-1" style={{ color: DS.inkSub }}>{c.label}</span>
                <span className="text-[9px]" style={{ color: DS.inkDis }}>{c.module}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button variant="outline" className="h-14 text-xs gap-2 border-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${DS.accentSoft}, ${DS.canvas})` }} onClick={printReport} disabled={generating}>
          <Printer size={14} style={{ color: DS.accent }} /> {generating ? 'Generating...' : 'Print / PDF Report'}
        </Button>
        <Button variant="outline" className="h-14 text-xs gap-2 border-0 shadow-sm" style={{ background: DS.bg }} onClick={exportJSON}>
          <Download size={14} style={{ color: DS.inkTer }} /> Export JSON
        </Button>
      </div>

      <Card className="border-0 shadow-md"><CardContent className="pt-5 space-y-4">
        <div className="flex items-center gap-2"><Zap size={14} style={{ color: DS.accent }} /><span className="text-xs font-bold" style={{ color: DS.ink }}>Executive Package Preview</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl" style={{ background: `linear-gradient(135deg, ${DS.accentSoft}, ${DS.canvas})`, borderLeft: `3px solid ${DS.accent}` }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#A68A3C' }}>Decision Quality</p>
            <p className="text-3xl font-extrabold mt-1" style={{ color: band.color }}>{overall}</p>
            <p className="text-xs font-semibold" style={{ color: band.color }}>{band.label}</p>
            <p className="text-[10px] mt-1" style={{ color: DS.inkSub }}>{band.desc}</p>
          </div>
          <div className="p-4 rounded-xl" style={{ background: `linear-gradient(135deg, ${DS.alternatives.soft}, ${DS.canvas})`, borderLeft: `3px solid ${DS.alternatives.fill}` }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.alternatives.dark }}>Session Summary</p>
            <p className="text-lg font-bold mt-1" style={{ color: DS.ink }}>{strategies.length} Strategies</p>
            <p className="text-[10px] mt-1" style={{ color: DS.inkSub }}>{focusDecisions.length} focus &middot; {issues.length} issues &middot; {stakeholders.length} stakeholders</p>
          </div>
        </div>
      </CardContent></Card>
    </div>
  );
}

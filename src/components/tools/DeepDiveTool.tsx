import { useState } from 'react';
import type { ModuleProps } from '@/types';
import { DS, DQ_ELEMENTS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Sparkles, ChevronRight, AlertTriangle, CheckCircle, Flame } from 'lucide-react';

export function DeepDiveTool({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [results, setResults] = useState<any>(null);
  const [currentPass, setCurrentPass] = useState(0);
  const [passResults, setPassResults] = useState<any[]>([]);

  const session = data?.session || {};
  const issues = data?.issues || [];
  const decisions = data?.decisions || [];
  const strategies = data?.strategies || [];
  const criteria = data?.criteria || [];
  const dqScores = session.dqScores || {};

  const runDeepDive = async () => {
    setPassResults([]);
    setCurrentPass(1);

    const ctx = `Decision: "${session.decisionStatement || 'Not set'}"\nContext: ${(session.context || '').slice(0, 300)}\nIssues: ${issues.length} (${issues.filter((i: any) => i.severity === 'Critical').length} critical)\nDecisions: ${decisions.length} (${decisions.filter((d: any) => d.tier === 'focus').length} focus)\nStrategies: ${strategies.length}\nCriteria: ${criteria.length}\nDQ Scores: ${JSON.stringify(dqScores)}`;

    // Pass 1: Frame & Problem Quality
    call(`You are a DQ expert doing a deep audit. Pass 1 of 6: PROBLEM FRAME.\n${ctx}\n\nReturn JSON: { passName: "Problem Frame", score: 0-100, findings: [{type:"strength"|"weakness"|"gap", text: string}], topRisk: string, topAction: string }`, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
      if (result && !result.error) setPassResults(p => [...p, result]);
      setCurrentPass(2);

      // Pass 2: Alternatives
      call(`DQ deep audit. Pass 2 of 6: ALTERNATIVES.\n${ctx}\n\nStrategies: ${strategies.map((s: any) => s.name + ': ' + (s.objective || s.description || '')).join('; ')}\n\nReturn JSON: { passName: "Alternatives", score: 0-100, findings: [{type:"strength"|"weakness"|"gap", text: string}], topRisk: string, topAction: string }`, (r2) => {
        let r2r = r2;
        if (r2?._raw) { try { r2r = JSON.parse((r2._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
        if (r2r && !r2r.error) setPassResults(p => [...p, r2r]);
        setCurrentPass(3);

        // Pass 3: Information
        call(`DQ deep audit. Pass 3 of 6: INFORMATION QUALITY.\n${ctx}\n\nReturn JSON: { passName: "Information", score: 0-100, findings: [{type:"strength"|"weakness"|"gap", text: string}], topRisk: string, topAction: string }`, (r3) => {
          let r3r = r3;
          if (r3?._raw) { try { r3r = JSON.parse((r3._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
          if (r3r && !r3r.error) setPassResults(p => [...p, r3r]);
          setCurrentPass(4);

          // Pass 4-6 combined for efficiency
          call(`DQ deep audit. Passes 4-6: VALUES, REASONING, COMMITMENT.\n${ctx}\n\nReturn JSON: { passes: [ { passName: "Values & Criteria", score: 0-100, findings: [{type:"strength"|"weakness"|"gap", text: string}], topRisk: string, topAction: string }, { passName: "Reasoning", score: 0-100, findings: [{type:"strength"|"weakness"|"gap", text: string}], topRisk: string, topAction: string }, { passName: "Commitment", score: 0-100, findings: [{type:"strength"|"weakness"|"gap", text: string}], topRisk: string, topAction: string } ], overallVerdict: string, readinessLevel: "Ready"|"Conditional"|"Not Ready", topThreeActions: [string, string, string] }`, (r456) => {
            let r456r = r456;
            if (r456?._raw) { try { r456r = JSON.parse((r456._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
            if (r456r?.passes) {
              setPassResults(p => [...p, ...r456r.passes]);
              setResults(r456r);
            }
            setCurrentPass(0);
          });
        });
      });
    });
  };

  const overallScore = passResults.length ? Math.round(passResults.reduce((a, p) => a + (p.score || 0), 0) / passResults.length) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
            <Brain size={22} style={{ color: '#10B981' }} /> AI Deep Dive
          </h2>
          <p className="text-xs mt-1" style={{ color: DS.inkSub }}>Full 6-pass DQ audit across all dimensions — frame, alternatives, information, values, reasoning, commitment</p>
        </div>
        <Button size="sm" className="gap-1.5" style={{ background: '#10B981' }} onClick={runDeepDive} disabled={busy || currentPass > 0}>
          <Sparkles size={12} /> {currentPass > 0 ? `Running Pass ${currentPass}/6…` : 'Run Deep Dive'}
        </Button>
      </div>

      {/* Progress */}
      {currentPass > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>Running audit…</p>
          <div className="flex gap-1">
            {[1,2,3,4,5,6].map(n => (
              <div key={n} className="flex-1 h-1.5 rounded-full transition-all" style={{ background: n < currentPass ? '#10B981' : n === currentPass ? '#10B98160' : DS.borderLight }} />
            ))}
          </div>
          {DQ_ELEMENTS.slice(0, currentPass - 1).map((el, i) => (
            <p key={i} className="text-[10px] flex items-center gap-1" style={{ color: DS.success }}>
              <CheckCircle size={10} /> Pass {i+1}: {el.short} complete
            </p>
          ))}
        </div>
      )}

      {/* Overall score */}
      {passResults.length > 0 && (
        <Card className="border-0 shadow-sm" style={{ borderLeft: `4px solid #10B981` }}>
          <CardContent className="pt-4 pb-4 flex items-center gap-6">
            <div className="text-center shrink-0">
              <div className="text-5xl font-black" style={{ color: overallScore >= 70 ? DS.success : overallScore >= 45 ? DS.warning : DS.danger }}>{overallScore}</div>
              <div className="text-[10px] mt-1" style={{ color: DS.inkDis }}>Overall DQ</div>
            </div>
            <div className="flex-1">
              {results?.readinessLevel && (
                <Badge className="mb-2" style={{ background: results.readinessLevel === 'Ready' ? DS.successSoft : results.readinessLevel === 'Conditional' ? DS.warnSoft : DS.dangerSoft, color: results.readinessLevel === 'Ready' ? DS.success : results.readinessLevel === 'Conditional' ? DS.warning : DS.danger, border: 'none' }}>
                  {results.readinessLevel}
                </Badge>
              )}
              {results?.overallVerdict && <p className="text-sm font-medium" style={{ color: DS.ink }}>{results.overallVerdict}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 3 actions */}
      {results?.topThreeActions && (
        <Card className="border-0 shadow-sm" style={{ background: DS.accentSoft, borderLeft: `4px solid ${DS.accent}` }}>
          <CardContent className="pt-3 pb-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.accent }}>Top 3 Priority Actions</p>
            {results.topThreeActions.map((a: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="font-black w-4 shrink-0" style={{ color: DS.accent }}>{i+1}.</span>
                <span style={{ color: DS.ink }}>{a}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pass results */}
      <div className="grid gap-3 sm:grid-cols-2">
        {passResults.map((pass, i) => {
          const el = DQ_ELEMENTS[i] || DQ_ELEMENTS[0];
          const col = pass.score >= 70 ? DS.success : pass.score >= 45 ? DS.warning : DS.danger;
          return (
            <Card key={i} className="border-0 shadow-sm overflow-hidden">
              <div className="h-1" style={{ background: `linear-gradient(to right, ${col} ${pass.score}%, ${DS.borderLight} ${pass.score}%)` }} />
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold" style={{ color: DS.ink }}>{pass.passName}</span>
                  <span className="text-lg font-black" style={{ color: col }}>{pass.score}</span>
                </div>
                <div className="space-y-1">
                  {(pass.findings || []).slice(0, 3).map((f: any, j: number) => (
                    <div key={j} className="flex items-start gap-1.5 text-[10px]">
                      {f.type === 'strength' ? <CheckCircle size={10} style={{ color: DS.success, flexShrink: 0, marginTop: 1 }} /> : f.type === 'weakness' ? <AlertTriangle size={10} style={{ color: DS.warning, flexShrink: 0, marginTop: 1 }} /> : <Flame size={10} style={{ color: DS.danger, flexShrink: 0, marginTop: 1 }} />}
                      <span style={{ color: DS.inkSub }}>{f.text}</span>
                    </div>
                  ))}
                </div>
                {pass.topAction && <p className="text-[10px] mt-2 font-medium" style={{ color: '#10B981' }}>→ {pass.topAction}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {passResults.length === 0 && currentPass === 0 && (
        <div className="text-center py-16" style={{ color: DS.inkDis }}>
          <Brain size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Run a Deep Dive to get a full 6-pass DQ audit</p>
          <p className="text-xs mt-1">Analyses all 6 DQ dimensions and surfaces your top priority actions</p>
        </div>
      )}
    </div>
  );
}

/**
 * DecisionLineage — Decision Traceability + Exec Compression
 * 
 * Shows the full reasoning chain:
 * Strategy → Criteria → Assumptions → Uncertainties → Recommendation
 * 
 * Plus adaptive exec summaries:
 * - 3-line brief
 * - 1-page board summary  
 * - "If wrong, here's why"
 */
import { useState } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronDown, ChevronUp, ArrowRight, AlertTriangle, CheckCircle, Target, TrendingUp } from 'lucide-react';
import { ModuleDataBanner } from '@/components/ui/module-data-banner';
import { toastAIError } from '@/lib/toast';
import { validateModuleData, buildContractPrompt, buildDataInventoryDisplay, checkFrameGate, computeMechanicalRecommendation } from '@/lib/dq-data-contracts';
import { DQTrustBadge } from '@/components/ui/dq-trust-badge';
import { useDQAI } from '@/hooks/useDQAI';

export function DecisionLineage({ sessionId, data }: ModuleProps) {
  const [brief, setBrief] = useState<any>(null);
  const [lineage, setLineage] = useState<any>(null);
  const [riskSplit, setRiskSplit] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>('brief');
  const { call: dqCall, busy, lastResult } = useDQAI();

  const session = data?.session || {};
  const strategies = data?.strategies || [];
  const criteria = data?.criteria || [];
  const issues = data?.issues || [];
  const uncertainties = data?.uncertainties || [];
  const scenarios = data?.scenarios || [];
  const stakeholders = data?.stakeholderEntries || [];
  const risks = data?.riskItems || [];
  const dqScores = session.dqScores || {};

  const preferred = strategies.find((s: any) => s.isPreferred) || strategies[0];
  const criticalIssues = issues.filter((i: any) => i.severity === 'Critical');
  const highRisks = risks.filter((r: any) => r.impact === 'Critical' || r.impact === 'High');

  const mechanicalRec = computeMechanicalRecommendation(data);
  const frameGate = checkFrameGate(data);

  const aiGenerateBrief = async () => {
    const validation = validateModuleData('decision-lineage', data);
    const contractRules = buildContractPrompt('decision-lineage', data);
    const dataInventory = buildDataInventoryDisplay(data);
    const prompt = `${contractRules}

Generate an executive decision brief for this decision.

Decision: ${session.decisionStatement || ''}
Context: ${(session.context || '').slice(0, 300)}
Recommended strategy: ${preferred?.name || 'Not selected'}
Strategy rationale: ${preferred?.rationale || ''}
Key criteria: ${criteria.slice(0,5).map((c: any) => c.label + ' (' + c.weight + ')').join(', ')}
DQ scores: Frame=${dqScores.frame||0}, Alternatives=${dqScores.alternatives||0}, Information=${dqScores.information||0}, Values=${dqScores.values||0}, Reasoning=${dqScores.reasoning||0}, Commitment=${dqScores.commitment||0}
Critical issues (${criticalIssues.length}): ${criticalIssues.slice(0,3).map((i: any) => i.text).join('; ')}
Key uncertainties: ${uncertainties.slice(0,4).map((u: any) => u.label).join('; ')}
High risks: ${highRisks.slice(0,3).map((r: any) => r.label).join('; ')}
Deadline: ${session.deadline || 'Not set'}

Generate THREE outputs:

1. THREE-LINE BRIEF (for a busy executive who has 30 seconds):
   - Line 1: What decision is being made
   - Line 2: What we recommend and why in one sentence
   - Line 3: What could make us wrong

2. CONFIDENCE vs RISK SEPARATION:
   - Analysis confidence: how sure are we the analysis is correct?
   - Outcome risk: how uncertain is the real-world outcome even if analysis is right?
   - Key distinction: explain the difference in plain language

3. DECISION LINEAGE (traceability chain):
   - Recommended strategy → which criteria it scores best on → key assumptions behind it → uncertainties that could undermine it → scenarios where it fails

4. IF WE ARE WRONG (brutal honest section):
   - Top 3 reasons this recommendation could be wrong
   - What early warning signals would tell us we're off track
   - What would trigger a strategy change

Return JSON: {
  threeLineBrief: { line1: string, line2: string, line3: string },
  confidenceVsRisk: { analysisConfidence: "High|Medium|Low", analysisRationale: string, outcomeRisk: "High|Medium|Low", outcomeRationale: string, plainLanguage: string },
  lineage: { strategy: string, winningCriteria: [string], keyAssumptions: [string], threateningUncertainties: [string], failureScenarios: [string] },
  ifWeAreWrong: { reasons: [string], earlyWarnings: [string], triggerForChange: string },
  boardReadiness: "Ready|Conditional|Not Ready",
  boardReadinessRationale: string,
  meta: { confidenceLevel: string, dqWarnings: [], assumptionsMade: [], caveat: string }
}`;

    const result = await dqCall(prompt, { module: 'decision-lineage', dqElement: 'Reasoning', sessionData: data || {} });
    if (result?.data) {
      setBrief(result.data.threeLineBrief);
      setLineage(result.data.lineage);
      setRiskSplit(result.data.confidenceVsRisk);
    }
  };

  const readinessColor = (r: string) => r === 'Ready' ? DS.success : r === 'Conditional' ? DS.warning : DS.danger;
  const riskColor = (r: string) => r === 'High' ? DS.danger : r === 'Medium' ? DS.warning : DS.success;

  return (
    <div className="space-y-4">
      <ModuleDataBanner moduleId="decision-lineage" data={data} />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>DECISION OS</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Decision Lineage</h2>
          <p className="text-xs mt-0.5" style={{ color: DS.inkSub }}>Full traceability from strategy to recommendation</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs h-8" style={{ background: DS.accent }} onClick={aiGenerateBrief} disabled={busy}>
          <Sparkles size={11} /> {busy ? 'Generating…' : 'Generate Executive Brief'}
        </Button>
      </div>

      {/* Board readiness strip */}
      {data?.data?.boardReadiness && (
        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: readinessColor(data.data.boardReadiness) + '15', border: `1px solid ${readinessColor(data.data.boardReadiness)}30` }}>
          <div className="text-xs font-bold" style={{ color: readinessColor(data.data.boardReadiness) }}>Board Readiness: {data.data.boardReadiness}</div>
          <div className="text-xs" style={{ color: DS.inkSub }}>{data.data.boardReadinessRationale}</div>
        </div>
      )}

      {/* Trust badge */}
      {lastResult?.trust && <DQTrustBadge trust={lastResult.trust} meta={lastResult.meta} />}

      {/* Empty state */}
      {/* Mechanical recommendation */}
      {mechanicalRec.traceable && (
        <div className="rounded-xl p-4 flex items-start gap-3 mb-2" style={{ background: mechanicalRec.confidence === 'High' ? DS.successSoft : DS.warnSoft, border: '1px solid ' + (mechanicalRec.confidence === 'High' ? DS.success : DS.warning) + '30' }}>
          <div className="flex-1">
            <div className="text-[9px] font-bold uppercase mb-1" style={{ color: mechanicalRec.confidence === 'High' ? DS.success : DS.warning }}>MECHANICALLY COMPUTED — {mechanicalRec.confidence} CONFIDENCE</div>
            <div className="text-sm font-bold" style={{ color: DS.ink }}>{mechanicalRec.recommendedStrategy}</div>
            <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>{mechanicalRec.traceability}</p>
          </div>
          <div className="text-3xl font-black" style={{ color: mechanicalRec.confidence === 'High' ? DS.success : DS.warning }}>{mechanicalRec.scores[mechanicalRec.recommendedStrategy!]}%</div>
        </div>
      )}

      {!brief && !busy && (
        <div className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-16 text-center px-8" style={{ borderColor: DS.borderLight }}>
          <Target size={32} className="mb-3" style={{ color: DS.inkDis }} />
          <p className="text-sm font-semibold mb-1" style={{ color: DS.ink }}>Decision traceability not yet generated</p>
          <p className="text-xs mb-4" style={{ color: DS.inkDis }}>Click Generate Executive Brief to produce the full reasoning chain, 3-line brief, and board readiness assessment</p>
          <Button size="sm" className="gap-1.5" style={{ background: DS.accent }} onClick={aiGenerateBrief} disabled={busy || !session.decisionStatement}>
            <Sparkles size={13} /> Generate Now
          </Button>
          {!session.decisionStatement && <p className="text-[10px] mt-2" style={{ color: DS.warning }}>Add a decision statement in Problem Frame first</p>}
        </div>
      )}

      {/* 3-Line Brief */}
      {brief && (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
          <button className="w-full flex items-center justify-between px-4 py-3" style={{ background: DS.accent + '10' }} onClick={() => setExpanded(expanded === 'brief' ? null : 'brief')}>
            <span className="text-sm font-bold" style={{ color: DS.accent }}>3-Line Executive Brief</span>
            {expanded === 'brief' ? <ChevronUp size={14} style={{ color: DS.accent }} /> : <ChevronDown size={14} style={{ color: DS.accent }} />}
          </button>
          {expanded === 'brief' && (
            <div className="p-4 space-y-3">
              {[brief.line1, brief.line2, brief.line3].map((line: string, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-0.5" style={{ background: i === 0 ? DS.information.fill : i === 1 ? DS.success : DS.warning }}>{i + 1}</div>
                  <p className="text-sm" style={{ color: DS.ink }}>{line}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confidence vs Risk Separation */}
      {riskSplit && (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
          <button className="w-full flex items-center justify-between px-4 py-3" style={{ background: DS.bg }} onClick={() => setExpanded(expanded === 'risk' ? null : 'risk')}>
            <span className="text-sm font-bold" style={{ color: DS.ink }}>Confidence vs Outcome Risk</span>
            {expanded === 'risk' ? <ChevronUp size={14} style={{ color: DS.inkDis }} /> : <ChevronDown size={14} style={{ color: DS.inkDis }} />}
          </button>
          {expanded === 'risk' && (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{ background: riskColor(riskSplit.analysisConfidence) + '10', border: `1px solid ${riskColor(riskSplit.analysisConfidence)}25` }}>
                  <div className="text-[9px] font-bold uppercase mb-1" style={{ color: riskColor(riskSplit.analysisConfidence) }}>Analysis Confidence</div>
                  <div className="text-lg font-black mb-1" style={{ color: riskColor(riskSplit.analysisConfidence) }}>{riskSplit.analysisConfidence}</div>
                  <p className="text-[10px]" style={{ color: DS.inkSub }}>{riskSplit.analysisRationale}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: riskColor(riskSplit.outcomeRisk) + '10', border: `1px solid ${riskColor(riskSplit.outcomeRisk)}25` }}>
                  <div className="text-[9px] font-bold uppercase mb-1" style={{ color: riskColor(riskSplit.outcomeRisk) }}>Outcome Risk</div>
                  <div className="text-lg font-black mb-1" style={{ color: riskColor(riskSplit.outcomeRisk) }}>{riskSplit.outcomeRisk}</div>
                  <p className="text-[10px]" style={{ color: DS.inkSub }}>{riskSplit.outcomeRationale}</p>
                </div>
              </div>
              <p className="text-xs p-3 rounded-xl" style={{ background: DS.accentSoft, color: DS.ink }}>{riskSplit.plainLanguage}</p>
            </div>
          )}
        </div>
      )}

      {/* Decision Lineage Chain */}
      {lineage && (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: DS.borderLight }}>
          <button className="w-full flex items-center justify-between px-4 py-3" style={{ background: DS.bg }} onClick={() => setExpanded(expanded === 'lineage' ? null : 'lineage')}>
            <span className="text-sm font-bold" style={{ color: DS.ink }}>Decision Reasoning Chain</span>
            {expanded === 'lineage' ? <ChevronUp size={14} style={{ color: DS.inkDis }} /> : <ChevronDown size={14} style={{ color: DS.inkDis }} />}
          </button>
          {expanded === 'lineage' && (
            <div className="p-4">
              <div className="flex flex-col gap-3">
                {/* Strategy */}
                <div className="rounded-xl p-3" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
                  <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.accent }}>RECOMMENDED STRATEGY</div>
                  <p className="text-sm font-bold" style={{ color: DS.ink }}>{lineage.strategy}</p>
                </div>
                <div className="flex justify-center"><ArrowRight size={16} style={{ color: DS.inkDis }} /></div>
                {/* Winning criteria */}
                <div className="rounded-xl p-3" style={{ background: DS.successSoft, border: `1px solid ${DS.success}30` }}>
                  <div className="text-[9px] font-bold uppercase mb-2" style={{ color: DS.success }}>WINS ON CRITERIA</div>
                  {lineage.winningCriteria?.map((c: string, i: number) => <p key={i} className="text-xs mb-1" style={{ color: DS.ink }}>✓ {c}</p>)}
                </div>
                <div className="flex justify-center"><ArrowRight size={16} style={{ color: DS.inkDis }} /></div>
                {/* Key assumptions */}
                <div className="rounded-xl p-3" style={{ background: DS.information.soft, border: `1px solid ${DS.information.fill}30` }}>
                  <div className="text-[9px] font-bold uppercase mb-2" style={{ color: DS.information.fill }}>DEPENDS ON ASSUMPTIONS</div>
                  {lineage.keyAssumptions?.map((a: string, i: number) => <p key={i} className="text-xs mb-1" style={{ color: DS.ink }}>→ {a}</p>)}
                </div>
                <div className="flex justify-center"><ArrowRight size={16} style={{ color: DS.inkDis }} /></div>
                {/* Threatening uncertainties */}
                <div className="rounded-xl p-3" style={{ background: DS.warnSoft, border: `1px solid ${DS.warning}30` }}>
                  <div className="text-[9px] font-bold uppercase mb-2" style={{ color: DS.warning }}>THREATENED BY UNCERTAINTIES</div>
                  {lineage.threateningUncertainties?.map((u: string, i: number) => <p key={i} className="text-xs mb-1" style={{ color: DS.ink }}>⚠ {u}</p>)}
                </div>
                <div className="flex justify-center"><ArrowRight size={16} style={{ color: DS.inkDis }} /></div>
                {/* Failure scenarios */}
                <div className="rounded-xl p-3" style={{ background: DS.dangerSoft, border: `1px solid ${DS.danger}30` }}>
                  <div className="text-[9px] font-bold uppercase mb-2" style={{ color: DS.danger }}>FAILS IN SCENARIOS</div>
                  {lineage.failureScenarios?.map((s: string, i: number) => <p key={i} className="text-xs mb-1" style={{ color: DS.ink }}>✗ {s}</p>)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* If We Are Wrong */}
      {brief && (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: DS.danger + '40' }}>
          <button className="w-full flex items-center justify-between px-4 py-3" style={{ background: DS.dangerSoft }} onClick={() => setExpanded(expanded === 'wrong' ? null : 'wrong')}>
            <span className="text-sm font-bold" style={{ color: DS.danger }}>If We Are Wrong</span>
            {expanded === 'wrong' ? <ChevronUp size={14} style={{ color: DS.danger }} /> : <ChevronDown size={14} style={{ color: DS.danger }} />}
          </button>
          {expanded === 'wrong' && lastResult?.data?.ifWeAreWrong && (
            <div className="p-4 space-y-3">
              <div>
                <div className="text-[9px] font-bold uppercase mb-2" style={{ color: DS.danger }}>Top Reasons We Could Be Wrong</div>
                {lastResult.data.ifWeAreWrong.reasons?.map((r: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 mb-2">
                    <AlertTriangle size={12} style={{ color: DS.danger, flexShrink: 0, marginTop: 2 }} />
                    <p className="text-xs" style={{ color: DS.ink }}>{r}</p>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase mb-2" style={{ color: DS.warning }}>Early Warning Signals</div>
                {lastResult.data.ifWeAreWrong.earlyWarnings?.map((w: string, i: number) => (
                  <p key={i} className="text-xs mb-1" style={{ color: DS.inkSub }}>📡 {w}</p>
                ))}
              </div>
              {lastResult.data.ifWeAreWrong.triggerForChange && (
                <div className="rounded-xl p-3" style={{ background: DS.warnSoft, border: `1px solid ${DS.warning}30` }}>
                  <div className="text-[9px] font-bold uppercase mb-1" style={{ color: DS.warning }}>Trigger for Strategy Change</div>
                  <p className="text-xs" style={{ color: DS.ink }}>{lastResult.data.ifWeAreWrong.triggerForChange}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

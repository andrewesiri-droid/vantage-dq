import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, CheckCircle, AlertCircle, ChevronRight, Lightbulb, Wand2 } from 'lucide-react';

const TABS = [
  { id: 'context', num: '1', label: 'Context' },
  { id: 'frame', num: '2', label: 'Decision Frame' },
  { id: 'scope', num: '3', label: 'Scope & Boundaries' },
  { id: 'success', num: '4', label: 'Success Measures' },
  { id: 'ai', num: '5', label: 'AI Frame Check', hasIndicator: true },
];

const DQ_PRINCIPLES: Record<string, string> = {
  context: 'Context sets the frame. A good context statement describes the situation and stakes without proposing solutions. Teams that skip context often solve the wrong problem beautifully.',
  frame: 'The decision statement is the most powerful tool in DQ. It must be a genuine open question — not a situation description, not a solution in disguise. Test it: could the answer be "no"?',
  scope: 'Explicit scope prevents two failure modes: paralysis (scope too broad) and blind spots (scope too narrow). What is out of scope is as important as what is in scope.',
  success: 'Success criteria defined before analysis prevent post-hoc rationalisation. If you cannot describe what "good" looks like, you are not ready to evaluate alternatives.',
  ai: 'The AI Frame Check applies the DQ standard to your decision frame. A strong frame scores above 70. Below 50 indicates the team may be solving the wrong problem.',
};

interface FrameData {
  situation: string; whyMatters: string; background: string;
  decisionStatement: string; rootDecision: string; trigger: string;
  scopeIn: string; scopeOut: string; constraints: string; assumptions: string;
  successCriteria: string; failureConsequences: string; owner: string; deadline: string;
}

const DEFAULT: FrameData = {
  situation: '', whyMatters: '', background: '',
  decisionStatement: '', rootDecision: '', trigger: '',
  scopeIn: '', scopeOut: '', constraints: '', assumptions: '',
  successCriteria: '', failureConsequences: '', owner: '', deadline: '',
};

export function ProblemFrame({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [activeTab, setActiveTab] = useState('context');
  const [fd, setFd] = useState<FrameData>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [frameCheck, setFrameCheck] = useState<any>(null);
  const [improvements, setImprovements] = useState<any[]>([]);

  useEffect(() => {
    if (data?.session) {
      const s = data.session;
      setFd({
        situation: s.context || '',
        whyMatters: s.trigger || '',
        background: s.background || '',
        decisionStatement: s.decisionStatement || '',
        rootDecision: s.rootDecision || '',
        trigger: s.trigger || '',
        scopeIn: s.scopeIn || '',
        scopeOut: s.scopeOut || '',
        constraints: s.constraints || '',
        assumptions: s.assumptions || '',
        successCriteria: s.successCriteria || '',
        failureConsequences: s.failureConsequences || '',
        owner: s.owner || '',
        deadline: s.deadline || '',
      });
    }
  }, [data?.session]);

  const set = (key: keyof FrameData, val: string) => setFd(p => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    if (sessionId && hooks?.updateSession) {
      await hooks.updateSession({ id: sessionId, data: {
        context: fd.situation, background: fd.background, trigger: fd.whyMatters,
        decisionStatement: fd.decisionStatement, scopeIn: fd.scopeIn, scopeOut: fd.scopeOut,
        constraints: fd.constraints, assumptions: fd.assumptions,
        successCriteria: fd.successCriteria, failureConsequences: fd.failureConsequences,
        owner: fd.owner, deadline: fd.deadline,
      }});
    }
    setSaving(false);
  };

  // DQ checks
  const checks = [
    { label: 'Genuine open question', pass: fd.decisionStatement.length > 20 && fd.decisionStatement.includes('?') },
    { label: 'Scope explicitly bounded', pass: !!(fd.scopeIn?.trim() && fd.scopeOut?.trim()) },
    { label: 'Decision owner named', pass: !!fd.owner?.trim() },
    { label: 'Deadline or timeframe set', pass: !!fd.deadline?.trim() },
  ];
  const passCount = checks.filter(c => c.pass).length;
  const completionPct = Math.round(
    ([fd.situation, fd.decisionStatement, fd.scopeIn, fd.scopeOut, fd.successCriteria].filter(Boolean).length / 5) * 100
  );

  const runFrameCheck = () => {
    const prompt = `Run a comprehensive DQ frame check.\nDecision Statement: "${fd.decisionStatement}"\nContext: ${fd.situation}\nScope In: ${fd.scopeIn}\nScope Out: ${fd.scopeOut}\nOwner: ${fd.owner}\nDeadline: ${fd.deadline}\nConstraints: ${fd.constraints}\nSuccess Criteria: ${fd.successCriteria}\n\nReturn JSON: { overallScore: 0-100, band: "Elite|Strong|Adequate|Weak|High-Risk", summary: string, checks: [{name: string, pass: boolean, note: string}], improvements: [{field: string, current: string, suggestion: string, reason: string}], verdict: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
      if (result && !result.error) {
        setFrameCheck(result);
        setImprovements(result.improvements || []);
        setActiveTab('ai');
      }
    });
  };

  const applyImprovement = (imp: any) => {
    const fieldMap: Record<string, keyof FrameData> = {
      decisionStatement: 'decisionStatement', context: 'situation', situation: 'situation',
      scopeIn: 'scopeIn', scopeOut: 'scopeOut', constraints: 'constraints',
      assumptions: 'assumptions', successCriteria: 'successCriteria', owner: 'owner', deadline: 'deadline',
    };
    const key = fieldMap[imp.field?.toLowerCase?.()?.replace(/\s/g, '')] || fieldMap[imp.field];
    if (key) set(key, imp.suggestion);
  };

  const dqScore = frameCheck?.overallScore;
  const scoreColor = dqScore >= 70 ? DS.success : dqScore >= 45 ? DS.warning : DS.danger;

  return (
    <div className="space-y-0">
      {/* Module header bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black px-2 py-1 rounded text-white" style={{ background: DS.frame.fill }}>01</span>
          <h2 className="text-lg font-bold" style={{ color: DS.ink }}>Problem Definition</h2>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-[10px]" style={{ color: DS.inkDis }}>COMPLETION</span>
          <span className="text-sm font-black" style={{ color: DS.frame.fill }}>{completionPct}%</span>
        </div>
        {dqScore !== undefined && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: DS.inkDis }}>DQ SCORE</span>
            <span className="text-sm font-black" style={{ color: scoreColor }}>{dqScore}</span>
          </div>
        )}
        <div className="flex-1" />
        {improvements.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" style={{ borderColor: DS.warning, color: DS.warning }}
            onClick={() => { improvements.slice(0, 3).forEach(applyImprovement); setImprovements([]); }}>
            <Wand2 size={11} /> Apply Improvements ({improvements.length})
          </Button>
        )}
        <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.frame.fill }} onClick={runFrameCheck} disabled={busy}>
          <Sparkles size={11} /> {busy ? 'Checking…' : 'AI Frame Check'}
        </Button>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b mb-5" style={{ borderColor: DS.borderLight }}>
        {TABS.map((tab, i) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium relative transition-colors"
            style={{ color: activeTab === tab.id ? DS.frame.fill : DS.inkTer, borderBottom: activeTab === tab.id ? `2px solid ${DS.frame.fill}` : '2px solid transparent', marginBottom: -1 }}>
            <span className="text-[9px] font-bold opacity-60">{tab.num}.</span> {tab.label}
            {tab.id === 'ai' && frameCheck && (
              <span className="w-1.5 h-1.5 rounded-full ml-0.5" style={{ background: scoreColor }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab: Context */}
      {activeTab === 'context' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-1" style={{ color: DS.ink }}>What is the situation?</h3>
            <p className="text-xs mb-4" style={{ color: DS.inkTer }}>Describe the situation or opportunity that triggered this decision — without jumping to solutions. Focus on context, not answers.</p>
            <FieldBlock label="SITUATION / CONTEXT" required hint="Describe the situation, not the solution">
              <Textarea value={fd.situation} onChange={e => set('situation', e.target.value)} rows={4} className="text-sm resize-none" placeholder="Our current revenue is concentrated in North America and Europe. The APAC region represents 38% of total addressable market but we have no presence..." />
            </FieldBlock>
            <FieldBlock label="WHY THIS DECISION MATTERS" hint="Stakes and urgency" className="mt-4">
              <Textarea value={fd.whyMatters} onChange={e => set('whyMatters', e.target.value)} rows={2} className="text-sm resize-none" placeholder="What happens if we delay or decide poorly?" />
            </FieldBlock>
            <FieldBlock label="BACKGROUND (OPTIONAL)" className="mt-4">
              <Textarea value={fd.background} onChange={e => set('background', e.target.value)} rows={2} className="text-sm resize-none" placeholder="Board-approved expansion strategy requires entering at least one new major region by end of FY26..." />
            </FieldBlock>
          </div>
          <DQPrinciple text={DQ_PRINCIPLES.context} />
        </div>
      )}

      {/* Tab: Decision Frame */}
      {activeTab === 'frame' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-1" style={{ color: DS.ink }}>What decision are we making?</h3>
            <p className="text-xs mb-4" style={{ color: DS.inkTer }}>The decision statement is an open question. Not "should we expand?" but "which market entry strategy maximises risk-adjusted NPV given our constraints?"</p>
            <FieldBlock label="DECISION STATEMENT" required hint="Must be a genuine open question">
              <Textarea value={fd.decisionStatement} onChange={e => set('decisionStatement', e.target.value)} rows={3} className="text-sm resize-none" placeholder="Which market entry strategy maximises our risk-adjusted NPV for APAC expansion within a $25M Year 1 capital constraint?" />
              {fd.decisionStatement && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  {fd.decisionStatement.includes('?') ? <CheckCircle size={12} style={{ color: DS.success }} /> : <AlertCircle size={12} style={{ color: DS.warning }} />}
                  <span className="text-[10px]" style={{ color: fd.decisionStatement.includes('?') ? DS.success : DS.warning }}>
                    {fd.decisionStatement.includes('?') ? 'Contains a question mark — good' : 'Should end with a question mark'}
                  </span>
                </div>
              )}
            </FieldBlock>
            <FieldBlock label="DECISION TRIGGER" hint="What forced this decision now?" className="mt-4">
              <Textarea value={fd.trigger} onChange={e => set('trigger', e.target.value)} rows={2} className="text-sm resize-none" placeholder="Board strategy session approved APAC as priority. Competitor entered Singapore 14 months ago." />
            </FieldBlock>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <FieldBlock label="DECISION OWNER">
                <Input value={fd.owner} onChange={e => set('owner', e.target.value)} className="text-sm h-9" placeholder="CSO / CEO" />
              </FieldBlock>
              <FieldBlock label="DECISION DEADLINE">
                <Input value={fd.deadline} onChange={e => set('deadline', e.target.value)} className="text-sm h-9" placeholder="Board review July 2026" />
              </FieldBlock>
            </div>
          </div>
          <DQPrinciple text={DQ_PRINCIPLES.frame} />
        </div>
      )}

      {/* Tab: Scope & Boundaries */}
      {activeTab === 'scope' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-1" style={{ color: DS.ink }}>What is in and out of scope?</h3>
            <p className="text-xs mb-4" style={{ color: DS.inkTer }}>Explicit scope prevents paralysis and blind spots. Define the boundaries before analysis begins.</p>
            <FieldBlock label="IN SCOPE" required hint="What choices and factors are part of this decision?">
              <Textarea value={fd.scopeIn} onChange={e => set('scopeIn', e.target.value)} rows={3} className="text-sm resize-none" placeholder="Market entry mode, geographic prioritisation, Year 1 capital allocation, technology localisation approach, initial team structure" />
            </FieldBlock>
            <FieldBlock label="OUT OF SCOPE" required hint="What is explicitly excluded?" className="mt-4">
              <Textarea value={fd.scopeOut} onChange={e => set('scopeOut', e.target.value)} rows={3} className="text-sm resize-none" placeholder="Long-term organisational structure, brand strategy, non-APAC markets, product feature development beyond localisation" />
            </FieldBlock>
            <FieldBlock label="HARD CONSTRAINTS" hint="Non-negotiable boundaries" className="mt-4">
              <Textarea value={fd.constraints} onChange={e => set('constraints', e.target.value)} rows={2} className="text-sm resize-none" placeholder="$25M Year 1 capital ceiling (Board resolution), 12-month first revenue target, Japan data centre requirement" />
            </FieldBlock>
            <FieldBlock label="KEY ASSUMPTIONS" hint="What are we assuming to be true?" className="mt-4">
              <Textarea value={fd.assumptions} onChange={e => set('assumptions', e.target.value)} rows={2} className="text-sm resize-none" placeholder="APAC TAM $2.8B growing at 18% CAGR, English acceptable for initial Singapore sales, partnership options available" />
            </FieldBlock>
          </div>
          <DQPrinciple text={DQ_PRINCIPLES.scope} />
        </div>
      )}

      {/* Tab: Success Measures */}
      {activeTab === 'success' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-1" style={{ color: DS.ink }}>How will we know we decided well?</h3>
            <p className="text-xs mb-4" style={{ color: DS.inkTer }}>Define success before you evaluate alternatives. This prevents post-hoc rationalisation and keeps the team honest.</p>
            <FieldBlock label="SUCCESS CRITERIA" required hint="Specific, measurable outcomes that define a good decision">
              <Textarea value={fd.successCriteria} onChange={e => set('successCriteria', e.target.value)} rows={4} className="text-sm resize-none" placeholder="Year 1: 3+ paying customers, $500K ARR. Year 3: $15M ARR, 15% market share in primary market, positive unit economics, viable path to $50M+ APAC revenue." />
            </FieldBlock>
            <FieldBlock label="FAILURE CONSEQUENCES" hint="What happens if we decide poorly?" className="mt-4">
              <Textarea value={fd.failureConsequences} onChange={e => set('failureConsequences', e.target.value)} rows={3} className="text-sm resize-none" placeholder="3-year revenue gap of $40M+, competitor entrenchment becomes irreversible, investor confidence decline, talent retention risk." />
            </FieldBlock>
          </div>
          <DQPrinciple text={DQ_PRINCIPLES.success} />
        </div>
      )}

      {/* Tab: AI Frame Check */}
      {activeTab === 'ai' && (
        <div className="space-y-4">
          {!frameCheck ? (
            <div className="text-center py-14">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: DS.frame.soft }}>
                <Sparkles size={28} style={{ color: DS.frame.fill }} />
              </div>
              <h3 className="text-base font-bold mb-1" style={{ color: DS.ink }}>Run the AI Frame Check</h3>
              <p className="text-xs mb-5 max-w-sm mx-auto" style={{ color: DS.inkTer }}>The AI will assess your decision frame against all 4 DQ frame requirements and suggest specific improvements.</p>
              <Button style={{ background: DS.frame.fill }} onClick={runFrameCheck} disabled={busy} className="gap-2">
                <Sparkles size={14} /> {busy ? 'Analysing frame…' : 'Run AI Frame Check'}
              </Button>
            </div>
          ) : (
            <>
              {/* Score banner */}
              <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${DS.frame.soft}, ${DS.canvas})`, border: `1px solid ${DS.frame.line}` }}>
                <div className="text-5xl font-black" style={{ color: frameCheck.overallScore >= 70 ? DS.success : frameCheck.overallScore >= 45 ? DS.warning : DS.danger }}>{frameCheck.overallScore}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold" style={{ color: DS.ink }}>Frame Quality: {frameCheck.band}</span>
                  </div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{frameCheck.verdict || frameCheck.summary}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs shrink-0" style={{ borderColor: DS.frame.fill, color: DS.frame.fill }} onClick={runFrameCheck} disabled={busy}>
                  <Sparkles size={11} /> Re-run
                </Button>
              </div>

              {/* DQ checks */}
              <div className="grid grid-cols-2 gap-2">
                {(frameCheck.checks || checks).map((c: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg text-xs" style={{ background: c.pass ? DS.successSoft : DS.dangerSoft }}>
                    {c.pass ? <CheckCircle size={13} style={{ color: DS.success, flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={13} style={{ color: DS.danger, flexShrink: 0, marginTop: 1 }} />}
                    <div>
                      <div className="font-semibold" style={{ color: DS.ink }}>{c.name}</div>
                      {c.note && <div className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>{c.note}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Improvements */}
              {improvements.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>Suggested Improvements</span>
                    <Button size="sm" variant="outline" className="h-6 text-[9px] gap-1" style={{ color: DS.warning, borderColor: DS.warning }}
                      onClick={() => { improvements.forEach(applyImprovement); setImprovements([]); }}>
                      <Wand2 size={9} /> Apply All
                    </Button>
                  </div>
                  {improvements.map((imp: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: DS.inkTer }}>{imp.field}</div>
                        <div className="text-xs" style={{ color: DS.inkSub }}>{imp.suggestion?.slice(0, 140)}</div>
                        {imp.reason && <div className="text-[10px] mt-1 italic" style={{ color: DS.inkDis }}>{imp.reason}</div>}
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-[10px] shrink-0" onClick={() => { applyImprovement(imp); setImprovements(p => p.filter((_, j) => j !== i)); }}>
                        Apply
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <DQPrinciple text={DQ_PRINCIPLES.ai} />
        </div>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex items-center gap-3">
          {checks.map((c, i) => (
            <div key={i} className="flex items-center gap-1 text-[10px]" style={{ color: c.pass ? DS.success : DS.inkDis }}>
              {c.pass ? <CheckCircle size={10} /> : <AlertCircle size={10} />} {c.label}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: DS.inkDis }}>{passCount}/4 checks passed</span>
          <Button size="sm" className="h-7 text-xs gap-1" style={{ background: DS.frame.fill }} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setActiveTab(TABS[Math.min(TABS.findIndex(t => t.id === activeTab) + 1, TABS.length - 1)].id)}>
            Next <ChevronRight size={11} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldBlock({ label, required, hint, children, className }: { label: string; required?: boolean; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-baseline gap-2 mb-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkTer }}>
          {label} {required && <span style={{ color: DS.danger }}>*</span>}
        </label>
        {hint && <span className="text-[10px]" style={{ color: DS.inkDis }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function DQPrinciple({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl mt-4" style={{ background: DS.frame.soft, border: `1px solid ${DS.frame.line}` }}>
      <Lightbulb size={14} style={{ color: DS.frame.fill, flexShrink: 0, marginTop: 2 }} />
      <div>
        <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.frame.fill }}>DQ PRINCIPLE</div>
        <p className="text-[11px] leading-relaxed" style={{ color: DS.inkSub }}>{text}</p>
      </div>
    </div>
  );
}

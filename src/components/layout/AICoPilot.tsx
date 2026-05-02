import { useState, useRef, useEffect } from 'react';
import { DS, MODULES } from '@/constants';
import type { ModuleId } from '@/types';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, Sparkles, ChevronRight, Target, Lightbulb, Wand2, BarChart3, Shield, Flame } from 'lucide-react';

interface Props { module: ModuleId; sessionId?: number; collapsed?: boolean; onToggle?: () => void; data?: any; }

const PROMPTS: Record<string, { label: string; icon: any; prompt: string }[]> = {
  problem: [
    { label: 'Frame Check — assess decision quality', icon: Target, prompt: 'Run a DQ frame check on the decision statement. Score out of 100 and give specific improvement suggestions for: genuine open question, bounded scope, root problem vs symptom, named owner.' },
    { label: 'Suggest scope improvements', icon: Shield, prompt: 'Analyse the scope definition and suggest what should be added to scope-in and scope-out to better bound this decision.' },
    { label: 'Identify hidden assumptions', icon: Lightbulb, prompt: 'List the hidden assumptions embedded in this decision frame that have not been made explicit. Flag which are most risky.' },
  ],
  issues: [
    { label: 'Generate issues from context', icon: Wand2, prompt: 'Generate 10 high-quality DQ issues from the decision context. Cover: uncertainties, constraints, assumptions, opportunities, stakeholder concerns, information gaps, brutal truths. Be specific, not generic.' },
    { label: 'Categorise and prioritise', icon: BarChart3, prompt: 'Review current issues and suggest: recategorisations, severity adjustments, and which 3 are most decision-critical and why.' },
    { label: 'Find blind spots', icon: Target, prompt: 'What important issues are likely missing? Look for underrepresented categories, second-order effects, and black swans specific to this decision.' },
  ],
  hierarchy: [
    { label: 'Validate Focus Five limit', icon: Shield, prompt: 'Review the decision hierarchy. Are focus decisions truly strategic and distinct? Should any be deferred? Flag sub-decisions masquerading as strategic focus decisions.' },
    { label: 'Suggest criteria', icon: Lightbulb, prompt: 'Suggest 5-7 decision criteria for evaluating strategies. Each should be distinct, measurable, and reflect what stakeholders genuinely value.' },
    { label: 'Check decision coverage', icon: BarChart3, prompt: 'Assess whether the decision hierarchy covers all key strategic choices. What important decisions are missing?' },
  ],
  strategy: [
    { label: 'Suggest 2 distinct strategies', icon: Wand2, prompt: 'Suggest 2 additional genuinely distinct strategies. Each must have different choices on focus decisions, different logic, different risk profile. Name them and describe core strategic logic.' },
    { label: 'Check coherence & feasibility', icon: Shield, prompt: 'Assess each strategy for coherence (do the choices fit together?) and feasibility (is it actually executable?). Flag contradictions.' },
    { label: 'Pick best strategy', icon: Target, prompt: 'Based on strategies, criteria, and decision context, which strategy best maximises the decision objective? Clear recommendation with reasoning.' },
  ],
  assessment: [
    { label: 'Initial assessment', icon: BarChart3, prompt: 'Score every strategy against every criterion (1-5 scale). Be differentiated — avoid scoring everything the same. One-sentence rationale per score.' },
    { label: 'Check for groupthink', icon: Flame, prompt: 'Review assessment scores. Are criteria scored similarly across all strategies? Evidence of groupthink or anchoring? Which scores look most suspect?' },
    { label: 'Validate trade-offs', icon: Shield, prompt: 'What are the key trade-offs between top strategies? Which trade-offs is the team being forced to confront, and which are being avoided?' },
  ],
  scorecard: [
    { label: 'Generate DQ narrative', icon: BarChart3, prompt: 'Write a 3-paragraph executive narrative summarising the DQ scorecard. Identify the weakest element, what needs to improve before commitment, and decision readiness.' },
    { label: 'Identify weakest element', icon: Flame, prompt: 'Which DQ element is weakest and why? What specific actions would move it from current score to 70+? Be concrete and actionable.' },
    { label: 'Suggest improvements', icon: Lightbulb, prompt: 'For each DQ element below 70, give 2-3 specific concrete improvement actions. Prioritise by impact and feasibility.' },
  ],
  stakeholders: [
    { label: 'Generate stakeholders', icon: Wand2, prompt: 'Identify key stakeholders for this decision. For each: role, influence (0-100), alignment (champion/supportive/neutral/cautious/concerned/opposed), primary concern, recommended engagement action.' },
    { label: 'Analyse alignment gaps', icon: BarChart3, prompt: 'Analyse stakeholder alignment. Who are critical unaligned stakeholders? What hidden tensions exist? Overall alignment readiness for commitment?' },
    { label: 'Engagement strategy', icon: Shield, prompt: 'For stakeholders who are cautious, concerned, or opposed: specific engagement actions. Who should talk to whom, with what message, in what order?' },
  ],
  export: [
    { label: 'Generate executive summary', icon: BarChart3, prompt: 'Write a 4-paragraph executive summary: what decision and why now, alternatives considered, recommended direction and rationale, key risks and next steps.' },
    { label: 'Board narrative', icon: Wand2, prompt: 'Write a 6-sentence board narrative: situation, complication, question, answer, evidence, next steps. Executive tone.' },
  ],
  influence: [
    { label: 'Identify key uncertainties', icon: Target, prompt: 'Identify the 5-7 most decision-critical external uncertainties. For each: label, why it matters, impact level, controllability.' },
    { label: 'Map influence chains', icon: BarChart3, prompt: 'Describe the key causal chains: which uncertainties drive which intermediate variables, which drive value outcomes. Skeleton of the influence diagram.' },
  ],
  scenario: [
    { label: 'Generate scenarios', icon: Wand2, prompt: 'Build a 2x2 scenario matrix from key uncertainties. Identify the two most important and uncertain axes. Name and describe all four quadrant scenarios as vivid distinct plausible futures.' },
    { label: 'Test strategy robustness', icon: Shield, prompt: 'Evaluate each strategy across the scenarios: which thrives/survives/struggles in each world? Which strategy is most robust? Conditions for success?' },
  ],
  voi: [
    { label: 'Calculate EVPI', icon: BarChart3, prompt: 'Estimate the expected value of perfect information for the top 3 uncertainties. Rank by information value. Which are most worth resolving before committing?' },
    { label: 'Prioritise studies', icon: Target, prompt: 'For each high-value uncertainty, what information-gathering action resolves it? Cost, timeline, and prioritised information plan.' },
  ],
  'risk-timeline': [
    { label: 'Generate risk timeline', icon: Wand2, prompt: 'Map key risks and decision gates on a timeline from now to the decision horizon. For each: title, timing (month), severity, owner, mitigation. Identify the peak risk period.' },
    { label: 'Readiness check', icon: Shield, prompt: 'Assess readiness for each decision gate. What is missing that would prevent commitment? Last responsible moment? Critical path?' },
  ],
};

export function AICoPilot({ module, sessionId, collapsed, onToggle, data }: Props) {
  const { call, busy } = useAI();
  const [messages, setMessages] = useState<{ id: string; role: 'user' | 'ai'; text: string }[]>([
    { id: 'welcome', role: 'ai', text: "I'm your AI decision co-pilot. Select a suggested analysis or ask me anything about this decision." },
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const prompts = PROMPTS[module] || [];
  const mod = MODULES.find(m => m.id === module);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const ctx = () => {
    if (!data) return '';
    const s = data.session || {};
    return `\n\nDecision: ${s.decisionStatement || 'Not set'}. Context: ${(s.context || '').slice(0, 200)}. Issues: ${(data.issues || []).length}. Strategies: ${(data.strategies || []).length}. DQ: ${JSON.stringify(s.dqScores || {})}.`;
  };

  const send = (text: string, sysPrompt?: string) => {
    if (!text.trim()) return;
    setMessages(p => [...p, { id: Date.now().toString(), role: 'user', text }]);
    setInput('');
    call((sysPrompt || text) + ctx(), (r) => {
      let txt = '';
      if (typeof r === 'string') txt = r;
      else if (r?.error) txt = `Error: ${r.error}`;
      else if (r?._raw) txt = r._raw.slice(0, 600);
      else if (r?.summary) txt = r.summary;
      else if (r?.insight) txt = r.insight;
      else if (r?.recommendation) txt = typeof r.recommendation === 'string' ? r.recommendation : JSON.stringify(r).slice(0, 500);
      else if (r?.executiveSummary?.onePager) txt = r.executiveSummary.onePager;
      else txt = JSON.stringify(r, null, 2).slice(0, 600);
      setMessages(p => [...p, { id: (Date.now() + 1).toString(), role: 'ai', text: txt }]);
    });
  };

  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-l flex flex-col items-center py-3 gap-3" style={{ background: DS.canvas, borderColor: DS.borderLight }}>
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Open AI Co-Pilot">
          <Bot size={18} style={{ color: '#7C3AED' }} />
        </button>
        <div className="w-6 h-px" style={{ background: DS.borderLight }} />
        {prompts.slice(0, 2).map((p, i) => (
          <button key={i} onClick={() => { onToggle?.(); send(p.label, p.prompt); }} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title={p.label}>
            <p.icon size={14} style={{ color: DS.inkDis }} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 border-l flex flex-col overflow-hidden" style={{ background: DS.canvas, borderColor: DS.borderLight }}>
      <div className="h-11 shrink-0 flex items-center justify-between px-3 border-b" style={{ background: DS.bg, borderColor: DS.borderLight }}>
        <div className="flex items-center gap-1.5">
          <Bot size={14} style={{ color: '#7C3AED' }} />
          <span className="text-[11px] font-bold" style={{ color: DS.ink }}>AI Co-Pilot</span>
          {mod && <Badge variant="outline" className="text-[8px] h-4 px-1" style={{ color: DS.inkDis, borderColor: DS.borderLight }}>{mod.label}</Badge>}
        </div>
        <button onClick={onToggle} className="p-1 rounded hover:bg-gray-100 transition-colors">
          <ChevronRight size={14} style={{ color: DS.inkDis }} />
        </button>
      </div>

      <div className="shrink-0 px-3 pt-3 pb-2">
        <p className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>Suggested Analysis</p>
        <div className="space-y-1">
          {prompts.map((p, i) => (
            <button key={i} onClick={() => send(p.label, p.prompt)} disabled={busy}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors hover:bg-gray-50 disabled:opacity-50">
              <p.icon size={12} style={{ color: '#7C3AED' }} />
              <span className="text-[10px] font-medium" style={{ color: DS.inkSub }}>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[90%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap"
              style={m.role === 'user' ? { background: '#7C3AED', color: '#fff' } : { background: DS.bg, color: DS.inkSub }}>
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-lg px-2.5 py-1.5 text-[10px]" style={{ background: DS.bg, color: DS.inkDis }}>
              <span className="inline-flex items-center gap-1"><Sparkles size={10} className="animate-pulse" /> Analysing...</span>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 p-3 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex gap-1.5">
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !busy && send(input)}
            placeholder="Ask the co-pilot..." className="h-8 text-[11px]" disabled={busy} />
          <Button size="sm" className="h-8 px-2 shrink-0" style={{ background: '#7C3AED' }} onClick={() => send(input)} disabled={!input.trim() || busy}>
            <Send size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
}

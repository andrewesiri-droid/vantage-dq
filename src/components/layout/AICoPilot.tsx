import { useState, useRef, useEffect } from 'react';
import { DS, MODULES } from '@/constants';
import type { ModuleId } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, Sparkles, ChevronRight, X, Lightbulb, Wand2, BarChart3, Target, Flame, Shield } from 'lucide-react';

interface AICoPilotProps {
  module: ModuleId;
  sessionId?: number;
  collapsed?: boolean;
  onToggle?: () => void;
}

const MODULE_PROMPTS: Record<string, { label: string; icon: typeof Sparkles }[]> = {
  problem: [
    { label: 'Frame Check — assess decision quality', icon: Target },
    { label: 'Suggest scope improvements', icon: Shield },
    { label: 'Identify hidden assumptions', icon: Lightbulb },
  ],
  issues: [
    { label: 'Generate issues from context', icon: Wand2 },
    { label: 'Categorise and prioritise', icon: BarChart3 },
    { label: 'Find blind spots', icon: Target },
  ],
  hierarchy: [
    { label: 'Validate Focus Five limit', icon: Shield },
    { label: 'Suggest deferred decisions', icon: Lightbulb },
    { label: 'Check decision coverage', icon: BarChart3 },
  ],
  strategy: [
    { label: 'Suggest 2 distinct strategies', icon: Wand2 },
    { label: 'Check coherence & feasibility', icon: Shield },
    { label: 'Pick best strategy', icon: Target },
  ],
  assessment: [
    { label: 'Initial assessment', icon: BarChart3 },
    { label: 'Check for groupthink', icon: Flame },
    { label: 'Validate trade-offs', icon: Shield },
  ],
  scorecard: [
    { label: 'Generate DQ report', icon: BarChart3 },
    { label: 'Identify weakest element', icon: Flame },
    { label: 'Suggest improvements', icon: Lightbulb },
  ],
  stakeholders: [
    { label: 'Generate stakeholders', icon: Wand2 },
    { label: 'Analyse alignment gaps', icon: BarChart3 },
    { label: 'Engagement strategy', icon: Shield },
  ],
  export: [
    { label: 'Generate executive summary', icon: BarChart3 },
    { label: 'Export to PowerPoint', icon: Wand2 },
  ],
  influence: [
    { label: 'Identify key uncertainties', icon: Target },
    { label: 'Map influence chains', icon: BarChart3 },
  ],
  scenario: [
    { label: 'Generate scenarios', icon: Wand2 },
    { label: 'Test strategy robustness', icon: Shield },
  ],
  voi: [
    { label: 'Calculate EVPI / EVSI', icon: BarChart3 },
    { label: 'Prioritise studies', icon: Target },
  ],
  'risk-timeline': [
    { label: 'Generate risk timeline', icon: Wand2 },
    { label: 'Readiness check', icon: Shield },
  ],
};

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
}

export function AICoPilot({ module, sessionId, collapsed, onToggle }: AICoPilotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `I'm your AI decision co-pilot. I can help you ${getModuleAction(module)}. Select a suggested analysis or ask me anything about this decision.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const prompts = MODULE_PROMPTS[module] || [];
  const mod = MODULES.find(m => m.id === module);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setBusy(true);

    // Simulate deterministic AI response
    setTimeout(() => {
      const response = generateResponse(text, module);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        suggestions: getFollowUps(module),
      };
      setMessages(prev => [...prev, aiMsg]);
      setBusy(false);
    }, 1200);
  };

  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-l flex flex-col items-center py-3 gap-3" style={{ background: DS.canvas, borderColor: DS.borderLight }}>
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Open AI Co-Pilot">
          <Bot size={18} style={{ color: '#7C3AED' }} />
        </button>
        <div className="w-6 h-px" style={{ background: DS.borderLight }} />
        {prompts.slice(0, 2).map((p, i) => (
          <button key={i} onClick={() => { onToggle?.(); send(p.label); }} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title={p.label}>
            <p.icon size={14} style={{ color: DS.inkDis }} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 border-l flex flex-col overflow-hidden" style={{ background: DS.canvas, borderColor: DS.borderLight }}>
      {/* Header */}
      <div className="h-11 shrink-0 flex items-center justify-between px-3 border-b" style={{ background: DS.bg, borderColor: DS.borderLight }}>
        <div className="flex items-center gap-1.5">
          <Bot size={14} style={{ color: '#7C3AED' }} />
          <span className="text-[11px] font-bold" style={{ color: DS.ink }}>AI Co-Pilot</span>
          {mod && <Badge variant="outline" className="text-[8px] h-4 px-1" style={{ color: DS.inkDis, borderColor: DS.borderLight }}>{mod.short || mod.label}</Badge>}
        </div>
        <button onClick={onToggle} className="p-1 rounded hover:bg-gray-100 transition-colors"><ChevronRight size={14} style={{ color: DS.inkDis }} /></button>
      </div>

      {/* Suggested Analysis */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <p className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>Suggested Analysis</p>
        <div className="space-y-1">
          {prompts.map((p, i) => (
            <button
              key={i}
              onClick={() => send(p.label)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors hover:bg-gray-50"
            >
              <p.icon size={12} style={{ color: '#7C3AED' }} />
              <span className="text-[10px] font-medium" style={{ color: DS.inkSub }}>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
              m.role === 'user'
                ? 'text-white'
                : ''
            }`} style={m.role === 'user' ? { background: '#7C3AED' } : { background: DS.bg, color: DS.inkSub }}>
              {m.content}
              {m.suggestions && m.suggestions.length > 0 && (
                <div className="mt-2 space-y-1">
                  {m.suggestions.map((s, i) => (
                    <button key={i} onClick={() => send(s)} className="block w-full text-left text-[10px] px-1.5 py-1 rounded hover:bg-white/50 transition-colors" style={{ color: '#7C3AED' }}>
                      → {s}
                    </button>
                  ))}
                </div>
              )}
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

      {/* Input */}
      <div className="shrink-0 p-3 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex gap-1.5">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            placeholder="Ask the co-pilot..."
            className="h-8 text-[11px]"
          />
          <Button size="sm" className="h-8 px-2 shrink-0" style={{ background: '#7C3AED' }} onClick={() => send(input)} disabled={!input.trim() || busy}>
            <Send size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function getModuleAction(module: string): string {
  const map: Record<string, string> = {
    problem: 'frame the decision, validate scope, and surface assumptions',
    issues: 'raise and categorise issues, find blind spots',
    hierarchy: 'structure decisions into Given, Focus, and Deferred',
    strategy: 'build distinct, coherent strategic alternatives',
    assessment: 'score alternatives against criteria and find trade-offs',
    scorecard: 'audit decision quality across the six elements',
    stakeholders: 'map alignment and plan engagement',
    export: 'package and share the decision package',
    influence: 'map uncertainties and their interconnections',
    scenario: 'build futures and test strategy robustness',
    voi: 'prioritise information gathering by value',
    'risk-timeline': 'map risks over time and assess readiness',
  };
  return map[module] || 'analyse this module';
}

function generateResponse(text: string, module: string): string {
  const responses: Record<string, string[]> = {
    problem: [
      'Frame Check complete: 4/4 checks passed. Decision statement is a genuine open question. Scope is well-bounded with explicit in/out definitions.',
      'Identified 3 potential scope gaps: (1) regulatory timeline not bounded, (2) competitor response not in scope, (3) exit criteria missing.',
      'The decision frame scores 85/100. Strong on context and constraints. Consider adding a "no-go" trigger to protect downside.',
    ],
    issues: [
      'Generated 8 issues from context: 3 Critical, 3 High, 2 Medium. Top concern: team has zero APAC experience.',
      'Blind spot analysis: No issues in "black swan" or "opportunity forgotten" categories. Consider upside scenarios.',
      'Issues are well-distributed across categories. 4 issues have no mitigation plan — assign owners before proceeding.',
    ],
    hierarchy: [
      'Decision hierarchy validated: 2 Given, 5 Focus, 2 Deferred. Focus Five limit respected.',
      'Consider promoting "Technology Localisation" to Focus if 12-month revenue target is immovable.',
      'All Focus decisions have defined choices. Good practice: add a "do nothing" option to each.',
    ],
    strategy: [
      'Strategy coherence check: Alpha and Beta are genuinely distinct. Gamma may overlap with Beta on partnership dimension.',
      'Distinctiveness score: 82/100. Alpha (direct) and Beta (partner) are well-separated. Consider a fourth "hybrid" strategy.',
      'No strategy dominates on all criteria — good sign that trade-offs are real and must be confronted.',
    ],
    assessment: [
      'Initial assessment: Beta leads on 4 of 8 criteria. Alpha leads on NPV and speed. No strategy dominates.',
      'Groupthink alert: 3 criteria scored identically across all strategies. Consider whether differentiation is real.',
      'Trade-off analysis: Alpha vs Beta trade-off is capital/control vs speed/risk. This is the central decision tension.',
    ],
    scorecard: [
      'DQ Scorecard: Overall 62/100 (Adequate). Strongest: Values (80). Weakest: Commitment (30).',
      'The Commitment score of 30 indicates stakeholder alignment is insufficient for decision commitment. Address before proceeding.',
      'Information score of 45 is below the 50 threshold. Key uncertainties need further analysis before commitment.',
    ],
    stakeholders: [
      'Alignment analysis: 5/8 stakeholders are supportive (63%). 2 cautious, 1 concerned.',
      'CFO is cautious but not opposed — addressable with detailed financial model and hedging plan.',
      'General Counsel is concerned on regulatory risk. Direct engagement recommended before commitment.',
    ],
    scenario: [
      'Scenario set is balanced: Bull 25%, Base 50%, Bear 25%. Probabilities sum to 100%.',
      'Base case is well-defined. Consider adding a "disruption" scenario with new entrant or regulatory shock.',
      'Strategy robustness: Beta performs best across scenarios. Alpha excels in Bull, fails in Bear.',
    ],
    voi: [
      'EVPI calculated: $15M. Maximum value of perfect information. EVSI for top 3 studies shown.',
      'Japan Regulatory Study: EVSI $12M vs Cost $1.5M. Strongly worth conducting.',
      'Partner Due Diligence: EVSI $11.8M vs Cost $1M. Worth conducting before partnership commitment.',
    ],
    'risk-timeline': [
      'Risk timeline mapped: 6 risks across 18-month horizon. 2 Critical in Months 3-6.',
      'Readiness check: 3 risks have no mitigation owner. Assign before commitment.',
      'Peak risk concentration in Months 3-9. Consider phased capital deployment to preserve optionality.',
    ],
  };
  const pool = responses[module] || [
    `Analysis for ${module}: Core structure is sound. Consider deeper review of assumptions and trade-offs.`,
    'Module data is well-structured. AI analysis available for specific dimensions on request.',
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

function getFollowUps(module: string): string[] {
  const map: Record<string, string[]> = {
    problem: ['What should I add to scope-out?', 'Is the decision statement strong enough?'],
    issues: ['What issues am I missing?', 'Which issues are most urgent?'],
    hierarchy: ['Should I defer any focus decisions?', 'Are my choices distinct enough?'],
    strategy: ['How do I improve distinctiveness?', 'What makes a strategy coherent?'],
    assessment: ['Where are the hidden trade-offs?', 'Which criteria should I weight higher?'],
    scorecard: ['How do I improve my weakest element?', 'What does a Strong scorecard look like?'],
    stakeholders: ['Who could block this decision?', 'How do I convert neutrals?'],
    scenario: ['What axes should I use?', 'How many scenarios do I need?'],
    voi: ['Which study first?', 'What if I have no budget for studies?'],
    'risk-timeline': ['When is the riskiest period?', 'How do I build a readiness score?'],
  };
  return map[module] || ['Tell me more', 'What should I do next?'];
}

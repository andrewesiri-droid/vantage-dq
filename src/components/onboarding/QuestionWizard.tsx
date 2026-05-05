import { useState } from 'react';
import { useNavigate } from 'react-router';
import { trpc } from '@/providers/trpc';
import { DS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  HelpCircle, ChevronLeft, ChevronRight, CheckCircle,
  Loader2, Target, Lightbulb, Users, Shield, AlertTriangle
} from 'lucide-react';

interface QuestionWizardProps { onBack: () => void; }

/**
 * Five questions a certified Decision Quality facilitator would ask
 * in the first 15 minutes of a client engagement.
 */
const QUESTIONS = [
  {
    id: 1,
    title: 'What decision, if made well, would most significantly affect the value of this organisation?',
    subtitle: 'Frame it as a genuine open question — not "Should we proceed?" but "Which path maximises value given our constraints?"',
    icon: Target,
    field: 'decisionStatement' as const,
    placeholder: 'e.g., Which strategic option maximises value given our constraints?',
    type: 'text' as const,
    why: 'A decision statement is the foundation of DQ. It must be a genuine open question that differentiates alternatives. "Should we proceed?" embeds the answer.',
    example: 'Which combination of technology platform and go-to-market model will deliver the highest 5-year risk-adjusted return on our $50M digital transformation investment?',
  },
  {
    id: 2,
    title: 'What are the genuinely different strategic paths — not just variants of the same approach?',
    subtitle: 'Think in extremes: the bold bet, the safe incremental, the partnership play. Each should tell a different story about how the future unfolds.',
    icon: Lightbulb,
    field: 'options' as const,
    placeholder: 'e.g., Build in-house, Partner with existing player, Acquire a competitor, Phased rollout',
    type: 'multi' as const,
    why: 'The biggest DQ failure is comparing variations of the same strategy. True alternatives must differ on at least 2–3 key decisions.',
    example: 'Full direct build in Singapore; Asset-light partnership model; Aggressive M&A of regional competitor; Wait-and-monitor (defer entry)',
  },
  {
    id: 3,
    title: 'Who has the authority, influence, or vital information that could change this decision?',
    subtitle: 'Include both formal decision-makers and informal influencers. Who could veto or derail this after the decision is made?',
    icon: Users,
    field: 'stakeholders' as const,
    placeholder: 'e.g., CEO, CFO, Board, Legal, Operations Lead',
    type: 'multi' as const,
    why: 'Decisions fail not because of bad analysis but because key stakeholders were not aligned. Map them before you decide, not after.',
    example: 'CEO (sponsor), CFO (capital gatekeeper), CSO (strategy owner), CTO (technology risk), Board (approval authority), APAC Regional GM (execution owner)',
  },
  {
    id: 4,
    title: 'What are the hard boundaries you cannot cross, and what happens if this decision is wrong?',
    subtitle: 'Hard constraints are non-negotiable. Soft constraints are preferences. Both must be written down — never assumed.',
    icon: Shield,
    field: 'constraints' as const,
    placeholder: 'e.g., Hard: budget ceiling, timeline mandate. Soft: preserve flexibility, minimise disruption.',
    type: 'textarea' as const,
    why: 'The most expensive DQ mistake is re-debating constraints mid-process. Separate hard (governed) from soft (preferences) upfront.',
    example: 'HARD: $25M capital ceiling (Board resolution), 12-month first revenue target, Japan data centre requirement. SOFT: Preserve option to pivot, maintain <20% headcount in region, avoid exclusive partnerships.',
  },
  {
    id: 5,
    title: 'What triggered this decision now, and what is the cost of waiting?',
    subtitle: 'Every strategic decision has a window. Understanding the trigger and the cost of delay creates urgency and focus.',
    icon: AlertTriangle,
    field: 'context' as const,
    placeholder: 'e.g., Competitive pressure forcing a decision. If we delay, we lose our window.',
    type: 'textarea' as const,
    why: 'Without a trigger, decisions drift. Without understanding the cost of delay, urgency is manufactured. Both create the emotional context for commitment.',
    example: 'Competitor X announced APAC expansion in January. Board mandated counter-movement by Q3. Estimated market window: 18 months. If we miss it, 3-year revenue gap of $40M.',
  },
];

export function QuestionWizard({ onBack }: QuestionWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ id: number; slug: string } | null>(null);

  const wizardMutation = trpc.aiDeepDive.wizard.useMutation({
    onSuccess: (data) => { setResult(data); setCreating(false); },
    onError: () => { setCreating(false); },
  });

  const q = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const currentAnswer = answers[q.field] || '';

  const setAnswer = (field: string, value: string) => {
    setAnswers(p => ({ ...p, [field]: value }));
  };

  const parseMulti = (val: string) => val.split(',').map(s => s.trim()).filter(Boolean);

  const handleNext = () => {
    if (isLast) handleCreate();
    else setStep(s => s + 1);
  };

  const handleCreate = () => {
    if (!name.trim() || !answers.decisionStatement?.trim()) return;
    setCreating(true);
    wizardMutation.mutate({
      name: name.trim(),
      decisionStatement: answers.decisionStatement.trim(),
      context: answers.context || undefined,
      options: answers.options ? parseMulti(answers.options) : undefined,
      stakeholders: answers.stakeholders ? parseMulti(answers.stakeholders) : undefined,
      constraints: answers.constraints || undefined,
    });
  };

  const handleGoToSession = () => {
    if (result?.slug) navigate(`/session/${result.slug}`);
  };

  if (result) {
    return (
      <div className="min-h-screen" style={{ background: DS.bg }}>
        <div className="flex items-center px-6 py-4 border-b" style={{ background: DS.brand }}>
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronLeft size={16} className="text-white/70" />
          </button>
          <span className="text-sm font-bold text-white ml-3">5-Question Wizard</span>
        </div>
        <div className="max-w-lg mx-auto px-6 py-12 text-center">
          <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: '#ECFDF5' }}>
            <CheckCircle size={24} style={{ color: '#059669' }} />
          </div>
          <h3 className="text-lg font-bold mb-1" style={{ color: DS.ink }}>Session Created</h3>
          <p className="text-xs mb-6" style={{ color: DS.inkSub }}>Your answers have been used to scaffold the decision session.</p>
          <Card className="border-0 shadow-md mb-6">
            <CardContent className="pt-5">
              <p className="text-xs font-bold mb-3" style={{ color: DS.ink }}>What was created:</p>
              <div className="space-y-2 text-left">
                {[
                  { label: 'Decision Statement', value: answers.decisionStatement },
                  { label: 'Session Name', value: name },
                  { label: 'Strategic Paths', value: answers.options ? parseMulti(answers.options).join(', ') : '—' },
                  { label: 'Stakeholders', value: answers.stakeholders ? parseMulti(answers.stakeholders).join(', ') : '—' },
                  { label: 'Constraints', value: answers.constraints || '—' },
                ].map(item => (
                  <div key={item.label} className="p-2 rounded" style={{ background: DS.canvas }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkTer }}>{item.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: DS.ink }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Button size="sm" className="text-xs gap-2" style={{ background: '#059669' }} onClick={handleGoToSession}>
            <CheckCircle size={14} /> Go to Session
          </Button>
        </div>
      </div>
    );
  }

  if (creating) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: DS.bg }}>
        <div className="text-center">
          <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: '#2563EB' }} />
          <h3 className="text-lg font-bold" style={{ color: DS.ink }}>Creating your session...</h3>
          <p className="text-xs" style={{ color: DS.inkSub }}>Building decision hierarchy and stakeholder map from your answers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: DS.bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background: DS.brand }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronLeft size={16} className="text-white/70" />
          </button>
          <div className="flex items-center gap-2">
            <HelpCircle size={16} style={{ color: '#2563EB' }} />
            <span className="text-sm font-bold text-white">5-Question Wizard</span>
          </div>
        </div>
        <span className="text-[10px] text-white/60">Question {step + 1} of {QUESTIONS.length}</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {QUESTIONS.map((_, i) => (
            <div key={i} className="flex-1 h-1.5 rounded-full transition-all" style={{ background: i <= step ? '#2563EB' : DS.borderLight }} />
          ))}
        </div>

        {/* Session name (first step only) */}
        {step === 0 && (
          <div className="mb-6">
            <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: DS.inkTer }}>Session Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., APAC Market Entry Decision Q3 2026" className="text-sm" />
            <p className="text-[10px] mt-1" style={{ color: DS.inkDis }}>This will be the title of your decision session.</p>
          </div>
        )}

        {/* Question card */}
        <Card className="border-0 shadow-md mb-4">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: '#2563EB15' }}>
                <q.icon size={18} style={{ color: '#2563EB' }} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="text-[9px] h-4" style={{ background: '#2563EB15', color: '#2563EB' }}>Q{step + 1}</Badge>
                </div>
                <h3 className="text-sm font-bold leading-snug" style={{ color: DS.ink }}>{q.title}</h3>
              </div>
            </div>

            <p className="text-[11px] mb-3 leading-relaxed" style={{ color: DS.inkSub }}>{q.subtitle}</p>

            {q.type === 'text' && (
              <Textarea value={currentAnswer} onChange={e => setAnswer(q.field, e.target.value)} placeholder={q.placeholder} className="text-xs min-h-[80px]" />
            )}
            {q.type === 'multi' && (
              <>
                <Textarea value={currentAnswer} onChange={e => setAnswer(q.field, e.target.value)} placeholder={q.placeholder} className="text-xs min-h-[80px]" />
                <p className="text-[10px] mt-1.5" style={{ color: DS.inkDis }}>Separate items with commas</p>
              </>
            )}
            {q.type === 'textarea' && (
              <Textarea value={currentAnswer} onChange={e => setAnswer(q.field, e.target.value)} placeholder={q.placeholder} className="text-xs min-h-[100px]" />
            )}

            {/* DQ Facilitator Tip */}
            <div className="mt-4 p-3 rounded-lg border-l-2" style={{ background: '#FFFBEB', borderColor: '#F59E0B' }}>
              <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: '#D97706' }}>Why This Matters</p>
              <p className="text-[11px] leading-relaxed" style={{ color: '#92400E' }}>{q.why}</p>
            </div>

            {/* Example */}
            <div className="mt-3 p-3 rounded-lg" style={{ background: DS.bg }}>
              <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.inkDis }}>Example Answer</p>
              <p className="text-[11px] italic leading-relaxed" style={{ color: DS.inkSub }}>{q.example}</p>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => step > 0 ? setStep(s => s - 1) : onBack()} className="text-xs gap-1" disabled={creating}>
            <ChevronLeft size={14} /> {step > 0 ? 'Previous' : 'Back'}
          </Button>
          <Button size="sm" className="text-xs gap-2" style={{ background: '#2563EB' }} onClick={handleNext}
            disabled={step === 0 ? !name.trim() || !currentAnswer.trim() : !currentAnswer.trim()}>
            {isLast ? <><CheckCircle size={14} /> Create Session</> : <>Next <ChevronRight size={14} /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}

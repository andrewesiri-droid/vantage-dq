import { useState } from 'react';
import { useNavigate } from 'react-router';
import { DS } from '@/constants';
import { useAuth } from '@/hooks/useAuth';
import { AIDeepDive } from '@/components/onboarding/AIDeepDive';
import { QuestionWizard } from '@/components/onboarding/QuestionWizard';
import { CleanSlate } from '@/components/onboarding/CleanSlate';
import { PreloadedExample } from '@/components/onboarding/PreloadedExample';
import {
  Brain, HelpCircle, FileText, Sparkles,
  ChevronLeft, Zap, Shield
} from 'lucide-react';

type Flow = 'select' | 'ai' | 'wizard' | 'clean' | 'example';

const CARDS = [
  {
    id: 'ai' as Flow,
    title: 'AI Deep Dive Analysis',
    desc: 'Upload a document, email chain, or paste background text. Our AI analyses it and generates a complete DQ first draft — problem frame, issues, decisions, stakeholders, and risks.',
    icon: Brain,
    color: '#7C3AED',
    badge: 'Fastest',
    time: '~2 minutes',
  },
  {
    id: 'wizard' as Flow,
    title: '5-Question Wizard',
    desc: 'Answer five structured questions about your decision. We use your answers to build the session scaffold — decision statement, options, stakeholders, and constraints.',
    icon: HelpCircle,
    color: '#2563EB',
    badge: 'Guided',
    time: '~3 minutes',
  },
  {
    id: 'clean' as Flow,
    title: 'Clean Slate',
    desc: 'Start with an empty session. You define everything — the decision statement, scope, and all modules. Full control for experienced facilitators.',
    icon: FileText,
    color: '#64748B',
    badge: 'Full Control',
    time: '~5 minutes',
  },
  {
    id: 'example' as Flow,
    title: 'Pre-loaded Example',
    desc: 'Explore the APAC Market Entry case study — a fully populated decision session with issues, strategies, stakeholders, and risk analysis. Learn by seeing.',
    icon: Sparkles,
    color: '#C9A84C',
    badge: 'Learn',
    time: '~1 minute',
  },
];

export function OnboardingPage() {
  const [flow, setFlow] = useState<Flow>('select');
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: DS.bg }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm" style={{ color: DS.inkSub }}>Authenticating...</p>
        </div>
      </div>
    );
  }

  if (flow === 'ai') return <AIDeepDive onBack={() => setFlow('select')} />;
  if (flow === 'wizard') return <QuestionWizard onBack={() => setFlow('select')} />;
  if (flow === 'clean') return <CleanSlate onBack={() => setFlow('select')} />;
  if (flow === 'example') return <PreloadedExample onBack={() => setFlow('select')} />;

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(135deg, #0B1D3A 0%, #0F2B4C 50%, #0B1D3A 100%)` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronLeft size={16} className="text-white/70" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: DS.accent }}>
              <Shield size={14} className="text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-white">Vantage</span>
              <span className="text-sm font-bold" style={{ color: DS.accent }}>DQ</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/50">Signed in as</span>
          <span className="text-[11px] font-medium text-white/80">{user.name || 'User'}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Welcome */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4" style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)' }}>
            <Zap size={12} style={{ color: DS.accent }} />
            <span className="text-[11px] font-medium" style={{ color: DS.accent }}>New Decision Session</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-3">
            How would you like to <span style={{ color: DS.accent }}>get started</span>?
          </h1>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Choose the approach that best fits your situation. Each path leads to a fully functional decision quality session.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CARDS.map(card => (
            <button
              key={card.id}
              onClick={() => setFlow(card.id)}
              className="group text-left rounded-xl p-6 transition-all hover:scale-[1.02] hover:shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
                  style={{ background: card.color + '20' }}
                >
                  <card.icon size={22} style={{ color: card.color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold text-white">{card.title}</h3>
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: card.color + '20', color: card.color }}
                    >
                      {card.badge}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {card.desc}
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Estimated time:</span>
                    <span className="text-[10px] font-medium" style={{ color: card.color }}>{card.time}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] mt-10" style={{ color: 'rgba(255,255,255,0.25)' }}>
          All paths create a persistent session that you can return to and refine at any time.
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { DS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { enableDemoMode, initializeDemoData, initializeEmptySession } from '@/lib/demoData';
import { useDemoContext } from '@/App';
import {
  Sparkles, FileText, MessageSquare, Play,
  ChevronRight, Upload, Brain, Target, Shield,
  ArrowLeft, CheckCircle
} from 'lucide-react';

type Mode = 'clean-slate' | 'deep-dive' | 'dq-questions' | 'preloaded';

const MODES = [
  {
    id: 'clean-slate' as Mode,
    icon: FileText,
    color: DS.frame.fill,
    soft: DS.frame.soft,
    title: 'Clean Slate',
    subtitle: 'Start from scratch',
    desc: 'You define the decision. Work through each module manually with AI assistance at every step. Best for decisions you already understand well.',
    badge: 'Full control',
  },
  {
    id: 'deep-dive' as Mode,
    icon: Brain,
    color: DS.information.fill,
    soft: DS.information.soft,
    title: 'AI Deep Dive',
    subtitle: 'Upload a document',
    desc: 'Upload a board paper, strategy document, reservoir report, or meeting transcript. AI extracts the decision context and pre-populates all modules automatically.',
    badge: 'Fastest setup',
  },
  {
    id: 'dq-questions' as Mode,
    icon: MessageSquare,
    color: DS.values.fill,
    soft: DS.values.soft,
    title: '5 DQ Questions',
    subtitle: 'Guided framing',
    desc: 'Answer 5 targeted Decision Quality questions. AI uses your answers to frame the decision and seed the key modules. Takes about 5 minutes.',
    badge: 'Structured',
  },
  {
    id: 'preloaded' as Mode,
    icon: Play,
    color: DS.accent,
    soft: DS.accentSoft,
    title: 'Pre-Loaded Example',
    subtitle: 'See it in action',
    desc: 'Load the APAC Market Entry demo decision — fully populated with issues, strategies, scenarios, and stakeholders. Perfect for exploring the platform.',
    badge: 'Demo ready',
  },
];

const DQ_QUESTIONS = [
  { id: 'decision', label: 'What decision are you making?', hint: 'Frame it as an open question, not a situation. e.g. "Which market entry strategy maximises our risk-adjusted return?"', placeholder: 'Which strategy should we pursue to...' },
  { id: 'owner', label: 'Who is the decision owner and when does it need to be made?', hint: 'Name the person accountable and the commitment deadline.', placeholder: 'e.g. CEO by Q3 board review...' },
  { id: 'stakes', label: 'What is at stake if this decision goes wrong?', hint: 'Be specific about financial, strategic, and operational consequences.', placeholder: 'e.g. $50M investment, 3-year market opportunity...' },
  { id: 'alternatives', label: 'What are the 2-3 genuinely different paths being considered?', hint: 'Not variations of the same idea — truly different approaches.', placeholder: 'e.g. Build in-house vs acquire vs partner...' },
  { id: 'uncertainty', label: 'What is the single biggest uncertainty affecting this decision?', hint: 'The thing outside your control that will most determine the outcome.', placeholder: 'e.g. Regulatory approval timeline, competitor response...' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { setDemoMode } = useDemoContext();
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sessionName, setSessionName] = useState('');
  const [decisionOwner, setDecisionOwner] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const startPreloaded = () => {
    enableDemoMode();
    initializeDemoData();
    setDemoMode(true);
    navigate('/session/demo-apac-entry');
  };

  const startCleanSlate = () => {
    localStorage.setItem('vantage_dq_demo_mode', 'true');
    initializeEmptySession(sessionName || 'New Decision Session', decisionOwner);
    setDemoMode(true);
    navigate('/session/demo-apac-entry');
  };

  const startFromAnswers = async () => {
    setUploading(true);
    try {
      const prompt = `Based on these 5 DQ answers, create a session frame.\n${DQ_QUESTIONS.map(q => `${q.label}: ${answers[q.id] || '—'}`).join('\n')}\n\nReturn JSON: { decisionStatement: string (open question), context: string, owner: string, stakes: string, alternatives: [string], keyUncertainty: string }`;
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], module: 'onboarding', task_type: 'frame-check' }),
      });
      const data = await res.json();
      const text = data.result || data.content?.[0]?.text || '';
      let parsed: any = {};
      try { parsed = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]); } catch { /**/ }

      // Initialize empty session with the AI-framed content
      const sessionTitle = sessionName || parsed.decisionStatement?.slice(0, 60) || 'New Decision Session';
      localStorage.setItem('vantage_dq_demo_mode', 'true');
      initializeEmptySession(sessionTitle, decisionOwner || parsed.owner || '');
      // Now patch the session with AI-extracted framing
      try {
        const stored = JSON.parse(localStorage.getItem('vantage_dq_demo_sessions') || '{}');
        if (stored.sessions?.[0]) {
          stored.sessions[0] = { ...stored.sessions[0], ...parsed, name: sessionTitle };
          localStorage.setItem('vantage_dq_demo_sessions', JSON.stringify(stored));
        }
      } catch { /**/ }
      setDemoMode(true);
      navigate('/session/demo-apac-entry');
    } catch {
      localStorage.setItem('vantage_dq_demo_mode', 'true');
      initializeEmptySession(sessionName || 'New Decision Session', decisionOwner);
      setDemoMode(true);
      navigate('/session/demo-apac-entry');
    } finally {
      setUploading(false);
    }
  };

  const startDeepDive = () => {
    localStorage.setItem('vantage_dq_demo_mode', 'true');
    initializeEmptySession(sessionName || 'New Decision Session', decisionOwner);
    setDemoMode(true);
    navigate('/session/demo-apac-entry');
  };

  const currentQ = DQ_QUESTIONS[step];
  const allAnswered = DQ_QUESTIONS.every(q => answers[q.id]?.trim());

  return (
    <div className="min-h-screen flex flex-col" style={{ background: DS.bg }}>
      {/* Header */}
      <header className="border-b px-8 py-4 flex items-center gap-3" style={{ background: DS.brand }}>
        <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <ArrowLeft size={16} className="text-white/60" />
        </button>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: DS.accent }}>
          <Shield size={14} className="text-white" />
        </div>
        <span className="text-sm font-bold text-white tracking-wide">VANTAGE DQ</span>
        <span className="text-white/30 mx-1">·</span>
        <span className="text-xs text-white/60">New Decision Session</span>
      </header>

      <div className="flex-1 flex items-start justify-center py-12 px-4">
        <div className="w-full max-w-4xl">

          {/* Mode selection */}
          {!selectedMode && (
            <>
              <div className="text-center mb-10">
                <h1 className="text-3xl font-black mb-2" style={{ color: DS.ink }}>How do you want to start?</h1>
                <p className="text-sm" style={{ color: DS.inkSub }}>Choose the approach that fits where you are with this decision.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {MODES.map(mode => {
                  const Icon = mode.icon;
                  return (
                    <button key={mode.id}
                      onClick={() => mode.id === 'preloaded' ? startPreloaded() : setSelectedMode(mode.id)}
                      className="text-left p-6 rounded-2xl border-2 transition-all hover:shadow-lg hover:scale-[1.01] group"
                      style={{ background: '#fff', borderColor: DS.borderLight }}>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: mode.soft }}>
                          <Icon size={22} style={{ color: mode.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-base font-bold" style={{ color: DS.ink }}>{mode.title}</span>
                            <Badge style={{ background: mode.soft, color: mode.color, border: 'none', fontSize: 9 }}>{mode.badge}</Badge>
                          </div>
                          <div className="text-xs font-medium mb-2" style={{ color: mode.color }}>{mode.subtitle}</div>
                          <p className="text-xs leading-relaxed" style={{ color: DS.inkSub }}>{mode.desc}</p>
                        </div>
                        <ChevronRight size={18} className="shrink-0 mt-1 opacity-30 group-hover:opacity-70 transition-opacity" style={{ color: mode.color }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* CLEAN SLATE */}
          {selectedMode === 'clean-slate' && (
            <div className="max-w-lg mx-auto">
              <button onClick={() => setSelectedMode(null)} className="flex items-center gap-1.5 text-xs mb-6" style={{ color: DS.inkDis }}>
                <ArrowLeft size={12} /> Back
              </button>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: DS.frame.soft }}>
                <FileText size={22} style={{ color: DS.frame.fill }} />
              </div>
              <h2 className="text-2xl font-black mb-1" style={{ color: DS.ink }}>Clean Slate</h2>
              <p className="text-sm mb-6" style={{ color: DS.inkSub }}>Enter a name for your decision session and jump straight in.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: DS.inkDis }}>SESSION NAME</label>
                  <Input value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="e.g. APAC Market Entry Strategy 2026" className="text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: DS.inkDis }}>DECISION OWNER (optional)</label>
                  <Input value={decisionOwner} onChange={e => setDecisionOwner(e.target.value)} placeholder="e.g. Chief Strategy Officer" className="text-sm" />
                </div>
                <Button className="w-full gap-2" style={{ background: DS.frame.fill }} onClick={startCleanSlate}>
                  Start Session <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* AI DEEP DIVE */}
          {selectedMode === 'deep-dive' && (
            <div className="max-w-lg mx-auto">
              <button onClick={() => setSelectedMode(null)} className="flex items-center gap-1.5 text-xs mb-6" style={{ color: DS.inkDis }}>
                <ArrowLeft size={12} /> Back
              </button>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: DS.information.soft }}>
                <Brain size={22} style={{ color: DS.information.fill }} />
              </div>
              <h2 className="text-2xl font-black mb-1" style={{ color: DS.ink }}>AI Deep Dive</h2>
              <p className="text-sm mb-6" style={{ color: DS.inkSub }}>Upload your document and the AI will extract the decision context, stakeholders, risks, uncertainties, and alternatives — then pre-populate all modules.</p>
              <div className="space-y-4">
                <div className="rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all hover:border-teal-400"
                  style={{ borderColor: DS.borderLight }}
                  onClick={() => document.getElementById('file-upload')?.click()}>
                  <input id="file-upload" type="file" className="hidden" accept=".pdf,.docx,.pptx,.txt"
                    onChange={e => setFile(e.target.files?.[0] || null)} />
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircle size={20} style={{ color: DS.success }} />
                      <span className="text-sm font-medium" style={{ color: DS.ink }}>{file.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload size={28} className="mx-auto mb-2" style={{ color: DS.inkDis }} />
                      <p className="text-sm font-medium mb-1" style={{ color: DS.inkSub }}>Drop your document here or click to browse</p>
                      <p className="text-xs" style={{ color: DS.inkDis }}>PDF, DOCX, PPTX, TXT up to 50MB</p>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {['Board papers', 'Strategy docs', 'Reservoir reports', 'Meeting notes', 'Workshop transcripts', 'Economics reports'].map(t => (
                    <div key={t} className="text-[9px] px-2 py-1.5 rounded-lg" style={{ background: DS.information.soft, color: DS.information.fill }}>{t}</div>
                  ))}
                </div>
                <Button className="w-full gap-2" style={{ background: DS.information.fill }} onClick={startDeepDive} disabled={!file && false}>
                  {file ? 'Analyse Document' : 'Start Without Document'} <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* 5 DQ QUESTIONS */}
          {selectedMode === 'dq-questions' && (
            <div className="max-w-lg mx-auto">
              <button onClick={() => { setSelectedMode(null); setStep(0); }} className="flex items-center gap-1.5 text-xs mb-6" style={{ color: DS.inkDis }}>
                <ArrowLeft size={12} /> Back
              </button>
              {/* Progress */}
              <div className="flex items-center gap-2 mb-6">
                {DQ_QUESTIONS.map((_, i) => (
                  <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
                    <div className="h-full rounded-full transition-all" style={{ width: i < step ? '100%' : i === step ? '50%' : '0%', background: DS.values.fill }} />
                  </div>
                ))}
                <span className="text-[10px] font-bold shrink-0" style={{ color: DS.inkDis }}>{step + 1}/{DQ_QUESTIONS.length}</span>
              </div>

              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: DS.values.soft }}>
                <Target size={22} style={{ color: DS.values.fill }} />
              </div>
              <h2 className="text-lg font-black mb-1" style={{ color: DS.ink }}>{currentQ.label}</h2>
              <p className="text-xs mb-4" style={{ color: DS.inkSub }}>{currentQ.hint}</p>
              <Textarea
                value={answers[currentQ.id] || ''}
                onChange={e => setAnswers(p => ({ ...p, [currentQ.id]: e.target.value }))}
                placeholder={currentQ.placeholder}
                rows={4}
                className="text-sm mb-4 resize-none"
              />
              <div className="flex gap-3">
                {step > 0 && (
                  <Button variant="outline" className="gap-1 text-xs" onClick={() => setStep(p => p - 1)}>
                    <ArrowLeft size={12} /> Back
                  </Button>
                )}
                {step < DQ_QUESTIONS.length - 1 ? (
                  <Button className="flex-1 gap-2" style={{ background: DS.values.fill }} onClick={() => setStep(p => p + 1)}
                    disabled={!answers[currentQ.id]?.trim()}>
                    Next Question <ChevronRight size={14} />
                  </Button>
                ) : (
                  <Button className="flex-1 gap-2" style={{ background: DS.values.fill }}
                    onClick={startFromAnswers} disabled={uploading || !allAnswered}>
                    <Sparkles size={14} /> {uploading ? 'Building your session…' : 'Build My Session'}
                  </Button>
                )}
              </div>
              {/* Answer preview */}
              {Object.keys(answers).length > 1 && (
                <div className="mt-4 space-y-1">
                  {DQ_QUESTIONS.slice(0, step).map(q => (
                    <div key={q.id} className="flex items-start gap-2 text-[10px] p-2 rounded-lg" style={{ background: DS.bg }}>
                      <CheckCircle size={10} style={{ color: DS.success, flexShrink: 0, marginTop: 1 }} />
                      <span className="truncate" style={{ color: DS.inkSub }}>{answers[q.id]?.slice(0, 60)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

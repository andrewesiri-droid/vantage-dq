import { useNavigate } from 'react-router';

import { useDemoContext } from '@/App';
import { enableDemoMode, initializeDemoData } from '@/lib/demoData';
import { DS } from '@/constants';
import { Button } from '@/components/ui/button';
import {
  Shield, Users, BarChart3, Brain, Zap, Globe,
  ChevronRight, Star, TrendingUp, Lock, Award, Play
} from 'lucide-react';

export function HomePage() {
  const navigate = useNavigate();
  const isLoading = false;
  const { demoMode } = useDemoContext();

  const features = [
    { icon: Brain, title: '12-Module Framework', desc: 'Complete decision quality methodology from framing to execution', color: '#2563EB' },
    { icon: Users, title: 'Collaborative Workshops', desc: 'Real-time multi-user sessions with live voting and comments', color: '#7C3AED' },
    { icon: BarChart3, title: 'DQ Scorecard', desc: 'Audit every decision against 6 quality elements, 0-100 scale', color: '#059669' },
    { icon: Shield, title: 'Trustworthy AI', desc: 'Structured analysis with human review gates and audit trails', color: '#C9A84C' },
    { icon: TrendingUp, title: 'Scenario Planning', desc: 'Bull, base, bear cases with probability-weighted outcomes', color: '#0891B2' },
    { icon: Lock, title: 'Enterprise Security', desc: 'Role-based access, audit logs, confidential session controls', color: '#DC2626' },
  ];

  const steps = [
    { num: '01', title: 'Frame the Decision', desc: 'Define the problem, scope, and success criteria with structured prompting' },
    { num: '02', title: 'Generate Issues', desc: 'Surface uncertainties, assumptions, constraints across 12 categories' },
    { num: '03', title: 'Build Hierarchy', desc: 'Separate given, focus (max 5), and deferred decisions' },
    { num: '04', title: 'Create Strategies', desc: 'Develop distinct alternatives and test with qualitative scoring' },
    { num: '05', title: 'Audit Quality', desc: 'Score all 6 DQ elements, identify weakest link, iterate' },
    { num: '06', title: 'Export & Decide', desc: 'Generate executive reports with pre-flight quality checks' },
  ];

  const testimonials = [
    { quote: 'The DQ Scorecard transformed how our board evaluates strategic decisions.', author: 'Chief Strategy Officer', org: 'Fortune 500 Energy Company' },
    { quote: 'Finally, a methodology that bridges the gap between analysis and action.', author: 'VP of Decision Analysis', org: 'Major Oil & Gas Operator' },
    { quote: 'We reduced decision cycle time by 40% while improving outcome quality.', author: 'Head of Strategy', org: 'Global Mining Corporation' },
  ];

  return (
    <div className="min-h-screen" style={{ background: DS.bg }}>
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, #0B1D3A 0%, #0F2B4C 50%, #0B1D3A 100%)` }}>
        {/* Abstract pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#C9A84C" strokeWidth="0.5"/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

        <div className="relative max-w-6xl mx-auto px-6 py-20">
          {/* Nav */}
          <div className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: DS.accent }}>
                <Shield size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">Vantage<span style={{ color: DS.accent }}>DQ</span></h1>
                <p className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(201,168,76,0.7)' }}>Decision Quality</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <Button size="sm" className="text-xs gap-1" style={{ background: DS.accent }} onClick={() => navigate('/dashboard')}>
                  Dashboard <ChevronRight size={14} />
                </Button>
              ) : (
                <Button size="sm" className="text-xs gap-1" style={{ background: DS.accent }} onClick={() => window.location.href = '/api/oauth/authorize'}>
                  Sign In <ChevronRight size={14} />
                </Button>
              )}
            </div>
          </div>

          {/* Hero content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6" style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)' }}>
                <Star size={12} style={{ color: DS.accent }} />
                <span className="text-[11px] font-medium" style={{ color: DS.accent }}>Fortune 500 Decision Framework</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
                World-Class<br />
                <span style={{ color: DS.accent }}>Decision Quality</span>
              </h2>
              <p className="text-sm leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.65)' }}>
                The complete Decision Quality platform trusted by major energy companies and Fortune 500 executives. 
                Structured methodology, real-time collaboration, and trustworthy AI — from problem frame to board-ready output.
              </p>
              <div className="flex flex-wrap gap-3">
                {user || demoMode ? (
                  <Button size="lg" className="gap-2 text-sm" style={{ background: DS.accent }} onClick={() => navigate('/dashboard')}>
                    <Zap size={16} /> Go to Dashboard
                  </Button>
                ) : (
                  <>
                    <Button size="lg" className="gap-2 text-sm" style={{ background: DS.accent }} onClick={() => window.location.href = '/api/oauth/authorize'}>
                      <Zap size={16} /> Sign In
                    </Button>
                    <Button size="lg" variant="outline" className="gap-2 text-sm border-white/20 text-white hover:bg-white/10" onClick={() => { enableDemoMode(); initializeDemoData(); navigate('/dashboard'); }}>
                      <Play size={16} /> Launch Demo
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-6 mt-8">
                {[{ n: '12', l: 'Modules' }, { n: '6', l: 'DQ Elements' }, { n: '100', l: 'Point Scale' }].map(s => (
                  <div key={s.l} className="text-center">
                    <div className="text-xl font-bold" style={{ color: DS.accent }}>{s.n}</div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative">
                <div className="rounded-2xl p-6 shadow-2xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Award size={14} style={{ color: DS.accent }} />
                    <span className="text-xs font-bold text-white">DQ Scorecard Preview</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { k: 'Frame', s: 75, c: '#C9A84C' }, { k: 'Alternatives', s: 60, c: '#2563EB' },
                      { k: 'Information', s: 45, c: '#7C3AED' }, { k: 'Values', s: 80, c: '#059669' },
                      { k: 'Reasoning', s: 55, c: '#0891B2' }, { k: 'Commitment', s: 30, c: '#DC2626' },
                    ].map(el => (
                      <div key={el.k} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] text-white/60">{el.k}</span>
                          <span className="text-sm font-bold" style={{ color: el.c }}>{el.s}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${el.s}%`, background: el.c }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-xs text-white/60">Overall</span>
                    <span className="text-xl font-bold" style={{ color: DS.accent }}>57</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: DS.accent }}>Capabilities</p>
          <h3 className="text-2xl font-bold" style={{ color: DS.ink }}>Everything You Need for Quality Decisions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(f => (
            <Card key={f.title} className="border-0 shadow-sm hover:shadow-md transition-all group">
              <CardContent className="p-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform" style={{ background: f.color + '15' }}>
                  <f.icon size={18} style={{ color: f.color }} />
                </div>
                <h4 className="text-sm font-bold mb-1" style={{ color: DS.ink }}>{f.title}</h4>
                <p className="text-[11px] leading-relaxed" style={{ color: DS.inkSub }}>{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Process */}
      <div className="py-16" style={{ background: DS.canvas }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: DS.accent }}>Process</p>
            <h3 className="text-2xl font-bold" style={{ color: DS.ink }}>Six Steps to Decision Quality</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {steps.map(s => (
              <div key={s.num} className="flex gap-4 p-4 rounded-xl" style={{ background: DS.bg }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0" style={{ background: DS.accentSoft, color: DS.accent }}>{s.num}</div>
                <div>
                  <h4 className="text-sm font-bold mb-1" style={{ color: DS.ink }}>{s.title}</h4>
                  <p className="text-[11px] leading-relaxed" style={{ color: DS.inkSub }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: DS.accent }}>Trusted By Industry Leaders</p>
          <h3 className="text-2xl font-bold" style={{ color: DS.ink }}>What Executives Say</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.map((t, i) => (
            <div key={i} className="p-5 rounded-xl" style={{ background: `linear-gradient(135deg, ${DS.accentSoft} 0%, ${DS.canvas} 100%)`, borderLeft: `3px solid ${DS.accent}` }}>
              <p className="text-xs italic leading-relaxed mb-4" style={{ color: DS.ink }}>"{t.quote}"</p>
              <p className="text-[10px] font-bold" style={{ color: DS.accent }}>{t.author}</p>
              <p className="text-[10px]" style={{ color: DS.inkSub }}>{t.org}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="py-16" style={{ background: `linear-gradient(135deg, #0B1D3A 0%, #0F2B4C 100%)` }}>
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h3 className="text-2xl font-bold text-white mb-3">Ready to Improve Decision Quality?</h3>
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Join leading energy companies and Fortune 500 executives who trust Vantage DQ for their most critical decisions.
          </p>
          {user ? (
            <Button size="lg" className="gap-2 text-sm" style={{ background: DS.accent }} onClick={() => navigate('/dashboard')}>
              <Zap size={16} /> Go to Dashboard <ChevronRight size={14} />
            </Button>
          ) : (
            <Button size="lg" className="gap-2 text-sm" style={{ background: DS.accent }} onClick={() => window.location.href = '/api/oauth/authorize'}>
              <Zap size={16} /> Get Started <ChevronRight size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="py-8 text-center" style={{ background: '#081628' }}>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Vantage DQ · Decision Quality Platform · Trusted by Industry Leaders
        </p>
      </div>
    </div>
  );
}

// Inline Card component for the landing page
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl ${className}`} style={{ background: DS.canvas }}>{children}</div>;
}
function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

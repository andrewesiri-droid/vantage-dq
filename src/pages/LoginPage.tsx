/**
 * LoginPage — Supabase Auth with magic links
 * Replaces old KIMI OAuth LoginPage
 *
 * Flow:
 * 1. User enters email → magic link sent
 * 2. User clicks link in email → /auth/callback → session created → redirect to /
 * 3. Fallback: "Continue as Guest" → demo mode
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { DS } from '@/constants';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { isSupabaseReady } from '@/lib/supabase-client';
import { enableDemoMode, initializeDemoData } from '@/lib/demoData';
import { useDemoContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Mail, Sparkles, ArrowRight, CheckCircle, Users } from 'lucide-react';

type Step = 'enter-email' | 'check-email' | 'error';

export function LoginPage() {
  const navigate = useNavigate();
  const { setDemoMode } = useDemoContext();
  const { signInWithMagicLink, signInWithGoogle } = useSupabaseAuth();

  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('enter-email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMagicLink = async () => {
    if (!email.trim() || !email.includes('@')) { setError('Enter a valid email address'); return; }
    setLoading(true); setError('');
    try {
      await signInWithMagicLink(email.trim());
      setStep('check-email');
    } catch (err: any) {
      setError(err.message || 'Could not send magic link. Try again.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true); setError('');
    try {
      await signInWithGoogle();
      // Google OAuth redirects automatically
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed.');
      setLoading(false);
    }
  };

  const continueAsGuest = () => {
    enableDemoMode();
    initializeDemoData();
    setDemoMode(true);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex" style={{ background: DS.bg }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 p-12" style={{ background: DS.brand }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: DS.accent }}>
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-black tracking-widest text-white">VANTAGE DQ</div>
            <div className="text-[9px] tracking-widest text-white/40 uppercase">Decision Quality Platform</div>
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-black text-white mb-4 leading-tight">
            Make better decisions.<br />Together.
          </h2>
          <p className="text-sm text-white/60 leading-relaxed mb-8">
            Vantage DQ guides teams from ambiguity to aligned, high-quality decisions using Decision Quality methodology.
          </p>
          <div className="space-y-3">
            {[
              '12 structured DQ modules',
              'AI-assisted analysis with DQ guardrails',
              'Workshop facilitation & collaboration',
              'Board-ready reports & exports',
            ].map(feat => (
              <div key={feat} className="flex items-center gap-2.5 text-sm text-white/70">
                <CheckCircle size={14} style={{ color: DS.accent }} />
                {feat}
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-white/20">© 2026 Vantage DQ. Decision Quality Platform.</p>
      </div>

      {/* Right panel — auth */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: DS.brand }}>
              <Shield size={16} style={{ color: DS.accent }} />
            </div>
            <span className="text-sm font-black tracking-widest" style={{ color: DS.brand }}>VANTAGE DQ</span>
          </div>

          {/* ── ENTER EMAIL ── */}
          {step === 'enter-email' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-black mb-1" style={{ color: DS.ink }}>Sign in</h1>
                <p className="text-sm" style={{ color: DS.inkSub }}>
                  {isSupabaseReady ? "We'll send a magic link to your email — no password needed." : 'Continue in demo mode or sign in when Supabase is configured.'}
                </p>
              </div>

              {isSupabaseReady ? (
                <>
                  {/* Google sign-in */}
                  <Button variant="outline" className="w-full gap-3 h-11 text-sm font-medium"
                    onClick={handleGoogle} disabled={loading}>
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </Button>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ background: DS.borderLight }} />
                    <span className="text-[10px] font-medium" style={{ color: DS.inkDis }}>or</span>
                    <div className="flex-1 h-px" style={{ background: DS.borderLight }} />
                  </div>

                  {/* Magic link */}
                  <div className="space-y-3">
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleMagicLink()}
                      placeholder="your@email.com"
                      className="h-11 text-sm"
                      autoFocus
                    />
                    {error && <p className="text-xs" style={{ color: DS.danger }}>{error}</p>}
                    <Button className="w-full gap-2 h-11 font-bold text-sm"
                      style={{ background: DS.brand }}
                      onClick={handleMagicLink} disabled={loading || !email.trim()}>
                      <Mail size={15} />
                      {loading ? 'Sending link…' : 'Send Magic Link'}
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ background: DS.borderLight }} />
                    <span className="text-[10px] font-medium" style={{ color: DS.inkDis }}>or</span>
                    <div className="flex-1 h-px" style={{ background: DS.borderLight }} />
                  </div>
                </>
              ) : (
                <div className="p-3 rounded-xl text-center" style={{ background: DS.warnSoft }}>
                  <p className="text-xs" style={{ color: DS.warning }}>
                    Auth requires Supabase env vars in Vercel. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable sign-in.
                  </p>
                </div>
              )}

              {/* Guest / demo */}
              <Button variant="outline" className="w-full gap-2 h-11 text-sm"
                onClick={continueAsGuest}>
                <Users size={15} /> Continue as Guest
              </Button>

              <p className="text-center text-[10px]" style={{ color: DS.inkDis }}>
                By signing in you agree to use Vantage DQ for decision quality work.
              </p>
            </div>
          )}

          {/* ── CHECK EMAIL ── */}
          {step === 'check-email' && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: DS.accentSoft }}>
                <Mail size={28} style={{ color: DS.accent }} />
              </div>
              <div>
                <h1 className="text-2xl font-black mb-2" style={{ color: DS.ink }}>Check your email</h1>
                <p className="text-sm mb-1" style={{ color: DS.inkSub }}>
                  We sent a magic link to
                </p>
                <p className="text-sm font-bold" style={{ color: DS.ink }}>{email}</p>
              </div>
              <div className="p-4 rounded-xl space-y-2 text-left" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                {[
                  'Open your email inbox',
                  'Click the "Sign in to Vantage DQ" link',
                  'You\'ll be signed in automatically',
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs" style={{ color: DS.inkSub }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0" style={{ background: DS.accent }}>{i + 1}</div>
                    {step}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Button variant="outline" className="w-full text-xs" onClick={() => setStep('enter-email')}>
                  Use a different email
                </Button>
                <Button variant="ghost" className="w-full text-xs" onClick={continueAsGuest}>
                  <Users size={12} className="mr-1.5" /> Continue as Guest instead
                </Button>
              </div>
              <p className="text-[10px]" style={{ color: DS.inkDis }}>Link expires in 24 hours. Check spam if you don't see it.</p>
            </div>
          )}

          {/* ── ERROR ── */}
          {step === 'error' && (
            <div className="text-center space-y-4">
              <h1 className="text-xl font-black" style={{ color: DS.ink }}>Something went wrong</h1>
              <p className="text-sm" style={{ color: DS.danger }}>{error}</p>
              <Button className="w-full" onClick={() => setStep('enter-email')} style={{ background: DS.brand }}>
                Try again
              </Button>
              <Button variant="outline" className="w-full text-sm" onClick={continueAsGuest}>
                <Users size={13} className="mr-1.5" /> Continue as Guest
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

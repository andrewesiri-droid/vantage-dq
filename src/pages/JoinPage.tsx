/**
 * Join Page — /join/:token or /join with code entry
 *
 * Handles all three invite paths:
 * 1. /join/TOKEN  → validates token, joins session
 * 2. /join        → shows code entry input
 * 3. /join?code=DQ-XXXX → auto-fills code
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { DS } from '@/constants';
import { supabase, isSupabaseReady } from '@/lib/supabase-client';
import { enableDemoMode, initializeDemoData } from '@/lib/demoData';
import { useDemoContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Users, CheckCircle, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';

type JoinState = 'idle' | 'loading' | 'valid' | 'invalid' | 'expired' | 'joined';

export function JoinPage() {
  const { token } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setDemoMode } = useDemoContext();

  const [state, setState] = useState<JoinState>('idle');
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [displayName, setDisplayName] = useState('');
  const [sessionInfo, setSessionInfo] = useState<{ name: string; role: string; slug: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) validateToken(token);
  }, [token]);

  const validateToken = async (tok: string) => {
    setState('loading');
    setError('');

    if (!isSupabaseReady || !supabase) {
      // Demo mode fallback
      setState('valid');
      setSessionInfo({ name: 'Demo Session', role: 'participant', slug: 'demo-apac-entry' });
      return;
    }

    const { data, error: err } = await supabase
      .from('session_invitations')
      .select('*, dq_sessions(id, name, slug)')
      .eq('token', tok)
      .eq('is_revoked', false)
      .single();

    if (err || !data) { setState('invalid'); setError('This invite link is invalid or has been revoked.'); return; }
    if (new Date(data.expires_at) < new Date()) { setState('expired'); setError('This invite link has expired. Ask the session owner for a new one.'); return; }
    if (data.accepted_at) { setState('valid'); }

    setState('valid');
    setSessionInfo({
      name: (data.dq_sessions as any)?.name || 'Decision Session',
      role: data.role,
      slug: (data.dq_sessions as any)?.slug || '',
    });
  };

  const joinByCode = async () => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) { setError('Enter a workshop code'); return; }

    setState('loading');
    setError('');

    if (!isSupabaseReady || !supabase) {
      // Demo mode — accept any code
      setState('valid');
      setSessionInfo({ name: 'Demo Session', role: 'participant', slug: 'demo-apac-entry' });
      return;
    }

    const { data, error: err } = await supabase
      .from('dq_sessions')
      .select('id, name, slug')
      .eq('invite_code', cleanCode)
      .single();

    if (err || !data) {
      setState('idle');
      setError('Code not found. Check the code and try again.');
      return;
    }

    setState('valid');
    setSessionInfo({ name: data.name, role: 'participant', slug: data.slug });
  };

  const confirmJoin = async () => {
    if (!displayName.trim()) { setError('Enter your name so others know who you are'); return; }

    setState('loading');

    if (isSupabaseReady && supabase && sessionInfo) {
      // Record member join
      const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await supabase.from('session_members').upsert({
        session_id: undefined, // will need session_id from sessionInfo
        user_id: guestId,
        display_name: displayName.trim(),
        role: sessionInfo.role,
        is_guest: true,
        joined_at: new Date().toISOString(),
        is_online: true,
      });

      // Mark invite as accepted if token-based
      if (token) {
        await supabase.from('session_invitations').update({ accepted_at: new Date().toISOString() }).eq('token', token);
      }
    }

    // Store guest identity in localStorage
    localStorage.setItem('vantage_dq_guest', JSON.stringify({
      displayName: displayName.trim(),
      role: sessionInfo?.role || 'participant',
      joinedAt: new Date().toISOString(),
    }));

    enableDemoMode();
    initializeDemoData();
    setDemoMode(true);
    setState('joined');

    setTimeout(() => navigate(`/session/${sessionInfo?.slug || 'demo-apac-entry'}`), 1000);
  };

  const roleColors: Record<string, string> = {
    owner: DS.brand, facilitator: DS.accent,
    participant: DS.alternatives.fill, observer: DS.inkSub
  };
  const roleColor = roleColors[sessionInfo?.role || 'participant'] || DS.accent;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: DS.bg }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: DS.brand }}>
          <Shield size={18} style={{ color: DS.accent }} />
        </div>
        <div>
          <div className="text-sm font-black tracking-widest" style={{ color: DS.brand }}>VANTAGE DQ</div>
          <div className="text-[9px] tracking-widest uppercase" style={{ color: DS.inkDis }}>Decision Quality Platform</div>
        </div>
      </div>

      <div className="w-full max-w-sm">
        <div className="rounded-2xl overflow-hidden shadow-lg border" style={{ borderColor: DS.borderLight, background: '#fff' }}>

          {/* ── LOADING ── */}
          {state === 'loading' && (
            <div className="p-10 text-center">
              <Loader2 size={28} className="mx-auto mb-3 animate-spin" style={{ color: DS.accent }} />
              <p className="text-sm" style={{ color: DS.inkSub }}>Validating your invite…</p>
            </div>
          )}

          {/* ── CODE ENTRY ── */}
          {state === 'idle' && !token && (
            <div className="p-6 space-y-4">
              <div className="text-center mb-2">
                <h1 className="text-xl font-black mb-1" style={{ color: DS.ink }}>Join a Session</h1>
                <p className="text-xs" style={{ color: DS.inkSub }}>Enter the workshop code from your facilitator</p>
              </div>
              <div>
                <Input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && joinByCode()}
                  placeholder="DQ-XXXX"
                  className="text-center text-2xl font-black tracking-widest h-14 border-2"
                  style={{ fontFamily: 'monospace', fontSize: 24, letterSpacing: '0.15em' }}
                  maxLength={7}
                />
              </div>
              {error && <p className="text-xs text-center" style={{ color: DS.danger }}>{error}</p>}
              <Button className="w-full gap-2 h-11 text-sm font-bold" style={{ background: DS.brand }} onClick={joinByCode}>
                Continue <ArrowRight size={15} />
              </Button>
              <div className="text-center">
                <p className="text-[10px]" style={{ color: DS.inkDis }}>
                  Have an invite link? Click it directly — no code needed.
                </p>
              </div>
            </div>
          )}

          {/* ── INVALID / EXPIRED ── */}
          {(state === 'invalid' || state === 'expired') && (
            <div className="p-8 text-center space-y-3">
              <AlertTriangle size={32} className="mx-auto" style={{ color: DS.danger }} />
              <h2 className="text-base font-bold" style={{ color: DS.ink }}>
                {state === 'expired' ? 'Invite Expired' : 'Invalid Invite'}
              </h2>
              <p className="text-xs" style={{ color: DS.inkSub }}>{error}</p>
              <Button variant="outline" className="w-full text-xs" onClick={() => { setState('idle'); setError(''); }}>
                Enter a Workshop Code Instead
              </Button>
            </div>
          )}

          {/* ── VALID — NAME ENTRY ── */}
          {state === 'valid' && sessionInfo && (
            <div className="p-6 space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
                  style={{ background: `${roleColor}15` }}>
                  <Users size={11} style={{ color: roleColor }} />
                  <span className="text-[10px] font-bold capitalize" style={{ color: roleColor }}>
                    Joining as {sessionInfo.role}
                  </span>
                </div>
                <h1 className="text-lg font-black mb-1" style={{ color: DS.ink }}>{sessionInfo.name}</h1>
                <p className="text-xs" style={{ color: DS.inkSub }}>Enter your name so others know who you are</p>
              </div>
              <Input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmJoin()}
                placeholder="Your name"
                className="text-sm h-11 text-center"
                autoFocus
              />
              {error && <p className="text-xs text-center" style={{ color: DS.danger }}>{error}</p>}
              <Button className="w-full gap-2 h-11 font-bold" style={{ background: DS.brand }}
                onClick={confirmJoin} disabled={!displayName.trim()}>
                Join Session <ArrowRight size={15} />
              </Button>
            </div>
          )}

          {/* ── JOINED ── */}
          {state === 'joined' && (
            <div className="p-10 text-center">
              <CheckCircle size={36} className="mx-auto mb-3" style={{ color: DS.success }} />
              <h2 className="text-base font-bold mb-1" style={{ color: DS.ink }}>You're in!</h2>
              <p className="text-xs" style={{ color: DS.inkSub }}>Taking you to the session…</p>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] mt-4" style={{ color: DS.inkDis }}>
          Vantage DQ · Decision Quality Platform
        </p>
      </div>
    </div>
  );
}

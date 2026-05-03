/**
 * AuthCallbackPage — /auth/callback
 * Handles the magic link redirect from Supabase email.
 * Supabase automatically exchanges the token in the URL.
 * This page just waits for the session and redirects.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { DS } from '@/constants';
import { supabase } from '@/lib/supabase-client';
import { Shield, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      if (!supabase) {
        navigate('/');
        return;
      }

      // Supabase handles the token automatically from the URL hash
      const { data: { session }, error: err } = await supabase.auth.getSession();

      if (err) {
        setError(err.message);
        setStatus('error');
        return;
      }

      if (session) {
        setStatus('success');
        // Store user info for display
        const user = session.user;
        const displayName = user.user_metadata?.display_name
          || user.email?.split('@')[0].replace(/[._-]/g, ' ')
          || 'User';

        localStorage.setItem('vantage_dq_auth_user', JSON.stringify({
          id: user.id,
          email: user.email,
          displayName,
        }));

        // Redirect after brief success state
        setTimeout(() => navigate('/'), 1200);
      } else {
        // No session yet — wait for auth state change
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
          if (event === 'SIGNED_IN' && sess) {
            setStatus('success');
            subscription.unsubscribe();
            setTimeout(() => navigate('/'), 1200);
          } else if (event === 'TOKEN_REFRESHED') {
            setStatus('success');
            subscription.unsubscribe();
            setTimeout(() => navigate('/'), 1200);
          }
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          subscription.unsubscribe();
          if (status === 'loading') {
            setError('Sign-in timed out. Please try again.');
            setStatus('error');
          }
        }, 10000);
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: DS.bg }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: DS.brand }}>
          <Shield size={18} style={{ color: DS.accent }} />
        </div>
        <span className="text-sm font-black tracking-widest" style={{ color: DS.brand }}>VANTAGE DQ</span>
      </div>

      <div className="w-full max-w-sm text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 size={36} className="mx-auto animate-spin" style={{ color: DS.accent }} />
            <h1 className="text-xl font-black" style={{ color: DS.ink }}>Signing you in…</h1>
            <p className="text-sm" style={{ color: DS.inkSub }}>Just a moment while we verify your link.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={36} className="mx-auto" style={{ color: DS.success }} />
            <h1 className="text-xl font-black" style={{ color: DS.ink }}>You're signed in!</h1>
            <p className="text-sm" style={{ color: DS.inkSub }}>Taking you to Vantage DQ…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertTriangle size={36} className="mx-auto" style={{ color: DS.danger }} />
            <h1 className="text-xl font-black" style={{ color: DS.ink }}>Sign-in failed</h1>
            <p className="text-sm mb-4" style={{ color: DS.danger }}>{error}</p>
            <button onClick={() => navigate('/login')}
              className="text-sm font-medium px-4 py-2 rounded-xl"
              style={{ background: DS.brand, color: '#fff' }}>
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}

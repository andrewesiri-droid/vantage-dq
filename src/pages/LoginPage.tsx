import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { trpc } from '@/providers/trpc';
import { DS } from '@/constants';
import { Sparkles } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { data: user } = trpc.auth.me.useQuery();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleLogin = () => {
    const authUrl = new URL(import.meta.env.VITE_KIMI_AUTH_URL);
    authUrl.searchParams.set('client_id', import.meta.env.VITE_APP_ID);
    authUrl.searchParams.set('redirect_uri', `${window.location.origin}/api/oauth/callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'profile');
    authUrl.searchParams.set('state', btoa(window.location.pathname));
    window.location.href = authUrl.toString();
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: DS.canvas }}>
      <div className="w-full max-w-sm p-8 bg-white rounded-2xl shadow-lg" style={{ border: `1px solid ${DS.border}` }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: DS.accent }}>
            <Sparkles size={16} />
          </div>
          <span className="text-lg font-bold" style={{ color: DS.ink }}>Vantage DQ</span>
        </div>
        <p className="text-sm mb-6" style={{ color: DS.inkTer }}>Decision Quality Platform</p>
        <button
          onClick={handleLogin}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: DS.accent }}
        >
          Sign In
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { DS } from '@/constants';
import { createSession, supabase } from '@/lib/supabase-client';
import { useOrganisation } from '@/hooks/useOrganisation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, ChevronLeft, Loader2 } from 'lucide-react';

interface CleanSlateProps { onBack: () => void; }

export function CleanSlate({ onBack }: CleanSlateProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const { currentOrg } = useOrganisation();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    // Create session in Supabase or localStorage fallback
    const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
    const slug = await createSession(name.trim(), user?.email, user?.id, currentOrg?.id);
    navigate(`/session/${slug}`);
  };

  if (creating) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: DS.bg }}>
        <div className="text-center">
          <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: DS.accent }} />
          <h3 className="text-lg font-bold" style={{ color: DS.ink }}>Creating your session...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: DS.bg }}>
      <div className="flex items-center px-6 py-4 border-b" style={{ background: DS.brand }}>
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft size={16} className="text-white/70" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <FileText size={16} style={{ color: '#C9A84C' }} />
          <span className="text-sm font-bold text-white">Clean Slate</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-2" style={{ color: DS.ink }}>Clean Slate</h2>
          <p className="text-sm" style={{ color: DS.inkSub }}>
            Enter a name for your decision session and start immediately.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: DS.inkTer }}>
              SESSION NAME
            </label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Product Expansion Strategy 2026"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          <div className="pt-2">
            <Button
              className="w-full h-11 font-bold"
              style={{ background: DS.accent }}
              onClick={handleCreate}
              disabled={!name.trim()}>
              Start Session →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

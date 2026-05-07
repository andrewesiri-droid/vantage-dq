import { useState } from 'react';
import { DS } from '@/constants';
import { supabase } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { UserPlus, X, Check, Mail } from 'lucide-react';

interface Props { organisationId: number; orgName: string; onClose: () => void; }

export function OrgInvitePanel({ organisationId, orgName, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const sendInvite = async () => {
    if (!email.trim() || !supabase) return;
    setSending(true); setError('');
    try {
      // Store pending invite — user will be added when they log in
      const { error: insertError } = await supabase.from('organisation_invites').insert({
        organisation_id: organisationId, email: email.trim(), role, invited_at: new Date().toISOString()
      });
      if (insertError) { setError(insertError.message); setSending(false); return; }
      setSent(true); setEmail('');
    } catch(e: any) { setError(e.message); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: DS.canvas, border: '1px solid ' + DS.borderLight }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: DS.borderLight }}>
          <div className="flex items-center gap-2">
            <UserPlus size={16} style={{ color: DS.information.fill }} />
            <span className="font-bold text-sm" style={{ color: DS.ink }}>Invite to {orgName}</span>
          </div>
          <button onClick={onClose}><X size={16} style={{ color: DS.inkDis }} /></button>
        </div>
        <div className="p-6 space-y-4">
          {sent && (
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: DS.successSoft }}>
              <Check size={14} style={{ color: DS.success }} />
              <span className="text-xs font-bold" style={{ color: DS.success }}>Member added successfully</span>
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold uppercase mb-1.5 block" style={{ color: DS.inkDis }}>Email address</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@company.com"
              className="w-full text-sm px-3 py-2 rounded-xl border outline-none"
              style={{ borderColor: DS.borderLight, background: DS.bg }}
              onKeyDown={e => e.key === 'Enter' && sendInvite()} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase mb-1.5 block" style={{ color: DS.inkDis }}>Role</label>
            <div className="flex gap-2">
              {(['member', 'admin'] as const).map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold capitalize"
                  style={{ background: role === r ? DS.information.soft : DS.bg, color: role === r ? DS.information.fill : DS.inkSub, border: '1px solid ' + (role === r ? DS.information.fill + '40' : DS.borderLight) }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs" style={{ color: DS.danger }}>{error}</p>}
          <Button className="w-full gap-2" onClick={sendInvite} disabled={sending || !email.trim()}>
            <Mail size={14} /> {sending ? 'Adding…' : 'Add Member'}
          </Button>
          <p className="text-[10px] text-center" style={{ color: DS.inkDis }}>Member must have an existing Vantage DQ account</p>
        </div>
      </div>
    </div>
  );
}

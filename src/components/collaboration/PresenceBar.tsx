/**
 * PresenceBar — shows who's currently in the session
 * Appears in the AppShell header next to the session name
 * Reads from session_members table via Supabase Realtime
 */
import { useState, useEffect } from 'react';
import { DS } from '@/constants';
import { supabase, isSupabaseReady } from '@/lib/supabase-client';
import { Users, Crown, Eye, Pencil } from 'lucide-react';

interface Member {
  id: number;
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  is_online: boolean;
  is_guest: boolean;
}

interface Props {
  sessionId: number;
  onInviteClick: () => void;
}

const ROLE_ICONS: Record<string, any> = {
  owner: Crown, facilitator: Crown, participant: Pencil, observer: Eye,
};
const ROLE_COLORS: Record<string, string> = {
  owner: DS.brand, facilitator: DS.accent, participant: DS.alternatives.fill, observer: DS.inkSub,
};

function getInitials(member: Member): string {
  const name = member.display_name || member.email || member.user_id;
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '??';
}

export function PresenceBar({ sessionId, onInviteClick }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!isSupabaseReady || !supabase) return;

    // Initial load
    supabase.from('session_members').select('*').eq('session_id', sessionId)
      .then(({ data }) => { if (data) setMembers(data); });

    // Realtime subscription
    const channel = supabase
      .channel(`presence:${sessionId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'session_members',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') setMembers(p => [...p, payload.new as Member]);
        if (payload.eventType === 'UPDATE') setMembers(p => p.map(m => m.id === (payload.new as Member).id ? payload.new as Member : m));
        if (payload.eventType === 'DELETE') setMembers(p => p.filter(m => m.id !== (payload.old as Member).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const onlineMembers = members.filter(m => m.is_online);
  const displayMembers = onlineMembers.slice(0, 4);
  const overflow = onlineMembers.length - 4;

  if (!isSupabaseReady) {
    // Show invite button even without Supabase
    return (
      <button onClick={onInviteClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors hover:bg-white/10"
        style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <Users size={12} /> <span className="hidden sm:inline">Invite</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Avatar stack */}
      {onlineMembers.length > 0 && (
        <button onClick={() => setShowAll(!showAll)} className="flex items-center">
          <div className="flex -space-x-1.5">
            {displayMembers.map((m, i) => {
              const color = ROLE_COLORS[m.role] || DS.accent;
              return (
                <div key={m.id}
                  className="relative w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white/20 shrink-0"
                  style={{ background: color, zIndex: displayMembers.length - i }}
                  title={m.display_name || m.email || m.user_id}>
                  {getInitials(m)}
                  {m.is_online && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 ring-1 ring-white" />
                  )}
                </div>
              );
            })}
            {overflow > 0 && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white ring-2 ring-white/20"
                style={{ background: DS.inkSub }}>
                +{overflow}
              </div>
            )}
          </div>
          <span className="text-[10px] ml-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {onlineMembers.length}
          </span>
        </button>
      )}

      {/* Invite button */}
      <button onClick={onInviteClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors hover:bg-white/10"
        style={{ color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.2)' }}>
        <Users size={12} />
        <span className="hidden sm:inline">{onlineMembers.length === 0 ? 'Invite' : '+ Invite'}</span>
      </button>

      {/* Dropdown showing all members */}
      {showAll && onlineMembers.length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowAll(false)} />
          <div className="absolute top-full right-0 mt-2 w-56 rounded-xl shadow-2xl border z-50 overflow-hidden"
            style={{ background: '#fff', borderColor: DS.borderLight }}>
            <div className="px-3 py-2 border-b text-[9px] font-bold uppercase tracking-wider"
              style={{ background: DS.bg, borderColor: DS.borderLight, color: DS.inkDis }}>
              {onlineMembers.length} in session
            </div>
            {members.map(m => {
              const color = ROLE_COLORS[m.role] || DS.accent;
              const RIcon = ROLE_ICONS[m.role] || Pencil;
              return (
                <div key={m.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ background: color }}>
                    {getInitials(m)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: DS.ink }}>
                      {m.display_name || m.email || m.user_id}
                    </div>
                    <div className="flex items-center gap-1 text-[9px]" style={{ color: DS.inkDis }}>
                      <RIcon size={9} style={{ color }} />
                      <span className="capitalize">{m.role}</span>
                      {m.is_guest && <span>· Guest</span>}
                    </div>
                  </div>
                  {m.is_online && <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

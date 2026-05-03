/**
 * Session Invite Panel — Phase 1 Collaboration
 *
 * Three ways to invite people into a session:
 * 1. Workshop Code  — 6-digit code (DQ-XXXX) for in-room use
 * 2. Invite Link    — shareable URL with token, set expiry
 * 3. Email Invite   — sends invite with role assignment
 *
 * Reads/writes to Supabase session_invitations table.
 * Falls back gracefully if Supabase is not configured.
 */
import { useState, useEffect } from 'react';
import { DS } from '@/constants';
import { supabase, isSupabaseReady, generateInviteCode, generateInviteToken } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, Link2, Mail, Copy, Check, X, Plus, RefreshCw,
  Shield, Eye, Pencil, Crown, QrCode, Clock, Trash2,
  AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';

type Role = 'facilitator' | 'participant' | 'observer';
type Tab = 'code' | 'link' | 'email' | 'manage';

interface Invitation {
  id: string;
  email: string | null;
  role: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  is_revoked: boolean;
}

interface Member {
  id: number;
  user_id: string;
  role: string;
  display_name: string | null;
  email: string | null;
  is_online: boolean;
  joined_at: string | null;
}

interface Props {
  sessionId: number;
  sessionName: string;
  sessionSlug: string;
  onClose: () => void;
}

const ROLE_CONFIG: Record<Role, { label: string; icon: any; color: string; desc: string }> = {
  facilitator: {
    label: 'Facilitator', icon: Crown, color: DS.accent,
    desc: 'Full access to all modules, Workshop Mode control, AI tools. Cannot delete session.',
  },
  participant: {
    label: 'Participant', icon: Pencil, color: DS.alternatives.fill,
    desc: 'Contribute to active workshop phases — add notes, vote, raise issues.',
  },
  observer: {
    label: 'Observer', icon: Eye, color: DS.inkSub,
    desc: 'Read-only access to all modules. Cannot contribute or edit.',
  },
};

export function SessionInvitePanel({ sessionId, sessionName, sessionSlug, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('code');
  const [role, setRole] = useState<Role>('participant');
  const [inviteCode, setInviteCode] = useState<string>('');
  const [inviteLink, setInviteLink] = useState<string>('');
  const [linkExpiry, setLinkExpiry] = useState<'2h' | '24h' | '48h' | '7d'>('48h');
  const [emails, setEmails] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = window.location.hostname === 'localhost' 
    ? window.location.origin 
    : 'https://vantage-dq.vercel.app';

  useEffect(() => {
    loadInviteCode();
    if (activeTab === 'manage') {
      loadInvitationsAndMembers();
    }
  }, [sessionId, activeTab]);

  // ── LOAD EXISTING INVITE CODE ───────────────────────────────────────────────
  const loadInviteCode = async () => {
    if (!isSupabaseReady || !supabase) {
      // Demo mode: generate from session ID
      setInviteCode(`DQ-${String(sessionId).padStart(4, '0')}`);
      return;
    }
    const { data } = await supabase
      .from('dq_sessions')
      .select('invite_code')
      .eq('id', sessionId)
      .single();

    if (data?.invite_code) {
      setInviteCode(data.invite_code);
    }
  };

  // ── GENERATE WORKSHOP CODE ──────────────────────────────────────────────────
  const generateCode = async () => {
    setLoading(true);
    setError(null);
    const code = generateInviteCode();

    if (isSupabaseReady && supabase) {
      const { error: err } = await supabase
        .from('dq_sessions')
        .update({ invite_code: code })
        .eq('id', sessionId);
      if (err) { setError('Could not save code. Try again.'); setLoading(false); return; }
    }

    setInviteCode(code);
    setLoading(false);
  };

  // ── GENERATE INVITE LINK ────────────────────────────────────────────────────
  const generateLink = async () => {
    setLoading(true);
    setError(null);
    const token = generateInviteToken();
    const expiryMap = { '2h': 2, '24h': 24, '48h': 48, '7d': 168 };
    const hoursToExpiry = expiryMap[linkExpiry];
    const expiresAt = new Date(Date.now() + hoursToExpiry * 60 * 60 * 1000).toISOString();

    if (isSupabaseReady && supabase) {
      const { error: err } = await supabase
        .from('session_invitations')
        .insert({
          session_id: sessionId,
          role,
          token,
          expires_at: expiresAt,
        });
      if (err) { setError('Could not create link. Try again.'); setLoading(false); return; }
    }

    const url = `${baseUrl}/join/${token}`;
    setInviteLink(url);
    setLoading(false);
  };

  // ── SEND EMAIL INVITES ──────────────────────────────────────────────────────
  const sendEmailInvites = async () => {
    const emailList = emails.split(/[\s,;]+/).map(e => e.trim()).filter(e => e.includes('@'));
    if (!emailList.length) { setError('Enter at least one valid email address.'); return; }

    setLoading(true);
    setError(null);

    const tokens: { email: string; token: string }[] = [];

    // 1. Create invite records in Supabase
    if (isSupabaseReady && supabase) {
      const inviteRows = emailList.map(email => ({
        session_id: sessionId,
        email,
        role,
        token: generateInviteToken(),
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      }));

      const { data, error: err } = await supabase
        .from('session_invitations')
        .insert(inviteRows)
        .select();

      if (err) { setError('Could not create invitations. Try again.'); setLoading(false); return; }

      // Track tokens for email sending
      data?.forEach((row: any) => tokens.push({ email: row.email, token: row.token }));
    }

    // 2. Send emails via /api/send-invite
    const emailResults = await Promise.allSettled(
      tokens.map(({ email, token }) =>
        fetch('/api/send-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token, role, sessionName, invitedBy: 'The Vantage DQ team' }),
        }).then(r => r.json())
      )
    );

    const failed = emailResults.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      setError(`${tokens.length - failed} email(s) sent. ${failed} failed — check Manage tab for links.`);
    } else {
      setError(null);
    }

    setEmails('');
    setLoading(false);
    setActiveTab('manage');
  };

  // ── LOAD INVITATIONS & MEMBERS ──────────────────────────────────────────────
  const loadInvitationsAndMembers = async () => {
    if (!isSupabaseReady || !supabase) return;
    setLoading(true);

    const [{ data: invs }, { data: mems }] = await Promise.all([
      supabase.from('session_invitations').select('*').eq('session_id', sessionId).order('created_at', { ascending: false }),
      supabase.from('session_members').select('*').eq('session_id', sessionId),
    ]);

    if (invs) setInvitations(invs);
    if (mems) setMembers(mems);
    setLoading(false);
  };

  // ── REVOKE INVITATION ───────────────────────────────────────────────────────
  const revokeInvitation = async (id: string) => {
    if (!supabase) return;
    await supabase.from('session_invitations').update({ is_revoked: true }).eq('id', id);
    setInvitations(p => p.map(i => i.id === id ? { ...i, is_revoked: true } : i));
  };

  // ── COPY TO CLIPBOARD ───────────────────────────────────────────────────────
  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el);
      el.select(); document.execCommand('copy');
      document.body.removeChild(el);
    });
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const expiryLabel = (iso: string) => {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff < 0) return 'Expired';
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Expires soon';
    if (hours < 24) return `${hours}h remaining`;
    return `${Math.floor(hours / 24)}d remaining`;
  };

  const RoleIcon = ROLE_CONFIG[role].icon;
  const roleCfg = ROLE_CONFIG[role];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(11,29,58,0.7)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#fff' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ background: DS.brand, borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: DS.accent }}>
            <Users size={15} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-white">Invite to Session</div>
            <div className="text-[10px] text-white/50 truncate">{sessionName}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X size={15} className="text-white/60" />
          </button>
        </div>

        {/* Role selector */}
        <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: DS.borderLight }}>
          <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>INVITE AS</div>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG.participant][]).map(([r, cfg]) => {
              const Icon = cfg.icon;
              const isSelected = role === r;
              return (
                <button key={r} onClick={() => setRole(r)}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all text-center"
                  style={{ borderColor: isSelected ? cfg.color : DS.borderLight, background: isSelected ? `${cfg.color}10` : DS.bg }}>
                  <Icon size={14} style={{ color: cfg.color }} />
                  <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[9px] mt-1.5" style={{ color: DS.inkDis }}>{roleCfg.desc}</p>
        </div>

        {/* Tab bar */}
        <div className="flex border-b" style={{ borderColor: DS.borderLight }}>
          {([
            { id: 'code',   label: 'Workshop Code', icon: QrCode },
            { id: 'link',   label: 'Share Link',    icon: Link2  },
            { id: 'email',  label: 'Email Invite',  icon: Mail   },
            { id: 'manage', label: 'Manage',        icon: Users  },
          ] as { id: Tab; label: string; icon: any }[]).map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[9px] font-medium transition-colors"
                style={{ color: isActive ? DS.accent : DS.inkTer, borderBottom: isActive ? `2px solid ${DS.accent}` : '2px solid transparent', marginBottom: -1 }}>
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="px-5 py-4 min-h-[200px]">

          {/* ── WORKSHOP CODE ── */}
          {activeTab === 'code' && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: DS.inkSub }}>
                Share this code with participants in the room. They enter it at <strong>vantage-dq.vercel.app/join</strong> to join instantly — no account needed.
              </p>

              {inviteCode ? (
                <div className="text-center">
                  <div className="inline-flex flex-col items-center gap-2 p-6 rounded-2xl w-full"
                    style={{ background: `${DS.accent}10`, border: `2px dashed ${DS.accent}40` }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: DS.accent }}>WORKSHOP CODE</div>
                    <div className="text-5xl font-black tracking-widest" style={{ color: DS.brand, fontFamily: 'monospace' }}>
                      {inviteCode}
                    </div>
                    <div className="text-[9px]" style={{ color: DS.inkDis }}>Role: {ROLE_CONFIG[role].label}</div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="flex-1 gap-1.5 text-xs h-8"
                      style={{ background: copied === 'code' ? DS.success : DS.brand }}
                      onClick={() => copyToClipboard(inviteCode, 'code')}>
                      {copied === 'code' ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Code</>}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={generateCode} disabled={loading}>
                      <RefreshCw size={12} /> New Code
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-xs mb-3" style={{ color: DS.inkDis }}>No workshop code yet</p>
                  <Button style={{ background: DS.accent }} className="gap-2" onClick={generateCode} disabled={loading}>
                    <QrCode size={14} /> Generate Workshop Code
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── SHARE LINK ── */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: DS.inkSub }}>
                Generate a shareable link. Anyone with the link joins as <strong>{ROLE_CONFIG[role].label}</strong>. Set an expiry and revoke anytime.
              </p>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: DS.inkDis }}>LINK EXPIRY</div>
                <div className="flex gap-2">
                  {(['2h', '24h', '48h', '7d'] as const).map(opt => (
                    <button key={opt} onClick={() => setLinkExpiry(opt)}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                      style={{ background: linkExpiry === opt ? DS.accent : DS.bg, color: linkExpiry === opt ? '#fff' : DS.inkSub, border: `1px solid ${linkExpiry === opt ? DS.accent : DS.borderLight}` }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {inviteLink ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input value={inviteLink} readOnly className="flex-1 text-xs font-mono" style={{ fontSize: 10 }} />
                    <Button size="sm" className="shrink-0 gap-1 text-xs h-9"
                      style={{ background: copied === 'link' ? DS.success : DS.accent }}
                      onClick={() => copyToClipboard(inviteLink, 'link')}>
                      {copied === 'link' ? <Check size={12} /> : <Copy size={12} />}
                    </Button>
                  </div>
                  <button onClick={() => { setInviteLink(''); generateLink(); }}
                    className="text-[10px] flex items-center gap-1" style={{ color: DS.inkDis }}>
                    <RefreshCw size={10} /> Generate new link
                  </button>
                </div>
              ) : (
                <Button className="w-full gap-2" style={{ background: DS.accent }} onClick={generateLink} disabled={loading}>
                  <Link2 size={14} /> {loading ? 'Generating…' : 'Generate Invite Link'}
                </Button>
              )}
            </div>
          )}

          {/* ── EMAIL INVITE ── */}
          {activeTab === 'email' && (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: DS.inkSub }}>
                Enter email addresses and each person gets a unique invite link for the <strong>{ROLE_CONFIG[role].label}</strong> role.
              </p>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.inkDis }}>EMAIL ADDRESSES</div>
                <textarea
                  value={emails}
                  onChange={e => setEmails(e.target.value)}
                  placeholder="jane@company.com, john@company.com..."
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-xl border resize-none focus:outline-none focus:ring-1"
                  style={{ borderColor: DS.borderLight, fontFamily: 'inherit' }}
                />
                <p className="text-[9px] mt-0.5" style={{ color: DS.inkDis }}>Separate multiple addresses with commas or new lines</p>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.inkDis }}>OPTIONAL MESSAGE</div>
                <Input value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Add a personal note to the invite..." className="text-xs" />
              </div>
              <Button className="w-full gap-2" style={{ background: DS.accent }} onClick={sendEmailInvites} disabled={loading || !emails.trim()}>
                <Mail size={14} /> {loading ? 'Sending…' : 'Send Invitations'}
              </Button>

              <div className="flex items-start gap-2 p-2.5 rounded-xl" style={{ background: DS.accentSoft }}>
                <CheckCircle size={11} style={{ color: DS.success, flexShrink: 0, marginTop: 1 }} />
                <p className="text-[9px]" style={{ color: DS.inkSub }}>
                  Branded invite emails sent via Resend. Each person gets a unique link for their role.
                </p>
              </div>
            </div>
          )}

          {/* ── MANAGE ── */}
          {activeTab === 'manage' && (
            <div className="space-y-3">
              {/* Active members */}
              {members.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>
                    ACTIVE MEMBERS ({members.length})
                  </div>
                  <div className="space-y-1.5">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-xl"
                        style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ background: m.role === 'owner' ? DS.brand : m.role === 'facilitator' ? DS.accent : m.role === 'observer' ? DS.inkDis : DS.alternatives.fill }}>
                          {(m.display_name || m.email || m.user_id).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate" style={{ color: DS.ink }}>{m.display_name || m.email || m.user_id}</div>
                          <div className="text-[9px] capitalize" style={{ color: DS.inkDis }}>{m.role}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {m.is_online && <div className="w-2 h-2 rounded-full bg-green-400" />}
                          <Badge style={{ background: DS.bg, color: DS.inkDis, border: `1px solid ${DS.borderLight}`, fontSize: 8 }}>
                            {m.is_online ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending invitations */}
              {!isSupabaseReady ? (
                <div className="text-center py-6" style={{ color: DS.inkDis }}>
                  <p className="text-xs">Connect Supabase to manage invitations</p>
                </div>
              ) : invitations.length === 0 && members.length === 0 ? (
                <div className="text-center py-6" style={{ color: DS.inkDis }}>
                  <Users size={24} className="mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No invitations yet — use Code, Link, or Email to invite people</p>
                </div>
              ) : (
                invitations.length > 0 && (
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>
                      PENDING INVITATIONS ({invitations.filter(i => !i.is_revoked && !i.accepted_at).length})
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {invitations.map(inv => {
                        const isExpired = new Date(inv.expires_at) < new Date();
                        const isAccepted = !!inv.accepted_at;
                        const statusColor = inv.is_revoked ? DS.danger : isAccepted ? DS.success : isExpired ? DS.inkDis : DS.accent;

                        return (
                          <div key={inv.id} className="flex items-center gap-2 p-2.5 rounded-xl"
                            style={{ background: DS.bg, border: `1px solid ${DS.borderLight}`, opacity: inv.is_revoked ? 0.5 : 1 }}>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs truncate" style={{ color: DS.ink }}>
                                {inv.email || `Link invite (${inv.role})`}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[8px] capitalize px-1.5 py-0.5 rounded font-medium"
                                  style={{ background: `${statusColor}15`, color: statusColor }}>
                                  {inv.is_revoked ? 'Revoked' : isAccepted ? 'Accepted' : isExpired ? 'Expired' : 'Pending'}
                                </span>
                                <span className="text-[8px]" style={{ color: DS.inkDis }}>
                                  <Clock size={7} className="inline mr-0.5" />{expiryLabel(inv.expires_at)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!inv.is_revoked && !isAccepted && (
                                <>
                                  <button
                                    onClick={() => copyToClipboard(`${baseUrl}/join/${inv.token}`, inv.id)}
                                    className="p-1 rounded" style={{ color: DS.inkDis }}>
                                    {copied === inv.id ? <Check size={11} style={{ color: DS.success }} /> : <Copy size={11} />}
                                  </button>
                                  <button onClick={() => revokeInvitation(inv.id)}
                                    className="p-1 rounded hover:text-red-500 transition-colors" style={{ color: DS.inkDis }}>
                                    <Trash2 size={11} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}

              <Button size="sm" variant="outline" className="w-full text-xs gap-1.5 h-7" onClick={loadInvitationsAndMembers} disabled={loading}>
                <RefreshCw size={11} /> Refresh
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl" style={{ background: DS.dangerSoft }}>
              <AlertTriangle size={12} style={{ color: DS.danger }} />
              <p className="text-[10px]" style={{ color: DS.inkSub }}>{error}</p>
              <button onClick={() => setError(null)} className="ml-auto"><X size={10} style={{ color: DS.inkDis }} /></button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: DS.borderLight, background: DS.bg }}>
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: DS.inkDis }}>
            <Shield size={11} style={{ color: DS.success }} />
            {isSupabaseReady ? 'Invite links stored securely in database' : 'Demo mode — connect Supabase for full features'}
          </div>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: DS.inkSub }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

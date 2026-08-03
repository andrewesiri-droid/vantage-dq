import { DS } from '@/constants';

interface Props { trust: { level: string; color: string; label: string; reason: string } | null; }

export function DQTrustBadge({ trust }: Props) {
  if (!trust) return null;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: `${trust.color}15`, border: `1px solid ${trust.color}30` }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: trust.color }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: trust.color }}>{trust.label}</span>
      {trust.reason && <span style={{ fontSize: 11, color: DS.inkTer }}>· {trust.reason}</span>}
    </div>
  );
}

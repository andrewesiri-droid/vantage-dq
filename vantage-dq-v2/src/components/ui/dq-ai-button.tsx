import { DS } from '@/constants';
import { Sparkles } from 'lucide-react';

interface Props {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export function DQAIButton({ onClick, disabled, loading, children, variant = 'primary' }: Props) {
  const isPrimary = variant === 'primary';
  return (
    <button onClick={onClick} disabled={disabled || loading}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: disabled || loading ? DS.surfaceAlt : isPrimary ? DS.accent : DS.accentLight, color: disabled || loading ? DS.inkTer : isPrimary ? '#fff' : DS.accent, border: isPrimary ? 'none' : `1px solid ${DS.accent}30`, cursor: disabled || loading ? 'not-allowed' : 'pointer' }}>
      <Sparkles size={13} />
      {loading ? 'Analyzing…' : children}
    </button>
  );
}

import { DS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface DQAIButtonProps {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  label: string;
  variant?: 'default' | 'outline';
  color?: string;
  size?: 'sm' | 'default';
  icon?: any;
}

export function DQAIButton({ onClick, disabled, busy, busyLabel, label, variant = 'default', color, size = 'sm', icon: Icon }: DQAIButtonProps) {
  return (
    <div className="relative inline-flex flex-col items-center gap-0.5">
      <Button
        size={size}
        variant={variant}
        className="gap-1 text-xs h-7 shrink-0"
        style={color ? { background: color } : undefined}
        onClick={onClick}
        disabled={disabled || busy}
      >
        {Icon ? <Icon size={11} /> : <Sparkles size={11} />}
        {busy ? (busyLabel || 'Generating…') : label}
      </Button>
      <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full" style={{ background: DS.information.soft, border: `1px solid ${DS.information.fill}20` }}>
        <div className="w-1 h-1 rounded-full" style={{ background: DS.information.fill }} />
        <span className="text-[7px] font-bold uppercase tracking-wide" style={{ color: DS.information.fill }}>DQ Governed</span>
      </div>
    </div>
  );
}

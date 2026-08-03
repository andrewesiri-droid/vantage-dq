import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline';
  className?: string;
  style?: React.CSSProperties;
}

const COLORS = {
  default: { bg: '#F2F4F8', color: '#6B7A99' },
  success: { bg: '#DCFCE7', color: '#22C55E' },
  warning: { bg: '#FEF3C7', color: '#F59E0B' },
  danger:  { bg: '#FEE2E2', color: '#EF4444' },
  outline: { bg: 'transparent', color: '#6B7A99' },
};

export function Badge({ children, variant = 'default', style }: BadgeProps) {
  const c = COLORS[variant] ?? COLORS.default;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color, border: variant === 'outline' ? '1px solid #E2E6EE' : 'none', ...style }}>
      {children}
    </span>
  );
}

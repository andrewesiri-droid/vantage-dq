import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({ variant = 'default', size = 'md', children, style, disabled, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 8, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: size === 'sm' ? 12 : size === 'lg' ? 15 : 13,
    padding: size === 'sm' ? '6px 12px' : size === 'lg' ? '12px 20px' : '8px 16px',
    transition: 'all 0.15s',
    background: variant === 'default' ? '#4F6AF5' : 'transparent',
    color: variant === 'default' ? '#fff' : '#0F1724',
    border: variant === 'outline' ? '1px solid #E2E6EE' : 'none',
    opacity: disabled ? 0.5 : 1,
  };
  return <button style={{ ...base, ...style }} disabled={disabled} {...props}>{children}</button>;
}

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ style, className, ...props }: InputProps) {
  return (
    <input
      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, background: '#F2F4F8', border: '1px solid #E2E6EE', color: '#0F1724', outline: 'none', ...style }}
      {...props}
    />
  );
}

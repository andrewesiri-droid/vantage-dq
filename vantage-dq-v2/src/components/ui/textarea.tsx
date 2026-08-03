import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ style, className, ...props }: TextareaProps) {
  return (
    <textarea
      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, background: '#F2F4F8', border: '1px solid #E2E6EE', color: '#0F1724', outline: 'none', resize: 'vertical', lineHeight: '1.6', ...style }}
      {...props}
    />
  );
}

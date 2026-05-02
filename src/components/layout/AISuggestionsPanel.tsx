import { DS } from '@/constants';
import { Bot } from 'lucide-react';

interface Props { sessionId: number; module: string; }

export function AISuggestionsPanel({ }: Props) {
  return (
    <div className="flex items-center gap-2 py-2 px-3">
      <Bot size={12} style={{ color: DS.inkDis }} />
      <span className="text-[10px]" style={{ color: DS.inkDis }}>
        Click the AI Advisor to run DQ analysis for this module.
      </span>
    </div>
  );
}

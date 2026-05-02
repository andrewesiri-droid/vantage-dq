import { useState, useRef, useEffect } from 'react';
import { isDemoMode, demoApi } from '@/lib/demoData';
import { trpc } from '@/providers/trpc';
import { DS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Bot, Loader2, Send, CheckCircle, XCircle, User } from 'lucide-react';

interface AIMessage {
  role: 'user' | 'ai';
  text: string;
  structured?: boolean;
}

interface AIPanelProps {
  onClose: () => void;
  module?: string;
  sessionId?: number;
}

export function AIPanel({ onClose, module = 'export', sessionId }: AIPanelProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const aiAnalyse = trpc.ai.analyse.useMutation({
    onSuccess: (data) => {
      let display = data.summary || 'Analysis complete.';
      try {
        const parsed = JSON.parse(data.content);
        if (parsed.overallScore !== undefined) {
          display = `DQ Score: ${parsed.overallScore}/100\n\n${parsed.summary}\n\nRecommendations:\n${(parsed.recommendations || []).map((r: any) => `• [${r.priority.toUpperCase()}] ${r.dimension}: ${r.advice}`).join('\n')}`;
        }
      } catch { /* use summary */ }

      setMessages(prev => [...prev, { role: 'ai', text: display, structured: true }]);
      if (sessionId) utils.ai.list.invalidate({ sessionId, module });
    },
    onError: (err) => {
      setMessages(prev => [...prev, { role: 'ai', text: `Analysis error: ${err.message}. Please try again.` }]);
    },
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const runAnalysis = () => {
    if (!sessionId) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Please create and open a session first to run DQ analysis.' }]);
      return;
    }
    setMessages(prev => [...prev, { role: 'user', text: `Run ${module} analysis` }]);

    if (isDemoMode()) {
      // Demo mode: run analysis directly
      setMessages(prev => [...prev, { role: 'ai', text: 'Analysing...', structured: false }]);
      setTimeout(() => {
        const result = demoApi.analyse({ sessionId, module });
        let display = result.summary || 'Analysis complete.';
        try {
          const parsed = JSON.parse(result.content);
          if (parsed.overallScore !== undefined) {
            display = `DQ Score: ${parsed.overallScore}/100\n\n${parsed.summary}\n\nRecommendations:\n${(parsed.recommendations || []).map((r: any) => `• [${r.priority.toUpperCase()}] ${r.dimension}: ${r.advice}`).join('\n')}`;
          }
        } catch { /* use summary */ }
        setMessages(prev => {
          const next = prev.filter(m => m.text !== 'Analysing...');
          return [...next, { role: 'ai', text: display, structured: true }];
        });
      }, 800);
      return;
    }

    aiAnalyse.mutate({ sessionId, module });
  };

  const busy = aiAnalyse.isPending;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col border-l" style={{ borderColor: DS.borderLight }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ background: DS.brand }}>
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-yellow-400" />
          <span className="text-xs font-bold text-white">Vantage AI Advisor</span>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white text-sm">&times;</button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot size={28} className="mx-auto mb-3" style={{ color: DS.inkDis }} />
            <p className="text-xs font-medium mb-1" style={{ color: DS.ink }}>DQ Analysis Ready</p>
            <p className="text-[10px] max-w-[240px] mx-auto" style={{ color: DS.inkSub }}>
              Click "Run Analysis" for a structured Decision Quality assessment using the Decision Frameworks Company methodology.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'ai' && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: DS.accentSoft }}>
                <Bot size={12} style={{ color: DS.accent }} />
              </div>
            )}
            <div
              className={`rounded-xl px-3 py-2 max-w-[280px] ${
                msg.structured ? 'w-full max-w-none' : ''
              }`}
              style={{
                background: msg.role === 'user' ? DS.accent : msg.structured ? DS.canvas : DS.bg,
                color: msg.role === 'user' ? '#fff' : DS.ink,
              }}
            >
              {msg.structured ? (
                <StructuredAIOutput text={msg.text} />
              ) : (
                <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: DS.accent }}>
                <User size={12} className="text-white" />
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 py-2">
            <Loader2 size={12} className="animate-spin" style={{ color: DS.accent }} />
            <span className="text-[10px]" style={{ color: DS.inkTer }}>Running DQ analysis...</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t space-y-2 shrink-0" style={{ borderColor: DS.borderLight }}>
        <Button
          size="sm"
          className="w-full h-8 text-[10px] gap-1"
          style={{ background: DS.accent }}
          onClick={runAnalysis}
          disabled={busy}
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : <Bot size={10} />}
          {busy ? 'Analysing...' : `Run ${module} Analysis`}
        </Button>
        <p className="text-[9px] text-center" style={{ color: DS.inkDis }}>
          Analysis is rule-based and deterministic — same data always produces the same result.
        </p>
      </div>
    </div>
  );
}

/**
 * Parse and render structured AI output with scores, recommendations, etc.
 */
function StructuredAIOutput({ text }: { text: string }) {
  // Extract DQ Score line
  const scoreMatch = text.match(/DQ Score:\s*(\d+)/);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null;
  const scoreColor = score && score >= 70 ? '#059669' : score && score >= 45 ? '#D97706' : '#DC2626';

  // Split by sections
  const lines = text.split('\n').filter(l => l.trim());

  return (
    <div className="space-y-2">
      {score !== null && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-extrabold" style={{ color: scoreColor }}>{score}</span>
          <span className="text-[10px] font-bold" style={{ color: scoreColor }}>
            /100 — {score >= 70 ? 'Strong' : score >= 45 ? 'Needs Work' : 'Critical Gaps'}
          </span>
        </div>
      )}
      <div className="space-y-1">
        {lines.map((line, i) => {
          if (line.startsWith('DQ Score:')) return null;
          if (line.startsWith('Recommendations:')) return null;

          if (line.startsWith('• [CRITICAL]')) {
            return (
              <div key={i} className="flex items-start gap-1.5 p-1.5 rounded" style={{ background: '#FEF2F2' }}>
                <XCircle size={10} className="shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
                <span className="text-[10px]" style={{ color: '#991B1B' }}>{line.replace('• [CRITICAL] ', '')}</span>
              </div>
            );
          }
          if (line.startsWith('• [IMPORTANT]')) {
            return (
              <div key={i} className="flex items-start gap-1.5 p-1.5 rounded" style={{ background: '#FFFBEB' }}>
                <Shield size={10} className="shrink-0 mt-0.5" style={{ color: '#D97706' }} />
                <span className="text-[10px]" style={{ color: '#92400E' }}>{line.replace('• [IMPORTANT] ', '')}</span>
              </div>
            );
          }
          if (line.startsWith('• [SUGGESTED]')) {
            return (
              <div key={i} className="flex items-start gap-1.5 p-1.5 rounded" style={{ background: '#F1F5F9' }}>
                <CheckCircle size={10} className="shrink-0 mt-0.5" style={{ color: '#64748B' }} />
                <span className="text-[10px]" style={{ color: '#475569' }}>{line.replace('• [SUGGESTED] ', '')}</span>
              </div>
            );
          }
          return <p key={i} className="text-[11px] leading-relaxed" style={{ color: DS.inkSub }}>{line}</p>;
        })}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { isDemoMode, demoApi } from '@/lib/demoData';
import { trpc } from '@/providers/trpc';
import { DS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bot, CheckCircle, XCircle, AlertTriangle, Loader2,
  Shield
} from 'lucide-react';

interface Props {
  sessionId: number;
  module: string;
}

export function AISuggestionsPanel({ sessionId, module }: Props) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Demo mode: use localStorage
  if (isDemoMode()) {
    const data = demoApi.listAISuggestions({ sessionId, module });
    const pending = data.filter((s: any) => s.status === 'pending');

    if (pending.length === 0) {
      return (
        <div className="flex items-center gap-2 py-3 px-4">
          <Bot size={12} style={{ color: DS.inkDis }} />
          <span className="text-[10px]" style={{ color: DS.inkDis }}>Click the AI Advisor to run DQ analysis for this module.</span>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Shield size={14} style={{ color: DS.accent }} />
          <span className="text-xs font-bold" style={{ color: DS.ink }}>DQ Analysis ({pending.length})</span>
        </div>
        {pending.map(sugg => <SuggestionCard key={sugg.id} sugg={sugg} onAction={() => {
          const updated = demoApi.listAISuggestions({ sessionId, module }).filter((s: any) => s.status === 'pending');
          setSuggestions(updated);
        }} />)}
      </div>
    );
  }

  // Normal mode: use tRPC
  return <BackendAISuggestionsPanel sessionId={sessionId} module={module} />;
}

function SuggestionCard({ sugg, onAction }: { sugg: any; onAction: () => void }) {
  let parsed: any = {};
  try { parsed = JSON.parse(sugg.content); } catch { parsed = { summary: 'Could not parse' }; }

  const score = Math.max(0, Math.min(100, parsed.overallScore || 0));
  const confidence = Math.max(0, Math.min(100, parsed.confidence || 0));
  const checks = parsed.checks || [];
  const recommendations = parsed.recommendations || [];

  const scoreColor = score >= 70 ? '#059669' : score >= 45 ? '#D97706' : '#DC2626';
  const scoreBg = score >= 70 ? '#ECFDF5' : score >= 45 ? '#FFFBEB' : '#FEF2F2';
  const scoreLabel = score >= 70 ? 'Strong' : score >= 45 ? 'Needs Work' : 'Critical Gaps';

  const handleAccept = () => { demoApi.acceptAISuggestion({ id: sugg.id }); onAction(); };
  const handleReject = () => { demoApi.rejectAISuggestion({ id: sugg.id }); onAction(); };

  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0" style={{ background: scoreBg }}>
            <span className="text-lg font-extrabold" style={{ color: scoreColor }}>{score}</span>
            <span className="text-[8px] font-bold uppercase" style={{ color: scoreColor }}>{scoreLabel}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold" style={{ color: DS.ink }}>DQ Quality Analysis</span>
              {confidence < 70 && (
                <Badge variant="outline" className="text-[8px] h-4" style={{ color: '#D97706', borderColor: '#FDE68A' }}>
                  <AlertTriangle size={8} className="mr-0.5" /> Low confidence
                </Badge>
              )}
            </div>
            <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: DS.inkSub }}>{parsed.summary || 'Analysis complete'}</p>
          </div>
        </div>

        {checks.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkTer }}>Checks</p>
            {checks.map((check: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-1.5 rounded" style={{ background: check.pass ? '#ECFDF5' : '#FEF2F2' }}>
                {check.pass ? <CheckCircle size={10} style={{ color: '#059669' }} /> : <XCircle size={10} style={{ color: '#DC2626' }} />}
                <span className="text-[10px] flex-1" style={{ color: DS.inkSub }}>{check.name}</span>
                <span className="text-[10px] font-bold" style={{ color: check.pass ? '#059669' : '#DC2626' }}>{check.score}</span>
              </div>
            ))}
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkTer }}>Recommendations</p>
            {recommendations.map((rec: any, i: number) => (
              <div key={i} className="p-2.5 rounded-lg border-l-2" style={{
                background: rec.priority === 'critical' ? '#FEF2F2' : rec.priority === 'important' ? '#FFFBEB' : '#F1F5F9',
                borderColor: rec.priority === 'critical' ? '#DC2626' : rec.priority === 'important' ? '#F59E0B' : '#94A3B8',
              }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge className="text-[8px] h-4 capitalize" variant="outline" style={{
                    color: rec.priority === 'critical' ? '#DC2626' : rec.priority === 'important' ? '#D97706' : '#64748B',
                  }}>{rec.priority}</Badge>
                  <span className="text-[10px] font-bold" style={{ color: DS.ink }}>{rec.dimension}</span>
                </div>
                <p className="text-[10px] leading-relaxed" style={{ color: DS.inkSub }}>{rec.advice}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={handleAccept}>
            <CheckCircle size={10} /> Accept
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleReject}>
            <XCircle size={10} /> Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BackendAISuggestionsPanel({ sessionId, module }: { sessionId: number; module: string }) {
  const utils = trpc.useUtils();
  const { data: suggestions, isLoading } = trpc.ai.list.useQuery(
    { sessionId, module },
    { enabled: !!sessionId, refetchInterval: 10000 }
  );

  const accept = trpc.ai.accept.useMutation({ onSuccess: () => utils.ai.list.invalidate({ sessionId, module }) });
  const reject = trpc.ai.reject.useMutation({ onSuccess: () => utils.ai.list.invalidate({ sessionId, module }) });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-4">
        <Loader2 size={12} className="animate-spin" style={{ color: DS.accent }} />
        <span className="text-[10px]" style={{ color: DS.inkTer }}>Loading DQ analysis...</span>
      </div>
    );
  }

  const pending = suggestions?.filter(s => s.status === 'pending') || [];

  if (pending.length === 0) {
    return (
      <div className="flex items-center gap-2 py-3 px-4">
        <Bot size={12} style={{ color: DS.inkDis }} />
        <span className="text-[10px]" style={{ color: DS.inkDis }}>Run AI analysis to see DQ-quality checks for this module.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Shield size={14} style={{ color: DS.accent }} />
        <span className="text-xs font-bold" style={{ color: DS.ink }}>DQ Analysis ({pending.length})</span>
      </div>
      {pending.map(sugg => (
        <SuggestionCard key={sugg.id} sugg={sugg} onAction={() => utils.ai.list.invalidate({ sessionId, module })} />
      ))}
    </div>
  );
}

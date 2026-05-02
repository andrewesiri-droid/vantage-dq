import { useState } from 'react';
import { useNavigate } from 'react-router';
import { trpc } from '@/providers/trpc';
import { DS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ChevronLeft, CheckCircle, Loader2, Sparkles } from 'lucide-react';

interface CleanSlateProps { onBack: () => void; }

export function CleanSlate({ onBack }: CleanSlateProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [decisionStatement, setDecisionStatement] = useState('');
  const [context, setContext] = useState('');
  const [creating, setCreating] = useState(false);

  const createSession = trpc.session.create.useMutation({
    onSuccess: (data) => {
      navigate(`/session/${data.slug}`);
    },
    onError: () => {
      setCreating(false);
    },
  });

  const handleCreate = () => {
    if (!name.trim() || !decisionStatement.trim()) return;
    setCreating(true);
    createSession.mutate({
      name: name.trim(),
      decisionStatement: decisionStatement.trim(),
      context: context.trim() || undefined,
    });
  };

  if (creating) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: DS.bg }}>
        <div className="text-center">
          <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: '#64748B' }} />
          <h3 className="text-lg font-bold" style={{ color: DS.ink }}>Creating your session...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: DS.bg }}>
      {/* Header */}
      <div className="flex items-center px-6 py-4 border-b" style={{ background: DS.brand }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronLeft size={16} className="text-white/70" />
          </button>
          <div className="flex items-center gap-2">
            <FileText size={16} style={{ color: '#64748B' }} />
            <span className="text-sm font-bold text-white">Clean Slate</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1" style={{ color: DS.ink }}>Start from scratch</h2>
          <p className="text-xs" style={{ color: DS.inkSub }}>
            You have full control. Define the decision statement and scope, then build each module yourself.
          </p>
        </div>

        <Card className="border-0 shadow-md">
          <CardContent className="pt-5 space-y-4">
            {/* Session name */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: DS.inkTer }}>Session Name *</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., APAC Market Entry Strategy"
                className="text-sm"
              />
            </div>

            {/* Decision statement */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: DS.inkTer }}>Decision Statement *</label>
              <p className="text-[10px] mb-1.5" style={{ color: DS.inkDis }}>A clear, open question. This is the anchor for the entire session.</p>
              <Textarea
                value={decisionStatement}
                onChange={e => setDecisionStatement(e.target.value)}
                placeholder="e.g., Which market entry strategy maximises our risk-adjusted NPV for APAC expansion within a $25M Year 1 capital constraint?"
                className="text-sm min-h-[80px]"
              />
            </div>

            {/* Context (optional) */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: DS.inkTer }}>Context (optional)</label>
              <Textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="Background information, market conditions, strategic rationale..."
                className="text-sm min-h-[80px]"
              />
            </div>

            {/* Tips */}
            <div className="p-3 rounded-lg" style={{ background: DS.canvas }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={12} style={{ color: DS.accent }} />
                <span className="text-[10px] font-bold" style={{ color: DS.accent }}>Tips for a strong decision statement</span>
              </div>
              <ul className="space-y-1">
                {[
                  'Frame it as a genuine open question (not a yes/no)',
                  'Include the key constraint or boundary',
                  'Make it specific enough to differentiate alternatives',
                  'Avoid embedding the answer in the question',
                ].map(tip => (
                  <li key={tip} className="text-[10px] flex items-start gap-1.5" style={{ color: DS.inkSub }}>
                    <span style={{ color: DS.accent }}>•</span> {tip}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6">
          <Button variant="outline" size="sm" onClick={onBack} className="text-xs gap-1">
            <ChevronLeft size={14} /> Back
          </Button>
          <Button
            size="sm"
            className="text-xs gap-2"
            style={{ background: '#64748B' }}
            onClick={handleCreate}
            disabled={!name.trim() || !decisionStatement.trim()}
          >
            <CheckCircle size={14} /> Create Empty Session
          </Button>
        </div>
      </div>
    </div>
  );
}

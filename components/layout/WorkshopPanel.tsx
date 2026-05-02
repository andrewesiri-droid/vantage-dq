import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { DS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Users, ThumbsUp, BarChart3, Vote } from 'lucide-react';

interface WorkshopPanelProps {
  sessionId?: number;
  onClose: () => void;
}

export function WorkshopPanel({ sessionId, onClose }: WorkshopPanelProps) {
  const [activeTab, setActiveTab] = useState('issues');

  const fullQuery = trpc.sessionFull.load.useQuery(
    { id: sessionId! },
    { enabled: !!sessionId, refetchInterval: 3000 }
  );

  const issues = fullQuery.data?.issues || [];
  const decisions = fullQuery.data?.decisions || [];
  const members = fullQuery.data?.members || [];

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col border-l" style={{ borderColor: DS.borderLight }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ background: DS.brand }}>
        <div className="flex items-center gap-2">
          <Users size={14} className="text-white" />
          <span className="text-xs font-bold text-white">Workshop Live Voting</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px] h-4 text-white/70 border-white/30">
            {members.length} participants
          </Badge>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={16} /></button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!sessionId ? (
          <p className="text-xs text-center py-8" style={{ color: DS.inkSub }}>Loading session data...</p>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="text-[10px] w-full">
              <TabsTrigger value="issues" className="text-[10px] gap-1 flex-1"><Vote size={10} /> Issues ({issues.length})</TabsTrigger>
              <TabsTrigger value="decisions" className="text-[10px] gap-1 flex-1"><BarChart3 size={10} /> Decisions ({decisions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="issues" className="mt-3 space-y-2">
              {issues.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: DS.inkSub }}>No issues yet. Add issues in the Issue Generation module.</p>
              )}
              {issues.map((issue: any) => (
                <VoteCard
                  key={issue.id}
                  sessionId={sessionId}
                  entityType="issue"
                  entityId={String(issue.id)}
                  label={issue.text}
                  meta={issue.category}
                />
              ))}
            </TabsContent>

            <TabsContent value="decisions" className="mt-3 space-y-2">
              {decisions.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: DS.inkSub }}>No decisions yet. Add decisions in the Decision Hierarchy module.</p>
              )}
              {decisions.map((decision: any) => (
                <VoteCard
                  key={decision.id}
                  sessionId={sessionId}
                  entityType="decision"
                  entityId={String(decision.id)}
                  label={decision.label}
                  meta={decision.tier}
                />
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function VoteCard({ sessionId, entityType, entityId, label, meta }: {
  sessionId: number; entityType: string; entityId: string; label: string; meta: string;
}) {
  const utils = trpc.useUtils();
  const votesQuery = trpc.workshop.votes.useQuery(
    { sessionId, entityType, entityId },
    { enabled: !!sessionId, refetchInterval: 3000 }
  );

  const castVote = trpc.workshop.castVote.useMutation({
    onSuccess: () => utils.workshop.votes.invalidate({ sessionId, entityType, entityId }),
  });

  const total = votesQuery.data?.total || 0;
  const count = votesQuery.data?.count || 0;

  const tierColors: Record<string, string> = {
    given: '#64748B', focus: '#C9A84C', deferred: '#0D9488',
    'uncertainty-external': '#EF4444', 'uncertainty-internal': '#F59E0B',
    'stakeholder-concern': '#7C3AED', assumption: '#0891B2',
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium flex-1 min-w-0 truncate" style={{ color: DS.ink }}>{label}</span>
          <Badge variant="outline" className="text-[8px] h-4 shrink-0" style={{ color: tierColors[meta] || '#64748B' }}>{meta}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => castVote.mutate({ sessionId, entityType, entityId, voteValue: 1 })}
            disabled={castVote.isPending}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:scale-105 disabled:opacity-50 shrink-0"
            style={{ background: DS.accentSoft, color: DS.accent }}
          >
            <ThumbsUp size={10} /> Vote
          </button>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(total * 10, 100)}%`, background: DS.accent }} />
          </div>
          <span className="text-[10px] font-bold shrink-0" style={{ color: DS.accent }}>{total}</span>
          <span className="text-[9px] shrink-0" style={{ color: DS.inkTer }}>({count})</span>
        </div>
      </CardContent>
    </Card>
  );
}

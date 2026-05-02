import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/providers/trpc';

/**
 * Real-time session synchronization hook.
 * Polls the server every 3 seconds for updates and triggers a refetch when changes are detected.
 */
export function useRealtimeSession(sessionId: number | undefined) {
  const [lastSync, setLastSync] = useState<string>(new Date().toISOString());

  const utils = trpc.useUtils();

  // Poll for updates
  const syncQuery = trpc.sync.check.useQuery(
    { sessionId: sessionId!, lastSync },
    { enabled: !!sessionId, refetchInterval: 3000 }
  );

  // Touch session when local changes are made
  const touchMutation = trpc.sync.touch.useMutation({
    onSuccess: (data) => {
      setLastSync(data.timestamp);
    },
  });

  // When server reports updates, invalidate all session queries
  useEffect(() => {
    if (syncQuery.data?.hasUpdates && sessionId) {
      utils.sessionFull.load.invalidate({ id: sessionId });
      utils.module.listIssues.invalidate({ sessionId });
      utils.module.listDecisions.invalidate({ sessionId });
      utils.module.listCriteria.invalidate({ sessionId });
      utils.module.listStrategies.invalidate({ sessionId });
      utils.module.listScores.invalidate({ sessionId });
      utils.module.listUncertainties.invalidate({ sessionId });
      utils.module.listStakeholders.invalidate({ sessionId });
      utils.module.listRisks.invalidate({ sessionId });
      utils.ai.list.invalidate({ sessionId });
      setLastSync(syncQuery.data.serverTimestamp);
    }
  }, [syncQuery.data?.hasUpdates, syncQuery.data?.serverTimestamp, sessionId]);

  const touch = useCallback(() => {
    if (sessionId) {
      touchMutation.mutate({ sessionId });
    }
  }, [sessionId, touchMutation]);

  return { touch, isSyncing: syncQuery.isFetching };
}

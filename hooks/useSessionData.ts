import { trpc } from '@/providers/trpc';
import { useRealtimeSession } from './useRealtimeSession';

/**
 * Unified session data hook.
 * Loads full session state from the database and provides CRUD mutations.
 * All mutations automatically trigger real-time sync for other clients.
 */
export function useSessionData(sessionId: number | undefined) {
  const { touch } = useRealtimeSession(sessionId);
  const utils = trpc.useUtils();

  // Load full session
  const fullQuery = trpc.sessionFull.load.useQuery(
    { id: sessionId! },
    { enabled: !!sessionId }
  );

  // Helper: invalidate and touch after mutation
  const afterMutate = () => {
    touch();
    if (sessionId) {
      utils.sessionFull.load.invalidate({ id: sessionId });
    }
  };

  // CRUD mutations
  const createIssue = trpc.module.createIssue.useMutation({ onSuccess: afterMutate });
  const updateIssue = trpc.module.updateIssue.useMutation({ onSuccess: afterMutate });
  const deleteIssue = trpc.module.deleteIssue.useMutation({ onSuccess: afterMutate });
  const voteIssue = trpc.module.voteIssue.useMutation({ onSuccess: afterMutate });

  const createDecision = trpc.module.createDecision.useMutation({ onSuccess: afterMutate });
  const updateDecision = trpc.module.updateDecision.useMutation({ onSuccess: afterMutate });
  const deleteDecision = trpc.module.deleteDecision.useMutation({ onSuccess: afterMutate });

  const createCriterion = trpc.module.createCriterion.useMutation({ onSuccess: afterMutate });
  const deleteCriterion = trpc.module.deleteCriterion.useMutation({ onSuccess: afterMutate });

  const createStrategy = trpc.module.createStrategy.useMutation({ onSuccess: afterMutate });
  const updateStrategy = trpc.module.updateStrategy.useMutation({ onSuccess: afterMutate });
  const deleteStrategy = trpc.module.deleteStrategy.useMutation({ onSuccess: afterMutate });

  const setScore = trpc.module.setScore.useMutation({ onSuccess: afterMutate });

  const createUncertainty = trpc.module.createUncertainty.useMutation({ onSuccess: afterMutate });
  const deleteUncertainty = trpc.module.deleteUncertainty.useMutation({ onSuccess: afterMutate });

  const createStakeholder = trpc.module.createStakeholder.useMutation({ onSuccess: afterMutate });
  const updateStakeholder = trpc.module.updateStakeholder.useMutation({ onSuccess: afterMutate });
  const deleteStakeholder = trpc.module.deleteStakeholder.useMutation({ onSuccess: afterMutate });

  const createRisk = trpc.module.createRisk.useMutation({ onSuccess: afterMutate });
  const deleteRisk = trpc.module.deleteRisk.useMutation({ onSuccess: afterMutate });

  const createScenario = trpc.module.createScenario.useMutation({ onSuccess: afterMutate });
  const deleteScenario = trpc.module.deleteScenario.useMutation({ onSuccess: afterMutate });

  const createVOI = trpc.module.createVOI.useMutation({ onSuccess: afterMutate });
  const deleteVOI = trpc.module.deleteVOI.useMutation({ onSuccess: afterMutate });

  const createGameTheory = trpc.module.createGameTheory.useMutation({ onSuccess: afterMutate });
  const deleteGameTheory = trpc.module.deleteGameTheory.useMutation({ onSuccess: afterMutate });

  const updateSession = trpc.module.updateSession.useMutation({ onSuccess: afterMutate });

  // AI
  const aiAnalyze = trpc.ai.analyze.useMutation({ onSuccess: afterMutate });

  return {
    data: fullQuery.data,
    isLoading: fullQuery.isLoading,
    refetch: fullQuery.refetch,

    // Issues
    createIssue: createIssue.mutate,
    updateIssue: updateIssue.mutate,
    deleteIssue: deleteIssue.mutate,
    voteIssue: voteIssue.mutate,

    // Decisions
    createDecision: createDecision.mutate,
    updateDecision: updateDecision.mutate,
    deleteDecision: deleteDecision.mutate,

    // Criteria
    createCriterion: createCriterion.mutate,
    deleteCriterion: deleteCriterion.mutate,

    // Strategies
    createStrategy: createStrategy.mutate,
    updateStrategy: updateStrategy.mutate,
    deleteStrategy: deleteStrategy.mutate,

    // Assessment scores
    setScore: setScore.mutate,

    // Uncertainties
    createUncertainty: createUncertainty.mutate,
    deleteUncertainty: deleteUncertainty.mutate,

    // Stakeholders
    createStakeholder: createStakeholder.mutate,
    updateStakeholder: updateStakeholder.mutate,
    deleteStakeholder: deleteStakeholder.mutate,

    // Risks
    createRisk: createRisk.mutate,
    deleteRisk: deleteRisk.mutate,

    // Scenarios
    createScenario: createScenario.mutate,
    deleteScenario: deleteScenario.mutate,

    // VOI
    createVOI: createVOI.mutate,
    deleteVOI: deleteVOI.mutate,

    // Game Theory
    createGameTheory: createGameTheory.mutate,
    deleteGameTheory: deleteGameTheory.mutate,

    // Session
    updateSession: updateSession.mutate,

    // AI
    aiAnalyze: aiAnalyze.mutate,
    isAnalyzing: aiAnalyze.isPending,
  };
}

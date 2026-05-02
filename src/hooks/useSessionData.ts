/**
 * Session data hook — returns empty state in demo mode.
 * In production, this would connect to the tRPC backend.
 * Demo mode uses localStorage data directly via demoData.ts.
 */
export function useSessionData(_sessionId: number | undefined) {
  return {
    data: null,
    isLoading: false,
    refetch: () => Promise.resolve({ data: null }),
    createIssue: (_: any) => {},
    updateIssue: (_: any) => {},
    deleteIssue: (_: any) => {},
    voteIssue: (_: any) => {},
    createDecision: (_: any) => {},
    updateDecision: (_: any) => {},
    deleteDecision: (_: any) => {},
    createCriterion: (_: any) => {},
    deleteCriterion: (_: any) => {},
    createStrategy: (_: any) => {},
    updateStrategy: (_: any) => {},
    deleteStrategy: (_: any) => {},
    setScore: (_: any) => {},
    createUncertainty: (_: any) => {},
    deleteUncertainty: (_: any) => {},
    createStakeholder: (_: any) => {},
    updateStakeholder: (_: any) => {},
    deleteStakeholder: (_: any) => {},
    createRisk: (_: any) => {},
    deleteRisk: (_: any) => {},
    createScenario: (_: any) => {},
    deleteScenario: (_: any) => {},
    createVOI: (_: any) => {},
    deleteVOI: (_: any) => {},
    createGameTheory: (_: any) => {},
    deleteGameTheory: (_: any) => {},
    updateSession: (_: any) => {},
    aiAnalyze: (_: any) => {},
    isAnalyzing: false,
  };
}

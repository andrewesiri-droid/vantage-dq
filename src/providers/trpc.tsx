/**
 * tRPC stub — full mock that prevents TypeScript errors.
 * App runs in demo mode (localStorage) without a backend.
 */
import type { ReactNode } from 'react';

const q = (data?: any) => ({ data: data ?? null, isLoading: false, refetch: () => Promise.resolve({ data: null }), error: null });
const _m = () => ({ mutate: () => {}, mutateAsync: () => Promise.resolve(null), isPending: false, isLoading: false });
const mCb = () => ({ mutate: (_: any) => {}, mutateAsync: () => Promise.resolve(null), isPending: false, isLoading: false });

export const trpc: any = {
  useUtils: () => ({
    sessionFull: { load: { invalidate: () => {} } },
    ai: { list: { invalidate: () => {} } },
  }),
  session: {
    getBySlug: { useQuery: () => q() },
    list: { useQuery: () => q([]) },
    create: { useMutation: () => mCb() },
    update: { useMutation: () => mCb() },
    delete: { useMutation: () => mCb() },
  },
  sessionFull: { load: { useQuery: () => q() } },
  auth: {
    me: { useQuery: () => q(null) },
    logout: { useMutation: () => mCb() },
  },
  sync: {
    check: { useQuery: () => q() },
    touch: { useMutation: () => mCb() },
  },
  module: {
    createIssue: { useMutation: () => mCb() },
    updateIssue: { useMutation: () => mCb() },
    deleteIssue: { useMutation: () => mCb() },
    voteIssue: { useMutation: () => mCb() },
    createDecision: { useMutation: () => mCb() },
    updateDecision: { useMutation: () => mCb() },
    deleteDecision: { useMutation: () => mCb() },
    createCriterion: { useMutation: () => mCb() },
    deleteCriterion: { useMutation: () => mCb() },
    createStrategy: { useMutation: () => mCb() },
    updateStrategy: { useMutation: () => mCb() },
    deleteStrategy: { useMutation: () => mCb() },
    setScore: { useMutation: () => mCb() },
    createUncertainty: { useMutation: () => mCb() },
    deleteUncertainty: { useMutation: () => mCb() },
    createStakeholder: { useMutation: () => mCb() },
    updateStakeholder: { useMutation: () => mCb() },
    deleteStakeholder: { useMutation: () => mCb() },
    createRisk: { useMutation: () => mCb() },
    deleteRisk: { useMutation: () => mCb() },
    createScenario: { useMutation: () => mCb() },
    deleteScenario: { useMutation: () => mCb() },
    createVOI: { useMutation: () => mCb() },
    deleteVOI: { useMutation: () => mCb() },
    createGameTheory: { useMutation: () => mCb() },
    deleteGameTheory: { useMutation: () => mCb() },
    updateSession: { useMutation: () => mCb() },
  },
  ai: {
    analyze: { useMutation: () => mCb() },
    analyse: { useMutation: () => mCb() },
    list: { useQuery: () => q([]) },
    accept: { useMutation: () => mCb() },
    reject: { useMutation: () => mCb() },
  },
  workshop: {
    votes: { useQuery: () => q([]) },
    castVote: { useMutation: () => mCb() },
  },
  aiDeepDive: {
    analyze: { useMutation: () => mCb() },
    wizard: { useMutation: () => mCb() },
  },
};

export function TRPCProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

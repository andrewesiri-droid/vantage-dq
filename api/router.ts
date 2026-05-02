import { initTRPC } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";

const t = initTRPC.create({ transformer: superjson });

const itemInput = z.object({
  sessionId: z.string(),
  content: z.string().optional(),
  text: z.string().optional(),
  label: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  score: z.number().optional(),
  rationale: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  owner: z.string().optional(),
  impact: z.string().optional(),
  probability: z.number().optional(),
  mitigation: z.string().optional(),
  stakeholder: z.string().optional(),
  value: z.string().optional(),
  uncertainty: z.string().optional(),
  rangeLow: z.number().optional(),
  rangeHigh: z.number().optional(),
  voiScore: z.number().optional(),
  payoff: z.number().optional(),
  equilibrium: z.string().optional(),
  strategy: z.string().optional(),
});

const updateItemInput = itemInput.extend({ id: z.string() });
const deleteItemInput = z.object({ id: z.string(), sessionId: z.string() });

export const appRouter = t.router({
  session: t.router({
    getBySlug: t.procedure.input(z.object({ slug: z.string() })).query(async () => ({ id: "", slug: "", title: "", description: "", decisionStatement: "", createdBy: "", createdAt: new Date(), updatedAt: new Date() })),
    create: t.procedure.input(z.object({ title: z.string(), description: z.string().optional(), createdBy: z.string().optional(), decisionStatement: z.string().optional() })).mutation(async () => ({ id: "", slug: "", title: "" })),
  }),
  sessionFull: t.router({
    load: t.procedure.input(z.object({ slug: z.string() })).query(async () => ({ session: null as any, issues: [] as any[], decisions: [] as any[], strategies: [] as any[], scenarios: [] as any[], risks: [] as any[], stakeholders: [] as any[], uncertainties: [] as any[], criteria: [] as any[], voiAnalysis: [] as any[], gameTheory: [] as any[], aiSuggestions: [] as any[], votes: [] as any[], syncInfo: null as any })),
  }),
  module: t.router({
    createIssue: t.procedure.input(itemInput).mutation(async () => ({ id: "" })),
    updateIssue: t.procedure.input(updateItemInput).mutation(async () => ({ id: "" })),
    deleteIssue: t.procedure.input(deleteItemInput).mutation(async () => ({ id: "" })),
    voteIssue: t.procedure.input(z.object({ id: z.string(), sessionId: z.string(), vote: z.enum(["up", "down"]) })).mutation(async () => ({ id: "" })),
    createDecision: t.procedure.input(itemInput).mutation(async () => ({ id: "" })),
    updateDecision: t.procedure.input(updateItemInput).mutation(async () => ({ id: "" })),
    deleteDecision: t.procedure.input(deleteItemInput).mutation(async () => ({ id: "" })),
    createStrategy: t.procedure.input(itemInput).mutation(async () => ({ id: "" })),
    updateStrategy: t.procedure.input(updateItemInput).mutation(async () => ({ id: "" })),
    deleteStrategy: t.procedure.input(deleteItemInput).mutation(async () => ({ id: "" })),
    createScenario: t.procedure.input(itemInput).mutation(async () => ({ id: "" })),
    deleteScenario: t.procedure.input(deleteItemInput).mutation(async () => ({ id: "" })),
    createRisk: t.procedure.input(itemInput).mutation(async () => ({ id: "" })),
    deleteRisk: t.procedure.input(deleteItemInput).mutation(async () => ({ id: "" })),
    createStakeholder: t.procedure.input(itemInput).mutation(async () => ({ id: "" })),
    updateStakeholder: t.procedure.input(updateItemInput).mutation(async () => ({ id: "" })),
    deleteStakeholder: t.procedure.input(deleteItemInput).mutation(async () => ({ id: "" })),
    createCriterion: t.procedure.input(itemInput).mutation(async () => ({ id: "" })),
    deleteCriterion: t.procedure.input(deleteItemInput).mutation(async () => ({ id: "" })),
    createVOI: t.procedure.input(itemInput).mutation(async () => ({ id: "" })),
    deleteVOI: t.procedure.input(deleteItemInput).mutation(async () => ({ id: "" })),
    createGameTheory: t.procedure.input(itemInput).mutation(async () => ({ id: "" })),
    deleteGameTheory: t.procedure.input(deleteItemInput).mutation(async () => ({ id: "" })),
    createUncertainty: t.procedure.input(itemInput).mutation(async () => ({ id: "" })),
    deleteUncertainty: t.procedure.input(deleteItemInput).mutation(async () => ({ id: "" })),
    updateSession: t.procedure.input(z.object({ sessionId: z.string(), title: z.string().optional(), description: z.string().optional(), decisionStatement: z.string().optional() })).mutation(async () => ({ id: "" })),
    setScore: t.procedure.input(z.object({ sessionId: z.string(), module: z.string(), score: z.number() })).mutation(async () => ({ success: true })),
  }),
  ai: t.router({
    list: t.procedure.input(z.object({ sessionId: z.string(), module: z.string() })).query(async () => [] as any[]),
    analyse: t.procedure.input(z.object({ sessionId: z.string(), module: z.string(), content: z.string().optional() })).mutation(async () => ({ result: "" })),
    analyze: t.procedure.input(z.object({ sessionId: z.string(), module: z.string(), content: z.string().optional() })).mutation(async () => ({ result: "" })),
    accept: t.procedure.input(z.object({ id: z.string(), sessionId: z.string() })).mutation(async () => ({ id: "" })),
    reject: t.procedure.input(z.object({ id: z.string(), sessionId: z.string() })).mutation(async () => ({ id: "" })),
  }),
  aiDeepDive: t.router({
    analyze: t.procedure.input(z.object({ prompt: z.string(), context: z.record(z.any()).optional() })).mutation(async () => ({ result: "" })),
    wizard: t.procedure.input(z.object({ answers: z.array(z.string()) })).mutation(async () => ({ result: "" })),
  }),
  auth: t.router({
    me: t.procedure.query(async () => null as any),
    logout: t.procedure.mutation(async () => ({ success: true })),
  }),
  sync: t.router({
    check: t.procedure.input(z.object({ sessionId: z.string(), lastSync: z.string().optional() })).query(async () => ({ hasChanges: false, changes: [] as any[] })),
    touch: t.procedure.input(z.object({ sessionId: z.string() })).mutation(async () => ({ success: true })),
  }),
  workshop: t.router({
    votes: t.procedure.input(z.object({ sessionId: z.string() })).query(async () => [] as any[]),
    castVote: t.procedure.input(z.object({ sessionId: z.string(), itemId: z.string(), vote: z.enum(["agree", "disagree", "concern"]) })).mutation(async () => ({ id: "" })),
  }),
});

export type AppRouter = typeof appRouter;

/**
 * useSessionData — Supabase-backed session data hook
 * Replaces the localStorage-only demo implementation with real DB persistence.
 * Falls back to localStorage if Supabase is unavailable.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import { getDemoData, updateDemoData } from '@/lib/demoData';

function useSupa() {
  return supabase;
}

export function useSessionData(sessionId: number | undefined) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const db = useSupa();

  const fetchAll = useCallback(async () => {
    if (!sessionId) { setIsLoading(false); return; }

    // If no Supabase, fall back to localStorage
    if (!db) {
      setData(getDemoData());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [
        { data: session },
        { data: issues },
        { data: decisions },
        { data: strategies },
        { data: criteria },
        { data: assessmentScores },
        { data: uncertainties },
        { data: stakeholderEntries },
        { data: riskItems },
        { data: scenarios },
        { data: voiAnalyses },
      ] = await Promise.all([
        db.from('dq_sessions').select('*').eq('id', sessionId).single(),
        db.from('issues').select('*').eq('session_id', sessionId).order('sort_order'),
        db.from('decisions').select('*').eq('session_id', sessionId).order('sort_order'),
        db.from('strategies').select('*').eq('session_id', sessionId),
        db.from('criteria').select('*').eq('session_id', sessionId).order('sort_order'),
        db.from('assessment_scores').select('*').eq('session_id', sessionId),
        db.from('uncertainties').select('*').eq('session_id', sessionId),
        db.from('stakeholder_entries').select('*').eq('session_id', sessionId),
        db.from('risk_items').select('*').eq('session_id', sessionId),
        db.from('scenarios').select('*').eq('session_id', sessionId),
        db.from('voi_analyses').select('*').eq('session_id', sessionId),
      ]);

      setData({
        session: session ? {
          ...session,
          decisionStatement: session.decision_statement,
          successCriteria: session.success_criteria,
          failureConsequences: session.failure_consequences,
          rootDecision: session.root_decision,
          scopeIn: session.scope_in,
          scopeOut: session.scope_out,
          timeHorizon: session.time_horizon,
          dqScores: session.dq_scores || {},
          createdBy: session.created_by,
          ownerEmail: session.owner_email,
          inviteCode: session.invite_code,
        } : null,
        issues: (issues || []).map((i: any) => ({ ...i, sessionId: i.session_id, sortOrder: i.sort_order })),
        decisions: (decisions || []).map((d: any) => ({ ...d, sessionId: d.session_id, sortOrder: d.sort_order })),
        strategies: (strategies || []).map((s: any) => ({ ...s, sessionId: s.session_id, colorIdx: s.color_idx })),
        criteria: (criteria || []).map((c: any) => ({ ...c, sessionId: c.session_id, sortOrder: c.sort_order })),
        assessmentScores: (assessmentScores || []).map((s: any) => ({ ...s, sessionId: s.session_id, strategyId: s.strategy_id, criterionId: s.criterion_id })),
        uncertainties: (uncertainties || []).map((u: any) => ({ ...u, sessionId: u.session_id })),
        stakeholderEntries: (stakeholderEntries || []).map((s: any) => ({ ...s, sessionId: s.session_id, engagementAction: s.engagement_action })),
        riskItems: (riskItems || []).map((r: any) => ({ ...r, sessionId: r.session_id })),
        scenarios: (scenarios || []).map((s: any) => ({ ...s, sessionId: s.session_id })),
        voiAnalyses: (voiAnalyses || []).map((v: any) => ({ ...v, sessionId: v.session_id })),
        gameTheoryModels: [],
        aiSuggestions: [],
      });
    } catch (e) {
      console.error('[useSessionData] fetch error:', e);
      setData(getDemoData());
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, db]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const refetch = useCallback(() => fetchAll(), [fetchAll]);

  // ── CRUD helpers ────────────────────────────────────────────────────────────
  const createIssue = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.issues = d.issues || []; d.issues.unshift({ id: Date.now(), session_id: input.sessionId, text: input.text, category: input.category || 'uncertainty-external', severity: input.severity || 'Medium', status: 'open', votes: 0, sort_order: 0 }); }); refetch(); return; }
    await db.from('issues').insert({ session_id: input.sessionId, text: input.text, category: input.category, severity: input.severity, status: 'open', votes: 0, sort_order: 0 });
    refetch();
  }, [db, refetch]);

  const deleteIssue = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.issues = (d.issues || []).filter((i: any) => i.id !== input.id); }); refetch(); return; }
    await db.from('issues').delete().eq('id', input.id);
    refetch();
  }, [db, refetch]);

  const voteIssue = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { const i = (d.issues || []).find((i: any) => i.id === input.id); if (i) i.votes = (i.votes || 0) + 1; }); refetch(); return; }
    const { data: issue } = await db.from('issues').select('votes').eq('id', input.id).single();
    await db.from('issues').update({ votes: (issue?.votes || 0) + 1 }).eq('id', input.id);
    refetch();
  }, [db, refetch]);

  const createDecision = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.decisions = d.decisions || []; d.decisions.push({ id: Date.now(), session_id: input.sessionId, label: input.label, choices: input.choices || [], tier: input.tier || 'focus', sort_order: d.decisions.length }); }); refetch(); return; }
    await db.from('decisions').insert({ session_id: input.sessionId, label: input.label, choices: input.choices || [], tier: input.tier || 'focus', sort_order: 0 });
    refetch();
  }, [db, refetch]);

  const deleteDecision = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.decisions = (d.decisions || []).filter((x: any) => x.id !== input.id); }); refetch(); return; }
    await db.from('decisions').delete().eq('id', input.id);
    refetch();
  }, [db, refetch]);

  const createStrategy = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.strategies = d.strategies || []; d.strategies.push({ id: Date.now(), session_id: input.sessionId, name: input.name, description: input.description || '', color_idx: (d.strategies.length) % 6, selections: {} }); }); refetch(); return; }
    await db.from('strategies').insert({ session_id: input.sessionId, name: input.name, description: input.description || '', color_idx: 0, selections: {} });
    refetch();
  }, [db, refetch]);

  const deleteStrategy = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.strategies = (d.strategies || []).filter((x: any) => x.id !== input.id); }); refetch(); return; }
    await db.from('strategies').delete().eq('id', input.id);
    refetch();
  }, [db, refetch]);

  const createCriterion = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.criteria = d.criteria || []; d.criteria.push({ id: Date.now(), session_id: input.sessionId, label: input.label, type: input.type || 'strategic', weight: input.weight || 'medium', sort_order: d.criteria.length }); }); refetch(); return; }
    await db.from('criteria').insert({ session_id: input.sessionId, label: input.label, type: input.type || 'strategic', weight: input.weight || 'medium', sort_order: 0 });
    refetch();
  }, [db, refetch]);

  const deleteCriterion = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.criteria = (d.criteria || []).filter((x: any) => x.id !== input.id); }); refetch(); return; }
    await db.from('criteria').delete().eq('id', input.id);
    refetch();
  }, [db, refetch]);

  const setScore = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.assessmentScores = d.assessmentScores || []; const ex = d.assessmentScores.find((s: any) => s.strategy_id === input.strategyId && s.criterion_id === input.criterionId); if (ex) ex.score = input.score; else d.assessmentScores.push({ id: Date.now(), session_id: input.sessionId, strategy_id: input.strategyId, criterion_id: input.criterionId, score: input.score }); }); refetch(); return; }
    await db.from('assessment_scores').upsert({ session_id: input.sessionId, strategy_id: input.strategyId, criterion_id: input.criterionId, score: input.score }, { onConflict: 'session_id,strategy_id,criterion_id' });
    refetch();
  }, [db, refetch]);

  const createUncertainty = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.uncertainties = d.uncertainties || []; d.uncertainties.push({ id: Date.now(), session_id: input.sessionId, label: input.label, type: input.type || 'Market', impact: input.impact || 'High', control: 'Some', description: '' }); }); refetch(); return; }
    await db.from('uncertainties').insert({ session_id: input.sessionId, label: input.label, type: input.type || 'Market', impact: input.impact || 'High', control: 'Some', description: '' });
    refetch();
  }, [db, refetch]);

  const deleteUncertainty = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.uncertainties = (d.uncertainties || []).filter((x: any) => x.id !== input.id); }); refetch(); return; }
    await db.from('uncertainties').delete().eq('id', input.id);
    refetch();
  }, [db, refetch]);

  const createStakeholder = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.stakeholderEntries = d.stakeholderEntries || []; d.stakeholderEntries.push({ id: Date.now(), session_id: input.sessionId, name: input.name, role: input.role || '', influence: input.influence || 50, interest: input.interest || 50, alignment: input.alignment || 'neutral', concerns: '', engagement_action: '' }); }); refetch(); return; }
    await db.from('stakeholder_entries').insert({ session_id: input.sessionId, name: input.name, role: input.role || '', influence: input.influence || 50, interest: input.interest || 50, alignment: input.alignment || 'neutral', concerns: '', engagement_action: '' });
    refetch();
  }, [db, refetch]);

  const deleteStakeholder = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.stakeholderEntries = (d.stakeholderEntries || []).filter((x: any) => x.id !== input.id); }); refetch(); return; }
    await db.from('stakeholder_entries').delete().eq('id', input.id);
    refetch();
  }, [db, refetch]);

  const createRisk = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.riskItems = d.riskItems || []; d.riskItems.push({ id: Date.now(), session_id: input.sessionId, label: input.label, likelihood: input.likelihood || 'Medium', impact: input.impact || 'High', timeframe: '', owner: '', mitigation: '' }); }); refetch(); return; }
    await db.from('risk_items').insert({ session_id: input.sessionId, label: input.label, likelihood: input.likelihood || 'Medium', impact: input.impact || 'High', timeframe: '', owner: '', mitigation: '' });
    refetch();
  }, [db, refetch]);

  const deleteRisk = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.riskItems = (d.riskItems || []).filter((x: any) => x.id !== input.id); }); refetch(); return; }
    await db.from('risk_items').delete().eq('id', input.id);
    refetch();
  }, [db, refetch]);

  const createScenario = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.scenarios = d.scenarios || []; d.scenarios.push({ id: Date.now(), session_id: input.sessionId, name: input.name, description: '', probability: 0.25, drivers: [], color: '#7C3AED' }); }); refetch(); return; }
    await db.from('scenarios').insert({ session_id: input.sessionId, name: input.name, description: '', probability: 0.25, drivers: [], color: '#7C3AED' });
    refetch();
  }, [db, refetch]);

  const deleteScenario = useCallback(async (input: any) => {
    if (!db) { updateDemoData((d: any) => { d.scenarios = (d.scenarios || []).filter((x: any) => x.id !== input.id); }); refetch(); return; }
    await db.from('scenarios').delete().eq('id', input.id);
    refetch();
  }, [db, refetch]);

  const updateSession = useCallback(async (input: any) => {
    const mapped: any = {};
    const fieldMap: Record<string, string> = {
      decisionStatement: 'decision_statement', context: 'context', background: 'background',
      trigger: 'trigger', scopeIn: 'scope_in', scopeOut: 'scope_out',
      constraints: 'constraints', assumptions: 'assumptions',
      successCriteria: 'success_criteria', failureConsequences: 'failure_consequences',
      timeHorizon: 'time_horizon', deadline: 'deadline', sector: 'sector',
      decisionType: 'decision_type', dqScores: 'dq_scores', status: 'status',
      name: 'name', owner: 'owner_email',
    };
    Object.entries(input.data || {}).forEach(([k, v]) => {
      mapped[fieldMap[k] || k] = v;
    });
    mapped.updated_at = new Date().toISOString();

    if (!db) { updateDemoData((d: any) => { if (d.sessions?.[0]) Object.assign(d.sessions[0], input.data); }); refetch(); return; }
    await db.from('dq_sessions').update(mapped).eq('id', input.id);
    refetch();
  }, [db, refetch]);

  return {
    data,
    isLoading,
    refetch,
    createIssue,
    updateIssue: (_: any) => {},
    deleteIssue,
    voteIssue,
    createDecision,
    updateDecision: (_: any) => {},
    deleteDecision,
    createCriterion,
    deleteCriterion,
    createStrategy,
    updateStrategy: (_: any) => {},
    deleteStrategy,
    setScore,
    createUncertainty,
    deleteUncertainty,
    createStakeholder,
    updateStakeholder: (_: any) => {},
    deleteStakeholder,
    createRisk,
    deleteRisk,
    createScenario,
    deleteScenario,
    createVOI: (_: any) => {},
    deleteVOI: (_: any) => {},
    createGameTheory: (_: any) => {},
    deleteGameTheory: (_: any) => {},
    updateSession,
    aiAnalyze: (_: any) => {},
    isAnalyzing: false,
  };
}

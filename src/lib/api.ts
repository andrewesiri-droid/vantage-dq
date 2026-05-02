const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function apiPost(endpoint: string, body: any) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('API request failed');
  return res.json();
}

export const sessionApi = {
  create: (input: any) => apiPost('/api/session/create', input),
  list: () => apiPost('/api/session/list', {}),
  getBySlug: (input: any) => apiPost('/api/session/getBySlug', input),
  update: (input: any) => apiPost('/api/session/update', input),
  delete: (input: any) => apiPost('/api/session/delete', input),
};

export const sessionFullApi = {
  load: (input: any) => apiPost('/api/sessionFull/load', input),
};

export const moduleApi = {
  createIssue: (input: any) => apiPost('/api/module/issues/create', input),
  deleteIssue: (input: any) => apiPost('/api/module/issues/delete', input),
  voteIssue: (input: any) => apiPost('/api/module/issues/vote', input),
  createDecision: (input: any) => apiPost('/api/module/decisions/create', input),
  deleteDecision: (input: any) => apiPost('/api/module/decisions/delete', input),
  createStrategy: (input: any) => apiPost('/api/module/strategies/create', input),
  deleteStrategy: (input: any) => apiPost('/api/module/strategies/delete', input),
  createCriterion: (input: any) => apiPost('/api/module/criteria/create', input),
  deleteCriterion: (input: any) => apiPost('/api/module/criteria/delete', input),
  setScore: (input: any) => apiPost('/api/module/scores/set', input),
  createUncertainty: (input: any) => apiPost('/api/module/uncertainties/create', input),
  deleteUncertainty: (input: any) => apiPost('/api/module/uncertainties/delete', input),
  createStakeholder: (input: any) => apiPost('/api/module/stakeholder_entries/create', input),
  deleteStakeholder: (input: any) => apiPost('/api/module/stakeholder_entries/delete', input),
  createRisk: (input: any) => apiPost('/api/module/risk_items/create', input),
  deleteRisk: (input: any) => apiPost('/api/module/risk_items/delete', input),
};

export const aiApi = {
  analyse: (input: any) => apiPost('/api/ai/analyse', input),
  list: (input: any) => apiPost('/api/ai/list', input),
  accept: (input: any) => apiPost('/api/ai/accept', input),
  reject: (input: any) => apiPost('/api/ai/reject', input),
};

export const aiDeepDiveApi = {
  analyse: (input: any) => apiPost('/api/aiDeepDive/analyse', input),
  wizard: (input: any) => apiPost('/api/aiDeepDive/wizard', input),
};

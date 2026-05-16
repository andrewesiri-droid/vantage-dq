// ============================================================
// DQ TRUST & LINEAGE
// Trust classification for AI outputs and data lineage tracking
// ============================================================

export type TrustLevel = 'trusted' | 'review_recommended' | 'low_confidence';
export type DataLineageSource = 'user_input' | 'document_extraction' | 'ai_generated' | 'workshop' | 'five_question';

export interface AIResponseTrust {
  generatedContent: any;
  confidenceScore: number;         // 0-100
  trustLevel: TrustLevel;
  assumptionsMade: string[];
  dataUsed: string[];
  missingData: string[];
  contradictions: string[];
  suggestedNextActions: string[];
}

export interface DataLineageItem {
  fieldId: string;
  moduleId: string;
  source: DataLineageSource;
  sourceReference?: string;       // e.g. "page 3, paragraph 2" or "user input at 14:32"
  confidenceScore: number;
  reviewStatus: 'draft' | 'user_validated' | 'ai_suggested' | 'needs_review';
  createdAt: string;
  updatedAt: string;
  history: LineageHistoryEntry[];
}

export interface LineageHistoryEntry {
  timestamp: string;
  action: 'created' | 'edited' | 'ai_suggested' | 'user_accepted' | 'user_rejected';
  actor: 'user' | 'ai' | 'system';
  previousValue?: string;
  newValue?: string;
  aiConfidence?: number;
}

// ── Trust classification ──────────────────────────────────────

export function classifyTrust(confidenceScore: number): TrustLevel {
  if (confidenceScore >= 80) return 'trusted';
  if (confidenceScore >= 60) return 'review_recommended';
  return 'low_confidence';
}

export const TRUST_META: Record<TrustLevel, {
  label: string; color: string; bg: string; icon: string; description: string;
}> = {
  trusted: {
    label: 'Trusted',
    color: '#059669',
    bg: '#DCFCE7',
    icon: '✅',
    description: 'High confidence — grounded in user-validated data',
  },
  review_recommended: {
    label: 'Review Recommended',
    color: '#D97706',
    bg: '#FEF3C7',
    icon: '⚠️',
    description: 'Medium confidence — review before using downstream',
  },
  low_confidence: {
    label: 'Low Confidence',
    color: '#DC2626',
    bg: '#FEF2F2',
    icon: '❗',
    description: 'Low confidence — may be inferred or based on incomplete data',
  },
};

export const SOURCE_META: Record<DataLineageSource, {
  label: string; color: string; icon: string;
}> = {
  user_input:           { label: 'User input',          color: '#059669', icon: '✏️' },
  document_extraction:  { label: 'From document',       color: '#4F6AF5', icon: '📄' },
  ai_generated:         { label: 'AI generated',        color: '#D97706', icon: '🤖' },
  workshop:             { label: 'From workshop',       color: '#7C3AED', icon: '👥' },
  five_question:        { label: '5-question start',    color: '#0891B2', icon: '💬' },
};

// ── Contradiction detection ───────────────────────────────────

export interface Contradiction {
  id: string;
  severity: 'blocking' | 'warning';
  description: string;
  fieldA: string;
  fieldB: string;
  suggestion: string;
}

export function detectContradictions(sessionData: any): Contradiction[] {
  const contradictions: Contradiction[] = [];

  // Strategy vs constraint
  const strategies = sessionData?.strategies ?? [];
  const constraints = sessionData?.problemFrame?.constraints ?? [];

  // Check if any strategy explicitly violates a stated constraint
  // This is a simple heuristic — real validation would be more sophisticated
  strategies.forEach((s: any) => {
    if (s.reviewStatus !== 'accepted') return;
    constraints.forEach((c: string) => {
      // Flag if strategy is labeled "unlimited" or "unrestricted" but constraint mentions budget
      if (
        c.toLowerCase().includes('budget') &&
        (s.name?.toLowerCase().includes('unlimited') || s.objective?.toLowerCase().includes('no limit'))
      ) {
        contradictions.push({
          id: `c_${s.id}_budget`,
          severity: 'blocking',
          description: `Strategy "${s.name}" may conflict with budget constraint: "${c}"`,
          fieldA: `strategies.${s.id}`,
          fieldB: 'problem_frame.constraints',
          suggestion: 'Review strategy assumptions against stated budget constraint',
        });
      }
    });
  });

  // Check DQ score vs recommendation readiness
  const dqScore = sessionData?.dqScorecard?.overallScore;
  const recommendation = sessionData?.recommendation;
  if (dqScore && dqScore < 50 && recommendation) {
    contradictions.push({
      id: 'c_dq_recommendation',
      severity: 'warning',
      description: `DQ score is ${dqScore} (below 50) but a recommendation exists — decision quality may be insufficient`,
      fieldA: 'dq_scorecard.overallScore',
      fieldB: 'recommendation',
      suggestion: 'Address DQ gaps before finalizing recommendation',
    });
  }

  // Check for strategies with no scores
  if (strategies.filter((s: any) => s.reviewStatus === 'accepted').length >= 2) {
    const scores = sessionData?.assessmentScores ?? [];
    const scoredStrategies = new Set(scores.map((s: any) => s.strategyId));
    const unscoredStrategies = strategies
      .filter((s: any) => s.reviewStatus === 'accepted' && !scoredStrategies.has(s.id));
    if (unscoredStrategies.length > 0) {
      contradictions.push({
        id: 'c_unscored_strategies',
        severity: 'warning',
        description: `${unscoredStrategies.length} accepted strategies have no evaluation scores`,
        fieldA: 'strategies',
        fieldB: 'assessment_scores',
        suggestion: 'Score all strategies before proceeding to recommendation',
      });
    }
  }

  return contradictions;
}

// ── Audit trail ───────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId?: string;
  action: 'edit' | 'ai_generate' | 'ai_accept' | 'ai_reject' | 'import' | 'export' | 'delete' | 'validate';
  module: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  aiConfidence?: number;
  source?: string;
}

export function createAuditEntry(
  action: AuditEntry['action'],
  module: string,
  options?: Partial<AuditEntry>
): AuditEntry {
  return {
    id: `audit_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    action,
    module,
    ...options,
  };
}

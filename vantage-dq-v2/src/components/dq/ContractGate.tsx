import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import { AlertTriangle, Info, CheckCircle2, X, ShieldAlert } from 'lucide-react';
import { validateContract, DATA_CONTRACTS } from '@/lib/dq/dq-data-contracts';
import type { ModuleId, DataSource } from '@/lib/dq/dq-data-contracts';
import { TRUST_META, SOURCE_META } from '@/lib/dq/dq-trust';
import type { TrustLevel, DataLineageSource } from '@/lib/dq/dq-trust';

// ── Trust Badge ───────────────────────────────────────────────

export function TrustBadge({ trust, confidence, size = 'sm' }: {
  trust: TrustLevel;
  confidence?: number;
  size?: 'xs' | 'sm' | 'md';
}) {
  const meta = TRUST_META[trust];
  const textSize = size === 'xs' ? 9 : size === 'sm' ? 10 : 12;

  return (
    <div className="inline-flex items-center gap-1 rounded-full font-semibold"
      style={{
        background: meta.bg,
        color: meta.color,
        padding: size === 'xs' ? '1px 6px' : '2px 8px',
        fontSize: textSize,
      }}>
      <span>{meta.icon}</span>
      <span>{meta.label}{confidence !== undefined ? ` · ${confidence}%` : ''}</span>
    </div>
  );
}

// ── Source Badge ──────────────────────────────────────────────

export function SourceBadge({ source, size = 'sm' }: {
  source: DataLineageSource;
  size?: 'xs' | 'sm';
}) {
  const meta = SOURCE_META[source];
  const textSize = size === 'xs' ? 9 : 10;

  return (
    <div className="inline-flex items-center gap-1 rounded-full"
      style={{
        background: DS.surfaceAlt,
        color: meta.color,
        padding: '1px 6px',
        fontSize: textSize,
        fontWeight: 500,
      }}>
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
    </div>
  );
}

// ── Missing Input Warning ─────────────────────────────────────

export function MissingInputWarning({ moduleId, missingItems }: {
  moduleId: ModuleId;
  missingItems: string[];
}) {
  if (!missingItems.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4"
      style={{ background: '#FEF3C7', border: '1px solid #FCD34D' }}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
        <div>
          <p className="text-xs font-bold mb-1.5" style={{ color: '#92400E' }}>
            Required inputs missing for {DATA_CONTRACTS[moduleId]?.label ?? moduleId}
          </p>
          {missingItems.map((item, i) => (
            <p key={i} className="text-xs mb-0.5" style={{ color: '#78350F' }}>· {item}</p>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Contract Gate ─────────────────────────────────────────────
// Wraps an AI button and blocks it if required data is missing

interface ContractGateProps {
  moduleId: ModuleId;
  sessionData: Record<string, any>;
  children: (props: { blocked: boolean; blockers: string[]; warnings: string[] }) => React.ReactNode;
  showWarnings?: boolean;
}

export function ContractGate({ moduleId, sessionData, children, showWarnings = true }: ContractGateProps) {
  const result = useMemo(() => {
    // Build the data map from sessionData
    const dataMap: Record<DataSource, any[]> = {
      problem_frame:    sessionData?.problemFrame ? [sessionData.problemFrame] : [],
      issues:           sessionData?.issueItems ?? [],
      decisions:        sessionData?.structuringOutput?.focusDecisions ?? [],
      strategies:       sessionData?.strategies ?? [],
      criteria:         sessionData?.structuringOutput?.criteria ?? [],
      assessment_scores: sessionData?.assessmentScores ?? [],
      scenarios:        sessionData?.scenarios ?? [],
      voi_results:      sessionData?.voiResults ?? [],
      influence_diagram: sessionData?.influenceDiagram ? [sessionData.influenceDiagram] : [],
      stakeholders:     sessionData?.stakeholders ?? [],
      risks:            sessionData?.risks ?? [],
      dq_scorecard:     sessionData?.dqScorecard ? [sessionData.dqScorecard] : [],
      recommendation:   sessionData?.recommendation ? [sessionData.recommendation] : [],
      tornado_variables: sessionData?.tornadoVariables ?? [],
      decision_tree:    sessionData?.decisionTree ? [sessionData.decisionTree] : [],
      game_theory:      sessionData?.gameTheory ? [sessionData.gameTheory] : [],
    };
    return validateContract(moduleId, dataMap);
  }, [moduleId, sessionData]);

  return (
    <div>
      {showWarnings && !result.canProceed && (
        <MissingInputWarning moduleId={moduleId} missingItems={result.blockers} />
      )}
      {children({
        blocked: !result.canProceed,
        blockers: result.blockers,
        warnings: result.warnings,
      })}
    </div>
  );
}

// ── Contradiction Alert ───────────────────────────────────────

export function ContradictionAlert({ contradictions }: {
  contradictions: Array<{ severity: string; description: string; suggestion: string }>;
}) {
  const blocking = contradictions.filter(c => c.severity === 'blocking');
  const warnings = contradictions.filter(c => c.severity === 'warning');

  if (!contradictions.length) return null;

  return (
    <div className="space-y-2">
      {blocking.map((c, i) => (
        <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-xl p-3 flex items-start gap-2"
          style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          <X size={14} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>Contradiction: {c.description}</p>
            <p className="text-xs mt-0.5" style={{ color: '#7F1D1D' }}>💡 {c.suggestion}</p>
          </div>
        </motion.div>
      ))}
      {warnings.map((c, i) => (
        <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-xl p-3 flex items-start gap-2"
          style={{ background: '#FEF3C7', border: '1px solid #FCD34D' }}>
          <AlertTriangle size={14} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#D97706' }}>Warning: {c.description}</p>
            <p className="text-xs mt-0.5" style={{ color: '#78350F' }}>💡 {c.suggestion}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Module Readiness Card ─────────────────────────────────────

export function ModuleReadinessCard({ moduleId, sessionData }: {
  moduleId: ModuleId;
  sessionData: any;
}) {
  const contract = DATA_CONTRACTS[moduleId];
  if (!contract) return null;

  const dataMap: Record<DataSource, any[]> = {
    problem_frame:    sessionData?.problemFrame ? [sessionData.problemFrame] : [],
    issues:           sessionData?.issueItems ?? [],
    decisions:        sessionData?.structuringOutput?.focusDecisions ?? [],
    strategies:       sessionData?.strategies ?? [],
    criteria:         sessionData?.structuringOutput?.criteria ?? [],
    assessment_scores: sessionData?.assessmentScores ?? [],
    scenarios:        sessionData?.scenarios ?? [],
    voi_results:      sessionData?.voiResults ?? [],
    influence_diagram: sessionData?.influenceDiagram ? [sessionData.influenceDiagram] : [],
    stakeholders:     sessionData?.stakeholders ?? [],
    risks:            sessionData?.risks ?? [],
    dq_scorecard:     sessionData?.dqScorecard ? [sessionData.dqScorecard] : [],
    recommendation:   sessionData?.recommendation ? [sessionData.recommendation] : [],
    tornado_variables: sessionData?.tornadoVariables ?? [],
    decision_tree:    sessionData?.decisionTree ? [sessionData.decisionTree] : [],
    game_theory:      sessionData?.gameTheory ? [sessionData.gameTheory] : [],
  };

  const result = validateContract(moduleId, dataMap);

  return (
    <div className="rounded-xl p-4" style={{ background: result.canProceed ? '#ECFDF5' : DS.surfaceAlt, border: `1px solid ${result.canProceed ? '#86EFAC' : DS.border}` }}>
      <div className="flex items-center gap-2 mb-2">
        {result.canProceed
          ? <CheckCircle2 size={14} style={{ color: '#059669' }} />
          : <ShieldAlert size={14} style={{ color: '#D97706' }} />}
        <p className="text-xs font-semibold" style={{ color: result.canProceed ? '#059669' : DS.inkTer }}>
          {result.canProceed ? 'All inputs available' : 'Missing required inputs'}
        </p>
      </div>
      {contract.consumes.map(req => {
        const data = dataMap[req.source] ?? [];
        const count = data.length;
        const ok = !req.required || count >= (req.minItems ?? 1);
        return (
          <div key={req.source} className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ok ? '#059669' : req.required ? '#DC2626' : '#D97706' }} />
            <span className="text-xs" style={{ color: ok ? DS.inkTer : req.required ? '#DC2626' : '#D97706' }}>
              {req.source.replace(/_/g, ' ')} {req.required ? '*' : ''} ({count})
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * AITrustBadge — displays AI output trust level to users
 * Appears beneath every AI-generated output
 * Shows: confidence level, data grounding, assumptions, DQ warnings
 */
import { useState } from 'react';
import { DS } from '@/constants';
import { Shield, AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import type { TrustResult } from '@/hooks/useAI';

interface Props {
  trust: TrustResult | null;
  warnings?: string[];
  blockers?: string[];
  compact?: boolean;
}

const LEVEL_CONFIG = {
  TRUSTED: { icon: CheckCircle, label: 'High Confidence', bg: DS.successSoft, border: DS.success, text: DS.success },
  REVIEW_RECOMMENDED: { icon: AlertTriangle, label: 'Review Recommended', bg: DS.warnSoft, border: DS.warning, text: DS.warning },
  LOW_CONFIDENCE: { icon: Eye, label: 'Low Confidence', bg: DS.dangerSoft, border: DS.danger, text: DS.danger },
  DO_NOT_USE: { icon: AlertTriangle, label: 'Insufficient Data', bg: DS.dangerSoft, border: DS.danger, text: DS.danger },
};

export function AITrustBadge({ trust, warnings = [], blockers = [], compact = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  // Pre-flight warnings/blockers (before AI call)
  if (blockers.length > 0) {
    return (
      <div className="mt-2 p-3 rounded-xl border" style={{ background: DS.dangerSoft, borderColor: DS.danger + '40' }}>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={12} style={{ color: DS.danger }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.danger }}>BLOCKED — CANNOT PROCEED</span>
        </div>
        {blockers.map((b, i) => <p key={i} className="text-[10px]" style={{ color: DS.inkSub }}>• {b}</p>)}
      </div>
    );
  }

  if (!trust) {
    if (warnings.length === 0) return null;
    return (
      <div className="mt-2 p-2.5 rounded-xl" style={{ background: DS.warnSoft, border: `1px solid ${DS.warning}30` }}>
        {warnings.map((w, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[9px]" style={{ color: DS.warning }}>
            <AlertTriangle size={9} style={{ flexShrink: 0, marginTop: 1 }} /> {w}
          </div>
        ))}
      </div>
    );
  }

  const cfg = LEVEL_CONFIG[trust.level] || LEVEL_CONFIG.REVIEW_RECOMMENDED;
  const Icon = cfg.icon;

  const hasDetails = trust.flags.length > 0 || trust.assumptionsMade.length > 0 || trust.dataPointsUsed.length > 0 || trust.caveats.length > 0;

  return (
    <div className="mt-2 rounded-xl overflow-hidden border" style={{ borderColor: cfg.border + '40', background: cfg.bg }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon size={12} style={{ color: cfg.text, flexShrink: 0 }} />
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: cfg.text }}>{cfg.label}</span>
        
        {/* Trust score bar */}
        <div className="flex-1 h-1.5 rounded-full overflow-hidden mx-2" style={{ background: 'rgba(0,0,0,0.1)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${trust.trustScore}%`, background: cfg.text }} />
        </div>
        <span className="text-[9px] font-bold shrink-0" style={{ color: cfg.text }}>{trust.trustScore}%</span>

        {hasDetails && !compact && (
          <button onClick={() => setExpanded(!expanded)} className="ml-1">
            {expanded ? <ChevronUp size={11} style={{ color: cfg.text }} /> : <ChevronDown size={11} style={{ color: cfg.text }} />}
          </button>
        )}
      </div>

      {/* Reason */}
      {trust.reason && (
        <div className="px-3 pb-1">
          <p className="text-[9px]" style={{ color: DS.inkSub }}>{trust.reason}</p>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && hasDetails && (
        <div className="border-t px-3 py-2 space-y-2" style={{ borderColor: cfg.border + '25' }}>
          {trust.flags.length > 0 && (
            <div>
              <div className="text-[8px] font-bold uppercase mb-1" style={{ color: DS.danger }}>DQ WARNINGS</div>
              {trust.flags.map((f, i) => (
                <div key={i} className="flex items-start gap-1 text-[9px]" style={{ color: DS.inkSub }}>
                  <AlertTriangle size={8} style={{ color: DS.danger, flexShrink: 0, marginTop: 1 }} /> {f}
                </div>
              ))}
            </div>
          )}
          {trust.dataPointsUsed.length > 0 && (
            <div>
              <div className="text-[8px] font-bold uppercase mb-1" style={{ color: DS.information.fill }}>DATA USED</div>
              {trust.dataPointsUsed.slice(0, 4).map((d, i) => (
                <div key={i} className="text-[9px]" style={{ color: DS.inkSub }}>• {d}</div>
              ))}
            </div>
          )}
          {trust.assumptionsMade.length > 0 && (
            <div>
              <div className="text-[8px] font-bold uppercase mb-1" style={{ color: DS.warning }}>ASSUMPTIONS MADE</div>
              {trust.assumptionsMade.map((a, i) => (
                <div key={i} className="text-[9px]" style={{ color: DS.inkSub }}>• {a}</div>
              ))}
            </div>
          )}
          {trust.caveats.length > 0 && (
            <div>
              <div className="text-[8px] font-bold uppercase mb-1" style={{ color: DS.inkDis }}>CAVEAT</div>
              {trust.caveats.map((c, i) => (
                <div key={i} className="text-[9px] italic" style={{ color: DS.inkSub }}>{c}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pre-flight warnings */}
      {warnings.length > 0 && (
        <div className="border-t px-3 py-2" style={{ borderColor: DS.warning + '25', background: DS.warnSoft }}>
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1 text-[9px]" style={{ color: DS.warning }}>
              <Info size={8} style={{ flexShrink: 0, marginTop: 1 }} /> {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AUDIT LOG PANEL ────────────────────────────────────────────────────────────
export function AIAuditPanel({ onClose }: { onClose: () => void }) {
  const log = (() => {
    try { return JSON.parse(localStorage.getItem('vantage_dq_ai_audit') || '[]'); }
    catch { return []; }
  })();

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col border-l" style={{ borderColor: DS.borderLight }}>
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: DS.borderLight, background: DS.brand }}>
        <span className="text-sm font-bold text-white">AI Audit Log</span>
        <button onClick={onClose} className="text-white/60 hover:text-white text-xs">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {log.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: DS.inkDis }}>No AI calls logged yet</p>
        ) : log.map((entry: any, i: number) => {
          const trustColor = entry.outputTrustScore >= 80 ? DS.success : entry.outputTrustScore >= 60 ? DS.warning : DS.danger;
          return (
            <div key={i} className="p-3 rounded-xl border" style={{ borderColor: DS.borderLight, background: DS.bg }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold" style={{ color: DS.ink }}>{entry.module}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: `${trustColor}20`, color: trustColor }}>{entry.outputTrustScore}%</span>
                {entry.flagCount > 0 && <span className="text-[9px]" style={{ color: DS.danger }}>⚠ {entry.flagCount} flags</span>}
              </div>
              <div className="text-[9px]" style={{ color: DS.inkDis }}>
                {new Date(entry.timestamp).toLocaleTimeString()} · {entry.confidenceLevel} · {entry.dqElement}
              </div>
              {entry.criticalFlags?.map((f: string, j: number) => (
                <div key={j} className="text-[8px] mt-1" style={{ color: DS.danger }}>• {f}</div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t shrink-0 text-center" style={{ borderColor: DS.borderLight }}>
        <p className="text-[9px]" style={{ color: DS.inkDis }}>{log.length} AI calls logged · Last 100 retained</p>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import type { ReviewQueueItem, ModuleReadinessState } from '../../types/entities';
import { useModuleReadiness, getReadinessDot, getReadinessLabel } from '../../hooks/useModuleReadiness';
import ProblemFrame from '../modules/ProblemFrame';
import IssueGeneration from '../modules/IssueGeneration';
import DecisionStructuring from '../modules/DecisionStructuring';
import StrategyFormation from '../modules/StrategyFormation';
import StrategyEvaluation from '../modules/StrategyEvaluation';
import DQScorecard from '../modules/DQScorecard';
import StakeholderAlignment from '../modules/StakeholderAlignment';
import ExecutiveRecommendation from '../modules/ExecutiveRecommendation';
import WorkshopMode from './WorkshopMode';
import TornadoChart from '../modules/TornadoChart';
import ScenarioPlanning from '../modules/ScenarioPlanning';
import ValueOfInformation from '../modules/ValueOfInformation';
import DecisionRiskTimeline from '../modules/DecisionRiskTimeline';
import InfluenceDiagram from '../modules/InfluenceDiagram';
import DecisionLineage from '../modules/DecisionLineage';
import PostDecisionTracker from '../modules/PostDecisionTracker';
import GameTheory from '../modules/GameTheory';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const MODULES = [
  // Phase 1 — Decision Intelligence
  { id: 'problem',      label: 'Problem Frame',          sub: 'Frame the decision',        num: '01', phase: 1 },
  { id: 'issues',       label: 'Issue Raising',          sub: 'Extract intelligence',      num: '02', phase: 1 },
  { id: 'hierarchy',    label: 'Decision Structuring',   sub: 'Structure the decision',    num: '03', phase: 1 },
  { id: 'strategy',     label: 'Strategy Formation',     sub: 'Design strategic paths',    num: '04', phase: 1 },
  { id: 'assessment',   label: 'Strategy Evaluation',    sub: 'Score & compare',           num: '05', phase: 1 },
  { id: 'scorecard',    label: 'DQ Scorecard',           sub: 'Audit decision quality',    num: '06', phase: 1 },
  { id: 'stakeholders', label: 'Stakeholder Alignment',  sub: 'Map alignment',             num: '07', phase: 1 },
  { id: 'lineage',      label: 'Decision Lineage',         sub: 'Traceable reasoning chain', num: '08', phase: 1 },
  { id: 'export',       label: 'Executive Recommendation',sub: 'Package & recommend',       num: '09', phase: 1 },
  { id: 'post-decision',label: 'Post-Decision Tracker',   sub: 'Track & learn',             num: '10', phase: 1 },
  // Phase 2 — Quantitative Analysis
  { id: 'scenario',     label: 'Scenario Planning',      sub: 'Future states',             num: '09', phase: 2 },
  { id: 'voi',          label: 'Value of Information',   sub: 'What is worth knowing',     num: '10', phase: 2 },
  { id: 'influence',    label: 'Influence Diagram',      sub: 'Uncertainty mapping',       num: '11', phase: 2 },
  { id: 'risk-timeline',label: 'Decision Risk Timeline', sub: 'Temporal risk',             num: '12', phase: 2 },
  { id: 'tornado',      label: 'Tornado Chart',          sub: 'Sensitivity analysis',      num: '13', phase: 2 },
  { id: 'decision-tree',label: 'Decision Tree',          sub: 'Sequential decisions',      num: '14', phase: 2 },
  { id: 'game-theory',  label: 'Game Theory',            sub: 'Strategic interactions',    num: '15', phase: 2 },
];

const DQ_DIMS = [
  { id: 'frame',       label: 'Frame',        color: '#3B82F6' },
  { id: 'alternatives',label: 'Alternatives', color: '#0D9488' },
  { id: 'information', label: 'Information',  color: '#10B981' },
  { id: 'values',      label: 'Values',       color: '#D97706' },
  { id: 'reasoning',   label: 'Reasoning',    color: '#6366F1' },
  { id: 'commitment',  label: 'Commitment',   color: '#E11D48' },
];

// Bottom nav shows first 5 modules on mobile
const BOTTOM_NAV = MODULES.slice(0, 5);

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root { height: 100%; margin: 0; padding: 0; }

  .sl-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    background: #0B1D3A;
    font-family: 'DM Sans', system-ui, sans-serif;
    color: #F8FAFC;
    overflow: hidden;
  }

  /* ── Top header ── */
  .sl-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    height: 56px;
    background: #0B1D3A;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
    gap: 12px;
    z-index: 20;
  }

  /* ── Body (sidebar + content) ── */
  .sl-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* ── Sidebar ── */
  .sl-sidebar {
    width: 256px;
    flex-shrink: 0;
    background: #091729;
    border-right: 1px solid rgba(255,255,255,0.07);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }

  .sl-sidebar::-webkit-scrollbar { width: 4px; }
  .sl-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

  /* ── Content ── */
  .sl-content {
    flex: 1;
    overflow-y: auto;
    background: #0F2038;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }
  .sl-content::-webkit-scrollbar { width: 6px; }
  .sl-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

  /* ── Module nav item ── */
  .sl-nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    cursor: pointer;
    border-left: 3px solid transparent;
    transition: all 0.15s;
    position: relative;
  }
  .sl-nav-item:hover { background: rgba(255,255,255,0.04); }
  .sl-nav-item.active {
    background: rgba(201,168,76,0.08);
    border-left-color: #C9A84C;
  }
  .sl-nav-item.active .sl-nav-label { color: #F8FAFC; }
  .sl-nav-item.active .sl-nav-num { color: #C9A84C; }

  /* ── Bottom nav (mobile only) ── */
  .sl-bottom-nav {
    display: none;
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 60px;
    background: #091729;
    border-top: 1px solid rgba(255,255,255,0.1);
    z-index: 30;
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* ── DQ Score ring ── */
  .sl-score-ring {
    position: relative;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }

  /* ── Module menu overlay (mobile) ── */
  .sl-module-overlay {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
  }
  .sl-module-drawer {
    position: absolute;
    bottom: 60px; left: 0; right: 0;
    background: #091729;
    border-top: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px 16px 0 0;
    max-height: 70vh;
    overflow-y: auto;
    padding: 8px 0 16px;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .sl-sidebar { display: none; }
    .sl-bottom-nav { display: flex; align-items: stretch; }
    .sl-module-overlay.open { display: block; }
    .sl-content { padding-bottom: 60px; }
    .sl-topbar { padding: 0 14px; height: 52px; }
    .sl-topbar-session-name { font-size: 13px; max-width: 140px; }
    .sl-topbar-right { gap: 8px; }
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    .sl-sidebar { width: 220px; }
    .sl-nav-item { padding: 9px 14px; }
  }

  @media (min-width: 1280px) {
    .sl-sidebar { width: 272px; }
  }
`;

// ─────────────────────────────────────────────────────────────
// READINESS DOT
// ─────────────────────────────────────────────────────────────

function ReadinessDot({ state }: { state: ModuleReadinessState }) {
  const color = getReadinessDot(state);
  const label = getReadinessLabel(state);
  const isPulse = state === 'needs_review' || state === 'missing_required_inputs';

  return (
    <div title={label} style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color,
        opacity: state === 'not_started' ? 0.3 : 1,
      }} />
      {isPulse && (
        <div style={{
          position: 'absolute', inset: -2,
          borderRadius: '50%',
          border: `1px solid ${color}`,
          animation: 'readiness-pulse 2s ease-out infinite',
          opacity: 0.6,
        }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DQ SCORE RING SVG
// ─────────────────────────────────────────────────────────────

function DQScoreRing({ score }: { score: number }) {
  const r = 16, cx = 20, cy = 20;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 70 ? '#10B981' : score >= 40 ? '#C9A84C' : '#EF4444';

  return (
    <svg width="40" height="40" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth="3"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text
        x={cx} y={cy}
        textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${cx}px ${cy}px` }}
        fill={color} fontSize="10" fontWeight="700" fontFamily="DM Sans, sans-serif"
      >{score}</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────

interface SessionLayoutProps {
  sessionName: string;
  acceptedItems: ReviewQueueItem[];
  onBack: () => void;
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export default function SessionLayout({ sessionName, acceptedItems, onBack }: SessionLayoutProps) {
  const [activeModule, setActiveModule] = useState('problem');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarPhase, setSidebarPhase] = useState<1 | 2>(1);
  const [structuringOutput, setStructuringOutput] = useState<any>(null);
  const [issueItems, setIssueItems] = useState<any[]>([]);
  const [workshopMode, setWorkshopMode] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');

  // Persistent module state — survives navigation
  const moduleStateRef = useRef<Record<string, any>>({});
  const getModuleState = (id: string) => moduleStateRef.current[id] ?? {};
  const setModuleState = (id: string, state: any) => {
    moduleStateRef.current[id] = { ...moduleStateRef.current[id], ...state };
  };

  // Build stub session data from accepted items
  const sessionData = { ...buildSessionData(acceptedItems), structuringOutput, issueItems };

  // Compute readiness for all modules
  const readiness = useModuleReadiness({
    session: null,
    problemFrame: sessionData?.problemFrame,
    issues: sessionData?.issues,
    hierarchyNodes: sessionData?.hierarchyNodes,
    strategies: sessionData?.strategies,
    assessmentScores: [],
    dqScorecard: [],
    stakeholders: sessionData?.stakeholders,
    riskItems: sessionData?.riskItems,
    influenceDiagram: null,
    scenarios: [],
    voiItems: [],
  });

  // Compute overall DQ score from readiness
  const dqScore = computeDQScore(readiness);

  const activeModuleMeta = MODULES.find(m => m.id === activeModule);

  const handleModuleSelect = (id: string) => {
    setActiveModule(id);
    setMobileMenuOpen(false);
  };

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const drawer = document.querySelector('.sl-module-drawer');
      if (drawer && !drawer.contains(e.target as Node)) setMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileMenuOpen]);

  return (
    <div className="sl-root">
      <style>{CSS}</style>
      <style>{`
        @keyframes readiness-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>

      {/* ── Top Bar ── */}
      <div className="sl-topbar">
        {/* Left: back + session name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 7, padding: '5px 12px', color: '#64748B', cursor: 'pointer',
            fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap',
          }}>← Back</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#C9A84C', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Decision Session
            </div>
            <div className="sl-topbar-session-name" style={{
              fontSize: 15, fontWeight: 700, color: '#F8FAFC',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{sessionName}</div>
          </div>
        </div>

        {/* Mode buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
          <button
            onClick={() => setWorkshopMode(m => !m)}
            title="Workshop Mode — full screen, focused"
            style={{
              background: workshopMode ? '#4F6AF5' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${workshopMode ? '#4F6AF5' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 7, padding: '5px 10px', color: workshopMode ? '#fff' : '#64748B',
              cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <span>◻</span> Workshop
          </button>

          <button
            onClick={() => setShowNotes(m => !m)}
            title="Facilitator Notes"
            style={{
              background: showNotes ? '#D97706' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${showNotes ? '#D97706' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 7, padding: '5px 10px', color: showNotes ? '#fff' : '#64748B',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
            }}
          >
            📝
          </button>
        </div>

        {/* Right: DQ score + items count + module name */}
        <div className="sl-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          {/* Active module pill — hidden on tiny screens */}
          {activeModuleMeta && (
            <div style={{
              background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)',
              borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#C9A84C',
              whiteSpace: 'nowrap',
            }} className="sl-module-pill">
              {activeModuleMeta.num} · {activeModuleMeta.label}
            </div>
          )}

          {/* Items count badge */}
          <div style={{
            background: 'rgba(255,255,255,0.06)', borderRadius: 20,
            padding: '4px 10px', fontSize: 12, color: '#64748B', whiteSpace: 'nowrap',
          }}>
            {acceptedItems.length} items
          </div>

          {/* DQ Score ring */}
          <DQScoreRing score={dqScore} />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="sl-body">

        {/* ── Sidebar ── */}
        <aside className="sl-sidebar">

          {/* Phase toggle */}
          <div style={{
            display: 'flex', margin: '12px 12px 8px',
            background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3,
          }}>
            {([1, 2] as const).map(p => (
              <button key={p} onClick={() => setSidebarPhase(p)} style={{
                flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
                background: sidebarPhase === p ? 'rgba(201,168,76,0.15)' : 'transparent',
                color: sidebarPhase === p ? '#C9A84C' : '#475569',
                fontSize: 12, fontWeight: sidebarPhase === p ? 700 : 400,
                cursor: 'pointer', transition: 'all 0.15s',
              }}>Phase {p}</button>
            ))}
          </div>

          {/* Module list */}
          <div style={{ flex: 1, paddingBottom: 16 }}>
            {MODULES.filter(m => m.phase === sidebarPhase).map(mod => {
              const r = readiness[mod.id];
              const isActive = activeModule === mod.id;
              return (
                <div
                  key={mod.id}
                  className={`sl-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleModuleSelect(mod.id)}
                >
                  {/* Number */}
                  <span className="sl-nav-num" style={{
                    fontSize: 10, color: isActive ? '#C9A84C' : '#334155',
                    fontWeight: 700, letterSpacing: 0.5, flexShrink: 0, width: 20,
                  }}>{mod.num}</span>

                  {/* Label + sub */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sl-nav-label" style={{
                      fontSize: 13, fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#F8FAFC' : '#94A3B8',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{mod.label}</div>
                    <div style={{
                      fontSize: 11, color: '#334155',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{mod.sub}</div>
                  </div>

                  {/* Readiness dot */}
                  {r && <ReadinessDot state={r.state} />}
                </div>
              );
            })}
          </div>

          {/* DQ Scorecard mini */}
          <div style={{
            margin: '0 12px 16px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 10, color: '#475569', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
              DQ Score
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DQ_DIMS.map(dim => {
                const dimScore = getDimScore(dim.id, readiness);
                return (
                  <div key={dim.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#475569', width: 72, flexShrink: 0 }}>{dim.label}</span>
                    <div style={{
                      flex: 1, height: 4, background: 'rgba(255,255,255,0.06)',
                      borderRadius: 2, overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${dimScore}%`, height: '100%',
                        background: dim.color,
                        borderRadius: 2,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#334155', width: 24, textAlign: 'right' }}>{dimScore}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="sl-content">
          <ModuleContent
            moduleId={activeModule}
            moduleMeta={activeModuleMeta}
            readiness={readiness[activeModule]}
            sessionData={sessionData}
            acceptedItems={acceptedItems}
            persistedState={getModuleState(activeModule)}
            onPersistState={(state: any) => setModuleState(activeModule, state)}
            onNavigate={setActiveModule}
            onSetStructuringOutput={setStructuringOutput}
            onSetIssueItems={setIssueItems}
          />
        </main>
      </div>

      {/* ── Workshop Mode ── */}
      {workshopMode && (
        <WorkshopMode
          sessionName={sessionName}
          decisionStatement={sessionData?.problemFrame?.decisionStatement as string | undefined}
          activeModuleLabel={activeModuleMeta?.label ?? ''}
          onClose={() => setWorkshopMode(false)}
        >
          <ModuleContent
            moduleId={activeModule}
            moduleMeta={activeModuleMeta}
            readiness={readiness[activeModule]}
            sessionData={sessionData}
            acceptedItems={acceptedItems}
            persistedState={getModuleState(activeModule)}
            onPersistState={(state: any) => setModuleState(activeModule, state)}
            onNavigate={setActiveModule}
            onSetStructuringOutput={setStructuringOutput}
            onSetIssueItems={setIssueItems}
          />
        </WorkshopMode>
      )}

      {/* ── Floating notes ── */}
      {showNotes && (
        <div style={{
          position: 'fixed', right: 16, bottom: 16, width: 320, zIndex: 200,
          background: '#fff', borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '1px solid #E2E6EE',
        }}>
          <div style={{ padding: '10px 16px', background: '#FEF3C7', borderBottom: '1px solid #FCD34D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>📝 Facilitator Notes</span>
            <button onClick={() => setShowNotes(false)} style={{ background: 'none', border: 'none', color: '#92400E', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
          <div style={{ padding: 12 }}>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Private notes for this session…"
              rows={8}
              style={{
                width: '100%', borderRadius: 10, padding: '10px 12px', fontSize: 13,
                background: '#F8F9FC', border: '1px solid #E2E6EE', color: '#0F1724',
                outline: 'none', lineHeight: 1.6, resize: 'none', boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: 11, color: '#A0ABBE', marginTop: 6 }}>Not included in exports</p>
          </div>
        </div>
      )}

      {/* ── Mobile Bottom Nav ── */}
      <nav className="sl-bottom-nav">
        {BOTTOM_NAV.map(mod => {
          const r = readiness[mod.id];
          const isActive = activeModule === mod.id;
          return (
            <button key={mod.id} onClick={() => handleModuleSelect(mod.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 3, background: 'none', border: 'none',
              cursor: 'pointer', padding: '6px 2px',
              borderTop: isActive ? '2px solid #C9A84C' : '2px solid transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 10, color: isActive ? '#C9A84C' : '#334155', fontWeight: 700 }}>
                  {mod.num}
                </span>
                {r && <ReadinessDot state={r.state} />}
              </div>
              <span style={{
                fontSize: 10, color: isActive ? '#C9A84C' : '#475569',
                fontWeight: isActive ? 600 : 400, textAlign: 'center', lineHeight: 1.2,
                maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{mod.label}</span>
            </button>
          );
        })}

        {/* "More" button opens drawer */}
        <button onClick={() => setMobileMenuOpen(true)} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 3, background: 'none', border: 'none',
          cursor: 'pointer', padding: '6px 2px',
          borderTop: '2px solid transparent',
        }}>
          <span style={{ fontSize: 18, color: '#334155' }}>⋯</span>
          <span style={{ fontSize: 10, color: '#475569' }}>More</span>
        </button>
      </nav>

      {/* ── Mobile Module Drawer ── */}
      <div className={`sl-module-overlay ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sl-module-drawer">
          <div style={{ padding: '8px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: '#475569', letterSpacing: 1.5, textTransform: 'uppercase' }}>All Modules</div>
          </div>
          {MODULES.map(mod => {
            const r = readiness[mod.id];
            const isActive = activeModule === mod.id;
            return (
              <div key={mod.id} onClick={() => handleModuleSelect(mod.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 20px', cursor: 'pointer',
                background: isActive ? 'rgba(201,168,76,0.08)' : 'transparent',
                borderLeft: isActive ? '3px solid #C9A84C' : '3px solid transparent',
              }}>
                <span style={{ fontSize: 10, color: '#334155', fontWeight: 700, width: 20 }}>{mod.num}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: isActive ? '#F8FAFC' : '#94A3B8', fontWeight: isActive ? 600 : 400 }}>
                    {mod.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#334155' }}>{mod.sub}</div>
                </div>
                {r && (
                  <span style={{ fontSize: 11, color: getReadinessDot(r.state) }}>
                    {getReadinessLabel(r.state)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE CONTENT PLACEHOLDER
// (Each module will be replaced with its real component)
// ─────────────────────────────────────────────────────────────

function ModuleContent({ moduleId, moduleMeta, readiness, sessionData, acceptedItems, persistedState, onPersistState, onNavigate, onSetStructuringOutput, onSetIssueItems }: any) {
  if (!readiness) return null;

  // Full-bleed modules — take over entire content area
  if (moduleId === 'problem') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <ProblemFrame
          data={sessionData?.problemFrame}
          sessionId={undefined}
          persistedState={persistedState}
          onPersistState={onPersistState}
        />
      </div>
    );
  }
  if (moduleId === 'issues') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <IssueGeneration
          acceptedItems={acceptedItems}
          sessionData={sessionData}
          persistedState={persistedState}
          onPersistState={onPersistState}
          onValidated={(issues: any[]) => { console.log('Issues validated', issues); onSetIssueItems?.(issues); onNavigate?.('hierarchy'); }}
        />
      </div>
    );
  }
  if (moduleId === 'hierarchy') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <DecisionStructuring
          acceptedItems={acceptedItems}
          sessionData={sessionData}
          persistedState={persistedState}
          onPersistState={onPersistState}
          onValidated={(output: any) => { console.log('Decision structuring validated', output); onSetStructuringOutput?.(output); onNavigate?.('strategy'); }}
        />
      </div>
    );
  }
  if (moduleId === 'strategy') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <StrategyFormation
          acceptedItems={acceptedItems}
          sessionData={sessionData}
          persistedState={persistedState}
          onPersistState={onPersistState}
          onValidated={(strategies: any[]) => { console.log('Strategies validated', strategies); onNavigate?.('assessment'); }}
        />
      </div>
    );
  }
  if (moduleId === 'assessment') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <StrategyEvaluation
          acceptedItems={acceptedItems}
          sessionData={sessionData}
          persistedState={persistedState}
          onPersistState={onPersistState}
          onValidated={(output: any) => { console.log('Evaluation validated', output); onNavigate?.('scorecard'); }}
        />
      </div>
    );
  }
  if (moduleId === 'scorecard') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <DQScorecard
          acceptedItems={acceptedItems}
          sessionData={sessionData}
          persistedState={persistedState}
          onPersistState={onPersistState}
          onValidated={(output: any) => { console.log('Scorecard validated', output); onNavigate?.('stakeholders'); }}
        />
      </div>
    );
  }
  if (moduleId === 'stakeholders') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <StakeholderAlignment
          acceptedItems={acceptedItems}
          sessionData={sessionData}
          persistedState={persistedState}
          onPersistState={onPersistState}
          onValidated={(output: any) => { console.log('Stakeholders validated', output); onNavigate?.('export'); }}
        />
      </div>
    );
  }
  if (moduleId === 'lineage') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <DecisionLineage
          acceptedItems={acceptedItems}
          sessionData={sessionData}
          persistedState={persistedState}
          onPersistState={onPersistState}
          onValidated={(o: any) => { console.log('Lineage validated', o); onNavigate?.('export'); }}
        />
      </div>
    );
  }
  if (moduleId === 'post-decision') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <PostDecisionTracker
          acceptedItems={acceptedItems}
          sessionData={sessionData}
          persistedState={persistedState}
          onPersistState={onPersistState}
          onValidated={(o: any) => console.log('Post-decision saved', o)}
        />
      </div>
    );
  }
  if (moduleId === 'scenario') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <ScenarioPlanning acceptedItems={acceptedItems} sessionData={sessionData} persistedState={persistedState} onPersistState={onPersistState} onValidated={(o:any)=>console.log('Scenario validated',o)} />
      </div>
    );
  }
  if (moduleId === 'voi') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <ValueOfInformation acceptedItems={acceptedItems} sessionData={sessionData} persistedState={persistedState} onPersistState={onPersistState} onValidated={(o:any)=>console.log('VOI validated',o)} />
      </div>
    );
  }
  if (moduleId === 'influence') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <InfluenceDiagram acceptedItems={acceptedItems} sessionData={sessionData} persistedState={persistedState} onPersistState={onPersistState} onValidated={(o:any)=>console.log('Influence validated',o)} />
      </div>
    );
  }
  if (moduleId === 'risk-timeline') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <DecisionRiskTimeline acceptedItems={acceptedItems} sessionData={sessionData} persistedState={persistedState} onPersistState={onPersistState} onValidated={(o:any)=>console.log('Risk timeline validated',o)} />
      </div>
    );
  }
  if (moduleId === 'tornado') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <TornadoChart
          acceptedItems={acceptedItems}
          sessionData={sessionData}
          persistedState={persistedState}
          onPersistState={onPersistState}
          onValidated={(output: any) => console.log('Tornado validated', output)}
        />
      </div>
    );
  }
  if (moduleId === 'game-theory') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <GameTheory
          acceptedItems={acceptedItems}
          sessionData={sessionData}
          persistedState={persistedState}
          onPersistState={onPersistState}
          onValidated={(output: any) => console.log('Game theory validated', output)}
        />
      </div>
    );
  }
  if (moduleId === 'export') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <ExecutiveRecommendation
          acceptedItems={acceptedItems}
          sessionData={sessionData}
          persistedState={persistedState}
          onPersistState={onPersistState}
          onValidated={(output: any) => { console.log('Recommendation validated', output); onNavigate?.('scenario'); }}
        />
      </div>
    );
  }

  const stateColors: Record<string, string> = {
    not_started: '#334155',
    missing_required_inputs: '#EF4444',
    draft_available: '#C9A84C',
    needs_review: '#F59E0B',
    ready: '#3B82F6',
    validated: '#10B981',
  };

  const color = stateColors[readiness.state] ?? '#334155';

  // Count items for this module
  const moduleItems = (acceptedItems ?? []).filter((i: ReviewQueueItem) => i.targetModule === moduleId);

  return (
    <div style={{ padding: '32px 28px', maxWidth: 900 }}>

      {/* Module header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
          {moduleMeta?.phase === 1 ? 'Phase 1 · Decision Quality' : 'Phase 2 · Quantitative Analysis'} · {moduleMeta?.num}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, letterSpacing: -0.5, color: '#F8FAFC' }}>
              {moduleMeta?.label}
            </h1>
            <p style={{ margin: 0, color: '#64748B', fontSize: 15 }}>{moduleMeta?.sub}</p>
          </div>
          {/* Readiness badge */}
          <div style={{
            background: `${color}18`, border: `1px solid ${color}44`,
            borderRadius: 20, padding: '6px 16px',
            display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 12, color, fontWeight: 600 }}>
              {getReadinessLabel(readiness.state)}
            </span>
          </div>
        </div>
      </div>

      {/* Missing inputs warning */}
      {readiness.state === 'missing_required_inputs' && readiness.missingInputs?.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 12, color: '#FCA5A5', fontWeight: 600, marginBottom: 8 }}>
            ⚠ Required inputs missing
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
            {readiness.missingInputs.map((m: string, i: number) => (
              <li key={i} style={{ fontSize: 13, color: '#FCA5A5', marginBottom: 4 }}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preloaded items from Deep Dive */}
      {moduleItems.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 11, color: '#C9A84C', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
          }}>
            {moduleItems.length} item{moduleItems.length !== 1 ? 's' : ''} pre-loaded from Deep Dive
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {moduleItems.map((item: ReviewQueueItem) => (
              <PreloadedItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Module canvas — placeholder for remaining modules */}
      {(
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: 14, padding: '48px 24px', textAlign: 'center',
          minHeight: 300, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 36, opacity: 0.2 }}>◆</div>
          <div style={{ fontSize: 15, color: '#334155', fontWeight: 600 }}>{moduleMeta?.label} module</div>
          <div style={{ fontSize: 13, color: '#1E3A5F' }}>
            This module is being built. Pre-loaded items above are ready.
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PRELOADED ITEM CARD
// ─────────────────────────────────────────────────────────────

function PreloadedItem({ item }: { item: ReviewQueueItem }) {
  const d = item.data as any;
  const title = d.label ?? d.name ?? d.decisionStatement ?? 'Item';
  const sub = d.description ?? d.context ?? d.tagline ?? null;

  return (
    <div style={{
      background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)',
      borderRadius: 9, padding: '11px 14px',
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
        background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, color: '#34D399',
      }}>✓</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', marginBottom: sub ? 3 : 0 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>{String(sub).slice(0, 100)}{String(sub).length > 100 ? '…' : ''}</div>}
      </div>
      <div style={{
        fontSize: 10, color: '#C9A84C', background: 'rgba(201,168,76,0.1)',
        borderRadius: 4, padding: '2px 6px', flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        {Math.round(item.confidenceScore * 100)}%
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function buildSessionData(items: ReviewQueueItem[]) {
  return {
    problemFrame: items.find(i => i.targetType === 'problem_frame')?.data ?? null,
    issues: items.filter(i => i.targetType === 'issue').map(i => i.data),
    hierarchyNodes: items.filter(i => i.targetType === 'decision_node').map(i => i.data),
    strategies: items.filter(i => i.targetType === 'strategy').map(i => ({ ...i.data, id: i.id })),
    stakeholders: items.filter(i => i.targetType === 'stakeholder').map(i => i.data),
    riskItems: items.filter(i => i.targetType === 'risk_item').map(i => i.data),
  };
}

function computeDQScore(readiness: Record<string, any>): number {
  const stateScores: Record<string, number> = {
    not_started: 0, missing_required_inputs: 10,
    draft_available: 30, needs_review: 50, ready: 75, validated: 100,
  };
  const phase1 = MODULES.filter(m => m.phase === 1);
  const total = phase1.reduce((sum, m) => {
    const r = readiness[m.id];
    return sum + (stateScores[r?.state ?? 'not_started'] ?? 0);
  }, 0);
  return Math.round(total / phase1.length);
}

function getDimScore(dimId: string, readiness: Record<string, any>): number {
  const dimToModule: Record<string, string> = {
    frame: 'problem', alternatives: 'strategy', information: 'issues',
    values: 'assessment', reasoning: 'scorecard', commitment: 'export',
  };
  const modId = dimToModule[dimId];
  const r = readiness[modId];
  const stateScores: Record<string, number> = {
    not_started: 0, missing_required_inputs: 10, draft_available: 30,
    needs_review: 50, ready: 75, validated: 100,
  };
  return stateScores[r?.state ?? 'not_started'] ?? 0;
}

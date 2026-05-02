import { useState, useMemo } from 'react';
import { useParams } from 'react-router';
import { trpc } from '@/providers/trpc';
import { useSessionData } from '@/hooks/useSessionData';
import { useDemoContext } from '@/App';
import { demoApi, getDemoData, isDemoMode } from '@/lib/demoData';
import { MODULES, DS } from '@/constants';
import type { ModuleId, ToolId, ModuleData } from '@/types';
import { AppShell } from '@/components/layout/AppShell';
import { AISuggestionsPanel } from '@/components/layout/AISuggestionsPanel';
import { GameTheory, WorkshopMode } from '@/components/tools';
import { ProblemFrame } from '@/components/modules/ProblemFrame';
import { IssueGeneration } from '@/components/modules/IssueGeneration';
import { DecisionHierarchy } from '@/components/modules/DecisionHierarchy';
import { StrategyTable } from '@/components/modules/StrategyTable';
import { QualitativeAssessment } from '@/components/modules/QualitativeAssessment';
import { DQScorecard } from '@/components/modules/DQScorecard';
import { StakeholderAlignment } from '@/components/modules/StakeholderAlignment';
import { ExportReport } from '@/components/modules/ExportReport';
import { InfluenceDiagram } from '@/components/modules/InfluenceDiagram';
import { ScenarioPlanning } from '@/components/modules/ScenarioPlanning';
import { ValueOfInformation } from '@/components/modules/ValueOfInformation';
import { DecisionRiskTimeline } from '@/components/modules/DecisionRiskTimeline';

const TOOL_COMPONENTS: Record<string, React.ComponentType<any>> = {
  'game-theory': GameTheory,
  'workshop': WorkshopMode,
};

const MODULE_COMPONENTS: Record<ModuleId, React.ComponentType<any>> = {
  problem: ProblemFrame,
  issues: IssueGeneration,
  hierarchy: DecisionHierarchy,
  strategy: StrategyTable,
  assessment: QualitativeAssessment,
  scorecard: DQScorecard,
  stakeholders: StakeholderAlignment,
  export: ExportReport,
  influence: InfluenceDiagram,
  scenario: ScenarioPlanning,
  voi: ValueOfInformation,
  'risk-timeline': DecisionRiskTimeline,
};

// Build demo hooks that wrap demoApi and trigger re-renders
function useDemoHooks(sessionId: number) {
  const [, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  return useMemo(() => ({
    data: getDemoData(),
    isLoading: false,
    // Issues
    createIssue: (input: any) => { demoApi.createIssue(input); refresh(); },
    deleteIssue: (input: any) => { demoApi.deleteIssue(input); refresh(); },
    voteIssue: (input: any) => { demoApi.voteIssue(input); refresh(); },
    // Decisions
    createDecision: (input: any) => { demoApi.createDecision(input); refresh(); },
    deleteDecision: (input: any) => { demoApi.deleteDecision(input); refresh(); },
    // Strategies
    createStrategy: (input: any) => { demoApi.createStrategy(input); refresh(); },
    deleteStrategy: (input: any) => { demoApi.deleteStrategy(input); refresh(); },
    // Criteria
    createCriterion: (input: any) => { demoApi.createCriterion(input); refresh(); },
    deleteCriterion: (input: any) => { demoApi.deleteCriterion(input); refresh(); },
    // Scores
    setScore: (input: any) => { demoApi.setScore(input); refresh(); },
    // Uncertainties
    createUncertainty: (input: any) => { demoApi.createUncertainty(input); refresh(); },
    deleteUncertainty: (input: any) => { demoApi.deleteUncertainty(input); refresh(); },
    // Stakeholders
    createStakeholder: (input: any) => { demoApi.createStakeholder(input); refresh(); },
    deleteStakeholder: (input: any) => { demoApi.deleteStakeholder(input); refresh(); },
    // Risks
    createRisk: (input: any) => { demoApi.createRisk(input); refresh(); },
    deleteRisk: (input: any) => { demoApi.deleteRisk(input); refresh(); },
    // Session
    updateSession: (input: any) => { demoApi.updateSession(input); refresh(); },
    // AI
    analyse: (input: any) => { const r = demoApi.analyse(input); refresh(); return r; },
    listAISuggestions: (input: any) => demoApi.listAISuggestions(input),
    acceptAISuggestion: (input: any) => { demoApi.acceptAISuggestion(input); refresh(); },
    rejectAISuggestion: (input: any) => { demoApi.rejectAISuggestion(input); refresh(); },
  }), [sessionId]);
}

export function SessionPage() {
  const { slug } = useParams<{ slug: string }>()
;
  const [activeModule, setActiveModule] = useState<ModuleId>('problem');
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const { demoMode } = useDemoContext();

  const handleModuleChange = (id: ModuleId) => {
    setActiveModule(id);
    setActiveTool(null);
  };

  // Demo mode: use localStorage data directly
  if (demoMode || isDemoMode()) {
    return <DemoSessionPage slug={slug || 'demo'} activeModule={activeModule} setActiveModule={handleModuleChange} activeTool={activeTool} setActiveTool={setActiveTool} />;
  }

  // Normal mode: use tRPC + backend
  return <BackendSessionPage slug={slug || ''} activeModule={activeModule} setActiveModule={handleModuleChange} activeTool={activeTool} setActiveTool={setActiveTool} />;
}

function DemoSessionPage({ slug, activeModule, setActiveModule, activeTool, setActiveTool }: { slug: string; activeModule: ModuleId; setActiveModule: (m: ModuleId) => void; activeTool: ToolId | null; setActiveTool: (t: ToolId | null) => void }) {
  const data = getDemoData();
  const hooks = useDemoHooks(data.session.id);
  const sessionName = data.session?.name || 'Demo Session';

  const ActiveComponent = activeTool ? TOOL_COMPONENTS[activeTool] : MODULE_COMPONENTS[activeModule];

  return (
    <AppShell
      sessionName={sessionName}
      sessionId={data.session.id}
      activeModule={activeModule}
      onModuleChange={setActiveModule}
      activeTool={activeTool}
      onToolChange={setActiveTool}
      isSyncing={false}
    >
      {!activeTool && <AISuggestionsPanel sessionId={data.session.id} module={activeModule} />}
      <ActiveComponent sessionId={data.session.id} data={data} hooks={hooks} />
    </AppShell>
  );
}

function BackendSessionPage({ slug, activeModule, setActiveModule, activeTool, setActiveTool }: { slug: string; activeModule: ModuleId; setActiveModule: (m: ModuleId) => void; activeTool: ToolId | null; setActiveTool: (t: ToolId | null) => void }) {
  const { data: sessionMeta } = trpc.session.getBySlug.useQuery(
    { slug },
    { enabled: !!slug }
  );

  const sessionId = sessionMeta?.id;
  const sessionName = sessionMeta?.name || 'Loading...';
  const sessionData = useSessionData(sessionId);

  if (!sessionMeta) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: DS.bg }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm" style={{ color: DS.inkSub }}>Loading session...</p>
        </div>
      </div>
    );
  }

  const ActiveComponent = activeTool ? TOOL_COMPONENTS[activeTool] : MODULE_COMPONENTS[activeModule];

  return (
    <AppShell
      sessionName={sessionName}
      sessionId={sessionId}
      activeModule={activeModule}
      onModuleChange={setActiveModule}
      activeTool={activeTool}
      onToolChange={setActiveTool}
      isSyncing={sessionData.isLoading}
    >
      {sessionId && !activeTool && <AISuggestionsPanel sessionId={sessionId} module={activeModule} />}
      <ActiveComponent sessionId={sessionId} data={sessionData.data} hooks={sessionData} />
    </AppShell>
  );
}

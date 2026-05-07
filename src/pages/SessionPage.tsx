import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router';
import { useSessionData } from '@/hooks/useSessionData';
import { ModuleSkeleton } from '@/components/ui/skeleton-module';
import { useDemoContext } from '@/App';
import { demoApi, getDemoData, isDemoMode } from '@/lib/demoData';
import { MODULES, DS, type ToolId } from '@/constants';
import type { ModuleId } from '@/types';
import { AppShell } from '@/components/layout/AppShell';
import { ProblemFrame } from '@/components/modules/ProblemFrame';
import { IssueGeneration } from '@/components/modules/IssueGeneration';
import { DecisionHierarchy } from '@/components/modules/DecisionHierarchy';
import { StrategyTable } from '@/components/modules/StrategyTable';
import { QualitativeAssessment } from '@/components/modules/QualitativeAssessment';
import { DQScorecard } from '@/components/modules/DQScorecard';
import { StakeholderAlignment } from '@/components/modules/StakeholderAlignment';
import { ExportReport } from '@/components/modules/ExportReport';
import { DecisionLineage } from '@/components/modules/DecisionLineage';
import { PostDecisionTracker } from '@/components/modules/PostDecisionTracker';
import { InfluenceDiagram } from '@/components/modules/InfluenceDiagram';
import { ScenarioPlanning } from '@/components/modules/ScenarioPlanning';
import { ValueOfInformation } from '@/components/modules/ValueOfInformation';
import { DecisionRiskTimeline } from '@/components/modules/DecisionRiskTimeline';
import { GameTheoryModule } from '@/components/modules/GameTheoryModule';
import { DeepDiveTool } from '@/components/tools/DeepDiveTool';
import { AdvancedExportTool } from '@/components/tools/AdvancedExportTool';

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

function useDemoHooks(sessionId: number) {
  const [, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  return useMemo(() => ({
    data: getDemoData(), isLoading: false,
    createIssue: (i: any) => { demoApi.createIssue(i); refresh(); },
    deleteIssue: (i: any) => { demoApi.deleteIssue(i); refresh(); },
    voteIssue: (i: any) => { demoApi.voteIssue(i); refresh(); },
    createDecision: (i: any) => { demoApi.createDecision(i); refresh(); },
    deleteDecision: (i: any) => { demoApi.deleteDecision(i); refresh(); },
    createStrategy: (i: any) => { demoApi.createStrategy(i); refresh(); },
    deleteStrategy: (i: any) => { demoApi.deleteStrategy(i); refresh(); },
    createCriterion: (i: any) => { demoApi.createCriterion(i); refresh(); },
    deleteCriterion: (i: any) => { demoApi.deleteCriterion(i); refresh(); },
    setScore: (i: any) => { demoApi.setScore(i); refresh(); },
    createUncertainty: (i: any) => { demoApi.createUncertainty(i); refresh(); },
    deleteUncertainty: (i: any) => { demoApi.deleteUncertainty(i); refresh(); },
    createStakeholder: (i: any) => { demoApi.createStakeholder(i); refresh(); },
    deleteStakeholder: (i: any) => { demoApi.deleteStakeholder(i); refresh(); },
    createRisk: (i: any) => { demoApi.createRisk(i); refresh(); },
    deleteRisk: (i: any) => { demoApi.deleteRisk(i); refresh(); },
    createScenario: (i: any) => { demoApi.createScenario(i); refresh(); },
    deleteScenario: (i: any) => { demoApi.deleteScenario(i); refresh(); },
    updateSession: (i: any) => { demoApi.updateSession(i); refresh(); },
    analyse: (i: any) => { const r = demoApi.analyse(i); refresh(); return r; },
    listAISuggestions: (i: any) => demoApi.listAISuggestions(i),
    acceptAISuggestion: (i: any) => { demoApi.acceptAISuggestion(i); refresh(); },
    rejectAISuggestion: (i: any) => { demoApi.rejectAISuggestion(i); refresh(); },
  }), [sessionId]);
}

export function SessionPage() {
  const { slug } = useParams<{ slug: string }>();
  const [activeModule, setActiveModule] = useState<ModuleId>('problem');
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const { demoMode } = useDemoContext();

  const handleModuleChange = (id: ModuleId) => { setActiveModule(id); setActiveTool(null); };
  const handleToolChange = (id: ToolId | null) => setActiveTool(id);

  // Demo sessions use localStorage, real sessions use Supabase
  const isDemo = !slug || slug === 'demo-apac-entry' || slug.startsWith('demo-');
  if (isDemo) {
    return <DemoSessionPage slug={slug || 'demo'} activeModule={activeModule} setActiveModule={handleModuleChange} activeTool={activeTool} setActiveTool={handleToolChange} />;
  }
  return <BackendSessionPage slug={slug} activeModule={activeModule} setActiveModule={handleModuleChange} activeTool={activeTool} setActiveTool={handleToolChange} />;
}

function renderTool(toolId: ToolId, props: { sessionId?: number; data?: any; hooks?: any }) {
  switch (toolId) {
    case 'game-theory': return <GameTheoryModule {...props} />;
    case 'deep-dive': return <DeepDiveTool {...props} />;
    case 'export-advanced': return <AdvancedExportTool {...props} />;
    default: return null;
  }
}

function WorkshopInline({ data }: any) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold" style={{ color: '#0B1D3A' }}>Workshop Mode</h2>
      <p className="text-sm" style={{ color: '#64748B' }}>Use the Workshop button in the top bar to launch the full facilitated workshop experience.</p>
    </div>
  );
}

function DemoSessionPage({ slug, activeModule, setActiveModule, activeTool, setActiveTool }: { slug: string; activeModule: ModuleId; setActiveModule: (m: ModuleId) => void; activeTool: ToolId | null; setActiveTool: (t: ToolId | null) => void }) {
  const data = getDemoData();
  const hooks = useDemoHooks(data.session!.id);
  const ModuleComponent = MODULE_COMPONENTS[activeModule];
  const moduleProps = { sessionId: data.session!.id, data, hooks };

  return (
    <AppShell sessionName={data.session?.name || 'Decision Session'} sessionId={data.session!.id}
      activeModule={activeModule} onModuleChange={setActiveModule}
      activeTool={activeTool} onToolChange={setActiveTool}
      isSyncing={false} data={data}>
      
      {activeTool ? renderTool(activeTool, moduleProps) : <ModuleComponent {...moduleProps} />}
    </AppShell>
  );
}

function BackendSessionPage({ slug, activeModule, setActiveModule, activeTool, setActiveTool }: { slug: string; activeModule: ModuleId; setActiveModule: (m: ModuleId) => void; activeTool: ToolId | null; setActiveTool: (t: ToolId | null) => void }) {
  const [sessionMeta, setSessionMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    import('@/lib/supabase-client').then(({ supabase }) => {
      if (!supabase) { setLoading(false); return; }
      supabase.from('dq_sessions').select('id, name, slug').eq('slug', slug).single()
        .then(({ data }) => { setSessionMeta(data); setLoading(false); });
    });
  }, [slug]);

  const sessionData = useSessionData(sessionMeta?.id);

  if (loading || (!sessionMeta && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: DS.bg }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm" style={{ color: DS.inkSub }}>Loading session...</p>
        </div>
      </div>
    );
  }

  if (!sessionMeta) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: DS.bg }}>
        <div className="text-center">
          <p className="text-sm" style={{ color: DS.inkSub }}>Session not found.</p>
        </div>
      </div>
    );
  }

  const ModuleComponent = MODULE_COMPONENTS[activeModule];
  const moduleProps = { sessionId: sessionMeta.id, data: sessionData.data, hooks: sessionData };
  return (
    <AppShell sessionName={sessionMeta?.name || 'Session'} sessionId={sessionMeta.id}
      activeModule={activeModule} onModuleChange={setActiveModule}
      activeTool={activeTool} onToolChange={setActiveTool}
      isSyncing={sessionData.isLoading} data={sessionData.data}>
      {sessionData.isLoading
        ? <ModuleSkeleton />
        : activeTool ? renderTool(activeTool, moduleProps) : <ModuleComponent {...moduleProps} />}
    </AppShell>
  );
}

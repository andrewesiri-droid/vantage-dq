import { useState, useEffect, useMemo } from 'react';
import type { ModuleProps } from '@/types';
import { DS, ISSUE_CATEGORIES, SEVERITY_LEVELS } from '@/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle, Plus, ThumbsUp, Trash2, Eye, LayoutGrid, Flame,
  BrainCircuit, CheckCircle2, XCircle, Lightbulb, ChevronRight, ArrowRight
} from 'lucide-react';

// ============================================================================
// TYPES — 10-field structured issue
// ============================================================================
interface IssueItem {
  id: number;
  text: string;
  category: string;
  severity: string;
  status: string;
  votes: number;
  owner: string;
  impact: string;
  probability: string;
  mitigation: string;
  source: string;
}

// ============================================================================
// DEMO DATA — 12 issues across 10 categories
// ============================================================================
const DEMO_ISSUES: IssueItem[] = [
  { id: 1, text: 'Competitors (TechFlow Asia, ProcessMax) already entrenched in Singapore and Tokyo with 18-month head start', category: 'uncertainty-external', severity: 'Critical', status: 'open', votes: 5, owner: 'CSO', impact: 'Revenue delay 6-12 months, pricing pressure', probability: 'Certain', mitigation: 'Differentiate on service quality. Lock enterprise clients early with integration depth.', source: 'Market intelligence' },
  { id: 2, text: 'Local data residency requirements in Japan may force complete architecture redesign — 4-6 month delay', category: 'regulatory-trap', severity: 'Critical', status: 'open', votes: 4, owner: 'General Counsel', impact: 'Product launch delay, $2-3M additional engineering cost', probability: 'High', mitigation: 'Engage regulatory consultant by Week 2. Pre-submission meeting with authorities.', source: 'Legal review' },
  { id: 3, text: 'Partnership model preserves capital but reduces operational control and customer relationship ownership', category: 'stakeholder-concern', severity: 'High', status: 'open', votes: 3, owner: 'CEO', impact: 'Margin compression, brand dilution, limited customer insight', probability: 'High', mitigation: 'Contractual control provisions. Monthly governance reviews. Retain direct customer feedback loop.', source: 'Executive discussion' },
  { id: 4, text: 'Team has zero APAC go-to-market experience — hiring risk is existential', category: 'assumption', severity: 'Critical', status: 'open', votes: 5, owner: 'COO', impact: 'Execution failure if key hires do not perform', probability: 'Medium', mitigation: 'Executive search with APAC network. Internal transfer + local deputy. Partner GTM fallback.', source: 'HR assessment' },
  { id: 5, text: 'Regulatory approval timeline in Japan is completely unknown — could be 3 months or 18 months', category: 'information-gap', severity: 'High', status: 'open', votes: 3, owner: 'General Counsel', impact: 'Timeline uncertainty prevents reliable planning', probability: 'Unknown', mitigation: 'Commission regulatory study ($150K). Parallel-track Singapore entry as hedge.', source: 'Due diligence' },
  { id: 6, text: 'APAC TAM may be significantly larger than current $2.8B estimate — upside not captured in models', category: 'opportunity', severity: 'Medium', status: 'open', votes: 1, owner: 'CFO', impact: 'Underinvestment if market is larger than modelled', probability: 'Medium', mitigation: 'Commission independent TAM study. Build upside scenario into capital planning.', source: 'Analyst report' },
  { id: 7, text: '$25M capital ceiling is non-negotiable — Board resolution, no flexibility', category: 'constraint', severity: 'High', status: 'open', votes: 2, owner: 'CFO', impact: 'Hard budget cap across all scenarios', probability: 'Certain', mitigation: 'None — constraint is binding. All strategies must fit within ceiling.', source: 'Board resolution' },
  { id: 8, text: 'If we wait 12 months, competitive position in Singapore becomes uncatchable — TechFlow locking in enterprise clients', category: 'brutal-truth', severity: 'Critical', status: 'open', votes: 5, owner: 'CSO', impact: 'Permanent market share loss in primary market', probability: 'High', mitigation: 'Accelerate entry. Prioritise Singapore over Japan despite regulatory simplicity of Singapore.', source: 'Competitive intelligence' },
  { id: 9, text: 'Hidden regulatory requirement for local data centre in Indonesia if we expand beyond initial 3 markets', category: 'regulatory-trap', severity: 'High', status: 'open', votes: 2, owner: 'General Counsel', impact: 'Unplanned infrastructure investment for Phase 2', probability: 'Medium', mitigation: 'Include Indonesia in regulatory study scope. Architecture design for data portability.', source: 'Legal review' },
  { id: 10, text: 'Partner default could trigger reputational damage in domestic market — customers may question our execution capability', category: 'second-order', severity: 'Medium', status: 'open', votes: 1, owner: 'CEO', impact: 'Brand damage in core US market', probability: 'Low', mitigation: 'Contractual exit clauses. Public communication plan. Maintain independent track record.', source: 'Risk workshop' },
  { id: 11, text: 'Currency hedging costs not factored — AUD and JPY volatility could erode 8-15% of returns', category: 'uncertainty-internal', severity: 'Medium', status: 'open', votes: 2, owner: 'CFO', impact: 'FX-adjusted ROI may fall below hurdle rate', probability: 'High', mitigation: 'Hedge 70% of committed capital. Quarterly rebalancing. USD-denominated contracts.', source: 'Financial model' },
  { id: 12, text: 'Singapore government grants for tech entrants could offset $2-3M of setup costs — not in current financial model', category: 'option-forgotten', severity: 'Low', status: 'open', votes: 0, owner: 'CFO', impact: 'Unclaimed capital reduces effective budget constraint', probability: 'Medium', mitigation: 'Engage EDB (Economic Development Board) by Month 1. Include grants in financial model.', source: 'Desk research' },
];

const FALLBACK_CATEGORY = ISSUE_CATEGORIES[0];

const catMeta = (key: string) => ISSUE_CATEGORIES.find(c => c.key === key) || FALLBACK_CATEGORY;

const severityMeta = (s: string) => {
  const map: Record<string, { color: string; soft: string; score: number }> = {
    'Critical': { color: '#DC2626', soft: '#FEF2F2', score: 4 },
    'High': { color: '#D97706', soft: '#FFFBEB', score: 3 },
    'Medium': { color: '#2563EB', soft: '#EFF6FF', score: 2 },
    'Low': { color: '#64748B', soft: '#F1F5F9', score: 1 },
  };
  return map[s] || map['Low'];
};

// ============================================================================
// AI ANALYSIS ENGINE
// ============================================================================
function generateAIInsights(issues: IssueItem[]) {
  const insights: { type: 'critical' | 'warning' | 'info'; icon: string; title: string; body: string }[] = [];
  const openIssues = issues.filter(i => i.status === 'open');
  const criticalCount = openIssues.filter(i => i.severity === 'Critical').length;
  const highCount = openIssues.filter(i => i.severity === 'High').length;
  const coveredCats = new Set(openIssues.map(i => i.category));
  const uncovered = ISSUE_CATEGORIES.filter(c => !coveredCats.has(c.key));

  if (criticalCount >= 3) {
    insights.push({ type: 'critical', icon: 'flame', title: `${criticalCount} Critical Issues Open`, body: 'Multiple critical issues indicate high decision risk. At least 2 should be resolved or mitigated before commitment.' });
  }
  if (uncovered.length > 0) {
    insights.push({ type: 'warning', icon: 'eye', title: `${uncovered.length} Blind Spot Categories`, body: `No issues raised in: ${uncovered.slice(0, 3).map(c => c.label).join(', ')}. This does not mean these areas are safe — it may mean they have not been examined.` });
  }
  const noMitigation = openIssues.filter(i => !i.mitigation || i.mitigation.length < 10);
  if (noMitigation.length > 0) {
    insights.push({ type: 'warning', icon: 'shield', title: `${noMitigation.length} Issues Without Mitigation`, body: 'Issues without mitigation plans are unmanaged risks. Every High/Critical issue should have an owner and a mitigation approach.' });
  }
  const highVotes = [...openIssues].sort((a, b) => b.votes - a.votes).slice(0, 3);
  if (highVotes[0]?.votes >= 4) {
    insights.push({ type: 'info', icon: 'users', title: `Team Consensus: "${highVotes[0].text.slice(0, 50)}..."`, body: `This issue received ${highVotes[0].votes} votes — the highest team concern. Prioritise resolution or assign executive owner.` });
  }
  if (openIssues.filter(i => i.category === 'opportunity' || i.category === 'option-forgotten').length <= 1) {
    insights.push({ type: 'info', icon: 'lightbulb', title: 'Opportunity Scan Weak', body: 'Fewer than 2 upside issues identified. The team may be loss-averse. Consider a dedicated "opportunity brainstorm" session.' });
  }
  return insights;
}

// ============================================================================
// COMPONENT
// ============================================================================
export function IssueGeneration({ sessionId, data, hooks }: ModuleProps) {
  const [issues, setIssues] = useState<IssueItem[]>(DEMO_ISSUES);
  const [aiOpen, setAiOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  // Form state
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState('uncertainty-external');
  const [newSeverity, setNewSeverity] = useState('Medium');
  const [newOwner, setNewOwner] = useState('');
  const [newImpact, setNewImpact] = useState('');
  const [newProbability, setNewProbability] = useState('Medium');
  const [newMitigation, setNewMitigation] = useState('');
  const [newSource, setNewSource] = useState('');

  // Sync from database
  useEffect(() => {
    if (data?.issues && data.issues.length > 0) {
      setIssues(data.issues.map((i: any) => ({
        id: i.id, text: i.text, category: i.category, severity: i.severity, status: i.status || 'open', votes: i.votes || 0,
        owner: i.owner || '', impact: i.impact || '', probability: i.probability || 'Medium', mitigation: i.mitigation || '', source: i.source || '',
      })));
    }
  }, [data?.issues]);

  const addIssue = () => {
    if (!newText.trim()) return;
    const newIssue: IssueItem = {
      id: Date.now(), text: newText.trim(), category: newCategory, severity: newSeverity, status: 'open', votes: 0,
      owner: newOwner, impact: newImpact, probability: newProbability, mitigation: newMitigation, source: newSource,
    };
    setIssues(prev => [newIssue, ...prev]);
    hooks?.createIssue?.({ sessionId, text: newText.trim(), category: newCategory, severity: newSeverity });
    setNewText(''); setNewOwner(''); setNewImpact(''); setNewMitigation(''); setNewSource('');
  };

  const vote = (id: number) => {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, votes: i.votes + 1 } : i));
    hooks?.voteIssue?.({ id });
  };

  const closeIssue = (id: number) => {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status: i.status === 'closed' ? 'open' : 'closed' } : i));
  };

  const deleteIssue = (id: number) => {
    setIssues(prev => prev.filter(i => i.id !== id));
    hooks?.deleteIssue?.({ id });
  };

  const sorted = useMemo(() => [...issues].sort((a, b) => b.votes - a.votes || SEVERITY_LEVELS.indexOf(a.severity) - SEVERITY_LEVELS.indexOf(b.severity)), [issues]);
  const aiInsights = useMemo(() => generateAIInsights(issues), [issues]);

  const severityCounts = SEVERITY_LEVELS.map(s => ({ severity: s, count: issues.filter(i => i.severity === s).length }));
  const categoryCounts = ISSUE_CATEGORIES.map(c => ({ ...c, count: issues.filter(i => i.category === c.key).length })).filter(c => c.count > 0);
  const openCount = issues.filter(i => i.status === 'open').length;
  const criticalCount = issues.filter(i => i.severity === 'Critical' && i.status === 'open').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
            <AlertTriangle size={22} style={{ color: DS.warning }} /> Issue Generation
          </h2>
          <p className="text-xs mt-1" style={{ color: DS.inkSub }}>{issues.length} issues &middot; {openCount} open &middot; {criticalCount} critical &middot; {issues.reduce((s, i) => s + i.votes, 0)} team votes</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-[10px] gap-1" onClick={() => setAiOpen(!aiOpen)}>
          <BrainCircuit size={12} /> {aiOpen ? 'Hide AI Analysis' : 'AI Analysis'}
        </Button>
      </div>

      {/* AI Panel */}
      {aiOpen && (
        <Card className="border-0 shadow-md" style={{ background: `linear-gradient(135deg, #F5F3FF 0%, #FFFFFF 100%)`, borderLeft: `4px solid #7C3AED` }}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BrainCircuit size={14} style={{ color: '#7C3AED' }} />
              <span className="text-xs font-bold" style={{ color: '#6D28D9' }}>AI Issue Analysis</span>
              <Badge variant="outline" className="text-[9px] h-4 ml-auto" style={{ color: '#7C3AED', borderColor: '#DDD6FE' }}>{aiInsights.length} insights</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {aiInsights.map((insight, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: insight.type === 'critical' ? '#FEF2F2' : insight.type === 'warning' ? '#FFFBEB' : '#F0FDFA' }}>
                  {insight.type === 'critical' ? <XCircle size={12} style={{ color: '#DC2626', marginTop: 2 }} /> : insight.type === 'warning' ? <AlertTriangle size={12} style={{ color: '#D97706', marginTop: 2 }} /> : <Lightbulb size={12} style={{ color: '#059669', marginTop: 2 }} />}
                  <div>
                    <p className="text-[10px] font-semibold" style={{ color: insight.type === 'critical' ? '#DC2626' : insight.type === 'warning' ? '#D97706' : '#059669' }}>{insight.title}</p>
                    <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: DS.inkSub }}>{insight.body}</p>
                  </div>
                </div>
              ))}
              {aiInsights.length === 0 && <p className="text-xs" style={{ color: '#059669' }}>All clear. No critical patterns detected.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Issue Card */}
      <Card className="border-0 shadow-md" style={{ background: `linear-gradient(135deg, #FEF3C7 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid ${DS.warning}` }}>
        <CardContent className="pt-4 space-y-2">
          <Textarea value={newText} onChange={e => setNewText(e.target.value)} placeholder="What could go wrong? What is uncertain? What are we assuming? State the issue as a clear, specific concern." className="text-xs bg-white" rows={2} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>{ISSUE_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key} className="text-xs">{c.icon} {c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={newSeverity} onValueChange={setNewSeverity}>
              <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>{SEVERITY_LEVELS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={newOwner} onChange={e => setNewOwner(e.target.value)} placeholder="Owner" className="h-8 text-[10px] bg-white" />
            <Select value={newProbability} onValueChange={setNewProbability}>
              <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Probability" /></SelectTrigger>
              <SelectContent>{['Certain', 'High', 'Medium', 'Low', 'Unknown'].map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Textarea value={newImpact} onChange={e => setNewImpact(e.target.value)} placeholder="Impact if this issue materialises" className="text-[10px] bg-white" rows={1} />
            <Textarea value={newMitigation} onChange={e => setNewMitigation(e.target.value)} placeholder="Mitigation approach" className="text-[10px] bg-white" rows={1} />
          </div>
          <div className="flex gap-2">
            <Input value={newSource} onChange={e => setNewSource(e.target.value)} placeholder="Source (e.g. Market intelligence, Legal review)" className="text-[10px] bg-white h-8 flex-1" />
            <Button size="sm" className="h-8 text-[10px] gap-1 shrink-0" onClick={addIssue} disabled={!newText.trim()} style={{ background: DS.warning }}>
              <Plus size={12} /> Add Issue
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="text-[10px]">
          <TabsTrigger value="list" className="text-[10px] gap-1"><LayoutGrid size={10} /> Issue List ({openCount})</TabsTrigger>
          <TabsTrigger value="heatmap" className="text-[10px] gap-1"><Flame size={10} /> Severity Map</TabsTrigger>
          <TabsTrigger value="blindspots" className="text-[10px] gap-1"><Eye size={10} /> Blind Spots</TabsTrigger>
        </TabsList>

        {/* LIST TAB */}
        <TabsContent value="list" className="mt-3 space-y-2">
          {sorted.map(issue => {
            const c = catMeta(issue.category);
            const sev = severityMeta(issue.severity);
            const isClosed = issue.status === 'closed';
            return (
              <Card key={issue.id} className={`overflow-hidden transition-all border-0 shadow-sm ${isClosed ? 'opacity-40' : ''}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: c.soft, color: c.color }}>{c.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: DS.ink }}>{issue.text}</span>
                        <Badge style={{ background: c.soft, color: c.color, borderColor: c.color + '30' }} variant="outline" className="text-[9px] h-4 px-1">{c.short}</Badge>
                        <Badge style={{ background: sev.soft, color: sev.color, borderColor: sev.color + '30' }} variant="outline" className="text-[9px] h-4 px-1">{issue.severity}</Badge>
                        {issue.votes >= 4 && <Badge variant="outline" className="text-[8px] h-4" style={{ color: '#DC2626', borderColor: '#FECACA' }}><Flame size={8} /> Hot</Badge>}
                      </div>
                      {/* 10-field metadata row */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {issue.owner && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: DS.bg, color: DS.inkSub }}>Owner: {issue.owner}</span>}
                        {issue.probability && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: DS.bg, color: DS.inkSub }}>P: {issue.probability}</span>}
                        {issue.impact && <span className="text-[10px] px-1.5 py-0.5 rounded truncate max-w-[200px]" style={{ background: DS.bg, color: DS.inkSub }} title={issue.impact}>Impact: {issue.impact}</span>}
                      </div>
                      {issue.mitigation && <p className="text-[10px] mt-1.5 p-1.5 rounded" style={{ background: '#F0FDFA', color: '#065F46' }}><strong>Mitigation:</strong> {issue.mitigation}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <button onClick={() => vote(issue.id)} className="flex items-center gap-1 text-[10px] transition-colors hover:text-blue-600" style={{ color: DS.inkTer }}><ThumbsUp size={10} /> {issue.votes}</button>
                        <button onClick={() => closeIssue(issue.id)} className="text-[10px]" style={{ color: isClosed ? '#059669' : DS.inkTer }}>{isClosed ? 'Reopen' : 'Close'}</button>
                        <button onClick={() => deleteIssue(issue.id)} className="text-gray-400 hover:text-red-500 text-[10px]"><Trash2 size={10} /></button>
                        {issue.source && <span className="text-[9px] ml-auto" style={{ color: DS.inkDis }}>Source: {issue.source}</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* HEATMAP TAB */}
        <TabsContent value="heatmap" className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardContent className="pt-5">
              <p className="text-xs font-bold mb-3" style={{ color: DS.ink }}>Severity Distribution</p>
              {severityCounts.map(s => (
                <div key={s.severity} className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] w-14 font-medium" style={{ color: DS.inkSub }}>{s.severity}</span>
                  <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${issues.length ? (s.count / issues.length) * 100 : 0}%`, background: s.severity === 'Critical' ? '#EF4444' : s.severity === 'High' ? '#F59E0B' : s.severity === 'Medium' ? '#3B82F6' : '#94A3B8' }} />
                  </div>
                  <span className="text-[10px] font-bold w-4 text-right" style={{ color: DS.ink }}>{s.count}</span>
                </div>
              ))}
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <p className="text-xs font-bold mb-3" style={{ color: DS.ink }}>Category Coverage</p>
              <div className="grid grid-cols-2 gap-2">
                {ISSUE_CATEGORIES.map(c => {
                  const count = issues.filter(i => i.category === c.key).length;
                  return (
                    <div key={c.key} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: count > 0 ? c.soft : '#F8FAFC', opacity: count > 0 ? 1 : 0.5 }}>
                      <span className="text-[10px] font-bold" style={{ color: count > 0 ? c.color : '#94A3B8' }}>{count}</span>
                      <span className="text-[10px]" style={{ color: count > 0 ? c.color : '#94A3B8' }}>{c.short}</span>
                      <span className="text-[9px] ml-auto" style={{ color: '#94A3B8' }}>{c.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* BLINDSPOTS TAB */}
        <TabsContent value="blindspots" className="mt-3">
          <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, #F5F3FF 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid #7C3AED` }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3"><Eye size={14} style={{ color: '#7C3AED' }} /><span className="text-xs font-bold" style={{ color: '#6D28D9' }}>Blind Spot Analysis</span></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ISSUE_CATEGORIES.map(c => {
                  const count = issues.filter(i => i.category === c.key).length;
                  const hasIssues = count > 0;
                  return (
                    <div key={c.key} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: hasIssues ? c.soft : '#F8FAFC' }}>
                      <span className="text-[10px] font-bold w-5 text-center" style={{ color: hasIssues ? c.color : '#94A3B8' }}>{hasIssues ? <CheckCircle2 size={12} /> : <XCircle size={12} />}</span>
                      <span className="text-[10px] font-medium" style={{ color: hasIssues ? c.color : '#94A3B8' }}>{c.label}</span>
                      <Badge variant="outline" className="text-[8px] h-4 ml-auto" style={{ color: hasIssues ? '#059669' : '#D97706', borderColor: hasIssues ? '#A7F3D0' : '#FDE68A' }}>{hasIssues ? `${count} issues` : 'No issues'}</Badge>
                    </div>
                  );
                })}
              </div>
              {issues.filter(i => !i.mitigation).length > 0 && (
                <div className="mt-3 p-2 rounded-lg" style={{ background: '#FEF2F2' }}>
                  <p className="text-[10px] font-semibold" style={{ color: '#DC2626' }}><AlertTriangle size={10} className="inline mr-1" /> {issues.filter(i => !i.mitigation).length} issues have no mitigation plan</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS, ISSUE_CATEGORIES, SEVERITY_LEVELS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Plus, ThumbsUp, Trash2, Filter, AlertTriangle, Eye, ChevronRight, Lightbulb, ArrowRight } from 'lucide-react';

interface IssueItem {
  id: number; text: string; category: string; severity: string;
  status: string; votes: number; owner?: string; description?: string;
}

const SEV_COLORS: Record<string, { color: string; soft: string; label: string }> = {
  Critical: { color: DS.danger, soft: DS.dangerSoft, label: 'CRITICAL' },
  High:     { color: DS.warning, soft: DS.warnSoft, label: 'HIGH' },
  Medium:   { color: '#64748B', soft: '#F1F5F9', label: 'MEDIUM' },
  Low:      { color: DS.inkDis, soft: DS.bg, label: 'LOW' },
};

const CAT_ICONS: Record<string, string> = {
  'uncertainty-external': '🌊', 'uncertainty-internal': '⚙️',
  'stakeholder-concern': '👥', 'assumption': '💭',
  'information-gap': '📊', 'opportunity': '✦',
  'constraint': '🔒', 'brutal-truth': '⚡',
  'regulatory-trap': '⚠️', 'second-order': '🔗',
  'black-swan': '🦢', 'focus-decision': '🎯',
  'option-forgotten': '💡',
};

const TABS = [
  { id: 'raise', num: '1', label: 'Raise Issues' },
  { id: 'categorise', num: '2', label: 'Categorise' },
  { id: 'heatmap', num: '3', label: 'Heat Map' },
  { id: 'blindspots', num: '4', label: 'Blind Spots' },
];

const DQ_PRINCIPLES: Record<string, string> = {
  raise: 'Issue raising is most effective when separated from issue solving. The goal here is quantity and honesty — surface everything before filtering anything. Brutal truths and forgotten options are the most valuable issues.',
  categorise: 'Categorisation reveals patterns. A good issue list has representation across all 12 DQ categories. Heavy concentration in one category is often a signal that the team has a blind spot in others.',
  heatmap: 'The heat map shows where risk is concentrated. High-severity + high-vote issues are the ones that could derail the decision. These need owners and mitigations before commitment.',
  blindspots: 'AI blind spot analysis identifies categories that are systematically underrepresented. The most dangerous issues are often the ones no one thought to raise.',
};

export function IssueGeneration({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [activeTab, setActiveTab] = useState('raise');
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState('uncertainty-external');
  const [newSev, setNewSev] = useState('High');
  const [filterSev, setFilterSev] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [blindSpots, setBlindSpots] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (data?.issues?.length) {
      setIssues(data.issues.map((i: any) => ({
        id: i.id, text: i.text, category: i.category,
        severity: i.severity, status: i.status || 'open',
        votes: i.votes || 0, owner: i.owner || '', description: i.description || '',
      })));
    }
  }, [data?.issues]);

  const add = () => {
    if (!newText.trim()) return;
    const n: IssueItem = { id: Date.now(), text: newText.trim(), category: newCat, severity: newSev, status: 'open', votes: 0 };
    setIssues(p => [n, ...p]);
    hooks?.createIssue?.({ sessionId, text: newText.trim(), category: newCat, severity: newSev });
    setNewText('');
  };

  const remove = (id: number) => { setIssues(p => p.filter(i => i.id !== id)); hooks?.deleteIssue?.({ id }); };
  const vote = (id: number) => { setIssues(p => p.map(i => i.id === id ? { ...i, votes: i.votes + 1 } : i)); hooks?.voteIssue?.({ id }); };
  const promote = (issue: IssueItem) => {
    hooks?.createDecision?.({ sessionId, label: issue.text, choices: ['Option A', 'Option B', 'Option C'], tier: 'focus' });
    setIssues(p => p.map(i => i.id === issue.id ? { ...i, category: 'focus-decision' } : i));
  };

  const aiGenerate = () => {
    setGenerating(true);
    const s = data?.session || {};
    const existing = issues.slice(0, 8).map(i => i.text).join('; ');
    const prompt = `Generate 10 high-quality DQ issues for this decision.\nDecision: "${s.decisionStatement || ''}"\nContext: ${(s.context || '').slice(0, 250)}\nConstraints: ${s.constraints || ''}\nExisting issues (do not duplicate): ${existing}\n\nReturn JSON: { issues: [{text, category (from: uncertainty-external, uncertainty-internal, stakeholder-concern, assumption, information-gap, opportunity, constraint, brutal-truth, regulatory-trap, second-order, black-swan, focus-decision), severity (Critical/High/Medium/Low), owner, description}] }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { setGenerating(false); return; } }
      const newIssues = (result?.issues || []).map((i: any, idx: number) => ({
        id: Date.now() + idx, text: i.text || '', category: i.category || 'uncertainty-external',
        severity: i.severity || 'High', status: 'open', votes: 0,
        owner: i.owner || '', description: i.description || '',
      }));
      setIssues(p => [...p, ...newIssues]);
      newIssues.forEach((i: any) => hooks?.createIssue?.({ sessionId, text: i.text, category: i.category, severity: i.severity }));
      setGenerating(false);
    });
  };

  const aiCategorise = () => {
    const issueList = issues.map(i => `"${i.text}" [current: ${i.category}]`).join('\n');
    const prompt = `Review and re-categorise these issues for accuracy.\nIssues:\n${issueList}\n\nReturn JSON: { reclassifications: [{id (original array index 0-based), text, suggestedCategory, reason}] }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
      (result?.reclassifications || []).forEach((rc: any) => {
        if (rc.id >= 0 && rc.id < issues.length) {
          setIssues(p => p.map((issue, idx) => idx === rc.id ? { ...issue, category: rc.suggestedCategory } : issue));
        }
      });
    });
  };

  const aiBlindSpots = () => {
    const cats = [...new Set(issues.map(i => i.category))];
    const prompt = `Analyse this issue list for blind spots.\nDecision: ${data?.session?.decisionStatement || ''}\nIssues (${issues.length}): ${issues.map(i => `[${i.category}/${i.severity}] ${i.text}`).join('; ')}\nCategories present: ${cats.join(', ')}\n\nReturn JSON: { coverageScore: 0-100, coverageSummary: string, missingCategories: [{category, title, why, exampleIssue, severity}], patternInsight: string, topBlindSpot: string }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
      if (result && !result.error) { setBlindSpots(result); setActiveTab('blindspots'); }
    });
  };

  // Stats
  const critCount = issues.filter(i => i.severity === 'Critical').length;
  const highCount = issues.filter(i => i.severity === 'High').length;
  const focusCount = issues.filter(i => i.category === 'focus-decision').length;
  const openCount = issues.filter(i => i.status === 'open').length;

  // Filtered list
  const filtered = issues.filter(i =>
    (filterSev === 'all' || i.severity === filterSev) &&
    (filterCat === 'all' || i.category === filterCat)
  ).sort((a, b) => b.votes - a.votes || (b.severity === 'Critical' ? 1 : 0) - (a.severity === 'Critical' ? 1 : 0));

  // Category counts for filter bar
  const catCounts = ISSUE_CATEGORIES.reduce((acc, c) => {
    acc[c.key] = issues.filter(i => i.category === c.key).length;
    return acc;
  }, {} as Record<string, number>);

  // Heat map data
  const heatMap = SEVERITY_LEVELS.map(sev => ({
    sev,
    cats: ISSUE_CATEGORIES.filter(c => issues.some(i => i.severity === sev && i.category === c.key)).map(c => ({
      ...c,
      issues: issues.filter(i => i.severity === sev && i.category === c.key),
    })),
  })).filter(r => r.cats.length > 0);

  return (
    <div className="space-y-0">
      {/* Module header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-black px-2 py-1 rounded text-white" style={{ background: DS.warning }}>02</span>
            <h2 className="text-lg font-bold" style={{ color: DS.ink }}>Issue Raising & Categorisation</h2>
          </div>
        </div>
        {/* Stats badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge style={{ background: DS.bg, color: DS.inkSub, border: `1px solid ${DS.border}` }}>{issues.length} TOTAL</Badge>
          {critCount > 0 && <Badge style={{ background: DS.dangerSoft, color: DS.danger, border: 'none' }}>{critCount} CRITICAL</Badge>}
          {highCount > 0 && <Badge style={{ background: DS.warnSoft, color: DS.warning, border: 'none' }}>{highCount} HIGH</Badge>}
          {focusCount > 0 && <Badge style={{ background: DS.accentSoft, color: DS.accent, border: 'none' }}>{focusCount} FOCUS DECISIONS</Badge>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiCategorise} disabled={busy || !issues.length}>
            <Sparkles size={11} /> AI Categorise
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.warning }} onClick={aiGenerate} disabled={busy || generating}>
            <Sparkles size={11} /> {generating ? 'Generating…' : 'AI Generate'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-4" style={{ borderColor: DS.borderLight }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium relative transition-colors"
            style={{ color: activeTab === tab.id ? DS.warning : DS.inkTer, borderBottom: activeTab === tab.id ? `2px solid ${DS.warning}` : '2px solid transparent', marginBottom: -1 }}>
            <span className="text-[9px] font-bold opacity-60">{tab.num}.</span> {tab.label}
            {tab.id === 'raise' && issues.length > 0 && (
              <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: DS.warning, color: '#fff' }}>{issues.length}</span>
            )}
            {tab.id === 'blindspots' && blindSpots && <span className="w-1.5 h-1.5 rounded-full ml-1" style={{ background: DS.danger }} />}
          </button>
        ))}
      </div>

      {/* === TAB: RAISE ISSUES === */}
      {activeTab === 'raise' && (
        <div className="space-y-3">
          {/* Add issue row */}
          <div className="flex gap-2 items-center p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
            <Input value={newText} onChange={e => setNewText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
              placeholder="Describe an issue, decision, uncertainty, assumption, or opportunity…"
              className="flex-1 text-xs h-8 bg-white" />
            <Select value={newCat} onValueChange={setNewCat}>
              <SelectTrigger className="h-8 text-[10px] bg-white w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{ISSUE_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={newSev} onValueChange={setNewSev}>
              <SelectTrigger className="h-8 text-[10px] bg-white w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{SEVERITY_LEVELS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" className="h-8 px-3 gap-1 text-xs shrink-0" style={{ background: DS.warning }} onClick={add} disabled={!newText.trim()}>
              <Plus size={12} /> Add
            </Button>
          </div>

          {/* Category filter chips */}
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFilterCat('all')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
              style={{ background: filterCat === 'all' ? DS.ink : DS.bg, color: filterCat === 'all' ? '#fff' : DS.inkSub, border: `1px solid ${filterCat === 'all' ? DS.ink : DS.border}` }}>
              <Filter size={9} /> All
            </button>
            {ISSUE_CATEGORIES.filter(c => catCounts[c.key] > 0).map(c => (
              <button key={c.key} onClick={() => setFilterCat(filterCat === c.key ? 'all' : c.key)}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all"
                style={{ background: filterCat === c.key ? c.color : DS.bg, color: filterCat === c.key ? '#fff' : DS.inkSub, border: `1px solid ${filterCat === c.key ? c.color : DS.border}` }}>
                <span>{CAT_ICONS[c.key] || '●'}</span> ({catCounts[c.key]})
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              {SEVERITY_LEVELS.map(s => (
                <button key={s} onClick={() => setFilterSev(filterSev === s ? 'all' : s)}
                  className="px-2 py-1 rounded text-[9px] font-bold transition-all"
                  style={{ background: filterSev === s ? SEV_COLORS[s]?.color : DS.bg, color: filterSev === s ? '#fff' : DS.inkSub, border: `1px solid ${filterSev === s ? SEV_COLORS[s]?.color : DS.border}` }}>
                  {s}
                </button>
              ))}
              <span className="text-[9px] ml-1" style={{ color: DS.inkDis }}>{filtered.length} shown</span>
            </div>
          </div>

          {/* Issue list */}
          <div className="space-y-1.5">
            {filtered.map(issue => {
              const cat = ISSUE_CATEGORIES.find(c => c.key === issue.category);
              const sev = SEV_COLORS[issue.severity] || SEV_COLORS.Medium;
              return (
                <div key={issue.id} className="flex items-stretch rounded-xl overflow-hidden transition-all"
                  style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}`, opacity: issue.status === 'closed' ? 0.5 : 1 }}>
                  {/* Vote column */}
                  <button onClick={() => vote(issue.id)} className="flex flex-col items-center justify-center px-3 py-3 transition-colors hover:bg-gray-50 shrink-0" style={{ borderRight: `1px solid ${DS.borderLight}`, minWidth: 44 }}>
                    <span className="text-[9px]">▲</span>
                    <span className="text-sm font-black" style={{ color: issue.votes > 0 ? DS.accent : DS.inkDis }}>{issue.votes}</span>
                  </button>
                  {/* Severity stripe */}
                  <div className="w-1 shrink-0" style={{ background: sev.color }} />
                  {/* Content */}
                  <div className="flex-1 px-3 py-2.5 min-w-0">
                    <p className="text-xs font-medium mb-1.5" style={{ color: DS.ink, textDecoration: issue.status === 'closed' ? 'line-through' : 'none' }}>{issue.text}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {cat && (
                        <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: cat.soft, color: cat.color }}>
                          {CAT_ICONS[issue.category] || ''} {cat.label.toUpperCase()}
                        </span>
                      )}
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: sev.soft, color: sev.color }}>{sev.label}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: DS.bg, color: DS.inkDis }}>OPEN</span>
                      {issue.owner && <span className="text-[9px]" style={{ color: DS.inkDis }}>◎ {issue.owner}</span>}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 px-2 shrink-0">
                    {issue.category !== 'focus-decision' && (
                      <button onClick={() => promote(issue)} title="Promote to Hierarchy" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: DS.accent }}>
                        <ArrowRight size={13} />
                      </button>
                    )}
                    <button onClick={() => remove(issue.id)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                      <Trash2 size={13} style={{ color: DS.inkDis }} />
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 rounded-xl" style={{ background: DS.bg }}>
                <AlertTriangle size={28} className="mx-auto mb-2 opacity-20" style={{ color: DS.warning }} />
                <p className="text-xs font-medium" style={{ color: DS.inkSub }}>No issues yet — use AI Generate or add manually above</p>
              </div>
            )}
          </div>
          <DQPrinciple text={DQ_PRINCIPLES.raise} color={DS.warning} />
        </div>
      )}

      {/* === TAB: CATEGORISE === */}
      {activeTab === 'categorise' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>Review and adjust the category for each issue. Click AI Categorise to let AI suggest recategorisations.</p>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiCategorise} disabled={busy}>
              <Sparkles size={11} /> AI Categorise
            </Button>
          </div>
          {ISSUE_CATEGORIES.map(cat => {
            const catIssues = issues.filter(i => i.category === cat.key);
            if (catIssues.length === 0) return null;
            return (
              <div key={cat.key}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{CAT_ICONS[cat.key]}</span>
                  <span className="text-xs font-bold" style={{ color: cat.color }}>{cat.label}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold text-white" style={{ background: cat.color }}>{catIssues.length}</span>
                </div>
                <div className="space-y-1 pl-5 border-l-2 mb-3" style={{ borderColor: cat.soft }}>
                  {catIssues.map(issue => {
                    const sev = SEV_COLORS[issue.severity] || SEV_COLORS.Medium;
                    return (
                      <div key={issue.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: DS.bg }}>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: sev.soft, color: sev.color }}>{issue.severity}</span>
                        <span className="text-xs flex-1 min-w-0 truncate" style={{ color: DS.ink }}>{issue.text}</span>
                        <Select value={issue.category} onValueChange={v => setIssues(p => p.map(i => i.id === issue.id ? { ...i, category: v } : i))}>
                          <SelectTrigger className="h-6 text-[9px] w-36 shrink-0"><SelectValue /></SelectTrigger>
                          <SelectContent>{ISSUE_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <DQPrinciple text={DQ_PRINCIPLES.categorise} color={DS.warning} />
        </div>
      )}

      {/* === TAB: HEAT MAP === */}
      {activeTab === 'heatmap' && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: DS.inkSub }}>Issues mapped by severity. Highest severity + most votes = highest priority for mitigation.</p>
          {heatMap.length === 0 ? (
            <div className="text-center py-12" style={{ color: DS.inkDis }}>
              <p className="text-xs">Add issues to see the heat map</p>
            </div>
          ) : (
            heatMap.map(row => {
              const sev = SEV_COLORS[row.sev] || SEV_COLORS.Medium;
              return (
                <div key={row.sev}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: sev.color }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: sev.color }}>{row.sev}</span>
                    <span className="text-[9px]" style={{ color: DS.inkDis }}>{row.cats.reduce((a, c) => a + c.issues.length, 0)} issues</span>
                  </div>
                  <div className="grid gap-1.5 pl-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                    {row.cats.flatMap(c => c.issues).sort((a, b) => b.votes - a.votes).map(issue => {
                      const cat = ISSUE_CATEGORIES.find(c => c.key === issue.category);
                      return (
                        <div key={issue.id} className="p-2.5 rounded-xl text-xs" style={{ background: sev.soft, borderLeft: `3px solid ${sev.color}` }}>
                          <div className="font-medium mb-1" style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, color: DS.ink }}>{issue.text}</div>
                          <div className="flex items-center gap-1.5">
                            {cat && <span className="text-[8px]" style={{ color: cat.color }}>{CAT_ICONS[issue.category]}</span>}
                            {issue.votes > 0 && <span className="text-[9px] font-bold" style={{ color: DS.accent }}>▲ {issue.votes}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
          <DQPrinciple text={DQ_PRINCIPLES.heatmap} color={DS.warning} />
        </div>
      )}

      {/* === TAB: BLIND SPOTS === */}
      {activeTab === 'blindspots' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>AI analysis of which issue categories are missing or underrepresented in your list.</p>
            <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.warning }} onClick={aiBlindSpots} disabled={busy}>
              <Sparkles size={11} /> {busy ? 'Analysing…' : 'Find Blind Spots'}
            </Button>
          </div>

          {!blindSpots ? (
            <div className="text-center py-14 rounded-xl" style={{ background: DS.bg }}>
              <Eye size={32} className="mx-auto mb-3 opacity-20" style={{ color: DS.warning }} />
              <p className="text-sm font-medium mb-1" style={{ color: DS.ink }}>AI Blind Spot Analysis</p>
              <p className="text-xs max-w-sm mx-auto mb-4" style={{ color: DS.inkTer }}>Analyses your issue list against all 12 DQ categories and flags what's missing.</p>
              <Button style={{ background: DS.warning }} onClick={aiBlindSpots} disabled={busy} className="gap-2">
                <Eye size={14} /> Find Blind Spots
              </Button>
            </div>
          ) : (
            <>
              {/* Coverage score */}
              <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: DS.warnSoft, border: `1px solid ${DS.warning}30` }}>
                <div className="text-4xl font-black" style={{ color: blindSpots.coverageScore >= 70 ? DS.success : blindSpots.coverageScore >= 45 ? DS.warning : DS.danger }}>
                  {blindSpots.coverageScore}
                </div>
                <div>
                  <div className="text-sm font-bold mb-0.5" style={{ color: DS.ink }}>Issue Coverage Score</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{blindSpots.coverageSummary}</p>
                  {blindSpots.topBlindSpot && <p className="text-xs mt-1 font-semibold" style={{ color: DS.danger }}>Top blind spot: {blindSpots.topBlindSpot}</p>}
                </div>
              </div>

              {/* Missing categories */}
              {blindSpots.missingCategories?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>Missing or Underrepresented Categories</p>
                  {blindSpots.missingCategories.map((mc: any, i: number) => {
                    const cat = ISSUE_CATEGORIES.find(c => c.key === mc.category || c.label.toLowerCase().includes((mc.category || '').toLowerCase()));
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: cat?.soft || DS.bg }}>
                          {CAT_ICONS[mc.category] || '●'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold" style={{ color: DS.ink }}>{mc.title || mc.category}</span>
                            <Badge style={{ background: SEV_COLORS[mc.severity]?.soft || DS.bg, color: SEV_COLORS[mc.severity]?.color || DS.inkSub, border: 'none', fontSize: 9 }}>{mc.severity}</Badge>
                          </div>
                          <p className="text-[10px] mb-1.5" style={{ color: DS.inkSub }}>{mc.why}</p>
                          {mc.exampleIssue && (
                            <div className="text-[9px] px-2 py-1 rounded" style={{ background: DS.bg, color: DS.inkTer }}>
                              e.g. "{mc.exampleIssue}"
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="outline" className="h-6 text-[9px] shrink-0 gap-1" onClick={() => {
                          setNewText(mc.exampleIssue || mc.title || '');
                          setNewCat(mc.category || 'uncertainty-external');
                          setNewSev(mc.severity || 'High');
                          setActiveTab('raise');
                        }}>
                          <Plus size={9} /> Add
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {blindSpots.patternInsight && (
                <div className="p-3 rounded-xl" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.accent }}>Pattern Insight</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{blindSpots.patternInsight}</p>
                </div>
              )}
            </>
          )}
          <DQPrinciple text={DQ_PRINCIPLES.blindspots} color={DS.warning} />
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: DS.inkDis }}>
          <span>{issues.length} issues raised</span>
          <span>·</span>
          <span style={{ color: critCount > 0 ? DS.danger : DS.inkDis }}>{critCount} critical</span>
          <span>·</span>
          <span>{openCount} open</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={aiBlindSpots} disabled={busy || !issues.length}>
            <Eye size={11} /> Check Blind Spots
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" style={{ background: DS.warning }}
            onClick={() => setActiveTab(TABS[Math.min(TABS.findIndex(t => t.id === activeTab) + 1, TABS.length - 1)].id)}>
            Next <ChevronRight size={11} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function DQPrinciple({ text, color = DS.frame.fill }: { text: string; color?: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl mt-2" style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
      <Lightbulb size={14} style={{ color, flexShrink: 0, marginTop: 2 }} />
      <div>
        <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color }}>DQ PRINCIPLE</div>
        <p className="text-[11px] leading-relaxed" style={{ color: DS.inkSub }}>{text}</p>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS, ISSUE_CATEGORIES, SEVERITY_LEVELS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Plus, ThumbsUp, Trash2, Eye, LayoutGrid, Flame } from 'lucide-react';

interface IssueItem { id: number; text: string; category: string; severity: string; status: string; votes: number; }

const DEMO_ISSUES: IssueItem[] = [
  { id: 1, text: 'Competitors already entrenched in Singapore and Tokyo', category: 'uncertainty-external', severity: 'High', status: 'open', votes: 3 },
  { id: 2, text: 'Local data residency requirements may force architecture changes', category: 'uncertainty-internal', severity: 'High', status: 'open', votes: 2 },
  { id: 3, text: 'Partnership model preserves capital but reduces control', category: 'stakeholder-concern', severity: 'Medium', status: 'open', votes: 1 },
  { id: 4, text: 'Team has no APAC go-to-market experience', category: 'assumption', severity: 'Critical', status: 'open', votes: 5 },
  { id: 5, text: 'Regulatory approval timeline in Japan is unknown', category: 'information-gap', severity: 'High', status: 'open', votes: 2 },
  { id: 6, text: 'APAC TAM may be larger than current estimates', category: 'opportunity', severity: 'Medium', status: 'open', votes: 1 },
  { id: 7, text: '$25M capital ceiling is non-negotiable', category: 'constraint', severity: 'High', status: 'open', votes: 0 },
  { id: 8, text: 'If we wait 12 months, competitors will be uncatchable', category: 'brutal-truth', severity: 'Critical', status: 'open', votes: 4 },
  { id: 9, text: 'Hidden regulatory requirement for local data centre in Indonesia', category: 'regulatory-trap', severity: 'High', status: 'open', votes: 3 },
  { id: 10, text: 'Partner default could trigger reputational damage in other markets', category: 'second-order', severity: 'Medium', status: 'open', votes: 1 },
];

export function IssueGeneration({ sessionId, data, hooks }: ModuleProps) {
  const [issues, setIssues] = useState<IssueItem[]>(DEMO_ISSUES);
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState('uncertainty-external');
  const [newSeverity, setNewSeverity] = useState('Medium');

  // Sync from database
  useEffect(() => {
    if (data?.issues && data.issues.length > 0) {
      setIssues(data.issues.map((i: any) => ({
        id: i.id, text: i.text, category: i.category, severity: i.severity, status: i.status, votes: i.votes,
      })));
    }
  }, [data?.issues]);

  const addIssue = () => {
    if (!newText.trim() || !sessionId) return;
    const newIssue: IssueItem = { id: Date.now(), text: newText.trim(), category: newCategory, severity: newSeverity, status: 'open', votes: 0 };
    setIssues(prev => [newIssue, ...prev]);
    hooks?.createIssue?.({ sessionId, text: newText.trim(), category: newCategory, severity: newSeverity });
    setNewText('');
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

  const sorted = [...issues].sort((a, b) => b.votes - a.votes || SEVERITY_LEVELS.indexOf(a.severity) - SEVERITY_LEVELS.indexOf(b.severity));
  const catMeta = (key: string) => ISSUE_CATEGORIES.find(c => c.key === key)!;

  const severityCounts = SEVERITY_LEVELS.map(s => ({ severity: s, count: issues.filter(i => i.severity === s).length }));
  const categoryCounts = ISSUE_CATEGORIES.map(c => ({ ...c, count: issues.filter(i => i.category === c.key).length })).filter(c => c.count > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
            <AlertTriangle size={22} style={{ color: DS.warning }} /> Issue Generation
          </h2>
          <p className="text-xs mt-1" style={{ color: DS.inkSub }}>{issues.length} issues &middot; {issues.filter(i => i.status === 'open').length} open &middot; {issues.filter(i => i.severity === 'Critical').length} critical</p>
        </div>
      </div>

      <Card className="border-0 shadow-md" style={{ background: `linear-gradient(135deg, #FEF3C7 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid ${DS.warning}` }}>
        <CardContent className="pt-4 space-y-2">
          <Textarea value={newText} onChange={e => setNewText(e.target.value)} placeholder="What could go wrong? What is uncertain? What are we assuming?" className="text-xs bg-white" rows={2} />
          <div className="flex gap-2">
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-[160px] h-8 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>{ISSUE_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key} className="text-xs">{c.icon} {c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={newSeverity} onValueChange={setNewSeverity}>
              <SelectTrigger className="w-[100px] h-8 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>{SEVERITY_LEVELS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" className="ml-auto h-8 text-[10px] gap-1" onClick={addIssue} disabled={!newText.trim()} style={{ background: DS.warning }}>
              <Plus size={12} /> Add Issue
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="list">
        <TabsList className="text-[10px]">
          <TabsTrigger value="list" className="text-[10px] gap-1"><LayoutGrid size={10} /> Issue List</TabsTrigger>
          <TabsTrigger value="heatmap" className="text-[10px] gap-1"><Flame size={10} /> Heatmap</TabsTrigger>
          <TabsTrigger value="blindspots" className="text-[10px] gap-1"><Eye size={10} /> Blind Spots</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-3 space-y-2">
          {sorted.map(issue => {
            const c = catMeta(issue.category);
            return (
              <Card key={issue.id} className={`overflow-hidden transition-all border-0 shadow-sm ${issue.status === 'closed' ? 'opacity-40' : ''}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: c.soft, color: c.color }}>{c.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: DS.ink }}>{issue.text}</span>
                        <Badge style={{ background: c.soft, color: c.color, borderColor: c.color + '30' }} variant="outline" className="text-[9px] h-4 px-1">{c.short}</Badge>
                        <Badge style={{ background: issue.severity === 'Critical' ? '#FEF2F2' : issue.severity === 'High' ? '#FEF3C7' : '#F1F5F9', color: issue.severity === 'Critical' ? '#DC2626' : issue.severity === 'High' ? '#D97706' : '#64748B' }} variant="outline" className="text-[9px] h-4 px-1">{issue.severity}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <button onClick={() => vote(issue.id)} className="flex items-center gap-1 text-[10px] transition-colors hover:text-blue-600" style={{ color: DS.inkTer }}><ThumbsUp size={10} /> {issue.votes}</button>
                        <button onClick={() => closeIssue(issue.id)} className="text-[10px]" style={{ color: issue.status === 'closed' ? '#059669' : DS.inkTer }}>{issue.status === 'closed' ? 'Reopen' : 'Close'}</button>
                        <button onClick={() => deleteIssue(issue.id)} className="text-[10px] text-gray-400 hover:text-red-500"><Trash2 size={10} /></button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="heatmap" className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardContent className="pt-5">
              <p className="text-xs font-bold mb-3" style={{ color: DS.ink }}>Issues by Severity</p>
              {severityCounts.map(s => (
                <div key={s.severity} className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] w-14 font-medium" style={{ color: DS.inkSub }}>{s.severity}</span>
                  <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((s.count / issues.length) * 100 * 3, 100)}%`, background: s.severity === 'Critical' ? '#EF4444' : s.severity === 'High' ? '#F59E0B' : s.severity === 'Medium' ? '#3B82F6' : '#94A3B8' }} />
                  </div>
                  <span className="text-[10px] font-bold w-4 text-right" style={{ color: DS.ink }}>{s.count}</span>
                </div>
              ))}
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <p className="text-xs font-bold mb-3" style={{ color: DS.ink }}>Issues by Category</p>
              <div className="flex flex-wrap gap-2">
                {categoryCounts.map(c => (
                  <div key={c.key} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: c.soft }}>
                    <span className="text-[10px] font-bold" style={{ color: c.color }}>{c.count}</span>
                    <span className="text-[10px]" style={{ color: c.color }}>{c.short}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="blindspots" className="mt-3">
          <Card className="border-0 shadow-sm" style={{ background: `linear-gradient(135deg, #F5F3FF 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid #7C3AED` }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3"><Eye size={14} style={{ color: '#7C3AED' }} /><span className="text-xs font-bold" style={{ color: '#6D28D9' }}>Blind Spot Analysis</span></div>
              <div className="space-y-2">
                {ISSUE_CATEGORIES.filter(c => !issues.some(i => i.category === c.key)).map(c => (
                  <div key={c.key} className="flex items-center gap-2 p-2 rounded" style={{ background: c.soft }}>
                    <span className="text-[10px] font-bold" style={{ color: c.color }}>{c.icon}</span>
                    <span className="text-[10px]" style={{ color: c.color }}>{c.label}</span>
                    <Badge variant="outline" className="text-[8px] h-4 ml-auto" style={{ color: '#D97706', borderColor: '#FDE68A' }}>No issues raised</Badge>
                  </div>
                ))}
                {ISSUE_CATEGORIES.filter(c => !issues.some(i => i.category === c.key)).length === 0 && (
                  <p className="text-xs" style={{ color: '#059669' }}>All 12 issue categories have been addressed. Good coverage.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

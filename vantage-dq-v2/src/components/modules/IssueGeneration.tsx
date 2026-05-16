import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import {
  Sparkles, Plus, Check, X, ArrowUpDown,
  ThumbsUp, Tag, Target, CheckCircle2,
  AlertTriangle, BarChart2, Brain, Send,
} from 'lucide-react';
import type { RaisedItem, RaisedItemClassification, RaisedItemCategory } from '@/lib/issues/intelligenceSchema';
import {
  CLASSIFICATION_META, CATEGORY_META, CLUSTERS,
  makeItemId, computePriorityScore, assessReadiness,
} from '@/lib/issues/intelligenceSchema';
import {
  buildExtractIntelligencePrompt, buildClassifyPrompt,
  buildCopilotPrompt, buildRoutingPrompt,
  INTELLIGENCE_SYSTEM_PROMPT,
} from '@/lib/issues/intelligencePrompts';
import type { ValidatedProblemFrame } from '@/lib/dq/problemFrameSchema';

interface Props {
  acceptedItems?: any[];
  sessionData?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
  onValidated?: (items: RaisedItem[]) => void;
}

type ViewMode = 'stream' | 'clusters';
type SortMode = 'priority' | 'classification' | 'recent';
type FilterMode = 'all' | RaisedItemClassification | 'needs_review' | 'accepted';

async function callAI(prompt: string): Promise<any> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0,
      system: INTELLIGENCE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const raw = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

function safeArray(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) return val.split('\n').filter(Boolean);
  return [];
}

function getFrame(sessionData: any, acceptedItems: any[]): ValidatedProblemFrame | null {
  const raw = sessionData?.problemFrame
    ?? acceptedItems?.find((i: any) => i.targetType === 'problem_frame')?.data
    ?? null;
  if (!raw) return null;
  return {
    decisionStatement: raw.decisionStatement ?? '',
    context: raw.context ?? '',
    background: raw.background ?? '',
    trigger: raw.trigger ?? '',
    scopeIn: safeArray(raw.scopeIn),
    scopeOut: safeArray(raw.scopeOut),
    constraints: safeArray(raw.constraints),
    assumptions: safeArray(raw.assumptions),
    successCriteria: safeArray(raw.successCriteria),
    failureConsequences: raw.failureConsequences ?? '',
  };
}

function ItemCard({ item, onAccept, onReject, onVote }: {
  item: RaisedItem; onAccept: () => void; onReject: () => void; onVote: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = CLASSIFICATION_META[item.classification] ?? { label: item.classification, color: '#64748B', bg: '#F1F5F9', icon: '·', definition: '', downstreamTargets: [] };
  const catMeta = CATEGORY_META[item.category] ?? { label: item.category, color: '#64748B' };
  const priority = computePriorityScore(item);
  const isAccepted = item.reviewStatus === 'accepted';
  const isRejected = item.reviewStatus === 'rejected';

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-xl overflow-hidden"
      style={{
        border: `1.5px solid ${isAccepted ? '#86EFAC' : isRejected ? '#FCA5A5' : item.reviewStatus === 'needs_review' ? '#FCD34D' : DS.border}`,
        background: isRejected ? '#FFF5F5' : DS.surface,
        opacity: isRejected ? 0.55 : 1,
      }}>
      <div className="flex items-start gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: meta.bg }}>{meta.icon}</div>
          <span className="text-xs font-bold" style={{ color: priority >= 11 ? '#DC2626' : priority >= 8 ? '#D97706' : DS.inkFaint }}>{priority}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: DS.surfaceAlt, color: catMeta.color, fontSize: 10 }}>{catMeta.label}</span>
            {item.source === 'ai' && <span className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: DS.accentLight, color: DS.accent, fontSize: 10 }}><Sparkles size={8} /> AI</span>}
            {(item.confidenceScore ?? 100) < 70 && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#D97706', fontSize: 10 }}>{item.confidenceScore}%</span>}
          </div>
          <p className="text-sm font-medium leading-snug" style={{ color: isRejected ? DS.inkTer : DS.ink }}>{item.title}</p>
        </div>
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onVote(); }} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: (item.votes ?? 0) > 0 ? DS.accentLight : DS.surfaceAlt }}>
            <ThumbsUp size={11} style={{ color: (item.votes ?? 0) > 0 ? DS.accent : DS.inkFaint }} />
          </button>
          {(item.votes ?? 0) > 0 && <span className="text-xs font-bold" style={{ color: DS.accent }}>{item.votes}</span>}
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
            <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: `1px solid ${DS.border}` }}>
              {item.description && <p className="text-xs" style={{ color: DS.inkTer, lineHeight: '1.6' }}>{item.description}</p>}
              {item.rationale && item.source === 'ai' && <p className="text-xs italic" style={{ color: DS.inkFaint }}>AI: {item.rationale}</p>}
              {item.downstreamTargets && item.downstreamTargets.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Send size={11} style={{ color: DS.inkFaint }} />
                  {item.downstreamTargets.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: DS.accentLight, color: DS.accent }}>{t.replace(/_/g, ' ')}</span>)}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {[{ label: 'Impact', val: item.decisionImpact ?? 3 }, { label: 'Urgency', val: item.urgency ?? 3 }, { label: 'Uncertainty', val: item.uncertaintyLevel ?? 3 }].map(s => (
                  <div key={s.label} className="text-center p-2 rounded-lg" style={{ background: DS.surfaceAlt }}>
                    <p className="text-xs font-semibold" style={{ color: DS.ink }}>{s.val}/5</p>
                    <p className="text-xs" style={{ color: DS.inkTer }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {!isRejected ? (
                <div className="flex gap-2">
                  {!isAccepted
                    ? <button onClick={onAccept} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: '#DCFCE7', color: '#059669' }}><Check size={11} /> Accept</button>
                    : <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: '#DCFCE7', color: '#059669' }}><CheckCircle2 size={11} /> Accepted</div>}
                  <button onClick={onReject} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#DC2626' }}><X size={11} /> Reject</button>
                </div>
              ) : (
                <button onClick={onAccept} className="w-full py-1.5 rounded-lg text-xs text-center" style={{ background: DS.surfaceAlt, color: DS.inkTer }}>Restore</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ClusterView({ items, onAccept, onReject, onVote }: { items: RaisedItem[]; onAccept: (id: string) => void; onReject: (id: string) => void; onVote: (id: string) => void }) {
  return (
    <div className="space-y-6">
      {CLUSTERS.map(cluster => {
        const clusterItems = items.filter(i => cluster.classifications.includes(i.classification) && i.reviewStatus !== 'rejected');
        if (!clusterItems.length) return null;
        return (
          <div key={cluster.id}>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1" style={{ background: cluster.color + '40' }} />
              <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: cluster.bg, color: cluster.color }}>{cluster.label} · {clusterItems.length}</span>
              <div className="h-px flex-1" style={{ background: cluster.color + '40' }} />
            </div>
            <div className="space-y-2">
              {clusterItems.map(item => <ItemCard key={item.id} item={item} onAccept={() => onAccept(item.id)} onReject={() => onReject(item.id)} onVote={() => onVote(item.id)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddItemForm({ onAdd, onClose }: { onAdd: (item: RaisedItem) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [classification, setClassification] = useState<RaisedItemClassification>('uncertainty');
  const [category, setCategory] = useState<RaisedItemCategory>('strategic');
  const submit = () => {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    onAdd({ id: makeItemId(), title: title.trim(), classification, category, source: 'user', linkedProblemFrameFields: [], reviewStatus: 'accepted', votes: 0, decisionImpact: 3, urgency: 3, uncertaintyLevel: 3, createdAt: now, updatedAt: now });
    onClose();
  };
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl p-4 space-y-3" style={{ background: DS.surface, border: `2px solid ${DS.accent}` }}>
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: DS.accent }}>Add Item</p>
      <textarea autoFocus rows={2} value={title} onChange={e => setTitle(e.target.value)} placeholder="What is the decision-relevant item?"
        className="w-full rounded-lg px-3 py-2 text-sm resize-none" style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}`, color: DS.ink, outline: 'none', lineHeight: '1.5' }} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: DS.inkTer }}>Classification</label>
          <select value={classification} onChange={e => setClassification(e.target.value as RaisedItemClassification)} className="w-full rounded-lg px-2 py-1.5 text-xs" style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}`, color: DS.ink, outline: 'none' }}>
            {Object.entries(CLASSIFICATION_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: DS.inkTer }}>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as RaisedItemCategory)} className="w-full rounded-lg px-2 py-1.5 text-xs" style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}`, color: DS.ink, outline: 'none' }}>
            {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={submit} className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-semibold flex-1 justify-center" style={{ background: DS.accent, color: '#fff' }}><Plus size={12} /> Add</button>
        <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs" style={{ background: DS.surfaceAlt, color: DS.inkTer }}>Cancel</button>
      </div>
    </motion.div>
  );
}

export default function IssueGeneration({ acceptedItems, sessionData, persistedState, onPersistState, onValidated }: Props) {
  const [items, setItems] = useState<RaisedItem[]>(() => persistedState?.items ?? []);
  const [viewMode, setViewMode] = useState<ViewMode>(() => persistedState?.viewMode ?? 'stream');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copilotAnalysis, setCopilotAnalysis] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activePanel, setActivePanel] = useState<'copilot' | 'stats'>('copilot');
  const [showPanel, setShowPanel] = useState(true);

  const frame = useMemo(() => getFrame(sessionData, acceptedItems ?? []), [sessionData, acceptedItems]);

  // Persist state on change
  useEffect(() => {
    onPersistState?.({ items, viewMode });
  }, [items, viewMode]);
  const readiness = useMemo(() => assessReadiness(items), [items]);

  const counts = useMemo(() => ({
    total: items.filter(i => i.reviewStatus !== 'rejected').length,
    accepted: items.filter(i => i.reviewStatus === 'accepted').length,
    needsReview: items.filter(i => i.reviewStatus === 'needs_review').length,
    byClass: Object.keys(CLASSIFICATION_META).reduce((acc, k) => { acc[k] = items.filter(i => i.classification === k && i.reviewStatus !== 'rejected').length; return acc; }, {} as Record<string, number>),
  }), [items]);

  const displayed = useMemo(() => {
    let filtered = items;
    if (filter === 'needs_review') filtered = items.filter(i => i.reviewStatus === 'needs_review');
    else if (filter === 'accepted') filtered = items.filter(i => i.reviewStatus === 'accepted');
    else if (filter !== 'all') filtered = items.filter(i => i.classification === filter);
    return [...filtered].sort((a, b) => sortMode === 'priority' ? computePriorityScore(b) - computePriorityScore(a) : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items, filter, sortMode]);

  const accept = useCallback((id: string) => setItems(p => p.map(i => i.id === id ? { ...i, reviewStatus: 'accepted' as const, updatedAt: new Date().toISOString() } : i)), []);
  const reject = useCallback((id: string) => setItems(p => p.map(i => i.id === id ? { ...i, reviewStatus: 'rejected' as const, updatedAt: new Date().toISOString() } : i)), []);
  const vote = useCallback((id: string) => setItems(p => p.map(i => i.id === id ? { ...i, votes: (i.votes ?? 0) + 1 } : i)), []);
  const addItem = useCallback((item: RaisedItem) => setItems(p => [...p, item]), []);

  const handleExtract = useCallback(async () => {
    if (!frame) { setAiError('Problem Frame not found. Complete the Problem Frame first.'); return; }
    setAiLoading(true); setAiError(null);
    try {
      const result = await callAI(buildExtractIntelligencePrompt(frame, items));
      const now = new Date().toISOString();
      setItems(p => [...p, ...(result.items ?? []).map((r: any) => ({
        id: makeItemId(), title: r.title ?? 'Untitled', description: r.description,
        classification: r.classification ?? 'uncertainty', category: r.category ?? 'strategic',
        source: 'ai' as const, linkedProblemFrameFields: r.linkedProblemFrameFields ?? [],
        confidenceScore: r.confidenceScore ?? 70, reviewStatus: 'needs_review' as const,
        votes: 0, decisionImpact: r.decisionImpact ?? 3, urgency: r.urgency ?? 3,
        uncertaintyLevel: r.uncertaintyLevel ?? 3, rationale: r.rationale, createdAt: now, updatedAt: now,
      }))]);
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  }, [frame, items]);

  const handleClassify = useCallback(async () => {
    const toClassify = items.filter(i => i.source === 'user' || i.reviewStatus === 'needs_review');
    if (!toClassify.length) { setAiError('No items to classify — extract intelligence first or add items manually.'); return; }
    setAiLoading(true); setAiError(null);
    try {
      const result = await callAI(buildClassifyPrompt(toClassify));
      setItems(p => p.map(i => { const u = (result.updates ?? []).find((u: any) => u.id === i.id); return u ? { ...i, ...u, updatedAt: new Date().toISOString() } : i; }));
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  }, [items]);

  const handleCopilot = useCallback(async () => {
    if (!frame) return;
    setAiLoading(true); setAiError(null);
    try {
      const result = await callAI(buildCopilotPrompt(frame, items));
      setCopilotAnalysis(result); setActivePanel('copilot');
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  }, [frame, items]);

  const handleRoute = useCallback(async () => {
    if (counts.accepted === 0) { setAiError('Accept some items first before routing downstream.'); return; }
    setAiLoading(true); setAiError(null);
    try {
      const result = await callAI(buildRoutingPrompt(items));
      setItems(p => p.map(i => { const r = (result.routing ?? []).find((r: any) => r.id === i.id); return r ? { ...i, downstreamTargets: r.downstreamTargets, updatedAt: new Date().toISOString() } : i; }));
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  }, [items]);

  const FILTER_TABS = [
    { id: 'all' as FilterMode, label: 'All', count: counts.total },
    { id: 'needs_review' as FilterMode, label: 'Review', count: counts.needsReview },
    { id: 'accepted' as FilterMode, label: 'Accepted', count: counts.accepted },
    ...CLUSTERS.map(c => ({ id: c.classifications[0] as FilterMode, label: c.label, count: c.classifications.reduce((s, cl) => s + (counts.byClass[cl] ?? 0), 0) })).filter(t => t.count > 0),
  ];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden" style={{ background: DS.bg }}>

      {/* Decision Banner */}
      {frame?.decisionStatement && (
        <div className="shrink-0 px-6 py-3 flex items-start gap-3" style={{ background: DS.accentLight, borderBottom: `1px solid ${DS.accent}30` }}>
          <Target size={14} style={{ color: DS.accent, marginTop: 3, flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: DS.accent }}>Decision</p>
            <p className="text-sm font-semibold" style={{ color: DS.ink, lineHeight: '1.4' }}>{frame.decisionStatement}</p>
          </div>
        </div>
      )}

      {/* AI Action Bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 flex-wrap" style={{ background: DS.surface, borderBottom: `1px solid ${DS.border}` }}>
        <button onClick={handleExtract} disabled={aiLoading || !frame}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: aiLoading ? DS.surfaceAlt : DS.accent, color: aiLoading ? DS.inkTer : '#fff' }}>
          <Sparkles size={12} /> {aiLoading ? 'Analyzing…' : 'Extract Intelligence'}
        </button>
        <button onClick={handleClassify} disabled={aiLoading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: DS.surfaceAlt, color: DS.ink, border: `1px solid ${DS.border}` }}>
          <Tag size={12} /> Classify & Clean
        </button>
        <button onClick={handleCopilot} disabled={aiLoading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: DS.surfaceAlt, color: DS.ink, border: `1px solid ${DS.border}` }}>
          <Brain size={12} /> Copilot Analysis
        </button>
        <button onClick={handleRoute} disabled={aiLoading || counts.accepted === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: DS.surfaceAlt, color: DS.ink, border: `1px solid ${DS.border}` }}>
          <Send size={12} /> Route Downstream
        </button>
        <div className="flex-1" />
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${DS.border}` }}>
          {(['stream', 'clusters'] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setViewMode(m)} className="px-3 py-1.5 text-xs font-medium capitalize"
              style={{ background: viewMode === m ? DS.accent : DS.surface, color: viewMode === m ? '#fff' : DS.inkTer }}>{m}</button>
          ))}
        </div>
        <button onClick={() => setShowPanel(s => !s)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: DS.surfaceAlt, color: DS.inkTer, border: `1px solid ${DS.border}` }}>
          <Brain size={12} /> {showPanel ? 'Hide Panel' : 'Show Panel'}
        </button>
        <button onClick={() => setShowAddForm(s => !s)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#DCFCE7', color: '#059669' }}>
          <Plus size={12} /> Add Item
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: DS.surfaceAlt, color: DS.inkTer }}>{counts.total} total</span>
          {counts.accepted > 0 && <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: '#DCFCE7', color: '#059669' }}>{counts.accepted} accepted</span>}
          {counts.needsReview > 0 && <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: '#FEF3C7', color: '#D97706' }}>{counts.needsReview} review</span>}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-2 overflow-x-auto" style={{ borderBottom: `1px solid ${DS.border}`, background: DS.surface }}>
        <button onClick={() => setSortMode(s => s === 'priority' ? 'recent' : 'priority')} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs mr-2 flex-shrink-0" style={{ background: DS.surfaceAlt, color: DS.inkTer }}>
          <ArrowUpDown size={10} /> {sortMode === 'priority' ? 'Priority' : 'Recent'}
        </button>
        {FILTER_TABS.map(tab => (
          <button key={String(tab.id)} onClick={() => setFilter(tab.id)}
            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0"
            style={{ background: filter === tab.id ? DS.accent : DS.surfaceAlt, color: filter === tab.id ? '#fff' : DS.inkTer }}>
            {tab.label}
            {tab.count > 0 && <span className="ml-1 px-1.5 rounded-full text-xs" style={{ background: filter === tab.id ? 'rgba(255,255,255,0.25)' : DS.border, color: filter === tab.id ? '#fff' : DS.inkTer }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Main board */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <AnimatePresence>{showAddForm && <AddItemForm onAdd={addItem} onClose={() => setShowAddForm(false)} />}</AnimatePresence>

          {aiError && (
            <div className="rounded-xl p-3" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5' }}>
              <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>Error: {aiError}</p>
            </div>
          )}

          {aiLoading && displayed.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <motion.div className="w-8 h-8 rounded-full border-2" style={{ borderColor: DS.accent, borderTopColor: 'transparent' }}
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
              <p className="text-sm" style={{ color: DS.inkTer }}>Extracting decision intelligence…</p>
            </div>
          )}

          {displayed.length === 0 && !aiLoading && !showAddForm && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="text-4xl">🧠</div>
              <p className="text-sm font-semibold" style={{ color: DS.inkTer }}>No intelligence captured yet</p>
              <p className="text-xs text-center max-w-xs" style={{ color: DS.inkFaint }}>Click "Extract Intelligence" to surface decisions, uncertainties, risks, and more from your Problem Frame.</p>
            </div>
          )}

          {viewMode === 'stream'
            ? <AnimatePresence mode="popLayout">{displayed.map(item => <ItemCard key={item.id} item={item} onAccept={() => accept(item.id)} onReject={() => reject(item.id)} onVote={() => vote(item.id)} />)}</AnimatePresence>
            : <ClusterView items={displayed} onAccept={accept} onReject={reject} onVote={vote} />
          }

          {items.length > 0 && (
            <div className="mt-4 rounded-xl p-4" style={{ background: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
              {readiness.ready ? (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => onValidated?.(items.filter(i => i.reviewStatus === 'accepted'))}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                  style={{ background: DS.accent, color: '#fff', boxShadow: `0 4px 14px ${DS.accent}40` }}>
                  <CheckCircle2 size={16} /> Proceed to Decision Hierarchy
                </motion.button>
              ) : (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: DS.inkTer }}>Before proceeding:</p>
                  {readiness.blockers.map((b, i) => <p key={i} className="text-xs mb-1 flex items-center gap-1.5" style={{ color: DS.inkTer }}><span style={{ color: '#D97706' }}>·</span>{b}</p>)}
                  <button onClick={() => onValidated?.(items.filter(i => i.reviewStatus === 'accepted'))} className="mt-3 w-full py-2 rounded-lg text-xs font-medium" style={{ background: DS.surface, color: DS.inkTer, border: `1px solid ${DS.border}` }}>
                    Override & Proceed Anyway
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel */}
        {showPanel && <div className="w-64 shrink-0 flex flex-col overflow-hidden" style={{ borderLeft: `1px solid ${DS.border}`, background: DS.surface }}>
          <div className="flex shrink-0" style={{ borderBottom: `1px solid ${DS.border}` }}>
            {(['copilot', 'stats'] as const).map(p => (
              <button key={p} onClick={() => setActivePanel(p)} className="flex-1 py-2.5 text-xs font-semibold"
                style={{ background: activePanel === p ? DS.accentLight : DS.surface, color: activePanel === p ? DS.accent : DS.inkTer, borderBottom: activePanel === p ? `2px solid ${DS.accent}` : '2px solid transparent' }}>
                {p === 'copilot' ? '🧠 Copilot' : '📊 Stats'}
              </button>
            ))}
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {activePanel === 'copilot' && (
              aiLoading ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <motion.div className="w-4 h-4 rounded-full border-2" style={{ borderColor: DS.accent, borderTopColor: 'transparent' }} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
                  <span className="text-xs" style={{ color: DS.inkTer }}>Analyzing…</span>
                </div>
              ) : !copilotAnalysis ? (
                <p className="text-xs text-center py-4" style={{ color: DS.inkFaint }}>Run Copilot Analysis to get facilitator guidance.</p>
              ) : (
                <div className="space-y-3">
                  {copilotAnalysis.dqWarnings?.length > 0 && <div><p className="text-xs font-semibold mb-1.5" style={{ color: '#D97706' }}>⚠️ DQ Warnings</p>{copilotAnalysis.dqWarnings.map((w: string, i: number) => <p key={i} className="text-xs mb-1 pl-3" style={{ color: DS.inkTer }}>· {w}</p>)}</div>}
                  {copilotAnalysis.facilitatorQuestions?.length > 0 && <div><p className="text-xs font-semibold mb-1.5" style={{ color: DS.accent }}>💬 Facilitator Questions</p>{copilotAnalysis.facilitatorQuestions.slice(0, 4).map((q: string, i: number) => <p key={i} className="text-xs mb-1.5 italic pl-3" style={{ color: DS.inkTer }}>"{q}"</p>)}</div>}
                  {copilotAnalysis.unresolved_tensions?.length > 0 && <div><p className="text-xs font-semibold mb-1.5" style={{ color: '#E11D48' }}>⚡ Tensions</p>{copilotAnalysis.unresolved_tensions.map((t: string, i: number) => <p key={i} className="text-xs mb-1 pl-3" style={{ color: DS.inkTer }}>· {t}</p>)}</div>}
                  {copilotAnalysis.nextBestActions?.length > 0 && <div><p className="text-xs font-semibold mb-1.5" style={{ color: '#059669' }}>✅ Next Actions</p>{copilotAnalysis.nextBestActions.slice(0, 3).map((a: string, i: number) => <p key={i} className="text-xs mb-1 pl-3" style={{ color: DS.inkTer }}>· {a}</p>)}</div>}
                </div>
              )
            )}
            {activePanel === 'stats' && (
              <div className="space-y-3">
                <div className="rounded-xl p-3" style={{ background: readiness.ready ? '#DCFCE7' : DS.surfaceAlt, border: `1px solid ${readiness.ready ? '#86EFAC' : DS.border}` }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: readiness.ready ? '#059669' : DS.inkTer }}>{readiness.ready ? '✅ Ready' : 'Readiness'}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[{ label: 'Accepted', val: readiness.stats.accepted, color: '#059669' }, { label: 'Decisions', val: readiness.stats.strategicDecisions, color: DS.accent }, { label: 'Uncertainties', val: readiness.stats.uncertainties, color: '#D97706' }, { label: 'Risks', val: readiness.stats.risks, color: '#DC2626' }].map(s => (
                      <div key={s.label} className="rounded-lg p-2 text-center" style={{ background: DS.surface }}>
                        <p className="text-sm font-bold" style={{ color: s.color }}>{s.val}</p>
                        <p className="text-xs" style={{ color: DS.inkTer }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl p-3" style={{ border: `1px solid ${DS.border}` }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: DS.inkTer }}>By Type</p>
                  <div className="space-y-1.5">
                    {Object.entries(CLASSIFICATION_META).filter(([k]) => (counts.byClass[k] ?? 0) > 0).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="w-5 text-sm">{v.icon}</span>
                        <span className="text-xs flex-1" style={{ color: DS.inkTer }}>{v.label}</span>
                        <span className="text-xs font-semibold" style={{ color: v.color }}>{counts.byClass[k]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>}
      </div>
    </div>
  );
}

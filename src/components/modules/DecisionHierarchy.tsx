import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS, H_TIERS, CRITERIA_TYPES, CRITERIA_WEIGHTS } from '@/constants';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Plus, Trash2, ChevronDown, ChevronRight, Lightbulb, Lock, Star, PauseCircle, AlertTriangle, CheckCircle } from 'lucide-react';

interface DecisionItem { id: number; label: string; choices: string[]; tier: string; owner: string; rationale: string; }
interface CriterionItem { id: number; label: string; type: string; weight: string; description: string; }

const TIER_ICONS: Record<string, any> = { given: Lock, focus: Star, deferred: PauseCircle };
const TIER_ACCENT: Record<string, string> = { given: '#64748B', focus: DS.accent, deferred: DS.information.fill };

const TABS = [
  { id: 'hierarchy', label: 'Decision Hierarchy' },
  { id: 'criteria', label: 'Decision Criteria' },
  { id: 'analysis', label: 'AI Analysis' },
];

const DQ_PRINCIPLES: Record<string, string> = {
  hierarchy: 'The Focus Five is the most powerful constraint in DQ. Limiting focus decisions to five forces the team to identify what truly matters. Teams with 10+ "focus" decisions have not actually prioritised — they have listed.',
  criteria: 'Criteria defined before scoring prevent post-hoc rationalisation. If you add criteria after seeing scores, you are not evaluating — you are justifying. Lock criteria before moving to assessment.',
  analysis: 'A well-structured decision hierarchy has: 2-4 given decisions (constraints), 3-5 focus decisions (the Focus Five), and any number of deferred decisions. Focus decisions should be mutually exclusive and collectively exhaustive.',
};

export function DecisionHierarchy({ sessionId, data, hooks }: ModuleProps) {
  const { call, busy } = useAI();
  const [activeTab, setActiveTab] = useState('hierarchy');
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [criteria, setCriteria] = useState<CriterionItem[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newTier, setNewTier] = useState('focus');
  const [newCritLabel, setNewCritLabel] = useState('');
  const [newCritType, setNewCritType] = useState('financial');
  const [newCritWeight, setNewCritWeight] = useState('high');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [analysis, setAnalysis] = useState<any>(null);
  const [suggestedCriteria, setSuggestedCriteria] = useState<any[]>([]);

  useEffect(() => {
    if (data?.decisions?.length) {
      setDecisions(data.decisions.map((d: any) => ({
        id: d.id, label: d.label, choices: d.choices || [], tier: d.tier,
        owner: d.owner || '', rationale: d.rationale || '',
      })));
    }
    if (data?.criteria?.length) {
      setCriteria(data.criteria.map((c: any) => ({
        id: c.id, label: c.label, type: c.type, weight: c.weight, description: c.description || '',
      })));
    }
  }, [data?.decisions, data?.criteria]);

  const focusCount = decisions.filter(d => d.tier === 'focus').length;
  const focusFull = focusCount >= 5;

  const addDecision = (tier?: string) => {
    if (!newLabel.trim()) return;
    const t = tier || newTier;
    if (t === 'focus' && focusFull) return;
    const n: DecisionItem = { id: Date.now(), label: newLabel.trim(), choices: ['Option A', 'Option B', 'Option C'], tier: t, owner: '', rationale: '' };
    setDecisions(p => [...p, n]);
    hooks?.createDecision?.({ sessionId, label: newLabel.trim(), choices: ['Option A', 'Option B', 'Option C'], tier: t });
    setNewLabel('');
  };

  const removeDecision = (id: number) => { setDecisions(p => p.filter(d => d.id !== id)); hooks?.deleteDecision?.({ id }); };
  const moveTier = (id: number, tier: string) => {
    if (tier === 'focus' && focusFull) return;
    setDecisions(p => p.map(d => d.id === id ? { ...d, tier } : d));
  };

  const addCriterion = () => {
    if (!newCritLabel.trim()) return;
    const n: CriterionItem = { id: Date.now(), label: newCritLabel.trim(), type: newCritType, weight: newCritWeight, description: '' };
    setCriteria(p => [...p, n]);
    hooks?.createCriterion?.({ sessionId, label: newCritLabel.trim(), type: newCritType, weight: newCritWeight });
    setNewCritLabel('');
  };

  const removeCriterion = (id: number) => { setCriteria(p => p.filter(c => c.id !== id)); hooks?.deleteCriterion?.({ id }); };

  const aiAutoSort = () => {
    const issueCtx = (data?.issues || []).slice(0, 8).map((i: any) => `"${i.text}" [${i.severity}]`).join('\n');
    const decList = decisions.map(d => `"${d.label}" [currently: ${d.tier}]`).join('\n');
    const prompt = `Classify these decisions into the correct DQ hierarchy tiers.\n\nTiers:\n- given: already made, locked, non-negotiable\n- focus: strategic core, must resolve, max 5 (the Focus Five)\n- deferred: depends on focus decisions\n\nDecision context: ${data?.session?.decisionStatement || ''}\nIssues:\n${issueCtx}\n\nDecisions:\n${decList}\n\nReturn JSON: { assignments: [{label: (exact label), tier, rationale}] }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
      (result?.assignments || []).forEach((a: any) => {
        setDecisions(p => p.map(d => d.label.toLowerCase().trim() === (a.label || '').toLowerCase().trim() ? { ...d, tier: a.tier, rationale: a.rationale || d.rationale } : d));
      });
    });
  };

  const aiSuggestCriteria = () => {
    const focusDecs = decisions.filter(d => d.tier === 'focus').map(d => d.label).join(', ');
    const prompt = `Suggest 6 decision criteria for evaluating strategies on: ${focusDecs}.\nDecision: ${data?.session?.decisionStatement || ''}\nIssues: ${(data?.issues || []).slice(0, 5).map((i: any) => i.text).join('; ')}\n\nReturn JSON: { criteria: [{label, type (financial/strategic/operational/risk/commercial), weight (critical/high/medium/low), description}] }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
      if (result?.criteria) { setSuggestedCriteria(result.criteria); setActiveTab('criteria'); }
    });
  };

  const aiAnalysis = () => {
    const summary = `Given: ${decisions.filter(d => d.tier === 'given').length}, Focus: ${focusCount}/5, Deferred: ${decisions.filter(d => d.tier === 'deferred').length}`;
    const focusList = decisions.filter(d => d.tier === 'focus').map(d => d.label).join(', ');
    const prompt = `Analyse this decision hierarchy for DQ quality.\nDecision: ${data?.session?.decisionStatement || ''}\n${summary}\nFocus decisions: ${focusList}\n\nReturn JSON: { overallScore: 0-100, hierarchyVerdict: string, checks: [{name, pass: boolean, note}], focusFiveAssessment: string, improvements: [{issue, recommendation}] }`;
    call(prompt, (r) => {
      let result = r;
      if (r?._raw) { try { result = JSON.parse((r._raw || '').match(/\{[\s\S]*\}/)?.[0] || ''); } catch { return; } }
      if (result && !result.error) { setAnalysis(result); setActiveTab('analysis'); }
    });
  };

  const WEIGHT_COLORS: Record<string, { color: string; soft: string }> = {
    critical: { color: DS.danger, soft: DS.dangerSoft },
    high: { color: DS.warning, soft: DS.warnSoft },
    medium: { color: '#64748B', soft: '#F1F5F9' },
    low: { color: DS.inkDis, soft: DS.bg },
  };

  return (
    <div className="space-y-0">
      {/* Module header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: DS.inkDis }}>MODULE 03</div>
          <h2 className="text-xl font-bold" style={{ color: DS.ink }}>Decision Hierarchy</h2>
        </div>
        {/* Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge style={{ background: focusFull ? DS.dangerSoft : DS.accentSoft, color: focusFull ? DS.danger : DS.accent, border: 'none', fontWeight: 700 }}>
            FOCUS FIVE: {focusCount}/5
          </Badge>
          <Badge style={{ background: DS.bg, color: DS.inkSub, border: `1px solid ${DS.border}` }}>{decisions.length} DECISIONS</Badge>
          <Badge style={{ background: DS.bg, color: DS.inkSub, border: `1px solid ${DS.border}` }}>{criteria.length} CRITERIA</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiAnalysis} disabled={busy}>
            <Sparkles size={11} /> + AI Analysis
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ background: DS.accent }} onClick={aiAutoSort} disabled={busy}>
            <Sparkles size={11} /> AI Auto-Sort
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-5" style={{ borderColor: DS.borderLight }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: activeTab === tab.id ? DS.accent : DS.inkTer, borderBottom: activeTab === tab.id ? `2px solid ${DS.accent}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
            {tab.id === 'criteria' && criteria.length > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: DS.accent }}>{criteria.length}</span>
            )}
            {tab.id === 'analysis' && analysis && (
              <span className="w-1.5 h-1.5 rounded-full ml-1" style={{ background: analysis.overallScore >= 70 ? DS.success : DS.warning }} />
            )}
          </button>
        ))}
      </div>

      {/* === HIERARCHY TAB === */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-4">
          {/* Add row */}
          <div className="flex gap-2 p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
            <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDecision()}
              placeholder="New decision label…" className="flex-1 text-xs h-8 bg-white" />
            <Select value={newTier} onValueChange={setNewTier}>
              <SelectTrigger className="h-8 text-[10px] bg-white w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{H_TIERS.map(t => <SelectItem key={t.key} value={t.key} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" className="h-8 px-3 gap-1 text-xs shrink-0" style={{ background: DS.accent }}
              onClick={() => addDecision()} disabled={!newLabel.trim() || (newTier === 'focus' && focusFull)}>
              <Plus size={12} /> Add
            </Button>
          </div>

          {/* Tier sections */}
          {H_TIERS.map(tier => {
            const tierDecs = decisions.filter(d => d.tier === tier.key);
            const Icon = TIER_ICONS[tier.key] || Star;
            const isCollapsed = collapsed[tier.key];
            const accent = TIER_ACCENT[tier.key];
            return (
              <div key={tier.key} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${DS.borderLight}` }}>
                {/* Section header */}
                <button className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                  style={{ background: DS.bg }}
                  onClick={() => setCollapsed(p => ({ ...p, [tier.key]: !p[tier.key] }))}>
                  <Icon size={14} style={{ color: accent }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: DS.ink }}>{tier.label}</span>
                      {tier.key === 'focus' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: DS.accentSoft, color: DS.accent }}>STRATEGY TABLE SOURCE</span>
                      )}
                      {tier.key === 'focus' && tier.cap && (
                        <span className="text-[9px]" style={{ color: focusFull ? DS.danger : DS.inkDis }}>The strategic core — decide now. Max {tier.cap} (the Focus Five).</span>
                      )}
                    </div>
                    {!isCollapsed && <p className="text-[10px] mt-0.5" style={{ color: DS.inkDis }}>{tier.desc}</p>}
                  </div>
                  <span className="text-sm font-black mr-1" style={{ color: accent }}>{tierDecs.length}</span>
                  {isCollapsed ? <ChevronRight size={14} style={{ color: DS.inkDis }} /> : <ChevronDown size={14} style={{ color: DS.inkDis }} />}
                </button>

                {!isCollapsed && (
                  <div className="p-4" style={{ background: DS.canvas }}>
                    {tierDecs.length === 0 ? (
                      <div className="text-center py-6 rounded-lg" style={{ background: DS.bg }}>
                        <p className="text-xs" style={{ color: DS.inkDis }}>No {tier.label.toLowerCase()} yet — add one above</p>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {tierDecs.map(dec => (
                          <div key={dec.id} className="rounded-xl p-3 relative group" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}`, borderLeft: `3px solid ${accent}` }}>
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-xs font-semibold pr-2" style={{ color: DS.ink }}>{dec.label}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {dec.owner && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: DS.accentSoft, color: DS.accent }}>{dec.owner}</span>}
                                <button onClick={() => removeDecision(dec.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                                  <Trash2 size={11} style={{ color: DS.inkDis }} />
                                </button>
                              </div>
                            </div>
                            {dec.choices.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {dec.choices.slice(0, 3).map((c, i) => (
                                  <span key={i} className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}>{c}</span>
                                ))}
                                {dec.choices.length > 3 && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: DS.bg, color: DS.inkDis }}>+{dec.choices.length - 3} more</span>}
                              </div>
                            )}
                            {dec.rationale && <p className="text-[10px] italic" style={{ color: DS.inkDis }}>{dec.rationale}</p>}
                            {/* Move tier buttons */}
                            <div className="flex gap-1 mt-2 pt-2 border-t opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderColor: DS.borderLight }}>
                              {H_TIERS.filter(t => t.key !== tier.key).map(t => (
                                <button key={t.key} onClick={() => moveTier(dec.id, t.key)}
                                  className="text-[9px] px-2 py-0.5 rounded transition-colors hover:opacity-80"
                                  style={{ background: `${TIER_ACCENT[t.key]}15`, color: TIER_ACCENT[t.key] }}>
                                  → {t.shortLabel}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => { setNewTier(tier.key); }} className="flex items-center gap-1.5 mt-3 text-[10px] font-medium transition-colors hover:opacity-70" style={{ color: accent }}>
                      <Plus size={11} /> Add {tier.shortLabel} Decision
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <DQPrinciple text={DQ_PRINCIPLES.hierarchy} color={DS.accent} />
        </div>
      )}

      {/* === CRITERIA TAB === */}
      {activeTab === 'criteria' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: DS.inkSub }}>Define what matters before scoring strategies. Criteria should reflect genuine stakeholder values.</p>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={aiSuggestCriteria} disabled={busy}>
              <Sparkles size={11} /> AI Suggest
            </Button>
          </div>

          {/* Suggested criteria */}
          {suggestedCriteria.length > 0 && (
            <div className="p-3 rounded-xl space-y-2" style={{ background: DS.information.soft, border: `1px solid ${DS.information.line}` }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold" style={{ color: DS.information.fill }}>AI SUGGESTED CRITERIA — click to add</span>
                <button onClick={() => setSuggestedCriteria([])} className="text-[9px]" style={{ color: DS.inkDis }}>dismiss</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedCriteria.map((cr, i) => (
                  <button key={i} onClick={() => {
                    const n: CriterionItem = { id: Date.now() + i, label: cr.label, type: cr.type, weight: cr.weight, description: cr.description || '' };
                    setCriteria(p => [...p, n]);
                    hooks?.createCriterion?.({ sessionId, label: cr.label, type: cr.type, weight: cr.weight });
                    setSuggestedCriteria(p => p.filter((_, j) => j !== i));
                  }} className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all hover:opacity-80"
                    style={{ background: DS.information.fill, color: '#fff' }}>
                    + {cr.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add criterion */}
          <div className="flex gap-2 p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
            <Input value={newCritLabel} onChange={e => setNewCritLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCriterion()}
              placeholder="Criterion label…" className="flex-1 text-xs h-8 bg-white" />
            <Select value={newCritType} onValueChange={setNewCritType}>
              <SelectTrigger className="h-8 text-[10px] bg-white w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{CRITERIA_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={newCritWeight} onValueChange={setNewCritWeight}>
              <SelectTrigger className="h-8 text-[10px] bg-white w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{CRITERIA_WEIGHTS.map(w => <SelectItem key={w} value={w} className="text-xs capitalize">{w}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" className="h-8 px-3 gap-1 text-xs shrink-0" style={{ background: DS.accent }} onClick={addCriterion} disabled={!newCritLabel.trim()}>
              <Plus size={12} /> Add
            </Button>
          </div>

          {/* Criteria list */}
          <div className="space-y-1.5">
            {criteria.map((cr, i) => {
              const wc = WEIGHT_COLORS[cr.weight] || WEIGHT_COLORS.medium;
              return (
                <div key={cr.id} className="flex items-center gap-3 p-3 rounded-xl group" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0" style={{ background: DS.accentSoft, color: DS.accent }}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium" style={{ color: DS.ink }}>{cr.label}</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded capitalize shrink-0" style={{ background: DS.bg, color: DS.inkSub }}>{cr.type}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 capitalize" style={{ background: wc.soft, color: wc.color }}>{cr.weight}</span>
                  <button onClick={() => removeCriterion(cr.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1">
                    <Trash2 size={11} style={{ color: DS.inkDis }} />
                  </button>
                </div>
              );
            })}
            {criteria.length === 0 && (
              <div className="text-center py-10 rounded-xl" style={{ background: DS.bg }}>
                <p className="text-xs" style={{ color: DS.inkDis }}>No criteria yet — add manually or use AI Suggest</p>
              </div>
            )}
          </div>
          <DQPrinciple text={DQ_PRINCIPLES.criteria} color={DS.accent} />
        </div>
      )}

      {/* === AI ANALYSIS TAB === */}
      {activeTab === 'analysis' && (
        <div className="space-y-4">
          {!analysis ? (
            <div className="text-center py-14">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: DS.accentSoft }}>
                <Sparkles size={28} style={{ color: DS.accent }} />
              </div>
              <h3 className="text-base font-bold mb-1" style={{ color: DS.ink }}>AI Hierarchy Analysis</h3>
              <p className="text-xs mb-5 max-w-sm mx-auto" style={{ color: DS.inkTer }}>Validates the Focus Five, checks decision coverage, and suggests improvements.</p>
              <Button style={{ background: DS.accent }} onClick={aiAnalysis} disabled={busy} className="gap-2">
                <Sparkles size={14} /> {busy ? 'Analysing…' : 'Run Analysis'}
              </Button>
            </div>
          ) : (
            <>
              {/* Score */}
              <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: DS.accentSoft, border: `1px solid ${DS.accent}30` }}>
                <div className="text-5xl font-black" style={{ color: analysis.overallScore >= 70 ? DS.success : analysis.overallScore >= 45 ? DS.warning : DS.danger }}>{analysis.overallScore}</div>
                <div className="flex-1">
                  <div className="text-sm font-bold mb-0.5" style={{ color: DS.ink }}>Hierarchy Quality</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{analysis.hierarchyVerdict}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0 h-7" onClick={aiAnalysis} disabled={busy}>
                  <Sparkles size={11} /> Re-run
                </Button>
              </div>

              {analysis.focusFiveAssessment && (
                <div className="p-3 rounded-xl" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: DS.accent }}>FOCUS FIVE ASSESSMENT</div>
                  <p className="text-xs" style={{ color: DS.inkSub }}>{analysis.focusFiveAssessment}</p>
                </div>
              )}

              {/* Checks */}
              <div className="grid grid-cols-2 gap-2">
                {(analysis.checks || []).map((c: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: c.pass ? DS.successSoft : DS.dangerSoft }}>
                    {c.pass ? <CheckCircle size={13} style={{ color: DS.success, flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={13} style={{ color: DS.danger, flexShrink: 0, marginTop: 1 }} />}
                    <div>
                      <div className="text-[10px] font-semibold" style={{ color: DS.ink }}>{c.name}</div>
                      {c.note && <div className="text-[9px] mt-0.5" style={{ color: DS.inkSub }}>{c.note}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Improvements */}
              {(analysis.improvements || []).length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.inkDis }}>Recommended Improvements</div>
                  {analysis.improvements.map((imp: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-xl" style={{ background: DS.canvas, border: `1px solid ${DS.borderLight}` }}>
                      <ChevronRight size={13} style={{ color: DS.accent, flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <div className="text-[10px] font-semibold" style={{ color: DS.ink }}>{imp.issue}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>{imp.recommendation}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <DQPrinciple text={DQ_PRINCIPLES.analysis} color={DS.accent} />
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t" style={{ borderColor: DS.borderLight }}>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: DS.inkDis }}>
          <span>{decisions.filter(d => d.tier === 'given').length} given</span>
          <span>·</span>
          <span style={{ color: focusFull ? DS.danger : DS.accent }}>{focusCount}/5 focus</span>
          <span>·</span>
          <span>{decisions.filter(d => d.tier === 'deferred').length} deferred</span>
          <span>·</span>
          <span>{criteria.length} criteria</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={aiSuggestCriteria} disabled={busy}>
            <Sparkles size={11} /> Suggest Criteria
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" style={{ background: DS.accent }}
            onClick={() => setActiveTab(TABS[Math.min(TABS.findIndex(t => t.id === activeTab) + 1, TABS.length - 1)].id)}>
            Next <ChevronRight size={11} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function DQPrinciple({ text, color = DS.accent }: { text: string; color?: string }) {
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

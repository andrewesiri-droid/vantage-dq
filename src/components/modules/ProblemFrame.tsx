import { useState, useEffect } from 'react';
import { DS } from '@/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Edit2, Check, X, Target, AlertCircle, Calendar, User, Users, Lightbulb, ChevronRight, Shield, Save } from 'lucide-react';

const FIELDS = [
  { key: 'decisionStatement', label: 'Decision Statement', placeholder: 'How should we [decide] over [timeframe]?', required: true },
  { key: 'context', label: 'Decision Context', placeholder: 'What is the business situation?', rows: 3 },
  { key: 'background', label: 'Background & History', placeholder: 'Relevant history and current state', rows: 2 },
  { key: 'trigger', label: 'Decision Trigger', placeholder: 'What triggered this decision now?', rows: 2 },
  { key: 'scopeIn', label: 'Scope — In', placeholder: 'What is included in this decision?', rows: 2 },
  { key: 'scopeOut', label: 'Scope — Out', placeholder: 'What is explicitly excluded?', rows: 2 },
  { key: 'constraints', label: 'Constraints', placeholder: 'Hard and soft constraints', rows: 2 },
  { key: 'assumptions', label: 'Key Assumptions', placeholder: 'What are we assuming?', rows: 2 },
  { key: 'successCriteria', label: 'Success Criteria', placeholder: 'How will we know we made a good decision?', rows: 2 },
  { key: 'failureConsequences', label: 'Failure Consequences', placeholder: 'What happens if we decide poorly?', rows: 2 },
];

interface Props {
  sessionId?: number;
  data?: any;
  hooks?: any;
}

export function ProblemFrame({ sessionId, data, hooks }: Props) {
  const [editing, setEditing] = useState(false);
  const [dataState, setDataState] = useState<Record<string, string>>({
    decisionStatement: 'How should we expand into the APAC market over the next 3 years?',
    context: 'We operate in North America and Europe. APAC is our largest growth opportunity. The board approved a $25M capital envelope for Year 1.',
    background: 'Company has grown 40% YoY for 4 years. Product-market fit proven in existing markets.',
    trigger: 'Board strategy session approved APAC as priority. CFO confirmed $25M capital envelope.',
    scopeIn: 'Market entry mode, geographic prioritisation, capital allocation, technology localisation.',
    scopeOut: 'Product development for APAC, post-entry operational build-out, talent acquisition.',
    constraints: 'Hard: $25M Year 1 capital ceiling. Board mandate to enter APAC. Soft: preserve flexibility.',
    assumptions: 'APAC TAM is $400M growing 18% p.a. We can achieve product-market fit within 18 months.',
    successCriteria: 'First revenue within 12 months. NPV-positive within 3 years. Optionality preserved.',
    failureConsequences: 'Wasted capital. Missed market window. Competitors lock in market.',
  });
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Sync from database when data loads
  useEffect(() => {
    if (data?.session) {
      const s = data.session;
      setDataState(prev => ({
        ...prev,
        decisionStatement: s.decisionStatement || prev.decisionStatement,
        context: s.context || prev.context,
        background: s.background || prev.background,
        trigger: s.trigger || prev.trigger,
        scopeIn: s.scopeIn || prev.scopeIn,
        scopeOut: s.scopeOut || prev.scopeOut,
        constraints: s.constraints || prev.constraints,
        assumptions: s.assumptions || prev.assumptions,
        successCriteria: s.successCriteria || prev.successCriteria,
        failureConsequences: s.failureConsequences || prev.failureConsequences,
      }));
    }
  }, [data?.session]);

  const startEdit = () => { setEditData({ ...dataState }); setEditing(true); };
  const change = (k: string, v: string) => setEditData(p => ({ ...p, [k]: v }));
  const display = editing ? editData : dataState;

  const saveEdit = async () => {
    setSaving(true);
    setDataState({ ...editData });

    // Save to database if we have a session
    if (sessionId && hooks?.updateSession) {
      await hooks.updateSession({
        id: sessionId,
        data: {
          decisionStatement: editData.decisionStatement,
          context: editData.context,
          background: editData.background,
          trigger: editData.trigger,
          scopeIn: editData.scopeIn,
          scopeOut: editData.scopeOut,
          constraints: editData.constraints,
          assumptions: editData.assumptions,
          successCriteria: editData.successCriteria,
          failureConsequences: editData.failureConsequences,
        },
      });
    }

    setEditing(false);
    setSaving(false);
  };

  const cancelEdit = () => setEditing(false);

  // Frame Check dimensions
  const FRAME_DIMENSIONS = [
    { key: 'question', label: 'Is it a genuine question?', desc: 'A decision statement should be an open question — not a situation description or a preferred answer in disguise.', pass: !!display.decisionStatement && display.decisionStatement.includes('?') },
    { key: 'scope', label: 'Scope is explicitly bounded', desc: 'Both "in scope" and "out of scope" must be clearly stated.', pass: !!(display.scopeIn && display.scopeOut) },
    { key: 'root', label: 'Root problem, not symptom', desc: 'The decision addresses the underlying cause, not a surface symptom.', pass: !!(display.background && display.decisionStatement) },
    { key: 'constraints', label: 'Constraints are explicit', desc: 'Hard and soft constraints are written down, not assumed.', pass: !!display.constraints },
  ];
  const passedCount = FRAME_DIMENSIONS.filter(d => d.pass).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
            <Target size={22} style={{ color: DS.frame.fill }} /> Problem Frame
          </h2>
          <p className="text-xs mt-1" style={{ color: DS.inkTer }}>
            Frame the decision using the dimension checklist
            {sessionId && <span className="ml-2" style={{ color: DS.accent }}>● Synced to database</span>}
          </p>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}><X size={12} /></Button>
            <Button size="sm" onClick={saveEdit} disabled={saving}>
              {saving ? <><span className="animate-spin mr-1">↻</span> Saving...</> : <><Save size={12} /> Save</>}
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={startEdit} className="gap-1"><Edit2 size={12} /> Edit</Button>
        )}
      </div>

      {/* Frame Check */}
      <Card className="overflow-hidden border-0 shadow-lg" style={{ background: `linear-gradient(135deg, ${DS.frame.soft} 0%, ${DS.canvas} 100%)` }}>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} style={{ color: DS.frame.fill }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: DS.frame.text }}>Frame Check — {passedCount}/{FRAME_DIMENSIONS.length} Passed</span>
          </div>
          <div className="space-y-2">
            {FRAME_DIMENSIONS.map(d => (
              <div key={d.key} className="flex items-start gap-2.5 p-2 rounded-lg transition-colors" style={{ background: d.pass ? '#ECFDF5' : DS.warnSoft }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5" style={{ background: d.pass ? '#A7F3D0' : '#FDE68A', color: d.pass ? '#059669' : '#D97706' }}>
                  {d.pass ? '✓' : '!'}
                </div>
                <div>
                  <div className="text-xs font-semibold" style={{ color: DS.ink }}>{d.label}</div>
                  <div className="text-[10px]" style={{ color: DS.inkTer }}>{d.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Decision Statement */}
      <Card className="overflow-hidden border-0 shadow-md" style={{ background: `linear-gradient(135deg, ${DS.accentSoft} 0%, ${DS.canvas} 100%)`, borderLeft: `4px solid ${DS.accent}` }}>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} style={{ color: DS.accent }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#A68A3C' }}>Decision Statement</span>
            {!display.decisionStatement && <Badge variant="outline" className="text-[9px] h-4" style={{ color: DS.danger }}>Required</Badge>}
          </div>
          {editing ? (
            <Textarea value={display.decisionStatement} onChange={e => change('decisionStatement', e.target.value)} className="text-sm bg-white" rows={2} />
          ) : (
            <p className="text-sm font-semibold" style={{ color: DS.ink }}>{display.decisionStatement || <span style={{ color: DS.inkDis }}>No decision statement defined</span>}</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="details">
        <TabsList className="text-[10px]">
          <TabsTrigger value="details" className="text-[10px]">Decision Details</TabsTrigger>
          <TabsTrigger value="meta" className="text-[10px]">Session Meta</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FIELDS.slice(1).map(f => (
              <Card key={f.key} className="border-0 shadow-sm"><CardHeader className="pb-2">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: DS.inkTer }}>
                  <ChevronRight size={10} style={{ color: DS.accent }} />{f.label}
                </CardTitle>
              </CardHeader><CardContent>
                {editing ? (
                  <Textarea value={display[f.key] || ''} onChange={e => change(f.key, e.target.value)} className="text-xs bg-white" rows={f.rows || 2} placeholder={f.placeholder} />
                ) : (
                  <p className="text-xs leading-relaxed" style={{ color: display[f.key] ? DS.inkSub : DS.inkDis }}>{display[f.key] || '—'}</p>
                )}
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="meta" className="mt-3">
          <Card className="border-0 shadow-sm"><CardContent className="pt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Urgency', value: 'High', icon: AlertCircle, color: '#D97706' },
              { label: 'Deadline', value: '14 March', icon: Calendar, color: '#3B82F6' },
              { label: 'Owner', value: 'CSO', icon: User, color: '#0D9488' },
              { label: 'Stakeholders', value: 'CEO, CFO, CTO, Board', icon: Users, color: '#7C3AED' },
            ].map(m => (
              <div key={m.label} className="p-3 rounded-xl" style={{ background: m.color + '08' }}>
                <div className="flex items-center gap-1.5 mb-1.5"><m.icon size={12} style={{ color: m.color }} /><span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: m.color }}>{m.label}</span></div>
                <p className="text-xs font-medium" style={{ color: DS.ink }}>{m.value}</p>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

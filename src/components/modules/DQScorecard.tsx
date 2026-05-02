import { useState, useEffect } from 'react';
import type { ModuleProps } from '@/types';
import { DS, DQ_ELEMENTS, DQ_SCORE_BANDS } from '@/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Award, TrendingUp, Zap, ChevronRight, BrainCircuit, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';

export function DQScorecard({ sessionId, data, hooks }: ModuleProps) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [activeElement, setActiveElement] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (data?.session?.dqScores) {
      setScores(data.session.dqScores);
    } else {
      setScores({ frame: 75, alternatives: 60, information: 45, values: 80, reasoning: 55, commitment: 30 });
    }
  }, [data?.session?.dqScores]);

  const setScore = (key: string, val: number) => {
    const next = { ...scores, [key]: Math.max(0, Math.min(100, val)) };
    setScores(next);
    if (sessionId) {
      hooks?.updateSession?.({ id: sessionId, data: { dqScores: next } });
    }
  };

  const vals = Object.values(scores);
  const overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  const minEntry = Object.entries(scores).sort((a, b) => a[1] - b[1])[0];
  const minEl = minEntry ? DQ_ELEMENTS.find(e => e.key === minEntry[0]) : null;
  const band = DQ_SCORE_BANDS.find(b => overall >= b.min && overall <= b.max) || DQ_SCORE_BANDS[4];

  const CircularGauge = ({ value, size = 140, label }: { value: number; size?: number; label: string }) => {
    const r = (size - 20) / 2; const cx = size / 2; const cy = size / 2;
    const color = value >= 70 ? '#10B981' : value >= 45 ? '#D97706' : '#EF4444';
    const circumference = Math.PI * r;
    const dashOffset = circumference - (value / 100) * circumference;
    return (
      <div className="text-center">
        <svg width={size} height={size} className="mx-auto">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={DS.borderLight} strokeWidth={10} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} transform={`rotate(-90 ${cx} ${cy})`} />
          <text x={cx} y={cy - 5} textAnchor="middle" fontSize={28} fontWeight="800" fill={DS.ink}>{value}</text>
          <text x={cx} y={cy + 15} textAnchor="middle" fontSize={10} fill={DS.inkTer}>out of 100</text>
        </svg>
        <p className="text-xs font-semibold mt-1" style={{ color: DS.ink }}>{label}</p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: DS.ink }}>
            <Award size={22} style={{ color: DS.commitment.fill }} /> DQ Scorecard
          </h2>
          <p className="text-xs mt-1" style={{ color: DS.inkSub }}>Score each element 0–100. A decision is only as strong as its weakest element.</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-[10px] gap-1" onClick={() => setAiOpen(!aiOpen)}>
          <BrainCircuit size={12} /> {aiOpen ? 'Hide AI' : 'AI Analysis'}
        </Button>
      </div>

      {/* AI Panel */}
      {aiOpen && (
        <Card className="border-0 shadow-md" style={{ background: `linear-gradient(135deg, #F5F3FF 0%, #FFFFFF 100%)`, borderLeft: `4px solid #7C3AED` }}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2"><BrainCircuit size={14} style={{ color: '#7C3AED' }} /><span className="text-xs font-bold" style={{ color: '#6D28D9' }}>AI DQ Analysis</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {overall < 50 ? (
                <div className="p-2.5 rounded-lg" style={{ background: '#FEF2F2' }}>
                  <p className="text-[10px] font-semibold" style={{ color: '#DC2626' }}><AlertTriangle size={10} className="inline mr-1" /> Decision Not Ready</p>
                  <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>Overall DQ score of {overall} is below 50. This decision requires significant improvement before commitment.</p>
                </div>
              ) : overall < 70 ? (
                <div className="p-2.5 rounded-lg" style={{ background: '#FFFBEB' }}>
                  <p className="text-[10px] font-semibold" style={{ color: '#D97706' }}><AlertTriangle size={10} className="inline mr-1" /> Decision Adequate</p>
                  <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>Overall DQ score of {overall} is adequate but not strong. Address the weakest element before commitment.</p>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg" style={{ background: '#ECFDF5' }}>
                  <p className="text-[10px] font-semibold" style={{ color: '#059669' }}><CheckCircle2 size={10} className="inline mr-1" /> Decision Strong</p>
                  <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>Overall DQ score of {overall} indicates a well-structured decision. Continue to monitor the weakest element.</p>
                </div>
              )}
              {minEl && (
                <div className="p-2.5 rounded-lg" style={{ background: '#F0FDFA' }}>
                  <p className="text-[10px] font-semibold" style={{ color: '#059669' }}><Lightbulb size={10} className="inline mr-1" /> Priority Action</p>
                  <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>Improve <strong>{minEl.label}</strong> (currently {minEntry[1]}). This is your biggest lever for increasing overall decision quality.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-lg" style={{ background: `linear-gradient(135deg, ${band.soft} 0%, ${DS.canvas} 100%)`, borderTop: `4px solid ${band.color}` }}>
          <CardContent className="pt-5"><CircularGauge value={overall} label="Overall DQ Score" /></CardContent>
        </Card>
        <Card className="border-0 shadow-md"><CardContent className="pt-5 text-center">
          <div className="text-4xl font-extrabold" style={{ color: band.color }}>{band.label}</div>
          <p className="text-xs mt-1 px-4" style={{ color: DS.inkSub }}>{band.desc}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-2"><TrendingUp size={14} style={{ color: DS.danger }} /><span className="text-xs font-bold" style={{ color: DS.ink }}>Weakest Element</span></div>
          {minEl && <>
            <div className="text-3xl font-bold" style={{ color: minEl.color }}>{minEntry[1]}</div>
            <p className="text-xs mt-1 font-medium" style={{ color: minEl.color }}>{minEl.label}</p>
            <p className="text-[10px] mt-1" style={{ color: DS.inkTer }}>This is your priority for improvement.</p>
          </>}
        </CardContent></Card>
      </div>

      <Tabs defaultValue="score">
        <TabsList className="text-[10px]"><TabsTrigger value="score" className="text-[10px]">Score</TabsTrigger><TabsTrigger value="chain" className="text-[10px]">Chain View</TabsTrigger></TabsList>

        <TabsContent value="score" className="mt-3 space-y-2">
          {DQ_ELEMENTS.map(el => (
            <Card key={el.key} className="overflow-hidden cursor-pointer border-0 shadow-sm hover:shadow-md transition-all" style={{ borderLeft: `3px solid ${activeElement === el.key ? el.fill : 'transparent'}` }} onClick={() => setActiveElement(el.key)}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0" style={{ background: el.soft, color: el.fill }}>{scores[el.key] !== undefined ? scores[el.key] : el.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold" style={{ color: DS.ink }}>{el.num} {el.label}</span>
                      <Badge style={{ background: el.soft, color: el.fill, borderColor: el.line }} variant="outline" className="text-[9px]">
                        {(scores[el.key] || 0) >= 70 ? 'Strong' : (scores[el.key] || 0) >= 45 ? 'Adequate' : (scores[el.key] || 0) > 0 ? 'Weak' : 'Unscored'}
                      </Badge>
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: DS.inkSub }}>{el.desc}</p>
                    {activeElement === el.key && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="range" min={0} max={100} value={scores[el.key] || 0} onChange={e => setScore(el.key, parseInt(e.target.value))} className="flex-1 h-2 rounded-full appearance-none" style={{ accentColor: el.fill }} />
                          <span className="text-sm font-bold w-10 text-right" style={{ color: el.fill }}>{scores[el.key] || 0}</span>
                        </div>
                        <div className="space-y-1">
                          {el.questions.map((q, i) => <div key={i} className="flex items-start gap-1.5 text-[10px]" style={{ color: DS.inkSub }}><ChevronRight size={8} style={{ color: el.fill }} className="shrink-0 mt-0.5" /><span>{q}</span></div>)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="chain" className="mt-3">
          <Card className="border-0 shadow-md"><CardContent className="p-4">
            <div className="flex items-center justify-between py-4 overflow-x-auto gap-1">
              {DQ_ELEMENTS.map((el, i) => {
                const v = scores[el.key] || 0;
                return (
                  <div key={el.key} className="flex items-center shrink-0">
                    <div className="flex flex-col items-center cursor-pointer group" onClick={() => setActiveElement(el.key)}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all"
                        style={{ background: v > 0 ? el.soft : DS.bg, borderColor: v > 0 ? el.fill : DS.borderLight, color: v > 0 ? el.fill : DS.inkDis }}>
                        {v > 0 ? v : el.icon}
                      </div>
                      <span className="text-[9px] font-medium mt-1.5 max-w-[60px] text-center leading-tight" style={{ color: v > 0 ? el.fill : DS.inkDis }}>{el.short}</span>
                    </div>
                    {i < DQ_ELEMENTS.length - 1 && <div className="w-6 h-0.5 mx-1" style={{ background: DS.borderLight }} />}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-center mt-2" style={{ color: DS.inkTer }}>A decision is only as strong as its weakest link. Click any element to score it.</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

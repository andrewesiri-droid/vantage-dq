import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { trpc } from '@/providers/trpc';
import { DS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Brain, Upload, FileText, ChevronLeft, Zap,
  CheckCircle, AlertTriangle, Loader2, X
} from 'lucide-react';

interface AIDeepDiveProps { onBack: () => void; }

export function AIDeepDive({ onBack }: AIDeepDiveProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<'input' | 'analysing' | 'results'>('input');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const analyzeMutation = trpc.aiDeepDive.analyze.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setStep('results');
    },
    onError: (err) => {
      setError(err.message);
      setStep('input');
    },
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string || '';
      setContent(text);
      if (!name) {
        // Auto-generate name from first line or filename
        const firstLine = text.split('\n')[0].trim().slice(0, 60);
        setName(firstLine || file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsText(file);
  }, [name]);

  const handleAnalyze = () => {
    if (!name.trim() || !content.trim()) return;
    setError('');
    setStep('analysing');
    analyzeMutation.mutate({ name: name.trim(), content: content.trim() });
  };

  const handleGoToSession = () => {
    if (result?.slug) {
      navigate(`/session/${result.slug}`);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: DS.bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background: DS.brand }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ChevronLeft size={16} className="text-white/70" />
          </button>
          <div className="flex items-center gap-2">
            <Brain size={16} style={{ color: '#7C3AED' }} />
            <span className="text-sm font-bold text-white">AI Deep Dive Analysis</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40">Step</span>
          <span className="text-[10px] font-bold text-white/80">{step === 'input' ? '1 of 2' : step === 'analysing' ? '2 of 2' : 'Complete'}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {step === 'input' && (
          <div className="space-y-6">
            {/* Title */}
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: DS.ink }}>Upload or paste your decision background</h2>
              <p className="text-xs" style={{ color: DS.inkSub }}>
                Our AI will analyse the content and extract decision elements — issues, stakeholders, risks, and more.
              </p>
            </div>

            {/* Session name */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: DS.inkTer }}>Session Name</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., APAC Market Entry Q3 2026"
                className="text-sm"
              />
            </div>

            {/* File upload + text area */}
            <Card className="border-0 shadow-md">
              <CardContent className="pt-5 space-y-4">
                {/* Upload area */}
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                  style={{ borderColor: DS.borderLight, background: DS.canvas }}
                >
                  <Upload size={24} className="mx-auto mb-2" style={{ color: '#7C3AED' }} />
                  <p className="text-xs font-medium mb-1" style={{ color: DS.ink }}>Click to upload a document</p>
                  <p className="text-[10px]" style={{ color: DS.inkTer }}>Supports .txt, .md, .doc (text extraction)</p>
                  <input ref={fileRef} type="file" accept=".txt,.md,.doc,.docx" className="hidden" onChange={handleFileUpload} />
                </div>

                {/* Or divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: DS.borderLight }} />
                  <span className="text-[10px]" style={{ color: DS.inkTer }}>OR PASTE TEXT</span>
                  <div className="flex-1 h-px" style={{ background: DS.borderLight }} />
                </div>

                {/* Text area */}
                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Paste background information, email chains, meeting notes, or decision memos here..."
                  className="text-xs min-h-[200px]"
                />
                <p className="text-[10px] text-right" style={{ color: DS.inkTer }}>{content.length.toLocaleString()} characters</p>
              </CardContent>
            </Card>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: '#FEF2F2' }}>
                <AlertTriangle size={14} style={{ color: '#DC2626' }} />
                <span className="text-xs" style={{ color: '#DC2626' }}>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={onBack} className="text-xs gap-1">
                <ChevronLeft size={14} /> Back
              </Button>
              <Button
                size="sm"
                className="text-xs gap-2"
                style={{ background: '#7C3AED' }}
                onClick={handleAnalyze}
                disabled={!name.trim() || !content.trim() || content.length < 10}
              >
                <Brain size={14} /> Analyse & Generate DQ Draft
              </Button>
            </div>
          </div>
        )}

        {step === 'analysing' && (
          <div className="text-center py-20">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full" style={{ background: '#7C3AED', opacity: 0.1 }} />
              <div className="absolute inset-2 rounded-full flex items-center justify-center" style={{ background: '#7C3AED', opacity: 0.15 }}>
                <Brain size={24} style={{ color: '#7C3AED' }} />
              </div>
              <div className="absolute inset-0 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: DS.ink }}>Analysing your decision background</h3>
            <p className="text-xs max-w-sm mx-auto" style={{ color: DS.inkSub }}>
              Extracting decision elements, identifying issues, mapping stakeholders, assessing risks, and generating a DQ scorecard baseline...
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              {['Reading content', 'Extracting elements', 'Scoring DQ dimensions', 'Building session'].map((label, i) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: i < 2 ? '#7C3AED' : DS.borderLight }}>
                    {i < 2 ? <CheckCircle size={10} className="text-white" /> : <Loader2 size={10} style={{ color: DS.inkDis }} />}
                  </div>
                  <span className="text-[10px]" style={{ color: i < 2 ? DS.ink : DS.inkDis }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'results' && result && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: '#ECFDF5' }}>
                <CheckCircle size={24} style={{ color: '#059669' }} />
              </div>
              <h3 className="text-lg font-bold mb-1" style={{ color: DS.ink }}>DQ First Draft Generated</h3>
              <p className="text-xs" style={{ color: DS.inkSub }}>{result.summary}</p>
            </div>

            {/* Generated elements */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Issues', icon: AlertTriangle, value: result.issuesCount || 'Multiple', color: '#D97706' },
                { label: 'Decisions', icon: FileText, value: result.decisionsCount || 'Multiple', color: '#2563EB' },
                { label: 'Stakeholders', icon: Brain, value: result.stakeholdersCount || 'Mapped', color: '#7C3AED' },
                { label: 'Risks', icon: Zap, value: result.risksCount || 'Identified', color: '#DC2626' },
              ].map(item => (
                <Card key={item.label} className="border-0 shadow-sm">
                  <CardContent className="p-3 text-center">
                    <item.icon size={16} className="mx-auto mb-1.5" style={{ color: item.color }} />
                    <p className="text-sm font-bold" style={{ color: item.color }}>{item.value}</p>
                    <p className="text-[10px]" style={{ color: DS.inkSub }}>{item.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* DQ Score preview */}
            {result.elementScores && Object.keys(result.elementScores).length > 0 && (
              <Card className="border-0 shadow-md">
                <CardContent className="pt-5">
                  <p className="text-xs font-bold mb-3" style={{ color: DS.ink }}>Initial DQ Scores (AI-estimated)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(result.elementScores as Record<string, number>).map(([key, score]) => {
                      const labels: Record<string, string> = {
                        frame: 'Frame', alternatives: 'Alternatives', information: 'Information',
                        values: 'Values', reasoning: 'Reasoning', commitment: 'Commitment',
                      };
                      const colors: Record<string, string> = {
                        frame: '#C9A84C', alternatives: '#2563EB', information: '#7C3AED',
                        values: '#059669', reasoning: '#0891B2', commitment: '#DC2626',
                      };
                      return (
                        <div key={key} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: DS.canvas }}>
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[key] || '#94A3B8' }} />
                          <span className="text-[10px] flex-1" style={{ color: DS.inkSub }}>{labels[key] || key}</span>
                          <span className="text-xs font-bold" style={{ color: colors[key] || '#94A3B8' }}>{score}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setStep('input')} className="text-xs gap-1">
                <X size={14} /> Start Over
              </Button>
              <Button
                size="sm"
                className="text-xs gap-2"
                style={{ background: '#059669' }}
                onClick={handleGoToSession}
              >
                <CheckCircle size={14} /> Review & Edit Session
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

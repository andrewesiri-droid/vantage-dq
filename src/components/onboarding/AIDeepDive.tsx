import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { DS } from '@/constants';
import { createSession } from '@/lib/supabase-client';
import { supabase } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Brain, ChevronLeft, Upload, Loader2, CheckCircle, FileText } from 'lucide-react';

interface AIDeepDiveProps { onBack: () => void; }

export function AIDeepDive({ onBack }: AIDeepDiveProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<'input' | 'analysing' | 'results'>('input');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [result, setResult] = useState<{ slug: string } | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) || '';
      setContent(text);
      if (!name) {
        const firstLine = text.split('\n')[0].trim().slice(0, 60);
        setName(firstLine || file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsText(file);
  }, [name]);

  const handleAnalyze = async () => {
    if (!name.trim() || !content.trim()) return;
    setError('');
    setStep('analysing');
    try {
      const prompt = `You are a Decision Quality analyst. Extract a structured decision frame from this document.

DOCUMENT:
${content.slice(0, 8000)}

Extract and return JSON only — no other text:
{
  "name": "short session name (max 50 chars)",
  "decisionStatement": "Which specific option should we choose... (clear decision question)",
  "context": "situation and background (2-3 sentences)",
  "constraints": "key hard limits and boundaries",
  "successCriteria": "what a good outcome looks like"
}`;

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, module: 'ai-deep-dive' }),
      });
      console.log('[DeepDive] API status:', res.status);
      if (!res.ok) {
        const errText = await res.text();
        console.error('[DeepDive] API error:', errText);
        throw new Error('API error ' + res.status + ': ' + errText);
      }
      const d = await res.json();
      console.log('[DeepDive] Raw response:', JSON.stringify(d).slice(0, 500));
      const raw = (d.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      console.log('[DeepDive] Cleaned text:', raw.slice(0, 300));
      const match = raw.match(/\{[\s\S]*\}/);
      console.log('[DeepDive] JSON match:', match ? 'found' : 'NOT FOUND');
      if (!match) throw new Error('No JSON in response. Raw: ' + raw.slice(0, 200));
      const parsed = JSON.parse(match[0]);
      console.log('[DeepDive] Parsed:', JSON.stringify(parsed).slice(0, 300));
      if (!parsed.decisionStatement) throw new Error('No decisionStatement in: ' + JSON.stringify(parsed).slice(0, 200));

      console.log('[DeepDive] Creating session...');
      const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
      console.log('[DeepDive] User:', user?.email || 'unauthenticated');
      const slug = await createSession(parsed.name || name, user?.email, user?.id);
      console.log('[DeepDive] Session slug:', slug);
      // Write extracted data to session
      try {
        if (supabase && user) {
          await supabase.from('dq_sessions').update({
            decision_statement: parsed.decisionStatement || '',
            context: parsed.context || '',
            constraints: parsed.constraints || '',
            success_criteria: parsed.successCriteria || '',
            updated_at: new Date().toISOString(),
          }).eq('slug', slug);
        }
        // Write to vantage_dq_demo_sessions so DemoSessionPage can read it
        const demoStored = JSON.parse(localStorage.getItem('vantage_dq_demo_sessions') || '{}');
        if (demoStored.sessions && demoStored.sessions[0]) {
          demoStored.sessions[0].decisionStatement = parsed.decisionStatement || '';
          demoStored.sessions[0].context = parsed.context || '';
          demoStored.sessions[0].constraints = parsed.constraints || '';
          demoStored.sessions[0].successCriteria = parsed.successCriteria || '';
          demoStored.sessions[0].name = parsed.name || name;
          localStorage.setItem('vantage_dq_demo_sessions', JSON.stringify(demoStored));
        }
        console.log('[DeepDive] Session data written');
      } catch(e) { console.error('[DeepDive] Write error:', e); }

      // Fix 2: Auto-generate DQ issues from the document
      try {
        console.log('[DeepDive] Generating issues...');
        const issueParts = ['You are a DQ facilitator. Generate 8 DQ issues for this decision.', 'Decision: ' + parsed.decisionStatement, 'Context: ' + (parsed.context || '').slice(0, 300), 'Return JSON only: { "issues": [{ "text": "string", "category": "uncertainty-external|uncertainty-internal|stakeholder-concern|assumption|information-gap|constraint|brutal-truth", "severity": "Critical|High|Medium|Low" }] }'];
        const issuePrompt = issueParts.join(' ');
        const issueRes = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: issuePrompt, module: 'issue-generation' }),
        });
        const issueData = await issueRes.json();
        const issueRaw = (issueData.result || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        const issueMatch = issueRaw.match(/\{[\s\S]*\}/);
        if (issueMatch) {
          const issuesParsed = JSON.parse(issueMatch[0]);
          const issues = issuesParsed.issues || [];
          // Store issues in localStorage for local sessions
          // Write issues to vantage_dq_demo_sessions
          const demoData = JSON.parse(localStorage.getItem('vantage_dq_demo_sessions') || '{}');
          demoData.issues = issues.map((iss: any, idx: number) => ({
            id: Date.now() + idx, session_id: 1, text: iss.text,
            category: iss.category || 'uncertainty-external',
            severity: iss.severity || 'High', status: 'open', votes: 0,
            owner: '', description: '', sort_order: idx,
          }));
          localStorage.setItem('vantage_dq_demo_sessions', JSON.stringify(demoData));
          console.log('[DeepDive] Generated', issues.length, 'issues');
        }
      } catch(e) { console.error('[DeepDive] Issue generation error:', e); }

      console.log('[DeepDive] Success! Navigating to:', slug);
      setResult({ slug });
      setStep('results');
    } catch (err: any) {
      console.error('[DeepDive] Failed:', err);
      setError('Analysis failed: ' + (err instanceof Error ? err.message : String(err)));
      setStep('input');
    }
  };

  if (step === 'analysing') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: DS.bg }}>
        <div className="text-center">
          <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: DS.accent }} />
          <h3 className="text-lg font-bold" style={{ color: DS.ink }}>Analysing document...</h3>
          <p className="text-xs mt-1" style={{ color: DS.inkSub }}>Extracting decision frame with AI</p>
        </div>
      </div>
    );
  }

  if (step === 'results' && result) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: DS.bg }}>
        <div className="text-center max-w-sm px-6">
          <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: '#ECFDF5' }}>
            <CheckCircle size={24} style={{ color: '#059669' }} />
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: DS.ink }}>Session Ready</h3>
          <p className="text-xs mb-6" style={{ color: DS.inkSub }}>AI has pre-populated your decision frame. Review and refine each module.</p>
          <Button className="gap-2" style={{ background: '#059669' }} onClick={() => navigate(`/session/${result.slug}`)}>
            <CheckCircle size={14} /> Open Session
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: DS.bg }}>
      <div className="flex items-center px-6 py-4 border-b" style={{ background: DS.brand }}>
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft size={16} className="text-white/70" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <Brain size={16} style={{ color: '#C9A84C' }} />
          <span className="text-sm font-bold text-white">AI Deep Dive</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-10 space-y-5">
        <div>
          <h2 className="text-xl font-bold mb-1" style={{ color: DS.ink }}>AI Deep Dive</h2>
          <p className="text-sm" style={{ color: DS.inkSub }}>Paste a document or upload a file. AI extracts the decision frame automatically.</p>
        </div>

        <div>
          <label htmlFor="session-name" className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: DS.inkTer }}>SESSION NAME</label>
          <Input id="session-name" name="session-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Product Strategy 2026" />
        </div>

        <div>
          <label htmlFor="doc-content" className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: DS.inkTer }}>DOCUMENT CONTENT</label>
          <Textarea
            id="doc-content"
            name="doc-content"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Paste your board paper, strategy doc, or meeting transcript here..."
            rows={8}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => fileRef.current?.click()}>
            <Upload size={12} /> Upload File
          </Button>
          <input ref={fileRef} id="file-upload" name="file-upload" type="file" className="hidden" accept=".txt,.md,.pdf,.doc,.docx" onChange={handleFileUpload} aria-label="Upload document file" />
          {content && <span className="text-xs" style={{ color: DS.inkDis }}>{content.length.toLocaleString()} chars</span>}
        </div>

        {error && <p className="text-xs" style={{ color: DS.danger }}>{error}</p>}

        <Button className="w-full h-11 font-bold gap-2" style={{ background: DS.accent }} onClick={handleAnalyze} disabled={!name.trim() || !content.trim()}>
          <Brain size={14} /> Run Deep Dive
        </Button>
      </div>
    </div>
  );
}

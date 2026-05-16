import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import { MessageSquare, ArrowRight, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import type { ReviewQueueItem } from '../../types/entities';

interface Props {
  onComplete: (sessionName: string, items: ReviewQueueItem[], sourceDocument: string, aiMeta: any) => void;
  onBack: () => void;
}

interface Answers {
  q1: string; // What decision?
  q2: string; // Why now?
  q3: string; // What options?
  q4: string; // Biggest uncertainties/risks?
  q5: string; // How will you judge success?
}

const QUESTIONS = [
  {
    id: 'q1' as keyof Answers,
    number: 1,
    title: 'What decision are you trying to make?',
    subtitle: 'Capture the core decision, decision owner, and context.',
    placeholder: 'Describe the decision you need to make, who owns it, and what is driving it. Be as specific as you can.',
    hint: 'e.g. "We need to decide whether to develop the Stark offshore lease independently or seek farm-in partners. The decision owner is the investment committee and we have 6 months before our drilling obligations expire."',
    rows: 4,
  },
  {
    id: 'q2' as keyof Answers,
    number: 2,
    title: 'Why does this decision matter now?',
    subtitle: 'Capture trigger, urgency, consequences, and business value.',
    placeholder: 'What is forcing this decision at this time? What happens if you delay? What is at stake?',
    hint: 'e.g. "Our drilling obligation expires in Q3. If we miss it we lose the licence. The asset could be worth $200M+ if the Pepper prospect delivers — but we cannot fund development alone."',
    rows: 4,
  },
  {
    id: 'q3' as keyof Answers,
    number: 3,
    title: 'What options or strategies are being considered?',
    subtitle: 'Capture known alternatives, or note that they need to be generated.',
    placeholder: 'List the strategic options on the table. If you don\'t have clear options yet, describe the strategic space.',
    hint: 'e.g. "Option 1: Develop independently with FPSO. Option 2: Farm down to 30% and bring in a major. Option 3: Appraise Pepper before committing to development. Option 4: Exit and sell the licence."',
    rows: 4,
  },
  {
    id: 'q4' as keyof Answers,
    number: 4,
    title: 'What are the biggest uncertainties, risks, or disagreements?',
    subtitle: 'Capture key unknowns, risks, stakeholder tensions, and information gaps.',
    placeholder: 'What keeps you up at night? What could change the answer? Where is there disagreement on the team?',
    hint: 'e.g. "We don\'t know if Pepper reservoir is commercial. Government take negotiations are uncertain (40-70%). The board disagrees on risk appetite. We need partners but the market is soft."',
    rows: 4,
  },
  {
    id: 'q5' as keyof Answers,
    number: 5,
    title: 'How will you judge a good decision?',
    subtitle: 'Capture success criteria, value drivers, constraints, and trade-offs.',
    placeholder: 'What criteria will you use to compare options? What are the hard constraints? What trade-offs are acceptable?',
    hint: 'e.g. "Maximize risk-adjusted NPV. Retain operatorship if possible. Budget cap of $50M equity. Must complete before Q3 deadline. Preserve relationship with government as a constraint."',
    rows: 4,
  },
];

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
      system: 'You are a Decision Quality facilitator. Create a structured DQ assessment from the user\'s answers. Respond ONLY with valid JSON.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const raw = data.content?.find((b: any) => b.type === 'text')?.text ?? '';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

export default function FiveQuestionStart({ onComplete, onBack }: Props) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ q1: '', q2: '', q3: '', q4: '', q5: '' });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  const currentQuestion = QUESTIONS[currentQ];
  const currentAnswer = answers[currentQuestion.id];
  const isAnswered = currentAnswer.trim().length > 20;
  const isLast = currentQ === QUESTIONS.length - 1;
  const allAnswered = Object.values(answers).every(a => a.trim().length > 20);

  const handleNext = () => {
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(q => q + 1);
      setShowHint(false);
    }
  };

  const handleBack = () => {
    if (currentQ > 0) { setCurrentQ(q => q - 1); setShowHint(false); }
    else onBack();
  };

  const handleGenerate = useCallback(async () => {
    setAiLoading(true); setAiError(null);

    const prompt = `You are a DQ facilitator. A user has answered 5 questions to start a decision process. Create a structured initial DQ assessment.

QUESTION 1 — What decision?
${answers.q1}

QUESTION 2 — Why now?
${answers.q2}

QUESTION 3 — What options?
${answers.q3}

QUESTION 4 — Biggest uncertainties/risks?
${answers.q4}

QUESTION 5 — How to judge success?
${answers.q5}

Extract a complete initial DQ assessment. Be conservative — only extract what is clearly stated or strongly implied.

Return ONLY valid JSON:
{
  "sessionName": "Short descriptive name for this decision session",
  "decisionStatement": "Well-formed decision question starting with How should / Whether to / What strategy should",
  "context": "Key background context",
  "trigger": "Why this decision is needed now",
  "decisionOwner": "Who owns this decision or null",
  "scopeIn": ["in scope item"],
  "scopeOut": ["out of scope item"],
  "constraints": ["hard constraint"],
  "assumptions": ["assumption"],
  "successCriteria": ["evaluation criterion"],
  "failureConsequences": "What happens if the decision is wrong",
  "initialIssues": [
    { "title": "issue title", "classification": "uncertainty|risk|strategic_decision|assumption", "category": "strategic|commercial|technical|stakeholder|financial" }
  ],
  "strategyCandidates": [
    { "name": "strategy name", "rationale": "why this strategy" }
  ],
  "uncertainties": ["key uncertainty"],
  "risks": ["key risk"],
  "dataGaps": ["what information is missing"],
  "suggestedNextActions": ["what to do first"],
  "confidenceScore": 0.7,
  "humanReviewFlags": ["what needs user validation"]
}`;

    try {
      const result = await callAI(prompt);
      const now = new Date().toISOString();
      const makeId = () => `rq_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;

      const items: ReviewQueueItem[] = [];

      // Problem frame
      items.push({
        id: makeId(), session_id: '__pending__',
        targetType: 'problem_frame', targetModule: 'problem',
        data: {
          decisionStatement: result.decisionStatement,
          context: result.context,
          decisionOwner: result.decisionOwner,
          trigger: result.trigger,
          scopeIn: result.scopeIn ?? [],
          scopeOut: result.scopeOut ?? [],
          givens: [],
          constraints: result.constraints ?? [],
          assumptions: result.assumptions ?? [],
          successCriteria: result.successCriteria ?? [],
          failureConsequences: result.failureConsequences,
        },
        confidenceScore: result.confidenceScore ?? 0.7,
        extractionRationale: 'Generated from 5-question guided start.',
        status: 'pending', created_at: now,
        createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
      } as any);

      // Issues
      (result.initialIssues ?? []).forEach((issue: any) => {
        items.push({
          id: makeId(), session_id: '__pending__',
          targetType: 'issue', targetModule: 'issues',
          data: { title: issue.title, classification: issue.classification, category: issue.category },
          confidenceScore: 0.7,
          extractionRationale: 'Extracted from user answers.',
          status: 'pending', created_at: now,
          createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
        } as any);
      });

      // Strategies
      (result.strategyCandidates ?? []).forEach((s: any) => {
        items.push({
          id: makeId(), session_id: '__pending__',
          targetType: 'strategy', targetModule: 'strategy',
          data: { name: s.name, rationale: s.rationale },
          confidenceScore: 0.65,
          extractionRationale: 'Candidate strategy from user input.',
          status: 'pending', created_at: now,
          createdBy: 'document_extraction', reviewStatus: 'ai_suggested',
        } as any);
      });

      onComplete(
        result.sessionName ?? 'New Decision Session',
        items,
        '',
        {
          sourceMode: 'five_question_start',
          dataUsed: ['5-question guided answers'],
          missingData: result.dataGaps ?? [],
          assumptionsMade: [],
          suggestedNextActions: result.suggestedNextActions ?? [],
          humanReviewFlags: result.humanReviewFlags ?? [],
          confidenceScore: result.confidenceScore,
        }
      );
    } catch (e: any) {
      setAiError(e.message);
      setAiLoading(false);
    }
  }, [answers, onComplete]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: '#0B1D3A', fontFamily: DS.fontDisplay }}>

      <div className="w-full max-w-xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <button onClick={handleBack} className="flex items-center gap-1.5 text-xs mb-6"
            style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}>
            ← {currentQ === 0 ? 'Back to start' : 'Previous question'}
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: '#FEF3C7' }}>💬</div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#F8FAFC' }}>5-Question Start</h1>
              <p className="text-sm" style={{ color: '#64748B' }}>Answer 5 questions to build your DQ framework</p>
            </div>
          </div>
        </motion.div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-8">
          {QUESTIONS.map((_, i) => (
            <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <motion.div className="h-full rounded-full"
                style={{ background: i < currentQ ? '#D97706' : i === currentQ ? '#F59E0B' : 'transparent' }}
                animate={{ width: i <= currentQ ? '100%' : '0%' }}
                transition={{ duration: 0.3 }} />
            </div>
          ))}
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl p-6 space-y-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(217,119,6,0.2)', color: '#F59E0B' }}>
                  Question {currentQuestion.number} of {QUESTIONS.length}
                </span>
              </div>
              <h2 className="text-lg font-bold mb-1" style={{ color: '#F8FAFC' }}>
                {currentQuestion.title}
              </h2>
              <p className="text-sm" style={{ color: '#64748B' }}>{currentQuestion.subtitle}</p>
            </div>

            <textarea
              autoFocus
              rows={currentQuestion.rows}
              value={currentAnswer}
              onChange={e => setAnswers(a => ({ ...a, [currentQuestion.id]: e.target.value }))}
              placeholder={currentQuestion.placeholder}
              className="w-full rounded-xl px-4 py-3 text-sm resize-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1.5px solid ${isAnswered ? '#D97706' : 'rgba(255,255,255,0.1)'}`,
                color: '#F8FAFC', outline: 'none', lineHeight: '1.6',
              }}
            />

            {/* Hint */}
            <button onClick={() => setShowHint(s => !s)}
              className="text-xs flex items-center gap-1.5"
              style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Sparkles size={12} style={{ color: '#D97706' }} />
              {showHint ? 'Hide example' : 'Show example answer'}
            </button>

            <AnimatePresence>
              {showHint && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl p-3"
                  style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.15)' }}>
                  <p className="text-xs italic" style={{ color: '#D97706', lineHeight: '1.6' }}>
                    {currentQuestion.hint}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
              {!isLast ? (
                <button onClick={handleNext} disabled={!isAnswered}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                  style={{
                    background: isAnswered ? '#D97706' : 'rgba(255,255,255,0.04)',
                    color: isAnswered ? '#fff' : '#334155',
                    cursor: isAnswered ? 'pointer' : 'not-allowed',
                  }}>
                  Next Question <ArrowRight size={16} />
                </button>
              ) : (
                <button onClick={handleGenerate} disabled={!allAnswered || aiLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                  style={{
                    background: allAnswered && !aiLoading ? '#D97706' : 'rgba(255,255,255,0.04)',
                    color: allAnswered && !aiLoading ? '#fff' : '#334155',
                    cursor: allAnswered && !aiLoading ? 'pointer' : 'not-allowed',
                    boxShadow: allAnswered && !aiLoading ? '0 4px 14px rgba(217,119,6,0.3)' : 'none',
                  }}>
                  {aiLoading ? (
                    <>
                      <motion.div className="w-4 h-4 rounded-full border-2"
                        style={{ borderColor: '#fff', borderTopColor: 'transparent' }}
                        animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
                      Building your DQ framework…
                    </>
                  ) : (
                    <><Sparkles size={16} /> Generate DQ Framework</>
                  )}
                </button>
              )}
            </div>

            {aiError && (
              <p className="text-xs" style={{ color: '#DC2626' }}>Error: {aiError}</p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Answer summary */}
        {currentQ > 0 && (
          <div className="mt-4 space-y-1">
            {QUESTIONS.slice(0, currentQ).map(q => (
              <div key={q.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <CheckCircle2 size={12} style={{ color: '#D97706', flexShrink: 0 }} />
                <p className="text-xs truncate" style={{ color: '#475569' }}>
                  Q{q.number}: {answers[q.id].slice(0, 60)}{answers[q.id].length > 60 ? '…' : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DS } from '@/constants';
import {
  PenLine, ArrowRight, CheckCircle2, Sparkles,
  Target, ChevronRight,
} from 'lucide-react';
import type { ReviewQueueItem } from '../../types/entities';

interface Props {
  onComplete: (sessionName: string, items: ReviewQueueItem[], sourceDocument: string, aiMeta: any) => void;
  onBack: () => void;
}

export default function BlankSlate({ onComplete, onBack }: Props) {
  const [sessionName, setSessionName] = useState('');
  const [decisionStatement, setDecisionStatement] = useState('');
  const [decisionOwner, setDecisionOwner] = useState('');
  const [deadline, setDeadline] = useState('');
  const [ready, setReady] = useState(false);

  const handleStart = useCallback(() => {
    if (!sessionName.trim() || !decisionStatement.trim()) return;

    // Create a minimal problem frame item for the session
    const now = new Date().toISOString();
    const makeId = () => `rq_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;

    const items: ReviewQueueItem[] = [
      {
        id: makeId(),
        session_id: '__pending__',
        targetType: 'problem_frame',
        targetModule: 'problem',
        data: {
          decisionStatement: decisionStatement.trim(),
          context: '',
          decisionOwner: decisionOwner.trim() || null,
          trigger: '',
          scopeIn: [],
          scopeOut: [],
          givens: [],
          constraints: [],
          successCriteria: [],
          deadline: deadline.trim() || null,
        },
        confidenceScore: 1.0,
        extractionRationale: 'Entered directly by user — Blank Slate start.',
        status: 'accepted',
        created_at: now,
        createdBy: 'user',
        reviewStatus: 'user_validated',
      } as any,
    ];

    onComplete(
      sessionName.trim(),
      items,
      '',
      {
        sourceMode: 'blank_slate',
        dataUsed: ['User manual input'],
        missingData: ['Context', 'Trigger', 'Scope', 'Constraints', 'Success criteria'],
        assumptionsMade: [],
        suggestedNextActions: ['Complete Problem Frame', 'Raise Issues', 'Build Decision Hierarchy'],
      }
    );
  }, [sessionName, decisionStatement, decisionOwner, deadline, onComplete]);

  const isValid = sessionName.trim().length > 2 && decisionStatement.trim().length > 10;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: '#0B1D3A', fontFamily: DS.fontDisplay }}>

      <div className="w-full max-w-xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs mb-6"
            style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Back to start
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: '#ECFDF5' }}>✏️</div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#F8FAFC' }}>Blank Slate</h1>
              <p className="text-sm" style={{ color: '#64748B' }}>Start your DQ process manually</p>
            </div>
          </div>
          <p className="text-sm" style={{ color: '#475569', lineHeight: '1.6' }}>
            Enter a few basics to create your session. You'll complete each module step by step, 
            with AI assistance available throughout.
          </p>
        </motion.div>

        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-6 space-y-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>

          {/* Session name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: '#64748B' }}>
              Session Name <span style={{ color: '#4F6AF5' }}>*</span>
            </label>
            <input
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              placeholder="e.g. Market Entry Strategy 2026 or Product Launch Decision"
              className="w-full rounded-xl px-4 py-3 text-sm"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1.5px solid ${sessionName.length > 2 ? '#059669' : 'rgba(255,255,255,0.1)'}`,
                color: '#F8FAFC', outline: 'none', lineHeight: '1.5',
              }}
            />
          </div>

          {/* Decision statement */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: '#64748B' }}>
              Decision Statement <span style={{ color: '#4F6AF5' }}>*</span>
            </label>
            <textarea
              rows={3}
              value={decisionStatement}
              onChange={e => setDecisionStatement(e.target.value)}
              placeholder='How should [team] [action] in order to [outcome]? — e.g. "How should [Company] decide whether to [option A] or [option B] given [constraint]?"'
              className="w-full rounded-xl px-4 py-3 text-sm resize-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1.5px solid ${decisionStatement.length > 10 ? '#059669' : 'rgba(255,255,255,0.1)'}`,
                color: '#F8FAFC', outline: 'none', lineHeight: '1.6',
              }}
            />
            <p className="text-xs mt-1" style={{ color: '#334155' }}>
              Start with "How should…", "Whether to…", or "What strategy should…"
            </p>
          </div>

          {/* Optional fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: '#64748B' }}>Decision Owner</label>
              <input
                value={decisionOwner}
                onChange={e => setDecisionOwner(e.target.value)}
                placeholder="e.g. CEO, Investment Committee"
                className="w-full rounded-xl px-3 py-2.5 text-sm"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#F8FAFC', outline: 'none',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: '#64748B' }}>Decision Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#F8FAFC', outline: 'none',
                  colorScheme: 'dark',
                }}
              />
            </div>
          </div>

          {/* What you'll do */}
          <div className="rounded-xl p-4" style={{ background: 'rgba(79,106,245,0.08)', border: '1px solid rgba(79,106,245,0.15)' }}>
            <p className="text-xs font-bold mb-2" style={{ color: '#818CF8' }}>📋 What happens next</p>
            <div className="space-y-1.5">
              {[
                'Your session opens with the Problem Frame module',
                'Complete each module at your own pace',
                'AI assistance available in every module',
                'Modules unlock as upstream data is validated',
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#4F6AF5' }} />
                  <p className="text-xs" style={{ color: '#94A3B8' }}>{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleStart}
            disabled={!isValid}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all"
            style={{
              background: isValid ? '#059669' : 'rgba(255,255,255,0.04)',
              color: isValid ? '#fff' : '#334155',
              cursor: isValid ? 'pointer' : 'not-allowed',
              boxShadow: isValid ? '0 4px 14px rgba(5,150,105,0.3)' : 'none',
            }}
          >
            <PenLine size={16} />
            Start Blank Slate Session
            <ArrowRight size={16} />
          </button>
        </motion.div>
      </div>
    </div>
  );
}

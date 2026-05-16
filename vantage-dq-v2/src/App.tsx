import { useState } from 'react';
import StartPathSelector from './components/onboarding/StartPathSelector';
import AIDeepDive from './components/onboarding/AIDeepDive';
import BlankSlate from './components/onboarding/BlankSlate';
import FiveQuestionStart from './components/onboarding/FiveQuestionStart';
import SessionLayout from './components/session/SessionLayout';
import type { ReviewQueueItem } from './types/entities';

type AppView = 'start' | 'deep_dive' | 'blank_slate' | 'five_question' | 'session';

interface SessionData {
  name: string;
  items: ReviewQueueItem[];
  sourceDocument: string;
  aiMeta: any;
}

export default function App() {
  const [view, setView] = useState<AppView>('start');
  const [session, setSession] = useState<SessionData | null>(null);

  const handleComplete = (
    sessionName: string,
    items: ReviewQueueItem[],
    sourceDocument: string,
    aiMeta: any
  ) => {
    setSession({ name: sessionName, items, sourceDocument, aiMeta });
    setView('session');
  };

  if (view === 'session' && session) {
    return (
      <SessionLayout
        sessionName={session.name}
        acceptedItems={session.items}
        onBack={() => setView('start')}
      />
    );
  }

  if (view === 'deep_dive') {
    return <AIDeepDive onComplete={handleComplete} onBack={() => setView('start')} />;
  }

  if (view === 'blank_slate') {
    return <BlankSlate onComplete={handleComplete} onBack={() => setView('start')} />;
  }

  if (view === 'five_question') {
    return <FiveQuestionStart onComplete={handleComplete} onBack={() => setView('start')} />;
  }

  return <StartPathSelector onSelectPath={setView} />;
}

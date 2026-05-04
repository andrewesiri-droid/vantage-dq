/**
 * WorkshopCopilot — AI Workshop Intelligence Panel
 * 
 * The complete workshop copilot experience:
 * - Consent screen before recording
 * - Live transcription with real-time categorization
 * - Post-hoc file upload for recordings
 * - Review canvas with filter/sort/edit
 * - Workshop report with analytics
 * - Draft items flowing into modules
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { DS } from '@/constants';
import type { CategorizedItem, ContributionCategory, WorkshopPhase, WorkshopReport as IWorkshopReport } from '@/types/workshop';
import { CATEGORY_CONFIG, SPEAKER_COLORS } from '@/types/workshop';
import { Button } from '@/components/ui/button';
import {
  Mic, MicOff, Upload, FileAudio, Square, Pause, Play,
  CheckCircle, X, Edit3, AlertTriangle, Sparkles, Radio,
  BarChart2, Users, Clock, ChevronDown, ChevronUp,
  Loader2, Shield, EyeOff, Eye, Filter, Download, ArrowRight,
  Zap, Lightbulb, Target, MessageSquare, FileText
} from 'lucide-react';

type CopilotView = 'consent' | 'live' | 'upload' | 'review' | 'report';
type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'paused' | 'off-record' | 'processing' | 'error';

interface Props {
  phaseId: string;
  phaseLabel: string;
  phaseColor: string;
  sessionContext: { decisionStatement?: string; sessionName?: string };
  onDraftCreated?: (item: CategorizedItem) => void;
  onClose?: () => void;
}

// ── SPEAKER COLOR ASSIGNMENT ──────────────────────────────────────────────────
const speakerColorMap = new Map<string, string>();
let colorIdx = 0;
function getSpeakerColor(name: string): string {
  if (!speakerColorMap.has(name)) {
    speakerColorMap.set(name, SPEAKER_COLORS[colorIdx % SPEAKER_COLORS.length]);
    colorIdx++;
  }
  return speakerColorMap.get(name)!;
}

export function WorkshopCopilot({ phaseId, phaseLabel, phaseColor, sessionContext, onDraftCreated, onClose }: Props) {
  const [view, setView] = useState<CopilotView>('consent');
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
  const [transcript, setTranscript] = useState<{ text: string; timestamp: number; phase: string }[]>([]);
  const [items, setItems] = useState<CategorizedItem[]>([]);
  const [tensions, setTensions] = useState<string[]>([]);
  const [commitmentDetected, setCommitmentDetected] = useState(false);
  const [phaseSignal, setPhaseSignal] = useState<string | null>(null);
  const [processingChunk, setProcessingChunk] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<ContributionCategory | 'ALL'>('ALL');
  const [sessionDuration, setSessionDuration] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [lastSummary, setLastSummary] = useState('');
  const [activeTab, setActiveTab] = useState<'live' | 'review'>('live');
  const [hasConsented, setHasConsented] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);
  const prevTranscriptRef = useRef('');
  const startTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Session timer
  useEffect(() => {
    if (recordingStatus === 'recording') {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [recordingStatus]);

  // ── PROCESS AUDIO CHUNK ───────────────────────────────────────────────────
  const processChunk = useCallback(async (blob: Blob, mode: 'realtime' | 'upload' = 'realtime') => {
    if (blob.size < 500) return;
    setProcessingChunk(true);
    try {
      const base64 = await blobToBase64(blob);
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: base64, mimeType: blob.type, mode,
          phaseId, phaseLabel, sessionContext,
          previousTranscript: prevTranscriptRef.current.slice(-600),
        }),
      });
      if (!res.ok) throw new Error('Transcription failed');
      const data = await res.json();
      if (data.silent || !data.transcript) return;

      // Add to transcript
      setTranscript(p => [...p, { text: data.transcript, timestamp: Date.now(), phase: phaseId }]);
      prevTranscriptRef.current += ' ' + data.transcript;
      setWordCount(p => p + (data.wordCount || 0));
      if (data.summary) setLastSummary(data.summary);

      // Add items
      if (data.items?.length) {
        const newItems = data.items.map((item: CategorizedItem) => ({ ...item, status: 'pending' as const }));
        setItems(p => [...p, ...newItems]);
        newItems.forEach((item: CategorizedItem) => {
          if (item.confidence >= 75 && item.addToBoard) onDraftCreated?.(item);
        });
      }

      if (data.tensions?.length) setTensions(p => [...p, ...data.tensions]);
      if (data.commitmentDetected) setCommitmentDetected(true);
      if (data.phaseSignal) setPhaseSignal(data.phaseSignal);

    } catch (err: any) {
      setError('Transcription error — retrying next chunk');
      setTimeout(() => setError(null), 3000);
    } finally {
      setProcessingChunk(false);
    }
  }, [phaseId, phaseLabel, sessionContext, onDraftCreated]);

  // ── START RECORDING ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setError(null);
    setRecordingStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 }
      });
      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
      mediaRecorderRef.current = recorder;
      isRecordingRef.current = true;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      intervalRef.current = setInterval(async () => {
        if (!isRecordingRef.current || chunksRef.current.length === 0) return;
        recorder.stop();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (recordingStatus !== 'off-record') await processChunk(blob);
        if (isRecordingRef.current) recorder.start();
      }, 10000);

      recorder.start();
      setRecordingStatus('recording');
      setView('live');
    } catch (err: any) {
      setError(err.name === 'NotAllowedError' ? 'Microphone permission denied — allow mic in browser settings' : err.message);
      setRecordingStatus('error');
    }
  }, [processChunk, recordingStatus]);

  const pauseRecording = () => { mediaRecorderRef.current?.pause(); setRecordingStatus('paused'); };
  const resumeRecording = () => { mediaRecorderRef.current?.resume(); setRecordingStatus('recording'); };
  const toggleOffRecord = () => setRecordingStatus(s => s === 'off-record' ? 'recording' : 'off-record');

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (chunksRef.current.length > 0) {
      const blob = new Blob(chunksRef.current, { type: getSupportedMimeType() });
      chunksRef.current = [];
      processChunk(blob);
    }
    setRecordingStatus('idle');
    if (items.length > 0) setView('review');
  }, [processChunk, items.length]);

  // ── FILE UPLOAD ───────────────────────────────────────────────────────────
  const handleFileUpload = useCallback(async (file: File) => {
    setView('upload');
    setUploadProgress(0);
    setError(null);

    // Files > 25MB need chunking — Whisper limit
    if (file.size > 25 * 1024 * 1024) {
      setError('File too large — max 25MB. Please trim the recording.');
      setUploadProgress(null);
      return;
    }

    try {
      setUploadProgress(20);
      const base64 = await blobToBase64(file);
      setUploadProgress(40);

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: base64, mimeType: file.type, mode: 'upload',
          phaseId, phaseLabel, sessionContext,
          previousTranscript: '',
        }),
      });

      setUploadProgress(80);
      if (!res.ok) throw new Error('Upload transcription failed');
      const data = await res.json();
      setUploadProgress(100);

      if (data.transcript) {
        setTranscript([{ text: data.transcript, timestamp: Date.now(), phase: phaseId }]);
        prevTranscriptRef.current = data.transcript;
        setWordCount(data.wordCount || 0);
      }
      if (data.items?.length) setItems(data.items.map((item: CategorizedItem) => ({ ...item, status: 'pending' as const })));
      if (data.tensions?.length) setTensions(data.tensions);
      if (data.summary) setLastSummary(data.summary);

      setTimeout(() => { setUploadProgress(null); setView('review'); }, 800);
    } catch (err: any) {
      setError(err.message);
      setUploadProgress(null);
    }
  }, [phaseId, phaseLabel, sessionContext]);

  // ── ITEM ACTIONS ──────────────────────────────────────────────────────────
  const acceptItem = (id: string) => {
    setItems(p => p.map(i => i.id === id ? { ...i, status: 'accepted' } : i));
    const item = items.find(i => i.id === id);
    if (item) onDraftCreated?.(item);
  };
  const rejectItem = (id: string) => setItems(p => p.map(i => i.id === id ? { ...i, status: 'rejected' } : i));
  const editItem = (id: string, text: string) => setItems(p => p.map(i => i.id === id ? { ...i, editedText: text, status: 'edited' } : i));
  const acceptAll = () => {
    const pending = items.filter(i => i.status === 'pending' && (filterCategory === 'ALL' || i.category === filterCategory));
    pending.forEach(i => { onDraftCreated?.(i); });
    setItems(p => p.map(i => pending.some(pi => pi.id === i.id) ? { ...i, status: 'accepted' } : i));
  };

  // ── FILTERED ITEMS ────────────────────────────────────────────────────────
  const filteredItems = items.filter(i =>
    i.status !== 'rejected' &&
    (filterCategory === 'ALL' || i.category === filterCategory)
  );
  const pendingItems = filteredItems.filter(i => i.status === 'pending');
  const acceptedItems = filteredItems.filter(i => i.status === 'accepted' || i.status === 'edited');

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const isLive = recordingStatus === 'recording' || recordingStatus === 'paused' || recordingStatus === 'off-record';

  // Cleanup
  useEffect(() => () => {
    isRecordingRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  }, []);

  // ════ CONSENT SCREEN ══════════════════════════════════════════════════════
  if (view === 'consent') return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${phaseColor}20` }}>
          <Mic size={28} style={{ color: phaseColor }} />
        </div>
        <div>
          <h2 className="text-base font-black mb-2" style={{ color: DS.ink }}>Workshop Copilot</h2>
          <p className="text-xs leading-relaxed" style={{ color: DS.inkSub }}>AI-powered transcription and Decision Quality extraction for your workshop.</p>
        </div>

        <div className="w-full p-4 rounded-2xl text-left space-y-2" style={{ background: DS.bg, border: `1px solid ${DS.borderLight}` }}>
          <div className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: DS.inkDis }}>BEFORE YOU START</div>
          {[
            ['🎙', 'Audio is sent to OpenAI Whisper for transcription only'],
            ['🤖', 'Transcripts are analysed by Claude for DQ categorisation'],
            ['💾', 'Everything is stored with your session — not shared'],
            ['⏸', 'You can pause or go off-record at any time'],
            ['🗑', 'Raw audio is not stored — only the transcript'],
          ].map(([icon, text]) => (
            <div key={text as string} className="flex items-start gap-2 text-[10px]" style={{ color: DS.inkSub }}>
              <span>{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>

        <div className="w-full space-y-2">
          <Button className="w-full gap-2 h-11 font-bold" style={{ background: phaseColor }}
            onClick={() => { setHasConsented(true); setView('live'); }}>
            <Mic size={14} /> I consent — Start Recording
          </Button>
          <Button variant="outline" className="w-full gap-2 h-10 text-sm"
            onClick={() => { fileInputRef.current?.click(); }}>
            <Upload size={14} /> Upload Recording Instead
          </Button>
          <input ref={fileInputRef} type="file" className="hidden"
            accept="audio/*,video/mp4,.mp3,.wav,.m4a,.webm,.mp4"
            onChange={e => { const f = e.target.files?.[0]; if (f) { setHasConsented(true); handleFileUpload(f); }}} />
        </div>
      </div>
    </div>
  );

  // ════ UPLOAD PROGRESS ═════════════════════════════════════════════════════
  if (view === 'upload') return (
    <div className="flex flex-col h-full items-center justify-center p-6 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${phaseColor}15` }}>
        {uploadProgress === 100 ? <CheckCircle size={24} style={{ color: DS.success }} /> : <Loader2 size={24} className="animate-spin" style={{ color: phaseColor }} />}
      </div>
      <div>
        <h3 className="text-sm font-bold mb-1" style={{ color: DS.ink }}>
          {uploadProgress === 100 ? 'Processing complete!' : 'Transcribing recording...'}
        </h3>
        <p className="text-[10px]" style={{ color: DS.inkDis }}>
          {uploadProgress && uploadProgress < 40 ? 'Reading audio file...' : uploadProgress && uploadProgress < 80 ? 'Transcribing with Whisper...' : uploadProgress && uploadProgress < 100 ? 'Extracting DQ insights...' : 'Moving to review canvas...'}
        </p>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: DS.borderLight }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${uploadProgress || 0}%`, background: phaseColor }} />
      </div>
      <p className="text-[9px]" style={{ color: DS.inkDis }}>{uploadProgress || 0}%</p>
      {error && <p className="text-xs" style={{ color: DS.danger }}>{error}</p>}
    </div>
  );

  // ════ LIVE + REVIEW (main views) ══════════════════════════════════════════
  return (
    <div className="flex flex-col h-full">

      {/* Header status bar */}
      <div className="px-4 py-2.5 border-b shrink-0" style={{ borderColor: DS.borderLight, background: recordingStatus === 'recording' ? `${DS.danger}08` : recordingStatus === 'off-record' ? `${DS.warning}08` : DS.bg }}>
        <div className="flex items-center gap-2">
          {/* Status indicator */}
          {recordingStatus === 'recording' && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: DS.danger }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: DS.danger }} />
              LIVE · {formatTime(sessionDuration)}
            </div>
          )}
          {recordingStatus === 'off-record' && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: DS.warning }}>
              <EyeOff size={11} /> OFF RECORD
            </div>
          )}
          {recordingStatus === 'paused' && (
            <div className="text-[10px] font-bold" style={{ color: DS.inkDis }}>PAUSED · {formatTime(sessionDuration)}</div>
          )}
          {!isLive && recordingStatus !== 'processing' && (
            <div className="text-[10px]" style={{ color: DS.inkDis }}>{items.length} items · {wordCount} words</div>
          )}

          {processingChunk && (
            <div className="flex items-center gap-1 text-[9px]" style={{ color: phaseColor }}>
              <Loader2 size={8} className="animate-spin" /> analysing...
            </div>
          )}

          {/* Controls */}
          <div className="ml-auto flex items-center gap-1.5">
            {isLive ? (
              <>
                <button onClick={toggleOffRecord} title="Off the Record"
                  className="p-1.5 rounded-lg transition-all"
                  style={{ background: recordingStatus === 'off-record' ? `${DS.warning}20` : 'transparent', color: recordingStatus === 'off-record' ? DS.warning : DS.inkDis }}>
                  <EyeOff size={12} />
                </button>
                <button onClick={recordingStatus === 'paused' ? resumeRecording : pauseRecording}
                  className="p-1.5 rounded-lg" style={{ color: DS.warning }}>
                  {recordingStatus === 'paused' ? <Play size={12} /> : <Pause size={12} />}
                </button>
                <button onClick={stopRecording} className="p-1.5 rounded-lg" style={{ color: DS.danger }}>
                  <Square size={12} />
                </button>
              </>
            ) : (
              <button onClick={startRecording}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold"
                style={{ background: phaseColor, color: '#fff' }}>
                <Mic size={11} /> Record
              </button>
            )}

            {onClose && (
              <button onClick={onClose} className="p-1 rounded" style={{ color: DS.inkDis }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Alerts */}
        {commitmentDetected && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold" style={{ color: DS.success }}>
            <CheckCircle size={10} /> Commitment language detected
          </div>
        )}
        {phaseSignal && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px]" style={{ color: DS.warning }}>
            <AlertTriangle size={10} /> {phaseSignal}
          </div>
        )}
        {tensions.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px]" style={{ color: DS.danger }}>
            <Zap size={10} /> Tension: {tensions[tensions.length - 1]}
          </div>
        )}
        {error && (
          <div className="mt-1 text-[10px]" style={{ color: DS.danger }}>{error}</div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b shrink-0" style={{ borderColor: DS.borderLight }}>
        {[
          { id: 'live',   label: `Live (${pendingItems.length})` },
          { id: 'review', label: `Accepted (${acceptedItems.length})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className="flex-1 py-2 text-[9px] font-bold uppercase tracking-wider"
            style={{ color: activeTab === tab.id ? phaseColor : DS.inkDis, borderBottom: activeTab === tab.id ? `2px solid ${phaseColor}` : '2px solid transparent', marginBottom: -1 }}>
            {tab.label}
          </button>
        ))}
        {transcript.length > 0 && (
          <button onClick={() => setActiveTab('review' as any)}
            className="px-3 py-2 text-[9px]" style={{ color: DS.inkDis }}>
            Transcript
          </button>
        )}
      </div>

      {/* Filter row */}
      {items.length > 0 && (
        <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto border-b shrink-0" style={{ borderColor: DS.borderLight }}>
          <Filter size={9} style={{ color: DS.inkDis, flexShrink: 0 }} />
          {(['ALL', ...Object.keys(CATEGORY_CONFIG)] as (ContributionCategory | 'ALL')[]).map(cat => {
            const count = cat === 'ALL' ? pendingItems.length : pendingItems.filter(i => i.category === cat).length;
            if (cat !== 'ALL' && count === 0) return null;
            const cfg = cat !== 'ALL' ? CATEGORY_CONFIG[cat] : null;
            return (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold transition-all"
                style={{ background: filterCategory === cat ? (cfg?.color || DS.ink) + '20' : DS.bg, color: filterCategory === cat ? (cfg?.color || DS.ink) : DS.inkDis, border: `1px solid ${filterCategory === cat ? (cfg?.color || DS.ink) + '40' : DS.borderLight}` }}>
                {cfg?.icon} {cat === 'ALL' ? 'All' : cfg?.label} ({count})
              </button>
            );
          })}
          {pendingItems.length > 0 && (
            <button onClick={acceptAll}
              className="ml-auto shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold"
              style={{ background: `${DS.success}15`, color: DS.success, border: `1px solid ${DS.success}30` }}>
              <CheckCircle size={8} /> Accept All
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* LIVE TAB */}
        {activeTab === 'live' && (
          <div className="p-3 space-y-2">
            {/* Last summary */}
            {lastSummary && (
              <div className="p-2.5 rounded-xl text-[10px] italic" style={{ background: `${phaseColor}08`, color: DS.inkSub }}>
                <Sparkles size={9} className="inline mr-1" style={{ color: phaseColor }} />
                {lastSummary}
              </div>
            )}

            {pendingItems.length === 0 ? (
              <div className="text-center py-8">
                {isLive ? (
                  <div className="space-y-2">
                    <Radio size={24} className="mx-auto" style={{ color: phaseColor, opacity: 0.4 }} />
                    <p className="text-[10px]" style={{ color: DS.inkDis }}>Listening to the room...</p>
                    <p className="text-[9px]" style={{ color: DS.inkDis }}>Contributions will appear here every ~10 seconds</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Mic size={24} className="mx-auto opacity-20" style={{ color: DS.inkDis }} />
                    <p className="text-xs" style={{ color: DS.inkDis }}>Start recording or upload a file</p>
                    <div className="flex gap-2 justify-center">
                      <Button size="sm" className="gap-1.5 text-xs" style={{ background: phaseColor }} onClick={startRecording}>
                        <Mic size={11} /> Record
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={11} /> Upload
                      </Button>
                      <input ref={fileInputRef} type="file" className="hidden"
                        accept="audio/*,video/mp4,.mp3,.wav,.m4a,.webm"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              pendingItems.map(item => (
                <ItemCard key={item.id} item={item}
                  onAccept={() => acceptItem(item.id)}
                  onReject={() => rejectItem(item.id)}
                  onEdit={(text) => editItem(item.id, text)} />
              ))
            )}
          </div>
        )}

        {/* REVIEW TAB */}
        {activeTab === 'review' && (
          <div className="p-3 space-y-2">
            {acceptedItems.length === 0 ? (
              <p className="text-center py-6 text-[10px]" style={{ color: DS.inkDis }}>
                No accepted items yet — review and accept items from the Live tab
              </p>
            ) : (
              acceptedItems.map(item => (
                <ItemCard key={item.id} item={item} accepted />
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t shrink-0 flex items-center justify-between" style={{ borderColor: DS.borderLight, background: DS.bg }}>
        <div className="text-[9px]" style={{ color: DS.inkDis }}>
          {items.length} total · {acceptedItems.length} accepted · {wordCount} words
        </div>
        {!isLive && items.length === 0 && (
          <button onClick={() => { setView('consent'); setItems([]); setTranscript([]); prevTranscriptRef.current = ''; }}
            className="text-[9px]" style={{ color: DS.inkDis }}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

// ── ITEM CARD ──────────────────────────────────────────────────────────────────
function ItemCard({ item, onAccept, onReject, onEdit, accepted }: {
  item: CategorizedItem;
  onAccept?: () => void;
  onReject?: () => void;
  onEdit?: (text: string) => void;
  accepted?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.editedText || item.text);
  const cfg = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.ISSUE;
  const speakerColor = getSpeakerColor(item.speakerName || 'Speaker');
  const displayText = item.editedText || item.text;
  const confidence = item.confidence || 0;

  return (
    <div className="rounded-xl overflow-hidden border transition-all"
      style={{ borderColor: accepted ? `${cfg.color}30` : `${cfg.color}20`, background: accepted ? `${cfg.color}05` : '#fff' }}>
      <div className="px-3 py-2.5">
        {/* Header row */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className="text-[10px]">{cfg.icon}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${cfg.color}12`, color: cfg.color }}>
            {item.targetModule?.replace(/-/g, ' ')}
          </span>
          <div className="h-1 w-12 rounded-full overflow-hidden ml-auto" style={{ background: DS.borderLight }}>
            <div className="h-full rounded-full" style={{ width: `${confidence}%`, background: confidence > 75 ? DS.success : confidence > 50 ? DS.warning : DS.danger }} />
          </div>
          <span className="text-[8px]" style={{ color: DS.inkDis }}>{confidence}%</span>
        </div>

        {/* Content */}
        {editing ? (
          <div className="space-y-1.5">
            <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2}
              className="w-full text-xs p-1.5 rounded-lg border resize-none focus:outline-none"
              style={{ borderColor: cfg.color, fontSize: 11, fontFamily: 'inherit' }} />
            <div className="flex gap-1">
              <button onClick={() => { onEdit?.(editText); setEditing(false); }}
                className="flex-1 py-1 rounded-lg text-[9px] font-bold text-white"
                style={{ background: DS.success }}>Save</button>
              <button onClick={() => setEditing(false)}
                className="flex-1 py-1 rounded-lg text-[9px]"
                style={{ background: DS.bg, color: DS.inkDis }}>Cancel</button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] font-medium leading-snug" style={{ color: DS.ink }}>{displayText}</p>
        )}

        {/* Speaker + quote */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[6px] font-bold text-white"
            style={{ background: speakerColor }}>
            {(item.speakerName || 'S')[0].toUpperCase()}
          </div>
          <span className="text-[9px]" style={{ color: DS.inkDis }}>{item.speakerName || 'Speaker'}</span>
          {item.rawQuote && item.rawQuote !== item.text && (
            <span className="text-[8px] italic truncate" style={{ color: DS.inkDis }}>"{item.rawQuote.slice(0, 50)}{item.rawQuote.length > 50 ? '...' : ''}"</span>
          )}
        </div>

        {/* Actions */}
        {!accepted && onAccept && onReject && !editing && (
          <div className="flex items-center gap-1.5 mt-2">
            <button onClick={onAccept}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all flex-1 justify-center"
              style={{ background: `${DS.success}15`, color: DS.success, border: `1px solid ${DS.success}25` }}>
              <CheckCircle size={10} /> Accept → {item.targetModule?.split('-').slice(0, 2).join(' ')}
            </button>
            <button onClick={() => setEditing(true)}
              className="p-1.5 rounded-lg" style={{ background: DS.bg, color: DS.inkDis }}>
              <Edit3 size={10} />
            </button>
            <button onClick={onReject}
              className="p-1.5 rounded-lg" style={{ background: `${DS.danger}10`, color: DS.danger }}>
              <X size={10} />
            </button>
          </div>
        )}
        {accepted && (
          <div className="flex items-center gap-1 mt-1.5 text-[9px]" style={{ color: DS.success }}>
            <CheckCircle size={9} /> Added to {item.targetModule?.replace(/-/g, ' ')}
          </div>
        )}
      </div>
    </div>
  );
}

// ── HELPERS ────────────────────────────────────────────────────────────────────
function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const type of types) { if (MediaRecorder.isTypeSupported(type)) return type; }
  return 'audio/webm';
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * useWorkshopAudio — Workshop Audio Intelligence Hook
 * 
 * Handles: microphone access, audio chunking (every 8 seconds),
 * Whisper transcription, Claude DQ extraction, and real-time display.
 * 
 * Works completely in the browser — no native app needed.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export type ExtractionType =
  | 'issue' | 'assumption' | 'decision' | 'tension'
  | 'action' | 'information_gap' | 'stakeholder'
  | 'uncertainty' | 'brutal_truth' | 'question' | 'commitment';

export type DQLabel = 'frame' | 'alternatives' | 'information' | 'values' | 'reasoning' | 'commitment' | 'general';

export interface Extraction {
  id: string;
  type: ExtractionType;
  text: string;
  rawQuote: string;
  speaker: string;
  dqLabel: DQLabel;
  confidence: 'high' | 'medium' | 'low';
  addToBoard: boolean;
  phaseRelevance: 'on-topic' | 'off-topic' | 'tangential';
  phaseId: string;
  timestamp: number;
  accepted?: boolean;
  rejected?: boolean;
}

export interface TranscriptLine {
  id: string;
  text: string;
  timestamp: number;
  phaseId: string;
  phaseLabel: string;
}

interface SessionContext {
  decisionStatement?: string;
  sessionName?: string;
}

type AudioStatus = 'idle' | 'requesting' | 'recording' | 'paused' | 'processing' | 'error';

const CHUNK_INTERVAL_MS = 4000; // 4 seconds — fits Vercel Hobby 10s timeout

export function useWorkshopAudio(
  phaseId: string,
  phaseLabel: string,
  sessionContext: SessionContext
) {
  const [status, setStatus] = useState<AudioStatus>('idle');
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [extractions, setExtractions] = useState<Extraction[]>([]);
  const [tensions, setTensions] = useState<string[]>([]);
  const [commitmentDetected, setCommitmentDetected] = useState(false);
  const [phaseSignal, setPhaseSignal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingChunk, setProcessingChunk] = useState(false);
  const [totalWords, setTotalWords] = useState(0);
  const [lastSummary, setLastSummary] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousTranscriptRef = useRef('');
  const currentPhaseRef = useRef(phaseId);
  const isRecordingRef = useRef(false);

  // Update phase ref when phase changes
  useEffect(() => {
    currentPhaseRef.current = phaseId;
  }, [phaseId]);

  // ── PROCESS AUDIO CHUNK ───────────────────────────────────────────────────
  const processChunk = useCallback(async (blob: Blob) => {
    if (blob.size < 1000) return; // Skip silent/tiny chunks
    setProcessingChunk(true);

    try {
      const base64 = await blobToBase64(blob);
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: base64,
          mimeType: blob.type,
          phaseId: currentPhaseRef.current,
          phaseLabel,
          sessionContext,
          previousTranscript: previousTranscriptRef.current,
        }),
      });

      if (!res.ok) throw new Error('Transcription failed');
      const data = await res.json();

      if (data.silent || !data.transcript) {
        setProcessingChunk(false);
        return;
      }

      // Add to transcript
      const line: TranscriptLine = {
        id: `line_${Date.now()}`,
        text: data.transcript,
        timestamp: Date.now(),
        phaseId: currentPhaseRef.current,
        phaseLabel,
      };
      setTranscript(p => [...p, line]);
      previousTranscriptRef.current += ' ' + data.transcript;
      setTotalWords(p => p + data.transcript.split(' ').length);

      // Add extractions
      if (data.extractions?.length) {
        const stamped = data.extractions.map((e: Extraction) => ({
          ...e,
          phaseId: currentPhaseRef.current,
          timestamp: Date.now(),
        }));
        setExtractions(p => [...p, ...stamped]);
      }

      // Tensions
      if (data.tensions?.length) {
        setTensions(p => [...p, ...data.tensions]);
      }

      // Commitment detection
      if (data.commitmentDetected) setCommitmentDetected(true);

      // Phase signal (drift detection)
      if (data.phaseSignal) setPhaseSignal(data.phaseSignal);

      // Summary
      if (data.summary) setLastSummary(data.summary);

    } catch (err: any) {
      console.error('[useWorkshopAudio] chunk error:', err);
      setError('Transcription error — continuing...');
      setTimeout(() => setError(null), 3000);
    } finally {
      setProcessingChunk(false);
    }
  }, [phaseLabel, sessionContext]);

  // ── START RECORDING ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setError(null);
    setStatus('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });

      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
      mediaRecorderRef.current = recorder;
      isRecordingRef.current = true;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // Process chunks every CHUNK_INTERVAL_MS
      intervalRef.current = setInterval(async () => {
        if (!isRecordingRef.current || chunksRef.current.length === 0) return;

        recorder.stop();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        await processChunk(blob);

        // Restart if still recording
        if (isRecordingRef.current) {
          recorder.start();
        }
      }, CHUNK_INTERVAL_MS);

      recorder.start();
      setStatus('recording');

    } catch (err: any) {
      console.error('[useWorkshopAudio] start error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access and try again.');
      } else {
        setError(`Could not start recording: ${err.message}`);
      }
      setStatus('error');
    }
  }, [processChunk]);

  // ── PAUSE / RESUME ────────────────────────────────────────────────────────
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus('paused');
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('recording');
    }
  }, []);

  // ── STOP RECORDING ────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    // Process any remaining chunks
    if (chunksRef.current.length > 0) {
      const mimeType = getSupportedMimeType();
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      processChunk(blob);
    }

    setStatus('idle');
  }, [processChunk]);

  // ── ACCEPT / REJECT EXTRACTION ────────────────────────────────────────────
  const acceptExtraction = useCallback((id: string) => {
    setExtractions(p => p.map(e => e.id === id ? { ...e, accepted: true } : e));
  }, []);

  const rejectExtraction = useCallback((id: string) => {
    setExtractions(p => p.map(e => e.id === id ? { ...e, rejected: true } : e));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  return {
    status,
    transcript,
    extractions,
    tensions,
    commitmentDetected,
    phaseSignal,
    error,
    processingChunk,
    totalWords,
    lastSummary,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    acceptExtraction,
    rejectExtraction,
    isRecording: status === 'recording',
    isPaused: status === 'paused',
  };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/webm';
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip data:mime;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Stub for demo mode — no real-time sync without backend
export function useRealtimeSession(_sessionId: number | undefined) {
  return { touch: () => {} };
}

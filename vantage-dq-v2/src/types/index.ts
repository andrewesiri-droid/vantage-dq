export interface ModuleProps {
  sessionId?: number;
  data?: any;
  hooks?: any;
  persistedState?: any;
  onPersistState?: (state: any) => void;
}

export interface NavModule {
  id: string;
  label: string;
  sub: string;
  num: string;
  phase: number;
}

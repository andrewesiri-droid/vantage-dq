import { useState } from 'react';
import { useNavigate } from 'react-router';
import { MODULES, DS, TOOLS, type ToolId } from '@/constants';
import type { ModuleId } from '@/types';
import { Sparkles, Menu, X, Bot, ChevronLeft, PanelLeftClose, PanelLeft, RefreshCw, Users, Wrench, Swords, Presentation, Brain, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AICoPilot } from './AICoPilot';
import { WorkshopPanel } from './WorkshopPanel';

const TOOL_ICONS: Record<string, any> = {
  'game-theory': Swords,
  'workshop': Presentation,
  'deep-dive': Brain,
  'export-advanced': FileSpreadsheet,
};

interface AppShellProps {
  sessionName: string;
  sessionId?: number;
  activeModule: ModuleId;
  onModuleChange: (id: ModuleId) => void;
  activeTool?: ToolId | null;
  onToolChange?: (id: ToolId | null) => void;
  isSyncing?: boolean;
  children: React.ReactNode;
  data?: any;
}

export function AppShell({ sessionName, sessionId, activeModule, onModuleChange, activeTool, onToolChange, isSyncing, children, data }: AppShellProps) {
  const navigate = useNavigate();
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [coPilotOpen, setCoPilotOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);

  const currentModule = MODULES.find(m => m.id === activeModule)!;
  const currentTool = activeTool ? TOOLS.find(t => t.id === activeTool) : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: DS.bg }}>
      {/* TOP BAR */}
      <header className="h-12 shrink-0 flex items-center gap-2 px-3 border-b z-30" style={{ background: DS.brand, borderColor: DS.chromeMid }}>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <Menu size={18} className="text-white/70" />
        </button>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden md:flex p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          {sidebarOpen ? <PanelLeftClose size={16} className="text-white/70" /> : <PanelLeft size={16} className="text-white/70" />}
        </button>
        <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft size={16} className="text-white/70" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: DS.accent }}>
            <Sparkles size={12} className="text-white" />
          </div>
          <span className="text-[11px] font-bold text-white hidden sm:inline tracking-wide">VANTAGE DQ</span>
        </div>
        <div className="w-px h-4 bg-white/20 mx-1 hidden sm:block" />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] text-white/60 truncate block">{sessionName}</span>
        </div>

        {/* Current module/tool badge */}
        <div className="flex items-center gap-2 mr-1">
          {currentTool ? (
            <>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white" style={{ background: currentTool.color }}>TOOL</span>
              <span className="text-[11px] text-white font-medium hidden sm:inline">{currentTool.label}</span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white" style={{ background: DS.accent }}>{currentModule?.num}</span>
              <span className="text-[11px] text-white font-medium hidden sm:inline">{currentModule?.label}</span>
            </>
          )}
        </div>

        {isSyncing && <RefreshCw size={12} className="text-white/50 animate-spin mr-1" />}

        <div className="flex items-center gap-1">
          {/* Tools dropdown — toggle open/close, each tool toggles on/off */}
          <div className="relative hidden sm:block">
            <Button size="sm" variant="ghost"
              className="h-7 text-[10px] gap-1 text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => setToolsOpen(!toolsOpen)}>
              <Wrench size={12} /> Tools
              {activeTool && <span className="w-1.5 h-1.5 rounded-full ml-0.5" style={{ background: '#4ADE80' }} />}
            </Button>

            {toolsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setToolsOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-2xl border z-50 overflow-hidden" style={{ borderColor: DS.borderLight }}>
                  <div className="px-3 py-2.5 border-b flex items-center justify-between" style={{ background: DS.bg, borderColor: DS.borderLight }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DS.inkTer }}>Strategic Tools</p>
                    {activeTool && (
                      <button onClick={() => { onToolChange?.(null); setToolsOpen(false); }}
                        className="text-[9px] flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ color: DS.danger, background: DS.dangerSoft }}>
                        <X size={9} /> Close tool
                      </button>
                    )}
                  </div>
                  {TOOLS.map(tool => {
                    const ToolIcon = TOOL_ICONS[tool.id] || Wrench;
                    const isActive = activeTool === tool.id;
                    return (
                      <button key={tool.id}
                        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 border-b last:border-b-0"
                        style={{ borderColor: DS.borderLight, background: isActive ? `${tool.color}10` : undefined }}
                        onClick={() => {
                          // Toggle: if already active, deactivate. Otherwise activate.
                          onToolChange?.(isActive ? null : tool.id);
                          setToolsOpen(false);
                        }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: isActive ? tool.color : tool.color + '18' }}>
                          <ToolIcon size={15} style={{ color: isActive ? '#fff' : tool.color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold" style={{ color: isActive ? tool.color : DS.ink }}>{tool.label}</span>
                            {isActive && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold text-white" style={{ background: tool.color }}>ACTIVE</span>
                            )}
                          </div>
                          <p className="text-[9px] mt-0.5 leading-relaxed" style={{ color: DS.inkTer }}>
                            {isActive ? 'Click to close this tool' : tool.description}
                          </p>
                        </div>
                        {isActive && <X size={13} className="shrink-0 mt-1" style={{ color: tool.color }} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="w-px h-4 bg-white/20 hidden sm:block" />

          <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-white/80 hover:text-white hover:bg-white/10 hidden sm:flex" onClick={() => setWorkshopOpen(true)}>
            <Users size={12} /> Workshop
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-white/80 hover:text-white hover:bg-white/10 hidden sm:flex" onClick={() => setCoPilotOpen(!coPilotOpen)}>
            <Bot size={12} /> AI
          </Button>
          <UserAvatar name={sessionName} />
        </div>
      </header>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl overflow-y-auto z-50">
            <div className="flex items-center justify-between p-4 border-b" style={{ background: DS.brand }}>
              <span className="text-xs font-bold text-white tracking-wide">MODULES</span>
              <button onClick={() => setMobileMenuOpen(false)} className="text-white/70 hover:text-white"><X size={18} /></button>
            </div>
            <SidebarContent activeModule={activeModule} onModuleChange={(id) => { onModuleChange(id); setMobileMenuOpen(false); }} activeTool={activeTool} onToolChange={onToolChange} />
          </div>
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <nav className="hidden md:flex w-64 flex-col bg-white border-r shrink-0 overflow-y-auto" style={{ borderColor: DS.borderLight }}>
            <SidebarContent activeModule={activeModule} onModuleChange={onModuleChange} activeTool={activeTool} onToolChange={onToolChange} />
          </nav>
        )}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-5 md:px-8">
            {children}
          </div>
        </main>
        <AICoPilot module={activeModule} sessionId={sessionId} data={data} collapsed={!coPilotOpen} onToggle={() => setCoPilotOpen(!coPilotOpen)} />
      </div>

      {workshopOpen && <WorkshopPanel onClose={() => setWorkshopOpen(false)} sessionId={sessionId} />}
    </div>
  );
}

// Sidebar — NO Strategic Tools section, just modules
function SidebarContent({ activeModule, onModuleChange, activeTool, onToolChange }: {
  activeModule: ModuleId;
  onModuleChange: (id: ModuleId) => void;
  activeTool?: ToolId | null;
  onToolChange?: (id: ToolId | null) => void;
}) {
  return (
    <div className="py-2 flex flex-col h-full">
      <div className="px-3 py-1.5">
        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: DS.accent }}>Phase 1: Core Process</p>
      </div>
      {MODULES.filter(m => m.phase === 1).map(m => (
        <ModuleButton key={m.id} module={m} active={activeModule === m.id && !activeTool} onClick={() => { onModuleChange(m.id); onToolChange?.(null); }} />
      ))}
      <div className="px-3 py-1.5 mt-3">
        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: DS.inkDis }}>Phase 2: Advanced</p>
      </div>
      {MODULES.filter(m => m.phase === 2).map(m => (
        <ModuleButton key={m.id} module={m} active={activeModule === m.id && !activeTool} onClick={() => { onModuleChange(m.id); onToolChange?.(null); }} />
      ))}
      {/* Strategic Tools removed from sidebar — use Tools in top bar */}
    </div>
  );
}

function ModuleButton({ module, active, onClick }: { module: { id: string; label: string; sub: string; num: string }; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all rounded-md mx-1.5 mb-0.5"
      style={{ background: active ? DS.accentSoft : 'transparent', width: 'calc(100% - 12px)' }}>
      <span className="text-[10px] font-bold w-5 text-center shrink-0 tabular-nums" style={{ color: active ? DS.accent : DS.inkDis }}>{module.num}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold truncate" style={{ color: active ? DS.brand : DS.inkSub }}>{module.label}</div>
        <div className="text-[10px] truncate" style={{ color: active ? DS.accent : DS.inkDis }}>{module.sub}</div>
      </div>
    </button>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    ? name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
    : 'DQ';
  return (
    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ml-1 shrink-0" style={{ background: DS.accent }}>
      {initials}
    </div>
  );
}

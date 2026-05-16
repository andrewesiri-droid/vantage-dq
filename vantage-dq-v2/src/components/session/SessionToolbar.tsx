import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import {
  Wrench, Monitor, Presentation, StickyNote, Download,
  Maximize2, Minimize2, X, ChevronDown, FileText,
  Moon, Sun, Zap, Settings,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface Props {
  sessionName: string;
  activeModule: string;
  onWorkshopMode: (active: boolean) => void;
  onProjectorMode: (active: boolean) => void;
  workshopActive: boolean;
  projectorActive: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
}

interface Tool {
  id: string;
  label: string;
  icon: any;
  description: string;
  shortcut?: string;
  action: () => void;
  active?: boolean;
  color?: string;
}

// ── Main toolbar ─────────────────────────────────────────────

export default function SessionToolbar({
  sessionName, activeModule,
  onWorkshopMode, onProjectorMode,
  workshopActive, projectorActive,
  notes, onNotesChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const TOOLS: Tool[] = [
    {
      id: 'workshop',
      label: workshopActive ? 'Exit Workshop Mode' : 'Workshop Mode',
      icon: Monitor,
      description: 'Full-screen facilitated session — hides chrome, focuses on content',
      shortcut: '⌘W',
      color: '#4F6AF5',
      active: workshopActive,
      action: () => { onWorkshopMode(!workshopActive); setOpen(false); },
    },
    {
      id: 'projector',
      label: projectorActive ? 'Exit Projector Mode' : 'Projector Mode',
      icon: Presentation,
      description: 'High contrast, large text — optimized for screen sharing',
      shortcut: '⌘P',
      color: '#7C3AED',
      active: projectorActive,
      action: () => { onProjectorMode(!projectorActive); setOpen(false); },
    },
    {
      id: 'notes',
      label: 'Facilitator Notes',
      icon: StickyNote,
      description: 'Private notes attached to this session',
      color: '#D97706',
      active: showNotes,
      action: () => { setShowNotes(s => !s); setOpen(false); },
    },
    {
      id: 'export',
      label: 'Export Decision Package',
      icon: Download,
      description: 'Download the full decision package as PDF',
      color: '#059669',
      action: () => {
        // Build a simple text export for now
        const content = `DECISION PACKAGE\n${sessionName}\n\nGenerated: ${new Date().toLocaleDateString()}\n\nThis feature will generate a full PDF export.`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sessionName.replace(/\s+/g, '-')}-decision-package.txt`;
        a.click();
        URL.revokeObjectURL(url);
        setOpen(false);
      },
    },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Toolbar trigger button */}
      <button
        onClick={() => setOpen(s => !s)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
        style={{
          background: open ? DS.accent : DS.surfaceAlt,
          color: open ? '#fff' : DS.inkTer,
          border: `1px solid ${open ? DS.accent : DS.border}`,
        }}
      >
        <Wrench size={12} />
        Tools
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronDown size={10} />
        </motion.div>
        {(workshopActive || projectorActive) && (
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#059669' }} />
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-72 rounded-2xl overflow-hidden z-50"
            style={{ background: DS.surface, border: `1px solid ${DS.border}`, boxShadow: DS.shadowLg }}
          >
            {/* Header */}
            <div className="px-4 py-3" style={{ background: DS.surfaceAlt, borderBottom: `1px solid ${DS.border}` }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: DS.inkTer }}>Session Tools</p>
            </div>

            {/* Tool list */}
            <div className="p-2">
              {TOOLS.map(tool => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={tool.action}
                    className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all group"
                    style={{ background: tool.active ? (tool.color ?? DS.accent) + '15' : 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = (tool.color ?? DS.accent) + '10')}
                    onMouseLeave={e => (e.currentTarget.style.background = tool.active ? (tool.color ?? DS.accent) + '15' : 'transparent')}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: (tool.color ?? DS.accent) + '20' }}
                    >
                      <Icon size={15} style={{ color: tool.color ?? DS.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ color: DS.ink }}>{tool.label}</span>
                        {tool.active && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: (tool.color ?? DS.accent) + '20', color: tool.color ?? DS.accent }}>
                            Active
                          </span>
                        )}
                        {tool.shortcut && (
                          <span className="text-xs ml-auto" style={{ color: DS.inkFaint }}>{tool.shortcut}</span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: DS.inkTer }}>{tool.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Phase 2 tools section */}
            <div style={{ borderTop: `1px solid ${DS.border}` }}>
              <div className="px-4 py-2" style={{ background: DS.surfaceAlt }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: DS.inkTer }}>Phase 2 Analysis Tools</p>
              </div>
              <div className="p-2">
                {[
                  { label: 'Tornado Chart', icon: '🌪️', desc: 'Sensitivity analysis', id: 'tornado' },
                  { label: 'Decision Tree', icon: '🌳', desc: 'Sequential decision paths', id: 'decision-tree' },
                  { label: 'Game Theory', icon: '♟️', desc: 'Strategic interactions & payoffs', id: 'game-theory' },
                  { label: 'Scenario Planning', icon: '🔭', desc: 'Future state analysis', id: 'scenario' },
                  { label: 'Value of Information', icon: '💡', desc: 'VOI calculation', id: 'voi' },
                  { label: 'Influence Diagram', icon: '🔗', desc: 'Uncertainty relationships', id: 'influence' },
                ].map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{ background: activeModule === t.id ? DS.accentLight : 'transparent' }}>
                    <span className="text-base flex-shrink-0">{t.icon}</span>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: DS.ink }}>{t.label}</p>
                      <p className="text-xs" style={{ color: DS.inkTer }}>{t.desc}</p>
                    </div>
                    <span className="text-xs ml-auto px-2 py-0.5 rounded-full" style={{ background: DS.surfaceAlt, color: DS.inkFaint }}>Phase 2</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating notes panel */}
      <AnimatePresence>
        {showNotes && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed right-4 bottom-4 w-80 rounded-2xl overflow-hidden z-50"
            style={{ background: DS.surface, border: `1px solid ${DS.border}`, boxShadow: DS.shadowLg }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ background: '#FEF3C7', borderBottom: `1px solid #FCD34D` }}>
              <div className="flex items-center gap-2">
                <StickyNote size={14} style={{ color: '#D97706' }} />
                <span className="text-xs font-bold" style={{ color: '#92400E' }}>Facilitator Notes</span>
              </div>
              <button onClick={() => setShowNotes(false)}>
                <X size={14} style={{ color: '#92400E' }} />
              </button>
            </div>
            <div className="p-3">
              <textarea
                value={notes}
                onChange={e => onNotesChange(e.target.value)}
                placeholder="Private facilitator notes for this session…"
                rows={8}
                className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
                style={{
                  background: DS.surfaceAlt,
                  border: `1px solid ${DS.border}`,
                  color: DS.ink,
                  outline: 'none',
                  lineHeight: '1.6',
                  fontFamily: DS.fontDisplay,
                }}
              />
              <p className="text-xs mt-1.5" style={{ color: DS.inkFaint }}>Notes are private and not included in exports</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

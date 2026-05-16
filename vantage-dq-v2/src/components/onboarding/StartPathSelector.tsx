import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DS } from '@/constants';
import {
  FileText, PenLine, MessageSquare, ChevronRight,
  Sparkles, ArrowRight,
} from 'lucide-react';

interface Props {
  onSelectPath: (path: 'deep_dive' | 'blank_slate' | 'five_question') => void;
}

const PATHS = [
  {
    id: 'deep_dive' as const,
    icon: FileText,
    emoji: '📄',
    title: 'AI Deep Dive',
    subtitle: 'Start from a document',
    description: 'Upload or paste a document — proposal, field plan, strategy memo, board pack. AI extracts decision intelligence and pre-populates the DQ workflow.',
    color: '#4F6AF5',
    bg: '#EEF2FF',
    border: '#C7D2FE',
    tags: ['PDF', 'DOCX', 'Text paste', 'Fast start'],
    recommended: true,
  },
  {
    id: 'blank_slate' as const,
    icon: PenLine,
    emoji: '✏️',
    title: 'Blank Slate',
    subtitle: 'Build from scratch',
    description: 'Start with an empty session and work through the DQ process module by module. Full control, AI assistance on demand.',
    color: '#059669',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    tags: ['Manual entry', 'Full control', 'AI on demand'],
    recommended: false,
  },
  {
    id: 'five_question' as const,
    icon: MessageSquare,
    emoji: '💬',
    title: '5-Question Start',
    subtitle: 'Answer 5 questions',
    description: 'Not sure where to begin? Answer five powerful questions and the system creates an initial DQ assessment and pre-populates core modules.',
    color: '#D97706',
    bg: '#FEF3C7',
    border: '#FCD34D',
    tags: ['Guided', 'Beginner-friendly', 'Quick setup'],
    recommended: false,
  },
];

export default function StartPathSelector({ onSelectPath }: Props) {
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: '#0B1D3A', fontFamily: DS.fontDisplay }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#4F6AF520' }}>
            <Sparkles size={20} style={{ color: '#818CF8' }} />
          </div>
          <span className="text-2xl font-bold" style={{ color: '#F8FAFC' }}>Vantage DQ</span>
        </div>
        <h1 className="text-3xl font-bold mb-3" style={{ color: '#F8FAFC' }}>
          How would you like to start?
        </h1>
        <p className="text-base max-w-lg" style={{ color: '#64748B' }}>
          Choose your starting path. Every path leads to the same rigorous DQ process — 
          just different entry points based on what you have.
        </p>
      </motion.div>

      {/* Path cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl">
        {PATHS.map((path, i) => {
          const Icon = path.icon;
          const isHovered = hoveredPath === path.id;
          return (
            <motion.button
              key={path.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              onMouseEnter={() => setHoveredPath(path.id)}
              onMouseLeave={() => setHoveredPath(null)}
              onClick={() => onSelectPath(path.id)}
              className="relative text-left rounded-2xl p-6 transition-all"
              style={{
                background: isHovered ? path.bg : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${isHovered ? path.border : 'rgba(255,255,255,0.08)'}`,
                boxShadow: isHovered ? `0 8px 32px ${path.color}20` : 'none',
                transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
              }}
            >
              {/* Recommended badge */}
              {path.recommended && (
                <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: path.color + '20', color: path.color }}>
                  Recommended
                </div>
              )}

              {/* Icon */}
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-2xl"
                style={{ background: isHovered ? path.color + '20' : 'rgba(255,255,255,0.06)' }}>
                {path.emoji}
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold mb-1"
                style={{ color: isHovered ? path.color : '#F8FAFC' }}>
                {path.title}
              </h3>
              <p className="text-xs font-semibold mb-3"
                style={{ color: isHovered ? path.color : '#475569' }}>
                {path.subtitle}
              </p>
              <p className="text-sm mb-4" style={{ color: isHovered ? '#374151' : '#64748B', lineHeight: '1.6' }}>
                {path.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {path.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: isHovered ? path.color + '15' : 'rgba(255,255,255,0.06)',
                      color: isHovered ? path.color : '#475569',
                    }}>
                    {tag}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <div className="flex items-center gap-2 text-sm font-semibold"
                style={{ color: isHovered ? path.color : '#334155' }}>
                <span>Start with {path.title}</span>
                <ArrowRight size={16} />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-10 text-xs text-center"
        style={{ color: '#334155' }}
      >
        All paths lead to the same DQ workflow. You can switch at any time.
      </motion.p>
    </div>
  );
}

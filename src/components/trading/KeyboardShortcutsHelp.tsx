'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAVIGATION_SHORTCUTS = [
  { key: 'Ctrl+1', label: 'Dashboard' },
  { key: 'Ctrl+2', label: 'Trading' },
  { key: 'Ctrl+3', label: 'Analysis' },
  { key: 'Ctrl+4', label: 'Indicators' },
  { key: 'Ctrl+5', label: 'News' },
  { key: 'Ctrl+6', label: 'Risk' },
  { key: 'Ctrl+7', label: 'Backtesting' },
  { key: 'Ctrl+8', label: 'Journal' },
  { key: 'Ctrl+9', label: 'Analytics' },
  { key: 'Ctrl+0', label: 'Settings' },
];

const TRADING_SHORTCUTS = [
  { key: 'B', label: 'Open Quick Trade / Execute Buy', color: 'emerald' as const },
  { key: 'S', label: 'Execute Sell', color: 'red' as const },
];

const GENERAL_SHORTCUTS = [
  { key: '?', label: 'Toggle this help' },
  { key: 'Esc', label: 'Close panel / Go back' },
];

function KeyBadge({ children, variant }: { children: React.ReactNode; variant?: 'default' | 'buy' | 'sell' }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center min-w-[36px] h-6 px-2.5 text-[11px] font-mono font-semibold rounded-md border select-none ${
        variant === 'buy'
          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
          : variant === 'sell'
            ? 'bg-red-500/20 text-red-400 border-red-500/30'
            : 'bg-accent text-foreground border-border'
      }`}
    >
      {children}
    </kbd>
  );
}

export default function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-card w-full max-w-[500px] mx-4 rounded-xl border border-white/10 shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Keyboard className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Close keyboard shortcuts"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Navigation Section */}
              <section>
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Navigation
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {NAVIGATION_SHORTCUTS.map((s) => (
                    <div key={s.key} className="flex items-center gap-2.5">
                      <KeyBadge>{s.key}</KeyBadge>
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Quick Trading Section */}
              <section>
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Quick Trading
                </h3>
                <div className="space-y-2">
                  {TRADING_SHORTCUTS.map((s) => (
                    <div key={s.key} className="flex items-center gap-2.5">
                      <KeyBadge variant={s.color === 'emerald' ? 'buy' : 'sell'}>
                        {s.key}
                      </KeyBadge>
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* General Section */}
              <section>
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  General
                </h3>
                <div className="space-y-2">
                  {GENERAL_SHORTCUTS.map((s) => (
                    <div key={s.key} className="flex items-center gap-2.5">
                      <KeyBadge>{s.key}</KeyBadge>
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/10">
              <p className="text-[10px] text-muted-foreground/60 text-center">
                Shortcuts are disabled when typing in input fields
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle, Menu, Trash2 } from 'lucide-react';
import { useTradingStore } from '@/store/trading-store';
import Sidebar from '@/components/trading/Sidebar';
import DashboardView from '@/components/trading/DashboardView';
import TradingView from '@/components/trading/TradingView';
import AnalysisView from '@/components/trading/AnalysisView';
import IndicatorsView from '@/components/trading/IndicatorsView';
import NewsView from '@/components/trading/NewsView';
import RiskView from '@/components/trading/RiskView';
import BacktestingView from '@/components/trading/BacktestingView';
import TradeJournalView from '@/components/trading/TradeJournalView';
import PerformanceAnalyticsView from '@/components/trading/PerformanceAnalyticsView';
import SettingsView from '@/components/trading/SettingsView';
import QuickTradePanel from '@/components/trading/QuickTradePanel';
import KeyboardShortcutsHelp from '@/components/trading/KeyboardShortcutsHelp';
import Footer from '@/components/trading/Footer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { usePriceSimulator } from '@/hooks/use-price-simulator';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const TOAST_LIFETIME = 5000;

const toastStyles: Record<string, { bg: string; border: string; borderLeft: string; iconBg: string; iconText: string; progressTrack: string; progressFill: string }> = {
  success: {
    bg: 'bg-emerald-500/[0.07]',
    border: 'border-emerald-500/25',
    borderLeft: 'border-l-emerald-500/70',
    iconBg: 'bg-emerald-500/10',
    iconText: 'text-emerald-500',
    progressTrack: 'bg-emerald-500/15',
    progressFill: 'bg-emerald-500/60',
  },
  error: {
    bg: 'bg-red-500/[0.07]',
    border: 'border-red-500/25',
    borderLeft: 'border-l-red-500/70',
    iconBg: 'bg-red-500/10',
    iconText: 'text-red-500',
    progressTrack: 'bg-red-500/15',
    progressFill: 'bg-red-500/60',
  },
  warning: {
    bg: 'bg-amber-500/[0.07]',
    border: 'border-amber-500/25',
    borderLeft: 'border-l-amber-500/70',
    iconBg: 'bg-amber-500/10',
    iconText: 'text-amber-500',
    progressTrack: 'bg-amber-500/15',
    progressFill: 'bg-amber-500/60',
  },
  info: {
    bg: 'bg-slate-500/[0.07]',
    border: 'border-slate-500/25',
    borderLeft: 'border-l-slate-500/70',
    iconBg: 'bg-slate-500/10',
    iconText: 'text-slate-400',
    progressTrack: 'bg-slate-500/15',
    progressFill: 'bg-slate-500/60',
  },
};

function formatTimestamp(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 2) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

function SingleToast({ notif, removeNotification }: {
  notif: { id: string; type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string; timestamp: number };
  removeNotification: (id: string) => void;
}) {
  const [progress, setProgress] = useState(100);
  const [timeLabel, setTimeLabel] = useState('just now');
  const style = toastStyles[notif.type] || toastStyles.info;

  useEffect(() => {
    const start = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / TOAST_LIFETIME) * 100);
      setProgress(pct);
      if (pct <= 0) clearInterval(progressInterval);
    }, 50);
    return () => clearInterval(progressInterval);
  }, []);

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setTimeLabel(formatTimestamp(notif.timestamp));
    }, 1000);
    return () => clearInterval(timeInterval);
  }, [notif.timestamp]);

  const IconComponent = notif.type === 'success' ? CheckCircle
    : notif.type === 'error' ? AlertCircle
    : notif.type === 'warning' ? AlertTriangle
    : Info;

  return (
    <motion.div
      initial={{ opacity: 0, x: 80, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 350, damping: 22 } }}
      exit={{ opacity: 0, x: 80, scale: 0.92, transition: { duration: 0.18, ease: 'easeIn' } }}
      className={`pointer-events-auto relative flex items-start gap-3 p-3 rounded-lg border shadow-xl overflow-hidden min-w-[300px] max-w-[420px] border-l-[3px] ${style.bg} ${style.border} ${style.borderLeft}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        <div className={`w-6 h-6 rounded-full ${style.iconBg} flex items-center justify-center`}>
          <IconComponent className={`h-3.5 w-3.5 ${style.iconText}`} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">{notif.title}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">{timeLabel}</span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{notif.message}</div>
      </div>
      <button
        onClick={() => removeNotification(notif.id)}
        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {/* Progress bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-[2px] ${style.progressTrack}`}>
        <div
          className={`h-full ${style.progressFill} transition-none`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}

function NotificationToast({ notifications, removeNotification }: {
  notifications: Array<{ id: string; type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string; timestamp: number }>;
  removeNotification: (id: string) => void;
}) {
  const showDismissAll = notifications.length >= 3;
  const dismissAll = useCallback(() => {
    [...notifications].forEach(n => removeNotification(n.id));
  }, [notifications, removeNotification]);

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
      {showDismissAll && (
        <motion.button
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          onClick={dismissAll}
          className="pointer-events-auto ml-auto flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground bg-card/80 border border-border/60 rounded-md px-2.5 py-1.5 backdrop-blur-sm transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          Dismiss All ({notifications.length})
        </motion.button>
      )}
      <AnimatePresence mode="popLayout">
        {notifications.map((notif) => (
          <SingleToast key={notif.id} notif={notif} removeNotification={removeNotification} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ErrorLogsView() {
  const errorLogs = useTradingStore((s) => s.errorLogs);
  const resolveErrorLog = useTradingStore((s) => s.resolveErrorLog);
  const clearResolvedLogs = useTradingStore((s) => s.clearResolvedLogs);
  const unresolvedCount = errorLogs.filter(e => !e.resolved).length;
  return (
    <div className="p-4 pt-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Error Logs</h2>
            {unresolvedCount > 0 && (
              <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full badge-pulse">
                {unresolvedCount} unresolved
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">System errors, warnings, and diagnostics</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="metric-compact">
            <span className="text-[9px] text-muted-foreground uppercase">Total</span>
            <span className="text-xs font-bold tabular-nums">{errorLogs.length}</span>
          </div>
          <div className="metric-compact">
            <span className="text-[9px] text-red-400 uppercase">Errors</span>
            <span className="text-xs font-bold tabular-nums text-red-400">{errorLogs.filter(e => e.level === 'error').length}</span>
          </div>
          <div className="metric-compact">
            <span className="text-[9px] text-amber-400 uppercase">Warns</span>
            <span className="text-xs font-bold tabular-nums text-amber-400">{errorLogs.filter(e => e.level === 'warning').length}</span>
          </div>
        </div>
      </div>
      {errorLogs.length === 0 ? (
        <div className="glass-card-premium rounded-xl p-16 text-center mesh-gradient-bg">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">All Systems Operational</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">No errors or warnings detected. The trading system is running smoothly.</p>
        </div>
      ) : (
        <div className="space-y-2 stagger-children">
          {errorLogs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass-card rounded-lg p-3 border card-hover cursor-default ${
                log.level === 'error' ? 'border-red-500/20 hover:border-red-500/40' :
                log.level === 'warning' ? 'border-amber-500/20 hover:border-amber-500/40' :
                'border-border hover:border-border'
              } ${log.resolved ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    log.level === 'error' ? 'bg-red-500/20 text-red-500' :
                    log.level === 'warning' ? 'bg-amber-500/20 text-amber-500' :
                    'bg-slate-500/20 text-slate-500'
                  }`}>{log.level}</span>
                  <span className="text-[10px] text-muted-foreground font-medium">{log.source}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{log.timestamp}</span>
                  {log.resolved && (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded font-medium">✓ RESOLVED</span>
                  )}
                  {!log.resolved && log.level === 'error' && (
                    <button
                      onClick={() => resolveErrorLog(log.id)}
                      className="text-[9px] text-primary hover:text-primary/80 font-medium px-1.5 py-0.5 rounded border border-primary/20 hover:border-primary/40 transition-colors animated-underline"
                    >Resolve</button>
                  )}
                </div>
              </div>
              <div className="text-xs leading-relaxed">{log.message}</div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TradingDashboard() {
  const isMobile = useIsMobile();
  const { activeTab, sidebarOpen, notifications, removeNotification } = useTradingStore();
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Initialize price simulator (replaces WebSocket)
  usePriceSimulator();

  // Keyboard shortcuts
  useKeyboardShortcuts({ showShortcutsHelp, setShowShortcutsHelp });

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView />;
      case 'trading': return <TradingView />;
      case 'analysis': return <AnalysisView />;
      case 'indicators': return <IndicatorsView />;
      case 'news': return <NewsView />;
      case 'risk': return <RiskView />;
      case 'backtesting': return <BacktestingView />;
      case 'journal': return <TradeJournalView />;
      case 'analytics': return <PerformanceAnalyticsView />;
      case 'settings': return <SettingsView />;
      case 'errors': return <ErrorLogsView />;
      default: return <DashboardView />;
    }
  };

  const sidebarWidth = sidebarOpen ? 240 : 64;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}

      {/* Mobile Sidebar via Sheet */}
      {isMobile && (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="fixed top-3 left-3 z-50 h-8 w-8 p-0 bg-card border border-border">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px] sm:w-[240px] bg-sidebar border-border">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar />
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden"
        style={isMobile ? {} : { marginLeft: sidebarWidth }}
      >
        <main className="flex-1 overflow-y-auto relative">
          {/* Top gradient border line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent z-10" />
          <div className="min-h-full pb-10 md:pb-0 mesh-gradient-bg">
            {renderView()}
          </div>
        </main>
        <Footer />
      </div>

      {/* Notification Toasts */}
      <NotificationToast notifications={notifications} removeNotification={removeNotification} />

      {/* Floating Quick Trade Panel - accessible from any tab */}
      <QuickTradePanel />

      {/* Keyboard Shortcuts Help Overlay */}
      <KeyboardShortcutsHelp isOpen={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />
    </div>
  );
}

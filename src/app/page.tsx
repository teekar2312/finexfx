'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle, Menu } from 'lucide-react';
import { useTradingStore } from '@/store/trading-store';
import Sidebar from '@/components/trading/Sidebar';
import DashboardView from '@/components/trading/DashboardView';
import TradingView from '@/components/trading/TradingView';
import AnalysisView from '@/components/trading/AnalysisView';
import IndicatorsView from '@/components/trading/IndicatorsView';
import NewsView from '@/components/trading/NewsView';
import RiskView from '@/components/trading/RiskView';
import BacktestingView from '@/components/trading/BacktestingView';
import SettingsView from '@/components/trading/SettingsView';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePriceSimulator } from '@/hooks/use-price-simulator';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

function NotificationToast({ notifications, removeNotification }: {
  notifications: Array<{ id: string; type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string; timestamp: number }>;
  removeNotification: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
      <AnimatePresence>
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`pointer-events-auto flex items-start gap-3 p-3 rounded-lg border shadow-lg min-w-[280px] max-w-[380px] toast-enter
              ${notif.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' :
                notif.type === 'error' ? 'bg-red-500/10 border-red-500/30' :
                notif.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                'bg-card border-border'
              }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {notif.type === 'success' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
              {notif.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
              {notif.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
              {notif.type === 'info' && <Info className="h-4 w-4 text-slate-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold">{notif.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{notif.message}</div>
            </div>
            <button
              onClick={() => removeNotification(notif.id)}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ErrorLogsView() {
  const { errorLogs } = useTradingStore();
  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Error Logs</h2>
        <p className="text-xs text-muted-foreground mt-0.5">System errors and warnings</p>
      </div>
      {errorLogs.length === 0 ? (
        <div className="glass-card rounded-lg p-12 text-center">
          <Info className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-medium text-muted-foreground mb-1">No Error Logs</h3>
          <p className="text-xs text-muted-foreground">The system is running normally. Errors will be logged here if they occur.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {errorLogs.map((log, i) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`glass-card rounded-lg p-3 border
                ${log.level === 'error' ? 'border-red-500/20' :
                  log.level === 'warning' ? 'border-amber-500/20' :
                  'border-border'
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded
                    ${log.level === 'error' ? 'bg-red-500/20 text-red-500' :
                      log.level === 'warning' ? 'bg-amber-500/20 text-amber-500' :
                      'bg-slate-500/20 text-slate-500'
                    }`
                  }
                  >
                    {log.level}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{log.source}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{log.timestamp}</span>
                  {log.resolved && (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded">RESOLVED</span>
                  )}
                </div>
              </div>
              <div className="text-xs">{log.message}</div>
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

  // Initialize price simulator (replaces WebSocket)
  usePriceSimulator();

  const renderView = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView />;
      case 'trading': return <TradingView />;
      case 'analysis': return <AnalysisView />;
      case 'indicators': return <IndicatorsView />;
      case 'news': return <NewsView />;
      case 'risk': return <RiskView />;
      case 'backtesting': return <BacktestingView />;
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
          <SheetContent side="left" className="p-0 w-[240px] bg-sidebar border-border">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar />
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content */}
      <main
        className={`flex-1 overflow-y-auto transition-all duration-200 ${
          isMobile ? 'ml-0' : ''
        }`}
        style={isMobile ? {} : { marginLeft: sidebarWidth }}
      >
        <div className="min-h-full">
          {renderView()}
        </div>
      </main>

      {/* Notification Toasts */}
      <NotificationToast notifications={notifications} removeNotification={removeNotification} />
    </div>
  );
}

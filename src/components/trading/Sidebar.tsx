'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTradingStore, type TabId } from '@/store/trading-store';
import { useShallow } from 'zustand/react/shallow';
import { BROKER_CONFIG, TRADING_SESSIONS } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  BookOpen,
  Brain,
  CandlestickChart,
  Cog,
  Gauge,
  LineChart as LineChartIcon,
  Newspaper,
  Play,
  PieChart as PieChartIcon,
  ChevronLeft,
  Shield,
  TriangleAlert,
  Zap,
  X,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'trading', label: 'Trading', icon: <CandlestickChart className="h-4 w-4" /> },
  { id: 'analysis', label: 'Analysis', icon: <Brain className="h-4 w-4" /> },
  { id: 'indicators', label: 'Indicators', icon: <Gauge className="h-4 w-4" /> },
  { id: 'news', label: 'News', icon: <Newspaper className="h-4 w-4" /> },
  { id: 'risk', label: 'Risk Mgmt', icon: <Shield className="h-4 w-4" /> },
  { id: 'backtesting', label: 'Backtesting', icon: <LineChartIcon className="h-4 w-4" /> },
  { id: 'journal', label: 'Journal', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <PieChartIcon className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <Cog className="h-4 w-4" /> },
  { id: 'errors', label: 'Error Logs', icon: <TriangleAlert className="h-4 w-4" /> },
];

const SESSION_DEFS = [
  { label: 'SYD', start: 22, end: 7, color: 'bg-cyan-400', inactiveColor: 'bg-slate-700' },
  { label: 'TKY', start: 0, end: 9, color: 'bg-violet-400', inactiveColor: 'bg-slate-700' },
  { label: 'LDN', start: TRADING_SESSIONS.LONDON.start, end: TRADING_SESSIONS.LONDON.end, color: 'bg-emerald-400', inactiveColor: 'bg-slate-700' },
  { label: 'NYC', start: TRADING_SESSIONS.NEW_YORK.start, end: TRADING_SESSIONS.NEW_YORK.end, color: 'bg-amber-400', inactiveColor: 'bg-slate-700' },
] as const;

function isSessionActive(start: number, end: number, utcHour: number): boolean {
  if (start > end) {
    return utcHour >= start || utcHour < end;
  }
  return utcHour >= start && utcHour < end;
}

function generateSparkline(seed: number): number[] {
  const points: number[] = [50];
  for (let i = 1; i < 20; i++) {
    points.push(Math.max(10, Math.min(90, points[i - 1] + (Math.sin(seed + i * 0.8) * 6 + Math.cos(seed * 1.3 + i * 0.5) * 4))));
  }
  return points;
}

export default function Sidebar() {
  const {
    activeTab, sidebarOpen, isConnected, accountType, isAutoTrading, errorLogs, signals, balance,
  } = useTradingStore(
    useShallow((s) => ({
      activeTab: s.activeTab, sidebarOpen: s.sidebarOpen, isConnected: s.isConnected, accountType: s.accountType,
      isAutoTrading: s.isAutoTrading, errorLogs: s.errorLogs, signals: s.signals, balance: s.balance,
    }))
  );
  const setActiveTab = useTradingStore((s) => s.setActiveTab);
  const setSidebarOpen = useTradingStore((s) => s.setSidebarOpen);
  const setAccountType = useTradingStore((s) => s.setAccountType);
  const setAutoTrading = useTradingStore((s) => s.setAutoTrading);

  const isMobile = useIsMobile();
  const unresolvedErrors = errorLogs.filter(e => !e.resolved).length;
  const effectiveOpen = isMobile ? true : sidebarOpen;

  // Session mini-bars - update every minute
  const [activeSessions, setActiveSessions] = useState<boolean[]>([false, false, false, false]);
  useEffect(() => {
    const update = () => {
      const utcHour = new Date().getUTCHours();
      setActiveSessions(SESSION_DEFS.map(s => isSessionActive(s.start, s.end, utcHour)));
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  // Equity sparkline
  const sparklinePoints = useMemo(() => generateSparkline(42), []);
  const sparklinePath = useMemo(() => {
    const w = 80, h = 24, pad = 2;
    const step = (w - pad * 2) / (sparklinePoints.length - 1);
    const min = Math.min(...sparklinePoints);
    const max = Math.max(...sparklinePoints);
    const range = max - min || 1;
    return sparklinePoints.map((p, i) => {
      const x = pad + i * step;
      const y = pad + (1 - (p - min) / range) * (h - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [sparklinePoints]);

  const handleNav = (id: TabId) => {
    setActiveTab(id);
    if (isMobile) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
  };

  const handleClose = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  };

  const collapsedAccountToggle = !effectiveOpen && !isMobile ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex justify-center">
          <div className={`w-3 h-3 rounded-full ${accountType === 'live' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {accountType === 'live' ? 'Live Account' : 'Demo Account'}
      </TooltipContent>
    </Tooltip>
  ) : null;

  const collapsedAutoToggle = !effectiveOpen && !isMobile ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex justify-center">
          <Play className={`h-4 w-4 ${isAutoTrading ? 'text-emerald-500' : 'text-muted-foreground'}`} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        Auto Trading {isAutoTrading ? 'ON' : 'OFF'}
      </TooltipContent>
    </Tooltip>
  ) : null;

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: isMobile ? 240 : (sidebarOpen ? 240 : 64) }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="h-screen flex flex-col border-r border-border bg-sidebar fixed left-0 top-0 z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-4 min-h-[56px]">
          <div className="flex items-center gap-3">
            <div className="logo-gradient-ring flex-shrink-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-[7px] bg-primary">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
            {effectiveOpen && (
              <div className="overflow-hidden whitespace-nowrap">
                {isMobile ? (
                  <div className="text-sm font-bold text-foreground">Navigation</div>
                ) : (
                  <div>
                    <div className="text-sm font-bold text-foreground">ForexPro <span className="text-[9px] font-normal text-muted-foreground">by FINEX</span></div>
                    <div className="text-[10px] text-muted-foreground">{BROKER_CONFIG.name}</div>
                  </div>
                )}
              </div>
            )}
          </div>
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Separator className="opacity-50" />

        {/* Connection Status */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 px-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-emerald-500 pulse-dot' : 'bg-red-500'}`} />
            {effectiveOpen && (
              <span className="text-xs text-muted-foreground">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            )}
            {isConnected && isAutoTrading && effectiveOpen && (
              <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 border-emerald-500/50 text-emerald-500">
                AUTO
              </Badge>
            )}
          </div>
          {/* Session mini-bars */}
          <div className="flex gap-1 mt-1 px-2">
            {SESSION_DEFS.map((s, i) => (
              <div
                key={s.label}
                className={`h-[2px] flex-1 rounded-full transition-colors duration-500 ${activeSessions[i] ? s.color : s.inactiveColor}`}
                title={`${s.label} ${activeSessions[i] ? 'Active' : 'Inactive'}`}
              />
            ))}
          </div>
        </div>

        <Separator className="opacity-50" />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const errorCount = item.id === 'errors' ? unresolvedErrors : 0;
            const signalCount = item.id === 'analysis' ? Math.min(signals.length, 9) : 0;

            const button = (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md text-sm transition-all duration-200 relative group min-h-[44px] focus-ring
                  ${isActive
                    ? 'sidebar-nav-active text-primary font-medium gradient-text-emerald'
                    : 'sidebar-nav-item text-muted-foreground hover:text-foreground glass-card-interactive'
                  }`}
              >
                <span className={`sidebar-nav-icon flex-shrink-0 ${isActive ? 'text-primary' : ''}`}>{item.icon}</span>
                {effectiveOpen && (
                  <span className="overflow-hidden whitespace-nowrap">{item.label}</span>
                )}
                {errorCount > 0 && (
                  <span className="absolute right-2 top-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
                    {errorCount > 9 ? '9+' : errorCount}
                  </span>
                )}
                {signalCount > 0 && item.id === 'analysis' && (
                  <span className="absolute right-2 top-1.5 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-medium">
                    {signalCount}
                  </span>
                )}
              </button>
            );

            if (!effectiveOpen && !isMobile) {
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {item.label}
                    {errorCount > 0 && ` (${errorCount} errors)`}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.id}>{button}</div>;
          })}
        </nav>

        <Separator className="opacity-50" />

        {/* Account Type Toggle */}
        <div className="px-3 py-2">
          {effectiveOpen ? (
            <div className={`flex items-center justify-between px-2 min-h-[44px] rounded-lg transition-all duration-300 ${accountType === 'live' ? 'toggle-pill toggle-pill-active-live' : 'toggle-pill toggle-pill-active-demo'}`}>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Account</span>
                <span className={`text-xs font-semibold transition-colors duration-300 ${accountType === 'live' ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {accountType === 'live' ? '● LIVE' : '● DEMO'}
                </span>
              </div>
              <Switch
                checked={accountType === 'live'}
                onCheckedChange={(checked) => setAccountType(checked ? 'live' : 'demo')}
                className="data-[state=checked]:bg-emerald-600 transition-all duration-300"
              />
            </div>
          ) : (
            collapsedAccountToggle
          )}
        </div>

        {/* Auto Trading Toggle */}
        <div className="px-3 py-2">
          {effectiveOpen ? (
            <div className="flex items-center justify-between px-2 min-h-[44px]">
              <div className="flex items-center gap-2">
                <Play className={`h-3 w-3 transition-colors duration-300 ${isAutoTrading ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                <span className="text-xs text-muted-foreground">Auto Trade</span>
              </div>
              <div className={isAutoTrading ? 'auto-trade-glow-ring rounded-full' : ''}>
                <Switch
                  checked={isAutoTrading}
                  onCheckedChange={setAutoTrading}
                  disabled={!isConnected}
                  className="data-[state=checked]:bg-emerald-600 transition-all duration-300"
                />
              </div>
            </div>
          ) : (
            collapsedAutoToggle
          )}
        </div>

        {/* Equity Curve Footer */}
        {effectiveOpen && (
          <div className="px-3 py-2 metric-compact">
            <div className="px-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Equity</span>
                <span className="text-[10px] font-medium text-foreground tabular-nums">${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <svg viewBox="0 0 80 24" className="w-full h-6" preserveAspectRatio="none">
                <path d={sparklinePath} fill="none" stroke="rgb(16 185 129)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
              </svg>
            </div>
          </div>
        )}

        {/* Collapse Button - desktop only */}
        {!isMobile && (
          <div className="px-2 py-2 border-t border-border">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center justify-center py-1.5 rounded-md hover:bg-accent transition-all duration-200 text-muted-foreground hover:text-foreground min-h-[44px]"
            >
              <ChevronLeft className={`h-4 w-4 sidebar-chevron ${!sidebarOpen ? 'sidebar-chevron-collapsed' : ''}`} />
            </button>
          </div>
        )}
      </motion.aside>
    </TooltipProvider>
  );
}

'use client';

import { useTradingStore, type TabId } from '@/store/trading-store';
import { BROKER_CONFIG } from '@/lib/types';
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
  ChevronRight,
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

export default function Sidebar() {
  const {
    activeTab,
    setActiveTab,
    sidebarOpen,
    setSidebarOpen,
    isConnected,
    accountType,
    setAccountType,
    isAutoTrading,
    setAutoTrading,
    errorLogs,
    signals,
  } = useTradingStore();

  const isMobile = useIsMobile();
  const unresolvedErrors = errorLogs.filter(e => !e.resolved).length;
  const effectiveOpen = isMobile ? true : sidebarOpen;

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
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary flex-shrink-0">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            {effectiveOpen && (
              <div className="overflow-hidden whitespace-nowrap">
                {isMobile ? (
                  <div className="text-sm font-bold text-foreground">Navigation</div>
                ) : (
                  <div>
                    <div className="text-sm font-bold text-foreground">ForexPro</div>
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
                className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md text-sm transition-all duration-150 relative group min-h-[44px] focus-ring
                  ${isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent glass-card-interactive'
                  }`}
              >
                <span className={`flex-shrink-0 ${isActive ? 'text-primary' : ''}`}>{item.icon}</span>
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
            <div className="flex items-center justify-between px-2 min-h-[44px]">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Account</span>
                <span className={`text-xs font-semibold ${accountType === 'live' ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {accountType === 'live' ? '● LIVE' : '● DEMO'}
                </span>
              </div>
              <Switch
                checked={accountType === 'live'}
                onCheckedChange={(checked) => setAccountType(checked ? 'live' : 'demo')}
                className="data-[state=checked]:bg-emerald-600"
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
                <Play className={`h-3 w-3 ${isAutoTrading ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                <span className="text-xs text-muted-foreground">Auto Trade</span>
              </div>
              <Switch
                checked={isAutoTrading}
                onCheckedChange={setAutoTrading}
                disabled={!isConnected}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
          ) : (
            collapsedAutoToggle
          )}
        </div>

        {/* Collapse Button - desktop only */}
        {!isMobile && (
          <div className="px-2 py-2 border-t border-border">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center justify-center py-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground min-h-[44px]"
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        )}
      </motion.aside>
    </TooltipProvider>
  );
}

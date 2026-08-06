'use client';

import { useState, useMemo } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { BROKER_CONFIG, SYMBOL_INFO } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, Bell, Server, TriangleAlert, Plus, RefreshCw, Trash2, Wifi, WifiOff, Globe, HardDrive, CheckCircle, AlertCircle, Info, Filter, Zap, DollarSign, Activity, Clock, Target, Volume2 } from 'lucide-react';
import { setSoundEnabled } from '@/lib/sounds';
import { SYMBOLS, type Symbol } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

export default function SettingsView() {
  const {
    accountType, balance, equity, margin, dailyPnl, totalPnl, isConnected, isAutoTrading,
    priceAlerts, addPriceAlert, removePriceAlert, togglePriceAlert,
    errorLogs, clearResolvedLogs, addNotification, notifications, closedTrades, openTrades,
  } = useTradingStore();

  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [soundNotif, setSoundNotif] = useState(true);
  const [newAlertSymbol, setNewAlertSymbol] = useState<Symbol>('EURUSD');
  const [newAlertCondition, setNewAlertCondition] = useState('above');
  const [newAlertPrice, setNewAlertPrice] = useState('1.10000');
  const [logFilter, setLogFilter] = useState<string>('all');

  // Broker connection test
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);
  const [testPing, setTestPing] = useState<number | null>(null);

  const handleConnectionTest = () => {
    setIsTesting(true);
    setTestResult(null);
    setTestPing(null);
    setTimeout(() => {
      const success = isConnected || Math.random() > 0.3;
      setIsTesting(false);
      setTestResult(success ? 'success' : 'fail');
      setTestPing(Math.floor(Math.random() * 80) + 15);
    }, 2000);
  };

  const addNewAlert = () => {
    const price = parseFloat(newAlertPrice);
    if (isNaN(price)) {
      addNotification({ type: 'error', title: 'Invalid Price', message: 'Please enter a valid price.' });
      return;
    }
    addPriceAlert({
      symbol: newAlertSymbol,
      condition: newAlertCondition,
      price,
      isActive: true,
    });
    addNotification({ type: 'success', title: 'Alert Created', message: `${newAlertSymbol} ${newAlertCondition} ${price}` });
  };

  // Account statistics from closed trades
  const accountStats = useMemo(() => {
    const total = closedTrades.length;
    const wins = closedTrades.filter(t => t.profit > 0).length;
    const winRate = total > 0 ? (wins / total * 100) : 0;
    let totalDuration = 0;
    closedTrades.forEach(t => {
      if (t.openedAt && t.closedAt) {
        totalDuration += new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime();
      }
    });
    const avgDuration = total > 0 ? totalDuration / total : 0;
    const avgDurationStr = avgDuration > 0
      ? `${Math.floor(avgDuration / 60000)}m ${Math.round((avgDuration % 60000) / 1000)}s`
      : 'N/A';
    return { total, wins, winRate, avgDuration: avgDurationStr };
  }, [closedTrades]);

  // Account health score
  const healthScore = useMemo(() => {
    const equityGrowth = Math.min(((equity - 10000) / 10000) * 30, 30);
    const dailyBonus = dailyPnl >= 0 ? 15 : 5;
    const positionPenalty = openTrades.length > 2 ? -10 : 0;
    return Math.round(Math.min(100, Math.max(0, 50 + equityGrowth + dailyBonus + positionPenalty)));
  }, [equity, dailyPnl, openTrades.length]);

  // Error log counts
  const logCounts = useMemo(() => ({
    total: errorLogs.length,
    errors: errorLogs.filter(l => l.level === 'error').length,
    warnings: errorLogs.filter(l => l.level === 'warning').length,
    info: errorLogs.filter(l => l.level === 'info').length,
    resolved: errorLogs.filter(l => l.resolved).length,
  }), [errorLogs]);

  const filteredLogs = logFilter === 'all'
    ? errorLogs
    : errorLogs.filter(l => l.level === logFilter);

  const filterButtons = [
    { key: 'all', label: 'All', count: logCounts.total, color: 'text-foreground' },
    { key: 'error', label: 'Errors', count: logCounts.errors, color: 'text-red-500' },
    { key: 'warning', label: 'Warnings', count: logCounts.warnings, color: 'text-amber-500' },
    { key: 'info', label: 'Info', count: logCounts.info, color: 'text-slate-400' },
  ];

  return (
    <div className="p-4">
      <Tabs defaultValue="broker" className="w-full">
        <TabsList className="bg-card border border-border mb-4">
          <TabsTrigger value="broker" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Server className="h-3.5 w-3.5 mr-1" />
            Broker
          </TabsTrigger>
          <TabsTrigger value="account" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Shield className="h-3.5 w-3.5 mr-1" />
            Account
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Bell className="h-3.5 w-3.5 mr-1" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <TriangleAlert className="h-3.5 w-3.5 mr-1" />
            Error Logs
          </TabsTrigger>
        </TabsList>

        {/* ==================== BROKER TAB ==================== */}
        <TabsContent value="broker" className="space-y-4">
          {/* Broker Hero Card */}
          <Card className="glass-card elevated-card card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Logo Placeholder */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-black text-white">FX</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-lg font-bold">{BROKER_CONFIG.name}</h2>
                    <Badge variant="outline" className={`text-[10px] border-emerald-500/50 text-emerald-500 ${isConnected ? 'pulse-dot-border' : ''}`}>
                      {isConnected ? '● Connected' : '○ Disconnected'}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">MetaTrader 5 • ECN Account • 1:{BROKER_CONFIG.leverage} Leverage</div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-[10px]">
                      <Globe className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Jakarta, Indonesia</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <HardDrive className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">MT5 Server</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">USD Account</span>
                    </div>
                  </div>
                </div>
                {/* Connection Test Button */}
                <div className="flex flex-col items-end gap-1">
                  <Button
                    onClick={handleConnectionTest}
                    disabled={isTesting}
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                  >
                    {isTesting ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Wifi className="h-3.5 w-3.5 mr-1" />
                        Connection Test
                      </>
                    )}
                  </Button>
                  {testResult && (
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-center gap-1 text-[10px] ${testResult === 'success' ? 'text-emerald-500' : 'text-red-500'}`}
                      >
                        {testResult === 'success' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                        {testResult === 'success' ? `Connected (${testPing}ms)` : 'Connection failed'}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Broker Specs - 2-column grid with green dots */}
          <Card className="glass-card card-hover">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <span className="section-title-accent"><CardTitle className="text-sm font-semibold">Broker Specifications</CardTitle></span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 stagger-children">
                {[
                  { label: 'Leverage', value: `1:${BROKER_CONFIG.leverage}` },
                  { label: 'Min Spread', value: `${BROKER_CONFIG.minSpread} pips` },
                  { label: 'Commission', value: `$${BROKER_CONFIG.commission}/lot` },
                  { label: 'Min Lot Size', value: BROKER_CONFIG.minLotSize.toString() },
                  { label: 'Max Lot Size', value: BROKER_CONFIG.maxLotSize.toString() },
                  { label: 'Max Open Positions', value: BROKER_CONFIG.maxOpenPositions.toString() },
                  { label: 'Margin Call Level', value: `${BROKER_CONFIG.marginCall}%` },
                  { label: 'Stop Out Level', value: `${BROKER_CONFIG.stopOut}%` },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">{item.label}</span>
                      <span className={`text-sm font-medium tabular-nums ${['Leverage', 'Min Spread', 'Commission'].includes(item.label) ? 'metric-compact' : ''}`}>{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Server Status */}
          <Card className="glass-card card-hover">
            <CardHeader className="pb-2 pt-3 px-4">
              <span className="section-title-accent"><CardTitle className="text-sm font-semibold">Server Status</CardTitle></span>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 pulse-dot' : 'bg-red-500'}`} />
                  <div>
                    <div className="text-[10px] text-muted-foreground">Connection</div>
                    <div className="text-xs font-medium">{isConnected ? 'Connected' : 'Disconnected'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <div>
                    <div className="text-[10px] text-muted-foreground">Price Feed</div>
                    <div className="text-xs font-medium">{isConnected ? 'Live' : 'Offline'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isAutoTrading ? 'bg-emerald-500 pulse-dot' : 'bg-slate-500'}`} />
                  <div>
                    <div className="text-[10px] text-muted-foreground">Auto Trading</div>
                    <div className="text-xs font-medium">{isAutoTrading ? 'Running' : 'Stopped'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <div>
                    <div className="text-[10px] text-muted-foreground">Account</div>
                    <div className="text-xs font-medium tabular-nums">${balance.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ACCOUNT TAB ==================== */}
        <TabsContent value="account" className="space-y-4">
          {/* Account Summary Card */}
          <Card className="glass-card card-hover">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="section-title-accent"><CardTitle className="text-sm font-semibold">Account Overview</CardTitle></span>
                </div>
                <Badge className={`text-[10px] ${accountType === 'live' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30'}`}>
                  {accountType === 'live' ? '● LIVE' : '● DEMO'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
                <div className="p-3 rounded-lg bg-accent/50 border border-border">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Balance</div>
                  <div className="text-lg font-bold tabular-nums">${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="p-3 rounded-lg bg-accent/50 border border-border">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Equity</div>
                  <div className={`text-lg font-bold tabular-nums ${equity >= balance ? 'text-emerald-500' : 'text-red-500'}`}>
                    ${equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-accent/50 border border-border">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Used Margin</div>
                  <div className="text-lg font-bold tabular-nums">${margin.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="p-3 rounded-lg bg-accent/50 border border-border">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Total P&L</div>
                  <div className={`text-lg font-bold tabular-nums ${totalPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trading Statistics + Account Health */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
            <Card className="glass-card card-hover">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="section-title-accent"><CardTitle className="text-sm font-semibold">Trading Statistics</CardTitle></span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-3 gap-3 stagger-children">
                  <div className="text-center p-2 rounded-lg bg-accent/30">
                    <div className="text-[10px] text-muted-foreground">Total Trades</div>
                    <div className="text-base font-bold tabular-nums mt-0.5">{accountStats.total}</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-accent/30">
                    <div className="text-[10px] text-muted-foreground">Win Rate</div>
                    <div className={`text-base font-bold tabular-nums mt-0.5 ${accountStats.winRate >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {accountStats.winRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-accent/30">
                    <div className="text-[10px] text-muted-foreground">Avg Duration</div>
                    <div className="text-base font-bold tabular-nums mt-0.5">{accountStats.avgDuration}</div>
                  </div>
                </div>
                <Separator className="opacity-50" />
                <div className="grid grid-cols-2 gap-3 stagger-children">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Wins</span>
                    <span className="text-[11px] font-bold tabular-nums text-emerald-500">{accountStats.wins}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Losses</span>
                    <span className="text-[11px] font-bold tabular-nums text-red-500">{accountStats.total - accountStats.wins}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Daily P&L</span>
                    <span className={`text-[11px] font-bold tabular-nums ${dailyPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {dailyPnl >= 0 ? '+' : ''}${dailyPnl.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Open Positions</span>
                    <span className="text-[11px] font-bold tabular-nums">{openTrades.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Health */}
            <Card className="glass-card card-hover">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="section-title-accent"><CardTitle className="text-sm font-semibold">Account Health</CardTitle></span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex items-center gap-4 mb-4">
                  {/* Health Gauge */}
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <svg width="80" height="80" className="-rotate-90">
                      <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                      <circle
                        cx="40" cy="40" r="32" fill="none"
                        stroke={healthScore >= 70 ? '#10b981' : healthScore >= 40 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="6"
                        strokeDasharray={2 * Math.PI * 32}
                        strokeDashoffset={2 * Math.PI * 32 * (1 - healthScore / 100)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-lg font-bold tabular-nums ${healthScore >= 70 ? 'text-emerald-500' : healthScore >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                        {healthScore}
                      </span>
                      <span className="text-[8px] text-muted-foreground">SCORE</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className={`text-sm font-semibold ${healthScore >= 70 ? 'text-emerald-500' : healthScore >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                      {healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Needs Attention'}
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-relaxed">
                      {healthScore >= 70
                        ? 'Account is performing well. Continue following risk rules.'
                        : healthScore >= 40
                        ? 'Account performance is moderate. Consider reducing position sizes.'
                        : 'Account health is low. Review risk management and consider pausing trading.'}
                    </div>
                  </div>
                </div>

                <Separator className="opacity-50 mb-3" />

                <div className="grid grid-cols-2 gap-2 text-[10px] stagger-children">
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-accent/30">
                    <span className="text-muted-foreground">Equity Growth</span>
                    <span className={`font-bold tabular-nums ${equity >= 10000 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {((equity - 10000) / 10000 * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-accent/30">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 cursor-help">
                            <span className="text-muted-foreground">Leverage</span>
                            <Info className="h-2.5 w-2.5 text-muted-foreground" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[200px] text-[10px]">
                          1:{BROKER_CONFIG.leverage} leverage means you control ${BROKER_CONFIG.leverage.toLocaleString()} per $1 of margin.
                          Higher leverage amplifies both gains and losses.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span className="font-bold tabular-nums">1:{BROKER_CONFIG.leverage}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Auto Trading + Notifications */}
          <Card className="glass-card card-hover">
            <CardHeader className="pb-2 pt-3 px-4">
              <span className="section-title-accent"><CardTitle className="text-sm font-semibold">Settings</CardTitle></span>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border">
                <div>
                  <div className="text-xs font-medium flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    Enable Auto Trading
                  </div>
                  <div className="text-[10px] text-muted-foreground">AI will automatically execute trades based on signals</div>
                </div>
                <Switch
                  checked={isAutoTrading}
                  onCheckedChange={(checked) => {
                    useTradingStore.getState().setAutoTrading(checked);
                    addNotification({ type: 'info', title: 'Auto Trading', message: checked ? 'Auto trading enabled' : 'Auto trading disabled' });
                  }}
                  disabled={!isConnected}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border">
                <div>
                  <div className="text-xs font-medium">Email Notifications</div>
                  <div className="text-[10px] text-muted-foreground">Receive trade alerts and reports via email</div>
                </div>
                <Switch checked={emailNotif} onCheckedChange={setEmailNotif} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border">
                <div>
                  <div className="text-xs font-medium">Push Notifications</div>
                  <div className="text-[10px] text-muted-foreground">Browser push notifications for important events</div>
                </div>
                <Switch checked={pushNotif} onCheckedChange={setPushNotif} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border">
                <div>
                  <div className="text-xs font-medium flex items-center gap-1.5">
                    <Volume2 className="h-3.5 w-3.5 text-primary" />
                    Sound Notifications
                  </div>
                  <div className="text-[10px] text-muted-foreground">Play audio alerts for trades, signals, and price alerts</div>
                </div>
                <Switch checked={soundNotif} onCheckedChange={(checked) => { setSoundNotif(checked); setSoundEnabled(checked); }} className="data-[state=checked]:bg-emerald-600" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ALERTS TAB ==================== */}
        <TabsContent value="notifications" className="space-y-4">
          <Card className="glass-card card-hover">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <span className="section-title-accent"><CardTitle className="text-sm font-semibold">Price Alerts</CardTitle></span>
                  <Badge variant="outline" className="text-[10px]">{priceAlerts.length}</Badge>
                </div>
                <Button
                  onClick={addNewAlert}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs"
                >
                  <Bell className="h-3.5 w-3.5 mr-1" />
                  Create Alert
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {/* Alert Form */}
              <div className="flex flex-wrap items-end gap-2 mb-4 p-3 rounded-lg bg-accent/30 border border-border">
                <div className="min-w-[100px]">
                  <Label className="text-[10px] text-muted-foreground">Symbol</Label>
                  <Select value={newAlertSymbol} onValueChange={(v) => setNewAlertSymbol(v as Symbol)}>
                    <SelectTrigger className="h-8 text-xs mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYMBOLS.map(sym => (
                        <SelectItem key={sym} value={sym}>{SYMBOL_INFO[sym].name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[100px]">
                  <Label className="text-[10px] text-muted-foreground">Condition</Label>
                  <Select value={newAlertCondition} onValueChange={setNewAlertCondition}>
                    <SelectTrigger className="h-8 text-xs mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Above</SelectItem>
                      <SelectItem value="below">Below</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[110px]">
                  <Label className="text-[10px] text-muted-foreground">Price</Label>
                  <Input
                    type="number"
                    value={newAlertPrice}
                    onChange={(e) => setNewAlertPrice(e.target.value)}
                    step="0.00001"
                    className="h-8 text-xs tabular-nums mt-0.5"
                  />
                </div>
                <Button onClick={addNewAlert} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-8">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Alert Cards */}
              {priceAlerts.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-full bg-accent/50 border border-border flex items-center justify-center mx-auto mb-3">
                    <Bell className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">No Price Alerts</h3>
                  <p className="text-[11px] text-muted-foreground max-w-[250px] mx-auto">Create price alerts to get notified when a symbol reaches your target price.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {priceAlerts.map((alert) => {
                      const symInfo = SYMBOL_INFO[alert.symbol as Symbol];
                      const createdTs = parseInt(alert.id.replace('alert-', ''));
                      const createdStr = isNaN(createdTs) ? '' : new Date(createdTs).toLocaleString();
                      return (
                        <motion.div
                          key={alert.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${alert.isActive ? 'border-primary/20 bg-primary/5' : 'border-border opacity-40'}`}
                        >
                          {/* Symbol Badge */}
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-primary">{alert.symbol}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-xs font-medium">{symInfo?.name || alert.symbol}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${alert.condition === 'above' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                {alert.condition === 'above' ? '↑ Above' : '↓ Below'}
                              </span>
                              <span className="text-xs font-bold tabular-nums">
                                {alert.price.toFixed(symInfo?.digits || 5)}
                              </span>
                            </div>
                            {createdStr && (
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {createdStr}
                              </div>
                            )}
                          </div>

                          <Switch
                            checked={alert.isActive}
                            onCheckedChange={() => togglePriceAlert(alert.id)}
                            className="scale-75 data-[state=checked]:bg-emerald-600"
                          />

                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => removePriceAlert(alert.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ERROR LOGS TAB ==================== */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="glass-card card-hover">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-primary" />
                <span className="section-title-accent"><CardTitle className="text-sm font-semibold">Error Logs</CardTitle></span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {/* Summary Bar */}
              <div className="flex items-center gap-3 mb-3 p-2.5 rounded-lg bg-accent/30 border border-border">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-muted-foreground">Errors:</span>
                  <span className="font-bold tabular-nums text-red-500">{logCounts.errors}</span>
                </div>
                <div className="w-px h-3 bg-border" />
                <div className="flex items-center gap-1.5 text-[11px]">
                  <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-muted-foreground">Warnings:</span>
                  <span className="font-bold tabular-nums text-amber-500">{logCounts.warnings}</span>
                </div>
                <div className="w-px h-3 bg-border" />
                <div className="flex items-center gap-1.5 text-[11px]">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-muted-foreground">Resolved:</span>
                  <span className="font-bold tabular-nums text-emerald-500">{logCounts.resolved}</span>
                </div>
                <div className="ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      clearResolvedLogs();
                      addNotification({ type: 'info', title: 'Logs Cleared', message: 'Resolved logs have been removed.' });
                    }}
                    disabled={logCounts.resolved === 0}
                  >
                    Clear Resolved
                  </Button>
                </div>
              </div>

              {/* Filter Buttons */}
              <div className="flex items-center gap-2 mb-3">
                {filterButtons.map((fb) => (
                  <Button
                    key={fb.key}
                    variant={logFilter === fb.key ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 text-[10px] ${logFilter === fb.key ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/20' : ''}`}
                    onClick={() => setLogFilter(fb.key)}
                  >
                    <Filter className="h-3 w-3 mr-1" />
                    {fb.label}
                    {fb.count > 0 && (
                      <Badge variant="outline" className={`ml-1.5 text-[9px] px-1 py-0 border-current/30 ${fb.color}`}>
                        {fb.count}
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>

              {/* Log Entries - Timeline Format */}
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-full bg-accent/50 border border-border flex items-center justify-center mx-auto mb-3">
                    <RefreshCw className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <div className="text-sm text-muted-foreground">No {logFilter === 'all' ? '' : logFilter} logs recorded</div>
                  <div className="text-xs text-muted-foreground">Errors and warnings will appear here</div>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="relative pl-5">
                    {/* Vertical timeline line */}
                    <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />

                    <div className="space-y-2">
                      {filteredLogs.map((log, i) => {
                        const lineColor = log.level === 'error' ? 'bg-red-500' : log.level === 'warning' ? 'bg-amber-500' : 'bg-slate-500';
                        const borderColor = log.level === 'error' ? 'border-red-500/20 bg-red-500/5' : log.level === 'warning' ? 'border-amber-500/20 bg-amber-500/5' : 'border-border bg-accent/30';
                        return (
                          <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="relative"
                          >
                            {/* Timeline dot */}
                            <div className={`absolute -left-5 top-3 w-3.5 h-3.5 rounded-full ${lineColor} border-2 border-[#0a0f1c]`} />

                            <div className={`p-3 rounded-lg border ${borderColor} ${log.resolved ? 'opacity-40' : ''}`}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] px-1.5 py-0 ${
                                      log.level === 'error' ? 'border-red-500/50 text-red-500' :
                                      log.level === 'warning' ? 'border-amber-500/50 text-amber-500' :
                                      'border-slate-500/50 text-slate-500'
                                    }`}
                                  >
                                    {log.level.toUpperCase()}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">{log.source}</span>
                                  {log.resolved && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/50 text-emerald-500">
                                      RESOLVED
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground tabular-nums">{log.timestamp}</span>
                              </div>
                              <div className="text-[11px] leading-relaxed">{log.message}</div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
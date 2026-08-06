'use client';

import { useState, useMemo } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, STRATEGIES, type Symbol, type StrategyName, type BacktestResult } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RefreshCw, LineChart as LineChartIcon, TrendingUp, Target, ShieldAlert, Zap, Calendar, BarChart3 } from 'lucide-react';

function generateMockBacktestResult(strategy: StrategyName, symbol: Symbol): BacktestResult {
  const initialBalance = 10000;
  const totalTrades = Math.floor(Math.random() * 150) + 50;
  const winRate = 40 + Math.random() * 30;
  const wins = Math.floor(totalTrades * winRate / 100);
  const losses = totalTrades - wins;
  const avgWin = 15 + Math.random() * 30;
  const avgLoss = 8 + Math.random() * 15;
  const totalProfit = wins * avgWin;
  const totalLoss = losses * avgLoss;
  const finalBalance = initialBalance + totalProfit - totalLoss;
  const maxDD = 5 + Math.random() * 20;
  const sharpeRatio = 0.5 + Math.random() * 2.5;
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;

  const equityCurve: { trade: number; equity: number }[] = [];
  let equity = initialBalance;
  for (let i = 0; i < totalTrades; i++) {
    const isWin = Math.random() * 100 < winRate;
    equity += isWin ? avgWin * (0.5 + Math.random()) : -avgLoss * (0.5 + Math.random());
    equityCurve.push({ trade: i + 1, equity: Math.round(equity * 100) / 100 });
  }

  return {
    id: `bt-${Date.now()}`,
    name: STRATEGIES[strategy].label,
    symbol,
    strategy,
    initialBalance,
    finalBalance: Math.round(finalBalance * 100) / 100,
    totalTrades,
    winRate: Math.round(winRate * 10) / 10,
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxDrawdown: Math.round(maxDD * 10) / 10,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    totalLoss: Math.round(totalLoss * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    equityCurve,
  };
}

export default function BacktestingView() {
  const { backtestResults, setBacktestResults, isBacktesting, setIsBacktesting, addNotification } = useTradingStore();

  const [selectedStrategy, setSelectedStrategy] = useState<StrategyName>('EMA_Crossover');
  const [selectedSymbol, setSelectedSymbol] = useState<Symbol>('EURUSD');
  const [startDate, setStartDate] = useState('2024-06-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [activeResult, setActiveResult] = useState<BacktestResult | null>(null);

  const handleRunBacktest = () => {
    setIsBacktesting(true);
    addNotification({ type: 'info', title: 'Backtest Started', message: `Running ${STRATEGIES[selectedStrategy].label} on ${SYMBOL_INFO[selectedSymbol].name}...` });

    setTimeout(() => {
      const result = generateMockBacktestResult(selectedStrategy, selectedSymbol);
      setBacktestResults([result, ...backtestResults]);
      setActiveResult(result);
      setIsBacktesting(false);
      addNotification({ type: 'success', title: 'Backtest Complete', message: `${result.totalTrades} trades, ${result.winRate}% win rate` });
    }, 2500);
  };

  const latestResult = activeResult || backtestResults[0] || null;

  return (
    <div className="p-4 space-y-4">
      {/* Controls */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[160px]">
              <Label className="text-[11px] text-muted-foreground">Strategy</Label>
              <Select value={selectedStrategy} onValueChange={(v) => setSelectedStrategy(v as StrategyName)}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STRATEGIES).map(([key, strat]) => (
                    <SelectItem key={key} value={key}>{strat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <Label className="text-[11px] text-muted-foreground">Symbol</Label>
              <Select value={selectedSymbol} onValueChange={(v) => setSelectedSymbol(v as Symbol)}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map(sym => (
                    <SelectItem key={sym} value={sym}>{SYMBOL_INFO[sym].name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[130px]">
              <Label className="text-[11px] text-muted-foreground">Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-sm mt-1" />
            </div>
            <div className="min-w-[130px]">
              <Label className="text-[11px] text-muted-foreground">End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-sm mt-1" />
            </div>
            <Button
              onClick={handleRunBacktest}
              disabled={isBacktesting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              size="sm"
            >
              <AnimatePresence mode="wait">
                {isBacktesting ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Running...
                  </motion.div>
                ) : (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <Play className="h-3.5 w-3.5" />
                    Run Backtest
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </CardContent>
      </Card>

      {latestResult ? (
        <>
          {/* Equity Curve */}
          <Card className="glass-card">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LineChartIcon className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold">
                    Equity Curve — {latestResult.name} ({SYMBOL_INFO[latestResult.symbol].name})
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {startDate} → {endDate}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={latestResult.equityCurve}>
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={latestResult.finalBalance >= latestResult.initialBalance ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={latestResult.finalBalance >= latestResult.initialBalance ? '#10b981' : '#ef4444'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="trade" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: '#e2e8f0' }}
                      formatter={(value: number) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Equity']}
                      labelFormatter={(label) => `Trade #${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke={latestResult.finalBalance >= latestResult.initialBalance ? '#10b981' : '#ef4444'}
                      strokeWidth={1.5}
                      fill="url(#equityGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total Trades', value: latestResult.totalTrades.toString(), icon: <BarChart3 className="h-4 w-4" />, color: 'text-foreground' },
              { label: 'Win Rate', value: `${latestResult.winRate}%`, icon: <Target className="h-4 w-4" />, color: latestResult.winRate >= 55 ? 'text-emerald-500' : latestResult.winRate >= 45 ? 'text-amber-500' : 'text-red-500' },
              { label: 'Profit Factor', value: latestResult.profitFactor.toFixed(2), icon: <TrendingUp className="h-4 w-4" />, color: latestResult.profitFactor >= 1.5 ? 'text-emerald-500' : latestResult.profitFactor >= 1.0 ? 'text-amber-500' : 'text-red-500' },
              { label: 'Max Drawdown', value: `${latestResult.maxDrawdown}%`, icon: <ShieldAlert className="h-4 w-4" />, color: latestResult.maxDrawdown <= 10 ? 'text-emerald-500' : latestResult.maxDrawdown <= 20 ? 'text-amber-500' : 'text-red-500' },
              { label: 'Sharpe Ratio', value: latestResult.sharpeRatio.toFixed(2), icon: <Zap className="h-4 w-4" />, color: latestResult.sharpeRatio >= 1.5 ? 'text-emerald-500' : latestResult.sharpeRatio >= 1.0 ? 'text-amber-500' : 'text-red-500' },
              { label: 'Total Profit', value: `$${latestResult.totalProfit.toFixed(0)}`, icon: <TrendingUp className="h-4 w-4" />, color: 'text-emerald-500' },
              { label: 'Total Loss', value: `$${latestResult.totalLoss.toFixed(0)}`, icon: <TrendingUp className="h-4 w-4 rotate-180" />, color: 'text-red-500' },
            ].map((stat) => (
              <Card key={stat.label} className="glass-card">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                    <span className={stat.color}>{stat.icon}</span>
                  </div>
                  <div className={`text-lg font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Additional Stats + Trade List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="glass-card">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-semibold">Detailed Stats</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                {[
                  { label: 'Initial Balance', value: `$${latestResult.initialBalance.toLocaleString()}` },
                  { label: 'Final Balance', value: `$${latestResult.finalBalance.toLocaleString()}`, color: latestResult.finalBalance >= latestResult.initialBalance ? 'text-emerald-500' : 'text-red-500' },
                  { label: 'Net Profit/Loss', value: `$${(latestResult.finalBalance - latestResult.initialBalance).toFixed(2)}`, color: latestResult.finalBalance >= latestResult.initialBalance ? 'text-emerald-500' : 'text-red-500' },
                  { label: 'Return', value: `${(((latestResult.finalBalance - latestResult.initialBalance) / latestResult.initialBalance) * 100).toFixed(2)}%`, color: latestResult.finalBalance >= latestResult.initialBalance ? 'text-emerald-500' : 'text-red-500' },
                  { label: 'Avg Win', value: `$${latestResult.avgWin.toFixed(2)}`, color: 'text-emerald-500' },
                  { label: 'Avg Loss', value: `$${latestResult.avgLoss.toFixed(2)}`, color: 'text-red-500' },
                  { label: 'Avg Win/Loss Ratio', value: (latestResult.avgLoss > 0 ? (latestResult.avgWin / latestResult.avgLoss).toFixed(2) : '∞') },
                  { label: 'Expected Value', value: `$${((latestResult.winRate / 100 * latestResult.avgWin) - ((100 - latestResult.winRate) / 100 * latestResult.avgLoss)).toFixed(2)}` },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1">
                    <span className="text-[11px] text-muted-foreground">{item.label}</span>
                    <span className={`text-[11px] font-medium tabular-nums ${'color' in item && (item as any).color ? (item as any).color : 'text-foreground'}`}>{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="glass-card lg:col-span-2">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-semibold">Trade List (Sample)</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-[10px] h-8">#</TableHead>
                        <TableHead className="text-[10px] h-8">Equity</TableHead>
                        <TableHead className="text-[10px] h-8">P&L Change</TableHead>
                        <TableHead className="text-[10px] h-8 text-right">Cumulative P&L</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {latestResult.equityCurve.map((point, idx) => {
                        const prevEquity = idx > 0 ? latestResult.equityCurve[idx - 1].equity : latestResult.initialBalance;
                        const pnlChange = point.equity - prevEquity;
                        const cumPnl = point.equity - latestResult.initialBalance;
                        return (
                          <TableRow key={point.trade} className="border-border">
                            <TableCell className="text-[10px] tabular-nums">{point.trade}</TableCell>
                            <TableCell className="text-[10px] tabular-nums">${point.equity.toFixed(2)}</TableCell>
                            <TableCell className={`text-[10px] tabular-nums font-medium ${pnlChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {pnlChange >= 0 ? '+' : ''}${pnlChange.toFixed(2)}
                            </TableCell>
                            <TableCell className={`text-[10px] text-right tabular-nums font-medium ${cumPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {cumPnl >= 0 ? '+' : ''}${cumPnl.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <LineChartIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-medium text-muted-foreground mb-1">No Backtest Results</h3>
            <p className="text-xs text-muted-foreground">Select a strategy, symbol, and date range, then click &quot;Run Backtest&quot; to see results.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

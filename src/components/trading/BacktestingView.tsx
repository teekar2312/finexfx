'use client';

import { useState, useMemo } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, STRATEGIES, type Symbol, type StrategyName, type BacktestResult } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ComposedChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RefreshCw, LineChart as LineChartIcon, TrendingUp, TrendingDown, DollarSign, Activity, Zap, Target, Shield, BarChart3, Clock, ArrowUpRight, ArrowDownRight, History } from 'lucide-react';

// Tooltip component declared outside render to avoid react-hooks/static-components lint error
function BacktestEquityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  return (
    <div className="bg-slate-800/95 border border-white/10 rounded-lg px-3 py-2 text-[11px] shadow-xl">
      <div className="text-muted-foreground mb-1">Trade #{label}</div>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-muted-foreground">Equity:</span>
        <span className={`font-bold tabular-nums ${data.equity >= 10000 ? 'text-emerald-500' : 'text-red-500'}`}>
          ${data.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-muted-foreground">Peak:</span>
        <span className="tabular-nums text-slate-300">${data.peak.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      </div>
      {data.drawdownGap > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Drawdown:</span>
          <span className="tabular-nums text-red-400">${data.drawdownGap.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

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

function WinRateRing({ value }: { value: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  const color = value >= 55 ? '#10b981' : value >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg width="48" height="48" className="-rotate-90">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3.5" />
        <circle
          cx="24" cy="24" r={radius} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{Math.round(value)}</span>
      </div>
    </div>
  );
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

  // Chart data with drawdown computation
  const chartData = useMemo(() => {
    if (!latestResult) return [];
    let peak = latestResult.initialBalance;
    return latestResult.equityCurve.map(point => {
      peak = Math.max(peak, point.equity);
      const drawdownGap = peak > point.equity ? Math.round((peak - point.equity) * 100) / 100 : 0;
      return {
        trade: point.trade,
        equity: point.equity,
        peak: Math.round(peak * 100) / 100,
        drawdownGap,
      };
    });
  }, [latestResult]);

  // Min/Max equity points
  const { maxPoint, minPoint } = useMemo(() => {
    if (!chartData.length) return { maxPoint: null, minPoint: null };
    let maxP = chartData[0];
    let minP = chartData[0];
    for (const p of chartData) {
      if (p.equity > maxP.equity) maxP = p;
      if (p.equity < minP.equity) minP = p;
    }
    return { maxPoint: maxP, minPoint: minP };
  }, [chartData]);

  // Trade distribution
  const distribution = useMemo(() => {
    if (!latestResult) return { wins: 0, losses: 0, longs: 0, shorts: 0, avgHolding: 'N/A' };
    const wins = Math.round(latestResult.totalTrades * latestResult.winRate / 100);
    const losses = latestResult.totalTrades - wins;
    const longs = Math.round(latestResult.totalTrades * 0.55);
    const shorts = latestResult.totalTrades - longs;
    const tf = STRATEGIES[latestResult.strategy].timeframe;
    const avgHolding = tf.startsWith('M1') ? '3m 42s' : tf.startsWith('M2') ? '8m 15s' : '22m 08s';
    return { wins, losses, longs, shorts, avgHolding };
  }, [latestResult]);

  const isProfitable = latestResult ? latestResult.finalBalance >= latestResult.initialBalance : false;
  const totalPnL = latestResult ? latestResult.finalBalance - latestResult.initialBalance : 0;



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
          {/* Enhanced Equity Curve */}
          <Card className="glass-card elevated-card card-hover">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LineChartIcon className="h-4 w-4 text-primary" />
                  <span className="section-title-accent"><CardTitle className="text-sm font-semibold">
                    Equity Curve — {latestResult.name} ({SYMBOL_INFO[latestResult.symbol].name})
                  </CardTitle></span>
                </div>
                <div className="flex items-center gap-3">
                  {maxPoint && (
                    <div className="flex items-center gap-1 text-[10px]">
                      <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-500 tabular-nums">High ${maxPoint.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {minPoint && (
                    <div className="flex items-center gap-1 text-[10px]">
                      <ArrowDownRight className="h-3 w-3 text-red-500" />
                      <span className="text-red-500 tabular-nums">Low ${minPoint.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {startDate} → {endDate}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isProfitable ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={isProfitable ? '#10b981' : '#ef4444'} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="trade" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                    <Tooltip content={<BacktestEquityTooltip />} />
                    <ReferenceLine y={10000} stroke="rgba(255,255,255,0.25)" strokeDasharray="6 4" label={{ value: 'Initial $10,000', position: 'insideTopRight', fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
                    <Area type="monotone" dataKey="equity" stackId="stack" stroke={isProfitable ? '#10b981' : '#ef4444'} strokeWidth={1.5} fill="url(#equityGradient)" dot={false} />
                    <Area type="stepAfter" dataKey="drawdownGap" stackId="stack" fill="url(#drawdownGradient)" stroke="none" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid 2x4 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children glass-card-premium p-3 rounded-xl">
            {/* Total P&L */}
            <Card className={`glass-card card-hover ${isProfitable ? 'neon-glow border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
              <CardContent className="p-3 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total P&L</span>
                  <DollarSign className={`h-4 w-4 ${isProfitable ? 'text-emerald-500' : 'text-red-500'}`} />
                </div>
                <div className={`text-xl font-bold tabular-nums ${isProfitable ? 'text-emerald-500' : 'text-red-500'}`}>
                  {totalPnL >= 0 ? '+' : ''}{"$"}{Math.abs(totalPnL).toFixed(2)}
                </div>
                <div className={`text-[10px] tabular-nums mt-0.5 ${isProfitable ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                  {((totalPnL / latestResult.initialBalance) * 100).toFixed(2)}% return
                </div>
              </CardContent>
            </Card>

            {/* Win Rate with Ring */}
            <Card className="glass-card card-hover">
              <CardContent className="p-3 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Win Rate</span>
                    <div className={`text-xl font-bold tabular-nums ${latestResult.winRate >= 55 ? 'text-emerald-500' : latestResult.winRate >= 45 ? 'text-amber-500' : 'text-red-500'}`}>
                      {latestResult.winRate}%
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                      {Math.round(latestResult.totalTrades * latestResult.winRate / 100)}W / {latestResult.totalTrades - Math.round(latestResult.totalTrades * latestResult.winRate / 100)}L
                    </div>
                  </div>
                  <WinRateRing value={latestResult.winRate} />
                </div>
              </CardContent>
            </Card>

            {/* Profit Factor */}
            <Card className="glass-card card-hover">
              <CardContent className="p-3 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Profit Factor</span>
                  <Activity className={`h-4 w-4 ${latestResult.profitFactor >= 1.5 ? 'text-emerald-500' : latestResult.profitFactor >= 1.0 ? 'text-amber-500' : 'text-red-500'}`} />
                </div>
                <div className={`text-xl font-bold tabular-nums ${latestResult.profitFactor >= 1.5 ? 'text-emerald-500' : latestResult.profitFactor >= 1.0 ? 'text-amber-500' : 'text-red-500'}`}>
                  {latestResult.profitFactor.toFixed(2)}
                </div>
                <div className="w-full h-1 rounded-full bg-white/5 mt-2">
                  <div className={`h-full rounded-full transition-all ${latestResult.profitFactor >= 1.5 ? 'bg-emerald-500' : latestResult.profitFactor >= 1.0 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(latestResult.profitFactor / 3 * 100, 100)}%` }} />
                </div>
              </CardContent>
            </Card>

            {/* Max Drawdown */}
            <Card className="glass-card card-hover border-red-500/10">
              <CardContent className="p-3 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Drawdown</span>
                  <Shield className={`h-4 w-4 ${latestResult.maxDrawdown <= 10 ? 'text-emerald-500' : latestResult.maxDrawdown <= 20 ? 'text-amber-500' : 'text-red-500'}`} />
                </div>
                <div className={`text-xl font-bold tabular-nums ${latestResult.maxDrawdown <= 10 ? 'text-emerald-500' : latestResult.maxDrawdown <= 20 ? 'text-amber-500' : 'text-red-500'}`}>
                  {latestResult.maxDrawdown}%
                </div>
                <div className="w-full h-1 rounded-full bg-white/5 mt-2">
                  <div className={`h-full rounded-full ${latestResult.maxDrawdown <= 10 ? 'bg-emerald-500' : latestResult.maxDrawdown <= 20 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(latestResult.maxDrawdown, 100)}%` }} />
                </div>
              </CardContent>
            </Card>

            {/* Sharpe Ratio */}
            <Card className="glass-card card-hover">
              <CardContent className="p-3 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Sharpe Ratio</span>
                  <Zap className={`h-4 w-4 ${latestResult.sharpeRatio >= 1.5 ? 'text-emerald-500' : latestResult.sharpeRatio >= 1.0 ? 'text-amber-500' : 'text-red-500'}`} />
                </div>
                <div className={`text-xl font-bold tabular-nums ${latestResult.sharpeRatio >= 1.5 ? 'text-emerald-500' : latestResult.sharpeRatio >= 1.0 ? 'text-amber-500' : 'text-red-500'}`}>
                  {latestResult.sharpeRatio.toFixed(2)}
                </div>
                <div className="w-full h-1 rounded-full bg-white/5 mt-2">
                  <div className={`h-full rounded-full ${latestResult.sharpeRatio >= 1.5 ? 'bg-emerald-500' : latestResult.sharpeRatio >= 1.0 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(latestResult.sharpeRatio / 3 * 100, 100)}%` }} />
                </div>
              </CardContent>
            </Card>

            {/* Total Trades */}
            <Card className="glass-card card-hover">
              <CardContent className="p-3 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Trades</span>
                  <BarChart3 className="h-4 w-4 text-slate-400" />
                </div>
                <div className="text-xl font-bold tabular-nums text-foreground">
                  {latestResult.totalTrades}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                  {Math.round(latestResult.totalTrades * latestResult.winRate / 100)} winners
                </div>
              </CardContent>
            </Card>

            {/* Avg Win */}
            <Card className="glass-card card-hover border-b-2 border-b-emerald-500/40">
              <CardContent className="p-3 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Win</span>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-xl font-bold tabular-nums text-emerald-500">
                  +${"$"}{latestResult.avgWin.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            {/* Avg Loss */}
            <Card className="glass-card card-hover border-b-2 border-b-red-500/40">
              <CardContent className="p-3 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Loss</span>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </div>
                <div className="text-xl font-bold tabular-nums text-red-500">
                  -${"$"}{latestResult.avgLoss.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trade Distribution */}
          <Card className="glass-card card-hover">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="section-title-accent"><CardTitle className="text-sm font-semibold">Trade Distribution</CardTitle></span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-3 gap-4 stagger-children">
                {/* Win/Loss Distribution */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Win / Loss</div>
                  <div className="h-4 rounded-full bg-red-500/30 overflow-hidden flex">
                    <div className="bg-emerald-500 h-full transition-all" style={{ width: `${latestResult.winRate}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-emerald-500 tabular-nums font-medium">{distribution.wins} Wins ({latestResult.winRate}%)</span>
                    <span className="text-[10px] text-red-500 tabular-nums font-medium">{distribution.losses} Losses ({(100 - latestResult.winRate).toFixed(1)}%)</span>
                  </div>
                </div>

                {/* Long vs Short */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Long / Short</div>
                  <div className="flex gap-3">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                      <span className="text-sm font-bold tabular-nums text-emerald-500">{distribution.longs}</span>
                      <span className="text-[10px] text-muted-foreground">Long</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingDown className="h-3 w-3 text-red-500" />
                      <span className="text-sm font-bold tabular-nums text-red-500">{distribution.shorts}</span>
                      <span className="text-[10px] text-muted-foreground">Short</span>
                    </div>
                  </div>
                </div>

                {/* Avg Holding Time */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Avg Holding Time</div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold tabular-nums">{distribution.avgHolding}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{STRATEGIES[latestResult.strategy].timeframe} timeframe</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Stats + Trade List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger-children">
            <Card className="glass-card card-hover">
              <CardHeader className="pb-2 pt-3 px-4">
                <span className="section-title-accent"><CardTitle className="text-sm font-semibold">Detailed Stats</CardTitle></span>
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

            <Card className="glass-card card-hover lg:col-span-2">
              <CardHeader className="pb-2 pt-3 px-4">
                <span className="section-title-accent"><CardTitle className="text-sm font-semibold">Trade List (Sample)</CardTitle></span>
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

          {/* Backtest History */}
          {backtestResults.length > 1 && (
            <Card className="glass-card card-hover">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <span className="section-title-accent"><CardTitle className="text-sm font-semibold">Backtest History</CardTitle></span>
                  <Badge variant="outline" className="text-[10px] ml-auto">{backtestResults.length} results</Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <ScrollArea className="max-h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-[10px] h-8">Strategy</TableHead>
                        <TableHead className="text-[10px] h-8">Symbol</TableHead>
                        <TableHead className="text-[10px] h-8">Trades</TableHead>
                        <TableHead className="text-[10px] h-8 text-right">Final P&L</TableHead>
                        <TableHead className="text-[10px] h-8 text-right">Win Rate</TableHead>
                        <TableHead className="text-[10px] h-8 text-right">Profit Factor</TableHead>
                        <TableHead className="text-[10px] h-8">Max DD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backtestResults.map((result) => {
                        const pnl = result.finalBalance - result.initialBalance;
                        const isActive = activeResult?.id === result.id;
                        return (
                          <TableRow
                            key={result.id}
                            className={`border-border cursor-pointer transition-colors hover:bg-primary/5 ${isActive ? 'bg-primary/10' : ''}`}
                            onClick={() => setActiveResult(result)}
                          >
                            <TableCell className="text-[11px] font-medium">{result.name}</TableCell>
                            <TableCell className="text-[11px] tabular-nums">{SYMBOL_INFO[result.symbol].name}</TableCell>
                            <TableCell className="text-[11px] tabular-nums">{result.totalTrades}</TableCell>
                            <TableCell className={`text-[11px] tabular-nums font-medium text-right ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                            </TableCell>
                            <TableCell className={`text-[11px] tabular-nums text-right ${result.winRate >= 55 ? 'text-emerald-500' : result.winRate >= 45 ? 'text-amber-500' : 'text-red-500'}`}>
                              {result.winRate}%
                            </TableCell>
                            <TableCell className="text-[11px] tabular-nums text-right">{result.profitFactor.toFixed(2)}</TableCell>
                            <TableCell className={`text-[11px] tabular-nums ${result.maxDrawdown <= 10 ? 'text-emerald-500' : result.maxDrawdown <= 20 ? 'text-amber-500' : 'text-red-500'}`}>
                              {result.maxDrawdown}%
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="glass-card card-hover">
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
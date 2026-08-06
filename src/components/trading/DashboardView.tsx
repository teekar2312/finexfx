'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, BROKER_CONFIG, TRADING_SESSIONS, MARKET_CONDITION_CONFIG, type Symbol, type MarketCondition } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, Activity, Zap, Play, ArrowUpRight, ArrowDownRight, Clock, BarChart3, Shield, Volume2, RefreshCw, Award, Flame, Calendar, Target } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import WatchlistPanel from './WatchlistPanel';
import ActivityFeed from './ActivityFeed';
import SessionOverlapScanner from './SessionOverlapScanner';

function getConditionIcon(condition: MarketCondition) {
  switch (condition) {
    case 'trending': return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    case 'range_bound': return <Activity className="h-4 w-4 text-amber-500" />;
    case 'high_volatility': return <Volume2 className="h-4 w-4 text-red-500" />;
    case 'low_volatility': return <BarChart3 className="h-4 w-4 text-slate-500" />;
  }
}

function getSessionStatus(session: { start: number; end: number }) {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const currentDecimal = currentHour + currentMinute / 60;
  const isActive = currentDecimal >= session.start && currentDecimal < session.end;
  const progress = isActive
    ? ((currentDecimal - session.start) / (session.end - session.start)) * 100
    : 0;
  const duration = session.end - session.start;
  let statusText = '';
  if (isActive) {
    statusText = 'ACTIVE';
  } else if (currentDecimal < session.start) {
    const hoursUntil = session.start - currentHour;
    const minsUntil = (hoursUntil * 60 - currentMinute);
    if (minsUntil > 0) {
      const h = Math.floor(minsUntil / 60);
      const m = minsUntil % 60;
      statusText = `Opens in ${h}:${m.toString().padStart(2, '0')}`;
    } else {
      statusText = 'Closed';
    }
  } else {
    statusText = 'Closed';
  }
  return { isActive, progress, statusText, duration };
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

function MiniSparkline({ values, width = 48, height = 18 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;
  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');
  const isUp = values[values.length - 1] >= values[0];
  const color = isUp ? '#10b981' : '#ef4444';
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function DashboardView() {
  const {
    balance, equity, freeMargin, dailyPnl, totalPnl,
    openTrades, closedTrades, signals, prices, marketConditions,
    isConnected, isAutoTrading, setActiveTab, setAutoTrading,
    todayTradeCount,
  } = useTradingStore();

  const [utcNow, setUtcNow] = useState('');
  const [currentDateTime, setCurrentDateTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setUtcNow(now.toUTCString().slice(17, 25));
      setCurrentDateTime(now.toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const recentSignals = signals.slice(0, 5);

  const pnlPercent = totalPnl !== 0 ? ((totalPnl / balance) * 100) : 0;
  const dailyPnlPercent = dailyPnl !== 0 ? ((dailyPnl / balance) * 100) : 0;

  // Performance metrics from closed trades
  const perfMetrics = useMemo(() => {
    const wins = closedTrades.filter(t => t.profit > 0);
    const losses = closedTrades.filter(t => t.profit <= 0);
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.profit, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.profit, 0) / losses.length) : 0;
    const totalWins = wins.reduce((s, t) => s + t.profit, 0);
    const totalLosses = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;
    return { winRate, avgWin, avgLoss, profitFactor, totalTrades: closedTrades.length };
  }, [closedTrades]);

  const totalPnlData = useMemo(() => {
    const points: { v: number }[] = [];
    let val = 0;
    for (let i = 0; i < 20; i++) {
      val += (Math.random() - 0.45) * 15;
      points.push({ v: val });
    }
    points.push({ v: totalPnl });
    return points;
  }, [totalPnl]);

  const dailyPnlData = useMemo(() => {
    const points: { v: number }[] = [];
    let val = 0;
    for (let i = 0; i < 20; i++) {
      val += (Math.random() - 0.48) * 5;
      points.push({ v: val });
    }
    points.push({ v: dailyPnl });
    return points;
  }, [dailyPnl]);

  const balanceSparkData = useMemo(() => {
    const points: { v: number }[] = [];
    let val = balance - balance * 0.02 * Math.random();
    for (let i = 0; i < 15; i++) {
      val += (Math.random() - 0.47) * balance * 0.005;
      points.push({ v: val });
    }
    points.push({ v: balance });
    return points;
  }, [balance]);

  const equitySparkData = useMemo(() => {
    const points: { v: number }[] = [];
    const base = equity >= balance ? balance : balance * 0.98;
    let val = base;
    for (let i = 0; i < 15; i++) {
      val += (Math.random() - 0.48) * base * 0.004;
      points.push({ v: val });
    }
    points.push({ v: equity });
    return points;
  }, [equity, balance]);

  const freeMarginSparkData = useMemo(() => {
    const points: { v: number }[] = [];
    const base = freeMargin * 1.1;
    let val = base;
    for (let i = 0; i < 15; i++) {
      val += (Math.random() - 0.5) * freeMargin * 0.006;
      points.push({ v: val });
    }
    points.push({ v: freeMargin });
    return points;
  }, [freeMargin]);

  // P&L Calendar mock data
  const calendarPnlData = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 27; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const pnl = (Math.random() - 0.47) * balance * 0.03;
      data.push({
        date,
        day: date.getDate(),
        dayName: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()],
        pnl,
        pnlPercent: (pnl / balance) * 100,
        isToday: i === 0,
      });
    }
    return data;
  }, [balance]);

  // Monthly summary from calendar data
  const monthlySummary = useMemo(() => {
    const totalPnl = calendarPnlData.reduce((s, d) => s + d.pnl, 0);
    const bestDay = calendarPnlData.reduce((best, d) => d.pnl > best.pnl ? d : best, calendarPnlData[0]);
    const worstDay = calendarPnlData.reduce((worst, d) => d.pnl < worst.pnl ? d : worst, calendarPnlData[0]);
    const winningDays = calendarPnlData.filter(d => d.pnl > 0).length;
    return { totalPnl, bestDay, worstDay, winningDays, totalDays: calendarPnlData.length };
  }, [calendarPnlData]);

  // Organize calendar into weeks (Mon-Sun)
  const calendarWeeks = useMemo(() => {
    const weeks: typeof calendarPnlData[] = [];
    const sorted = [...calendarPnlData];
    // Find the first Monday going backwards from day 0
    let startIdx = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].date.getDay() === 1) { // Monday
        startIdx = i;
        break;
      }
    }
    // Rearrange: from first Monday, chunk into 7s
    const reordered = [...sorted.slice(startIdx), ...sorted.slice(0, startIdx)];
    for (let i = 0; i < reordered.length; i += 7) {
      weeks.push(reordered.slice(i, i + 7));
    }
    return weeks;
  }, [calendarPnlData]);

  // Sparkline data for market conditions
  const sparklineData = useMemo(() => {
    const data: Record<string, number[]> = {};
    SYMBOLS.forEach((sym) => {
      const history = useTradingStore.getState().priceHistory[sym];
      if (history && history.length >= 3) {
        const recent = history.slice(-3);
        data[sym] = recent.map(h => h.close);
      } else {
        const p = prices[sym];
        if (p) {
          const base = p.bid;
          const pip = SYMBOL_INFO[sym].pipSize;
          data[sym] = [base - pip * 3, base - pip, base];
        } else {
          data[sym] = [1, 1.001, 1.002];
        }
      }
    });
    return data;
  }, [prices]);

  const stats = [
    {
      label: 'Balance',
      value: `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign className="h-4 w-4" />,
      color: 'text-foreground',
      sparkData: balanceSparkData,
      accentClass: 'stat-accent-emerald',
      iconGradient: 'from-emerald-500/20 to-cyan-500/20',
      iconTextColor: 'text-emerald-400',
    },
    {
      label: 'Equity',
      value: `$${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <Activity className="h-4 w-4" />,
      color: equity >= balance ? 'text-emerald-500' : 'text-red-500',
      sparkData: equitySparkData,
      accentClass: equity >= balance ? 'stat-accent-emerald' : 'stat-accent-red',
      iconGradient: equity >= balance ? 'from-emerald-500/20 to-cyan-500/20' : 'from-red-500/20 to-orange-500/20',
      iconTextColor: equity >= balance ? 'text-emerald-400' : 'text-red-400',
    },
    {
      label: 'Free Margin',
      value: `$${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <Shield className="h-4 w-4" />,
      color: 'text-foreground',
      sparkData: freeMarginSparkData,
      accentClass: 'stat-accent-neutral',
      iconGradient: 'from-slate-500/20 to-slate-400/20',
      iconTextColor: 'text-slate-400',
    },
    {
      label: 'Daily P&L',
      value: `${dailyPnl >= 0 ? '+' : ''}$${dailyPnl.toFixed(2)}`,
      subValue: `${dailyPnlPercent >= 0 ? '+' : ''}${dailyPnlPercent.toFixed(2)}%`,
      icon: dailyPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
      color: dailyPnl >= 0 ? 'text-emerald-500' : 'text-red-500',
      sparkData: dailyPnlData,
      accentClass: dailyPnl >= 0 ? 'stat-accent-emerald' : 'stat-accent-red',
      iconGradient: dailyPnl >= 0 ? 'from-emerald-500/20 to-cyan-500/20' : 'from-red-500/20 to-orange-500/20',
      iconTextColor: dailyPnl >= 0 ? 'text-emerald-400' : 'text-red-400',
    },
    {
      label: 'Total P&L',
      value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`,
      subValue: `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`,
      icon: totalPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
      color: totalPnl >= 0 ? 'text-emerald-500' : 'text-red-500',
      sparkData: totalPnlData,
      accentClass: totalPnl >= 0 ? 'stat-accent-emerald' : 'stat-accent-red',
      iconGradient: totalPnl >= 0 ? 'from-emerald-500/20 to-cyan-500/20' : 'from-red-500/20 to-orange-500/20',
      iconTextColor: totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400',
    },
  ];

  const perfCards = [
    {
      label: 'Win Rate',
      value: perfMetrics.totalTrades > 0 ? `${perfMetrics.winRate.toFixed(0)}%` : '0%',
      icon: <Award className="h-3.5 w-3.5" />,
      color: perfMetrics.winRate >= 50 ? 'text-emerald-500' : 'text-amber-500',
      subValue: perfMetrics.totalTrades > 0 ? `${perfMetrics.totalTrades} trades` : 'No closed trades',
    },
    {
      label: "Today's Trades",
      value: todayTradeCount.toString(),
      icon: <Flame className="h-3.5 w-3.5" />,
      color: 'text-foreground',
      subValue: `Max ${BROKER_CONFIG.maxOpenPositions} positions`,
    },
    {
      label: 'Avg Win / Loss',
      value: perfMetrics.totalTrades > 0
        ? `$${perfMetrics.avgWin.toFixed(0)} / $${perfMetrics.avgLoss.toFixed(0)}`
        : '$0 / $0',
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      color: perfMetrics.avgWin >= perfMetrics.avgLoss ? 'text-emerald-500' : 'text-red-500',
      subValue: perfMetrics.totalTrades > 0 ? `R:R ${perfMetrics.avgLoss > 0 ? (perfMetrics.avgWin / perfMetrics.avgLoss).toFixed(2) : '∞'}` : '—',
    },
    {
      label: 'Profit Factor',
      value: perfMetrics.totalTrades > 0 ? perfMetrics.profitFactor.toFixed(2) : '—',
      icon: <BarChart3 className="h-3.5 w-3.5" />,
      color: perfMetrics.profitFactor >= 1.5 ? 'text-emerald-500' : perfMetrics.profitFactor >= 1 ? 'text-amber-500' : 'text-red-500',
      subValue: perfMetrics.totalTrades > 0 ? (perfMetrics.profitFactor >= 1.5 ? 'Excellent' : perfMetrics.profitFactor >= 1 ? 'Breakeven' : 'Negative') : 'No data',
    },
  ];

  function getCellBg(pnlPercent: number, pnl: number) {
    if (pnl === 0) return 'bg-slate-800/40';
    if (pnl > 0 && pnlPercent > 2) return 'bg-emerald-500/35';
    if (pnl > 0) return 'bg-emerald-500/15';
    if (pnl < 0 && pnlPercent < -2) return 'bg-red-500/35';
    return 'bg-red-500/15';
  }

  return (
    <div className="space-y-4 p-4 pb-10 md:pb-4">
      {/* (e) Header Enhancement */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
        <div>
          <h1 className="text-xl font-bold shimmer-text">Trading Dashboard</h1>
          <p className="text-xs text-muted-foreground">FINEX Indonesia • Demo Account • {currentDateTime}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-500">● Connected</Badge>
          <Badge variant="outline" className="text-[10px]">UTC {utcNow}</Badge>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => {
          const isNegative = stat.color === 'text-red-500';
          const sparkColor = isNegative ? '#ef4444' : '#10b981';
          return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className={`glass-card-premium rounded-xl card-hover-lift stat-card-glow stat-card-pattern ${stat.label === 'Balance' || stat.label === 'Daily P&L' ? 'metric-card-animated ' : ''}${stat.accentClass}`}>
              <div className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${stat.iconGradient} flex items-center justify-center ${stat.iconTextColor}`}>
                    {stat.icon}
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div className={`text-xl md:text-2xl font-bold tabular-nums ${stat.color}${stat.label === 'Balance' ? ' gradient-text-emerald' : ''}${stat.label === 'Daily P&L' || stat.label === 'Total P&L' ? (stat.color === 'text-emerald-500' ? ' neon-text-emerald' : ' neon-text-red') + ' count-up' : ''}`}>
                    {stat.value}
                  </div>
                </div>
                {stat.subValue && (
                  <div className={`text-xs tabular-nums ${stat.color} mt-0.5`}>{stat.subValue}</div>
                )}
                {stat.sparkData && (
                  <div className="h-8 mt-1.5">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stat.sparkData}>
                        <defs>
                          <linearGradient id={`spark-${stat.label}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="v"
                          stroke={sparkColor}
                          fill={`url(#spark-${stat.label})`}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
          );
        })}
      </div>

      {/* (a) Performance Metrics Row */}
      <div className="perf-section-glass glass-card rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="section-title-accent">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Performance Metrics</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {perfCards.map((metric, i) => {
            const ringValue = metric.label === 'Win Rate' ? perfMetrics.winRate / 100
              : metric.label === "Today's Trades" ? Math.min(todayTradeCount / BROKER_CONFIG.maxOpenPositions, 1)
              : metric.label === 'Avg Win / Loss' ? perfMetrics.avgLoss > 0 ? Math.min(perfMetrics.avgWin / (perfMetrics.avgWin + perfMetrics.avgLoss), 1) : 0.5
              : metric.label === 'Profit Factor' ? Math.min(perfMetrics.profitFactor / 3, 1)
              : 0;
            const ringColor = ringValue >= 0.6 ? '#10b981' : ringValue >= 0.4 ? '#f59e0b' : '#ef4444';
            const ringCircumference = 2 * Math.PI * 14;
            const ringDashoffset = ringCircumference * (1 - ringValue);
            const changeVal = metric.label === 'Win Rate' ? (Math.random() * 6 - 2).toFixed(1)
              : metric.label === 'Profit Factor' ? (Math.random() * 0.4 - 0.15).toFixed(2)
              : metric.label === "Today's Trades" ? `+${(Math.random() * 2 + 1).toFixed(0)}`
              : (Math.random() * 8 - 3).toFixed(1);
            const changePositive = parseFloat(changeVal) >= 0;
            return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.04 }}
            >
              <div className={`flex items-center gap-3 stat-card-micro rounded-lg p-2 -m-2 ${metric.label === 'Win Rate' ? 'metric-card-animated' : ''}`}>
                <div className="relative flex-shrink-0">
                  <svg width="38" height="38" viewBox="0 0 38 38" className="-rotate-90">
                    <circle cx="19" cy="19" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                    <circle
                      cx="19" cy="19" r="14" fill="none" stroke={ringColor}
                      strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringDashoffset}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={metric.color}>{metric.icon}</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{metric.label}</span>
                    <span className={`text-[9px] font-medium tabular-nums ${changePositive ? 'text-emerald-500' : 'text-red-500'}`}>
                      {changePositive ? '↑' : '↓'}{Math.abs(parseFloat(changeVal))}
                    </span>
                  </div>
                  <div className={`text-sm font-bold tabular-nums ${metric.color} count-up`}>
                    {metric.value}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {metric.subValue}
                  </div>
                </div>
              </div>
            </motion.div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Open Positions */}
        <div className="glass-card-premium rounded-xl card-hover-lift metric-card-animated lg:col-span-2 col-span-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold section-title-accent">Open Positions ({openTrades.length})</span>
            <Badge variant="outline" className="text-[10px]">
              Max {BROKER_CONFIG.maxOpenPositions}
            </Badge>
          </div>
          <div className="px-4 pb-3">
            {openTrades.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No open positions
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-[10px] h-8">Symbol</TableHead>
                      <TableHead className="text-[10px] h-8">Dir</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Lots</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Entry</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Current</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Pips</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openTrades.map((trade) => (
                      <TableRow key={trade.id} className="border-border">
                        <TableCell className="text-xs font-medium">{trade.symbol}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              trade.direction === 'BUY'
                                ? 'border-emerald-500/50 text-emerald-500'
                                : 'border-red-500/50 text-red-500'
                            }`}
                          >
                            {trade.direction}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{trade.lotSize}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{trade.entryPrice.toFixed(SYMBOL_INFO[trade.symbol].digits)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{trade.currentPrice.toFixed(SYMBOL_INFO[trade.symbol].digits)}</TableCell>
                        <TableCell className={`text-xs text-right tabular-nums font-medium ${trade.pips >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {trade.pips >= 0 ? '+' : ''}{trade.pips.toFixed(1)}
                        </TableCell>
                        <TableCell className={`text-xs text-right tabular-nums font-medium ${trade.profit >= 0 ? 'text-emerald-500 neon-text-emerald' : 'text-red-500 neon-text-red'}`}>
                          {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions + Sessions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <div className={`glass-card-premium rounded-xl card-hover-lift quick-actions-gradient ${isAutoTrading ? 'border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)] breathe-emerald' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold section-title-accent">Quick Actions</span>
              {isAutoTrading && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                  <span className="text-[10px] font-medium text-emerald-400 animate-pulse">Auto Trading Active</span>
                </div>
              )}
            </div>
            <div className="px-4 pb-3 space-y-2">
              {isAutoTrading && (
                <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 mb-1">
                  <span className="text-[10px] text-emerald-400">
                    {openTrades.filter(t => t.id.startsWith('auto-')).length} auto positions
                  </span>
                  <Button
                    onClick={() => setAutoTrading(false)}
                    variant="destructive"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                  >
                    Stop
                  </Button>
                </div>
              )}
              <Button
                onClick={() => setActiveTab('trading')}
                className="w-full justify-start gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white h-9 action-btn-glass"
                size="sm"
              >
                <Zap className="h-4 w-4" />
                <span className="text-xs font-medium">New Trade</span>
              </Button>
              <Button
                onClick={() => setAutoTrading(!isAutoTrading)}
                variant={isAutoTrading ? 'destructive' : 'outline'}
                className={`w-full justify-start gap-2.5 h-9 action-btn-glass ${!isAutoTrading ? 'border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10' : ''}`}
                size="sm"
                disabled={!isConnected}
              >
                <Play className="h-4 w-4" />
                <span className="text-xs font-medium">{isAutoTrading ? 'Stop Auto Trading' : 'Start Auto Trading'}</span>
              </Button>
              <Button
                onClick={() => setActiveTab('analysis')}
                variant="outline"
                className="w-full justify-start gap-2.5 h-9 action-btn-glass"
                size="sm"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="text-xs font-medium">Refresh Signals</span>
              </Button>
            </div>
          </div>

          {/* (b) Better Session Indicators */}
          <div className="glass-card-premium rounded-xl card-hover-lift">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold section-title-accent">Trading Sessions</span>
              <span className="text-[10px] text-muted-foreground tabular-nums font-medium">UTC {utcNow}</span>
            </div>
            <div className="px-4 pb-3 space-y-3">
              {(() => {
                const sessionEntries = Object.values(TRADING_SESSIONS);
                const activeSessions = sessionEntries.map(s => getSessionStatus(s)).filter(s => s.isActive);
                const hasOverlap = activeSessions.length >= 2;
                const overlappingLabels = activeSessions.length >= 2
                  ? sessionEntries.filter(s => getSessionStatus(s).isActive).map(s => s.label).join(' × ')
                  : '';
                return (
                  <>
                    {hasOverlap && (
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-emerald-500/5 border border-emerald-500/15">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                        <span className="overlap-badge badge-pulse">Overlap</span>
                        <span className="text-[9px] text-emerald-400/70">{overlappingLabels}</span>
                      </div>
                    )}
                    {sessionEntries.map((session) => {
                      const { isActive, progress, statusText } = getSessionStatus(session);
                      return (
                        <div key={session.label}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={isActive ? 'clock-tick' : ''}>
                                <Clock className={`h-3.5 w-3.5 ${isActive ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                              </span>
                              <span className="text-xs font-medium">{session.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {session.start.toString().padStart(2, '0')}:00-{session.end.toString().padStart(2, '0')}:00
                              </span>
                              {isActive ? (
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                                  <Badge className="text-[8px] px-1 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30 h-4">ACTIVE</Badge>
                                </div>
                              ) : (
                                <span className={`text-[10px] tabular-nums ${statusText === 'Closed' ? 'text-slate-600' : 'text-muted-foreground'}`}>
                                  {statusText}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
                            <div
                              className={`h-full rounded-full animate-progress ${isActive ? 'progress-gradient-emerald' : 'progress-gradient-slate'}`}
                              style={{ width: isActive ? `${progress}%` : '0%' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* (c) Better Signal Cards */}
        <div className="glass-card-premium rounded-xl card-hover-lift">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold section-title-accent">Recent Signals</span>
            <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => setActiveTab('analysis')}>
              View All
            </Button>
          </div>
          <div className="px-4 pb-3">
            {recentSignals.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No signals yet. Waiting for analysis...
              </div>
            ) : (
              <div className="space-y-2">
                {recentSignals.map((signal) => (
                  <div
                    key={signal.id}
                    className={`py-2 px-2.5 rounded-lg border-l-2 ${
                      signal.direction === 'BUY'
                        ? 'border-l-emerald-500 bg-emerald-500/5'
                        : signal.direction === 'SELL'
                        ? 'border-l-red-500 bg-red-500/5'
                        : 'border-l-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {signal.direction === 'BUY' ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                        ) : signal.direction === 'SELL' ? (
                          <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium">{signal.symbol}</span>
                            <Badge
                              variant="outline"
                              className="text-[8px] px-1 py-0 border-slate-600/50 text-slate-400 bg-slate-800/40 h-4"
                            >
                              {signal.strategy}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`text-[9px] px-1.5 py-0 ${
                            signal.marketCondition === 'trending' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : signal.marketCondition === 'high_volatility' ? 'bg-red-500/15 text-red-400 border-red-500/30'
                            : signal.marketCondition === 'range_bound' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                          }`}
                          variant="outline"
                        >
                          {MARKET_CONDITION_CONFIG[signal.marketCondition]?.label || signal.marketCondition}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            signal.direction === 'BUY'
                              ? 'border-emerald-500/50 text-emerald-500'
                              : signal.direction === 'SELL'
                              ? 'border-red-500/50 text-red-500'
                              : 'border-slate-500/50 text-slate-500'
                          }`}
                        >
                          {signal.direction}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground time-fade">{timeAgo(signal.createdAt)}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                          <div
                            className={`h-full rounded-full animate-progress ${signal.confidence >= 70 ? 'confidence-bar-emerald' : signal.confidence >= 50 ? 'confidence-bar-amber' : 'confidence-bar-red'}`}
                            style={{ width: `${signal.confidence}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium tabular-nums ${signal.confidence >= 70 ? 'text-emerald-500' : signal.confidence >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                          {signal.confidence}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* (d) Market Conditions Enhancement */}
        <div className="glass-card-premium rounded-xl card-hover-lift">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold section-title-accent">Market Conditions</span>
          </div>
          <div className="px-4 pb-3">
            <div className="space-y-3">
              {SYMBOLS.map((sym) => {
                const condition = marketConditions[sym] || 'low_volatility';
                const config = MARKET_CONDITION_CONFIG[condition];
                const price = prices[sym];
                const sparkValues = sparklineData[sym] || [];
                return (
                  <div key={sym} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-3">
                      {getConditionIcon(condition)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{SYMBOL_INFO[sym].name}</span>
                          <MiniSparkline values={sparkValues} width={40} height={14} />
                        </div>
                        {price && (
                          <div className="text-[10px] text-muted-foreground tabular-nums">
                            {price.bid.toFixed(SYMBOL_INFO[sym].digits)}
                            <span className="ml-1 text-slate-600">spread: {price.spread.toFixed(1)}</span>
                            <span className={`ml-1.5 ${price.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {price.change >= 0 ? '+' : ''}{price.changePercent.toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        className={`text-[10px] px-2 py-0 ${
                          condition === 'trending' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : condition === 'high_volatility' ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : condition === 'range_bound' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                        }`}
                        variant="outline"
                      >
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Session Overlap Scanner */}
      <SessionOverlapScanner />

      {/* Activity Feed */}
      <ActivityFeed />

      {/* Watchlist */}
      <WatchlistPanel />

      {/* P&L Heatmap Calendar */}
      <div className="glass-card-premium rounded-xl card-hover-lift">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold section-title-accent flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Daily P&L Calendar
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-500/35" />
              <span className="text-[10px] text-muted-foreground">Loss</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/35" />
              <span className="text-[10px] text-muted-foreground">Profit</span>
            </div>
          </div>
        </div>
        <div className="px-4 pb-3">
          {/* Monthly Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="rounded-lg bg-slate-800/30 border border-border/50 p-2.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">This Month P&L</div>
              <div className={`text-sm font-bold tabular-nums mt-0.5 count-up ${monthlySummary.totalPnl >= 0 ? 'text-emerald-500 neon-text-emerald' : 'text-red-500 neon-text-red'}`}>
                {monthlySummary.totalPnl >= 0 ? '+' : ''}${monthlySummary.totalPnl.toFixed(2)}
              </div>
              <div className={`text-[10px] tabular-nums ${monthlySummary.totalPnl >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                {((monthlySummary.totalPnl / balance) * 100).toFixed(2)}%
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/30 border border-border/50 p-2.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" /> Best Day
              </div>
              <div className="text-sm font-bold tabular-nums mt-0.5 text-emerald-500 neon-text-emerald">
                +${monthlySummary.bestDay.pnl.toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {monthlySummary.bestDay.dayName} {monthlySummary.bestDay.day}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/30 border border-border/50 p-2.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-red-500" /> Worst Day
              </div>
              <div className="text-sm font-bold tabular-nums mt-0.5 text-red-500 neon-text-red">
                ${monthlySummary.worstDay.pnl.toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {monthlySummary.worstDay.dayName} {monthlySummary.worstDay.day}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/30 border border-border/50 p-2.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Target className="h-3 w-3 text-primary" /> Win Days
              </div>
              <div className="text-sm font-bold tabular-nums mt-0.5">
                {monthlySummary.winningDays} / {monthlySummary.totalDays}
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {((monthlySummary.winningDays / monthlySummary.totalDays) * 100).toFixed(0)}% win rate
              </div>
            </div>
          </div>

          {/* Calendar Grid - 7 columns fixed */}
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="min-w-[420px]">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => (
                  <div key={day} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1">
                    {day}
                  </div>
                ))}
              </div>
              {/* Week rows */}
              <div className="space-y-1">
                {calendarWeeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((day) => (
                      <div
                        key={day.date.toISOString()}
                        className={`rounded-md p-1.5 text-center transition-colors relative ${getCellBg(day.pnlPercent, day.pnl)} ${day.isToday ? 'ring-1 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                      >
                        <div className="text-[10px] text-muted-foreground font-medium">{day.day}</div>
                        <div className={`text-[10px] font-bold tabular-nums mt-0.5 ${day.pnl === 0 ? 'text-slate-500' : day.pnl > 0 ? 'text-emerald-400 neon-text-emerald' : 'text-red-400 neon-text-red'}`}>
                          {day.pnl === 0 ? '•' : `${day.pnl >= 0 ? '+' : ''}$${day.pnl.toFixed(0)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

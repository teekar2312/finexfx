'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTradingStore } from '@/store/trading-store';
import { useShallow } from 'zustand/react/shallow';
import { SYMBOLS, SYMBOL_INFO } from '@/lib/types';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart,
} from 'recharts';
import { TrendingUp, Calendar, Clock, DollarSign, Target, Award, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import PerformanceScorecard from './PerformanceScorecard';
import DrawdownChart from './DrawdownChart';

type Timeframe = 'today' | 'week' | 'month' | 'all';

// Seed-based pseudo-random for consistent mock data
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateMockEquityCurve(days: number) {
  const rng = seededRandom(42);
  const data: { date: string; equity: number; peak: number; drawdown: number }[] = [];
  let equity = 10000;
  let peak = 10000;
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayReturn = (rng() - 0.42) * 80; // slight positive bias
    equity = Math.max(9200, equity + dayReturn);
    peak = Math.max(peak, equity);
    const dd = ((peak - equity) / peak) * 100;
    data.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      equity: Math.round(equity * 100) / 100,
      peak: Math.round(peak * 100) / 100,
      drawdown: Math.round(dd * 100) / 100,
    });
  }
  return data;
}

function generateMockDailyPnl(days: number) {
  const rng = seededRandom(123);
  const data: { date: string; pnl: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const pnl = (rng() - 0.42) * 120;
    data.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pnl: Math.round(pnl * 100) / 100,
    });
  }
  return data;
}

function generateMockHeatmap(): { day: string; week: number; pnl: number }[] {
  const rng = seededRandom(777);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data: { day: string; week: number; pnl: number }[] = [];
  for (let w = 0; w < 5; w++) {
    for (const day of days) {
      if (day === 'Sat' || day === 'Sun') {
        data.push({ day, week: w, pnl: 0 });
      } else {
        const pnl = (rng() - 0.4) * 200;
        data.push({ day, week: w, pnl: Math.round(pnl) });
      }
    }
  }
  return data;
}

function generateMockSessionData() {
  return [
    { session: 'London', trades: 24, winRate: 62.5, pnl: 342.5, avgPips: 18.3, color: '#10b981' },
    { session: 'New York', trades: 18, winRate: 55.6, pnl: 198.0, avgPips: 14.2, color: '#06b6d4' },
    { session: 'Asian', trades: 8, winRate: 37.5, pnl: -87.5, avgPips: -8.5, color: '#f59e0b' },
    { session: 'London/NY Overlap', trades: 14, winRate: 71.4, pnl: 456.3, avgPips: 26.7, color: '#8b5cf6' },
  ];
}

function generateMockSymbolPerformance() {
  return [
    { symbol: 'EURUSD', trades: 15, winRate: 66.7, pnl: 287.5, avgPips: 22.1, name: 'EUR/USD' },
    { symbol: 'USDJPY', trades: 12, winRate: 50.0, pnl: 45.0, avgPips: 8.3, name: 'USD/JPY' },
    { symbol: 'GBPUSD', trades: 10, winRate: 60.0, pnl: 165.0, avgPips: 19.4, name: 'GBP/USD' },
    { symbol: 'XAUUSD', trades: 8, winRate: 62.5, pnl: 312.0, avgPips: 48.5, name: 'XAU/USD' },
  ];
}

// Custom dark tooltip for Recharts
const DarkTooltip = ({ active, payload, label, valueLabel = 'Value' }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  valueLabel?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg p-2.5 border border-border/50 shadow-xl min-w-[120px]">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[11px]">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className={`tabular-nums font-medium ${p.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {typeof p.value === 'number' ? p.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function PerformanceAnalyticsView() {
  const { journalEntries, closedTrades, balance, totalPnl } = useTradingStore(
    useShallow((s) => ({ journalEntries: s.journalEntries, closedTrades: s.closedTrades, balance: s.balance, totalPnl: s.totalPnl }))
  );
  const [timeframe, setTimeframe] = useState<Timeframe>('all');

  // Generate mock historical data
  const equityCurve = useMemo(() => generateMockEquityCurve(30), []);
  const dailyPnlData = useMemo(() => generateMockDailyPnl(30), []);
  const heatmapData = useMemo(() => generateMockHeatmap(), []);
  const sessionData = useMemo(() => generateMockSessionData(), []);
  const symbolPerfData = useMemo(() => generateMockSymbolPerformance(), []);

  // Compute analytics from journal entries + mock data
  const analytics = useMemo(() => {
    const entries = journalEntries;
    const wins = entries.filter(e => e.pnl > 0);
    const losses = entries.filter(e => e.pnl < 0);
    const totalPnlCalc = entries.reduce((s, e) => s + e.pnl, 0);
    const totalReturn = ((totalPnlCalc + 809.5) / 10000) * 100; // include mock historical
    const winRate = entries.length > 0 ? (wins.length / entries.length) * 100 : 0;
    const grossProfit = wins.reduce((s, e) => s + e.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, e) => s + e.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

    // Average trade duration
    const durations = entries.map(e => {
      const open = new Date(e.openTime).getTime();
      const close = new Date(e.closeTime).getTime();
      return (close - open) / 60000; // minutes
    });
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const hours = Math.floor(avgDuration / 60);
    const mins = Math.round(avgDuration % 60);

    // Best/worst day
    const dailyMap: Record<string, number> = {};
    entries.forEach(e => {
      const day = e.closeTime.split('T')[0];
      dailyMap[day] = (dailyMap[day] || 0) + e.pnl;
    });
    const dailyValues = Object.values(dailyMap);
    const bestDay = dailyValues.length > 0 ? Math.max(...dailyValues) : 0;
    const worstDay = dailyValues.length > 0 ? Math.min(...dailyValues) : 0;

    // Key metrics
    const largestWin = wins.length > 0 ? Math.max(...wins.map(w => w.pnl)) : 0;
    const largestLoss = losses.length > 0 ? Math.min(...losses.map(l => l.pnl)) : 0;
    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

    // Consecutive wins/losses
    let maxConsWins = 0, maxConsLosses = 0, consWins = 0, consLosses = 0;
    entries.forEach(e => {
      if (e.pnl > 0) { consWins++; consLosses = 0; maxConsWins = Math.max(maxConsWins, consWins); }
      else if (e.pnl < 0) { consLosses++; consWins = 0; maxConsLosses = Math.max(maxConsLosses, consLosses); }
      else { consWins = 0; consLosses = 0; }
    });

    // Max drawdown from equity curve
    let maxDD = 0;
    let peakEquity = 10000;
    equityCurve.forEach(d => {
      peakEquity = Math.max(peakEquity, d.equity);
      const dd = (peakEquity - d.equity) / peakEquity * 100;
      maxDD = Math.max(maxDD, dd);
    });

    // Recovery factor
    const netProfit = Math.abs(totalPnlCalc + 809.5);
    const recoveryFactor = maxDD > 0 ? netProfit / maxDD : netProfit > 0 ? 999 : 0;

    // Distribution data
    const longTrades = entries.filter(e => e.direction === 'BUY');
    const shortTrades = entries.filter(e => e.direction === 'SELL');
    const longWins = longTrades.filter(t => t.pnl > 0).length;
    const shortWins = shortTrades.filter(t => t.pnl > 0).length;

    // Duration distribution
    const shortHolds = entries.filter(e => {
      const mins = (new Date(e.closeTime).getTime() - new Date(e.openTime).getTime()) / 60000;
      return mins < 60;
    }).length;
    const medHolds = entries.filter(e => {
      const mins = (new Date(e.closeTime).getTime() - new Date(e.openTime).getTime()) / 60000;
      return mins >= 60 && mins < 180;
    }).length;
    const longHolds = entries.filter(e => {
      const mins = (new Date(e.closeTime).getTime() - new Date(e.openTime).getTime()) / 60000;
      return mins >= 180;
    }).length;

    return {
      totalReturn,
      winRate,
      profitFactor,
      avgDuration: `${hours}h ${mins}m`,
      bestDay,
      worstDay,
      totalTrades: entries.length,
      wins: wins.length,
      losses: losses.length,
      largestWin,
      largestLoss,
      avgWin,
      avgLoss,
      maxConsWins,
      maxConsLosses,
      maxDrawdown: maxDD,
      recoveryFactor,
      longTrades: longTrades.length,
      shortTrades: shortTrades.length,
      longWins,
      shortWins,
      shortHolds,
      medHolds,
      longHolds,
      totalPnl: totalPnlCalc + 809.5,
    };
  }, [journalEntries, equityCurve]);

  // Heatmap color
  const heatmapColor = (pnl: number) => {
    if (pnl === 0) return 'bg-muted/30';
    const intensity = Math.min(Math.abs(pnl) / 150, 1);
    if (pnl > 0) return `bg-emerald-500/${Math.round(20 + intensity * 60).toString()}`;
    return `bg-red-500/${Math.round(20 + intensity * 60).toString()}`;
  };

  // Current day of week
  const todayDayIndex = new Date().getDay(); // 0=Sun
  const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayDayName = dayMap[todayDayIndex];

  // Win rate SVG circle
  const winRateRadius = 28;
  const winRateCircumference = 2 * Math.PI * winRateRadius;
  const winRateOffset = winRateCircumference - (analytics.winRate / 100) * winRateCircumference;

  // Pie chart data
  const pieData = [
    { name: 'Wins', value: analytics.wins, color: '#10b981' },
    { name: 'Losses', value: analytics.losses, color: '#ef4444' },
  ];

  // Duration pie data
  const durationData = [
    { name: '< 1h', value: analytics.shortHolds, color: '#06b6d4' },
    { name: '1-3h', value: analytics.medHolds, color: '#f59e0b' },
    { name: '> 3h', value: analytics.longHolds, color: '#8b5cf6' },
  ];

  // Long/short bar data
  const directionData = [
    { name: 'Long', wins: analytics.longWins, losses: analytics.longTrades - analytics.longWins },
    { name: 'Short', wins: analytics.shortWins, losses: analytics.shortTrades - analytics.shortWins },
  ];

  // Filtered daily PnL by timeframe
  const filteredDailyPnl = useMemo(() => {
    if (timeframe === 'all') return dailyPnlData;
    const count = timeframe === 'today' ? 1 : timeframe === 'week' ? 7 : 30;
    return dailyPnlData.slice(-count);
  }, [dailyPnlData, timeframe]);

  const avgDailyPnl = filteredDailyPnl.length > 0
    ? filteredDailyPnl.reduce((s, d) => s + d.pnl, 0) / filteredDailyPnl.length
    : 0;
  const totalFilteredPnl = filteredDailyPnl.reduce((s, d) => s + d.pnl, 0);
  const positiveDays = filteredDailyPnl.filter(d => d.pnl > 0).length;
  const negativeDays = filteredDailyPnl.filter(d => d.pnl < 0).length;

  const timeframes: { key: Timeframe; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'all', label: 'All' },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Performance Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Comprehensive trading performance metrics and analysis
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {timeframes.map(tf => (
            <button
              key={tf.key}
              onClick={() => setTimeframe(tf.key)}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all duration-150
                ${timeframe === tf.key
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent'
                }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* KPI Summary Row */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-5 gap-3 stagger-children">
        {/* Total Return */}
        <div className={`glass-card elevated-card card-hover rounded-lg p-4 ${analytics.totalReturn >= 0 ? 'border-l-2 border-l-emerald-500' : 'border-l-2 border-l-red-500'}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Return</span>
          </div>
          <div className={`text-xl font-bold tabular-nums ${analytics.totalReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {analytics.totalReturn >= 0 ? '+' : ''}{analytics.totalReturn.toFixed(2)}%
          </div>
          <div className={`text-[10px] tabular-nums mt-1 ${analytics.totalPnl >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
            ${analytics.totalPnl >= 0 ? '+' : ''}{analytics.totalPnl.toFixed(2)}
          </div>
        </div>

        {/* Win Rate with SVG Ring */}
        <div className="glass-card elevated-card card-hover rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Win Rate</span>
          </div>
          <div className="flex items-center gap-3">
            <svg width="64" height="64" className="flex-shrink-0">
              <circle cx="32" cy="32" r={winRateRadius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
              <circle
                cx="32" cy="32" r={winRateRadius} fill="none"
                stroke={analytics.winRate >= 50 ? '#10b981' : '#ef4444'}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={winRateCircumference}
                strokeDashoffset={winRateOffset}
                transform="rotate(-90 32 32)"
                className="transition-all duration-700"
              />
              <text x="32" y="30" textAnchor="middle" className="fill-foreground text-[11px] font-bold tabular-nums" fontSize="11">
                {analytics.winRate.toFixed(0)}%
              </text>
              <text x="32" y="40" textAnchor="middle" className="fill-muted-foreground" fontSize="7">
                {analytics.wins}W / {analytics.losses}L
              </text>
            </svg>
            <div>
              <div className="text-[10px] text-muted-foreground">Trades</div>
              <div className="text-sm font-semibold tabular-nums">{analytics.totalTrades}</div>
            </div>
          </div>
        </div>

        {/* Profit Factor */}
        <div className="glass-card elevated-card card-hover rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Award className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Profit Factor</span>
          </div>
          <div className={`text-xl font-bold tabular-nums ${analytics.profitFactor >= 1.5 ? 'text-emerald-500' : analytics.profitFactor >= 1 ? 'text-amber-500' : 'text-red-500'}`}>
            {analytics.profitFactor === 999 ? '∞' : analytics.profitFactor.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {analytics.profitFactor >= 1.5 ? 'Excellent' : analytics.profitFactor >= 1 ? 'Moderate' : 'Needs improvement'}
          </div>
        </div>

        {/* Avg Trade Duration */}
        <div className="glass-card elevated-card card-hover rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Avg Duration</span>
          </div>
          <div className="text-xl font-bold tabular-nums">{analytics.avgDuration}</div>
          <div className="text-[10px] text-muted-foreground mt-1">per trade</div>
        </div>

        {/* Best/Worst Day */}
        <div className="glass-card elevated-card card-hover rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Best / Worst Day</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-sm font-bold tabular-nums text-emerald-500">+${analytics.bestDay.toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
            <span className="text-sm font-bold tabular-nums text-red-500">${analytics.worstDay.toFixed(0)}</span>
          </div>
        </div>
      </motion.div>

      {/* Equity Curve Chart */}
      <motion.div variants={item} className="glass-card parallax-hover card-hover rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Equity Curve</h3>
            <p className="text-[10px] text-muted-foreground">30-day equity progression with drawdown overlay</p>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-0.5 bg-emerald-500 rounded" />
              <span className="text-muted-foreground">Equity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-0.5 bg-red-500/60 rounded" />
              <span className="text-muted-foreground">Drawdown</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={equityCurve} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.02} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={4} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`} />
            <Tooltip content={<DarkTooltip />} />
            <ReferenceLine y={10000} stroke="rgba(255,255,255,0.15)" strokeDasharray="6 3" />
            <Area type="monotone" dataKey="drawdown" fill="url(#drawdownGradient)" stroke="none" fillOpacity={1} />
            <Area type="monotone" dataKey="equity" fill="url(#equityGradient)" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} />
          </ComposedChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Daily P&L Bar Chart */}
      <motion.div variants={item} className="glass-card parallax-hover card-hover rounded-lg p-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-semibold">Daily P&L</h3>
            <p className="text-[10px] text-muted-foreground">Daily profit and loss breakdown</p>
          </div>
        </div>
        <div className="flex items-center gap-4 mb-3 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Total:</span>
            <span className={`font-semibold tabular-nums ${totalFilteredPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              ${totalFilteredPnl >= 0 ? '+' : ''}{totalFilteredPnl.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Avg:</span>
            <span className={`font-semibold tabular-nums ${avgDailyPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              ${avgDailyPnl >= 0 ? '+' : ''}{avgDailyPnl.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-emerald-500 font-semibold tabular-nums">{positiveDays}W</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-red-500 font-semibold tabular-nums">{negativeDays}L</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={filteredDailyPnl} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={timeframe === 'all' ? 4 : 1} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v}`} />
            <Tooltip content={<DarkTooltip />} />
            <ReferenceLine y={avgDailyPnl} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} />
            <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
              {filteredDailyPnl.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Performance by Symbol + Performance by Session */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-children">
        {/* Performance by Symbol */}
        <motion.div variants={item} className="glass-card card-hover rounded-lg p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Performance by Symbol</h3>
            <p className="text-[10px] text-muted-foreground">Per-symbol breakdown of trading performance</p>
          </div>
          <div className="space-y-2.5">
            {symbolPerfData.map(sym => (
              <div key={sym.symbol} className="flex items-center gap-3">
                <div className="w-16 flex-shrink-0">
                  <div className="text-[11px] font-semibold">{sym.name}</div>
                  <div className="text-[9px] text-muted-foreground">{sym.trades} trades</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] text-muted-foreground">Win Rate</span>
                    <span className={`text-[10px] font-semibold tabular-nums ${sym.winRate >= 55 ? 'text-emerald-500' : sym.winRate >= 45 ? 'text-amber-500' : 'text-red-500'}`}>
                      {sym.winRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${sym.winRate >= 55 ? 'bg-emerald-500' : sym.winRate >= 45 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${sym.winRate}%` }}
                    />
                  </div>
                </div>
                <div className="w-16 text-right flex-shrink-0">
                  <div className={`text-[11px] font-semibold tabular-nums ${sym.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {sym.pnl >= 0 ? '+' : ''}${sym.pnl.toFixed(0)}
                  </div>
                  <div className="text-[9px] text-muted-foreground tabular-nums">{sym.avgPips.toFixed(1)} pips avg</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Performance by Session */}
        <motion.div variants={item} className="glass-card card-hover rounded-lg p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold">Performance by Session</h3>
            <p className="text-[10px] text-muted-foreground">Trading session performance comparison</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 stagger-children">
            {sessionData.map(session => (
              <div key={session.session} className="rounded-lg p-3 bg-background/40 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: session.color }} />
                  <span className="text-[11px] font-semibold truncate">{session.session}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[9px] text-muted-foreground">Trades</span>
                    <span className="text-[10px] tabular-nums font-medium">{session.trades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[9px] text-muted-foreground">Win Rate</span>
                    <span className={`text-[10px] tabular-nums font-medium ${session.winRate >= 55 ? 'text-emerald-500' : session.winRate >= 45 ? 'text-amber-500' : 'text-red-500'}`}>
                      {session.winRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[9px] text-muted-foreground">P&L</span>
                    <span className={`text-[10px] tabular-nums font-semibold ${session.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {session.pnl >= 0 ? '+' : ''}${session.pnl.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Weekly Heatmap */}
      <motion.div variants={item} className="glass-card glass-card-premium card-hover rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Weekly Heatmap</h3>
            <p className="text-[10px] text-muted-foreground">Daily P&L color-coded by performance</p>
          </div>
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-emerald-500/60" />
              <span>Profit</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500/60" />
              <span>Loss</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-muted/30" />
              <span>Weekend</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[480px]">
            {/* Week headers */}
            <div className="grid grid-cols-8 gap-1 mb-1">
              <div className="text-[9px] text-muted-foreground" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="text-[9px] text-muted-foreground text-center">W{i + 1}</div>
              ))}
            </div>
            {/* Days grid */}
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
              const isToday = day === todayDayName;
              return (
                <div key={day} className="grid grid-cols-8 gap-1 mb-1">
                  <div className={`text-[10px] flex items-center ${isToday ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                    {day}{isToday ? ' *' : ''}
                  </div>
                  {Array.from({ length: 5 }).map((_, w) => {
                    const cell = heatmapData.find(h => h.day === day && h.week === w);
                    const pnl = cell?.pnl ?? 0;
                    const isWeekend = day === 'Sat' || day === 'Sun';
                    return (
                      <div
                        key={w}
                        className={`h-8 rounded text-[9px] flex items-center justify-center tabular-nums font-medium ${heatmapColor(pnl)} ${isToday ? 'ring-1 ring-primary/50' : ''}`}
                        title={`${day} W${w + 1}: $${pnl}`}
                      >
                        {!isWeekend && pnl !== 0 && (
                          <span className={pnl > 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {pnl > 0 ? '+' : ''}{pnl}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {/* Monthly summary */}
            <div className="grid grid-cols-8 gap-1 mt-2 pt-2 border-t border-border/50">
              <div className="text-[9px] text-muted-foreground">Total</div>
              {Array.from({ length: 5 }).map((_, w) => {
                const weekTotal = heatmapData.filter(h => h.week === w).reduce((s, h) => s + h.pnl, 0);
                return (
                  <div key={w} className={`text-[10px] text-center tabular-nums font-semibold ${weekTotal >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {weekTotal >= 0 ? '+' : ''}{weekTotal}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Trade Distribution: Pie + Direction Bar + Duration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
        {/* Win/Loss Pie */}
        <motion.div variants={item} className="glass-card card-hover rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-1">Win / Loss</h3>
          <p className="text-[10px] text-muted-foreground mb-3">Trade outcome distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={58}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, i) => (
                  <Cell key={`pie-${i}`} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Pie>
              <Tooltip content={<DarkTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Wins: <span className="text-foreground font-medium tabular-nums">{analytics.wins}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-muted-foreground">Losses: <span className="text-foreground font-medium tabular-nums">{analytics.losses}</span></span>
            </div>
          </div>
        </motion.div>

        {/* Long vs Short Stacked Bar */}
        <motion.div variants={item} className="glass-card card-hover rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-1">Long vs Short</h3>
          <p className="text-[10px] text-muted-foreground mb-3">Direction performance breakdown</p>
          <div className="flex items-end justify-center gap-6 h-[160px]">
            {directionData.map(d => (
              <div key={d.name} className="flex flex-col items-center gap-2">
                <div className="flex flex-col-reverse w-14 gap-0.5" style={{ height: 140 }}>
                  <div
                    className="w-full bg-emerald-500/80 rounded-t transition-all duration-500"
                    style={{ height: `${(d.wins / (analytics.longTrades + analytics.shortTrades)) * 100}%`, minHeight: d.wins > 0 ? 8 : 0 }}
                    title={`${d.name} Wins: ${d.wins}`}
                  />
                  <div
                    className="w-full bg-red-500/80 rounded-b transition-all duration-500"
                    style={{ height: `${(d.losses / (analytics.longTrades + analytics.shortTrades)) * 100}%`, minHeight: d.losses > 0 ? 8 : 0 }}
                    title={`${d.name} Losses: ${d.losses}`}
                  />
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-medium">{d.name}</div>
                  <div className="text-[9px] text-muted-foreground tabular-nums">{d.wins + d.losses} trades</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 text-[10px] mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500/80" />
              <span className="text-muted-foreground">Win</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500/80" />
              <span className="text-muted-foreground">Loss</span>
            </div>
          </div>
        </motion.div>

        {/* Duration Distribution */}
        <motion.div variants={item} className="glass-card card-hover rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-1">Holding Duration</h3>
          <p className="text-[10px] text-muted-foreground mb-3">Trade length distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={durationData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={58}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {durationData.map((entry, i) => (
                  <Cell key={`dur-${i}`} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Pie>
              <Tooltip content={<DarkTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 text-[10px] flex-wrap">
            {durationData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-muted-foreground">{d.name}: <span className="text-foreground font-medium tabular-nums">{d.value}</span></span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Live Drawdown Chart */}
      <DrawdownChart />

      {/* Key Metrics Table */}
      <motion.div variants={item} className="glass-card card-hover rounded-lg p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">Key Metrics</h3>
          <p className="text-[10px] text-muted-foreground">Detailed performance statistics</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-3 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Metric</th>
                <th className="text-right py-2 px-3 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/30">
                <td className="py-2.5 px-3 text-muted-foreground">Largest Win</td>
                <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-emerald-500">+${analytics.largestWin.toFixed(2)}</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-2.5 px-3 text-muted-foreground">Largest Loss</td>
                <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-red-500">${analytics.largestLoss.toFixed(2)}</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-2.5 px-3 text-muted-foreground">Average Win</td>
                <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-emerald-500">+${analytics.avgWin.toFixed(2)}</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-2.5 px-3 text-muted-foreground">Average Loss</td>
                <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-red-500">${analytics.avgLoss.toFixed(2)}</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-2.5 px-3 text-muted-foreground">Consecutive Wins</td>
                <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-emerald-500">{analytics.maxConsWins}</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-2.5 px-3 text-muted-foreground">Consecutive Losses</td>
                <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-red-500">{analytics.maxConsLosses}</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-2.5 px-3 text-muted-foreground">Max Drawdown</td>
                <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-amber-500">{analytics.maxDrawdown.toFixed(2)}%</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 text-muted-foreground">Recovery Factor</td>
                <td className={`py-2.5 px-3 text-right font-semibold tabular-nums ${analytics.recoveryFactor >= 2 ? 'text-emerald-500' : analytics.recoveryFactor >= 1 ? 'text-amber-500' : 'text-red-500'}`}>
                  {analytics.recoveryFactor === 999 ? '∞' : analytics.recoveryFactor.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Performance Scorecard - Weekly/Monthly Breakdown */}
        <PerformanceScorecard />
      </motion.div>
    </motion.div>
  );
}

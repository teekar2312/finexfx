'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Trophy,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  BarChart3,
  DollarSign,
  Percent,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Trade, Symbol, TradeDirection } from '@/lib/types';
import { SYMBOL_INFO } from '@/lib/types';
import { useTradingStore } from '@/store/trading-store';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SortKey = 'id' | 'openedAt' | 'symbol' | 'profit' | 'pips' | 'duration';
type SortDir = 'asc' | 'desc';
type PairFilter = 'ALL' | Symbol;
type TypeFilter = 'ALL' | TradeDirection;
type ResultFilter = 'ALL' | 'Profit' | 'Loss' | 'Breakeven';
type DateRange = 'ALL' | 'Today' | 'This Week' | 'This Month';

interface ClosedTradeRow {
  id: string;
  openedAt: string;
  closedAt: string;
  symbol: Symbol;
  direction: TradeDirection;
  lotSize: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  profit: number;
  pips: number;
  duration: number; // ms
  strategy: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function priceDigits(symbol: Symbol): number {
  return SYMBOL_INFO[symbol].digits;
}

/* ------------------------------------------------------------------ */
/*  Mock Data Generator                                                */
/* ------------------------------------------------------------------ */

function generateMockTrades(): ClosedTradeRow[] {
  const now = Date.now();
  const pairs: Symbol[] = ['EURUSD', 'USDJPY', 'GBPUSD', 'XAUUSD'];
  const directions: TradeDirection[] = ['BUY', 'SELL'];
  const strategies = ['MA Ribbon', 'Momentum Scalping', 'Pivot Points', 'EMA Crossover', 'RMI Trend Sync', 'Linear Regression', 'EMA/RSI Filter'];

  const raw: Omit<ClosedTradeRow, 'duration'>[] = [
    { id: 'T-2001', openedAt: new Date(now - 2 * 3600000).toISOString(), closedAt: new Date(now - 1.5 * 3600000).toISOString(), symbol: 'EURUSD', direction: 'BUY', lotSize: 0.10, entryPrice: 1.08420, exitPrice: 1.08895, stopLoss: 1.08200, takeProfit: 1.09000, profit: 47.50, pips: 47.5, strategy: 'EMA Crossover' },
    { id: 'T-2002', openedAt: new Date(now - 5 * 3600000).toISOString(), closedAt: new Date(now - 4 * 3600000).toISOString(), symbol: 'GBPUSD', direction: 'SELL', lotSize: 0.05, entryPrice: 1.27150, exitPrice: 1.26780, stopLoss: 1.27450, takeProfit: 1.26500, profit: 18.50, pips: 37.0, strategy: 'MA Ribbon' },
    { id: 'T-2003', openedAt: new Date(now - 8 * 3600000).toISOString(), closedAt: new Date(now - 7.8 * 3600000).toISOString(), symbol: 'USDJPY', direction: 'BUY', lotSize: 0.10, entryPrice: 149.850, exitPrice: 149.520, stopLoss: 149.500, takeProfit: 150.200, profit: -33.00, pips: -33.0, strategy: 'Momentum Scalping' },
    { id: 'T-2004', openedAt: new Date(now - 12 * 3600000).toISOString(), closedAt: new Date(now - 9.5 * 3600000).toISOString(), symbol: 'XAUUSD', direction: 'BUY', lotSize: 0.01, entryPrice: 2028.50, exitPrice: 2041.30, stopLoss: 2020.00, takeProfit: 2050.00, profit: 128.00, pips: 128.0, strategy: 'RMI Trend Sync' },
    { id: 'T-2005', openedAt: new Date(now - 18 * 3600000).toISOString(), closedAt: new Date(now - 17.7 * 3600000).toISOString(), symbol: 'EURUSD', direction: 'SELL', lotSize: 0.10, entryPrice: 1.09100, exitPrice: 1.09350, stopLoss: 1.09400, takeProfit: 1.08600, profit: -25.00, pips: -25.0, strategy: 'Pivot Points' },
    { id: 'T-2006', openedAt: new Date(now - 22 * 3600000).toISOString(), closedAt: new Date(now - 19.5 * 3600000).toISOString(), symbol: 'GBPUSD', direction: 'BUY', lotSize: 0.08, entryPrice: 1.26500, exitPrice: 1.27120, stopLoss: 1.26200, takeProfit: 1.27300, profit: 49.60, pips: 62.0, strategy: 'Linear Regression' },
    { id: 'T-2007', openedAt: new Date(now - 26 * 3600000).toISOString(), closedAt: new Date(now - 25.8 * 3600000).toISOString(), symbol: 'USDJPY', direction: 'SELL', lotSize: 0.10, entryPrice: 150.200, exitPrice: 149.900, stopLoss: 150.500, takeProfit: 149.500, profit: 30.00, pips: 30.0, strategy: 'EMA/RSI Filter' },
    { id: 'T-2008', openedAt: new Date(now - 30 * 3600000).toISOString(), closedAt: new Date(now - 29.3 * 3600000).toISOString(), symbol: 'XAUUSD', direction: 'SELL', lotSize: 0.02, entryPrice: 2035.80, exitPrice: 2042.10, stopLoss: 2045.00, takeProfit: 2025.00, profit: -126.00, pips: -63.0, strategy: 'Momentum Scalping' },
    { id: 'T-2009', openedAt: new Date(now - 48 * 3600000).toISOString(), closedAt: new Date(now - 47.2 * 3600000).toISOString(), symbol: 'EURUSD', direction: 'BUY', lotSize: 0.15, entryPrice: 1.07800, exitPrice: 1.08250, stopLoss: 1.07550, takeProfit: 1.08500, profit: 67.50, pips: 45.0, strategy: 'EMA Crossover' },
    { id: 'T-2010', openedAt: new Date(now - 52 * 3600000).toISOString(), closedAt: new Date(now - 51.5 * 3600000).toISOString(), symbol: 'XAUUSD', direction: 'BUY', lotSize: 0.01, entryPrice: 2015.00, exitPrice: 2008.50, stopLoss: 2005.00, takeProfit: 2030.00, profit: -65.00, pips: -65.0, strategy: 'RMI Trend Sync' },
    { id: 'T-2011', openedAt: new Date(now - 72 * 3600000).toISOString(), closedAt: new Date(now - 70 * 3600000).toISOString(), symbol: 'GBPUSD', direction: 'SELL', lotSize: 0.10, entryPrice: 1.27400, exitPrice: 1.26950, stopLoss: 1.27700, takeProfit: 1.26600, profit: 45.00, pips: 45.0, strategy: 'MA Ribbon' },
    { id: 'T-2012', openedAt: new Date(now - 80 * 3600000).toISOString(), closedAt: new Date(now - 79.9 * 3600000).toISOString(), symbol: 'USDJPY', direction: 'BUY', lotSize: 0.05, entryPrice: 149.300, exitPrice: 149.300, stopLoss: 149.100, takeProfit: 149.600, profit: 0.00, pips: 0.0, strategy: 'Pivot Points' },
    { id: 'T-2013', openedAt: new Date(now - 96 * 3600000).toISOString(), closedAt: new Date(now - 93.5 * 3600000).toISOString(), symbol: 'EURUSD', direction: 'SELL', lotSize: 0.12, entryPrice: 1.09300, exitPrice: 1.08800, stopLoss: 1.09500, takeProfit: 1.08500, profit: 60.00, pips: 50.0, strategy: 'Linear Regression' },
    { id: 'T-2014', openedAt: new Date(now - 110 * 3600000).toISOString(), closedAt: new Date(now - 109.2 * 3600000).toISOString(), symbol: 'XAUUSD', direction: 'BUY', lotSize: 0.03, entryPrice: 2045.00, exitPrice: 2058.50, stopLoss: 2035.00, takeProfit: 2070.00, profit: 405.00, pips: 135.0, strategy: 'RMI Trend Sync' },
    { id: 'T-2015', openedAt: new Date(now - 120 * 3600000).toISOString(), closedAt: new Date(now - 119.4 * 3600000).toISOString(), symbol: 'USDJPY', direction: 'SELL', lotSize: 0.08, entryPrice: 150.800, exitPrice: 151.200, stopLoss: 151.300, takeProfit: 150.200, profit: -32.00, pips: -40.0, strategy: 'EMA/RSI Filter' },
    { id: 'T-2016', openedAt: new Date(now - 144 * 3600000).toISOString(), closedAt: new Date(now - 141 * 3600000).toISOString(), symbol: 'GBPUSD', direction: 'BUY', lotSize: 0.10, entryPrice: 1.26000, exitPrice: 1.26550, stopLoss: 1.25700, takeProfit: 1.26800, profit: 55.00, pips: 55.0, strategy: 'EMA Crossover' },
    { id: 'T-2017', openedAt: new Date(now - 168 * 3600000).toISOString(), closedAt: new Date(now - 167.5 * 3600000).toISOString(), symbol: 'EURUSD', direction: 'BUY', lotSize: 0.20, entryPrice: 1.08000, exitPrice: 1.07850, stopLoss: 1.07700, takeProfit: 1.08500, profit: -30.00, pips: -15.0, strategy: 'Pivot Points' },
    { id: 'T-2018', openedAt: new Date(now - 200 * 3600000).toISOString(), closedAt: new Date(now - 198.3 * 3600000).toISOString(), symbol: 'XAUUSD', direction: 'SELL', lotSize: 0.01, entryPrice: 2055.00, exitPrice: 2040.50, stopLoss: 2065.00, takeProfit: 2035.00, profit: 145.00, pips: 145.0, strategy: 'MA Ribbon' },
  ];

  return raw.map((t) => ({
    ...t,
    duration: new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime(),
  }));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function TradeHistoryTable() {
  const storeClosedTrades = useTradingStore((s) => s.closedTrades);

  // Normalise store trades or use mock fallback
  const trades: ClosedTradeRow[] = useMemo(() => {
    if (storeClosedTrades.length > 0) {
      return storeClosedTrades.map((t) => ({
        id: t.id,
        openedAt: t.openedAt,
        closedAt: t.closedAt ?? new Date().toISOString(),
        symbol: t.symbol,
        direction: t.direction,
        lotSize: t.lotSize,
        entryPrice: t.entryPrice,
        exitPrice: t.currentPrice,
        stopLoss: t.stopLoss ?? 0,
        takeProfit: t.takeProfit ?? 0,
        profit: t.profit,
        pips: t.pips,
        duration: t.closedAt
          ? new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime()
          : Date.now() - new Date(t.openedAt).getTime(),
        strategy: t.strategy ?? '—',
      }));
    }
    return generateMockTrades();
  }, [storeClosedTrades]);

  // ---- Filters ----
  const [search, setSearch] = useState('');
  const [pairFilter, setPairFilter] = useState<PairFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('ALL');
  const [dateRange, setDateRange] = useState<DateRange>('ALL');

  // ---- Sort ----
  const [sortKey, setSortKey] = useState<SortKey>('openedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = useCallback((key: SortKey) => {
    setSortDir((prev) => {
      if (sortKey === key) return prev === 'asc' ? 'desc' : 'asc';
      return 'asc';
    });
    setSortKey(key);
  }, [sortKey]);

  // ---- Pagination ----
  const [page, setPage] = useState(1);
  const perPage = 10;

  // ---- Filtering & sorting ----
  const now = Date.now();

  const filtered = useMemo(() => {
    let list = [...trades];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q)
      );
    }

    // Pair
    if (pairFilter !== 'ALL') list = list.filter((t) => t.symbol === pairFilter);

    // Type
    if (typeFilter !== 'ALL') list = list.filter((t) => t.direction === typeFilter);

    // Result
    if (resultFilter === 'Profit') list = list.filter((t) => t.profit > 0);
    else if (resultFilter === 'Loss') list = list.filter((t) => t.profit < 0);
    else if (resultFilter === 'Breakeven') list = list.filter((t) => t.profit === 0);

    // Date range
    if (dateRange !== 'ALL') {
      const cutoff = dateRange === 'Today' ? now - 24 * 3600000
        : dateRange === 'This Week' ? now - 7 * 86400000
          : now - 30 * 86400000;
      list = list.filter((t) => new Date(t.closedAt).getTime() >= cutoff);
    }

    // Sort
    list.sort((a, b) => {
      let va: string | number = a[sortKey];
      let vb: string | number = b[sortKey];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [trades, search, pairFilter, typeFilter, resultFilter, dateRange, sortKey, sortDir, now]);

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  // ---- Summary stats ----
  const stats = useMemo(() => {
    const wins = filtered.filter((t) => t.profit > 0);
    const losses = filtered.filter((t) => t.profit < 0);
    const totalPnl = filtered.reduce((s, t) => s + t.profit, 0);
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.profit, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, t) => s + t.profit, 0) / losses.length : 0;
    const best = filtered.length ? Math.max(...filtered.map((t) => t.profit)) : 0;
    const worst = filtered.length ? Math.min(...filtered.map((t) => t.profit)) : 0;
    const avgDuration = filtered.length
      ? filtered.reduce((s, t) => s + t.duration, 0) / filtered.length
      : 0;
    const winRate = filtered.length ? (wins.length / filtered.length) * 100 : 0;
    return { total: filtered.length, winRate, totalPnl, avgWin, avgLoss, best, worst, avgDuration };
  }, [filtered]);

  /* ---- Sort header helper ---- */
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 text-muted-foreground/40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 text-emerald-400" />
      : <ArrowDown className="w-3 h-3 ml-1 text-emerald-400" />;
  };

  /* ---- Filter chip helper ---- */
  const FilterBtn = <T extends string>({
    label,
    value,
    current,
    onChange,
  }: {
    label: string;
    value: T;
    current: T;
    onChange: (v: T) => void;
  }) => (
    <button
      onClick={() => onChange(value)}
      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
        current === value
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'bg-muted/50 text-muted-foreground border border-border/50 hover:bg-muted/50 hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* ========== Summary Stats Bar ========== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { icon: BarChart3, label: 'Total Trades', value: stats.total.toString(), color: 'text-foreground' },
          { icon: Percent, label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, color: 'text-emerald-400' },
          { icon: DollarSign, label: 'Total P&L', value: `$${stats.totalPnl.toFixed(2)}`, color: stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { icon: TrendingUp, label: 'Avg Win', value: `$${stats.avgWin.toFixed(2)}`, color: 'text-emerald-400' },
          { icon: TrendingDown, label: 'Avg Loss', value: `$${stats.avgLoss.toFixed(2)}`, color: 'text-red-400' },
          { icon: Trophy, label: 'Best Trade', value: `$${stats.best.toFixed(2)}`, color: 'text-emerald-400' },
          { icon: Target, label: 'Worst Trade', value: `$${stats.worst.toFixed(2)}`, color: 'text-red-400' },
          { icon: Clock, label: 'Avg Duration', value: formatDuration(stats.avgDuration), color: 'text-foreground' },
        ].map((s) => (
          <div
            key={s.label}
            className="glass-card-premium rounded-lg px-3 py-2.5 flex flex-col gap-0.5"
          >
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <s.icon className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase tracking-wider">{s.label}</span>
            </div>
            <span className={`text-sm font-semibold font-mono ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ========== Filter Bar ========== */}
      <div className="glass-card-premium rounded-lg px-3 py-2.5 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search pair or ID..."
            className="h-8 w-40 pl-8 text-xs bg-muted/50 border-border focus:border-emerald-500/50 rounded-md"
          />
        </div>

        <div className="h-5 w-px bg-muted/50" />

        {/* Pair filter */}
        <div className="flex items-center gap-1">
          <FilterBtn label="All" value={'ALL' as PairFilter} current={pairFilter} onChange={(v) => { setPairFilter(v); setPage(1); }} />
          {(['EURUSD', 'USDJPY', 'GBPUSD', 'XAUUSD'] as const).map((p) => (
            <FilterBtn key={p} label={SYMBOL_INFO[p].name} value={p as PairFilter} current={pairFilter} onChange={(v) => { setPairFilter(v); setPage(1); }} />
          ))}
        </div>

        <div className="h-5 w-px bg-muted/50" />

        {/* Type filter */}
        <div className="flex items-center gap-1">
          <FilterBtn label="All" value={'ALL' as TypeFilter} current={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} />
          <FilterBtn label="BUY" value={'BUY' as TypeFilter} current={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} />
          <FilterBtn label="SELL" value={'SELL' as TypeFilter} current={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} />
        </div>

        <div className="h-5 w-px bg-muted/50" />

        {/* Result filter */}
        <div className="flex items-center gap-1">
          <FilterBtn label="All" value={'ALL' as ResultFilter} current={resultFilter} onChange={(v) => { setResultFilter(v); setPage(1); }} />
          <FilterBtn label="Profit" value={'Profit' as ResultFilter} current={resultFilter} onChange={(v) => { setResultFilter(v); setPage(1); }} />
          <FilterBtn label="Loss" value={'Loss' as ResultFilter} current={resultFilter} onChange={(v) => { setResultFilter(v); setPage(1); }} />
          <FilterBtn label="Breakeven" value={'Breakeven' as ResultFilter} current={resultFilter} onChange={(v) => { setResultFilter(v); setPage(1); }} />
        </div>

        <div className="h-5 w-px bg-muted/50" />

        {/* Date range */}
        <div className="flex items-center gap-1">
          <FilterBtn label="All" value={'ALL' as DateRange} current={dateRange} onChange={(v) => { setDateRange(v); setPage(1); }} />
          <FilterBtn label="Today" value={'Today' as DateRange} current={dateRange} onChange={(v) => { setDateRange(v); setPage(1); }} />
          <FilterBtn label="Week" value={'This Week' as DateRange} current={dateRange} onChange={(v) => { setDateRange(v); setPage(1); }} />
          <FilterBtn label="Month" value={'This Month' as DateRange} current={dateRange} onChange={(v) => { setDateRange(v); setPage(1); }} />
        </div>
      </div>

      {/* ========== Table ========== */}
      <div className="glass-card-premium rounded-lg overflow-hidden">
        <div className="overflow-x-auto scroll-horizontal">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('id')}>
                  <span className="inline-flex items-center">ID <SortIcon col="id" /></span>
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('openedAt')}>
                  <span className="inline-flex items-center">Date / Time <SortIcon col="openedAt" /></span>
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('symbol')}>
                  <span className="inline-flex items-center">Pair <SortIcon col="symbol" /></span>
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Type</th>
                <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Lots</th>
                <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Entry</th>
                <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Exit</th>
                <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">SL</th>
                <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">TP</th>
                <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('profit')}>
                  <span className="inline-flex items-center justify-end">P&L ($) <SortIcon col="profit" /></span>
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('pips')}>
                  <span className="inline-flex items-center justify-end">P&L (pips) <SortIcon col="pips" /></span>
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('duration')}>
                  <span className="inline-flex items-center justify-end">Duration <SortIcon col="duration" /></span>
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Strategy</th>
              </tr>
            </thead>

            <tbody>
              <AnimatePresence mode="popLayout">
                {paginated.map((trade, idx) => (
                  <motion.tr
                    key={trade.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, delay: idx * 0.03 }}
                    className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                      trade.profit > 0
                        ? 'border-l-2 border-l-emerald-500/60'
                        : trade.profit < 0
                          ? 'border-l-2 border-l-red-500/60'
                          : 'border-l-2 border-l-white/10'
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">{trade.id}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-foreground">{formatDateTime(trade.openedAt)}</div>
                      <div className="text-muted-foreground text-[10px]">{formatDateTime(trade.closedAt)}</div>
                    </td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{SYMBOL_INFO[trade.symbol].name}</td>
                    <td className={`px-3 py-2 font-semibold whitespace-nowrap ${trade.direction === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trade.direction}
                    </td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{trade.lotSize.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{trade.entryPrice.toFixed(priceDigits(trade.symbol))}</td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{trade.exitPrice.toFixed(priceDigits(trade.symbol))}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground whitespace-nowrap">{trade.stopLoss > 0 ? trade.stopLoss.toFixed(priceDigits(trade.symbol)) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground whitespace-nowrap">{trade.takeProfit > 0 ? trade.takeProfit.toFixed(priceDigits(trade.symbol)) : '—'}</td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold whitespace-nowrap ${trade.profit > 0 ? 'text-emerald-400' : trade.profit < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold whitespace-nowrap ${trade.pips > 0 ? 'text-emerald-400' : trade.pips < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {trade.pips > 0 ? '+' : ''}{trade.pips.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        {formatDuration(trade.duration)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-muted/50 text-[10px] text-muted-foreground">{trade.strategy}</span>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No trades match the current filters.
            </div>
          )}
        </div>

        {/* ========== Pagination ========== */}
        {filtered.length > perPage && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {(safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </Button>
              <div className="flex items-center gap-0.5 mx-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                      p === safePage
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TradeHistoryTable;

'use client';

import { useState, useMemo, useRef, useCallback, useEffect, memo } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, MARKET_CONDITION_CONFIG, type Symbol, type MarketCondition } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { List, ArrowDownUp, Bell, ChevronDown, Filter } from 'lucide-react';

// ── Sparkline SVG (last 15 points from priceHistory) ───────────────
const MiniSparkline = memo(function MiniSparkline({ values, width = 56, height = 18 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const pts = values.slice(-15);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const pad = 1;
  const points = pts
    .map((v, i) => {
      const x = pad + (i / (pts.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
  const isUp = pts[pts.length - 1] >= pts[0];
  const color = isUp ? '#10b981' : '#ef4444';
  return (
    <svg width={width} height={height} className="inline-block flex-shrink-0">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
});

// ── Market condition badge ────────────────────────────────────────────
const ConditionBadge = memo(function ConditionBadge({ condition }: { condition: MarketCondition }) {
  const cfg = MARKET_CONDITION_CONFIG[condition];
  return (
    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap ${cfg.color} bg-current/10`}>
      {cfg.label}
    </span>
  );
});

// ── Price display with flash effect via key remount ───────────────────
const PriceCell = memo(function PriceCell({ value, digits, timestamp, side }: { value: number; digits: number; timestamp: number; side: 'bid' | 'ask' }) {
  const colorClass = side === 'bid' ? 'text-emerald-400' : 'text-red-400';
  return (
    <span
      key={timestamp}
      className={`tabular-nums text-[11px] font-medium px-1 py-0.5 rounded ${side === 'bid' ? 'flash-green' : 'flash-red'} ${colorClass}`}
    >
      {value.toFixed(digits)}
    </span>
  );
});

// ── Sort options ──────────────────────────────────────────────────────
type SortKey = 'name' | 'spread' | 'change';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'spread', label: 'Spread' },
  { key: 'change', label: 'Change %' },
];

// ── Main component ────────────────────────────────────────────────────
export default function WatchlistPanel() {
  const prices = useTradingStore((s) => s.prices);
  const priceHistory = useTradingStore((s) => s.priceHistory);
  const marketConditions = useTradingStore((s) => s.marketConditions);
  const priceAlerts = useTradingStore((s) => s.priceAlerts);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const setActiveTab = useTradingStore((s) => s.setActiveTab);

  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [filterAlertsOnly, setFilterAlertsOnly] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Active alert symbols
  const alertSymbols = useMemo(() => {
    const set = new Set<Symbol>();
    priceAlerts.forEach((a) => {
      if (a.isActive) set.add(a.symbol);
    });
    return set;
  }, [priceAlerts]);

  // Sorted & filtered symbols
  const sortedSymbols = useMemo(() => {
    let list = [...SYMBOLS];
    if (filterAlertsOnly) {
      list = list.filter((s) => alertSymbols.has(s));
    }
    list.sort((a, b) => {
      if (sortBy === 'name') return a.localeCompare(b);
      const pa = prices[a];
      const pb = prices[b];
      if (!pa && !pb) return 0;
      if (!pa) return 1;
      if (!pb) return -1;
      if (sortBy === 'spread') return pa.spread - pb.spread;
      if (sortBy === 'change') return Math.abs(pb.changePercent) - Math.abs(pa.changePercent);
      return 0;
    });
    return list;
  }, [sortBy, filterAlertsOnly, alertSymbols, prices]);

  const handleSelect = useCallback(
    (sym: Symbol) => {
      setSelectedSymbol(sym);
      setActiveTab('trading');
    },
    [setSelectedSymbol, setActiveTab]
  );

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-1.5">
          <List className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-foreground">Watchlist</h3>
          <span className="text-[10px] text-muted-foreground ml-0.5">
            ({sortedSymbols.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Alert filter toggle */}
          <button
            onClick={() => setFilterAlertsOnly((v) => !v)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors focus-ring ${
              filterAlertsOnly
                ? 'text-amber-400 bg-amber-400/10 border border-amber-400/20'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            }`}
            title={filterAlertsOnly ? 'Show all symbols' : 'Show symbols with active alerts'}
          >
            <Filter className="h-2.5 w-2.5" />
            <span className="hidden sm:inline">Alerts</span>
          </button>

          {/* Sort dropdown */}
          <div ref={sortRef} className="relative">
            <button
              onClick={() => setShowSortMenu((v) => !v)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground transition-colors focus-ring"
            >
              <ArrowDownUp className="h-2.5 w-2.5" />
              <span className="hidden sm:inline">Sort</span>
              <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 z-50 glass-card rounded-lg border border-border shadow-xl py-1 min-w-[100px]"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setSortBy(opt.key);
                        setShowSortMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-[10px] transition-colors ${
                        sortBy === opt.key
                          ? 'text-emerald-400 bg-emerald-400/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Symbol rows ─────────────────────────────────────────── */}
      <div className="divide-y divide-white/5">
        <AnimatePresence mode="popLayout">
          {sortedSymbols.map((sym) => {
            const price = prices[sym];
            const info = SYMBOL_INFO[sym];
            const history = priceHistory[sym] || [];
            const condition = marketConditions[sym] || 'low_volatility';
            const hasAlert = alertSymbols.has(sym);
            const isSelected = selectedSymbol === sym;

            // Extract last 15 close prices for sparkline
            const sparkData = history.slice(-15).map((c: { close: number }) => c.close);

            // Spread in pips
            const spreadPips = price ? price.spread / info.pipSize : 0;

            // Change amount and percentage
            const changeAmt = price?.change ?? 0;
            const changePct = price?.changePercent ?? 0;
            const isPositive = changeAmt >= 0;

            return (
              <motion.div
                key={sym}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                onClick={() => handleSelect(sym)}
                className={`w-full text-left px-3 py-2 transition-all card-hover scale-click group ${
                  isSelected
                    ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500'
                    : 'border-l-2 border-l-transparent hover:bg-muted/30'
                }`}
              >
                {/* Mobile: single column layout */}
                <div className="flex flex-col gap-1 sm:hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground">{info.name}</span>
                      {hasAlert && (
                        <Bell className="h-2.5 w-2.5 text-amber-400 badge-pulse" />
                      )}
                      <ConditionBadge condition={condition} />
                    </div>
                    <span
                      className={`text-[10px] font-semibold tabular-nums ${
                        isPositive ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {changePct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {price ? (
                        <>
                          <PriceCell value={price.bid} digits={info.digits} timestamp={price.timestamp} side="bid" />
                          <span className="text-[10px] text-muted-foreground">/</span>
                          <PriceCell value={price.ask} digits={info.digits} timestamp={price.timestamp} side="ask" />
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground tabular-nums">-- / --</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground tabular-nums">
                        {price ? spreadPips.toFixed(1) : '--'} pips
                      </span>
                      {sparkData.length > 1 && <MiniSparkline values={sparkData} width={40} height={14} />}
                    </div>
                  </div>
                </div>

                {/* Desktop: compact row layout */}
                <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto_auto] sm:items-center gap-x-3 gap-y-0.5">
                  {/* Symbol + alert + condition */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-foreground truncate">{info.name}</span>
                    {hasAlert && (
                      <Bell className="h-2.5 w-2.5 text-amber-400 badge-pulse flex-shrink-0" />
                    )}
                    <ConditionBadge condition={condition} />
                  </div>

                  {/* Bid / Ask */}
                  <div className="flex items-center gap-1">
                    {price ? (
                      <>
                        <PriceCell value={price.bid} digits={info.digits} timestamp={price.timestamp} side="bid" />
                        <span className="text-[9px] text-muted-foreground">/</span>
                        <PriceCell value={price.ask} digits={info.digits} timestamp={price.timestamp} side="ask" />
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground tabular-nums">-- / --</span>
                    )}
                  </div>

                  {/* Spread */}
                  <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                    {price ? spreadPips.toFixed(1) : '--'}p
                  </span>

                  {/* Change */}
                  <div className="flex flex-col items-end leading-tight">
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        isPositive ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isPositive ? '+' : ''}{changeAmt.toFixed(info.digits > 3 ? 5 : info.digits)}
                    </span>
                    <span
                      className={`text-[9px] tabular-nums ${
                        isPositive ? 'text-emerald-500/70' : 'text-red-500/70'
                      }`}
                    >
                      {isPositive ? '+' : ''}{changePct.toFixed(2)}%
                    </span>
                  </div>

                  {/* Sparkline */}
                  <div className="flex-shrink-0">
                    {sparkData.length > 1 ? (
                      <MiniSparkline values={sparkData} width={56} height={18} />
                    ) : (
                      <div className="w-14 h-[18px]" />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {sortedSymbols.length === 0 && (
          <div className="px-3 py-6 text-center text-[10px] text-muted-foreground">
            {filterAlertsOnly
              ? 'No symbols with active alerts'
              : 'No price data available'}
          </div>
        )}
      </div>
    </div>
  );
}

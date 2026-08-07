'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Brain,
  Bell,
  ShieldAlert,
  Activity,
  Play,
  Pause,
} from 'lucide-react';
import { useTradingStore } from '@/store/trading-store';
import { useShallow } from 'zustand/react/shallow';
import { SYMBOLS, SYMBOL_INFO, type Symbol, type MarketCondition, type StrategyName } from '@/lib/types';

// ─── Event types ───────────────────────────────────────────────
type ActivityEventType =
  | 'trade_opened'
  | 'trade_closed'
  | 'signal'
  | 'price_alert'
  | 'risk_warning'
  | 'auto_trading'
  | 'market_condition';

interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  description: string;
  timestamp: number;
  // extra metadata for display
  symbol?: Symbol;
  direction?: 'BUY' | 'SELL';
  pnl?: number;
  pips?: number;
  confidence?: number;
  strategy?: string;
  condition?: string;
  price?: number;
  oldCondition?: MarketCondition;
  newCondition?: MarketCondition;
  autoEnabled?: boolean;
}

// ─── Icon + colour mapping per event type ──────────────────────
const EVENT_CONFIG: Record<ActivityEventType, {
  dotColor: string;
  Icon: typeof ArrowUpRight;
}> = {
  trade_opened:     { dotColor: 'bg-emerald-500',        Icon: ArrowUpRight },
  trade_closed:     { dotColor: 'bg-emerald-500',        Icon: TrendingUp },
  signal:           { dotColor: 'bg-primary',            Icon: Brain },
  price_alert:      { dotColor: 'bg-amber-500',          Icon: Bell },
  risk_warning:     { dotColor: 'bg-red-500',            Icon: ShieldAlert },
  market_condition: { dotColor: 'bg-cyan-500',           Icon: Activity },
  auto_trading:     { dotColor: 'bg-emerald-500',        Icon: Play },
};

// ─── Helpers ───────────────────────────────────────────────────
const STRATEGY_NAMES: StrategyName[] = [
  'MA_Ribbon', 'Momentum_Scalping', 'Pivot_Points',
  'EMA_Crossover', 'RMI_Trend_Sync', 'Linear_Regression', 'EMA_RSI_Filter',
];

const STRATEGY_LABELS: Record<StrategyName, string> = {
  MA_Ribbon: 'MA Ribbon',
  Momentum_Scalping: 'Momentum Scalping',
  Pivot_Points: 'Pivot Points',
  EMA_Crossover: 'EMA Crossover',
  RMI_Trend_Sync: 'RMI Trend Sync',
  Linear_Regression: 'Linear Regression',
  EMA_RSI_Filter: 'EMA/RSI Filter',
};

const CONDITIONS: MarketCondition[] = ['trending', 'range_bound', 'high_volatility', 'low_volatility'];

const CONDITION_LABELS: Record<MarketCondition, string> = {
  trending: 'Trending',
  range_bound: 'Range-Bound',
  high_volatility: 'High Volatility',
  low_volatility: 'Low Volatility',
};

const ALERT_CONDITIONS = [
  'Price above', 'Price below', 'Price crossed above', 'Price crossed below',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function formatRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Simulated event generators ────────────────────────────────
function generateTradeOpened(): ActivityEvent {
  const symbol = pick(SYMBOLS);
  const direction = pick<'BUY' | 'SELL'>(['BUY', 'SELL']);
  const info = SYMBOL_INFO[symbol];
  const entryPrice = symbol === 'XAUUSD'
    ? randRange(2020, 2050)
    : symbol === 'USDJPY'
      ? randRange(148.5, 151.5)
      : randRange(symbol === 'GBPUSD' ? 1.26 : 1.08, symbol === 'GBPUSD' ? 1.28 : 1.10);
  const lotSize = pick([0.01, 0.02, 0.05, 0.1]);
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'trade_opened',
    title: `Trade Opened: ${info.name}`,
    description: `${direction} ${lotSize} lot${lotSize > 1 ? 's' : ''} @ ${entryPrice.toFixed(info.digits)}`,
    timestamp: Date.now(),
    symbol,
    direction,
  };
}

function generateTradeClosed(): ActivityEvent {
  const symbol = pick(SYMBOLS);
  const direction = pick<'BUY' | 'SELL'>(['BUY', 'SELL']);
  const info = SYMBOL_INFO[symbol];
  const isProfit = Math.random() > 0.4;
  const pips = Math.round(isProfit ? randRange(5, 65) : -randRange(5, 45));
  const pnl = pips * 10;
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'trade_closed',
    title: `Trade Closed: ${info.name}`,
    description: `${direction} ${Math.abs(pips).toFixed(0)} pips | ${isProfit ? '+' : ''}$${pnl.toFixed(2)}`,
    timestamp: Date.now(),
    symbol,
    direction,
    pnl,
    pips,
  };
}

function generateSignal(): ActivityEvent {
  const symbol = pick(SYMBOLS);
  const direction = pick<'BUY' | 'SELL'>(['BUY', 'SELL']);
  const confidence = Math.round(randRange(60, 98));
  const strategy = pick(STRATEGY_NAMES);
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'signal',
    title: `Signal: ${SYMBOL_INFO[symbol].name} ${direction}`,
    description: `${STRATEGY_LABELS[strategy]} · ${confidence}% confidence`,
    timestamp: Date.now(),
    symbol,
    direction,
    confidence,
    strategy: STRATEGY_LABELS[strategy],
  };
}

function generatePriceAlert(): ActivityEvent {
  const symbol = pick(SYMBOLS);
  const info = SYMBOL_INFO[symbol];
  const condition = pick(ALERT_CONDITIONS);
  const price = symbol === 'XAUUSD'
    ? randRange(2020, 2050)
    : symbol === 'USDJPY'
      ? randRange(148.5, 151.5)
      : randRange(symbol === 'GBPUSD' ? 1.26 : 1.08, symbol === 'GBPUSD' ? 1.28 : 1.10);
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'price_alert',
    title: `Alert: ${info.name}`,
    description: `${condition} ${price.toFixed(info.digits)}`,
    timestamp: Date.now(),
    symbol,
    condition,
    price,
  };
}

function generateRiskWarning(): ActivityEvent {
  const percentUsed = Math.round(randRange(65, 95));
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'risk_warning',
    title: 'Daily Risk Limit Warning',
    description: `${percentUsed}% of daily risk limit used`,
    timestamp: Date.now(),
  };
}

function generateAutoTrading(): ActivityEvent {
  const enabled = Math.random() > 0.5;
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'auto_trading',
    title: `Auto-Trading ${enabled ? 'Enabled' : 'Disabled'}`,
    description: enabled ? 'Automated execution resumed' : 'Auto-trading paused by user',
    timestamp: Date.now(),
    autoEnabled: enabled,
  };
}

function generateMarketCondition(): ActivityEvent {
  const symbol = pick(SYMBOLS);
  const info = SYMBOL_INFO[symbol];
  const oldCond = pick(CONDITIONS);
  let newCond = pick(CONDITIONS);
  while (newCond === oldCond) newCond = pick(CONDITIONS);
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'market_condition',
    title: `Market Condition: ${info.name}`,
    description: `${CONDITION_LABELS[oldCond]} → ${CONDITION_LABELS[newCond]}`,
    timestamp: Date.now(),
    symbol,
    oldCondition: oldCond,
    newCondition: newCond,
  };
}

const GENERATORS: Array<() => ActivityEvent> = [
  generateTradeOpened,
  generateTradeClosed,
  generateTradeClosed, // slightly more trade closes
  generateSignal,
  generateSignal,
  generatePriceAlert,
  generateRiskWarning,
  generateAutoTrading,
  generateMarketCondition,
];

const MAX_EVENTS = 30;

// ─── Seed initial events so the feed isn't empty ───────────────
function seedInitialEvents(): ActivityEvent[] {
  const now = Date.now();
  const seeded: ActivityEvent[] = [];
  for (let i = 0; i < 8; i++) {
    const evt = GENERATORS[i % GENERATORS.length]();
    evt.id = `seed-${i}-${Math.random().toString(36).slice(2, 6)}`;
    evt.timestamp = now - (i + 1) * 12000; // stagger by 12s
    seeded.push(evt);
  }
  return seeded;
}

// ─── Component ──────────────────────────────────────────────────
export default function ActivityFeed() {
  const { openTrades, closedTrades, signals, priceAlerts, notifications } = useTradingStore(
    useShallow((s) => ({ openTrades: s.openTrades, closedTrades: s.closedTrades, signals: s.signals, priceAlerts: s.priceAlerts, notifications: s.notifications }))
  );
  const [events, setEvents] = useState<ActivityEvent[]>(seedInitialEvents);
  const [now, setNow] = useState(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const generatorIndex = useRef(0);

  // Derive real events from store (mapped to our internal type)
  const storeEvents = useMemo<ActivityEvent[]>(() => {
    const mapped: ActivityEvent[] = [];

    // Open trades → trade_opened
    for (const t of openTrades.slice(0, 5)) {
      mapped.push({
        id: `store-open-${t.id}`,
        type: 'trade_opened',
        title: `Trade Opened: ${SYMBOL_INFO[t.symbol]?.name ?? t.symbol}`,
        description: `${t.direction} ${t.lotSize} lot${t.lotSize > 1 ? 's' : ''} @ ${t.entryPrice.toFixed(SYMBOL_INFO[t.symbol]?.digits ?? 5)}`,
        timestamp: new Date(t.openedAt).getTime(),
        symbol: t.symbol,
        direction: t.direction,
      });
    }

    // Closed trades → trade_closed
    for (const t of closedTrades.slice(0, 5)) {
      const isProfit = t.profit >= 0;
      mapped.push({
        id: `store-close-${t.id}`,
        type: 'trade_closed',
        title: `Trade Closed: ${SYMBOL_INFO[t.symbol]?.name ?? t.symbol}`,
        description: `${t.direction} ${t.pips.toFixed(0)} pips | ${isProfit ? '+' : ''}$${t.profit.toFixed(2)}`,
        timestamp: t.closedAt ? new Date(t.closedAt).getTime() : Date.now(),
        symbol: t.symbol,
        direction: t.direction,
        pnl: t.profit,
        pips: t.pips,
      });
    }

    // Signals
    for (const s of signals.slice(0, 5)) {
      if (s.direction === 'HOLD') continue;
      mapped.push({
        id: `store-sig-${s.id}`,
        type: 'signal',
        title: `Signal: ${SYMBOL_INFO[s.symbol]?.name ?? s.symbol} ${s.direction}`,
        description: `${s.strategy} · ${s.confidence}% confidence`,
        timestamp: new Date(s.createdAt).getTime(),
        symbol: s.symbol,
        direction: s.direction,
        confidence: s.confidence,
        strategy: s.strategy,
      });
    }

    // Price alerts (active only, as if they just triggered)
    for (const a of priceAlerts.filter(a => a.isActive).slice(0, 3)) {
      mapped.push({
        id: `store-alert-${a.id}`,
        type: 'price_alert',
        title: `Alert: ${SYMBOL_INFO[a.symbol]?.name ?? a.symbol}`,
        description: a.message ?? `${a.condition} ${a.price}`,
        timestamp: Date.now() - 5000,
        symbol: a.symbol,
        condition: a.condition,
        price: a.price,
      });
    }

    // Notifications (map warning type to risk_warning)
    for (const n of notifications.filter(n => n.type === 'warning').slice(0, 2)) {
      mapped.push({
        id: `store-notif-${n.id}`,
        type: 'risk_warning',
        title: n.title,
        description: n.message,
        timestamp: n.timestamp,
      });
    }

    return mapped;
  }, [openTrades, closedTrades, signals, priceAlerts, notifications]);

  // Merge store events with simulated, deduplicate, sort, cap
  const mergedEvents = useMemo(() => {
    const seen = new Set<string>();
    const combined: ActivityEvent[] = [];

    for (const e of [...storeEvents, ...events]) {
 if (seen.has(e.id)) continue;
      seen.add(e.id);
      combined.push(e);
    }

    combined.sort((a, b) => b.timestamp - a.timestamp);
    return combined.slice(0, MAX_EVENTS);
  }, [storeEvents, events]);

  // Auto-generate events every 8-12 seconds
  useEffect(() => {
    const timerRef = { current: undefined as ReturnType<typeof setTimeout> | undefined };
    const scheduleNext = () => {
      const delay = Math.floor(randRange(8000, 12000));
      timerRef.current = setTimeout(() => {
        const gen = GENERATORS[generatorIndex.current % GENERATORS.length];
        generatorIndex.current++;
        const evt = gen();
        setEvents(prev => [evt, ...prev].slice(0, MAX_EVENTS));
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Update relative time every 10s
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to top when new event arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [mergedEvents.length]);

  // Resolve icon for a given event
  const getIcon = useCallback((evt: ActivityEvent) => {
    if (evt.type === 'trade_opened') {
      return evt.direction === 'SELL' ? ArrowDownRight : ArrowUpRight;
    }
    if (evt.type === 'trade_closed') {
      return (evt.pnl ?? 0) >= 0 ? TrendingUp : TrendingDown;
    }
    if (evt.type === 'auto_trading') {
      return evt.autoEnabled ? Play : Pause;
    }
    const config = EVENT_CONFIG[evt.type];
    return config.Icon;
  }, []);

  const getDotColor = useCallback((evt: ActivityEvent) => {
    if (evt.type === 'trade_closed' && (evt.pnl ?? 0) < 0) return 'bg-red-500';
    if (evt.type === 'auto_trading' && !evt.autoEnabled) return 'bg-amber-500';
    return EVENT_CONFIG[evt.type].dotColor;
  }, []);

  const getIconColor = useCallback((evt: ActivityEvent) => {
    if (evt.type === 'trade_closed' && (evt.pnl ?? 0) < 0) return 'text-red-400';
    if (evt.type === 'trade_opened' && evt.direction === 'SELL') return 'text-red-400';
    if (evt.type === 'risk_warning') return 'text-red-400';
    if (evt.type === 'price_alert') return 'text-amber-400';
    if (evt.type === 'market_condition') return 'text-cyan-400';
    if (evt.type === 'signal') return 'text-primary';
    if (evt.type === 'auto_trading' && !evt.autoEnabled) return 'text-amber-400';
    return 'text-emerald-400';
  }, []);

  const getPnlColor = useCallback((evt: ActivityEvent) => {
    if (evt.type !== 'trade_closed') return '';
    return (evt.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400';
  }, []);

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col h-full">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-2 h-2">
            <span className="pulse-dot absolute inset-0 rounded-full bg-emerald-500" />
          </div>
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Activity Feed
          </h3>
        </div>
        <span className="badge-pulse inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary/15 text-[10px] font-semibold text-primary tabular-nums">
          {mergedEvents.length}
        </span>
      </div>

      {/* ─── Timeline ────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="max-h-[400px] overflow-y-auto pr-1 flex-1"
      >
        <AnimatePresence initial={false}>
          <div className="relative pl-5">
            {/* Vertical connecting line */}
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent" />

            {mergedEvents.map((evt, idx) => {
              const Icon = getIcon(evt);
              const dotColor = getDotColor(evt);
              const iconColor = getIconColor(evt);
              const pnlColor = getPnlColor(evt);
              const isLatest = idx === 0;

              return (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`relative flex items-start gap-3 pb-3 group ${isLatest ? 'fade-in-up' : ''}`}
                >
                  {/* Dot + icon on the timeline */}
                  <div className="absolute -left-5 top-1 flex items-center justify-center">
                    <span className={`w-[6px] h-[6px] rounded-full ${dotColor} ring-2 ring-background/60 ${isLatest ? 'pulse-dot' : ''}`} />
                  </div>

                  {/* Icon badge */}
                  <div className={`flex-shrink-0 mt-0.5 flex items-center justify-center w-6 h-6 rounded-md ${isLatest ? 'bg-muted/50' : 'bg-transparent'} transition-colors group-hover:bg-muted/50`}>
                    <Icon className={`w-3 h-3 ${iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground/90 truncate">
                        {evt.title}
                      </p>
                      <span className="flex-shrink-0 text-[10px] text-muted-foreground tabular-nums">
                        {formatRelativeTime(evt.timestamp)}
                      </span>
                    </div>
                    <p className={`text-[10px] mt-0.5 leading-tight ${pnlColor || 'text-muted-foreground/70'}`}>
                      {evt.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>

        {mergedEvents.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground">No activity yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

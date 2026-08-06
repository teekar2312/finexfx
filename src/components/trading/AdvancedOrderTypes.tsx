'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOL_INFO, type Symbol as TSymbol, type Trade } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  Shield,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Zap,
  AlertCircle,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  type LucideIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type TabId = 'oco' | 'breakeven' | 'trailing';

interface OCOOrder {
  buyStopEntry: string;
  buyStopLot: string;
  buyStopSL: string;
  buyStopTP: string;
  sellStopEntry: string;
  sellStopLot: string;
  sellStopSL: string;
  sellStopTP: string;
}

interface TrailingLimitOrder {
  trailDistance: string;
  direction: 'BUY' | 'SELL';
  limitOffset: string;
  lotSize: string;
}

interface ActiveBETrade {
  tradeId: string;
  activatedAt: number;
  originalSL: number | undefined;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabButton({
  id,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  id: TabId;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`scale-click flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-all ${
        active
          ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-300'
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

/** Compact labelled input */
function CompactInput({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-500">{label}</span>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-7 w-full rounded-md border border-white/10 bg-white/5 px-2 pr-8 text-xs text-slate-200 tabular-nums outline-none transition focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

/** Inline price diagram for OCO orders */
function OCODiagram({
  currentPrice,
  buyStopEntry,
  sellStopEntry,
  digits,
}: {
  currentPrice: number;
  buyStopEntry: number;
  sellStopEntry: number;
  digits: number;
}) {
  const validBuy = buyStopEntry > 0 && buyStopEntry > currentPrice;
  const validSell = sellStopEntry > 0 && sellStopEntry < currentPrice;

  // Compute visual positions: map prices to 0-100% range
  const allPrices = [buyStopEntry, sellStopEntry, currentPrice].filter((p) => p > 0);
  const minP = allPrices.length ? Math.min(...allPrices) : currentPrice - 0.005;
  const maxP = allPrices.length ? Math.max(...allPrices) : currentPrice + 0.005;
  const range = maxP - minP || 0.01;

  const toY = (p: number) => 100 - ((p - minP) / range) * 80 - 10;

  return (
    <div className="glass-card relative mt-3 flex h-32 flex-col overflow-hidden rounded-lg p-3">
      <span className="section-title-accent mb-2 text-[10px] font-semibold uppercase tracking-wider">
        Price Level Diagram
      </span>
      <svg viewBox="0 0 200 100" className="w-full flex-1" preserveAspectRatio="xMidYMid meet">
        {/* Current price dashed line */}
        <line
          x1="20"
          y1={toY(currentPrice)}
          x2="180"
          y2={toY(currentPrice)}
          stroke="#94a3b8"
          strokeWidth="1"
          strokeDasharray="4 2"
        />
        <text x="4" y={toY(currentPrice) + 3} fill="#94a3b8" fontSize="7" className="tabular-nums">
          {currentPrice.toFixed(digits)}
        </text>

        {/* BUY STOP level */}
        {validBuy && (
          <>
            <line
              x1="30"
              y1={toY(buyStopEntry)}
              x2="180"
              y2={toY(buyStopEntry)}
              stroke="#22c55e"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
            <circle cx="160" cy={toY(buyStopEntry)} r="3" fill="#22c55e" />
            <text x="165" y={toY(buyStopEntry) + 3} fill="#22c55e" fontSize="6" fontWeight="bold">
              BUY STOP {buyStopEntry.toFixed(digits)}
            </text>
          </>
        )}

        {/* SELL STOP level */}
        {validSell && (
          <>
            <line
              x1="30"
              y1={toY(sellStopEntry)}
              x2="180"
              y2={toY(sellStopEntry)}
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
            <circle cx="160" cy={toY(sellStopEntry)} r="3" fill="#ef4444" />
            <text x="165" y={toY(sellStopEntry) + 3} fill="#ef4444" fontSize="6" fontWeight="bold">
              SELL STOP {sellStopEntry.toFixed(digits)}
            </text>
          </>
        )}

        {/* Current price label */}
        <text x="165" y={toY(currentPrice) + 3} fill="#94a3b8" fontSize="6" fontWeight="bold">
          CURRENT
        </text>
      </svg>
    </div>
  );
}

/** Break-Even visual for a single trade */
function BEMiniChart({
  entryPrice,
  currentPrice,
  bePrice,
  direction,
  digits,
}: {
  entryPrice: number;
  currentPrice: number;
  bePrice: number;
  direction: 'BUY' | 'SELL';
  digits: number;
}) {
  const prices = [entryPrice, currentPrice, bePrice];
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 0.01;
  const toY = (p: number) => 60 - ((p - minP) / range) * 40 - 10;
  const inProfit =
    direction === 'BUY' ? currentPrice >= entryPrice : currentPrice <= entryPrice;

  return (
    <svg viewBox="0 0 140 60" className="h-12 w-full" preserveAspectRatio="xMidYMid meet">
      {/* Entry */}
      <line x1="10" y1={toY(entryPrice)} x2="130" y2={toY(entryPrice)} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 2" />
      <text x="2" y={toY(entryPrice) + 2} fill="#64748b" fontSize="5" className="tabular-nums">
        Entry
      </text>

      {/* Current */}
      <line x1="10" y1={toY(currentPrice)} x2="130" y2={toY(currentPrice)} stroke="#38bdf8" strokeWidth="0.8" />
      <text x="2" y={toY(currentPrice) + 2} fill="#38bdf8" fontSize="5" className="tabular-nums">
        {currentPrice.toFixed(digits)}
      </text>

      {/* BE line */}
      <line x1="40" y1={toY(bePrice)} x2="130" y2={toY(bePrice)} stroke="#facc15" strokeWidth="1" strokeDasharray="2 1" />
      <circle cx="85" cy={toY(bePrice)} r="2.5" fill={inProfit ? '#facc15' : '#475569'} />
      <text x="110" y={toY(bePrice) + 2} fill="#facc15" fontSize="5" fontWeight="bold">
        BE
      </text>
    </svg>
  );
}

/** Trailing limit visual */
function TrailingVisual({
  direction,
  trailDistance,
  limitOffset,
  currentPrice,
  digits,
}: {
  direction: 'BUY' | 'SELL';
  trailDistance: number;
  limitOffset: number;
  currentPrice: number;
  digits: number;
}) {
  const trailPrice =
    direction === 'BUY'
      ? currentPrice - trailDistance * 0.0001
      : currentPrice + trailDistance * 0.0001;
  const limitPrice =
    direction === 'BUY'
      ? trailPrice - limitOffset * 0.0001
      : trailPrice + limitOffset * 0.0001;

  const prices = [currentPrice, trailPrice, limitPrice];
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 0.001;
  const toY = (p: number) => 60 - ((p - minP) / range) * 36 - 12;

  return (
    <svg viewBox="0 0 180 60" className="h-14 w-full" preserveAspectRatio="xMidYMid meet">
      {/* Current price */}
      <line x1="10" y1={toY(currentPrice)} x2="170" y2={toY(currentPrice)} stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3 2" />
      <text x="2" y={toY(currentPrice) + 2} fill="#94a3b8" fontSize="5">Current</text>

      {/* Trailing line (animated) */}
      <line x1="30" y1={toY(trailPrice)} x2="160" y2={toY(trailPrice)} stroke="#a78bfa" strokeWidth="1" strokeDasharray="4 2">
        <animate attributeName="stroke-dashoffset" from="0" to="12" dur="1s" repeatCount="indefinite" />
      </line>
      <text x="2" y={toY(trailPrice) + 2} fill="#a78bfa" fontSize="5" className="tabular-nums">
        Trail
      </text>

      {/* Limit offset line */}
      <line x1="30" y1={toY(limitPrice)} x2="160" y2={toY(limitPrice)} stroke="#f472b6" strokeWidth="1" />
      <circle cx="120" cy={toY(limitPrice)} r="3" fill="#f472b6" />
      <text x="125" y={toY(limitPrice) + 2} fill="#f472b6" fontSize="5" fontWeight="bold">
        Limit {limitPrice.toFixed(digits)}
      </text>

      {/* Connecting arrow between trail and limit */}
      <line x1="120" y1={toY(trailPrice)} x2="120" y2={toY(limitPrice)} stroke="#475569" strokeWidth="0.5" strokeDasharray="2 1" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AdvancedOrderTypes() {
  const {
    prices,
    selectedSymbol,
    openTrades,
    addTrade,
    updateTrade,
    isConnected,
    addNotification,
  } = useTradingStore();

  const [activeTab, setActiveTab] = useState<TabId>('oco');
  const ocoPairRef = useRef<string | null>(null);

  // ---- OCO state ----
  const [oco, setOco] = useState<OCOOrder>({
    buyStopEntry: '',
    buyStopLot: '0.01',
    buyStopSL: '',
    buyStopTP: '',
    sellStopEntry: '',
    sellStopLot: '0.01',
    sellStopSL: '',
    sellStopTP: '',
  });

  // ---- Break-Even state ----
  const [beTriggerPips, setBeTriggerPips] = useState('10');
  const [activeBETrades, setActiveBETrades] = useState<ActiveBETrade[]>([]);

  // ---- Trailing Limit state ----
  const [trailing, setTrailing] = useState<TrailingLimitOrder>({
    trailDistance: '15',
    direction: 'BUY',
    limitOffset: '5',
    lotSize: '0.01',
  });

  const price = prices[selectedSymbol];
  const currentPrice = price?.bid ?? 0;
  const info = SYMBOL_INFO[selectedSymbol];

  // -----------------------------------------------------------------------
  // OCO handlers
  // -----------------------------------------------------------------------
  const handlePlaceOCO = useCallback(() => {
    if (!isConnected) return;
    const buyEntry = parseFloat(oco.buyStopEntry);
    const sellEntry = parseFloat(oco.sellStopEntry);
    if (!buyEntry || buyEntry <= currentPrice) {
      addNotification({ type: 'error', title: 'Invalid BUY STOP', message: 'Entry must be above current price.' });
      return;
    }
    if (!sellEntry || sellEntry >= currentPrice) {
      addNotification({ type: 'error', title: 'Invalid SELL STOP', message: 'Entry must be below current price.' });
      return;
    }

    const pairId = `oco-${Date.now()}`;
    ocoPairRef.current = pairId;

    const buySL = oco.buyStopSL ? parseFloat(oco.buyStopSL) : undefined;
    const buyTP = oco.buyStopTP ? parseFloat(oco.buyStopTP) : undefined;
    const sellSL = oco.sellStopSL ? parseFloat(oco.sellStopSL) : undefined;
    const sellTP = oco.sellStopTP ? parseFloat(oco.sellStopTP) : undefined;

    const now = new Date().toISOString();

    // BUY STOP
    addTrade({
      id: `${pairId}-buy`,
      symbol: selectedSymbol,
      direction: 'BUY',
      lotSize: parseFloat(oco.buyStopLot) || 0.01,
      entryPrice: buyEntry,
      currentPrice: buyEntry,
      stopLoss: buySL,
      takeProfit: buyTP,
      trailingStop: undefined,
      isTrailingStop: false,
      pips: 0,
      profit: 0,
      commission: 0,
      spread: 0,
      swap: 0,
      status: 'pending',
      strategy: `OCO-${pairId}`,
      openedAt: now,
    });

    // SELL STOP
    addTrade({
      id: `${pairId}-sell`,
      symbol: selectedSymbol,
      direction: 'SELL',
      lotSize: parseFloat(oco.sellStopLot) || 0.01,
      entryPrice: sellEntry,
      currentPrice: sellEntry,
      stopLoss: sellSL,
      takeProfit: sellTP,
      trailingStop: undefined,
      isTrailingStop: false,
      pips: 0,
      profit: 0,
      commission: 0,
      spread: 0,
      swap: 0,
      status: 'pending',
      strategy: `OCO-${pairId}`,
      openedAt: now,
    });

    addNotification({
      type: 'success',
      title: 'OCO Order Placed',
      message: `BUY STOP @ ${buyEntry.toFixed(info.digits)} + SELL STOP @ ${sellEntry.toFixed(info.digits)}`,
    });

    // Reset
    setOco({
      buyStopEntry: '',
      buyStopLot: '0.01',
      buyStopSL: '',
      buyStopTP: '',
      sellStopEntry: '',
      sellStopLot: '0.01',
      sellStopSL: '',
      sellStopTP: '',
    });
  }, [isConnected, oco, currentPrice, selectedSymbol, info.digits, addTrade, addNotification]);

  // -----------------------------------------------------------------------
  // Break-Even handlers
  // -----------------------------------------------------------------------
  const toggleBE = useCallback(
    (trade: Trade) => {
      const existing = activeBETrades.find((a) => a.tradeId === trade.id);
      if (existing) {
        // Deactivate: restore original SL
        setActiveBETrades((prev) => prev.filter((a) => a.tradeId !== trade.id));
        if (existing.originalSL !== undefined) {
          updateTrade(trade.id, { stopLoss: existing.originalSL });
        }
        addNotification({
          type: 'info',
          title: 'BE Deactivated',
          message: `${trade.symbol} ${trade.direction} - breakeven cancelled`,
        });
      } else {
        // Activate: store original SL, note BE will trigger at trigger pips
        setActiveBETrades((prev) => [
          ...prev,
          {
            tradeId: trade.id,
            activatedAt: Date.now(),
            originalSL: trade.stopLoss,
          },
        ]);
        addNotification({
          type: 'success',
          title: 'BE Activated',
          message: `${trade.symbol} ${trade.direction} - SL will move to ${trade.entryPrice.toFixed(info.digits)} at +${beTriggerPips} pips`,
        });
      }
    },
    [activeBETrades, beTriggerPips, info.digits, updateTrade, addNotification],
  );

  // Simulate break-even trigger on each tick
  useEffect(() => {
    if (!currentPrice || activeBETrades.length === 0) return;

    const triggerPips = parseFloat(beTriggerPips) || 10;
    const pipSize = info.pipSize;

    activeBETrades.forEach((be) => {
      const trade = openTrades.find((t) => t.id === be.tradeId);
      if (!trade || trade.status === 'pending') return;

      const profitPips = trade.direction === 'BUY'
        ? (currentPrice - trade.entryPrice) / pipSize
        : (trade.entryPrice - currentPrice) / pipSize;

      if (profitPips >= triggerPips) {
        // Check if already moved
        if (trade.stopLoss !== trade.entryPrice) {
          updateTrade(trade.id, { stopLoss: trade.entryPrice });
          addNotification({
            type: 'success',
            title: 'BE Triggered',
            message: `${trade.symbol} ${trade.direction} - SL moved to entry ${trade.entryPrice.toFixed(info.digits)}`,
          });
        }
      }
    });
  }, [currentPrice, activeBETrades, beTriggerPips, info.pipSize, info.digits, openTrades, updateTrade, addNotification]);

  // -----------------------------------------------------------------------
  // Trailing Limit handlers
  // -----------------------------------------------------------------------
  const handlePlaceTrailingLimit = useCallback(() => {
    if (!isConnected) return;
    const trailDist = parseFloat(trailing.trailDistance);
    const limitOff = parseFloat(trailing.limitOffset);
    const lot = parseFloat(trailing.lotSize);

    if (!trailDist || trailDist <= 0) {
      addNotification({ type: 'error', title: 'Invalid Trail', message: 'Trail distance must be > 0 pips.' });
      return;
    }
    if (!limitOff || limitOff <= 0) {
      addNotification({ type: 'error', title: 'Invalid Offset', message: 'Limit offset must be > 0 pips.' });
      return;
    }

    const pipSize = info.pipSize;
    const trailPrice =
      trailing.direction === 'BUY'
        ? currentPrice - trailDist * pipSize
        : currentPrice + trailDist * pipSize;
    const limitPrice =
      trailing.direction === 'BUY'
        ? trailPrice - limitOff * pipSize
        : trailPrice + limitOff * pipSize;

    const now = new Date().toISOString();
    addTrade({
      id: `tl-${Date.now()}`,
      symbol: selectedSymbol,
      direction: trailing.direction,
      lotSize: lot || 0.01,
      entryPrice: limitPrice,
      currentPrice: limitPrice,
      stopLoss: undefined,
      takeProfit: undefined,
      trailingStop: trailDist,
      isTrailingStop: true,
      pips: 0,
      profit: 0,
      commission: 0,
      spread: 0,
      swap: 0,
      status: 'pending',
      strategy: `TrailingLimit-${trailDist}/${limitOff}`,
      openedAt: now,
    });

    addNotification({
      type: 'success',
      title: 'Trailing Limit Placed',
      message: `${trailing.direction} ${selectedSymbol} trail: ${trailDist}p / offset: ${limitOff}p @ ${limitPrice.toFixed(info.digits)}`,
    });
  }, [isConnected, trailing, currentPrice, selectedSymbol, info, addTrade, addNotification]);

  // -----------------------------------------------------------------------
  // Computed values for visuals
  // -----------------------------------------------------------------------
  const buyStopEntry = parseFloat(oco.buyStopEntry) || 0;
  const sellStopEntry = parseFloat(oco.sellStopEntry) || 0;

  const openNonPendingTrades = useMemo(
    () => openTrades.filter((t) => t.status === 'open'),
    [openTrades],
  );

  const trailDistNum = parseFloat(trailing.trailDistance) || 0;
  const limitOffNum = parseFloat(trailing.limitOffset) || 0;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="glass-card space-y-3 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="section-title-accent text-xs font-bold uppercase tracking-wider">
          Advanced Orders
        </h3>
        <Badge variant="outline" className="border-white/10 text-[10px] text-slate-400">
          {selectedSymbol}
        </Badge>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-1 rounded-lg bg-white/5 p-1">
        <TabButton id="oco" label="OCO" icon={GitBranch} active={activeTab === 'oco'} onClick={() => setActiveTab('oco')} />
        <TabButton id="breakeven" label="Break-Even" icon={Shield} active={activeTab === 'breakeven'} onClick={() => setActiveTab('breakeven')} />
        <TabButton id="trailing" label="Trailing Limit" icon={TrendingUp} active={activeTab === 'trailing'} onClick={() => setActiveTab('trailing')} />
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* ======================== OCO TAB ======================== */}
        {activeTab === 'oco' && (
          <motion.div
            key="oco"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {/* Current price reference */}
            <div className="flex items-center justify-between rounded-md bg-white/5 px-3 py-1.5">
              <span className="text-[10px] text-slate-500">Current Price</span>
              <span className="tabular-nums text-xs font-semibold text-slate-200">
                {currentPrice.toFixed(info.digits)}
              </span>
            </div>

            {/* BUY STOP Section */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                <span className="text-[11px] font-semibold text-emerald-400">BUY STOP</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <CompactInput
                  label="Entry Price"
                  value={oco.buyStopEntry}
                  onChange={(v) => setOco((o) => ({ ...o, buyStopEntry: v }))}
                  placeholder={`>${currentPrice.toFixed(info.digits)}`}
                  suffix={SYMBOL_INFO[selectedSymbol].quoteCurrency}
                />
                <CompactInput
                  label="Lot Size"
                  value={oco.buyStopLot}
                  onChange={(v) => setOco((o) => ({ ...o, buyStopLot: v }))}
                  suffix="lots"
                />
                <CompactInput
                  label="Stop Loss"
                  value={oco.buyStopSL}
                  onChange={(v) => setOco((o) => ({ ...o, buyStopSL: v }))}
                  placeholder="Optional"
                />
                <CompactInput
                  label="Take Profit"
                  value={oco.buyStopTP}
                  onChange={(v) => setOco((o) => ({ ...o, buyStopTP: v }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* SELL STOP Section */}
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <ArrowDownRight className="h-3 w-3 text-red-400" />
                <span className="text-[11px] font-semibold text-red-400">SELL STOP</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <CompactInput
                  label="Entry Price"
                  value={oco.sellStopEntry}
                  onChange={(v) => setOco((o) => ({ ...o, sellStopEntry: v }))}
                  placeholder={`<${currentPrice.toFixed(info.digits)}`}
                  suffix={SYMBOL_INFO[selectedSymbol].quoteCurrency}
                />
                <CompactInput
                  label="Lot Size"
                  value={oco.sellStopLot}
                  onChange={(v) => setOco((o) => ({ ...o, sellStopLot: v }))}
                  suffix="lots"
                />
                <CompactInput
                  label="Stop Loss"
                  value={oco.sellStopSL}
                  onChange={(v) => setOco((o) => ({ ...o, sellStopSL: v }))}
                  placeholder="Optional"
                />
                <CompactInput
                  label="Take Profit"
                  value={oco.sellStopTP}
                  onChange={(v) => setOco((o) => ({ ...o, sellStopTP: v }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Visual diagram */}
            {currentPrice > 0 && (
              <OCODiagram
                currentPrice={currentPrice}
                buyStopEntry={buyStopEntry}
                sellStopEntry={sellStopEntry}
                digits={info.digits}
              />
            )}

            {/* Place button */}
            <Button
              onClick={handlePlaceOCO}
              disabled={!isConnected || !oco.buyStopEntry || !oco.sellStopEntry}
              className="scale-click w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-[11px] font-semibold text-white hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40"
              size="sm"
            >
              <Zap className="mr-1 h-3 w-3" />
              {!isConnected ? 'Not Connected' : 'Place OCO Order'}
            </Button>

            {/* Info note */}
            <p className="text-center text-[10px] text-slate-500">
              When one order fills, the other is automatically cancelled
            </p>
          </motion.div>
        )}

        {/* ======================== BREAK-EVEN TAB ======================== */}
        {activeTab === 'breakeven' && (
          <motion.div
            key="breakeven"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {/* Trigger config */}
            <div className="glass-card flex items-center justify-between rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-400" />
                <span className="text-[11px] font-medium text-slate-300">BE Activation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500">Trigger at</span>
                <input
                  type="number"
                  value={beTriggerPips}
                  onChange={(e) => setBeTriggerPips(e.target.value)}
                  className="h-7 w-14 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-amber-400 tabular-nums outline-none focus:border-amber-500/40"
                  min="1"
                />
                <span className="text-[10px] text-slate-500">pips profit</span>
              </div>
            </div>

            {/* Open trades list */}
            {openNonPendingTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-white/5 py-6">
                <AlertCircle className="h-5 w-5 text-slate-500" />
                <span className="text-[11px] text-slate-500">No open trades to manage</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {openNonPendingTrades.map((trade) => {
                  const isBEActive = activeBETrades.some((a) => a.tradeId === trade.id);
                  const profitPips =
                    trade.direction === 'BUY'
                      ? (currentPrice - trade.entryPrice) / info.pipSize
                      : (trade.entryPrice - currentPrice) / info.pipSize;
                  const triggerPips = parseFloat(beTriggerPips) || 10;
                  const wouldTrigger = profitPips >= triggerPips;
                  const inProfit = profitPips > 0;

                  return (
                    <motion.div
                      key={trade.id}
                      className={`card-hover glass-card rounded-lg p-2.5 transition-all ${isBEActive ? 'ring-1 ring-amber-500/30' : ''}`}
                    >
                      {/* Trade header row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`border-0 px-1.5 py-0 text-[10px] font-bold ${
                              trade.direction === 'BUY'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-red-500/15 text-red-400'
                            }`}
                          >
                            {trade.direction}
                          </Badge>
                          <span className="text-[11px] font-medium text-slate-300">{trade.symbol}</span>
                          <span className="metric-compact tabular-nums text-[10px] text-slate-500">
                            {trade.lotSize} lots
                          </span>
                        </div>
                        <button
                          onClick={() => toggleBE(trade)}
                          className={`scale-click flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
                            isBEActive
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-400'
                          }`}
                        >
                          {isBEActive ? (
                            <ToggleRight className="h-3.5 w-3.5" />
                          ) : (
                            <ToggleLeft className="h-3.5 w-3.5" />
                          )}
                          {isBEActive ? 'Active' : 'Activate BE'}
                        </button>
                      </div>

                      {/* Pips info */}
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="tabular-nums text-[10px] text-slate-500">
                          Entry: {trade.entryPrice.toFixed(info.digits)}
                        </span>
                        <span className="tabular-nums text-[10px] text-slate-500">
                          P&amp;L:{' '}
                          <span className={inProfit ? 'text-emerald-400' : 'text-red-400'}>
                            {profitPips >= 0 ? '+' : ''}
                            {profitPips.toFixed(1)}p
                          </span>
                        </span>
                        {wouldTrigger && (
                          <CheckCircle2 className="h-3 w-3 text-amber-400" />
                        )}
                      </div>

                      {/* Mini chart */}
                      <div className="mt-2">
                        <BEMiniChart
                          entryPrice={trade.entryPrice}
                          currentPrice={currentPrice}
                          bePrice={trade.entryPrice}
                          direction={trade.direction}
                          digits={info.digits}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <Minus className="h-2 w-2 text-slate-400" /> Entry
              </span>
              <span className="flex items-center gap-1">
                <Minus className="h-2 w-2 text-sky-400" /> Current
              </span>
              <span className="flex items-center gap-1">
                <Minus className="h-2 w-2 text-yellow-400" /> BE Line
              </span>
            </div>
          </motion.div>
        )}

        {/* ======================== TRAILING LIMIT TAB ======================== */}
        {activeTab === 'trailing' && (
          <motion.div
            key="trailing"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {/* Direction selector */}
            <div className="flex gap-1">
              <button
                onClick={() => setTrailing((t) => ({ ...t, direction: 'BUY' }))}
                className={`scale-click flex-1 rounded-md py-1.5 text-[11px] font-semibold transition-all ${
                  trailing.direction === 'BUY'
                    ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                    : 'bg-white/5 text-slate-500 hover:bg-white/10'
                }`}
              >
                <ArrowUpRight className="mr-1 inline h-3 w-3" />
                BUY Trail
              </button>
              <button
                onClick={() => setTrailing((t) => ({ ...t, direction: 'SELL' }))}
                className={`scale-click flex-1 rounded-md py-1.5 text-[11px] font-semibold transition-all ${
                  trailing.direction === 'SELL'
                    ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                    : 'bg-white/5 text-slate-500 hover:bg-white/10'
                }`}
              >
                <ArrowDownRight className="mr-1 inline h-3 w-3" />
                SELL Trail
              </button>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <CompactInput
                label="Trail Distance"
                value={trailing.trailDistance}
                onChange={(v) => setTrailing((t) => ({ ...t, trailDistance: v }))}
                suffix="pips"
              />
              <CompactInput
                label="Limit Offset"
                value={trailing.limitOffset}
                onChange={(v) => setTrailing((t) => ({ ...t, limitOffset: v }))}
                suffix="pips"
              />
              <CompactInput
                label="Lot Size"
                value={trailing.lotSize}
                onChange={(v) => setTrailing((t) => ({ ...t, lotSize: v }))}
                suffix="lots"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-500">Est. Limit</span>
                <div className="flex h-7 items-center rounded-md border border-white/10 bg-white/5 px-2 tabular-nums text-xs text-slate-300">
                  {(() => {
                    if (!currentPrice || !trailDistNum || !limitOffNum) return '—';
                    const pipSize = info.pipSize;
                    const trailP =
                      trailing.direction === 'BUY'
                        ? currentPrice - trailDistNum * pipSize
                        : currentPrice + trailDistNum * pipSize;
                    const limitP =
                      trailing.direction === 'BUY'
                        ? trailP - limitOffNum * pipSize
                        : trailP + limitOffNum * pipSize;
                    return limitP.toFixed(info.digits);
                  })()}
                </div>
              </div>
            </div>

            {/* Visual */}
            <div className="glass-card rounded-lg p-3">
              <span className="section-title-accent text-[10px] font-semibold uppercase tracking-wider">
                Trailing Concept
              </span>
              <div className="mt-2">
                <TrailingVisual
                  direction={trailing.direction}
                  trailDistance={trailDistNum}
                  limitOffset={limitOffNum}
                  currentPrice={currentPrice}
                  digits={info.digits}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-4 text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Minus className="h-2 w-2 text-slate-400" /> Current
                </span>
                <span className="flex items-center gap-1">
                  <Minus className="h-2 w-2 text-violet-400" /> Trail
                </span>
                <span className="flex items-center gap-1">
                  <Minus className="h-2 w-2 text-pink-400" /> Limit
                </span>
              </div>
            </div>

            {/* How it works */}
            <div className="rounded-lg bg-white/5 p-2.5">
              <p className="text-[10px] leading-relaxed text-slate-400">
                <span className="font-medium text-slate-300">How it works:</span> A limit order trails the
                market price by{' '}
                <span className="text-violet-400">{trailing.trailDistance || '—'} pips</span>. The limit
                entry is placed{' '}
                <span className="text-pink-400">{trailing.limitOffset || '—'} pips</span> behind the
                trailing line. As price moves in your favour, both lines follow.
              </p>
            </div>

            {/* Place button */}
            <Button
              onClick={handlePlaceTrailingLimit}
              disabled={!isConnected || !trailing.trailDistance || !trailing.limitOffset}
              className={`scale-click w-full text-[11px] font-semibold text-white disabled:opacity-40 ${
                trailing.direction === 'BUY'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
                  : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500'
              }`}
              size="sm"
            >
              <TrendingUp className="mr-1 h-3 w-3" />
              {!isConnected ? 'Not Connected' : `Place Trailing Limit (${trailing.direction})`}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

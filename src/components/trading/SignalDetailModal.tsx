'use client';

import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Copy,
  Bell,
  Zap,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  X,
  Clock,
  BarChart3,
  Award,
} from 'lucide-react';
import { useTradingStore } from '@/store/trading-store';
import { useShallow } from 'zustand/react/shallow';
import {
  SYMBOL_INFO,
  STRATEGIES,
  BROKER_CONFIG,
  type TradingSignal,
  type StrategyName,
  type TradeDirection,
} from '@/lib/types';

interface SignalDetailModalProps {
  signal: TradingSignal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// --- Animated Ring Gauge ---
function ConfidenceRing({ confidence, size = 72 }: { confidence: number; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (confidence / 100) * circumference;
  const color = confidence >= 80 ? '#10b981' : confidence >= 60 ? '#f59e0b' : '#ef4444';
  const center = size / 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold tabular-nums" style={{ color }}>
          {confidence}%
        </span>
      </div>
    </div>
  );
}

// --- Strategy signal generation (deterministic for consistency) ---
function getStrategySignalForSymbol(
  strategy: StrategyName,
  symbol: string,
  mainDirection: TradeDirection | 'HOLD'
): 'bullish' | 'bearish' | 'neutral' {
  const seed = (strategy.length * 7 + symbol.length * 13) % 100;
  if (seed < 55) return mainDirection === 'BUY' ? 'bullish' : mainDirection === 'SELL' ? 'bearish' : 'neutral';
  if (seed < 75) return mainDirection === 'BUY' ? 'bearish' : mainDirection === 'SELL' ? 'bullish' : 'neutral';
  return 'neutral';
}

function getStrategyConfidence(strategy: StrategyName, symbol: string): number {
  const seed = (strategy.length * 11 + symbol.length * 17) % 100;
  return 40 + seed * 0.5;
}

// --- Indicator data generation (deterministic) ---
function generateIndicatorsForSignal(signal: TradingSignal) {
  const allIndicators = [
    { name: 'RSI(14)', value: 62.4, signal: 'bullish' as const },
    { name: 'MACD(12,26,9)', value: 0.0032, signal: 'bullish' as const },
    { name: 'EMA(9)', value: 1.0845, signal: 'bullish' as const },
    { name: 'EMA(21)', value: 1.0838, signal: 'bullish' as const },
    { name: 'ATR(14)', value: 0.0045, signal: 'neutral' as const },
    { name: 'Bollinger Bands', value: 1.0850, signal: 'neutral' as const },
    { name: 'Stochastic(14,3)', value: 71.2, signal: 'bullish' as const },
    { name: 'SuperTrend(10,3)', value: 1.0830, signal: 'bearish' as const },
    { name: 'Volume', value: 1523, signal: 'bullish' as const },
    { name: 'CCI(20)', value: 85.3, signal: 'bullish' as const },
  ];

  const seed = (signal.id.charCodeAt(0) * 3 + signal.symbol.length * 7) % allIndicators.length;
  const rotated = [...allIndicators.slice(seed), ...allIndicators.slice(0, seed)];

  return rotated.slice(0, 8).map((ind) => {
    const isBuy = signal.direction === 'BUY';
    const s = (ind.name.length * 5 + signal.symbol.length * 11) % 10;
    let sig = ind.signal;
    if (s < 2) sig = isBuy ? 'bearish' : 'bullish';
    else if (s < 4) sig = 'neutral';
    return { ...ind, signal: sig };
  });
}

// --- Historical accuracy simulation ---
function generateHistoricalAccuracy(signal: TradingSignal) {
  const seed = (signal.symbol.length * 13 + signal.strategy.length * 7) % 100;
  const winRate = 55 + (seed % 25);
  const lastSignals = Array.from({ length: 10 }, (_, i) => {
    const s = (seed + i * 17) % 10;
    return s < winRate / 10 ? 'win' : 'loss';
  });
  const avgPnl = (winRate - 50) * 1.8 + (seed % 5) - 2;
  const bestTrade = 20 + seed % 60;
  const worstTrade = -(10 + seed % 25);
  return { winRate, lastSignals, avgPnl, bestTrade, worstTrade };
}

export default function SignalDetailModal({ signal, open, onOpenChange }: SignalDetailModalProps) {
  const { prices, riskSettings } = useTradingStore(
    useShallow((s) => ({ prices: s.prices, riskSettings: s.riskSettings }))
  );
  const addTrade = useTradingStore((s) => s.addTrade);
  const addPriceAlert = useTradingStore((s) => s.addPriceAlert);
  const addNotification = useTradingStore((s) => s.addNotification);

  const isBuy = signal?.direction === 'BUY';
  const isSell = signal?.direction === 'SELL';
  const isHold = signal?.direction === 'HOLD';

  const strategyInfo = signal ? STRATEGIES[signal.strategy] : null;
  const symbolInfo = signal ? SYMBOL_INFO[signal.symbol] : null;

  const strategyAnalysis = useMemo(() => {
    if (!signal) return [];
    return (Object.keys(STRATEGIES) as StrategyName[]).map((strat) => {
      const stratSignal = getStrategySignalForSymbol(strat, signal.symbol, signal.direction);
      const stratConfidence = getStrategyConfidence(strat, signal.symbol);
      const agrees =
        (signal.direction === 'BUY' && stratSignal === 'bullish') ||
        (signal.direction === 'SELL' && stratSignal === 'bearish') ||
        signal.direction === 'HOLD';
      return {
        name: STRATEGIES[strat].label,
        key: strat,
        signal: stratSignal,
        confidence: stratConfidence,
        agrees,
        isMain: strat === signal.strategy,
      };
    });
  }, [signal]);

  const indicators = useMemo(() => {
    if (!signal) return [];
    return generateIndicatorsForSignal(signal);
  }, [signal]);

  const agreeCount = useMemo(
    () => indicators.filter((ind) => {
      if (isBuy) return ind.signal === 'bullish';
      if (isSell) return ind.signal === 'bearish';
      return true;
    }).length,
    [indicators, isBuy, isSell]
  );

  const historical = useMemo(() => {
    if (!signal) return null;
    return generateHistoricalAccuracy(signal);
  }, [signal]);

  const handleExecuteTrade = useCallback(() => {
    if (!signal || isHold) return;
    const currentPrice = prices[signal.symbol];
    const entryPrice = currentPrice
      ? isBuy ? currentPrice.ask : currentPrice.bid
      : signal.entryPrice;

    const sl = signal.stopLoss ?? entryPrice - (isBuy ? 1 : -1) * riskSettings.stopLossPips * symbolInfo!.pipSize;
    const tp = signal.takeProfit ?? entryPrice + (isBuy ? 1 : -1) * riskSettings.takeProfitPips * symbolInfo!.pipSize;

    addTrade({
      id: `trade-${Date.now()}`,
      symbol: signal.symbol,
      direction: signal.direction as TradeDirection,
      lotSize: riskSettings.riskPerTrade > 0
        ? Math.max(BROKER_CONFIG.minLotSize, Math.min(BROKER_CONFIG.maxLotSize, 0.01))
        : 0.01,
      entryPrice,
      currentPrice: entryPrice,
      stopLoss: sl,
      takeProfit: tp,
      trailingStop: undefined,
      isTrailingStop: false,
      pips: 0,
      profit: 0,
      commission: BROKER_CONFIG.commission,
      spread: currentPrice?.spread ?? 0,
      swap: 0,
      status: 'open',
      strategy: STRATEGIES[signal.strategy]?.label,
      aiConfidence: signal.confidence,
      marketCondition: signal.marketCondition,
      openedAt: new Date().toISOString(),
    });
    addNotification({
      type: 'success',
      title: 'Trade Executed',
      message: `${signal.direction} ${SYMBOL_INFO[signal.symbol].name} @ ${entryPrice.toFixed(symbolInfo?.digits ?? 5)}`,
    });
    onOpenChange(false);
  }, [signal, prices, riskSettings, isHold, isBuy, symbolInfo, addTrade, addNotification, onOpenChange]);

  const handleCopySignal = useCallback(() => {
    if (!signal) return;
    const text = [
      `📊 ${SYMBOL_INFO[signal.symbol].name} - ${signal.direction}`,
      `Strategy: ${STRATEGIES[signal.strategy]?.label}`,
      `Confidence: ${signal.confidence}%`,
      `Entry: ${signal.entryPrice.toFixed(symbolInfo?.digits ?? 5)}`,
      signal.stopLoss ? `SL: ${signal.stopLoss.toFixed(symbolInfo?.digits ?? 5)}` : null,
      signal.takeProfit ? `TP: ${signal.takeProfit.toFixed(symbolInfo?.digits ?? 5)}` : null,
      signal.riskReward ? `R:R: 1:${signal.riskReward.toFixed(1)}` : null,
      `Market: ${signal.marketCondition}`,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      addNotification({ type: 'info', title: 'Copied', message: 'Signal details copied to clipboard' });
    });
  }, [signal, symbolInfo, addNotification]);

  const handleSetAlert = useCallback(() => {
    if (!signal) return;
    addPriceAlert({
      symbol: signal.symbol,
      condition: isBuy ? 'above' : 'below',
      price: signal.entryPrice,
      isActive: true,
      message: `${signal.direction} ${SYMBOL_INFO[signal.symbol].name} @ ${signal.entryPrice.toFixed(symbolInfo?.digits ?? 5)} (${STRATEGIES[signal.strategy]?.label})`,
    });
    addNotification({ type: 'success', title: 'Alert Set', message: `Price alert created at ${signal.entryPrice.toFixed(symbolInfo?.digits ?? 5)}` });
  }, [signal, isBuy, symbolInfo, addPriceAlert, addNotification]);

  if (!signal || !strategyInfo || !symbolInfo) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[520px] p-0 overflow-hidden">
          <div className="p-6 text-center text-muted-foreground">No signal selected</div>
        </DialogContent>
      </Dialog>
    );
  }

  const rrRatio = signal.riskReward ?? (signal.stopLoss && signal.takeProfit
    ? Math.abs(signal.takeProfit - signal.entryPrice) / Math.abs(signal.entryPrice - signal.stopLoss)
    : riskSettings.riskRewardRatio);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] p-0 overflow-hidden gap-0" showCloseButton={false}>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="glass-card rounded-lg overflow-hidden"
        >
          {/* Gradient Header Bar */}
          <div
            className={`h-1.5 ${
              isBuy
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                : isSell
                  ? 'bg-gradient-to-r from-red-500 to-orange-500'
                  : 'bg-gradient-to-r from-slate-500 to-slate-400'
            }`}
          />

          <ScrollArea className="max-h-[85vh]">
            <div className="p-5 space-y-5">
              {/* Dialog Header */}
              <DialogHeader className="space-y-2 text-left p-0">
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    Signal Detail
                  </DialogTitle>
                </div>
                <DialogDescription className="sr-only">
                  Detailed breakdown of the trading signal for {SYMBOL_INFO[signal.symbol].name}
                </DialogDescription>
              </DialogHeader>

              {/* ===== 1. SIGNAL BREAKDOWN PANEL ===== */}
              <section className="space-y-3">
                <div className="flex items-center gap-3">
                  {/* Symbol Badge + Direction + Confidence Ring */}
                  <ConfidenceRing confidence={signal.confidence} size={72} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={`font-bold text-xs px-2.5 py-0.5 ${
                          isBuy
                            ? 'border-emerald-500/50 text-emerald-500 badge-pulse'
                            : isSell
                              ? 'border-red-500/50 text-red-500 badge-pulse'
                              : 'border-slate-500/50 text-slate-400'
                        }`}
                      >
                        {SYMBOL_INFO[signal.symbol].name}
                      </Badge>
                      <Badge
                        className={`text-xs font-bold px-2.5 py-0.5 ${
                          isBuy
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : isSell
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        }`}
                        variant="secondary"
                      >
                        {isBuy && <ArrowUpRight className="h-3 w-3 mr-0.5" />}
                        {isSell && <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                        {!isBuy && !isSell && <Activity className="h-3 w-3 mr-0.5" />}
                        {signal.direction}
                      </Badge>
                    </div>
                    {/* Strategy name + description */}
                    <div className="text-sm font-semibold">{strategyInfo.label}</div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {strategyInfo.description}
                    </div>
                  </div>
                </div>

                {/* Entry / SL / TP with R:R visualization */}
                <div className="rounded-lg bg-accent/50 border border-border p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Entry</div>
                      <div className="text-sm font-bold tabular-nums">{signal.entryPrice.toFixed(symbolInfo.digits)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-red-400 mb-0.5">Stop Loss</div>
                      <div className="text-sm font-bold tabular-nums text-red-400">
                        {signal.stopLoss ? signal.stopLoss.toFixed(symbolInfo.digits) : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-emerald-400 mb-0.5">Take Profit</div>
                      <div className="text-sm font-bold tabular-nums text-emerald-400">
                        {signal.takeProfit ? signal.takeProfit.toFixed(symbolInfo.digits) : '—'}
                      </div>
                    </div>
                  </div>

                  {/* R:R Ratio Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Risk : Reward</span>
                      <span className={`font-bold tabular-nums ${rrRatio >= 1.5 ? 'text-emerald-400' : rrRatio >= 1 ? 'text-amber-400' : 'text-red-400'}`}>
                        1 : {rrRatio.toFixed(1)}
                      </span>
                    </div>
                    <div className="relative h-2 bg-accent rounded-full overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full bg-red-500/60 rounded-l-full"
                        style={{ width: `${(1 / (1 + rrRatio)) * 100}%` }}
                      />
                      <div
                        className={`absolute top-0 h-full rounded-r-full ${rrRatio >= 1.5 ? 'bg-emerald-500' : rrRatio >= 1 ? 'bg-emerald-500/70' : 'bg-emerald-500/50'}`}
                        style={{ left: `${(1 / (1 + rrRatio)) * 100}%`, width: `${(rrRatio / (1 + rrRatio)) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>SL</span>
                      <span>Entry</span>
                      <span>TP</span>
                    </div>
                  </div>

                  {/* Timeframe + Expiration */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Timeframe: {strategyInfo.timeframe}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(signal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </section>

              <Separator className="opacity-50" />

              {/* ===== 2. STRATEGY ANALYSIS SECTION ===== */}
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Strategy Analysis
                  </h3>
                  <div className="flex-1" />
                  <Badge variant="outline" className="text-[10px]">
                    {strategyAnalysis.filter((s) => s.agrees).length}/{strategyAnalysis.length} agree
                  </Badge>
                </div>

                <div className="space-y-1">
                  {strategyAnalysis.map((strat) => {
                    const signalColor =
                      strat.signal === 'bullish'
                        ? 'text-emerald-400'
                        : strat.signal === 'bearish'
                          ? 'text-red-400'
                          : 'text-slate-400';
                    const SignalIcon =
                      strat.signal === 'bullish'
                        ? TrendingUp
                        : strat.signal === 'bearish'
                          ? TrendingDown
                          : Minus;
                    return (
                      <div
                        key={strat.key}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] transition-colors ${
                          strat.isMain
                            ? isBuy
                              ? 'bg-emerald-500/10 border border-emerald-500/20'
                              : isSell
                                ? 'bg-red-500/10 border border-red-500/20'
                                : 'bg-accent border border-border'
                            : strat.agrees
                              ? 'hover:bg-emerald-500/5'
                              : 'hover:bg-red-500/5'
                        }`}
                      >
                        <SignalIcon className={`h-3 w-3 flex-shrink-0 ${signalColor}`} />
                        <span className={`flex-1 truncate ${strat.isMain ? 'font-semibold' : 'font-medium'}`}>
                          {strat.name}
                        </span>
                        {/* Mini confidence bar */}
                        <div className="w-16 h-1.5 bg-accent rounded-full overflow-hidden flex-shrink-0">
                          <div
                            className={`h-full rounded-full transition-all ${
                              strat.signal === 'bullish'
                                ? 'bg-emerald-500'
                                : strat.signal === 'bearish'
                                  ? 'bg-red-500'
                                  : 'bg-slate-500'
                            }`}
                            style={{ width: `${strat.confidence}%` }}
                          />
                        </div>
                        {/* Agree/Disagree indicator */}
                        {strat.agrees ? (
                          <Check className={`h-3.5 w-3.5 flex-shrink-0 ${strat.signal === 'neutral' ? 'text-slate-400' : 'text-emerald-400'}`} />
                        ) : (
                          <X className="h-3.5 w-3.5 flex-shrink-0 text-red-400" />
                        )}
                        {strat.isMain && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 border-primary/30 text-primary">
                            ACTIVE
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <Separator className="opacity-50" />

              {/* ===== 3. INDICATOR ALIGNMENT ===== */}
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Indicator Alignment
                  </h3>
                </div>

                {/* Summary bar */}
                <div className="flex items-center gap-2 px-2.5">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {agreeCount} of {indicators.length} indicators agree
                  </span>
                  <div className="flex-1 h-1.5 bg-accent rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full animate-progress ${
                        agreeCount / indicators.length >= 0.6
                          ? 'bg-emerald-500'
                          : agreeCount / indicators.length >= 0.4
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${(agreeCount / indicators.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium tabular-nums">
                    {Math.round((agreeCount / indicators.length) * 100)}%
                  </span>
                </div>

                {/* Indicator list */}
                <div className="space-y-0.5">
                  {indicators.map((ind) => {
                    const indAgrees =
                      (isBuy && ind.signal === 'bullish') ||
                      (isSell && ind.signal === 'bearish');
                    return (
                      <div
                        key={ind.name}
                        className={`flex items-center gap-2 px-2.5 py-1 rounded text-[11px] ${
                          indAgrees
                            ? isBuy
                              ? 'bg-emerald-500/5'
                              : 'bg-red-500/5'
                            : ''
                        }`}
                      >
                        <span className="w-28 truncate text-muted-foreground">{ind.name}</span>
                        <span className="flex-1 tabular-nums font-medium">
                          {typeof ind.value === 'number' && ind.value < 1
                            ? ind.value.toFixed(4)
                            : typeof ind.value === 'number' && ind.value < 100
                              ? ind.value.toFixed(2)
                              : typeof ind.value === 'number'
                                ? ind.value.toFixed(0)
                                : String(ind.value)}
                        </span>
                        {/* Mini bar */}
                        <div className="w-12 h-1 bg-accent rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              ind.signal === 'bullish'
                                ? 'bg-emerald-500'
                                : ind.signal === 'bearish'
                                  ? 'bg-red-500'
                                  : 'bg-slate-500'
                            }`}
                            style={{
                              width: ind.signal === 'neutral' ? '30%' : '80%',
                            }}
                          />
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 min-w-[40px] justify-center ${
                            ind.signal === 'bullish'
                              ? 'border-emerald-500/30 text-emerald-400'
                              : ind.signal === 'bearish'
                                ? 'border-red-500/30 text-red-400'
                                : 'border-slate-500/30 text-slate-400'
                          }`}
                        >
                          {ind.signal === 'bullish'
                            ? 'BUY'
                            : ind.signal === 'bearish'
                              ? 'SELL'
                              : 'NEUT'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </section>

              <Separator className="opacity-50" />

              {/* ===== 4. HISTORICAL ACCURACY WIDGET ===== */}
              {historical && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Award className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Historical Accuracy
                    </h3>
                    <div className="flex-1" />
                    <span className={`text-xs font-bold tabular-nums ${
                      historical.winRate >= 70
                        ? 'text-emerald-400'
                        : historical.winRate >= 55
                          ? 'text-amber-400'
                          : 'text-red-400'
                    }`}>
                      {historical.winRate}%
                    </span>
                  </div>

                  <div className="rounded-lg bg-accent/50 border border-border p-3 space-y-3">
                    {/* Win Rate bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Win Rate ({strategyInfo.label} × {SYMBOL_INFO[signal.symbol].name})</span>
                      </div>
                      <div className="h-2 bg-accent rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full animate-progress ${
                            historical.winRate >= 70
                              ? 'bg-emerald-500'
                              : historical.winRate >= 55
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${historical.winRate}%` }}
                        />
                      </div>
                    </div>

                    {/* Last 10 signals dots */}
                    <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground">Last 10 Signals</div>
                      <div className="flex items-center gap-1.5">
                        {historical.lastSignals.map((result, i) => (
                          <div
                            key={i}
                            className={`w-4 h-4 rounded-full flex items-center justify-center ${
                              result === 'win'
                                ? 'bg-emerald-500/20 border border-emerald-500/40'
                                : 'bg-red-500/20 border border-red-500/40'
                            }`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                result === 'win' ? 'bg-emerald-400' : 'bg-red-400'
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-[10px] text-muted-foreground mb-0.5">Avg P&L / Signal</div>
                        <div
                          className={`text-xs font-bold tabular-nums ${
                            historical.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {historical.avgPnl >= 0 ? '+' : ''}${historical.avgPnl.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-muted-foreground mb-0.5">Best Trade</div>
                        <div className="text-xs font-bold tabular-nums text-emerald-400">
                          +${historical.bestTrade.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-muted-foreground mb-0.5">Worst Trade</div>
                        <div className="text-xs font-bold tabular-nums text-red-400">
                          {historical.worstTrade.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <Separator className="opacity-50" />

              {/* ===== 5. ACTION BUTTONS ===== */}
              <section className="space-y-2">
                {!isHold ? (
                  <Button
                    onClick={handleExecuteTrade}
                    className={`w-full scale-click font-semibold ${
                      isBuy
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    <Target className="h-4 w-4" />
                    Execute {signal.direction} Trade
                  </Button>
                ) : (
                  <Button className="w-full" variant="secondary" disabled>
                    <Activity className="h-4 w-4" />
                    HOLD — No Action
                  </Button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopySignal}
                    className="scale-click"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy Signal
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSetAlert}
                    className="scale-click"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    Set Alert
                  </Button>
                </div>
              </section>
            </div>
          </ScrollArea>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

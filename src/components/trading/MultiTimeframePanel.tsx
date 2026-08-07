'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, type Symbol } from '@/lib/types';

import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, Layers, ArrowUpCircle, ArrowDownCircle,
  MinusCircle, AlertTriangle, CheckCircle2, Zap, BarChart3
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TrendDirection = 'bullish' | 'bearish' | 'neutral';

interface TimeframeData {
  label: string;
  key: string;
  trend: TrendDirection;
  strength: number;       // 0-100
  support: number;
  resistance: number;
  rsi: number;
  macdSignal: string;      // 'bullish' | 'bearish' | 'neutral'
  emaBias: string;         // 'bullish' | 'bearish' | 'neutral'
}

interface SymbolMTF {
  symbol: Symbol;
  timeframes: TimeframeData[];
  consensus: TrendDirection;
  consensusStrength: number;  // 0-100
  alignmentCount: number;    // how many TFs agree
  isAligned: boolean;         // all 4 TFs agree
  updatedAt: number;
}

// ─── Timeframe keys ──────────────────────────────────────────────────────────

const TIMEFRAMES = [
  { label: 'M5', key: 'M5', weight: 1 },
  { label: 'M15', key: 'M15', weight: 1.5 },
  { label: 'H1', key: 'H1', weight: 2 },
  { label: 'H4', key: 'H4', weight: 3 },
] as const;

// ─── Base price anchors per symbol for realistic level generation ─────────────

const BASE_PRICES: Record<Symbol, number> = {
  EURUSD: 1.0870,
  USDJPY: 149.80,
  GBPUSD: 1.2680,
  XAUUSD: 2035.0,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jitter(prev: number, range: number): number {
  return prev + (Math.random() - 0.5) * range;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function trendToIcon(trend: TrendDirection) {
  switch (trend) {
    case 'bullish':  return <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-400" />;
    case 'bearish':  return <ArrowDownCircle className="h-3.5 w-3.5 text-red-400" />;
    case 'neutral':  return <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function trendColor(trend: TrendDirection): string {
  switch (trend) {
    case 'bullish':  return 'text-emerald-400';
    case 'bearish':  return 'text-red-400';
    case 'neutral':  return 'text-muted-foreground';
  }
}

function trendBg(trend: TrendDirection): string {
  switch (trend) {
    case 'bullish':  return 'bg-emerald-500/15 border-emerald-500/20';
    case 'bearish':  return 'bg-red-500/15 border-red-500/20';
    case 'neutral':  return 'bg-slate-500/10 border-slate-500/20';
  }
}

function strengthBarColor(trend: TrendDirection, strength: number): string {
  if (trend === 'bullish') {
    return strength > 70 ? 'bg-emerald-400' : strength > 40 ? 'bg-emerald-500' : 'bg-emerald-600';
  }
  if (trend === 'bearish') {
    return strength > 70 ? 'bg-red-400' : strength > 40 ? 'bg-red-500' : 'bg-red-600';
  }
  return 'bg-slate-500';
}

function formatLevel(price: number, symbol: Symbol): string {
  const digits = SYMBOL_INFO[symbol].digits;
  return price.toFixed(digits);
}

// ─── Data generation ─────────────────────────────────────────────────────────

function generateTimeframeData(
  symbol: Symbol,
  tfKey: string,
  prev?: TimeframeData,
  priceShift?: number,
): TimeframeData {
  const base = BASE_PRICES[symbol] + (priceShift ?? 0);
  const jitterScale = tfKey === 'M5' ? 1.0 : tfKey === 'M15' ? 1.5 : tfKey === 'H1' ? 2.0 : 3.0;
  const levelRange = base * 0.001 * jitterScale;

  const strength = prev ? clamp(jitter(prev.strength, 12), 5, 95) : 30 + Math.random() * 50;

  // Trend direction - tends to persist but can flip
  let trend: TrendDirection;
  if (prev) {
    const flipChance = tfKey === 'M5' ? 0.2 : tfKey === 'M15' ? 0.12 : tfKey === 'H1' ? 0.06 : 0.03;
    if (Math.random() < flipChance) {
      const options: TrendDirection[] = ['bullish', 'bearish', 'neutral'];
      trend = options[Math.floor(Math.random() * options.length)];
    } else {
      trend = prev.trend;
    }
  } else {
    const r = Math.random();
    trend = r < 0.4 ? 'bullish' : r < 0.8 ? 'bearish' : 'neutral';
  }

  const support = prev
    ? clamp(jitter(prev.support, levelRange * 0.3), base - levelRange * 3, base + levelRange * 3)
    : base - levelRange * (0.5 + Math.random() * 1.5);

  const resistance = prev
    ? clamp(jitter(prev.resistance, levelRange * 0.3), base - levelRange * 3, base + levelRange * 3)
    : base + levelRange * (0.5 + Math.random() * 1.5);

  const rsi = prev ? clamp(jitter(prev.rsi, 5), 10, 90) : 30 + Math.random() * 40;
  const macdSignal = rsi > 58 ? 'bullish' : rsi < 42 ? 'bearish' : 'neutral';
  const emaBias = trend === 'neutral' ? 'neutral' : trend;

  return {
    label: tfKey,
    key: tfKey,
    trend,
    strength,
    support,
    resistance,
    rsi,
    macdSignal,
    emaBias,
  };
}

function generateSymbolMTF(
  symbol: Symbol,
  prev?: SymbolMTF,
  priceShift?: number,
): SymbolMTF {
  const prevTimeframes = prev?.timeframes;
  const timeframes = TIMEFRAMES.map((tf) => {
    const prevTf = prevTimeframes?.find((t) => t.key === tf.key);
    return generateTimeframeData(symbol, tf.key, prevTf, priceShift);
  });

  // Calculate consensus using weighted scoring
  let bullishScore = 0;
  let bearishScore = 0;
  let neutralScore = 0;

  TIMEFRAMES.forEach((tf, i) => {
    const data = timeframes[i];
    const w = tf.weight;
    if (data.trend === 'bullish') bullishScore += w * data.strength;
    else if (data.trend === 'bearish') bearishScore += w * data.strength;
    else neutralScore += w * data.strength;
  });

  const totalScore = bullishScore + bearishScore + neutralScore || 1;
  const bullishPct = (bullishScore / totalScore) * 100;
  const bearishPct = (bearishScore / totalScore) * 100;
  const neutralPct = (neutralScore / totalScore) * 100;

  let consensus: TrendDirection;
  let consensusStrength: number;
  if (bullishPct > bearishPct && bullishPct > neutralPct) {
    consensus = 'bullish';
    consensusStrength = bullishPct;
  } else if (bearishPct > bullishPct && bearishPct > neutralPct) {
    consensus = 'bearish';
    consensusStrength = bearishPct;
  } else {
    consensus = 'neutral';
    consensusStrength = neutralPct;
  }

  // Alignment: count how many timeframes share the dominant direction
  const dominant = consensus;
  const alignmentCount = timeframes.filter((t) => t.trend === dominant).length;
  const isAligned = alignmentCount >= 3;

  return {
    symbol,
    timeframes,
    consensus,
    consensusStrength,
    alignmentCount,
    isAligned,
    updatedAt: Date.now(),
  };
}

function generateAllMTF(prevMap?: Record<Symbol, SymbolMTF>): Record<Symbol, SymbolMTF> {
  const result = {} as Record<Symbol, SymbolMTF>;
  for (const sym of SYMBOLS) {
    result[sym] = generateSymbolMTF(sym, prevMap?.[sym]);
  }
  return result;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TimeframeCell({ data, symbol }: { data: TimeframeData; symbol: Symbol }) {
  return (
    <motion.div
      className={`relative rounded-lg border p-2.5 transition-colors ${trendBg(data.trend)}`}
      whileHover={{ scale: 1.03, y: -1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Timeframe Label */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">
          {data.label}
        </span>
        <div className="flex items-center gap-1">
          {trendToIcon(data.trend)}
          <span className={`text-[10px] font-semibold tabular-nums ${trendColor(data.trend)}`}>
            {data.trend === 'bullish' ? 'BUY' : data.trend === 'bearish' ? 'SELL' : 'WAIT'}
          </span>
        </div>
      </div>

      {/* Strength Bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[9px] text-muted-foreground">Strength</span>
          <span className="text-[10px] tabular-nums font-medium text-foreground/80">
            {data.strength.toFixed(0)}%
          </span>
        </div>
        <div className="h-1 bg-muted/60 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${strengthBarColor(data.trend, data.strength)}`}
            initial={false}
            animate={{ width: `${data.strength}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* RSI mini indicator */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] text-muted-foreground">RSI</span>
        <span className={`text-[10px] tabular-nums font-medium ${
          data.rsi > 65 ? 'text-emerald-400' : data.rsi < 35 ? 'text-red-400' : 'text-muted-foreground'
        }`}>
          {data.rsi.toFixed(1)}
        </span>
      </div>

      {/* Key Levels */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
            <span className="text-[9px] text-muted-foreground">Res</span>
          </div>
          <span className="text-[10px] tabular-nums font-medium text-emerald-400/90">
            {formatLevel(data.resistance, symbol)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500/70" />
            <span className="text-[9px] text-muted-foreground">Sup</span>
          </div>
          <span className="text-[10px] tabular-nums font-medium text-red-400/90">
            {formatLevel(data.support, symbol)}
          </span>
        </div>
      </div>

      {/* MACD & EMA micro labels */}
      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border/20">
        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
          data.macdSignal === 'bullish'
            ? 'bg-emerald-500/15 text-emerald-400'
            : data.macdSignal === 'bearish'
            ? 'bg-red-500/15 text-red-400'
            : 'bg-slate-500/15 text-muted-foreground'
        }`}>
          MACD {data.macdSignal}
        </span>
        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
          data.emaBias === 'bullish'
            ? 'bg-emerald-500/15 text-emerald-400'
            : data.emaBias === 'bearish'
            ? 'bg-red-500/15 text-red-400'
            : 'bg-slate-500/15 text-muted-foreground'
        }`}>
          EMA {data.emaBias}
        </span>
      </div>
    </motion.div>
  );
}

function ConsensusRow({ mtfData }: { mtfData: SymbolMTF }) {
  const { consensus, consensusStrength, alignmentCount, isAligned } = mtfData;

  const consensusLabel =
    consensus === 'bullish' ? 'BULLISH' : consensus === 'bearish' ? 'BEARISH' : 'MIXED';

  const consensusIcon =
    consensus === 'bullish'
      ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
      : consensus === 'bearish'
      ? <TrendingDown className="h-3.5 w-3.5 text-red-400" />
      : <Minus className="h-3.5 w-3.5 text-muted-foreground" />;

  return (
    <motion.div
      className="mt-2.5 p-2 rounded-lg bg-muted/40 border border-border/30"
      initial={false}
      animate={{ opacity: 1 }}
    >
      <div className="flex items-center justify-between mb-1.5">
        {/* Consensus label */}
        <div className="flex items-center gap-1.5">
          {consensusIcon}
          <span className={`text-[10px] font-bold uppercase tracking-wider ${trendColor(consensus)}`}>
            {consensusLabel}
          </span>
        </div>

        {/* Consensus percentage */}
        <span className="text-[11px] font-bold tabular-nums gradient-text-emerald">
          {consensusStrength.toFixed(1)}%
        </span>
      </div>

      {/* Consensus bar */}
      <div className="h-1 bg-muted/60 rounded-full overflow-hidden mb-1.5">
        <motion.div
          className={`h-full rounded-full ${
            consensus === 'bullish' ? 'bg-emerald-500' : consensus === 'bearish' ? 'bg-red-500' : 'bg-slate-500'
          }`}
          initial={false}
          animate={{ width: `${consensusStrength}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ opacity: 0.7 }}
        />
      </div>

      {/* Alignment indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {isAligned ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          ) : alignmentCount >= 2 ? (
            <AlertTriangle className="h-3 w-3 text-amber-400" />
          ) : (
            <AlertTriangle className="h-3 w-3 text-red-400" />
          )}
          <span className={`text-[9px] font-medium ${
            isAligned ? 'text-emerald-400' : alignmentCount >= 2 ? 'text-amber-400' : 'text-red-400'
          }`}>
            {isAligned ? 'Strong Signal' : alignmentCount >= 2 ? 'Moderate Signal' : 'Weak Signal'}
          </span>
        </div>
        <span className="text-[9px] text-muted-foreground tabular-nums">
          {alignmentCount}/4 TFs aligned
        </span>
      </div>
    </motion.div>
  );
}

function AlignmentVisualization({ mtfData }: { mtfData: SymbolMTF }) {
  return (
    <div className="flex items-center gap-1 mt-1.5">
      {mtfData.timeframes.map((tf) => (
        <motion.div
          key={tf.key}
          className={`h-2 flex-1 rounded-full ${
            tf.trend === 'bullish'
              ? 'bg-emerald-500'
              : tf.trend === 'bearish'
              ? 'bg-red-500'
              : 'bg-slate-500'
          }`}
          initial={false}
          animate={{
            backgroundColor:
              tf.trend === 'bullish'
                ? '#10b981'
                : tf.trend === 'bearish'
                ? '#ef4444'
                : '#64748b',
          }}
          transition={{ duration: 0.4 }}
          style={{ opacity: 0.7 }}
          title={`${tf.label}: ${tf.trend} (${tf.strength.toFixed(0)}%)`}
        />
      ))}
      <span className="text-[8px] text-muted-foreground ml-1 flex-shrink-0">
        {mtfData.isAligned ? (
          <Zap className="h-2.5 w-2.5 text-emerald-400" />
        ) : (
          <BarChart3 className="h-2.5 w-2.5 text-muted-foreground" />
        )}
      </span>
    </div>
  );
}

function SymbolCard({ mtfData }: { mtfData: SymbolMTF }) {
  const info = SYMBOL_INFO[mtfData.symbol];
  const price = useTradingStore((s) => s.prices[mtfData.symbol]);

  return (
    <motion.div
      className="glass-card-premium card-hover-lift rounded-xl p-3.5 flex flex-col"
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-cyan-400" />
          <div>
            <div className="text-xs font-semibold text-foreground">{info.name}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{info.category}</div>
          </div>
        </div>
        {price && (
          <div className="text-right">
            <div className="text-[11px] font-semibold tabular-nums text-foreground">
              {price.bid.toFixed(info.digits)}
            </div>
            <div className={`text-[10px] tabular-nums font-medium ${
              price.change >= 0 ? 'neon-text-emerald' : 'neon-text-red'
            }`}>
              {price.change >= 0 ? '+' : ''}{price.changePercent.toFixed(2)}%
            </div>
          </div>
        )}
      </div>

      {/* Timeframe Grid - 2x2 */}
      <div className="grid grid-cols-2 gap-2">
        {mtfData.timeframes.map((tf) => (
          <TimeframeCell key={tf.key} data={tf} symbol={mtfData.symbol} />
        ))}
      </div>

      {/* Alignment visualization */}
      <AlignmentVisualization mtfData={mtfData} />

      {/* Consensus row */}
      <ConsensusRow mtfData={mtfData} />
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MultiTimeframePanel() {
  const [mtfDataMap, setMtfDataMap] = useState<Record<Symbol, SymbolMTF>>(() =>
    generateAllMTF(),
  );

  const updateData = useCallback(() => {
    setMtfDataMap((prev) => generateAllMTF(prev));
  }, []);

  useEffect(() => {
    const interval = setInterval(updateData, 5000);
    return () => clearInterval(interval);
  }, [updateData]);

  return (
    <div className="glass-card-premium rounded-xl card-hover-lift">
      <div className="flex items-center gap-2 mb-3 pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-semibold section-title-accent">Multi-Timeframe Analysis</span>
            <span className="badge-glow-emerald text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
              LIVE
            </span>
          </div>
          <div className="flex items-center gap-2">
            {TIMEFRAMES.map((tf) => (
              <span
                key={tf.key}
                className="text-[9px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-medium tabular-nums"
              >
                {tf.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {SYMBOLS.map((sym) => (
            <SymbolCard key={sym} mtfData={mtfDataMap[sym]} />
          ))}
        </div>
      </div>
    </div>
  );
}

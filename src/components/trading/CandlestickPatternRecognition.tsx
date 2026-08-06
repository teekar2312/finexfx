'use client';

import { useMemo } from 'react';
import type { PriceHistory } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CandlestickChart,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Target,
  Eye,
  Star,
  Flame,
  Crosshair,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DetectedPattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral';
  reliability: 'Low' | 'Medium' | 'High';
  description: string;
  startIndex: number;
  endIndex: number;
}

// ─── Mock Data Generator ─────────────────────────────────────────────────────

function generateMockCandles(): PriceHistory[] {
  const baseTime = Date.now() - 30 * 60 * 60 * 1000; // 30 hours ago
  const candles: PriceHistory[] = [];

  // Intentionally crafted EURUSD candles forming recognizable patterns
  // Price range around 1.0850 - 1.0950

  // Candles 0-2: Small random moves
  candles.push({ time: baseTime, open: 1.0870, high: 1.0878, low: 1.0865, close: 1.0874, volume: 1450 });
  candles.push({ time: baseTime + 3600000, open: 1.0874, high: 1.0882, low: 1.0868, close: 1.0870, volume: 1320 });
  candles.push({ time: baseTime + 7200000, open: 1.0870, high: 1.0880, low: 1.0862, close: 1.0865, volume: 1580 });

  // Candle 3: Small red body (pre-bullish engulfing)
  candles.push({ time: baseTime + 10800000, open: 1.0865, high: 1.0870, low: 1.0855, close: 1.0858, volume: 1200 });

  // Candle 4: Large green body engulfing candle 3 → Bullish Engulfing
  candles.push({ time: baseTime + 14400000, open: 1.0855, high: 1.0880, low: 1.0852, close: 1.0878, volume: 2100 });

  // Candle 5-6: Small moves
  candles.push({ time: baseTime + 18000000, open: 1.0878, high: 1.0885, low: 1.0872, close: 1.0880, volume: 1400 });
  candles.push({ time: baseTime + 21600000, open: 1.0880, high: 1.0888, low: 1.0874, close: 1.0876, volume: 1100 });

  // Candle 7: Spinning Top (small body, equal wicks)
  candles.push({ time: baseTime + 25200000, open: 1.0876, high: 1.0892, low: 1.0860, close: 1.0878, volume: 1350 });

  // Candles 8-10: Morning Star pattern
  // Candle 8: Large red (downtrend continuation)
  candles.push({ time: baseTime + 28800000, open: 1.0878, high: 1.0882, low: 1.0858, close: 1.0860, volume: 1800 });
  // Candle 9: Small body (star/hesitation)
  candles.push({ time: baseTime + 32400000, open: 1.0860, high: 1.0868, low: 1.0856, close: 1.0864, volume: 900 });
  // Candle 10: Large green (reversal confirmation)
  candles.push({ time: baseTime + 36000000, open: 1.0866, high: 1.0892, low: 1.0864, close: 1.0888, volume: 2200 });

  // Candle 11: Uptrend continuation
  candles.push({ time: baseTime + 39600000, open: 1.0888, high: 1.0900, low: 1.0884, close: 1.0896, volume: 1600 });

  // Candle 12: Doji (open ≈ close)
  candles.push({ time: baseTime + 43200000, open: 1.0896, high: 1.0908, low: 1.0886, close: 1.0897, volume: 1050 });

  // Candles 13-14: Small green then big red → Bearish Engulfing
  candles.push({ time: baseTime + 46800000, open: 1.0897, high: 1.0906, low: 1.0892, close: 1.0904, volume: 1250 });
  candles.push({ time: baseTime + 50400000, open: 1.0908, high: 1.0912, low: 1.0882, close: 1.0884, volume: 2050 });

  // Candle 15-16: Downtrend continuation
  candles.push({ time: baseTime + 54000000, open: 1.0884, high: 1.0890, low: 1.0872, close: 1.0876, volume: 1550 });
  candles.push({ time: baseTime + 57600000, open: 1.0876, high: 1.0880, low: 1.0860, close: 1.0864, volume: 1700 });

  // Candle 17: Hammer (small body at top, long lower wick)
  candles.push({ time: baseTime + 61200000, open: 1.0864, high: 1.0872, low: 1.0842, close: 1.0868, volume: 1450 });

  // Candle 18: Recovery
  candles.push({ time: baseTime + 64800000, open: 1.0868, high: 1.0886, low: 1.0864, close: 1.0882, volume: 1650 });

  // Candles 19-21: Evening Star pattern
  // Candle 19: Large green (uptrend)
  candles.push({ time: baseTime + 68400000, open: 1.0882, high: 1.0910, low: 1.0878, close: 1.0906, volume: 1900 });
  // Candle 20: Small body (star/hesitation)
  candles.push({ time: baseTime + 72000000, open: 1.0906, high: 1.0912, low: 1.0902, close: 1.0908, volume: 850 });
  // Candle 21: Large red (reversal)
  candles.push({ time: baseTime + 75600000, open: 1.0904, high: 1.0910, low: 1.0876, close: 1.0878, volume: 2150 });

  // Candle 22: Downtrend
  candles.push({ time: baseTime + 79200000, open: 1.0878, high: 1.0884, low: 1.0864, close: 1.0868, volume: 1400 });

  // Candle 23: Inverted Hammer (small body at bottom, long upper wick)
  candles.push({ time: baseTime + 82800000, open: 1.0868, high: 1.0894, low: 1.0864, close: 1.0870, volume: 1300 });

  // Candle 24-25: Another Spinning Top
  candles.push({ time: baseTime + 86400000, open: 1.0870, high: 1.0888, low: 1.0854, close: 1.0872, volume: 1500 });
  candles.push({ time: baseTime + 90000000, open: 1.0872, high: 1.0884, low: 1.0858, close: 1.0866, volume: 1150 });

  // Candle 26: Doji #2
  candles.push({ time: baseTime + 93600000, open: 1.0866, high: 1.0878, low: 1.0856, close: 1.0867, volume: 980 });

  // Candle 27-28: Bearish Engulfing #2
  candles.push({ time: baseTime + 97200000, open: 1.0867, high: 1.0880, low: 1.0862, close: 1.0876, volume: 1380 });
  candles.push({ time: baseTime + 100800000, open: 1.0882, high: 1.0886, low: 1.0848, close: 1.0852, volume: 1980 });

  return candles;
}

// ─── Pattern Detection ────────────────────────────────────────────────────────

function detectPatterns(candles: PriceHistory[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const bodySize = Math.abs(c.close - c.open);
    const upperWick = c.high - Math.max(c.close, c.open);
    const lowerWick = Math.min(c.close, c.open) - c.low;
    const totalRange = c.high - c.low;

    // ── Doji ──
    if (totalRange > 0 && bodySize / totalRange < 0.15 && totalRange > 0.0004) {
      patterns.push({
        name: 'Doji',
        type: 'neutral',
        reliability: 'Medium',
        description: 'Open and close are nearly equal, indicating market indecision and potential reversal.',
        startIndex: i,
        endIndex: i,
      });
    }
    // ── Hammer ──
    else if (
      totalRange > 0.0006 &&
      lowerWick > bodySize * 2 &&
      upperWick < bodySize * 0.5 &&
      bodySize < totalRange * 0.35
    ) {
      patterns.push({
        name: 'Hammer',
        type: 'bullish',
        reliability: 'High',
        description: 'Small body at top with long lower shadow. Buyers rejected lower prices, signaling potential bullish reversal.',
        startIndex: i,
        endIndex: i,
      });
    }
    // ── Inverted Hammer ──
    else if (
      totalRange > 0.0006 &&
      upperWick > bodySize * 2 &&
      lowerWick < bodySize * 0.5 &&
      bodySize < totalRange * 0.35
    ) {
      patterns.push({
        name: 'Inverted Hammer',
        type: 'bullish',
        reliability: 'Medium',
        description: 'Small body at bottom with long upper shadow. Shows buying pressure despite selling, suggesting reversal potential.',
        startIndex: i,
        endIndex: i,
      });
    }
    // ── Spinning Top ──
    else if (
      totalRange > 0.0008 &&
      bodySize < totalRange * 0.25 &&
      upperWick > bodySize * 1.5 &&
      lowerWick > bodySize * 1.5
    ) {
      patterns.push({
        name: 'Spinning Top',
        type: 'neutral',
        reliability: 'Low',
        description: 'Small body with roughly equal upper and lower wicks. Represents market indecision between buyers and sellers.',
        startIndex: i,
        endIndex: i,
      });
    }

    // ── Bullish Engulfing (2-candle pattern) ──
    if (i >= 1) {
      const prev = candles[i - 1];
      const prevBody = Math.abs(prev.close - prev.open);
      const prevBearish = prev.close < prev.open;
      const currBullish = c.close > c.open;

      if (
        prevBearish &&
        currBullish &&
        bodySize > prevBody * 1.1 &&
        c.open <= prev.close &&
        c.close >= prev.open
      ) {
        patterns.push({
          name: 'Bullish Engulfing',
          type: 'bullish',
          reliability: 'High',
          description: 'A large green candle completely engulfs the previous red candle, signaling strong bullish reversal momentum.',
          startIndex: i - 1,
          endIndex: i,
        });
      }

      // ── Bearish Engulfing (2-candle pattern) ──
      const prevBullish = prev.close > prev.open;
      const currBearish = c.close < c.open;

      if (
        prevBullish &&
        currBearish &&
        bodySize > prevBody * 1.1 &&
        c.open >= prev.close &&
        c.close <= prev.open
      ) {
        patterns.push({
          name: 'Bearish Engulfing',
          type: 'bearish',
          reliability: 'High',
          description: 'A large red candle completely engulfs the previous green candle, indicating strong bearish reversal pressure.',
          startIndex: i - 1,
          endIndex: i,
        });
      }
    }

    // ── Morning Star (3-candle pattern) ──
    if (i >= 2) {
      const c1 = candles[i - 2];
      const c2 = candles[i - 1];
      const prevBody1 = Math.abs(c1.close - c1.open);
      const starBody = Math.abs(c2.close - c2.open);
      const c1Bearish = c1.close < c1.open;

      if (
        c1Bearish &&
        prevBody1 > 0.0008 &&
        starBody < prevBody1 * 0.35 &&
        c.close > c1.open &&
        bodySize > prevBody1 * 0.7 &&
        c.close > c.open
      ) {
        patterns.push({
          name: 'Morning Star',
          type: 'bullish',
          reliability: 'High',
          description: 'Three-candle reversal: large red, small indecision body, large green. Signals transition from downtrend to uptrend.',
          startIndex: i - 2,
          endIndex: i,
        });
      }

      // ── Evening Star (3-candle pattern) ──
      const prevBody = Math.abs(c1.close - c1.open);
      const c1Bullish = c1.close > c1.open;

      if (
        c1Bullish &&
        prevBody > 0.0008 &&
        starBody < prevBody * 0.35 &&
        c.close < c1.open &&
        bodySize > prevBody * 0.7 &&
        c.close < c.open
      ) {
        patterns.push({
          name: 'Evening Star',
          type: 'bearish',
          reliability: 'High',
          description: 'Three-candle reversal: large green, small indecision body, large red. Signals transition from uptrend to downtrend.',
          startIndex: i - 2,
          endIndex: i,
        });
      }
    }
  }

  return patterns;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00`;
}

function reliabilityStars(level: 'Low' | 'Medium' | 'High'): number {
  return level === 'High' ? 3 : level === 'Medium' ? 2 : 1;
}

function patternIcon(name: string) {
  switch (name) {
    case 'Doji':
      return <Minus className="h-3.5 w-3.5" />;
    case 'Hammer':
      return <ArrowUpRight className="h-3.5 w-3.5" />;
    case 'Inverted Hammer':
      return <TrendingUp className="h-3.5 w-3.5" />;
    case 'Bullish Engulfing':
      return <TrendingUp className="h-3.5 w-3.5" />;
    case 'Bearish Engulfing':
      return <TrendingDown className="h-3.5 w-3.5" />;
    case 'Morning Star':
      return <Target className="h-3.5 w-3.5" />;
    case 'Evening Star':
      return <ArrowDownRight className="h-3.5 w-3.5" />;
    case 'Spinning Top':
      return <Crosshair className="h-3.5 w-3.5" />;
    default:
      return <Eye className="h-3.5 w-3.5" />;
  }
}

function patternZoneColor(type: 'bullish' | 'bearish' | 'neutral'): string {
  return type === 'bullish'
    ? 'rgba(16, 185, 129, 0.25)'
    : type === 'bearish'
      ? 'rgba(239, 68, 68, 0.25)'
      : 'rgba(251, 191, 36, 0.25)';
}

function patternBorderColor(type: 'bullish' | 'bearish' | 'neutral'): string {
  return type === 'bullish'
    ? '#10b981'
    : type === 'bearish'
      ? '#ef4444'
      : '#fbbf24';
}

function patternLabelColor(type: 'bullish' | 'bearish' | 'neutral'): string {
  return type === 'bullish'
    ? 'text-emerald-400'
    : type === 'bearish'
      ? 'text-red-400'
      : 'text-amber-400';
}

// ─── SVG Candlestick Chart ───────────────────────────────────────────────────

interface ChartProps {
  candles: PriceHistory[];
  patterns: DetectedPattern[];
  chartWidth: number;
  chartHeight: number;
  priceTop: number;
  priceBottom: number;
}

function CandlestickChartSVG({
  candles,
  patterns,
  chartWidth,
  chartHeight,
  priceTop,
  priceBottom,
}: ChartProps) {
  const padding = { top: 40, right: 12, bottom: 32, left: 56 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const candleWidth = Math.max(3, plotWidth / candles.length * 0.6);
  const candleSpacing = plotWidth / candles.length;

  const yScale = (price: number) =>
    padding.top + plotHeight - ((price - priceBottom) / (priceTop - priceBottom)) * plotHeight;

  const xScale = (index: number) =>
    padding.left + candleSpacing * index + candleSpacing / 2;

  // Price grid lines
  const priceRange = priceTop - priceBottom;
  const gridStep = priceRange > 0.01 ? 0.002 : priceRange > 0.005 ? 0.001 : 0.0005;
  const gridPrices: number[] = [];
  for (let p = Math.ceil(priceBottom / gridStep) * gridStep; p <= priceTop; p += gridStep) {
    gridPrices.push(parseFloat(p.toFixed(5)));
  }

  // Build highlighted zones for patterns
  const highlightedZones = patterns.map((pat) => {
    const x1 = xScale(pat.startIndex) - candleSpacing / 2 - 2;
    const x2 = xScale(pat.endIndex) + candleSpacing / 2 + 2;
    const allHighs = candles.slice(pat.startIndex, pat.endIndex + 1).map((c) => c.high);
    const allLows = candles.slice(pat.startIndex, pat.endIndex + 1).map((c) => c.low);
    const zoneTop = yScale(Math.max(...allHighs)) - 4;
    const zoneBottom = yScale(Math.min(...allLows)) + 4;
    const midX = (x1 + x2) / 2;
    const labelY = zoneTop - 6;
    return { ...pat, x1, x2, zoneTop, zoneBottom, midX, labelY };
  });

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="overflow-visible"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="chartBgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(17, 24, 39, 0.4)" />
          <stop offset="100%" stopColor="rgba(17, 24, 39, 0.8)" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect x="0" y="0" width={chartWidth} height={chartHeight} rx="8" fill="url(#chartBgGrad)" />

      {/* Price grid lines */}
      {gridPrices.map((price) => (
        <g key={price}>
          <line
            x1={padding.left}
            y1={yScale(price)}
            x2={chartWidth - padding.right}
            y2={yScale(price)}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
          <text
            x={padding.left - 6}
            y={yScale(price) + 3}
            textAnchor="end"
            fill="rgba(148,163,184,0.6)"
            fontSize={9}
            fontFamily="monospace"
          >
            {price.toFixed(4)}
          </text>
        </g>
      ))}

      {/* Highlighted pattern zones (behind candles) */}
      {highlightedZones.map((zone, idx) => (
        <g key={`zone-${idx}`}>
          <rect
            x={zone.x1}
            y={zone.zoneTop + 12}
            width={zone.x2 - zone.x1}
            height={zone.zoneBottom - zone.zoneTop - 12}
            rx={4}
            fill={patternZoneColor(zone.type)}
            stroke={patternBorderColor(zone.type)}
            strokeWidth={1.2}
            strokeDasharray="4 2"
          />
          <text
            x={zone.midX}
            y={zone.labelY}
            textAnchor="middle"
            fill={patternBorderColor(zone.type)}
            fontSize={8}
            fontWeight={600}
            fontFamily="system-ui, sans-serif"
          >
            {zone.name}
          </text>
        </g>
      ))}

      {/* Candles */}
      {candles.map((candle, idx) => {
        const isBullish = candle.close > candle.open;
        const bodyTop = yScale(Math.max(candle.close, candle.open));
        const bodyBottom = yScale(Math.min(candle.close, candle.open));
        const bodyHeight = Math.max(1, bodyBottom - bodyTop);
        const cx = xScale(idx);
        const color = isBullish ? '#10b981' : '#ef4444';
        const fillColor = isBullish ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)';

        return (
          <g key={`candle-${idx}`}>
            {/* Upper wick */}
            <line
              x1={cx}
              y1={yScale(candle.high)}
              x2={cx}
              y2={bodyTop}
              stroke={color}
              strokeWidth={1}
            />
            {/* Lower wick */}
            <line
              x1={cx}
              y1={bodyBottom}
              x2={cx}
              y2={yScale(candle.low)}
              stroke={color}
              strokeWidth={1}
            />
            {/* Body */}
            <rect
              x={cx - candleWidth / 2}
              y={bodyTop}
              width={candleWidth}
              height={bodyHeight}
              rx={1}
              fill={fillColor}
              stroke={color}
              strokeWidth={0.5}
            />
          </g>
        );
      })}

      {/* X-axis labels */}
      {candles
        .filter((_, i) => i % 4 === 0)
        .map((candle, displayIdx) => {
          const dataIdx = displayIdx * 4;
          const d = new Date(candle.time);
          const label = `${d.getMonth() + 1}/${d.getDate()}`;
          return (
            <text
              key={`xlabel-${dataIdx}`}
              x={xScale(dataIdx)}
              y={chartHeight - 8}
              textAnchor="middle"
              fill="rgba(148,163,184,0.5)"
              fontSize={8}
              fontFamily="system-ui, sans-serif"
            >
              {label}
            </text>
          );
        })}

      {/* Symbol label */}
      <text
        x={padding.left + 4}
        y={padding.top - 10}
        fill="rgba(226,232,240,0.7)"
        fontSize={10}
        fontWeight={600}
        fontFamily="system-ui, sans-serif"
      >
        EUR/USD · H1
      </text>
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CandlestickPatternRecognition() {
  const candles = useMemo(() => generateMockCandles(), []);
  const patterns = useMemo(() => detectPatterns(candles), [candles]);

  // Compute price bounds for chart
  const priceTop = useMemo(
    () => Math.max(...candles.map((c) => c.high)) + 0.0005,
    [candles],
  );
  const priceBottom = useMemo(
    () => Math.min(...candles.map((c) => c.low)) - 0.0005,
    [candles],
  );

  // Statistics
  const bullishCount = patterns.filter((p) => p.type === 'bullish').length;
  const bearishCount = patterns.filter((p) => p.type === 'bearish').length;
  const mostCommon = useMemo(() => {
    if (patterns.length === 0) return '—';
    const freq: Record<string, number> = {};
    patterns.forEach((p) => {
      freq[p.name] = (freq[p.name] || 0) + 1;
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  }, [patterns]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 300, damping: 24 },
    },
  };

  return (
    <div className="glass-card-premium rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <CandlestickChart className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">
              Candlestick Pattern Recognition
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {candles.length} candles analyzed · {patterns.length} patterns detected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Eye className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[10px] text-amber-300 font-medium">AI Scan</span>
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="mx-4 mb-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="glass-card rounded-lg px-3 py-2 flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
          <div className="flex flex-col">
            <span className="text-[9px] text-muted-foreground leading-none">
              Total Patterns
            </span>
            <span className="text-xs font-semibold text-foreground font-mono mt-0.5">
              {patterns.length}
            </span>
          </div>
        </div>
        <div className="glass-card rounded-lg px-3 py-2 flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          <div className="flex flex-col">
            <span className="text-[9px] text-muted-foreground leading-none">
              Bullish
            </span>
            <span className="text-xs font-semibold text-emerald-400 font-mono mt-0.5">
              {bullishCount}
            </span>
          </div>
        </div>
        <div className="glass-card rounded-lg px-3 py-2 flex items-center gap-2">
          <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          <div className="flex flex-col">
            <span className="text-[9px] text-muted-foreground leading-none">
              Bearish
            </span>
            <span className="text-xs font-semibold text-red-400 font-mono mt-0.5">
              {bearishCount}
            </span>
          </div>
        </div>
        <div className="glass-card rounded-lg px-3 py-2 flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-amber-400" />
          <div className="flex flex-col">
            <span className="text-[9px] text-muted-foreground leading-none">
              Most Common
            </span>
            <span className="text-[10px] font-semibold text-foreground leading-tight mt-0.5 truncate max-w-[80px]">
              {mostCommon}
            </span>
          </div>
        </div>
      </div>

      {/* Candlestick Chart */}
      <div className="mx-4 mb-3 rounded-lg overflow-hidden border border-white/[0.04]">
        <div className="w-full" style={{ height: 280 }}>
          <CandlestickChartSVG
            candles={candles}
            patterns={patterns}
            chartWidth={900}
            chartHeight={280}
            priceTop={priceTop}
            priceBottom={priceBottom}
          />
        </div>
      </div>

      {/* Pattern List */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[11px] font-medium text-muted-foreground">
            Detected Patterns
          </span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        <div className="max-h-72 overflow-y-auto scrollbar-thin space-y-1.5 pr-1">
          <AnimatePresence mode="popLayout">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-1.5"
            >
              {patterns.map((pattern, idx) => (
                <motion.div
                  key={`pattern-${idx}-${pattern.name}-${pattern.startIndex}`}
                  variants={itemVariants}
                  layout
                  className={`glass-card rounded-lg px-3 py-2.5 transition-colors border ${
                    pattern.type === 'bullish'
                      ? 'border-emerald-500/15 hover:border-emerald-500/30'
                      : pattern.type === 'bearish'
                        ? 'border-red-500/15 hover:border-red-500/30'
                        : 'border-amber-500/15 hover:border-amber-500/30'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Icon */}
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                        pattern.type === 'bullish'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : pattern.type === 'bearish'
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-amber-500/15 text-amber-400'
                      }`}
                    >
                      {patternIcon(pattern.name)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">
                          {pattern.name}
                        </span>
                        {/* Type badge */}
                        <span
                          className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none ${
                            pattern.type === 'bullish'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                              : pattern.type === 'bearish'
                                ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                          }`}
                        >
                          {pattern.type.charAt(0).toUpperCase() + pattern.type.slice(1)}
                        </span>
                        {/* Reliability */}
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 3 }).map((_, s) => (
                            <Star
                              key={s}
                              className={`h-2.5 w-2.5 ${
                                s < reliabilityStars(pattern.reliability)
                                  ? pattern.reliability === 'High'
                                    ? 'text-emerald-400 fill-emerald-400/80'
                                    : pattern.reliability === 'Medium'
                                      ? 'text-amber-400 fill-amber-400/80'
                                      : 'text-slate-500 fill-slate-500/60'
                                  : 'text-slate-700 fill-transparent'
                              }`}
                            />
                          ))}
                          <span className="text-[9px] text-muted-foreground ml-1">
                            {pattern.reliability}
                          </span>
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-[10px] text-muted-foreground leading-relaxed mt-1 line-clamp-2">
                        {pattern.description}
                      </p>

                      {/* Candle index & time range */}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[9px] text-muted-foreground/70 font-mono">
                          Candle #{pattern.startIndex}
                          {pattern.endIndex !== pattern.startIndex &&
                            `–#${pattern.endIndex}`}
                        </span>
                        <span className="text-[9px] text-muted-foreground/70 font-mono">
                          {formatTime(candles[pattern.startIndex].time)}
                        </span>
                      </div>
                    </div>

                    {/* Price context */}
                    <div className="flex flex-col items-end shrink-0">
                      {pattern.endIndex !== pattern.startIndex ? (
                        <>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {candles[pattern.startIndex].close.toFixed(5)}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-medium ${
                              candles[pattern.endIndex].close >
                              candles[pattern.startIndex].close
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }`}
                          >
                            {candles[pattern.endIndex].close.toFixed(5)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {candles[pattern.startIndex].close.toFixed(5)}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>

          {patterns.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-xs">
              No patterns detected in current data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

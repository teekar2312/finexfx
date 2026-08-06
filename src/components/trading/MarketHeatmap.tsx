'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Grid3X3,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  BarChart3,
  Clock,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PairData {
  pair: string;
  displayName: string;
  price: number;
}

interface HeatmapCell {
  pair: string;
  timeframe: string;
  changePercent: number;
  changePips: number;
  trend: 'up' | 'down' | 'neutral';
  sparkline: number[];
}

interface PairRanking {
  pair: string;
  displayName: string;
  score: number;
  rank: number;
  values: number[];
}

interface TimeframeAvg {
  timeframe: string;
  avg: number;
}

type MarketBias = 'BULLISH' | 'BEARISH' | 'MIXED';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAIRS: PairData[] = [
  { pair: 'EUR/USD', displayName: 'EUR/USD', price: 1.0873 },
  { pair: 'USD/JPY', displayName: 'USD/JPY', price: 157.42 },
  { pair: 'GBP/USD', displayName: 'GBP/USD', price: 1.2715 },
  { pair: 'XAU/USD', displayName: 'XAU/USD', price: 2348.60 },
];

const TIMEFRAMES = ['M5', 'M15', 'H1', 'H4', 'D1', 'W1'];

// Seeded pseudo-random number generator (mulberry32)
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Generate Seeded Mock Data ───────────────────────────────────────────────

function generateMockData(): HeatmapCell[] {
  const rand = seededRandom(42);
  const cells: HeatmapCell[] = [];

  // Intentional bias per pair to create visual contrast
  const pairBias: Record<string, number> = {
    'EUR/USD': 0.15,   // moderately positive
    'USD/JPY': -0.25,  // strongly negative
    'GBP/USD': 0.35,   // strongly positive
    'XAU/USD': -0.10,  // mildly negative
  };

  for (const p of PAIRS) {
    for (const tf of TIMEFRAMES) {
      const bias = pairBias[p.pair];
      // Scale bias by timeframe weight (higher TF = bigger moves)
      const tfWeight: Record<string, number> = {
        M5: 0.15, M15: 0.25, H1: 0.45, H4: 0.7, D1: 1.0, W1: 1.4,
      };
      const base = bias * tfWeight[tf];
      const noise = (rand() - 0.5) * 0.12;
      const changePercent = parseFloat((base + noise).toFixed(3));

      // Pip calculation (simplified: 1 pip = 0.0001 for FX, 0.1 for gold)
      const pipMultiplier = p.pair === 'XAU/USD' ? 10 : 10000;
      const changePips = parseFloat(
        (changePercent / 100 * p.price * pipMultiplier).toFixed(1)
      );

      const trend: 'up' | 'down' | 'neutral' =
        changePercent > 0.02 ? 'up' : changePercent < -0.02 ? 'down' : 'neutral';

      // Mini sparkline: 5 bars roughly trending in the direction of change
      const sparkline: number[] = [];
      for (let i = 0; i < 5; i++) {
        const v = (changePercent / 100) * (0.3 + i * 0.175) + (rand() - 0.5) * 0.0005;
        sparkline.push(parseFloat(v.toFixed(4)));
      }

      cells.push({ pair: p.pair, timeframe: tf, changePercent, changePips, trend, sparkline });
    }
  }

  return cells;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCellColor(value: number): string {
  if (value >= 0.3) return 'bg-emerald-700/80';
  if (value >= 0.15) return 'bg-emerald-600/70';
  if (value >= 0.05) return 'bg-emerald-500/50';
  if (value >= 0.02) return 'bg-emerald-500/25';
  if (value >= -0.02) return 'bg-gray-700/40';
  if (value >= -0.05) return 'bg-red-500/25';
  if (value >= -0.15) return 'bg-red-500/50';
  if (value >= -0.3) return 'bg-red-600/70';
  return 'bg-red-700/80';
}

function getTextColor(value: number): string {
  if (Math.abs(value) < 0.02) return 'text-gray-300';
  return value > 0 ? 'text-emerald-300' : 'text-red-300';
}

function formatPercent(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function formatPips(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(1)} pip`;
}

function getBiasColor(bias: MarketBias): string {
  if (bias === 'BULLISH') return 'text-emerald-400';
  if (bias === 'BEARISH') return 'text-red-400';
  return 'text-amber-400';
}

function getBiasBg(bias: MarketBias): string {
  if (bias === 'BULLISH') return 'bg-emerald-500/15';
  if (bias === 'BEARISH') return 'bg-red-500/15';
  return 'bg-amber-500/15';
}

function getBiasBorder(bias: MarketBias): string {
  if (bias === 'BULLISH') return 'border-emerald-500/30';
  if (bias === 'BEARISH') return 'border-red-500/30';
  return 'border-amber-500/30';
}

// ─── Sparkline SVG ───────────────────────────────────────────────────────────

function MiniSparkline({ values, width = 80, height = 24 }: { values: number[]; width?: number; height?: number }) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const barW = (width - (values.length - 1) * 2) / values.length;

  return (
    <svg width={width} height={height} className="inline-block">
      {values.map((v, i) => {
        const barH = Math.max(2, ((v - min) / range) * (height - 4));
        const x = i * (barW + 2);
        const y = height - barH - 2;
        const color = v >= 0 ? '#34d399' : '#f87171';
        return (
          <rect key={i} x={x} y={y} width={barW} height={barH} rx={1} fill={color} opacity={0.8} />
        );
      })}
    </svg>
  );
}

// ─── Tooltip Sparkline ───────────────────────────────────────────────────────

function TooltipSparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const barW = 10;
  const gap = 2;

  return (
    <svg width={58} height={28} className="block mt-1">
      {values.map((v, i) => {
        const barH = Math.max(2, ((v - min) / range) * 22);
        const x = i * (barW + gap);
        const y = 26 - barH;
        const color = v >= 0 ? '#34d399' : '#f87171';
        return (
          <rect key={i} x={x} y={y} width={barW} height={barH} rx={1.5} fill={color} />
        );
      })}
    </svg>
  );
}

// ─── HeatmapCell Component ───────────────────────────────────────────────────

function HeatmapCellComponent({ cell, index }: { cell: HeatmapCell; index: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.02, ease: 'easeOut' }}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`
          ${getCellColor(cell.changePercent)}
          rounded-md px-2 py-1.5 min-h-[48px] flex flex-col items-center justify-center
          border border-white/5 cursor-pointer transition-all duration-150
          ${hovered ? 'scale-[1.03] border-white/20 z-10 shadow-lg' : 'scale-100'}
        `}
      >
        <span className={`text-[11px] font-mono font-semibold ${getTextColor(cell.changePercent)}`}>
          {formatPercent(cell.changePercent)}
        </span>
        <span className="text-[9px] font-mono text-white/40 mt-0.5">
          {formatPips(cell.changePips)}
        </span>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
              glass-card-premium rounded-lg px-3 py-2 min-w-[160px]
              border border-white/10 shadow-xl"
          >
            <div className="text-[11px] font-semibold text-white mb-0.5">
              {cell.pair} · {cell.timeframe}
            </div>
            <div className={`text-[13px] font-mono font-bold ${getTextColor(cell.changePercent)}`}>
              {formatPercent(cell.changePercent)}
            </div>
            <div className="text-[10px] font-mono text-white/50">
              {formatPips(cell.changePips)}
            </div>
            <TooltipSparkline values={cell.sparkline} />
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 glass-card-premium border-r border-b border-white/10" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Timeframe Aggregation Bar ───────────────────────────────────────────────

function TimeframeAggregationBar({ averages }: { averages: TimeframeAvg[] }) {
  const maxAbs = Math.max(...averages.map((a) => Math.abs(a.avg)), 0.01);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 mb-2">
        <BarChart3 className="w-3 h-3 text-white/50" />
        <span className="text-[10px] text-white/50 uppercase tracking-wider font-medium">
          Timeframe Avg Performance
        </span>
      </div>
      {averages.map((item) => {
        const pct = (item.avg / maxAbs) * 50;
        const isPos = item.avg >= 0;
        return (
          <div key={item.timeframe} className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/40 w-6 text-right">{item.timeframe}</span>
            <div className="flex-1 h-3 rounded-sm bg-gray-800/60 overflow-hidden relative">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
              {/* Bar */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                className={`
                  h-full rounded-sm absolute top-0 bottom-0
                  ${isPos
                    ? 'left-1/2 bg-gradient-to-r from-emerald-600/80 to-emerald-400/80'
                    : 'right-1/2 bg-gradient-to-l from-red-600/80 to-red-400/80'
                  }
                `}
                style={{ width: `${Math.abs(pct)}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono w-12 text-right ${getTextColor(item.avg)}`}>
              {formatPercent(item.avg)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Pair Performance Ranking ────────────────────────────────────────────────

function PairRankingList({ rankings }: { rankings: PairRanking[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Trophy className="w-3 h-3 text-amber-400/70" />
        <span className="text-[10px] text-white/50 uppercase tracking-wider font-medium">
          Pair Performance Ranking
        </span>
      </div>
      {rankings.map((r, i) => (
        <motion.div
          key={r.pair}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.4 + i * 0.08 }}
          className={`
            flex items-center gap-2 px-2.5 py-2 rounded-md border
            ${i === 0
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-white/5 bg-white/[0.02]'
            }
          `}
        >
          {/* Rank badge */}
          <div className={`
            w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
            ${i === 0 ? 'bg-amber-500/30 text-amber-300' : 'bg-white/10 text-white/40'}
          `}>
            {i === 0 ? <Trophy className="w-3 h-3" /> : r.rank}
          </div>

          {/* Pair name & score */}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-white/90 truncate">{r.displayName}</div>
            <div className={`text-[10px] font-mono ${getTextColor(r.score)}`}>
              {formatPercent(r.score)}
            </div>
          </div>

          {/* Sparkline */}
          <MiniSparkline values={r.values} width={50} height={18} />
        </motion.div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketHeatmap() {
  const cells = useMemo(() => generateMockData(), []);

  // Timeframe averages
  const timeframeAverages = useMemo(() => {
    return TIMEFRAMES.map((tf) => {
      const tfCells = cells.filter((c) => c.timeframe === tf);
      const avg = tfCells.reduce((s, c) => s + c.changePercent, 0) / tfCells.length;
      return { timeframe: tf, avg: parseFloat(avg.toFixed(3)) };
    });
  }, [cells]);

  // Pair rankings
  const rankings = useMemo(() => {
    const tfWeights: Record<string, number> = { M5: 0.1, M15: 0.15, H1: 0.25, H4: 0.3, D1: 0.5, W1: 0.7 };
    const pairScores: PairRanking[] = PAIRS.map((p) => {
      const pCells = cells.filter((c) => c.pair === p.pair);
      let wSum = 0;
      let wTotal = 0;
      const values: number[] = [];
      for (const c of pCells) {
        const w = tfWeights[c.timeframe];
        wSum += c.changePercent * w;
        wTotal += w;
        values.push(c.changePercent);
      }
      return {
        pair: p.pair,
        displayName: p.displayName,
        score: parseFloat((wSum / wTotal).toFixed(3)),
        rank: 0,
        values,
      };
    });
    pairScores.sort((a, b) => b.score - a.score);
    pairScores.forEach((p, i) => (p.rank = i + 1));
    return pairScores;
  }, [cells]);

  // Market bias
  const marketBias = useMemo((): { type: MarketBias; posCount: number; negCount: number } => {
    const posCount = cells.filter((c) => c.changePercent > 0.02).length;
    const negCount = cells.filter((c) => c.changePercent < -0.02).length;
    const avg = cells.reduce((s, c) => s + c.changePercent, 0) / cells.length;

    let type: MarketBias = 'MIXED';
    if (avg > 0.05) type = 'BULLISH';
    else if (avg < -0.05) type = 'BEARISH';

    return { type, posCount, negCount };
  }, [cells]);

  const total = cells.length;

  return (
    <div className="glass-card-premium rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-4 h-4 text-emerald-400/70" />
          <h3 className="text-sm font-semibold text-white/90">Market Heatmap</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-white/30" />
          <span className="text-[10px] text-white/30 font-mono">LIVE</span>
        </div>
      </div>

      {/* Market Bias Indicator */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`
          relative rounded-lg px-4 py-3 border text-center overflow-hidden
          ${getBiasBg(marketBias.type)} ${getBiasBorder(marketBias.type)}
        `}
      >
        {/* Animated pulse background */}
        <motion.div
          animate={{ opacity: [0.03, 0.08, 0.03] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className={`
            absolute inset-0 rounded-lg
            ${marketBias.type === 'BULLISH' ? 'bg-emerald-500' : marketBias.type === 'BEARISH' ? 'bg-red-500' : 'bg-amber-500'}
          `}
        />
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-2">
            {marketBias.type === 'BULLISH' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
            {marketBias.type === 'BEARISH' && <TrendingDown className="w-4 h-4 text-red-400" />}
            {marketBias.type === 'MIXED' && <Minus className="w-4 h-4 text-amber-400" />}
            <span className={`text-base font-bold tracking-wider ${getBiasColor(marketBias.type)} neon-text-${marketBias.type === 'BULLISH' ? 'emerald' : marketBias.type === 'BEARISH' ? 'red' : 'amber'}`}>
              {marketBias.type}
            </span>
          </div>
          <p className="text-[10px] text-white/40 mt-1">
            {marketBias.posCount} of {total} cells positive · {marketBias.negCount} negative
          </p>
        </div>
      </motion.div>

      {/* Main Grid + Ranking Layout */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Heatmap Grid */}
        <div className="flex-1 min-w-0">
          {/* Column headers (pairs) */}
          <div className="grid grid-cols-[40px_repeat(4,1fr)] gap-1.5 mb-1.5">
            <div /> {/* empty corner */}
            {PAIRS.map((p) => (
              <div key={p.pair} className="text-center">
                <div className="text-[10px] font-semibold text-white/70">{p.displayName}</div>
                <div className="text-[9px] font-mono text-white/30">{p.price.toFixed(p.pair === 'XAU/USD' ? 2 : 4)}</div>
              </div>
            ))}
          </div>

          {/* Rows */}
          {TIMEFRAMES.map((tf, tfIdx) => (
            <div key={tf} className="grid grid-cols-[40px_repeat(4,1fr)] gap-1.5 mb-1.5">
              {/* Timeframe label */}
              <div className="flex items-center">
                <span className="text-[10px] font-mono text-white/40 font-medium">{tf}</span>
              </div>
              {/* Cells */}
              {PAIRS.map((p, pIdx) => {
                const cell = cells.find((c) => c.pair === p.pair && c.timeframe === tf);
                if (!cell) return null;
                const idx = tfIdx * PAIRS.length + pIdx;
                return <HeatmapCellComponent key={`${p.pair}-${tf}`} cell={cell} index={idx} />;
              })}
            </div>
          ))}

          {/* Timeframe Aggregation Bar */}
          <div className="mt-3 pt-3 border-t border-white/5">
            <TimeframeAggregationBar averages={timeframeAverages} />
          </div>
        </div>

        {/* Pair Ranking (right side / below on mobile) */}
        <div className="w-full lg:w-56 flex-shrink-0">
          <PairRankingList rankings={rankings} />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 pt-2 border-t border-white/5">
        <span className="text-[9px] text-white/30">Strong Sell</span>
        <div className="flex gap-0.5">
          <div className="w-4 h-2 rounded-sm bg-red-700/80" />
          <div className="w-4 h-2 rounded-sm bg-red-500/50" />
          <div className="w-4 h-2 rounded-sm bg-red-500/25" />
          <div className="w-4 h-2 rounded-sm bg-gray-700/40" />
          <div className="w-4 h-2 rounded-sm bg-emerald-500/25" />
          <div className="w-4 h-2 rounded-sm bg-emerald-500/50" />
          <div className="w-4 h-2 rounded-sm bg-emerald-700/80" />
        </div>
        <span className="text-[9px] text-white/30">Strong Buy</span>
      </div>
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { GitBranch, Info, Clock } from 'lucide-react';
import { SYMBOLS, SYMBOL_INFO, type Symbol } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type Timeframe = '1H' | '4H' | '1D' | '1W';

interface CorrelationCell {
  pair1: Symbol;
  pair2: Symbol;
  value: number;
}

interface Insight {
  text: string;
  severity: 'positive' | 'negative' | 'neutral';
}

// ─── Data ────────────────────────────────────────────────────────────────────

// Well-known forex correlations (upper triangle, symmetrical)
const BASE_CORRELATIONS: Record<string, number> = {
  'EURUSD-GBPUSD': 0.85,
  'EURUSD-USDJPY': -0.60,
  'EURUSD-XAUUSD': -0.15,
  'USDJPY-GBPUSD': -0.45,
  'USDJPY-XAUUSD': -0.30,
  'GBPUSD-XAUUSD': -0.10,
};

// Small variations per timeframe to simulate different lookback windows
const TIMEFRAME_OFFSETS: Record<Timeframe, Record<string, number>> = {
  '1H': {
    'EURUSD-GBPUSD': 0.02,
    'EURUSD-USDJPY': -0.03,
    'EURUSD-XAUUSD': 0.04,
    'USDJPY-GBPUSD': -0.02,
    'USDJPY-XAUUSD': -0.05,
    'GBPUSD-XAUUSD': 0.03,
  },
  '4H': {
    'EURUSD-GBPUSD': -0.01,
    'EURUSD-USDJPY': 0.02,
    'EURUSD-XAUUSD': -0.02,
    'USDJPY-GBPUSD': 0.03,
    'USDJPY-XAUUSD': 0.01,
    'GBPUSD-XAUUSD': -0.01,
  },
  '1D': {
    'EURUSD-GBPUSD': 0.00,
    'EURUSD-USDJPY': 0.00,
    'EURUSD-XAUUSD': 0.00,
    'USDJPY-GBPUSD': 0.00,
    'USDJPY-XAUUSD': 0.00,
    'GBPUSD-XAUUSD': 0.00,
  },
  '1W': {
    'EURUSD-GBPUSD': -0.03,
    'EURUSD-USDJPY': 0.05,
    'EURUSD-XAUUSD': 0.03,
    'USDJPY-GBPUSD': -0.04,
    'USDJPY-XAUUSD': 0.02,
    'GBPUSD-XAUUSD': -0.02,
  },
};

function buildCorrelationMatrix(timeframe: Timeframe): CorrelationCell[] {
  const offsets = TIMEFRAME_OFFSETS[timeframe];
  const cells: CorrelationCell[] = [];

  for (const pair1 of SYMBOLS) {
    for (const pair2 of SYMBOLS) {
      if (pair1 === pair2) {
        cells.push({ pair1, pair2, value: 1.0 });
      } else {
        const key1 = `${pair1}-${pair2}`;
        const key2 = `${pair2}-${pair1}`;
        const base = BASE_CORRELATIONS[key1] ?? BASE_CORRELATIONS[key2] ?? 0;
        const offset = offsets[key1] ?? offsets[key2] ?? 0;
        cells.push({ pair1, pair2, value: Math.max(-1, Math.min(1, base + offset)) });
      }
    }
  }

  return cells;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCorrelationColor(value: number, isDiagonal: boolean): string {
  if (isDiagonal) return 'rgba(16, 185, 129, 0.35)';
  if (value >= 0.7) return 'rgba(16, 185, 129, 0.50)';   // strong positive → emerald
  if (value >= 0.3) return 'rgba(20, 184, 166, 0.40)';    // weak positive → teal
  if (value > -0.3) return 'rgba(148, 163, 184, 0.20)';   // neutral → gray
  if (value > -0.7) return 'rgba(245, 158, 11, 0.40)';    // weak negative → orange
  return 'rgba(239, 68, 68, 0.45)';                         // strong negative → red
}

function getCorrelationBorderColor(value: number, isDiagonal: boolean): string {
  if (isDiagonal) return 'rgba(16, 185, 129, 0.5)';
  if (value >= 0.7) return 'rgba(16, 185, 129, 0.6)';
  if (value >= 0.3) return 'rgba(20, 184, 166, 0.5)';
  if (value > -0.3) return 'rgba(148, 163, 184, 0.25)';
  if (value > -0.7) return 'rgba(245, 158, 11, 0.5)';
  return 'rgba(239, 68, 68, 0.6)';
}

function getStrengthLabel(value: number): string {
  const abs = Math.abs(value);
  if (value === 1) return 'Perfect self-correlation';
  if (abs >= 0.8) return value > 0 ? 'Very strong positive' : 'Very strong negative';
  if (abs >= 0.6) return value > 0 ? 'Strong positive' : 'Strong negative';
  if (abs >= 0.4) return value > 0 ? 'Moderate positive' : 'Moderate negative';
  if (abs >= 0.2) return value > 0 ? 'Weak positive' : 'Weak negative';
  return 'Negligible correlation';
}

function getTradingImplication(value: number): string {
  const abs = Math.abs(value);
  if (value === 1) return 'Self-correlation — always 1.00';
  if (abs >= 0.7) {
    return value > 0
      ? 'Highly correlated — avoid same-direction positions to reduce concentrated risk'
      : 'Strong inverse — excellent for natural hedging or pair-divergence trades';
  }
  if (abs >= 0.4) {
    return value > 0
      ? 'Moderate correlation — be cautious with same-direction exposure'
      : 'Partial hedge — can offset risk if positions sized correctly';
  }
  if (abs >= 0.2) {
    return value > 0
      ? 'Weak correlation — minimal risk overlap between positions'
      : 'Weak inverse — limited hedging benefit, mostly independent';
  }
  return 'Effectively independent — no meaningful relationship for trading';
}

function getInsights(cells: CorrelationCell[]): Insight[] {
  const insights: Insight[] = [];
  const offDiagonal = cells.filter((c) => c.pair1 !== c.pair2);

  // Sort by absolute correlation
  const sorted = [...offDiagonal].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  // Deduplicate symmetric pairs
  const seen = new Set<string>();
  const unique = sorted.filter((c) => {
    const key = [c.pair1, c.pair2].sort().join('-');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const n1 = SYMBOL_INFO[unique[0].pair1].name;
  const n2 = SYMBOL_INFO[unique[0].pair2].name;

  if (Math.abs(unique[0].value) >= 0.6) {
    if (unique[0].value > 0) {
      insights.push({
        text: `${n1} and ${n2} show strong positive correlation (${unique[0].value.toFixed(2)}) — consider reducing exposure by not taking same-direction trades on both pairs.`,
        severity: 'negative',
      });
    } else {
      insights.push({
        text: `${n1} and ${n2} exhibit strong negative correlation (${unique[0].value.toFixed(2)}) — this pair can be used for hedging or divergence strategies.`,
        severity: 'positive',
      });
    }
  }

  if (unique[1]) {
    const u1 = SYMBOL_INFO[unique[1].pair1].name;
    const u2 = SYMBOL_INFO[unique[1].pair2].name;
    if (Math.abs(unique[1].value) >= 0.3) {
      insights.push({
        text: `${u1} and ${u2} have a ${Math.abs(unique[1].value) >= 0.6 ? 'strong' : 'moderate'} ${unique[1].value > 0 ? 'positive' : 'negative'} correlation (${unique[1].value.toFixed(2)}) — ${Math.abs(unique[1].value) >= 0.6 ? 'monitor for overexposure' : 'largely independent movement expected'}.`,
        severity: unique[1].value > 0 ? 'neutral' : 'positive',
      });
    }
  }

  // Find the weakest pair
  const weakest = unique.find((c) => Math.abs(c.value) < 0.25);
  if (weakest) {
    const w1 = SYMBOL_INFO[weakest.pair1].name;
    const w2 = SYMBOL_INFO[weakest.pair2].name;
    insights.push({
      text: `${w1} and ${w2} are nearly uncorrelated (${weakest.value.toFixed(2)}) — ideal for portfolio diversification as they move independently.`,
      severity: 'positive',
    });
  }

  return insights.slice(0, 3);
}

const SEVERITY_STYLES: Record<string, string> = {
  positive: 'border-emerald-500/30 bg-emerald-500/5',
  negative: 'border-amber-500/30 bg-amber-500/5',
  neutral: 'border-slate-500/30 bg-slate-500/5',
};

const SEVERITY_DOT: Record<string, string> = {
  positive: 'bg-emerald-400',
  negative: 'bg-amber-400',
  neutral: 'bg-slate-400',
};

// ─── Animation variants ──────────────────────────────────────────────────────

const cellVariants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.04,
      duration: 0.35,
      ease: 'easeOut',
    },
  }),
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function CorrelationMatrix() {
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');

  const cells = useMemo(() => buildCorrelationMatrix(timeframe), [timeframe]);
  const insights = useMemo(() => getInsights(cells), [cells]);

  // Build a lookup for quick access
  const cellMap = useMemo(() => {
    const map = new Map<string, CorrelationCell>();
    for (const c of cells) {
      map.set(`${c.pair1}-${c.pair2}`, c);
    }
    return map;
  }, [cells]);

  let animIndex = 0;

  return (
    <Card className="glass-card-premium rounded-xl overflow-hidden">
      {/* ── Header ── */}
      <CardHeader className="pb-3 px-4 pt-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <GitBranch className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-foreground leading-tight">
                Correlation Matrix
              </CardTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Cross-pair correlation heatmap · {SYMBOLS.length} pairs
              </p>
            </div>
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground mr-1" />
            {(['1H', '4H', '1D', '1W'] as Timeframe[]).map((tf) => (
              <Button
                key={tf}
                size="sm"
                variant={timeframe === tf ? 'default' : 'ghost'}
                onClick={() => setTimeframe(tf)}
                className={`h-7 px-2.5 text-xs font-medium rounded-md transition-all ${
                  timeframe === tf
                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 shadow-sm shadow-emerald-500/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                {tf}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* ── Matrix ── */}
        <div className="overflow-x-auto">
          <div className="inline-flex flex-col items-center min-w-[480px]">
            {/* Column headers */}
            <div className="flex">
              <div className="w-[80px] h-[28px]" /> {/* spacer for row headers */}
              {SYMBOLS.map((sym) => (
                <div
                  key={`col-${sym}`}
                  className="w-[80px] h-[28px] flex items-center justify-center text-[11px] font-medium text-muted-foreground"
                >
                  {SYMBOL_INFO[sym].name}
                </div>
              ))}
            </div>

            {/* Rows */}
            {SYMBOLS.map((rowSym) => (
              <div key={`row-${rowSym}`} className="flex items-stretch">
                {/* Row header */}
                <div className="w-[80px] flex items-center justify-center text-[11px] font-medium text-muted-foreground">
                  {SYMBOL_INFO[rowSym].name}
                </div>

                {/* Cells */}
                {SYMBOLS.map((colSym) => {
                  const cell = cellMap.get(`${rowSym}-${colSym}`)!;
                  const isDiagonal = rowSym === colSym;
                  const idx = animIndex++;

                  return (
                    <Tooltip key={`cell-${rowSym}-${colSym}`}>
                      <TooltipTrigger asChild>
                        <motion.div
                          custom={idx}
                          variants={cellVariants}
                          initial="hidden"
                          animate="visible"
                          className="w-[80px] h-[80px] m-[2px] rounded-lg flex flex-col items-center justify-center cursor-default transition-transform hover:scale-105 hover:z-10"
                          style={{
                            backgroundColor: getCorrelationColor(cell.value, isDiagonal),
                            border: `1px solid ${getCorrelationBorderColor(cell.value, isDiagonal)}`,
                          }}
                        >
                          <span
                            className={`font-mono text-[15px] font-semibold leading-none ${
                              isDiagonal
                                ? 'text-emerald-300'
                                : cell.value >= 0.5
                                  ? 'text-emerald-200'
                                  : cell.value >= 0.2
                                    ? 'text-teal-200'
                                    : cell.value > -0.2
                                      ? 'text-slate-300'
                                      : cell.value > -0.5
                                        ? 'text-orange-200'
                                        : 'text-red-200'
                            }`}
                          >
                            {cell.value.toFixed(2)}
                          </span>
                          {isDiagonal && (
                            <span className="text-[8px] text-emerald-400/60 mt-1 font-medium">
                              SELF
                            </span>
                          )}
                        </motion.div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="center"
                        className="glass-card rounded-lg border border-white/10 px-3 py-2.5 max-w-[260px] shadow-xl"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-foreground">
                              {SYMBOL_INFO[rowSym].name}
                            </span>
                            <span className="text-muted-foreground">×</span>
                            <span className="text-[12px] font-semibold text-foreground">
                              {SYMBOL_INFO[colSym].name}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-[10px] text-muted-foreground">Correlation:</span>
                            <span className="font-mono text-[14px] font-bold text-foreground">
                              {cell.value.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">Strength:</span>
                            <span className="text-[11px] text-foreground">{getStrengthLabel(cell.value)}</span>
                          </div>
                          <div className="pt-1.5 border-t border-white/10">
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                              {getTradingImplication(cell.value)}
                            </p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ── Correlation Strength Legend ── */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="h-[6px] flex-1 rounded-full overflow-hidden flex">
              <div className="flex-[2] bg-red-500/50" />        {/* strong neg */}
              <div className="flex-[1] bg-orange-500/45" />      {/* weak neg */}
              <div className="flex-[1] bg-slate-400/25" />      {/* neutral */}
              <div className="flex-[1] bg-teal-500/45" />       {/* weak pos */}
              <div className="flex-[2] bg-emerald-500/55" />    {/* strong pos */}
            </div>
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground px-0.5 font-medium">
            <span>-1.0 Strong Negative</span>
            <span>0.0 Neutral</span>
            <span>+1.0 Strong Positive</span>
          </div>
        </div>

        {/* ── Key Insights ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Info className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-foreground">Key Insights</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={timeframe}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="space-y-2"
            >
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border ${SEVERITY_STYLES[insight.severity]}`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[insight.severity]}`}
                  />
                  <p className="text-[11px] text-foreground/80 leading-relaxed">
                    {insight.text}
                  </p>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

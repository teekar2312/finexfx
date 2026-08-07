'use client';

import { useState, useEffect, useCallback } from 'react';

import { SYMBOLS, SYMBOL_INFO, type Symbol } from '@/lib/types';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SentimentData {
  overallSentiment: number;
  symbolSentiment: Record<Symbol, number>;
  retailSentiment: number;
  institutionalSentiment: number;
  fearGreedIndex: number;
  insights: string[];
}

const INSIGHTS_POOL = [
  'Retail traders heavily positioned long on EUR/USD — potential contrarian short signal.',
  'Institutional flow shows increasing JPY demand as safe-haven buying continues.',
  'GBP sentiment improving after recent economic data beat expectations.',
  'Gold sentiment remains strongly bullish amid geopolitical uncertainty.',
  'Spread widening on EUR/USD suggests declining market liquidity.',
  'Fear index rising — traders reducing leverage across major pairs.',
  'Strong institutional buying on USD/JPY dips indicates dip-demand.',
  'Retail positioning shows extreme bearishness on GBP — contrarian bullish signal.',
  'Gold sentiment at multi-week high — watch for potential reversal.',
  'EUR/USD order flow imbalance detected at key support level.',
  'Cross-asset correlation weakening — potential regime change ahead.',
  'Institutional sentiment diverging from retail — high-conviction setups forming.',
];

function generateSentiment(prev?: SentimentData): SentimentData {
  const jitter = (v: number, range: number) => {
    const delta = (Math.random() - 0.5) * range;
    return Math.max(0, Math.min(100, v + delta));
  };

  const overallSentiment = prev
    ? jitter(prev.overallSentiment, 6)
    : 40 + Math.random() * 30;

  const symbolSentiment: Record<Symbol, number> = {
    EURUSD: prev ? jitter(prev.symbolSentiment.EURUSD, 8) : 35 + Math.random() * 40,
    USDJPY: prev ? jitter(prev.symbolSentiment.USDJPY, 8) : 30 + Math.random() * 50,
    GBPUSD: prev ? jitter(prev.symbolSentiment.GBPUSD, 8) : 30 + Math.random() * 40,
    XAUUSD: prev ? jitter(prev.symbolSentiment.XAUUSD, 8) : 50 + Math.random() * 35,
  };

  const retailSentiment = prev
    ? jitter(prev.retailSentiment, 5)
    : 40 + Math.random() * 25;

  const institutionalSentiment = prev
    ? jitter(prev.institutionalSentiment, 5)
    : 45 + Math.random() * 25;

  const fearGreedIndex = prev
    ? jitter(prev.fearGreedIndex, 4)
    : 30 + Math.random() * 45;

  // Pick 3-4 insights
  const shuffled = [...INSIGHTS_POOL].sort(() => Math.random() - 0.5);
  const insights = shuffled.slice(0, 3 + Math.floor(Math.random() * 2));

  return {
    overallSentiment,
    symbolSentiment,
    retailSentiment,
    institutionalSentiment,
    fearGreedIndex,
    insights,
  };
}

function SentimentGauge({ value }: { value: number }) {
  const clampedValue = Math.max(0, Math.min(100, value));
  // Arc from -90deg (left) to 90deg (right) = 180deg total
  const angle = -90 + (clampedValue / 100) * 180;
  const radians = (angle * Math.PI) / 180;
  const needleLength = 52;
  const cx = 75;
  const cy = 72;
  const nx = cx + needleLength * Math.cos(radians);
  const ny = cy + needleLength * Math.sin(radians);

  // Determine label
  const label = clampedValue < 35 ? 'Bearish' : clampedValue > 65 ? 'Bullish' : 'Neutral';
  const labelColor = clampedValue < 35 ? 'text-red-400' : clampedValue > 65 ? 'text-emerald-400' : 'text-slate-400';

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 150 100" className="w-full max-w-[180px]">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#64748b" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        {/* Background arc */}
        <path
          d="M 15 75 A 60 60 0 0 1 135 75"
          fill="none"
          stroke="rgba(30,41,59,0.8)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Colored arc */}
        <path
          d="M 15 75 A 60 60 0 0 1 135 75"
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.6"
        />
        {/* Needle */}
        <motion.line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={clampedValue < 35 ? '#ef4444' : clampedValue > 65 ? '#10b981' : '#94a3b8'}
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={false}
          animate={{ x2: nx, y2: ny }}
          transition={{ type: 'spring', stiffness: 80, damping: 15 }}
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r="5" fill="rgba(30,41,59,0.9)" stroke="rgba(100,116,139,0.5)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r="2" fill="#94a3b8" />
        {/* Labels on arc */}
        <text x="12" y="92" className="text-[9px]" fill="#10b981" fontSize="9" fontFamily="monospace">0</text>
        <text x="133" y="92" className="text-[9px]" fill="#ef4444" fontSize="9" fontFamily="monospace">100</text>
      </svg>
      <div className="text-center -mt-2">
        <motion.div
          className="text-xl font-bold tabular-nums"
          style={{ color: clampedValue < 35 ? '#ef4444' : clampedValue > 65 ? '#10b981' : '#94a3b8' }}
          key={clampedValue.toFixed(0)}
          initial={{ scale: 1.05, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {clampedValue.toFixed(1)}%
        </motion.div>
        <div className={`text-[10px] font-medium ${labelColor}`}>{label}</div>
      </div>
    </div>
  );
}

function FearGreedDisplay({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  let color: string;
  let label: string;
  if (clamped < 25) { color = 'text-red-500'; label = 'Extreme Fear'; }
  else if (clamped < 45) { color = 'text-amber-500'; label = 'Fear'; }
  else if (clamped < 55) { color = 'text-slate-400'; label = 'Neutral'; }
  else if (clamped < 75) { color = 'text-emerald-500'; label = 'Greed'; }
  else { color = 'text-emerald-400'; label = 'Extreme Greed'; }

  return (
    <div className="text-center p-2.5 rounded-lg bg-slate-800/40 border border-border/40">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Fear & Greed Index</div>
      <motion.div
        className={`text-2xl font-bold tabular-nums ${color}`}
        key={clamped.toFixed(0)}
        initial={{ scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {clamped.toFixed(0)}
      </motion.div>
      <div className={`text-[10px] font-medium ${color} mt-0.5`}>{label}</div>
      {/* Mini bar */}
      <div className="mt-2 h-1 rounded-full overflow-hidden bg-slate-700/50 flex">
        <div className="bg-red-500/70" style={{ width: '25%' }} />
        <div className="bg-amber-500/70" style={{ width: '20%' }} />
        <div className="bg-slate-500/70" style={{ width: '10%' }} />
        <div className="bg-emerald-500/70" style={{ width: '20%' }} />
        <div className="bg-emerald-400/70" style={{ width: '25%' }} />
      </div>
      <div className="relative h-3 mt-0.5">
        <motion.div
          className="absolute top-0 w-0.5 h-2 bg-white rounded-full shadow-[0_0_4px_rgba(255,255,255,0.8)]"
          style={{ left: `${clamped}%` }}
          initial={false}
          animate={{ left: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        />
      </div>
    </div>
  );
}

export default function MarketSentiment() {
  const [data, setData] = useState<SentimentData>(() => generateSentiment());

  const updateSentiment = useCallback(() => {
    setData((prev) => generateSentiment(prev));
  }, []);

  useEffect(() => {
    const interval = setInterval(updateSentiment, 5000);
    return () => clearInterval(interval);
  }, [updateSentiment]);

  return (
    <div className="glass-card-premium rounded-xl card-hover-lift">
      <div className="flex items-center gap-2 mb-3 pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-xs font-semibold section-title-accent">Market Sentiment</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Live</span>
        </div>
      </div>
      <div className="px-3 pb-3 space-y-3">
        {/* Sentiment Gauge */}
        <SentimentGauge value={data.overallSentiment} />

        {/* Sentiment by Symbol */}
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">By Symbol</div>
          <div className="space-y-1.5">
            {SYMBOLS.map((sym) => {
              const val = data.symbolSentiment[sym];
              const bullish = val > 55;
              const bearish = val < 45;
              const color = bullish ? 'bg-emerald-500' : bearish ? 'bg-red-500' : 'bg-slate-500';
              return (
                <div key={sym} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16 flex-shrink-0 tabular-nums">
                    {SYMBOL_INFO[sym].name}
                  </span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${color}`}
                      initial={false}
                      animate={{ width: `${val}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      style={{ opacity: 0.7 }}
                    />
                  </div>
                  <div className="flex items-center gap-0.5 w-14 justify-end">
                    {bullish && <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />}
                    {bearish && <TrendingDown className="h-2.5 w-2.5 text-red-500" />}
                    {!bullish && !bearish && <Minus className="h-2.5 w-2.5 text-slate-500" />}
                    <span className={`text-[10px] tabular-nums font-medium ${
                      bullish ? 'text-emerald-400' : bearish ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      {val.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Retail vs Institutional */}
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Retail vs Institutional</div>
          <div className="space-y-1.5">
            <div>
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-muted-foreground">Retail</span>
                <span className="tabular-nums text-foreground/80">{data.retailSentiment.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-amber-500/70"
                  initial={false}
                  animate={{ width: `${data.retailSentiment}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-muted-foreground">Institutional</span>
                <span className="tabular-nums text-foreground/80">{data.institutionalSentiment.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-cyan-500/70"
                  initial={false}
                  animate={{ width: `${data.institutionalSentiment}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fear & Greed */}
        <FearGreedDisplay value={data.fearGreedIndex} />

        {/* Key Insights */}
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Key Insights</div>
          <motion.div
            className="space-y-1"
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {data.insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div className="w-1 h-1 rounded-full bg-purple-400/70 mt-1.5 flex-shrink-0" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">{insight}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

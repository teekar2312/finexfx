'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, MARKET_CONDITION_CONFIG, STRATEGIES, type Symbol, type MarketCondition, type StrategyName } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, TrendingUp, TrendingDown, Activity, Volume2, BarChart3, ArrowUpRight, ArrowDownRight,
  CircleDot, ShieldAlert, Clock, Copy, ChevronDown, ChevronUp, Zap, Target, Sparkles, BookOpen, Award, ArrowRight, Eye
} from 'lucide-react';
import MultiTimeframePanel from './MultiTimeframePanel';
import SignalDetailModal from './SignalDetailModal';
import CorrelationMatrix from './CorrelationMatrix';
import CandlestickPatternRecognition from './CandlestickPatternRecognition';
import type { TradingSignal } from '@/lib/types';

function getConditionIcon(condition: MarketCondition, size: number = 20) {
  switch (condition) {
    case 'trending': return <TrendingUp className={`h-${size === 20 ? 5 : size/4} w-${size === 20 ? 5 : size/4} text-emerald-500`} style={{ width: size, height: size }} />;
    case 'range_bound': return <Activity className="h-5 w-5 text-amber-500" style={{ width: size, height: size }} />;
    case 'high_volatility': return <Volume2 className="h-5 w-5 text-red-500" style={{ width: size, height: size }} />;
    case 'low_volatility': return <BarChart3 className="h-5 w-5 text-slate-500" style={{ width: size, height: size }} />;
  }
}

function getConditionIconLarge(condition: MarketCondition) {
  const cls = condition === 'trending' ? 'text-emerald-500 bg-emerald-500/10' :
    condition === 'range_bound' ? 'text-amber-500 bg-amber-500/10' :
    condition === 'high_volatility' ? 'text-red-500 bg-red-500/10' :
    'text-slate-500 bg-slate-500/10';
  return (
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cls}`}>
      {condition === 'trending' && <TrendingUp className="w-6 h-6 text-emerald-500" />}
      {condition === 'range_bound' && <Activity className="w-6 h-6 text-amber-500" />}
      {condition === 'high_volatility' && <Volume2 className="w-6 h-6 text-red-500" />}
      {condition === 'low_volatility' && <BarChart3 className="w-6 h-6 text-slate-500" />}
    </div>
  );
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'text-emerald-500';
  if (confidence >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function getConfidenceBg(confidence: number): string {
  if (confidence >= 80) return 'bg-emerald-500';
  if (confidence >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function getConfidenceStroke(confidence: number): string {
  if (confidence >= 80) return 'stroke-emerald-500';
  if (confidence >= 60) return 'stroke-amber-500';
  return 'stroke-red-500';
}

function ConfidenceGauge({ confidence, size = 48 }: { confidence: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // half circle
  const progress = (confidence / 100) * circumference;
  const color = confidence >= 80 ? '#10b981' : confidence >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size / 2 + strokeWidth} viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`} className="overflow-visible">
      {/* background arc */}
      <path
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-slate-700"
        strokeLinecap="round"
      />
      {/* progress arc */}
      <path
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
      />
    </svg>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getStrengthForCondition(condition: MarketCondition): number {
  // deterministic pseudo-random based on condition
  const seed = condition.length;
  return 60 + (seed * 7) % 36;
}

function getTrendArrow(condition: MarketCondition) {
  if (condition === 'trending') return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (condition === 'high_volatility') return <Activity className="h-3.5 w-3.5 text-red-500" />;
  if (condition === 'range_bound') return <ArrowRight className="h-3.5 w-3.5 text-amber-500" />;
  return <BarChart3 className="h-3.5 w-3.5 text-slate-500" />;
}

const strategyCategories: Record<StrategyName, { category: string; color: string }> = {
  MA_Ribbon: { category: 'Trend Following', color: 'border-emerald-500/30 bg-emerald-500/5' },
  Momentum_Scalping: { category: 'Scalping', color: 'border-amber-500/30 bg-amber-500/5' },
  Pivot_Points: { category: 'Support/Resistance', color: 'border-cyan-500/30 bg-cyan-500/5' },
  EMA_Crossover: { category: 'Trend Following', color: 'border-emerald-500/30 bg-emerald-500/5' },
  RMI_Trend_Sync: { category: 'Trend Following', color: 'border-emerald-500/30 bg-emerald-500/5' },
  Linear_Regression: { category: 'Statistical', color: 'border-violet-500/30 bg-violet-500/5' },
  EMA_RSI_Filter: { category: 'Multi-Signal', color: 'border-blue-500/30 bg-blue-500/5' },
};

function calculateCorrelation(prices1: number[], prices2: number[]): number {
  if (prices1.length !== prices2.length || prices1.length < 10) return 0;
  const n = prices1.length;
  const mean1 = prices1.reduce((a, b) => a + b, 0) / n;
  const mean2 = prices2.reduce((a, b) => a + b, 0) / n;
  let cov = 0, var1 = 0, var2 = 0;
  for (let i = 0; i < n; i++) {
    const d1 = prices1[i] - mean1;
    const d2 = prices2[i] - mean2;
    cov += d1 * d2;
    var1 += d1 * d1;
    var2 += d2 * d2;
  }
  if (var1 === 0 || var2 === 0) return 0;
  return cov / Math.sqrt(var1 * var2);
}

function getCorrelationColor(r: number): string {
  if (r > 0.5) return 'bg-emerald-500/20 text-emerald-400';
  if (r > 0.2) return 'bg-emerald-500/10 text-emerald-500/70';
  if (r < -0.5) return 'bg-red-500/20 text-red-400';
  if (r < -0.2) return 'bg-red-500/10 text-red-500/70';
  return 'bg-slate-500/10 text-slate-400';
}

function CorrelationGrid({ priceHistory }: { priceHistory: Record<Symbol, any[]> }) {
  const matrix = useMemo(() => {
    const closePrices: Record<string, number[]> = {};
    SYMBOLS.forEach((sym) => {
      const history = priceHistory[sym as Symbol];
      if (history && history.length >= 10) {
        closePrices[sym] = history.slice(-50).map((c: any) => c.close);
      } else {
        closePrices[sym] = [];
      }
    });

    const grid: number[][] = [];
    for (let i = 0; i < SYMBOLS.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < SYMBOLS.length; j++) {
        if (i === j) {
          row.push(1);
        } else {
          const p1 = closePrices[SYMBOLS[i]];
          const p2 = closePrices[SYMBOLS[j]];
          if (p1.length >= 10 && p2.length >= 10) {
            const len = Math.min(p1.length, p2.length);
            row.push(calculateCorrelation(p1.slice(-len), p2.slice(-len)));
          } else {
            row.push(0);
          }
        }
      }
      grid.push(row);
    }
    return grid;
  }, [priceHistory]);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Column headers */}
      <div className="flex items-center gap-1 pl-16">
        {SYMBOLS.map((sym) => (
          <div key={sym} className="w-16 h-6 flex items-center justify-center">
            <span className="text-[10px] font-medium text-muted-foreground">{sym}</span>
          </div>
        ))}
      </div>
      {/* Rows */}
      {SYMBOLS.map((sym, i) => (
        <div key={sym} className="flex items-center gap-1">
          <div className="w-16 h-12 flex items-center justify-end pr-2">
            <span className="text-[10px] font-medium text-muted-foreground">{sym}</span>
          </div>
          {SYMBOLS.map((_, j) => {
            const r = matrix[i]?.[j] ?? 0;
            const isDiag = i === j;
            return (
              <div
                key={`${i}-${j}`}
                className={`w-16 h-12 rounded-md flex items-center justify-center ${
                  isDiag ? 'bg-slate-700/50 text-foreground font-semibold' : getCorrelationColor(r)
                }`}
              >
                <span className="text-[10px] tabular-nums">{r.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function AnalysisView() {
  const { signals, marketConditions } = useTradingStore();
  const [expandedAnalysis, setExpandedAnalysis] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<TradingSignal | null>(null);
  const [signalModalOpen, setSignalModalOpen] = useState(false);

  const unexecutedSignals = signals.filter(s => !s.isExecuted);

  const latestSignalsBySymbol = SYMBOLS.map(sym => {
    const sig = signals.find(s => s.symbol === sym);
    return { symbol: sym, signal: sig };
  });

  const highestConfidenceSignal = signals.length > 0
    ? signals.reduce((best, s) => (s.confidence > best.confidence ? s : best), signals[0])
    : null;

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const sourceTags = useMemo(() => [
    { label: 'Central Bank', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { label: 'NFP', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { label: 'CPI', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { label: 'Technical', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    { label: 'Sentiment', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  ], []);

  return (
    <TooltipProvider delayDuration={200}>
    <div className="p-4 space-y-4 scrollbar-thin">
      {/* Candlestick Pattern Recognition */}
      <CandlestickPatternRecognition />

      {/* Currency Correlation Matrix - Enhanced */}
      <CorrelationMatrix />

      {/* Market Conditions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {SYMBOLS.map((sym) => {
          const condition = marketConditions[sym] || 'low_volatility';
          const config = MARKET_CONDITION_CONFIG[condition];
          const sig = signals.find(s => s.symbol === sym);
          const strength = getStrengthForCondition(condition);
          return (
            <motion.div
              key={sym}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: SYMBOLS.indexOf(sym) * 0.05 }}
            >
              <div className={`glass-card-premium rounded-xl card-hover-lift${sig && highestConfidenceSignal && sig.id === highestConfidenceSignal.id ? ' shimmer-border' : ''}`}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getTrendArrow(condition)}
                      <div className="text-sm font-bold">{SYMBOL_INFO[sym].name}</div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] px-2 ${config.color}`}>
                      {config.label}
                    </Badge>
                  </div>

                  {/* Larger colored icon + description */}
                  <div className="flex items-center gap-3 mb-3">
                    {getConditionIconLarge(condition)}
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-muted-foreground">Market State</div>
                      <div className="text-xs font-medium">{config.description}</div>
                    </div>
                  </div>

                  {/* Strength indicator */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">Strength</span>
                      <span className="text-[10px] tabular-nums font-medium text-foreground">{strength}%</span>
                    </div>
                    <div className="h-1.5 bg-accent rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          condition === 'trending' ? 'bg-emerald-500' :
                          condition === 'range_bound' ? 'bg-amber-500' :
                          condition === 'high_volatility' ? 'bg-red-500' :
                          'bg-slate-500'
                        }`}
                        style={{ width: `${strength}%` }}
                      />
                    </div>
                  </div>

                  {/* Characteristics as pill badges */}
                  {config.characteristics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {config.characteristics.map((ch, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/60 text-muted-foreground border border-border">
                          {ch}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Recommended strategies as clickable chips with tooltip */}
                  {config.bestStrategies.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Best Strategies</div>
                      <div className="flex flex-wrap gap-1">
                        {config.bestStrategies.map((strat) => (
                          <Tooltip key={strat}>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-primary/20 transition-colors"
                              >
                                <Zap className="h-2.5 w-2.5 mr-0.5" />
                                {STRATEGIES[strat].label}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[220px]">
                              <div className="text-[11px] font-medium">{STRATEGIES[strat].label}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{STRATEGIES[strat].description}</div>
                              <div className="text-[10px] mt-1">Timeframe: {STRATEGIES[strat].timeframe}</div>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  )}

                  {sig && (
                    <>
                      <Separator className="my-3 opacity-50" />
                      <div className={`flex items-center justify-between p-2 rounded-lg border-l-4 ${
                        sig.direction === 'BUY' ? 'bg-emerald-500/5 border-l-emerald-500 border border-emerald-500/20 glow-border-emerald' :
                        sig.direction === 'SELL' ? 'bg-red-500/5 border-l-red-500 border border-red-500/20 glow-border-amber' :
                        'bg-slate-500/5 border-l-slate-500 border border-slate-500/20'
                      }`}>
                        <div className="flex items-center gap-2">
                          {sig.direction === 'BUY' ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> :
                           sig.direction === 'SELL' ? <ArrowDownRight className="h-4 w-4 text-red-500" /> :
                           <Activity className="h-4 w-4 text-slate-500" />}
                          <div>
                            <div className="text-xs font-semibold">{sig.direction}</div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Zap className="h-2.5 w-2.5" />{STRATEGIES[sig.strategy]?.label || sig.strategy}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-bold tabular-nums ${getConfidenceColor(sig.confidence)}${sig.confidence >= 70 ? (sig.direction === 'BUY' ? ' gradient-text-profit' : sig.direction === 'SELL' ? ' gradient-text-loss' : '') : ''}`}>
                            {sig.confidence}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">confidence</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AI Analysis */}
        <div className="glass-card-premium rounded-xl card-hover-lift lg:col-span-2">
          <div className="flex items-center gap-2 mb-3 pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold section-title-accent">AI Market Analysis</span>
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              </div>
              {/* Confidence score gauge */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <ConfidenceGauge confidence={76} size={40} />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] font-bold tabular-nums text-emerald-500">76%</div>
                </div>
                <div className="text-[10px] text-muted-foreground">Overall<br/>Confidence</div>
              </div>
            </div>
          </div>
          <div className="px-4 pb-4">
            <div className="space-y-4">
              {/* Source Tags */}
              <div className="flex flex-wrap gap-1.5">
                {sourceTags.map((tag) => (
                  <span key={tag.label} className={`text-[9px] px-2 py-0.5 rounded-full border ${tag.color}`}>
                    {tag.label}
                  </span>
                ))}
              </div>

              {/* Summary line */}
              <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-[11px] text-foreground/90 leading-relaxed">
                    Markets show mixed signals today. EUR/USD in a clear uptrend with 82% confidence. USD/JPY experiencing range-bound conditions. Gold (XAU/USD) showing high volatility due to geopolitical tensions. Key catalyst: ECB meeting and NFP data release.
                  </div>
                </div>
              </div>

              {/* Key Factors */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Key Market Factors</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { label: 'Central Bank', status: 'ECB meeting this week', impact: 'high' as const },
                    { label: 'NFP Data', status: 'Expected: 180K', impact: 'high' as const },
                    { label: 'CPI Report', status: 'In line with forecast', impact: 'medium' as const },
                    { label: 'GDP Growth', status: 'Q3: 2.1%', impact: 'medium' as const },
                    { label: 'Geopolitical', status: 'Stable', impact: 'low' as const },
                    { label: 'Market Sentiment', status: 'Risk-on', impact: 'medium' as const },
                  ].map((factor) => (
                    <div key={factor.label} className="p-2 rounded-lg bg-accent/50 border border-border">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-medium">{factor.label}</span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1 py-0 ${
                            factor.impact === 'high' ? 'border-red-500/50 text-red-500' :
                            factor.impact === 'medium' ? 'border-amber-500/50 text-amber-500' :
                            'border-slate-500/50 text-slate-500'
                          }`}
                        >
                          {factor.impact}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">{factor.status}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expandable Full Analysis */}
              <div className="rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setExpandedAnalysis(!expandedAnalysis)}
                  className="w-full flex items-center justify-between p-2.5 bg-accent/30 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">View Full Analysis</span>
                  </div>
                  {expandedAnalysis ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                <AnimatePresence>
                  {expandedAnalysis && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 space-y-3 text-[11px] text-muted-foreground leading-relaxed">
                        <p><span className="text-foreground font-medium">EUR/USD:</span> The pair is showing strong bullish momentum on the 5-minute timeframe. The EMA crossover strategy has triggered a buy signal with 82% confidence. Key support at 1.0850, resistance at 1.0920. MACD histogram is expanding positively, confirming the uptrend. RSI at 64, still below overbought territory.</p>
                        <p><span className="text-foreground font-medium">USD/JPY:</span> Range-bound conditions between 154.20 and 154.80. Pivot Points strategy is active. Stochastic oscillator at 45, suggesting neutral momentum. Watch for a breakout above 154.80 for potential long entry.</p>
                        <p><span className="text-foreground font-medium">GBP/USD:</span> Cable has broken above the 1.2700 resistance level with increased volume. The MA Ribbon shows all three moving averages aligned bullishly. However, be cautious of potential pullback to the 1.2680 support zone.</p>
                        <p><span className="text-foreground font-medium">XAU/USD:</span> Gold is experiencing elevated volatility due to Middle East tensions. The ATR has expanded to 18.5, well above its 20-period average. Momentum Scalping strategy is active but with reduced position sizes recommended. Key levels: Support $2,640, Resistance $2,690.</p>
                        <p><span className="text-foreground font-medium">Risk Assessment:</span> Today&apos;s risk profile is elevated due to the ECB meeting and NFP data release. Recommended to reduce position sizes by 25-30% and avoid holding positions through major news events. The correlation between EUR and USD pairs suggests potential for whipsaw movements.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Separator className="opacity-50" />

              {/* Risk Considerations */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Risk Considerations</div>
                <div className="space-y-1.5">
                  {SYMBOLS.map((sym) => {
                    const condition = marketConditions[sym] || 'low_volatility';
                    const config = MARKET_CONDITION_CONFIG[condition];
                    return (
                      <div key={sym} className="flex items-start gap-2">
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-[11px] font-medium">{SYMBOL_INFO[sym].name}: </span>
                          <span className="text-[11px] text-muted-foreground">{config.riskConsiderations[0]}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator className="opacity-50" />

              {/* Strategy Recommendations */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Strategy Recommendations</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {SYMBOLS.map((sym) => {
                    const condition = marketConditions[sym] || 'low_volatility';
                    const config = MARKET_CONDITION_CONFIG[condition];
                    if (config.bestStrategies.length === 0) {
                      return (
                        <div key={sym} className="p-2 rounded-lg bg-slate-500/10 border border-slate-500/20">
                          <div className="text-[11px] font-medium text-slate-400">{SYMBOL_INFO[sym].name}</div>
                          <div className="text-[10px] text-slate-500">No recommended strategies - avoid trading</div>
                        </div>
                      );
                    }
                    return config.bestStrategies.map((strat) => (
                      <div key={`${sym}-${strat}`} className="p-2 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium">{SYMBOL_INFO[sym].name}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/30 text-primary">
                            {STRATEGIES[strat].timeframe}
                          </Badge>
                        </div>
                        <div className="text-[11px] font-medium text-primary mt-0.5">{STRATEGIES[strat].label}</div>
                        <div className="text-[10px] text-muted-foreground">{STRATEGIES[strat].description}</div>
                      </div>
                    ));
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Signal History - Enhanced with confidence gauge, prices, R:R, copy, time ago */}
        <div className="glass-card-premium rounded-xl card-hover-lift">
          <div className="flex items-center gap-2 mb-3 pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold section-title-accent">Signal History</span>
              <Badge variant="outline" className="text-[10px]">{signals.length} total</Badge>
            </div>
          </div>
          <div className="px-4 pb-3">
            {signals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No signals generated yet
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {signals.map((signal) => (
                    <motion.div
                      key={signal.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`rounded-lg border border-l-4 ${
                        signal.direction === 'BUY' ? 'border-l-emerald-500 border-emerald-500/20 bg-emerald-500/5' :
                        signal.direction === 'SELL' ? 'border-l-red-500 border-red-500/20 bg-red-500/5' :
                        'border-l-slate-500 border-border bg-accent/30'
                      }`}
                    >
                      <div className="p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            {signal.direction === 'BUY' ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> :
                             signal.direction === 'SELL' ? <ArrowDownRight className="h-3.5 w-3.5 text-red-500" /> :
                             <Activity className="h-3.5 w-3.5 text-muted-foreground" />}
                            <span className="text-xs font-semibold">{signal.symbol}</span>
                            <Badge
                              className={`text-[9px] px-1.5 py-0 font-semibold ${
                                signal.direction === 'BUY' ? 'badge-glow-emerald bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                signal.direction === 'SELL' ? 'badge-glow-red bg-red-500/20 text-red-400 border border-red-500/30' :
                                'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                              }`}
                            >
                              {signal.direction}
                            </Badge>
                            {/* Strategy name badge with icon */}
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary">
                              <Zap className="h-2 w-2 mr-0.5" />
                              {STRATEGIES[signal.strategy]?.label || signal.strategy}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {/* Confidence gauge */}
                            <div className="flex items-center gap-1">
                              <ConfidenceGauge confidence={signal.confidence} size={32} />
                              <div className={`text-xs font-bold tabular-nums ${getConfidenceColor(signal.confidence)}`}>
                                {signal.confidence}%
                              </div>
                            </div>
                            {signal.isExecuted && (
                              <Badge className="text-[8px] px-1 py-0 bg-primary/20 text-primary">EXEC</Badge>
                            )}
                          </div>
                        </div>

                        {/* Entry / SL / TP prices */}
                        <div className="flex items-center gap-3 mb-1.5 text-[10px]">
                          <div className="flex items-center gap-1">
                            <Target className="h-2.5 w-2.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Entry:</span>
                            <span className="tabular-nums font-medium">{signal.entryPrice.toFixed(SYMBOL_INFO[signal.symbol]?.digits || 5)}</span>
                          </div>
                          {signal.stopLoss && (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">SL:</span>
                              <span className="tabular-nums font-medium text-red-400">{signal.stopLoss.toFixed(SYMBOL_INFO[signal.symbol]?.digits || 5)}</span>
                            </div>
                          )}
                          {signal.takeProfit && (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">TP:</span>
                              <span className="tabular-nums font-medium text-emerald-400">{signal.takeProfit.toFixed(SYMBOL_INFO[signal.symbol]?.digits || 5)}</span>
                            </div>
                          )}
                          {signal.riskReward && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/30 text-amber-400">
                              R:R {signal.riskReward.toFixed(1)}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{signal.strategy} • {MARKET_CONDITION_CONFIG[signal.marketCondition].label}</span>
                          <div className="flex items-center gap-2">
                            {/* Time ago with clock icon */}
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-2.5 w-2.5" />
                              {timeAgo(signal.createdAt)}
                            </div>
                            {/* Detail button */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => { setSelectedSignal(signal); setSignalModalOpen(true); }}
                                  className="p-0.5 rounded hover:bg-accent transition-colors"
                                >
                                  <Eye className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <span className="text-[10px]">View Details</span>
                              </TooltipContent>
                            </Tooltip>
                            {/* Copy analysis button */}
                            {signal.aiAnalysis && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleCopy(signal.aiAnalysis!, signal.id)}
                                    className="p-0.5 rounded hover:bg-accent transition-colors"
                                  >
                                    {copiedId === signal.id ? (
                                      <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                      <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  <span className="text-[10px]">{copiedId === signal.id ? 'Copied!' : 'Copy Analysis'}</span>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                        {signal.aiAnalysis && (
                          <div className="mt-1.5 text-[10px] text-muted-foreground line-clamp-2">
                            {signal.aiAnalysis}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Timeframe Analysis */}
      <MultiTimeframePanel />

      {/* Strategy Reference Grid */}
      <div className="glass-card-premium rounded-xl card-hover-lift">
        <div className="flex items-center gap-2 mb-3 pb-2 pt-3 px-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold section-title-accent">Strategy Reference</span>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {(Object.keys(STRATEGIES) as StrategyName[]).map((strat, idx) => {
              const s = STRATEGIES[strat];
              const cat = strategyCategories[strat];
              return (
                <motion.div
                  key={strat}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <div className={`p-3 rounded-lg border ${cat.color}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold">{s.label}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-border text-muted-foreground">
                        {s.timeframe}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-2 line-clamp-2">{s.description}</p>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Best Conditions</div>
                    <div className="flex flex-wrap gap-1">
                      {s.bestMarketCondition.map((mc) => (
                        <Badge key={mc} variant="secondary" className="text-[9px] px-1.5 py-0">
                          {MARKET_CONDITION_CONFIG[mc].label}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2 text-[9px] text-muted-foreground">
                      <span className="text-foreground/70">Indicators:</span>{' '}
                      <span className="line-clamp-1">{s.indicators.join(', ')}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Signal Detail Modal */}
      <SignalDetailModal
        signal={selectedSignal}
        open={signalModalOpen}
        onOpenChange={setSignalModalOpen}
      />
    </div>
    </TooltipProvider>);
}
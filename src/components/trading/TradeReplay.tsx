'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Gauge,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  BarChart3,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, type Symbol, type PriceHistory, type TradeDirection } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReplayTrade {
  id: string;
  direction: TradeDirection;
  entryIndex: number;
  exitIndex: number | null;
  entryPrice: number;
  exitPrice: number | null;
  pips: number | null;
  pnl: number | null;
}

const SPEED_OPTIONS = [
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '5x', value: 5 },
  { label: '10x', value: 10 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TradeReplay() {
  // ── Store selectors (individual to avoid re-renders) ──
  const priceHistorySelector = useCallback(
    (state: { priceHistory: Record<Symbol, PriceHistory[]> }) => state.priceHistory,
    []
  );
  const priceHistory = useTradingStore(priceHistorySelector);

  // ── Local state ──
  const [selectedSymbol, setSelectedSymbol] = useState<Symbol>('EURUSD');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [replayTrades, setReplayTrades] = useState<ReplayTrade[]>([]);
  const [activeTrade, setActiveTrade] = useState<ReplayTrade | null>(null);

  // ── Refs ──
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPlayingRef = useRef(false);
  const speedRef = useRef(1);
  const currentIndexRef = useRef(0);

  // ── Derived data ──
  const history = useMemo(() => priceHistory[selectedSymbol] ?? [], [priceHistory, selectedSymbol]);
  const info = useMemo(() => SYMBOL_INFO[selectedSymbol], [selectedSymbol]);

  const visibleData = useMemo(() => history.slice(0, currentIndex + 1), [history, currentIndex]);

  const currentTick = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= history.length) return null;
    return history[currentIndex];
  }, [history, currentIndex]);

  // Chart domain
  const { minPrice, maxPrice } = useMemo(() => {
    if (visibleData.length === 0) return { minPrice: 0, maxPrice: 1 };
    const prices = visibleData.flatMap(d => [d.high, d.low]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1 || 0.001;
    return { minPrice: min - padding, maxPrice: max + padding };
  }, [visibleData]);

  // ── P&L calculation for active trade ──
  const activeTradePnl = useMemo(() => {
    if (!activeTrade || !currentTick) return null;
    const exit = currentTick.close;
    const entry = activeTrade.entryPrice;
    const pips = activeTrade.direction === 'BUY'
      ? (exit - entry) / info.pipSize
      : (entry - exit) / info.pipSize;
    // Assume 0.1 lot for P&L: $1 per pip for forex, $1 per pip for gold with 0.01 lot
    const lotMultiplier = selectedSymbol === 'XAUUSD' ? 1 : 10;
    const pnl = pips * 0.1 * lotMultiplier;
    return { pips: Math.round(pips * 10) / 10, pnl: Math.round(pnl * 100) / 100 };
  }, [activeTrade, currentTick, info.pipSize, selectedSymbol]);

  // ── Statistics ──
  const stats = useMemo(() => {
    const closedTrades = replayTrades.filter(t => t.exitIndex !== null);
    const totalTrades = closedTrades.length;
    const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0).length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const bestTrade = totalTrades > 0 ? Math.max(...closedTrades.map(t => t.pnl ?? 0)) : 0;
    const worstTrade = totalTrades > 0 ? Math.min(...closedTrades.map(t => t.pnl ?? 0)) : 0;

    const holdTimes = closedTrades.map(t => {
      if (t.exitIndex === null) return 0;
      return (history[t.exitIndex]?.time ?? 0) - (history[t.entryIndex]?.time ?? 0);
    });
    const avgHoldTime = holdTimes.length > 0
      ? holdTimes.reduce((s, t) => s + t, 0) / holdTimes.length
      : 0;

    return { totalTrades, winRate, totalPnl, bestTrade, worstTrade, avgHoldTime };
  }, [replayTrades, history]);

  // ── Timer management ──
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const interval = Math.max(50, Math.round(500 / speedRef.current));
    timerRef.current = setInterval(() => {
      if (!isPlayingRef.current) return;
      setCurrentIndex(prev => {
        const next = prev + 1;
        if (next >= history.length) {
          setIsPlaying(false);
          isPlayingRef.current = false;
          if (timerRef.current) clearInterval(timerRef.current);
          return prev;
        }
        currentIndexRef.current = next;
        return next;
      });
    }, interval);
  }, [history.length]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Sync speed ref and restart timer
  useEffect(() => {
    speedRef.current = speed;
    if (isPlayingRef.current) {
      startTimer();
    }
  }, [speed, startTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Control handlers ──
  const handlePlayPause = useCallback(() => {
    if (history.length === 0) return;
    if (isPlayingRef.current) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      stopTimer();
    } else {
      if (currentIndexRef.current >= history.length - 1) {
        setCurrentIndex(0);
        currentIndexRef.current = 0;
      }
      setIsPlaying(true);
      isPlayingRef.current = true;
      startTimer();
    }
  }, [history.length, startTimer, stopTimer]);

  const handleStepForward = useCallback(() => {
    stopTimer();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentIndex(prev => {
      const next = Math.min(prev + 1, history.length - 1);
      currentIndexRef.current = next;
      return next;
    });
  }, [history.length, stopTimer]);

  const handleStepBackward = useCallback(() => {
    stopTimer();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentIndex(prev => {
      const next = Math.max(prev - 1, 0);
      currentIndexRef.current = next;
      return next;
    });
  }, [stopTimer]);

  const handleSliderChange = useCallback((value: number[]) => {
    stopTimer();
    setIsPlaying(false);
    isPlayingRef.current = false;
    const idx = value[0];
    setCurrentIndex(idx);
    currentIndexRef.current = idx;
  }, [stopTimer]);

  const handleReset = useCallback(() => {
    stopTimer();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setReplayTrades([]);
    setActiveTrade(null);
  }, [stopTimer]);

  const handleSpeedChange = useCallback((value: string) => {
    setSpeed(parseFloat(value));
  }, []);

  // ── Trade handlers ──
  const handleOpenTrade = useCallback((direction: TradeDirection) => {
    if (!currentTick) return;
    if (activeTrade) return; // Only one trade at a time
    const trade: ReplayTrade = {
      id: `rt-${Date.now()}`,
      direction,
      entryIndex: currentIndex,
      exitIndex: null,
      entryPrice: currentTick.close,
      exitPrice: null,
      pips: null,
      pnl: null,
    };
    setActiveTrade(trade);
  }, [currentTick, currentIndex, activeTrade]);

  const handleCloseTrade = useCallback(() => {
    if (!activeTrade || !currentTick) return;
    const exitPrice = currentTick.close;
    const entryPrice = activeTrade.entryPrice;
    const pips = activeTrade.direction === 'BUY'
      ? (exitPrice - entryPrice) / info.pipSize
      : (entryPrice - exitPrice) / info.pipSize;
    const lotMultiplier = selectedSymbol === 'XAUUSD' ? 1 : 10;
    const pnl = pips * 0.1 * lotMultiplier;

    const closedTrade: ReplayTrade = {
      ...activeTrade,
      exitIndex: currentIndex,
      exitPrice,
      pips: Math.round(pips * 10) / 10,
      pnl: Math.round(pnl * 100) / 100,
    };
    setReplayTrades(prev => [...prev, closedTrade]);
    setActiveTrade(null);
  }, [activeTrade, currentTick, currentIndex, info.pipSize, selectedSymbol]);

  const handleSymbolChange = useCallback((value: string) => {
    stopTimer();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setReplayTrades([]);
    setActiveTrade(null);
    setSelectedSymbol(value as Symbol);
  }, [stopTimer]);

  // ── Chart tooltip ──
  const tooltipContent = ({ active, payload }: { active?: boolean; payload?: Array<{ payload?: PriceHistory }> }) => {
    if (!active || !payload || !payload.length || !payload[0].payload) return null;
    const d = payload[0].payload;
    if (!d) return null;
    const isGreen = d.close >= d.open;
    const color = isGreen ? '#10b981' : '#ef4444';
    return (
      <div className="glass-card-premium rounded-lg p-3 text-[11px] shadow-lg min-w-[140px]">
        <div className="text-[10px] text-muted-foreground mb-1.5 font-medium">{formatTime(d.time)}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <div className="flex items-center gap-1.5"><span className="text-muted-foreground">O</span><span className="font-mono font-bold" style={{ color }}>{d.open.toFixed(info.digits)}</span></div>
          <div className="flex items-center gap-1.5"><span className="text-muted-foreground">H</span><span className="font-mono font-bold" style={{ color }}>{d.high.toFixed(info.digits)}</span></div>
          <div className="flex items-center gap-1.5"><span className="text-muted-foreground">L</span><span className="font-mono font-bold" style={{ color }}>{d.low.toFixed(info.digits)}</span></div>
          <div className="flex items-center gap-1.5"><span className="text-muted-foreground">C</span><span className="font-mono font-bold" style={{ color }}>{d.close.toFixed(info.digits)}</span></div>
        </div>
      </div>
    );
  };

  // Chart data (computed before conditional return to satisfy rules-of-hooks)
  const chartData = useMemo(() => {
    return visibleData;
  }, [visibleData]);

  // ── No data state ──
  if (history.length === 0) {
    return (
      <div className="glass-card-premium rounded-xl p-6 flex flex-col items-center justify-center gap-4 min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-muted-foreground"
        >
          <BarChart3 className="h-10 w-10" />
        </motion.div>
        <p className="text-sm text-muted-foreground">Wait for price data to accumulate</p>
        <p className="text-xs text-muted-foreground">Select a pair and ensure live prices are streaming</p>
      </div>
    );
  }

  return (
    <div className="glass-card-premium rounded-xl p-4 flex flex-col gap-4">
      {/* ── Header: Pair Selector + Title ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-foreground">Trade Replay</h2>
          </div>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            {info.name}
          </Badge>
        </div>
        <Select value={selectedSymbol} onValueChange={handleSymbolChange}>
          <SelectTrigger size="sm" className="w-[140px] h-8 text-xs bg-muted/50 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYMBOLS.map(sym => (
              <SelectItem key={sym} value={sym} className="text-xs">
                {SYMBOL_INFO[sym].name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator className="bg-border" />

      {/* ── Controls Bar ── */}
      <motion.div
        className="flex items-center gap-2 flex-wrap"
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStepBackward}
          disabled={currentIndex <= 0}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          title="Step Back"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handlePlayPause}
          disabled={history.length === 0}
          className="h-9 w-9 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isPlaying ? 'pause' : 'play'}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </motion.div>
          </AnimatePresence>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleStepForward}
          disabled={currentIndex >= history.length - 1}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          title="Step Forward"
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1.5 ml-1">
          <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={String(speed)} onValueChange={handleSpeedChange}>
            <SelectTrigger size="sm" className="w-[70px] h-7 text-[11px] bg-muted/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEED_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[120px] ml-2">
          <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{currentIndex + 1}</span>
          <Slider
            value={[currentIndex]}
            min={0}
            max={Math.max(history.length - 1, 0)}
            step={1}
            onValueChange={handleSliderChange}
            className="flex-1"
          />
          <span className="text-[10px] font-mono text-muted-foreground w-8">{history.length}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-400 hover:bg-amber-900/20"
          title="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </motion.div>

      {/* ── Price Chart ── */}
      <div className="relative w-full h-[280px] rounded-lg overflow-hidden bg-muted/30">
        {/* Current price display */}
        {currentTick && (
          <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
            <span className={`text-xs font-mono font-bold ${currentTick.close >= currentTick.open ? 'text-emerald-400' : 'text-red-400'}`}>
              {currentTick.close.toFixed(info.digits)}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] font-mono ${currentTick.close >= currentTick.open ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/30 text-red-400'}`}
            >
              {formatTime(currentTick.time)}
            </Badge>
          </div>
        )}

        {/* Active trade price line */}
        {activeTrade && (
          <div className="absolute top-2 right-3 z-10 flex items-center gap-2">
            <Badge
              className={`text-[10px] font-mono ${activeTrade.direction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
            >
              {activeTrade.direction === 'BUY' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {activeTrade.direction} @ {activeTrade.entryPrice.toFixed(info.digits)}
            </Badge>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 30, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="replay-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              tick={{ fontSize: 9, fill: '#64748b' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
              minTickGap={50}
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              tickFormatter={(v: number) => v.toFixed(info.digits)}
              tick={{ fontSize: 9, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              width={70}
            />
            <RechartsTooltip content={tooltipContent} />

            {/* Entry price reference line */}
            {activeTrade && (
              <ReferenceLine
                y={activeTrade.entryPrice}
                stroke={activeTrade.direction === 'BUY' ? '#10b981' : '#ef4444'}
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: `Entry ${activeTrade.entryPrice.toFixed(info.digits)}`,
                  position: 'insideTopLeft',
                  fill: activeTrade.direction === 'BUY' ? '#10b981' : '#ef4444',
                  fontSize: 9,
                }}
              />
            )}

            <Line
              type="monotone"
              dataKey="close"
              stroke="#10b981"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: '#fbbf24', stroke: '#fbbf24', strokeWidth: 2 }}
              animationDuration={0}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Practice Trade Buttons + Active P&L ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {!activeTrade ? (
          <>
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                size="sm"
                onClick={() => handleOpenTrade('BUY')}
                disabled={currentIndex >= history.length - 1}
                className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-1.5"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Buy
              </Button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                size="sm"
                onClick={() => handleOpenTrade('SELL')}
                disabled={currentIndex >= history.length - 1}
                className="h-8 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold gap-1.5"
              >
                <TrendingDown className="h-3.5 w-3.5" />
                Sell
              </Button>
            </motion.div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTradePnl?.pips ?? 0}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-3"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">P&L</span>
                  <span className={`text-sm font-mono font-bold ${(activeTradePnl?.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(activeTradePnl?.pnl ?? 0) >= 0 ? '+' : ''}{(activeTradePnl?.pnl ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Pips</span>
                  <span className={`text-sm font-mono font-bold ${(activeTradePnl?.pips ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(activeTradePnl?.pips ?? 0) >= 0 ? '+' : ''}{(activeTradePnl?.pips ?? 0).toFixed(1)}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                size="sm"
                onClick={handleCloseTrade}
                className="h-8 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold gap-1.5"
              >
                <Target className="h-3.5 w-3.5" />
                Close Trade
              </Button>
            </motion.div>
          </div>
        )}

        {/* Replay progress info */}
        <div className="flex items-center gap-2 ml-auto">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-mono text-muted-foreground">
            {formatTime(history[0]?.time ?? 0)} → {formatTime(currentTick?.time ?? 0)}
          </span>
        </div>
      </div>

      <Separator className="bg-border" />

      {/* ── Bottom: Statistics + Trade History ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Statistics Panel */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            <h3 className="text-xs font-semibold text-foreground">Session Statistics</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/40 rounded-lg p-2.5 flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">Trades</span>
              <span className="text-sm font-mono font-bold text-foreground">{stats.totalTrades}</span>
            </div>
            <div className="bg-muted/40 rounded-lg p-2.5 flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">Win Rate</span>
              <span className={`text-sm font-mono font-bold ${stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.winRate.toFixed(0)}%
              </span>
            </div>
            <div className="bg-muted/40 rounded-lg p-2.5 flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">Total P&L</span>
              <span className={`text-sm font-mono font-bold ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)}
              </span>
            </div>
            <div className="bg-muted/40 rounded-lg p-2.5 flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">Best Trade</span>
              <span className="text-sm font-mono font-bold text-emerald-400">+{stats.bestTrade.toFixed(2)}</span>
            </div>
            <div className="bg-muted/40 rounded-lg p-2.5 flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">Worst Trade</span>
              <span className="text-sm font-mono font-bold text-red-400">{stats.worstTrade.toFixed(2)}</span>
            </div>
            <div className="bg-muted/40 rounded-lg p-2.5 flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">Avg Hold</span>
              <span className="text-sm font-mono font-bold text-foreground">{formatDuration(stats.avgHoldTime)}</span>
            </div>
          </div>
        </div>

        {/* Trade History */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-foreground">Practice Trades</h3>
            </div>
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
              {replayTrades.length}
            </Badge>
          </div>
          <div className="max-h-[120px] overflow-y-auto custom-scrollbar rounded-lg bg-muted/30">
            {replayTrades.length === 0 ? (
              <div className="flex items-center justify-center h-[80px] text-muted-foreground text-xs">
                No practice trades yet. Click Buy or Sell during replay.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {replayTrades.map((trade) => {
                  const isWin = (trade.pnl ?? 0) > 0;
                  const entryTime = history[trade.entryIndex]?.time ?? 0;
                  const exitTime = trade.exitIndex !== null ? (history[trade.exitIndex]?.time ?? 0) : 0;
                  const holdMs = exitTime - entryTime;
                  return (
                    <motion.div
                      key={trade.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex items-center gap-2 px-3 py-2 text-[11px]"
                    >
                      <Badge
                        className={`text-[9px] font-mono ${trade.direction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
                      >
                        {trade.direction}
                      </Badge>
                      <span className="font-mono text-muted-foreground">
                        {trade.entryPrice.toFixed(info.digits)} → {trade.exitPrice?.toFixed(info.digits) ?? '...'}
                      </span>
                      <span className={`font-mono font-bold ml-auto ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isWin ? '+' : ''}{trade.pnl?.toFixed(2) ?? '...'}
                      </span>
                      <span className={`font-mono text-[10px] ${isWin ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                        {trade.pips !== null ? `${trade.pips >= 0 ? '+' : ''}${trade.pips.toFixed(1)}p` : ''}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-1">
                        {formatDuration(holdMs)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── End-of-replay warning ── */}
      {currentIndex >= history.length - 1 && !isPlaying && replayTrades.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-900/20 border border-amber-500/20"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300">
            Replay complete. Review your {replayTrades.length} practice trade{replayTrades.length !== 1 ? 's' : ''} or reset to try again.
          </span>
        </motion.div>
      )}
    </div>
  );
}
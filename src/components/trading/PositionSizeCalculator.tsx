'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SYMBOLS, SYMBOL_INFO, BROKER_CONFIG, type Symbol } from '@/lib/types';
import { useTradingStore } from '@/store/trading-store';
import { useShallow } from 'zustand/react/shallow';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calculator,
  Target,
  DollarSign,
  ArrowRight,
  Percent,
  TrendingUp,
  TrendingDown,
  Info,
  Clock,
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const RISK_PRESETS = [1, 2, 3, 5] as const;

const CONTRACT_SIZES: Record<Symbol, number> = {
  EURUSD: 100_000,
  USDJPY: 100_000,
  GBPUSD: 100_000,
  XAUUSD: 100,
};

/** Realistic mock swap rates (USD per 1 standard lot, per day) */
const SWAP_RATES: Record<Symbol, { long: number; short: number }> = {
  EURUSD: { long: -3.2, short: -1.8 },
  USDJPY: { long: 2.5, short: -4.1 },
  GBPUSD: { long: -1.5, short: -3.8 },
  XAUUSD: { long: -12.5, short: -8.2 },
};

type SwapPeriod = 'daily' | 'weekly' | 'monthly';

// ── Helper: safe number parser ──────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseNum(raw: string, fallback: number, min: number, max: number): number {
  const n = parseFloat(raw);
  if (Number.isNaN(n) || n < min || n > max) return clamp(fallback, min, max);
  return clamp(n, min, max);
}

// ── Sub-components ───────────────────────────────────────────────────────────

function RiskPresetChips({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground mr-1">Quick Presets:</span>
      {RISK_PRESETS.map((pct) => (
        <button
          key={pct}
          type="button"
          onClick={() => onSelect(pct)}
          className={`
            inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium
            transition-all duration-200 cursor-pointer
            ${
              selected === pct
                ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
            }
          `}
        >
          <Percent className="h-3 w-3" />
          {pct}%
        </button>
      ))}
    </div>
  );
}

function ResultRow({
  label,
  value,
  icon: Icon,
  color = 'text-foreground',
  prefix = '',
  suffix = '',
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
  color?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between py-1.5"
    >
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className={`text-sm font-mono font-semibold tabular-nums ${color}`}>
        {prefix}
        {value}
        {suffix}
      </span>
    </motion.div>
  );
}

function PairSelector({
  value,
  onChange,
}: {
  value: Symbol;
  onChange: (v: Symbol) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Currency Pair</Label>
      <Select value={value} onValueChange={(v) => onChange(v as Symbol)}>
        <SelectTrigger className="w-full h-9 text-sm font-mono">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SYMBOLS.map((s) => (
            <SelectItem key={s} value={s} className="font-mono text-sm">
              {SYMBOL_INFO[s].name}
              <span className="ml-2 text-muted-foreground text-xs">
                ({SYMBOL_INFO[s].category})
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Tab 1: Position Size Calculator ───────────────────────────────────────────

function PositionSizeTab() {
  const { balance } = useTradingStore(
    useShallow((s) => ({ balance: s.balance }))
  );

  const [pair, setPair] = useState<Symbol>('EURUSD');
  const [balanceInput, setBalanceInput] = useState(balance.toString());
  const [riskPct, setRiskPct] = useState(2);
  const [slPips, setSlPips] = useState(20);
  const [tpPips, setTpPips] = useState('');

  const info = SYMBOL_INFO[pair];
  const contractSize = CONTRACT_SIZES[pair];

  const parsedBalance = useMemo(
    () => parseNum(balanceInput, balance, 1, 1_000_000),
    [balanceInput, balance]
  );
  const parsedSlPips = useMemo(
    () => parseNum(slPips.toString(), 20, 1, 1000),
    [slPips]
  );
  const parsedTpPips = useMemo(() => {
    if (!tpPips) return 0;
    return parseNum(tpPips, 0, 1, 5000);
  }, [tpPips]);

  // Pip value per standard lot for the selected pair
  const pipValuePerStdLot = useMemo(() => {
    if (info.quoteCurrency === 'USD') {
      // EURUSD, GBPUSD: pip value = pipSize × contractSize
      return info.pipSize * contractSize;
    }
    // USDJPY, XAUUSD where base is USD or metal
    // For USDJPY: pip value in JPY = pipSize × contractSize, convert to USD
    // For XAUUSD: pip value = pipSize × contractSize (already in USD)
    if (pair === 'USDJPY') {
      // Approximate conversion rate ~150
      return (info.pipSize * contractSize) / 150;
    }
    // XAUUSD
    return info.pipSize * contractSize;
  }, [info, pair, contractSize]);

  // Core calculation
  const results = useMemo(() => {
    const riskAmount = parsedBalance * (riskPct / 100);
    const pipValuePerLot = pipValuePerStdLot;
    const lotSize = pipValuePerLot > 0
      ? riskAmount / (parsedSlPips * pipValuePerLot)
      : 0;
    const clampedLot = clamp(
      Math.round(lotSize * 100) / 100,
      BROKER_CONFIG.minLotSize,
      BROKER_CONFIG.maxLotSize
    );

    // Margin = notional value / leverage
    let notionalValue: number;
    if (pair === 'USDJPY') {
      notionalValue = clampedLot * contractSize / 150;
    } else if (pair === 'XAUUSD') {
      notionalValue = clampedLot * contractSize * 2050;
    } else {
      notionalValue = clampedLot * contractSize * 1.09;
    }
    const marginRequired = notionalValue / BROKER_CONFIG.leverage;

    // R:R ratio
    const rrRatio =
      parsedTpPips > 0
        ? parseFloat((parsedTpPips / parsedSlPips).toFixed(2))
        : 0;

    return {
      riskAmount,
      pipValuePerLot: pipValuePerStdLot,
      lotSize: clampedLot,
      marginRequired,
      rrRatio,
    };
  }, [
    parsedBalance,
    riskPct,
    parsedSlPips,
    parsedTpPips,
    pipValuePerStdLot,
    pair,
    contractSize,
  ]);

  const handlePresetSelect = useCallback((pct: number) => {
    setRiskPct(pct);
  }, []);

  return (
    <div className="space-y-4">
      <RiskPresetChips selected={riskPct} onSelect={handlePresetSelect} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PairSelector value={pair} onChange={setPair} />

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Account Balance ($)</Label>
          <Input
            type="number"
            min={1}
            max={1_000_000}
            step={100}
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            className="h-9 font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Risk Per Trade (%)
          </Label>
          <Input
            type="number"
            min={0.1}
            max={10}
            step={0.1}
            value={riskPct}
            onChange={(e) =>
              setRiskPct(parseNum(e.target.value, 2, 0.1, 10))
            }
            className="h-9 font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Stop Loss (pips)
          </Label>
          <Input
            type="number"
            min={1}
            max={1000}
            step={1}
            value={slPips}
            onChange={(e) =>
              setSlPips(parseNum(e.target.value, 20, 1, 1000))
            }
            className="h-9 font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">
            Take Profit (pips) — optional for R:R
          </Label>
          <Input
            type="number"
            min={1}
            max={5000}
            step={1}
            placeholder="e.g. 40"
            value={tpPips}
            onChange={(e) => setTpPips(e.target.value)}
            className="h-9 font-mono text-sm"
          />
        </div>
      </div>

      <Separator />

      <motion.div
        key={`${pair}-${riskPct}-${slPips}-${tpPips}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-1"
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Calculator className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
            Results
          </span>
        </div>

        <ResultRow
          label="Recommended Lot Size"
          value={results.lotSize.toFixed(2)}
          icon={Target}
          color="text-emerald-400"
          suffix=" lots"
        />
        <ResultRow
          label="Risk Amount"
          value={`$${results.riskAmount.toFixed(2)}`}
          icon={DollarSign}
          color="text-amber-400"
        />
        <ResultRow
          label={`Pip Value (per lot)`}
          value={`$${results.pipValuePerLot.toFixed(2)}`}
          icon={ArrowRight}
        />
        <ResultRow
          label="Margin Required"
          value={`$${results.marginRequired.toFixed(2)}`}
          icon={AlertTriangle}
          color="text-sky-400"
        />
        {results.rrRatio > 0 && (
          <ResultRow
            label="Risk : Reward Ratio"
            value={`1 : ${results.rrRatio}`}
            icon={Target}
            color={
              results.rrRatio >= 2
                ? 'text-emerald-400'
                : results.rrRatio >= 1.5
                  ? 'text-amber-400'
                  : 'text-red-400'
            }
          />
        )}
      </motion.div>
    </div>
  );
}

// ── Tab 2: Pip Value Calculator ──────────────────────────────────────────────

function PipValueTab() {
  const [pair, setPair] = useState<Symbol>('EURUSD');
  const [lotSize, setLotSize] = useState(0.1);
  const [pipMovement, setPipMovement] = useState(10);

  const info = SYMBOL_INFO[pair];
  const contractSize = CONTRACT_SIZES[pair];

  const pipValuePerLot = useMemo(() => {
    if (info.quoteCurrency === 'USD') {
      return info.pipSize * contractSize;
    }
    if (pair === 'USDJPY') {
      return (info.pipSize * contractSize) / 150;
    }
    return info.pipSize * contractSize;
  }, [info, pair, contractSize]);

  const results = useMemo(() => {
    const perLot = pipValuePerLot;
    const totalPipValue = perLot * lotSize;
    const movementValue = totalPipValue * pipMovement;
    return {
      pipValuePerLot: perLot,
      totalPipValue,
      movementValue,
      pipSize: info.pipSize,
    };
  }, [pipValuePerLot, lotSize, pipMovement, info.pipSize]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PairSelector value={pair} onChange={setPair} />

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Lot Size</Label>
          <Input
            type="number"
            min={BROKER_CONFIG.minLotSize}
            max={BROKER_CONFIG.maxLotSize}
            step={0.01}
            value={lotSize}
            onChange={(e) =>
              setLotSize(
                parseNum(e.target.value, 0.1, BROKER_CONFIG.minLotSize, BROKER_CONFIG.maxLotSize)
              )
            }
            className="h-9 font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">
            Pip Movement (pips)
          </Label>
          <Input
            type="number"
            min={1}
            max={5000}
            step={1}
            value={pipMovement}
            onChange={(e) =>
              setPipMovement(parseNum(e.target.value, 10, 1, 5000))
            }
            className="h-9 font-mono text-sm"
          />
        </div>
      </div>

      <Separator />

      <motion.div
        key={`${pair}-${lotSize}-${pipMovement}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-1"
      >
        <div className="flex items-center gap-1.5 mb-2">
          <DollarSign className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
            Pip Value Breakdown
          </span>
        </div>

        <ResultRow
          label={`Pip Size (${pair})`}
          value={results.pipSize.toString()}
          icon={Info}
        />
        <ResultRow
          label="Pip Value per Standard Lot"
          value={`$${results.pipValuePerLot.toFixed(2)}`}
          icon={DollarSign}
        />
        <ResultRow
          label={`Pip Value @ ${lotSize.toFixed(2)} lots`}
          value={`$${results.totalPipValue.toFixed(2)}`}
          icon={ArrowRight}
          color="text-emerald-400"
        />
        <ResultRow
          label={`P&L for ${pipMovement} pips`}
          value={`$${results.movementValue.toFixed(2)}`}
          icon={
            results.movementValue >= 0 ? TrendingUp : TrendingDown
          }
          color={results.movementValue >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
      </motion.div>

      <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 mt-2">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <Info className="inline h-3 w-3 mr-1" />
          Pip value calculation uses {SYMBOL_INFO[pair].name} pip size of{' '}
          <span className="font-mono text-foreground">{info.pipSize}</span>.
          For USDJPY, approximate conversion rate of 150 is used. Actual pip
          value may vary slightly with real-time exchange rates.
        </p>
      </div>
    </div>
  );
}

// ── Tab 3: Risk/Reward Visualizer ────────────────────────────────────────────

function RiskRewardTab() {
  const [slPips, setSlPips] = useState(20);
  const [tpPips, setTpPips] = useState(40);
  const [riskAmount, setRiskAmount] = useState(100);

  const total = slPips + tpPips;
  const rrRatio = slPips > 0 ? parseFloat((tpPips / slPips).toFixed(2)) : 0;
  const rewardAmount = slPips > 0 ? riskAmount * rrRatio : 0;
  const slPct = total > 0 ? (slPips / total) * 100 : 50;
  const tpPct = total > 0 ? (tpPips / total) * 100 : 50;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Stop Loss (pips)
          </Label>
          <Input
            type="number"
            min={1}
            max={1000}
            step={1}
            value={slPips}
            onChange={(e) =>
              setSlPips(parseNum(e.target.value, 20, 1, 1000))
            }
            className="h-9 font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Take Profit (pips)
          </Label>
          <Input
            type="number"
            min={1}
            max={5000}
            step={1}
            value={tpPips}
            onChange={(e) =>
              setTpPips(parseNum(e.target.value, 40, 1, 5000))
            }
            className="h-9 font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Risk Amount ($)
          </Label>
          <Input
            type="number"
            min={1}
            max={100_000}
            step={10}
            value={riskAmount}
            onChange={(e) =>
              setRiskAmount(parseNum(e.target.value, 100, 1, 100_000))
            }
            className="h-9 font-mono text-sm"
          />
        </div>
      </div>

      <Separator />

      {/* Visual Bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Target className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
            Risk : Reward Visual
          </span>
        </div>

        {/* R:R Ratio display */}
        <motion.div
          key={`rr-${rrRatio}`}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="text-center py-3"
        >
          <span className="text-3xl font-mono font-bold text-foreground">
            1 : {rrRatio}
          </span>
          <p className="text-xs text-muted-foreground mt-1">
            Risk-to-Reward Ratio
          </p>
        </motion.div>

        {/* Horizontal bar */}
        <div className="relative w-full h-12 rounded-lg overflow-hidden flex">
          {/* SL zone */}
          <motion.div
            key={`sl-${slPips}`}
            initial={{ width: 0 }}
            animate={{ width: `${slPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative flex items-center justify-center bg-gradient-to-r from-red-500/30 to-red-500/15 border-r border-white/10"
          >
            <span className="text-[10px] font-mono text-red-300 font-semibold drop-shadow-sm">
              SL: {slPips} pips
            </span>
          </motion.div>

          {/* Entry marker */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 400 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
          >
            <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
            <span className="text-[9px] text-white font-semibold mt-0.5 bg-black/50 px-1 rounded">
              ENTRY
            </span>
          </motion.div>

          {/* TP zone */}
          <motion.div
            key={`tp-${tpPips}`}
            initial={{ width: 0 }}
            animate={{ width: `${tpPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative flex items-center justify-center bg-gradient-to-r from-emerald-500/15 to-emerald-500/30 border-l border-white/10"
          >
            <span className="text-[10px] font-mono text-emerald-300 font-semibold drop-shadow-sm">
              TP: {tpPips} pips
            </span>
          </motion.div>
        </div>

        {/* Dollar amounts */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            key={`sl-amt-${riskAmount}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center"
          >
            <span className="text-[10px] text-red-400 uppercase tracking-wide font-semibold">
              Risk
            </span>
            <p className="text-lg font-mono font-bold text-red-400">
              -${riskAmount.toFixed(2)}
            </p>
          </motion.div>
          <motion.div
            key={`tp-amt-${rewardAmount}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center"
          >
            <span className="text-[10px] text-emerald-400 uppercase tracking-wide font-semibold">
              Reward
            </span>
            <p className="text-lg font-mono font-bold text-emerald-400">
              +${rewardAmount.toFixed(2)}
            </p>
          </motion.div>
        </div>

        {/* Required win rate */}
        <motion.div
          key={`wr-${rrRatio}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Minimum Win Rate to Break Even
            </span>
            <span
              className={`text-sm font-mono font-semibold ${
                rrRatio >= 2
                  ? 'text-emerald-400'
                  : rrRatio >= 1
                    ? 'text-amber-400'
                    : 'text-red-400'
              }`}
            >
              {slPips > 0
                ? `${((1 / (1 + rrRatio)) * 100).toFixed(1)}%`
                : '—'}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ── Tab 4: Swap Calculator ────────────────────────────────────────────────────

function SwapTab() {
  const [pair, setPair] = useState<Symbol>('EURUSD');
  const [lotSize, setLotSize] = useState(0.1);
  const [days, setDays] = useState(7);
  const [period, setPeriod] = useState<SwapPeriod>('weekly');

  const info = SYMBOL_INFO[pair];
  const swapInfo = SWAP_RATES[pair];
  const contractSize = CONTRACT_SIZES[pair];

  const daysMap: Record<SwapPeriod, number> = {
    daily: 1,
    weekly: 5,
    monthly: 22,
  };

  const activeDays = daysMap[period];

  const results = useMemo(() => {
    // Swap cost is typically per standard lot; scale by actual lot size
    const dailyLong = swapInfo.long * lotSize;
    const dailyShort = swapInfo.short * lotSize;
    const weeklyLong = dailyLong * activeDays;
    const weeklyShort = dailyShort * activeDays;
    const monthlyLong = dailyLong * 22;
    const monthlyShort = dailyShort * 22;

    const selectedDays = period === 'daily' ? 1 : period === 'weekly' ? days : days;
    const totalLong = swapInfo.long * lotSize * selectedDays;
    const totalShort = swapInfo.short * lotSize * selectedDays;

    return {
      dailyLong,
      dailyShort,
      weeklyLong,
      weeklyShort,
      monthlyLong,
      monthlyShort,
      totalLong,
      totalShort,
      periodDays: selectedDays,
    };
  }, [swapInfo, lotSize, activeDays, days, period]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PairSelector value={pair} onChange={setPair} />

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Lot Size</Label>
          <Input
            type="number"
            min={BROKER_CONFIG.minLotSize}
            max={BROKER_CONFIG.maxLotSize}
            step={0.01}
            value={lotSize}
            onChange={(e) =>
              setLotSize(
                parseNum(e.target.value, 0.1, BROKER_CONFIG.minLotSize, BROKER_CONFIG.maxLotSize)
              )
            }
            className="h-9 font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Period</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as SwapPeriod)}>
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Daily
                </span>
              </SelectItem>
              <SelectItem value="weekly">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Weekly (5 days)
                </span>
              </SelectItem>
              <SelectItem value="monthly">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Monthly (~22 days)
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Days Held ({period})
          </Label>
          <Input
            type="number"
            min={1}
            max={365}
            step={1}
            value={period === 'daily' ? 1 : period === 'weekly' ? 5 : 22}
            disabled={period !== 'daily'}
            onChange={(e) =>
              setDays(parseNum(e.target.value, 7, 1, 365))
            }
            className="h-9 font-mono text-sm"
          />
        </div>
      </div>

      <Separator />

      {/* Swap rates table */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
            Swap Rates per Standard Lot
          </span>
        </div>

        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-white/[0.04]">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">
                  Pair
                </th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">
                  Long
                </th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">
                  Short
                </th>
              </tr>
            </thead>
            <tbody>
              {SYMBOLS.map((s) => (
                <motion.tr
                  key={s}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: SYMBOLS.indexOf(s) * 0.05 }}
                  className={`border-t border-white/[0.04] ${
                    s === pair ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]'
                  } transition-colors`}
                >
                  <td className="py-2 px-3 font-mono text-foreground font-medium">
                    {SYMBOL_INFO[s].name}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-mono ${
                      SWAP_RATES[s].long >= 0
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }`}
                  >
                    {SWAP_RATES[s].long >= 0 ? '+' : ''}
                    {SWAP_RATES[s].long.toFixed(1)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-mono ${
                      SWAP_RATES[s].short >= 0
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }`}
                  >
                    {SWAP_RATES[s].short >= 0 ? '+' : ''}
                    {SWAP_RATES[s].short.toFixed(1)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Separator />

      {/* Selected pair calculation */}
      <motion.div
        key={`${pair}-${lotSize}-${period}-${days}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-1"
      >
        <div className="flex items-center gap-1.5 mb-2">
          <DollarSign className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
            Estimated Swap Cost @ {lotSize.toFixed(2)} lots {info.name}
          </span>
        </div>

        {/* Long position */}
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Long Position
            </span>
            <span
              className={`text-sm font-mono font-bold ${
                results.totalLong >= 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }`}
            >
              {results.totalLong >= 0 ? '+' : ''}
              ${results.totalLong.toFixed(2)}
            </span>
          </div>
          <div className="flex gap-4 text-[10px] text-muted-foreground">
            <span>Daily: ${results.dailyLong.toFixed(2)}</span>
            <span>Weekly: ${results.weeklyLong.toFixed(2)}</span>
            <span>Monthly: ${results.monthlyLong.toFixed(2)}</span>
          </div>
        </div>

        {/* Short position */}
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-red-400 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Short Position
            </span>
            <span
              className={`text-sm font-mono font-bold ${
                results.totalShort >= 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }`}
            >
              {results.totalShort >= 0 ? '+' : ''}
              ${results.totalShort.toFixed(2)}
            </span>
          </div>
          <div className="flex gap-4 text-[10px] text-muted-foreground">
            <span>Daily: ${results.dailyShort.toFixed(2)}</span>
            <span>Weekly: ${results.weeklyShort.toFixed(2)}</span>
            <span>Monthly: ${results.monthlyShort.toFixed(2)}</span>
          </div>
        </div>
      </motion.div>

      <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <Info className="inline h-3 w-3 mr-1" />
          Swap rates are indicative and reflect typical FINEX Indonesia broker
          charges. Triple swap is charged on Wednesday rollover (covers weekend).
          Rates vary with market conditions and interest rate differentials.
        </p>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PositionSizeCalculator() {
  const [activeTab, setActiveTab] = useState<
    'position' | 'pip' | 'rr' | 'swap'
  >('position');

  const tabs = [
    {
      value: 'position' as const,
      label: 'Position Size',
      icon: Calculator,
    },
    {
      value: 'pip' as const,
      label: 'Pip Value',
      icon: DollarSign,
    },
    {
      value: 'rr' as const,
      label: 'Risk/Reward',
      icon: Target,
    },
    {
      value: 'swap' as const,
      label: 'Swap',
      icon: Zap,
    },
  ];

  return (
    <Card className="glass-card-premium border-white/[0.06] gap-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
            <Calculator className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Trade Calculator
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Position sizing, pip value, risk/reward &amp; swap costs
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <Tabs
          value={activeTab}
          onValueChange={(v) =>
            setActiveTab(v as 'position' | 'pip' | 'rr' | 'swap')
          }
        >
          <TabsList className="w-full h-9 bg-white/[0.04] rounded-lg p-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 gap-1 text-xs data-[state=active]:bg-white/[0.08] data-[state=active]:text-foreground rounded-md px-2 h-7"
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-3"
            >
              <TabsContent value="position" className="mt-0">
                <PositionSizeTab />
              </TabsContent>
              <TabsContent value="pip" className="mt-0">
                <PipValueTab />
              </TabsContent>
              <TabsContent value="rr" className="mt-0">
                <RiskRewardTab />
              </TabsContent>
              <TabsContent value="swap" className="mt-0">
                <SwapTab />
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </Card>
  );
}

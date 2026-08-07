'use client';

import { useState, useMemo } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { useShallow } from 'zustand/react/shallow';
import { BROKER_CONFIG, SYMBOL_INFO, type Symbol } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Calculator, DollarSign, Target, Zap, CheckCircle, ArrowRight } from 'lucide-react';
import PositionSizeCalculator from './PositionSizeCalculator';
import { SYMBOLS } from '@/lib/types';
import { motion } from 'framer-motion';

function DonutGauge({ value, max, size = 80, strokeWidth = 6, showPercent = false }: { value: number; max: number; size?: number; strokeWidth?: number; showPercent?: boolean }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(value / max, 1);
  const offset = circumference * (1 - ratio);
  const isSafe = ratio < 0.5;
  const isWarn = ratio >= 0.5 && ratio < 0.8;
  const isDanger = ratio >= 0.8;
  const color = isSafe ? '#10b981' : isWarn ? '#f59e0b' : '#ef4444';
  const glowColor = isSafe ? 'rgba(16,185,129,0.35)' : isWarn ? 'rgba(245,158,11,0.35)' : 'rgba(239,68,68,0.35)';
  const pct = Math.round(ratio * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative inline-flex items-center justify-center"
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <filter id={`gauge-glow-${size}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        {/* Glow layer */}
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth + 4}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s', opacity: 0.2, filter: `drop-shadow(0 0 6px ${glowColor})` }}
        />
        {/* Main arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s' }}
          filter={`url(#gauge-glow-${size})`}
        />
      </svg>
      {showPercent && (
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <span className={`text-sm font-bold tabular-nums ${isSafe ? 'text-emerald-400' : isWarn ? 'text-amber-400' : 'text-red-400'}`}>{pct}%</span>
        </div>
      )}
    </motion.div>
  );
}

export default function RiskView() {
  const {
    riskSettings, balance, equity, margin, todayRiskUsed, todayTradeCount, openTrades,
  } = useTradingStore(
    useShallow((s) => ({
      riskSettings: s.riskSettings, balance: s.balance, equity: s.equity, margin: s.margin,
      todayRiskUsed: s.todayRiskUsed, todayTradeCount: s.todayTradeCount, openTrades: s.openTrades,
    }))
  );
  const setRiskSettings = useTradingStore((s) => s.setRiskSettings);
  const addNotification = useTradingStore((s) => s.addNotification);
  const setSuggestedLotSize = useTradingStore((s) => s.setSuggestedLotSize);

  const [calcSymbol, setCalcSymbol] = useState<Symbol>('EURUSD');
  const [calcBalance, setCalcBalance] = useState(balance.toString());
  const [calcRisk, setCalcRisk] = useState(riskSettings.riskPerTrade.toString());
  const [calcSL, setCalcSL] = useState(riskSettings.stopLossPips.toString());

  const dailyRiskPercent = (todayRiskUsed / balance) * 100;
  const dailyRiskLimitPercent = riskSettings.dailyRiskLimit;
  const isDailyLimitWarning = dailyRiskPercent >= dailyRiskLimitPercent * 0.8;
  const isDailyLimitReached = dailyRiskPercent >= dailyRiskLimitPercent;
  const dailyRiskRatio = Math.min(dailyRiskPercent / dailyRiskLimitPercent, 1);

  const dailyTargetAmount = (riskSettings.dailyTargetPercent / 100) * balance;
  const dailyPnl = equity - balance;
  const dailyTargetRatio = Math.min(Math.max(dailyPnl / dailyTargetAmount, 0), 1);

  const remainingTrades = Math.max(0, riskSettings.maxDailyTrades - todayTradeCount);
  const remainingRiskAmount = Math.max(0, (dailyRiskLimitPercent / 100) * balance - todayRiskUsed);

  const riskPerTradeAmount = (parseFloat(calcRisk) / 100) * (parseFloat(calcBalance) || balance);
  const slPips = parseFloat(calcSL) || 1;
  const pipValue = SYMBOL_INFO[calcSymbol].category === 'forex' ? 10 : 100;
  const calculatedLotSize = useMemo(() => {
    const riskAmt = (parseFloat(calcRisk) / 100) * (parseFloat(calcBalance) || balance);
    const sl = parseFloat(calcSL) || 1;
    const pv = SYMBOL_INFO[calcSymbol].category === 'forex' ? 10 : 100;
    const lot = riskAmt / (sl * pv);
    return Math.max(BROKER_CONFIG.minLotSize, Math.min(lot, BROKER_CONFIG.maxLotSize));
  }, [calcRisk, calcSL, calcBalance, calcSymbol, balance]);

  const potentialLoss = riskPerTradeAmount;
  const potentialGain = potentialLoss * riskSettings.riskRewardRatio;

  const handleApplyLotSize = () => {
    setSuggestedLotSize(calculatedLotSize);
    addNotification({ type: 'success', title: 'Lot Size Applied', message: `Suggested lot size set to ${calculatedLotSize.toFixed(2)}` });
  };

  const handleSaveSettings = () => {
    addNotification({ type: 'success', title: 'Risk Settings Saved', message: 'Risk parameters have been updated.' });
  };

  const maxRiskPerTrade = (riskSettings.riskPerTrade / 100) * balance;
  const maxDailyRisk = (riskSettings.dailyRiskLimit / 100) * balance;
  const marginUsage = balance > 0 ? (margin / balance * 100) : 0;

  const riskRules = [
    { name: 'Risk per Trade', range: '0.5% – 1%', current: `${riskSettings.riskPerTrade}%`, ok: riskSettings.riskPerTrade >= 0.5 && riskSettings.riskPerTrade <= 1 },
    { name: 'Stop Loss', range: '5 – 15 pips', current: `${riskSettings.stopLossPips} pips`, ok: riskSettings.stopLossPips >= 5 && riskSettings.stopLossPips <= 15 },
    { name: 'R:R Ratio', range: '1:1.5', current: `1:${riskSettings.riskRewardRatio}`, ok: riskSettings.riskRewardRatio >= 1.5 },
    { name: 'Max Positions', range: '1-3', current: `${riskSettings.maxSimultaneousPositions}`, ok: riskSettings.maxSimultaneousPositions >= 1 && riskSettings.maxSimultaneousPositions <= 3 },
    { name: 'Daily Risk Limit', range: '2%-3%', current: `${riskSettings.dailyRiskLimit}%`, ok: riskSettings.dailyRiskLimit >= 2 && riskSettings.dailyRiskLimit <= 3 },
    { name: 'Avoid Major News When Scalping', range: 'Enabled', current: riskSettings.avoidMajorNews ? 'On' : 'Off', ok: riskSettings.avoidMajorNews },
    { name: 'Daily Target', range: '1%-3%', current: `${riskSettings.dailyTargetPercent}%`, ok: riskSettings.dailyTargetPercent >= 1 && riskSettings.dailyTargetPercent <= 3 },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Daily Risk Dashboard */}
      <div className={`glass-card-premium rounded-xl p-4 card-hover-lift ${isDailyLimitReached ? 'neon-glow-red border border-red-500/50' : isDailyLimitWarning ? 'neon-glow-amber border border-amber-500/50' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className={`h-4 w-4 ${isDailyLimitReached ? 'text-red-500' : isDailyLimitWarning ? 'text-amber-500' : 'text-emerald-500'}`} />
              <span className="text-sm font-semibold"><span className="section-title-accent">Daily Risk Dashboard</span></span>
            </div>
            <span className={`text-xs tabular-nums font-bold ${isDailyLimitReached ? 'text-red-500' : isDailyLimitWarning ? 'text-amber-500' : 'text-emerald-500'}`}>
              {dailyRiskPercent.toFixed(2)}% / {dailyRiskLimitPercent}%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto] gap-4 items-center">
            {/* Donut Gauge */}
            <div className="relative flex items-center justify-center">
              <DonutGauge value={dailyRiskPercent} max={dailyRiskLimitPercent} size={88} strokeWidth={8} showPercent={false} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-sm font-bold tabular-nums ${isDailyLimitReached ? 'text-red-500' : isDailyLimitWarning ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {Math.round(dailyRiskRatio * 100)}%
                </span>
                <span className="text-[9px] text-muted-foreground">used</span>
              </div>
            </div>

            {/* Risk Bar */}
            <div className="flex-1">
              {/* Premium gradient risk bar */}
              <div className="risk-bar-premium h-2.5 rounded-full overflow-hidden bg-muted/50">
                <motion.div
                  className={`risk-bar-fill-premium h-full rounded-full ${isDailyLimitReached ? 'from-red-600 to-red-400' : isDailyLimitWarning ? 'from-amber-600 to-amber-400' : 'from-emerald-600 to-emerald-400'} bg-gradient-to-r`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(dailyRiskPercent, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground">
                  ${todayRiskUsed.toFixed(2)} used of ${maxDailyRisk.toFixed(2)} max
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {todayTradeCount} / {riskSettings.maxDailyTrades} trades today
                </span>
              </div>

              {/* Daily Target Progress */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Daily Target Progress</span>
                  <span className={`text-[10px] font-medium tabular-nums ${dailyPnl >= dailyTargetAmount ? 'text-emerald-500' : dailyPnl >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
                    ${Math.max(0, dailyPnl).toFixed(2)} / ${dailyTargetAmount.toFixed(2)}
                  </span>
                </div>
                <div className="risk-bar-premium h-1.5 rounded-full overflow-hidden bg-muted/50">
                  <motion.div
                    className={`risk-bar-fill-premium h-full rounded-full ${dailyPnl >= dailyTargetAmount ? 'from-emerald-600 to-emerald-400' : dailyPnl >= 0 ? 'from-amber-600 to-amber-400' : 'from-red-600 to-red-400'} bg-gradient-to-r`}
                    initial={{ width: 0 }}
                    animate={{ width: `${dailyTargetRatio * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>

            {/* Remaining Trades */}
            <div className="text-center min-w-[60px] metric-compact">
              <div className={`text-2xl font-bold tabular-nums ${remainingTrades > 3 ? 'text-emerald-500' : remainingTrades > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                {remainingTrades}
              </div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Trades Left</div>
            </div>

            {/* Remaining Risk */}
            <div className="text-center min-w-[80px] metric-compact">
              <div className={`text-2xl font-bold tabular-nums ${remainingRiskAmount > 100 ? 'text-emerald-500' : remainingRiskAmount > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                ${remainingRiskAmount.toFixed(0)}
              </div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Risk Left</div>
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-children">
        {/* Risk Settings Form */}
        <div className="glass-card-premium rounded-xl p-4 card-hover-lift">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold section-title-accent">Risk Settings</span>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">Risk Per Trade (%)</Label>
                <Input
                  type="number"
                  value={riskSettings.riskPerTrade}
                  onChange={(e) => setRiskSettings({ riskPerTrade: parseFloat(e.target.value) || 0 })}
                  step="0.1" min="0.1" max="10"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Stop Loss (pips)</Label>
                <Input
                  type="number"
                  value={riskSettings.stopLossPips}
                  onChange={(e) => setRiskSettings({ stopLossPips: parseInt(e.target.value) || 0 })}
                  step="1" min="1"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Take Profit (pips)</Label>
                <Input
                  type="number"
                  value={riskSettings.takeProfitPips}
                  onChange={(e) => setRiskSettings({ takeProfitPips: parseInt(e.target.value) || 0 })}
                  step="1" min="1"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">R:R Ratio</Label>
                <Input
                  type="number"
                  value={riskSettings.riskRewardRatio}
                  onChange={(e) => setRiskSettings({ riskRewardRatio: parseFloat(e.target.value) || 0 })}
                  step="0.1" min="0.5"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Max Positions</Label>
                <Input
                  type="number"
                  value={riskSettings.maxSimultaneousPositions}
                  onChange={(e) => setRiskSettings({ maxSimultaneousPositions: parseInt(e.target.value) || 1 })}
                  step="1" min="1" max="20"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Daily Risk Limit (%)</Label>
                <Input
                  type="number"
                  value={riskSettings.dailyRiskLimit}
                  onChange={(e) => setRiskSettings({ dailyRiskLimit: parseFloat(e.target.value) || 0 })}
                  step="0.5" min="1" max="20"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Daily Target (%)</Label>
                <Input
                  type="number"
                  value={riskSettings.dailyTargetPercent}
                  onChange={(e) => setRiskSettings({ dailyTargetPercent: parseFloat(e.target.value) || 0 })}
                  step="0.5" min="0.5"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Max Daily Trades</Label>
                <Input
                  type="number"
                  value={riskSettings.maxDailyTrades}
                  onChange={(e) => setRiskSettings({ maxDailyTrades: parseInt(e.target.value) || 1 })}
                  step="1" min="1" max="50"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
            </div>
            <Button onClick={handleSaveSettings} className="w-full bg-primary hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-transform" size="sm">
              Save Risk Settings
            </Button>
          </div>
        </div>

        {/* Position Size Calculator - Enhanced */}
        <div className="space-y-4">
          <div className="glass-card-premium rounded-xl p-4 card-hover-lift border-emerald-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold section-title-accent">Position Size Calculator</span>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">Symbol</Label>
                <Select value={calcSymbol} onValueChange={(v) => setCalcSymbol(v as Symbol)}>
                  <SelectTrigger className="h-8 text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYMBOLS.map(sym => (
                      <SelectItem key={sym} value={sym}>{SYMBOL_INFO[sym].name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Account Balance ($)</Label>
                  <Input
                    type="number"
                    value={calcBalance}
                    onChange={(e) => setCalcBalance(e.target.value)}
                    className="h-8 text-sm tabular-nums mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Risk (%)</Label>
                  <Input
                    type="number"
                    value={calcRisk}
                    onChange={(e) => setCalcRisk(e.target.value)}
                    step="0.1" min="0.1" max="10"
                    className="h-8 text-sm tabular-nums mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Stop Loss (pips)</Label>
                <Input
                  type="number"
                  value={calcSL}
                  onChange={(e) => setCalcSL(e.target.value)}
                  step="1" min="1"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>

              <Separator className="opacity-50" />

              {/* Step-by-step calculation */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Calculation Steps</div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground min-w-[100px]">Risk Amount:</span>
                  <span className="tabular-nums font-medium text-amber-500">
                    ${parseFloat(calcBalance || '0').toLocaleString()} × {parseFloat(calcRisk || '0')}% = <b>${riskPerTradeAmount.toFixed(2)}</b>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground min-w-[100px]">Pip Value:</span>
                  <span className="tabular-nums font-medium">
                    ${pipValue}/pip ({SYMBOL_INFO[calcSymbol].category === 'forex' ? 'forex' : 'gold'} {calcSymbol})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground min-w-[100px]">SL Risk ($):</span>
                  <span className="tabular-nums font-medium text-red-400">
                    {slPips} pips × ${pipValue} = <b>${(slPips * pipValue).toFixed(2)}/lot</b>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground min-w-[100px]">Lot Size:</span>
                  <span className="tabular-nums font-medium">
                    ${riskPerTradeAmount.toFixed(2)} / ${(slPips * pipValue).toFixed(2)} = <b className="text-primary">{calculatedLotSize.toFixed(2)} lots</b>
                  </span>
                </div>
              </div>

              <Separator className="opacity-50" />

              {/* Result */}
              <div className="risk-calc-result p-3 rounded-lg">
                <div className="text-[10px] uppercase tracking-wider text-emerald-500 mb-1">Recommended Lot Size</div>
                <div className="text-3xl font-bold text-emerald-500 tabular-nums">{calculatedLotSize.toFixed(2)}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Min: {BROKER_CONFIG.minLotSize} • Max: {BROKER_CONFIG.maxLotSize}
                </div>
              </div>

              <Button onClick={handleApplyLotSize} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-[1.02] active:scale-[0.98] transition-transform" size="sm">
                <ArrowRight className="h-3.5 w-3.5 mr-1" />
                Apply to Trade
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Money Management Summary */}
      <div className="glass-card-premium rounded-xl p-4 card-hover-lift">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold section-title-accent">Money Management Summary</span>
        </div>
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 stagger-children">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 metric-compact">
              <div className="text-[10px] text-emerald-500 mb-0.5">Max Risk / Trade</div>
              <div className="text-lg font-bold text-emerald-500 tabular-nums">${maxRiskPerTrade.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground">{riskSettings.riskPerTrade}% × ${balance.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 metric-compact">
              <div className="text-[10px] text-red-500 mb-0.5">Max Daily Risk</div>
              <div className="text-lg font-bold text-red-500 tabular-nums">${maxDailyRisk.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground">{riskSettings.dailyRiskLimit}% daily limit</div>
            </div>
            <div className="p-3 rounded-lg bg-accent/50 border border-border metric-compact">
              <div className="text-[10px] text-amber-500 mb-0.5">Potential Profit</div>
              <div className="text-lg font-bold text-emerald-500 tabular-nums">+${potentialGain.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground">per trade ({riskSettings.riskRewardRatio}:1 R:R)</div>
            </div>
            <div className="p-3 rounded-lg bg-accent/50 border border-border metric-compact">
              <div className="text-[10px] text-muted-foreground mb-0.5">Potential Loss</div>
              <div className="text-lg font-bold text-red-500 tabular-nums">-${potentialLoss.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground">per trade ({riskSettings.stopLossPips} pips)</div>
            </div>
          </div>

          {/* R:R Visual Bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground">Risk : Reward Ratio</span>
              <span className="text-[11px] font-bold tabular-nums">1 : {riskSettings.riskRewardRatio}</span>
            </div>
            <div className="h-6 rounded-md overflow-hidden flex bg-muted/50">
              <div className="bg-red-500/60 flex items-center justify-center transition-all" style={{ width: `${(1 / (1 + riskSettings.riskRewardRatio)) * 100}%` }}>
                <span className="text-[9px] font-bold text-foreground/90">RISK</span>
              </div>
              <div className="bg-emerald-500/60 flex items-center justify-center transition-all" style={{ width: `${(riskSettings.riskRewardRatio / (1 + riskSettings.riskRewardRatio)) * 100}%` }}>
                <span className="text-[9px] font-bold text-foreground/90">REWARD</span>
              </div>
            </div>
          </div>

          {/* Margin Usage */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground">Current Margin Usage</span>
              <span className={`text-[11px] font-bold tabular-nums ${marginUsage > 50 ? 'text-red-500' : marginUsage > 20 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {marginUsage.toFixed(1)}%
              </span>
            </div>
            <div className="risk-bar-premium h-1.5 rounded-full overflow-hidden bg-muted/50">
              <motion.div
                className={`risk-bar-fill-premium h-full rounded-full ${marginUsage > 50 ? 'from-red-600 to-red-400' : marginUsage > 20 ? 'from-amber-600 to-amber-400' : 'from-emerald-600 to-emerald-400'} bg-gradient-to-r`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(marginUsage, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">${margin.toFixed(2)} used</span>
              <span className="text-[10px] text-muted-foreground">{openTrades.length} open position{openTrades.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Rules Display */}
      <div className="glass-card-premium rounded-xl p-4 card-hover-lift">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold section-title-accent">Risk Rules Reference</span>
          <Badge variant="outline" className="text-[10px] ml-auto">
            {riskRules.filter(r => r.ok).length}/{riskRules.length} compliant
          </Badge>
        </div>
        <div className="space-y-1.5 stagger-children">
          {riskRules.map((rule) => (
            <motion.div
              key={rule.name}
              whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.03)' }}
              className={`risk-rule-card flex items-center gap-3 py-2 px-3 rounded-lg border-l-[3px] transition-colors ${rule.ok ? 'border-l-emerald-500/60 bg-emerald-500/[0.03]' : 'border-l-red-500/60 bg-red-500/[0.03]'}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${rule.ok ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                <CheckCircle className={`h-3.5 w-3.5 ${rule.ok ? 'text-emerald-500' : 'text-red-500/50'}`} />
              </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium">{rule.name}</span>
                    <span className="text-[10px] text-muted-foreground">{rule.range}</span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] flex-shrink-0 ${rule.ok ? 'border-emerald-500/50 text-emerald-500' : 'border-red-500/50 text-red-500'}`}
                >
                  {rule.current}
                </Badge>
              </motion.div>
            ))}
        </div>
      </div>

      {/* Position Size Calculator & Tools */}
      <PositionSizeCalculator />
    </div>
  );
}

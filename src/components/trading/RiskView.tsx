'use client';

import { useState, useMemo } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { BROKER_CONFIG, SYMBOL_INFO, type Symbol } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, AlertTriangle, Calculator, TrendingUp, TrendingDown, DollarSign, Target, Zap } from 'lucide-react';
import { SYMBOLS } from '@/lib/types';

export default function RiskView() {
  const {
    riskSettings, setRiskSettings, balance, todayRiskUsed, todayTradeCount, openTrades,
    addNotification,
  } = useTradingStore();

  const [calcSymbol, setCalcSymbol] = useState<Symbol>('EURUSD');
  const [calcRisk, setCalcRisk] = useState(riskSettings.riskPerTrade.toString());
  const [calcSL, setCalcSL] = useState(riskSettings.stopLossPips.toString());

  const dailyRiskPercent = (todayRiskUsed / balance) * 100;
  const dailyRiskLimitPercent = riskSettings.dailyRiskLimit;
  const isDailyLimitWarning = dailyRiskPercent >= dailyRiskLimitPercent * 0.8;
  const isDailyLimitReached = dailyRiskPercent >= dailyRiskLimitPercent;

  const calculatedLotSize = useMemo(() => {
    const riskAmount = (parseFloat(calcRisk) / 100) * balance;
    const slPips = parseFloat(calcSL) || 1;
    const pipValue = SYMBOL_INFO[calcSymbol].category === 'forex' ? 10 : 1;
    const lotSize = riskAmount / (slPips * pipValue);
    return Math.max(BROKER_CONFIG.minLotSize, Math.min(lotSize, BROKER_CONFIG.maxLotSize));
  }, [calcRisk, calcSL, calcSymbol, balance]);

  const potentialLoss = (parseFloat(calcRisk) / 100) * balance;
  const potentialGain = potentialLoss * riskSettings.riskRewardRatio;

  const handleSaveSettings = () => {
    addNotification({ type: 'success', title: 'Risk Settings Saved', message: 'Risk parameters have been updated.' });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Daily Risk Usage */}
      <Card className={`glass-card ${isDailyLimitReached ? 'border-red-500/50' : isDailyLimitWarning ? 'border-amber-500/50' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield className={`h-4 w-4 ${isDailyLimitReached ? 'text-red-500' : isDailyLimitWarning ? 'text-amber-500' : 'text-emerald-500'}`} />
              <span className="text-sm font-semibold">Daily Risk Usage</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs tabular-nums font-bold ${isDailyLimitReached ? 'text-red-500' : isDailyLimitWarning ? 'text-amber-500' : 'text-emerald-500'}`}>
                {dailyRiskPercent.toFixed(2)}% / {dailyRiskLimitPercent}%
              </span>
              {isDailyLimitReached && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
            </div>
          </div>
          <Progress
            value={Math.min(dailyRiskPercent, 100)}
            className={`h-2 ${isDailyLimitReached ? '[&>div]:bg-red-500' : isDailyLimitWarning ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground">
              ${todayRiskUsed.toFixed(2)} used of ${((dailyRiskLimitPercent / 100) * balance).toFixed(2)} max
            </span>
            <span className="text-[10px] text-muted-foreground">
              {todayTradeCount} / {riskSettings.maxDailyTrades} trades today
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk Settings Form */}
        <Card className="glass-card">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Risk Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">Risk Per Trade (%)</Label>
                <Input
                  type="number"
                  value={riskSettings.riskPerTrade}
                  onChange={(e) => setRiskSettings({ riskPerTrade: parseFloat(e.target.value) || 0 })}
                  step="0.1"
                  min="0.1"
                  max="10"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Stop Loss (pips)</Label>
                <Input
                  type="number"
                  value={riskSettings.stopLossPips}
                  onChange={(e) => setRiskSettings({ stopLossPips: parseInt(e.target.value) || 0 })}
                  step="1"
                  min="1"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Take Profit (pips)</Label>
                <Input
                  type="number"
                  value={riskSettings.takeProfitPips}
                  onChange={(e) => setRiskSettings({ takeProfitPips: parseInt(e.target.value) || 0 })}
                  step="1"
                  min="1"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">R:R Ratio</Label>
                <Input
                  type="number"
                  value={riskSettings.riskRewardRatio}
                  onChange={(e) => setRiskSettings({ riskRewardRatio: parseFloat(e.target.value) || 0 })}
                  step="0.1"
                  min="0.5"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Max Positions</Label>
                <Input
                  type="number"
                  value={riskSettings.maxSimultaneousPositions}
                  onChange={(e) => setRiskSettings({ maxSimultaneousPositions: parseInt(e.target.value) || 1 })}
                  step="1"
                  min="1"
                  max="20"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Daily Risk Limit (%)</Label>
                <Input
                  type="number"
                  value={riskSettings.dailyRiskLimit}
                  onChange={(e) => setRiskSettings({ dailyRiskLimit: parseFloat(e.target.value) || 0 })}
                  step="0.5"
                  min="1"
                  max="20"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Daily Target (%)</Label>
                <Input
                  type="number"
                  value={riskSettings.dailyTargetPercent}
                  onChange={(e) => setRiskSettings({ dailyTargetPercent: parseFloat(e.target.value) || 0 })}
                  step="0.5"
                  min="0.5"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Max Daily Trades</Label>
                <Input
                  type="number"
                  value={riskSettings.maxDailyTrades}
                  onChange={(e) => setRiskSettings({ maxDailyTrades: parseInt(e.target.value) || 1 })}
                  step="1"
                  min="1"
                  max="50"
                  className="h-8 text-sm tabular-nums mt-1"
                />
              </div>
            </div>
            <Button onClick={handleSaveSettings} className="w-full bg-primary hover:bg-primary/90" size="sm">
              Save Risk Settings
            </Button>
          </CardContent>
        </Card>

        {/* Position Sizing Calculator */}
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Position Sizing Calculator</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
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
                  <Label className="text-[11px] text-muted-foreground">Account Balance</Label>
                  <div className="h-8 text-sm mt-1 flex items-center tabular-nums font-medium">$
                    {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Risk Amount</Label>
                  <div className="h-8 text-sm mt-1 flex items-center tabular-nums font-medium text-amber-500">
                    ${potentialLoss.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Risk (%)</Label>
                  <Input
                    type="number"
                    value={calcRisk}
                    onChange={(e) => setCalcRisk(e.target.value)}
                    step="0.1"
                    min="0.1"
                    max="10"
                    className="h-8 text-sm tabular-nums mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Stop Loss (pips)</Label>
                  <Input
                    type="number"
                    value={calcSL}
                    onChange={(e) => setCalcSL(e.target.value)}
                    step="1"
                    min="1"
                    className="h-8 text-sm tabular-nums mt-1"
                  />
                </div>
              </div>

              <Separator className="opacity-50" />

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Recommended Lot Size</div>
                <div className="text-3xl font-bold text-primary tabular-nums">{calculatedLotSize.toFixed(2)}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Min: {BROKER_CONFIG.minLotSize} • Max: {BROKER_CONFIG.maxLotSize}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Money Management Summary */}
          <Card className="glass-card">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Money Management</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-1 mb-1">
                    <Target className="h-3 w-3 text-emerald-500" />
                    <span className="text-[10px] text-emerald-500">Potential Profit</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-500 tabular-nums">+${potentialGain.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">per trade ({riskSettings.riskRewardRatio}:1 R:R)</div>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-1 mb-1">
                    <Shield className="h-3 w-3 text-red-500" />
                    <span className="text-[10px] text-red-500">Potential Loss</span>
                  </div>
                  <div className="text-lg font-bold text-red-500 tabular-nums">-${potentialLoss.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">per trade ({riskSettings.stopLossPips} pips)</div>
                </div>
                <div className="p-3 rounded-lg bg-accent/50 border border-border">
                  <div className="flex items-center gap-1 mb-1">
                    <Zap className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] text-amber-500">Daily Target</span>
                  </div>
                  <div className="text-lg font-bold text-amber-500 tabular-nums">
                    ${((riskSettings.dailyTargetPercent / 100) * balance).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{riskSettings.dailyTargetPercent}% of balance</div>
                </div>
                <div className="p-3 rounded-lg bg-accent/50 border border-border">
                  <div className="flex items-center gap-1 mb-1">
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                    <span className="text-[10px] text-red-500">Daily Limit</span>
                  </div>
                  <div className="text-lg font-bold text-red-500 tabular-nums">
                    ${((riskSettings.dailyRiskLimit / 100) * balance).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{riskSettings.dailyRiskLimit}% max loss</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

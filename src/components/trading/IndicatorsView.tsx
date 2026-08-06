'use client';

import { useTradingStore } from '@/store/trading-store';
import { INDICATOR_POOL, type Symbol } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { Gauge, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SYMBOLS } from '@/lib/types';

interface IndicatorDisplay {
  name: string;
  value: number;
  signal: 'bullish' | 'bearish' | 'neutral';
}

function getIndicatorSimulatedValue(name: string): IndicatorDisplay {
  const seed = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const value = ((Math.sin(seed * 1.5) + 1) / 2) * 100;
  const signal = value > 60 ? 'bullish' as const : value < 40 ? 'bearish' as const : 'neutral' as const;
  return { name, value: Math.round(value * 100) / 100, signal };
}

function getSignalIcon(signal: string) {
  switch (signal) {
    case 'bullish': return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
    case 'bearish': return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
    default: return <Minus className="h-3.5 w-3.5 text-slate-500" />;
  }
}

function getSignalColor(signal: string) {
  switch (signal) {
    case 'bullish': return 'text-emerald-500';
    case 'bearish': return 'text-red-500';
    default: return 'text-slate-500';
  }
}

function getSignalBg(signal: string) {
  switch (signal) {
    case 'bullish': return 'bg-emerald-500/10 border-emerald-500/20';
    case 'bearish': return 'bg-red-500/10 border-red-500/20';
    default: return 'bg-slate-500/10 border-slate-500/20';
  }
}

const categoryConfig: Record<string, { label: string; color: string }> = {
  trend: { label: 'Trend', color: 'text-emerald-500' },
  momentum: { label: 'Momentum', color: 'text-amber-500' },
  volatility: { label: 'Volatility', color: 'text-red-500' },
  volume: { label: 'Volume', color: 'text-cyan-500' },
};

export default function IndicatorsView() {
  const { selectedSymbol, setSelectedSymbol, indicatorValues, indicatorConfigs, setIndicatorConfigs } = useTradingStore();

  const enabledIndicators = indicatorConfigs
    .filter(c => c.enabled)
    .map(c => c.name);

  const toggleIndicator = (name: string, enabled: boolean) => {
    const exists = indicatorConfigs.find(c => c.name === name);
    if (exists) {
      setIndicatorConfigs(indicatorConfigs.map(c => c.name === name ? { ...c, enabled } : c));
    } else {
      setIndicatorConfigs([...indicatorConfigs, { name, enabled, settings: {} }]);
    }
  };

  const getIndicatorValue = (name: string): IndicatorDisplay => {
    const symbolValues = indicatorValues[selectedSymbol];
    if (symbolValues && symbolValues[name] !== undefined) {
      const val = symbolValues[name];
      const signal = val > 0.6 ? 'bullish' as const : val < 0.4 ? 'bearish' as const : 'neutral' as const;
      return { name, value: val * 100, signal };
    }
    return getIndicatorSimulatedValue(name);
  };

  const categories = ['trend', 'momentum', 'volatility', 'volume'] as const;

  const getCategoryIndicators = (category: string) => {
    return INDICATOR_POOL.filter(ind => ind.category === category);
  };

  const getCategorySignalSummary = (category: string) => {
    const indicators = getCategoryIndicators(category);
    const signals = indicators.map(ind => getIndicatorValue(ind.name));
    const bullish = signals.filter(s => s.signal === 'bullish').length;
    const bearish = signals.filter(s => s.signal === 'bearish').length;
    const total = signals.length;
    return { bullish, bearish, total, signals };
  };

  return (
    <div className="p-4 space-y-4">
      {/* Symbol Selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Symbol:</span>
        <div className="flex gap-2">
          {SYMBOLS.map((sym) => (
            <button
              key={sym}
              onClick={() => setSelectedSymbol(sym)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                sym === selectedSymbol
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {categories.map((cat) => {
          const config = categoryConfig[cat];
          const summary = getCategorySignalSummary(cat);
          return (
            <Card key={cat} className="glass-card">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
                  <span className="text-[10px] text-muted-foreground">{summary.total} indicators</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="text-[10px] text-emerald-500 mb-0.5">Bullish</div>
                    <div className="text-lg font-bold text-emerald-500 tabular-nums">{summary.bullish}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] text-red-500 mb-0.5">Bearish</div>
                    <div className="text-lg font-bold text-red-500 tabular-nums">{summary.bearish}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] text-slate-500 mb-0.5">Neutral</div>
                    <div className="text-lg font-bold text-slate-500 tabular-nums">{summary.total - summary.bullish - summary.bearish}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Indicator Grid by Category */}
      {categories.map((cat) => {
        const config = categoryConfig[cat];
        const indicators = getCategoryIndicators(cat);
        if (indicators.length === 0) return null;
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <Gauge className={`h-4 w-4 ${config.color}`} />
              <h3 className={`text-sm font-semibold ${config.color}`}>{config.label} Indicators</h3>
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground">{indicators.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {indicators.map((ind, idx) => {
                const display = getIndicatorValue(ind.name);
                const isEnabled = enabledIndicators.includes(ind.name);
                return (
                  <motion.div
                    key={ind.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                  >
                    <Card className={`glass-card border ${isEnabled ? 'border-primary/20' : ''}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getSignalIcon(display.signal)}
                            <span className="text-xs font-medium">{ind.name}</span>
                          </div>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) => toggleIndicator(ind.name, checked)}
                            className="scale-75 data-[state=checked]:bg-emerald-600"
                          />
                        </div>
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${getSignalBg(display.signal)} ${getSignalColor(display.signal)}`}
                        >
                          {display.signal.toUpperCase()}
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Value</span>
                            <span className={`tabular-nums font-medium ${getSignalColor(display.signal)}`}>{display.value.toFixed(1)}</span>
                          </div>
                          <div className="h-1.5 bg-accent rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                display.signal === 'bullish' ? 'bg-emerald-500' :
                                display.signal === 'bearish' ? 'bg-red-500' : 'bg-slate-500'
                              }`}
                              style={{ width: `${display.value}%` }}
                            />
                          </div>
                        </div>
                        {Object.keys(ind.settings).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Object.entries(ind.settings).map(([key, val]) => (
                              <span key={key} className="text-[9px] text-muted-foreground bg-accent/50 px-1.5 py-0.5 rounded">
                                {key}: {JSON.stringify(val)}
                              </span>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

'use client';

import { useState, useMemo } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { INDICATOR_POOL, type Symbol } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { Gauge, TrendingUp, TrendingDown, Minus, BarChart3, Activity, Volume2, Eye, EyeOff, Settings, Search } from 'lucide-react';
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
    case 'bullish': return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    case 'bearish': return <TrendingDown className="h-4 w-4 text-red-500" />;
    default: return <Minus className="h-4 w-4 text-slate-500" />;
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

function getSignalBorder(signal: string) {
  switch (signal) {
    case 'bullish': return 'border-b-emerald-500';
    case 'bearish': return 'border-b-red-500';
    default: return 'border-b-slate-500';
  }
}

function getTrendArrow(signal: string) {
  if (signal === 'bullish') return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (signal === 'bearish') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-slate-500" />;
}

const categoryConfig: Record<string, { label: string; color: string; icon: React.ReactNode; accent: string }> = {
  trend: { label: 'Trend', color: 'text-emerald-500', icon: <TrendingUp className="h-4 w-4" />, accent: 'stat-accent-emerald' },
  momentum: { label: 'Momentum', color: 'text-amber-500', icon: <Activity className="h-4 w-4" />, accent: 'stat-accent-amber' },
  volatility: { label: 'Volatility', color: 'text-red-500', icon: <BarChart3 className="h-4 w-4" />, accent: 'stat-accent-red' },
  volume: { label: 'Volume', color: 'text-cyan-500', icon: <Volume2 className="h-4 w-4" />, accent: 'stat-accent-cyan' },
};

// Indicator gauge configuration
function getIndicatorGaugeConfig(name: string): { min: number; max: number; zones?: Array<{ pos: number; label: string; color: string }> } {
  switch (name) {
    case 'RSI':
      return { min: 0, max: 100, zones: [{ pos: 30, label: 'Oversold', color: '#10b981' }, { pos: 70, label: 'Overbought', color: '#ef4444' }] };
    case 'Stochastic':
      return { min: 0, max: 100, zones: [{ pos: 20, label: 'Oversold', color: '#10b981' }, { pos: 80, label: 'Overbought', color: '#ef4444' }] };
    case 'CCI':
      return { min: -200, max: 200, zones: [{ pos: 0, label: 'Zero', color: '#64748b' }] };
    case 'MACD':
      return { min: -100, max: 100, zones: [{ pos: 0, label: 'Zero', color: '#64748b' }] };
    case 'Williams %R':
      return { min: -100, max: 0, zones: [{ pos: -20, label: 'Overbought', color: '#ef4444' }, { pos: -80, label: 'Oversold', color: '#10b981' }] };
    default:
      return { min: 0, max: 100 };
  }
}

// Mini gauge SVG component for indicator cards
function IndicatorMiniGauge({ value, signal, name }: { value: number; signal: string; name: string }) {
  const config = getIndicatorGaugeConfig(name);
  const normalizedValue = Math.max(0, Math.min(100, ((value - config.min) / (config.max - config.min)) * 100));
  const color = signal === 'bullish' ? '#10b981' : signal === 'bearish' ? '#ef4444' : '#64748b';
  const width = 120;
  const height = 24;
  const barHeight = 6;
  const barY = (height - barHeight) / 2;
  const barX = 8;
  const barWidth = width - 16;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      {/* Background bar */}
      <rect x={barX} y={barY} width={barWidth} height={barHeight} rx={3} fill="currentColor" className="text-slate-800" />
      {/* Zones */}
      {config.zones?.map((zone, i) => {
        const zoneX = barX + ((zone.pos - config.min) / (config.max - config.min)) * barWidth;
        return (
          <line key={i} x1={zoneX} y1={barY - 2} x2={zoneX} y2={barY + barHeight + 2} stroke={zone.color} strokeWidth={1} strokeOpacity={0.5} strokeDasharray="2,2" />
        );
      })}
      {/* Value bar */}
      <rect x={barX} y={barY} width={barWidth * (normalizedValue / 100)} height={barHeight} rx={3} fill={color} opacity={0.7} />
      {/* Value dot */}
      <circle cx={barX + barWidth * (normalizedValue / 100)} cy={height / 2} r={4} fill={color} stroke="#0a0f1c" strokeWidth={1.5} />
    </svg>
  );
}

// Generate mock historical values from current value
function generateMockHistory(currentValue: number, count: number = 20): number[] {
  const values: number[] = [];
  let val = currentValue * (0.7 + Math.random() * 0.3); // Start from a different point
  for (let i = 0; i < count - 1; i++) {
    val += (currentValue - val) * 0.1 + (Math.random() - 0.5) * currentValue * 0.08;
    values.push(Math.max(0, Math.min(100, val)));
  }
  values.push(currentValue);
  return values;
}

// Mini sparkline chart for the dialog
function MiniSparkline({ values, color, width = 280, height = 80 }: { values: number[]; color: string; width?: number; height?: number }) {
  const padding = 4;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * chartW;
    const y = padding + chartH - ((v - min) / range) * chartH;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${padding},${padding + chartH} ${points} ${padding + chartW},${padding + chartH}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={padding + chartW} cy={padding + chartH - ((values[values.length - 1] - min) / range) * chartH} r={3} fill={color} />
    </svg>
  );
}

export default function IndicatorsView() {
  const { selectedSymbol, setSelectedSymbol, indicatorValues, indicatorConfigs, setIndicatorConfigs } = useTradingStore();
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
    const neutral = signals.length - bullish - bearish;
    const total = signals.length;
    return { bullish, bearish, neutral, total, signals };
  };

  // Dialog detail data
  const dialogIndicatorPool = useMemo(() => {
    if (!selectedIndicator) return null;
    return INDICATOR_POOL.find(ind => ind.name === selectedIndicator.name);
  }, [selectedIndicator]);

  const mockHistory = useMemo(() => {
    if (!selectedIndicator) return [];
    return generateMockHistory(selectedIndicator.value);
  }, [selectedIndicator]);

  const dialogSignalColor = selectedIndicator
    ? (selectedIndicator.signal === 'bullish' ? '#10b981' : selectedIndicator.signal === 'bearish' ? '#ef4444' : '#64748b')
    : '#64748b';

  const filteredIndicators = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return INDICATOR_POOL.filter(ind => ind.name.toLowerCase().includes(q));
  }, [searchQuery]);

  return (
    <TooltipProvider delayDuration={200}>
    <div className="p-4 space-y-4">
      {/* Symbol Selector + Search + Active Badge */}
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="flex-1" />
        <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-emerald-500/30 text-emerald-400">
          Active: {enabledIndicators.length}/{INDICATOR_POOL.length}
        </Badge>
      </div>

      {/* Search/Filter Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filter indicators by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-8 pl-9 pr-3 rounded-md bg-accent/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
        {categories.map((cat) => {
          const config = categoryConfig[cat];
          const summary = getCategorySignalSummary(cat);
          return (
            <Card key={cat} className={`glass-card card-hover ${config.accent}`}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={config.color}>{config.icon}</span>
                    <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{summary.total} indicators</span>
                </div>
                <div className="flex gap-2 mb-2">
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
                    <div className="text-lg font-bold text-slate-500 tabular-nums">{summary.neutral}</div>
                  </div>
                </div>
                {/* Distribution bar */}
                <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-800">
                  {summary.total > 0 && (
                    <>
                      <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${(summary.bullish / summary.total) * 100}%` }} />
                      <div className="bg-slate-500 transition-all duration-500" style={{ width: `${(summary.neutral / summary.total) * 100}%` }} />
                      <div className="bg-red-500 transition-all duration-500" style={{ width: `${(summary.bearish / summary.total) * 100}%` }} />
                    </>
                  )}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-emerald-500/70">{summary.bullish} bull</span>
                  <span className="text-[9px] text-red-500/70">{summary.bearish} bear</span>
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
        const summary = getCategorySignalSummary(cat);
        if (indicators.length === 0) return null;
        return (
          <div key={cat}>
            {/* Enhanced category header with summary bar */}
            <div className={`flex items-center gap-3 mb-3 p-2 rounded-lg glass-card ${config.accent}`}>
              <span className={config.color}>{config.icon}</span>
              <h3 className={`section-title-accent text-sm font-semibold ${config.color}`}>{config.label} Indicators</h3>
              {/* Summary counts */}
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="text-emerald-500 font-medium">{summary.bullish} Bull</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-500 font-medium">{summary.neutral} Neutral</span>
                <span className="text-slate-600">|</span>
                <span className="text-red-500 font-medium">{summary.bearish} Bear</span>
              </div>
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground">{indicators.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 stagger-children">
              {indicators.map((ind, idx) => {
                const display = getIndicatorValue(ind.name);
                const isEnabled = enabledIndicators.includes(ind.name);
                if (filteredIndicators && !filteredIndicators.find(f => f.name === ind.name)) return null;
                return (
                  <motion.div
                    key={ind.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                  >
                    <Card
                      className={`glass-card card-hover border-b-2 cursor-pointer transition-all hover:border-border ${
                        isEnabled ? 'border-primary/20' : ''
                      } ${getSignalBorder(display.signal)}`}
                      onClick={() => setSelectedIndicator(display)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getSignalIcon(display.signal)}
                            <span className="text-xs font-medium">{ind.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(checked) => toggleIndicator(ind.name, checked)}
                              className="scale-100 data-[state=checked]:bg-emerald-600"
                            />
                            <span className={`text-[9px] font-bold ${isEnabled ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                              {isEnabled ? 'ON' : 'OFF'}
                            </span>
                          </div>
                        </div>
                        {/* Large value with trend arrow */}
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`text-xl font-bold tabular-nums ${getSignalColor(display.signal)}`}>
                            {display.value.toFixed(1)}
                          </span>
                          {getTrendArrow(display.signal)}
                        </div>
                        {/* Signal badge - more prominent */}
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold ${
                          display.signal === 'bullish' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                          display.signal === 'bearish' ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
                          'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                        }`}>
                          {getSignalIcon(display.signal)}
                          {display.signal.toUpperCase()}
                        </div>
                        {/* Mini gauge */}
                        <div className="mt-2">
                          <IndicatorMiniGauge value={display.value} signal={display.signal} name={ind.name} />
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

      {/* Indicator Details Dialog */}
      <Dialog open={!!selectedIndicator} onOpenChange={(open) => { if (!open) setSelectedIndicator(null); }}>
        {selectedIndicator && dialogIndicatorPool && (
          <DialogContent className="sm:max-w-md glass-card-premium mesh-gradient-bg border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                {getSignalIcon(selectedIndicator.signal)}
                {selectedIndicator.name}
                <Badge
                  className={`text-[10px] ml-1 ${
                    selectedIndicator.signal === 'bullish' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    selectedIndicator.signal === 'bearish' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                  }`}
                >
                  {selectedIndicator.signal.toUpperCase()}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Current value large */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Value</div>
                  <div className={`text-2xl font-bold tabular-nums ${getSignalColor(selectedIndicator.signal)}`}>
                    {selectedIndicator.value.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</div>
                  <Badge variant="outline" className={`text-[10px] mt-1 ${categoryConfig[dialogIndicatorPool.category]?.color || ''}`}>
                    {dialogIndicatorPool.category}
                  </Badge>
                </div>
              </div>

              {/* Mini chart */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Last 20 Values</div>
                <div className="p-2 rounded-lg bg-accent/30 border border-border">
                  <MiniSparkline values={mockHistory} color={dialogSignalColor} />
                </div>
              </div>

              {/* Signal description */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Signal Interpretation</div>
                <div className="text-xs text-muted-foreground p-2 rounded-lg bg-accent/30">
                  {selectedIndicator.signal === 'bullish'
                    ? `${selectedIndicator.name} indicates bullish momentum. The value of ${selectedIndicator.value.toFixed(2)} suggests upward pressure. Consider this in conjunction with other indicators for confirmation.`
                    : selectedIndicator.signal === 'bearish'
                    ? `${selectedIndicator.name} indicates bearish momentum. The value of ${selectedIndicator.value.toFixed(2)} suggests downward pressure. Exercise caution on long positions.`
                    : `${selectedIndicator.name} is neutral at ${selectedIndicator.value.toFixed(2)}. No clear directional bias. Wait for confirmation before entering positions.`
                  }
                </div>
              </div>

              {/* Settings display */}
              {Object.keys(dialogIndicatorPool.settings).length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                    <Settings className="h-3 w-3" /> Settings
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(dialogIndicatorPool.settings).map(([key, val]) => (
                      <div key={key} className="p-2 rounded-lg bg-accent/30 border border-border">
                        <div className="text-[10px] text-muted-foreground">{key}</div>
                        <div className="text-xs font-medium tabular-nums mt-0.5">{JSON.stringify(val)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Enable/Disable toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/30 border border-border">
                <div className="flex items-center gap-2">
                  {enabledIndicators.includes(selectedIndicator.name) ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <div className="text-xs font-medium">Enable Indicator</div>
                    <div className="text-[10px] text-muted-foreground">Include in analysis calculations</div>
                  </div>
                </div>
                <Switch
                  checked={enabledIndicators.includes(selectedIndicator.name)}
                  onCheckedChange={(checked) => toggleIndicator(selectedIndicator.name, checked)}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
    </TooltipProvider>
  );
}

'use client';

import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, MARKET_CONDITION_CONFIG, STRATEGIES, type MarketCondition, type StrategyName } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, Activity, Volume2, BarChart3, ArrowUpRight, ArrowDownRight, CircleDot, ShieldAlert, Clock } from 'lucide-react';

function getConditionIcon(condition: MarketCondition) {
  switch (condition) {
    case 'trending': return <TrendingUp className="h-5 w-5 text-emerald-500" />;
    case 'range_bound': return <Activity className="h-5 w-5 text-amber-500" />;
    case 'high_volatility': return <Volume2 className="h-5 w-5 text-red-500" />;
    case 'low_volatility': return <BarChart3 className="h-5 w-5 text-slate-500" />;
  }
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

export default function AnalysisView() {
  const { signals, marketConditions } = useTradingStore();

  const unexecutedSignals = signals.filter(s => !s.isExecuted);

  const latestSignalsBySymbol = SYMBOLS.map(sym => {
    const sig = signals.find(s => s.symbol === sym);
    return { symbol: sym, signal: sig };
  });

  return (
    <div className="p-4 space-y-4">
      {/* Market Conditions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {SYMBOLS.map((sym) => {
          const condition = marketConditions[sym] || 'low_volatility';
          const config = MARKET_CONDITION_CONFIG[condition];
          const sig = signals.find(s => s.symbol === sym);
          return (
            <motion.div
              key={sym}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: SYMBOLS.indexOf(sym) * 0.05 }}
            >
              <Card className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold">{SYMBOL_INFO[sym].name}</div>
                    <Badge variant="outline" className={`text-[10px] px-2 ${config.color}`}>
                      {config.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    {getConditionIcon(condition)}
                    <div>
                      <div className="text-[11px] text-muted-foreground">Market State</div>
                      <div className="text-xs font-medium">{config.description}</div>
                    </div>
                  </div>

                  {config.characteristics.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {config.characteristics.map((ch, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <CircleDot className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">{ch}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {config.bestStrategies.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Best Strategies</div>
                      <div className="flex flex-wrap gap-1">
                        {config.bestStrategies.map((strat) => (
                          <Badge key={strat} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {STRATEGIES[strat].label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {sig && (
                    <>
                      <Separator className="my-3 opacity-50" />
                      <div className={`flex items-center justify-between p-2 rounded-lg ${
                        sig.direction === 'BUY' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                        sig.direction === 'SELL' ? 'bg-red-500/10 border border-red-500/20' :
                        'bg-slate-500/10 border border-slate-500/20'
                      }`}>
                        <div className="flex items-center gap-2">
                          {sig.direction === 'BUY' ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> :
                           sig.direction === 'SELL' ? <ArrowDownRight className="h-4 w-4 text-red-500" /> :
                           <Activity className="h-4 w-4 text-slate-500" />}
                          <div>
                            <div className="text-xs font-semibold">{sig.direction}</div>
                            <div className="text-[10px] text-muted-foreground">{sig.strategy}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-bold tabular-nums ${getConfidenceColor(sig.confidence)}`}>
                            {sig.confidence}%
                          </div>
                          <div className="text-[10px] text-muted-foreground">confidence</div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AI Analysis */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">AI Market Analysis</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-4">
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
          </CardContent>
        </Card>

        {/* Signal History */}
        <Card className="glass-card">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Signal History</CardTitle>
              <Badge variant="outline" className="text-[10px]">{signals.length} total</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
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
                      className={`p-2.5 rounded-lg border ${
                        signal.direction === 'BUY' ? 'border-emerald-500/20 bg-emerald-500/5' :
                        signal.direction === 'SELL' ? 'border-red-500/20 bg-red-500/5' :
                        'border-border bg-accent/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {signal.direction === 'BUY' ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> :
                           signal.direction === 'SELL' ? <ArrowDownRight className="h-3.5 w-3.5 text-red-500" /> :
                           <Activity className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span className="text-xs font-semibold">{signal.symbol}</span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1 py-0 ${
                              signal.direction === 'BUY' ? 'border-emerald-500/50 text-emerald-500' :
                              signal.direction === 'SELL' ? 'border-red-500/50 text-red-500' :
                              'border-slate-500/50 text-slate-500'
                            }`}
                          >
                            {signal.direction}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`text-xs font-bold tabular-nums ${getConfidenceColor(signal.confidence)}`}>
                            {signal.confidence}%
                          </div>
                          {signal.isExecuted && (
                            <Badge className="text-[8px] px-1 py-0 bg-primary/20 text-primary">EXEC</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">{signal.strategy} • {MARKET_CONDITION_CONFIG[signal.marketCondition].label}</span>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(signal.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      {signal.aiAnalysis && (
                        <div className="mt-1.5 text-[10px] text-muted-foreground line-clamp-2">
                          {signal.aiAnalysis}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

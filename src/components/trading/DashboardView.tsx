'use client';

import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, BROKER_CONFIG, TRADING_SESSIONS, MARKET_CONDITION_CONFIG, type Symbol, type MarketCondition } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, Activity, Zap, Play, ArrowUpRight, ArrowDownRight, Clock, BarChart3, Shield, Volume2, RefreshCw } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useMemo } from 'react';

function getConditionIcon(condition: MarketCondition) {
  switch (condition) {
    case 'trending': return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    case 'range_bound': return <Activity className="h-4 w-4 text-amber-500" />;
    case 'high_volatility': return <Volume2 className="h-4 w-4 text-red-500" />;
    case 'low_volatility': return <BarChart3 className="h-4 w-4 text-slate-500" />;
  }
}

function getSessionStatus(session: { start: number; end: number }) {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const isActive = currentHour >= session.start && currentHour < session.end;
  return isActive;
}

export default function DashboardView() {
  const {
    balance, equity, freeMargin, dailyPnl, totalPnl,
    openTrades, signals, prices, marketConditions,
    isConnected, isAutoTrading, setActiveTab, setAutoTrading,
  } = useTradingStore();

  const recentSignals = signals.slice(0, 5);

  const pnlPercent = totalPnl !== 0 ? ((totalPnl / balance) * 100) : 0;
  const dailyPnlPercent = dailyPnl !== 0 ? ((dailyPnl / balance) * 100) : 0;

  const totalPnlData = useMemo(() => {
    const points = [];
    let val = 0;
    for (let i = 0; i < 20; i++) {
      val += (Math.random() - 0.45) * 15;
      points.push({ v: val });
    }
    points.push({ v: totalPnl });
    return points;
  }, [totalPnl]);

  const dailyPnlData = useMemo(() => {
    const points = [];
    let val = 0;
    for (let i = 0; i < 20; i++) {
      val += (Math.random() - 0.48) * 5;
      points.push({ v: val });
    }
    points.push({ v: dailyPnl });
    return points;
  }, [dailyPnl]);

  const stats = [
    {
      label: 'Balance',
      value: `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign className="h-4 w-4" />,
      color: 'text-foreground',
      sparkData: null,
    },
    {
      label: 'Equity',
      value: `$${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <Activity className="h-4 w-4" />,
      color: equity >= balance ? 'text-emerald-500' : 'text-red-500',
      sparkData: null,
    },
    {
      label: 'Free Margin',
      value: `$${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <Shield className="h-4 w-4" />,
      color: 'text-foreground',
      sparkData: null,
    },
    {
      label: 'Daily P&L',
      value: `${dailyPnl >= 0 ? '+' : ''}$${dailyPnl.toFixed(2)}`,
      subValue: `${dailyPnlPercent >= 0 ? '+' : ''}${dailyPnlPercent.toFixed(2)}%`,
      icon: dailyPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
      color: dailyPnl >= 0 ? 'text-emerald-500' : 'text-red-500',
      sparkData: dailyPnlData,
    },
    {
      label: 'Total P&L',
      value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`,
      subValue: `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`,
      icon: totalPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
      color: totalPnl >= 0 ? 'text-emerald-500' : 'text-red-500',
      sparkData: totalPnlData,
    },
  ];

  return (
    <div className="space-y-4 p-4">
      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="glass-card">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                  <span className={stat.color}>{stat.icon}</span>
                </div>
                <div className={`text-lg font-bold tabular-nums ${stat.color}`}>
                  {stat.value}
                </div>
                {stat.subValue && (
                  <div className={`text-xs tabular-nums ${stat.color}`}>
                    {stat.subValue}
                  </div>
                )}
                {stat.sparkData && (
                  <div className="h-8 mt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stat.sparkData}>
                        <defs>
                          <linearGradient id={`spark-${stat.label}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={stat.color === 'text-emerald-500' ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={stat.color === 'text-emerald-500' ? '#10b981' : '#ef4444'} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="v"
                          stroke={stat.color === 'text-emerald-500' ? '#10b981' : '#ef4444'}
                          fill={`url(#spark-${stat.label})`}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Open Positions */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Open Positions ({openTrades.length})</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                Max {BROKER_CONFIG.maxOpenPositions}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {openTrades.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No open positions
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-[10px] h-8">Symbol</TableHead>
                      <TableHead className="text-[10px] h-8">Dir</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Lots</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Entry</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Current</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Pips</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openTrades.map((trade) => (
                      <TableRow key={trade.id} className="border-border">
                        <TableCell className="text-xs font-medium">{trade.symbol}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              trade.direction === 'BUY'
                                ? 'border-emerald-500/50 text-emerald-500'
                                : 'border-red-500/50 text-red-500'
                            }`}
                          >
                            {trade.direction}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{trade.lotSize}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{trade.entryPrice.toFixed(SYMBOL_INFO[trade.symbol].digits)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{trade.currentPrice.toFixed(SYMBOL_INFO[trade.symbol].digits)}</TableCell>
                        <TableCell className={`text-xs text-right tabular-nums font-medium ${trade.pips >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {trade.pips >= 0 ? '+' : ''}{trade.pips.toFixed(1)}
                        </TableCell>
                        <TableCell className={`text-xs text-right tabular-nums font-medium ${trade.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions + Sessions */}
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              <Button
                onClick={() => setActiveTab('trading')}
                className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                size="sm"
              >
                <Zap className="h-3.5 w-3.5" />
                New Trade
              </Button>
              <Button
                onClick={() => setAutoTrading(!isAutoTrading)}
                variant={isAutoTrading ? 'destructive' : 'outline'}
                className={`w-full justify-start gap-2 ${!isAutoTrading ? 'border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10' : ''}`}
                size="sm"
                disabled={!isConnected}
              >
                <Play className="h-3.5 w-3.5" />
                {isAutoTrading ? 'Stop Auto Trading' : 'Start Auto Trading'}
              </Button>
              <Button
                onClick={() => setActiveTab('analysis')}
                variant="outline"
                className="w-full justify-start gap-2"
                size="sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh Signals
              </Button>
            </CardContent>
          </Card>

          {/* Trading Sessions */}
          <Card className="glass-card">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">Trading Sessions</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              {Object.values(TRADING_SESSIONS).map((session) => {
                const active = getSessionStatus(session);
                return (
                  <div key={session.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">{session.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {session.start.toString().padStart(2, '0')}:00-{session.end.toString().padStart(2, '0')}:00 UTC
                      </span>
                      <div className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500 pulse-dot' : 'bg-slate-600'}`} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Signals */}
        <Card className="glass-card">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent Signals</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => setActiveTab('analysis')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {recentSignals.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No signals yet. Waiting for analysis...
              </div>
            ) : (
              <div className="space-y-2">
                {recentSignals.map((signal) => (
                  <div key={signal.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      {signal.direction === 'BUY' ? (
                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                      ) : signal.direction === 'SELL' ? (
                        <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <div>
                        <span className="text-xs font-medium">{signal.symbol}</span>
                        <span className="text-[10px] text-muted-foreground ml-1.5">{signal.strategy}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          signal.direction === 'BUY'
                            ? 'border-emerald-500/50 text-emerald-500'
                            : signal.direction === 'SELL'
                            ? 'border-red-500/50 text-red-500'
                            : 'border-slate-500/50 text-slate-500'
                        }`}
                      >
                        {signal.direction}
                      </Badge>
                      <span className={`text-[10px] font-medium tabular-nums ${signal.confidence >= 70 ? 'text-emerald-500' : signal.confidence >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                        {signal.confidence}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Market Conditions */}
        <Card className="glass-card">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold">Market Conditions</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-3">
              {SYMBOLS.map((sym) => {
                const condition = marketConditions[sym] || 'low_volatility';
                const config = MARKET_CONDITION_CONFIG[condition];
                const price = prices[sym];
                return (
                  <div key={sym} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-3">
                      {getConditionIcon(condition)}
                      <div>
                        <div className="text-xs font-medium">{SYMBOL_INFO[sym].name}</div>
                        {price && (
                          <div className="text-[10px] text-muted-foreground tabular-nums">
                            {price.bid.toFixed(SYMBOL_INFO[sym].digits)} / {price.ask.toFixed(SYMBOL_INFO[sym].digits)}
                            <span className={`ml-1.5 ${price.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {price.change >= 0 ? '+' : ''}{price.changePercent.toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0 ${config.color}`}
                      >
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

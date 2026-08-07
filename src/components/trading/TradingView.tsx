'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { useShallow } from 'zustand/react/shallow';
import { SYMBOLS, SYMBOL_INFO, BROKER_CONFIG, type TradeDirection } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, X, Square, AlertTriangle, History, Target, Shield, ArrowUp, ArrowDown, Timer, Activity } from 'lucide-react';
import PriceChart from './PriceChart';
import OrderBookDepth from './OrderBookDepth';
import MarketSentiment from './MarketSentiment';
import TradeExportButton from './TradeExportButton';
import AdvancedOrderTypes from './AdvancedOrderTypes';
import TradeHistoryTable from './TradeHistoryTable';
import { TradeExecutionModal } from './TradeExecutionModal';
import type { TradeExecutionContext } from './TradeExecutionModal';

export default function TradingView() {
  const {
    selectedSymbol, prices, priceHistory,
    openTrades, closedTrades, isConnected, riskSettings,
  } = useTradingStore(
    useShallow((s) => ({
      selectedSymbol: s.selectedSymbol, prices: s.prices, priceHistory: s.priceHistory,
      openTrades: s.openTrades, closedTrades: s.closedTrades, isConnected: s.isConnected, riskSettings: s.riskSettings,
    }))
  );
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const addTrade = useTradingStore((s) => s.addTrade);
  const closeTrade = useTradingStore((s) => s.closeTrade);
  const updateTrade = useTradingStore((s) => s.updateTrade);
  const addNotification = useTradingStore((s) => s.addNotification);

  const [lotSize, setLotSize] = useState('0.01');
  const [stopLoss, setStopLoss] = useState(riskSettings.stopLossPips.toString());
  const [takeProfit, setTakeProfit] = useState(riskSettings.takeProfitPips.toString());
  const [oneClickMode, setOneClickMode] = useState(false);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const prevPriceRef = useRef<Record<string, number>>({});
  const [priceFlash, setPriceFlash] = useState<Record<string, 'up' | 'down' | null>>({});
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [pendingTrade, setPendingTrade] = useState<TradeExecutionContext | null>(null);

  const price = prices[selectedSymbol];
  const chartData = priceHistory[selectedSymbol] || [];

  useEffect(() => {
    if (price) {
      const prev = prevPriceRef.current[selectedSymbol];
      if (prev !== undefined && price.bid !== prev) {
        setPriceFlash(state => ({ ...state, [selectedSymbol]: price.bid > prev ? 'up' : 'down' }));
        const timer = setTimeout(() => {
          setPriceFlash(state => ({ ...state, [selectedSymbol]: null }));
        }, 500);
        return () => clearTimeout(timer);
      }
      prevPriceRef.current[selectedSymbol] = price.bid;
    }
  }, [price, selectedSymbol]);

  const executeTrade = useCallback((direction: TradeDirection) => {
    if (!price || !isConnected) return;
    const lots = parseFloat(lotSize);
    if (isNaN(lots) || lots < BROKER_CONFIG.minLotSize || lots > BROKER_CONFIG.maxLotSize) return;
    const entryPrice = direction === 'BUY' ? price.ask : price.bid;
    const slPips = parseFloat(stopLoss) || 0;
    const tpPips = parseFloat(takeProfit) || 0;
    const pipSize = SYMBOL_INFO[selectedSymbol].pipSize;
    const trade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      symbol: selectedSymbol,
      direction,
      lotSize: lots,
      entryPrice,
      currentPrice: entryPrice,
      stopLoss: slPips > 0 ? (direction === 'BUY' ? entryPrice - slPips * pipSize : entryPrice + slPips * pipSize) : undefined,
      takeProfit: tpPips > 0 ? (direction === 'BUY' ? entryPrice + tpPips * pipSize : entryPrice - tpPips * pipSize) : undefined,
      isTrailingStop: false,
      trailingStop: undefined,
      pips: 0,
      profit: 0,
      commission: BROKER_CONFIG.commission * lots,
      spread: price.spread,
      swap: 0,
      status: 'open' as const,
      openedAt: new Date().toISOString(),
    };
    addTrade(trade);
  }, [price, isConnected, lotSize, stopLoss, takeProfit, selectedSymbol, addTrade]);

  const handleOpenTrade = useCallback((direction: TradeDirection) => {
    if (!price || !isConnected) {
      addNotification({ type: 'error', title: 'Cannot Trade', message: 'Not connected to price feed' });
      return;
    }
    const lots = parseFloat(lotSize);
    if (isNaN(lots) || lots < BROKER_CONFIG.minLotSize || lots > BROKER_CONFIG.maxLotSize) {
      addNotification({ type: 'error', title: 'Invalid Lot Size', message: `Must be between ${BROKER_CONFIG.minLotSize} and ${BROKER_CONFIG.maxLotSize}` });
      return;
    }
    if (oneClickMode) {
      executeTrade(direction);
      return;
    }
    const entryPrice = direction === 'BUY' ? price.ask : price.bid;
    const slPips = parseFloat(stopLoss) || 0;
    const tpPips = parseFloat(takeProfit) || 0;
    const pipSize = SYMBOL_INFO[selectedSymbol].pipSize;
    const slPrice = slPips > 0 ? (direction === 'BUY' ? entryPrice - slPips * pipSize : entryPrice + slPips * pipSize) : entryPrice;
    const tpPrice = tpPips > 0 ? (direction === 'BUY' ? entryPrice + tpPips * pipSize : entryPrice - tpPips * pipSize) : entryPrice;
    const pipValue = SYMBOL_INFO[selectedSymbol].category === 'forex' ? 10 * lots : 100 * lots;
    const contractSize = SYMBOL_INFO[selectedSymbol].category === 'forex' ? 100000 : 100;
    const currentPrice = selectedSymbol === 'USDJPY' ? 1 / price.bid : price.bid;
    const margin = (contractSize * lots * currentPrice) / BROKER_CONFIG.leverage;
    const balance = useTradingStore.getState().balance;
    const riskAmount = slPips * pipValue;
    const potentialProfit = tpPips * pipValue;
    const rrRatio = riskAmount > 0 && potentialProfit > 0 ? `1:${(potentialProfit / riskAmount).toFixed(1)}` : tpPips > 0 && slPips > 0 ? `1:${(tpPips / slPips).toFixed(1)}` : 'N/A';
    setPendingTrade({
      symbol: SYMBOL_INFO[selectedSymbol].name,
      direction,
      lotSize: lots,
      entryPrice,
      stopLoss: slPrice,
      takeProfit: tpPrice,
      riskAmount,
      potentialProfit,
      riskRewardRatio: rrRatio,
      spread: parseFloat((price.spread / pipSize).toFixed(1)),
      commission: BROKER_CONFIG.commission * lots,
      accountBalance: balance,
      marginRequired: margin,
      freeMargin: balance - margin,
    });
    setTradeModalOpen(true);
  }, [price, isConnected, lotSize, stopLoss, takeProfit, selectedSymbol, oneClickMode, addNotification, executeTrade]);

  const handleModalConfirm = useCallback(() => {
    if (pendingTrade) {
      executeTrade(pendingTrade.direction as TradeDirection);
      setTradeModalOpen(false);
      setPendingTrade(null);
    }
  }, [pendingTrade, executeTrade]);

  const handleToggleTrailing = (tradeId: string, enabled: boolean) => {
    updateTrade(tradeId, { isTrailingStop: enabled, trailingStop: enabled ? riskSettings.stopLossPips : undefined });
  };

  // (c) Calculated order metrics
  const orderMetrics = useMemo(() => {
    const lots = parseFloat(lotSize) || 0;
    const slPips = parseFloat(stopLoss) || 0;
    const tpPips = parseFloat(takeProfit) || 0;
    const pipValue = SYMBOL_INFO[selectedSymbol].category === 'forex' ? 10 * lots : 100 * lots;
    const pipSize = SYMBOL_INFO[selectedSymbol].pipSize;

    // Margin = (contractSize * lots * price) / leverage
    const contractSize = SYMBOL_INFO[selectedSymbol].category === 'forex' ? 100000 : 100;
    const currentPrice = price ? (selectedSymbol === 'USDJPY' ? 1 / price.bid : price.bid) : 1;
    const margin = (contractSize * lots * currentPrice) / BROKER_CONFIG.leverage;

    const riskAmount = slPips * pipValue;
    const potentialProfit = tpPips * pipValue;

    return { margin, riskAmount, potentialProfit, pipValue };
  }, [lotSize, stopLoss, takeProfit, selectedSymbol, price]);

  // (a) History stats
  const historyStats = useMemo(() => {
    if (closedTrades.length === 0) return null;
    const wins = closedTrades.filter(t => t.profit > 0);
    const losses = closedTrades.filter(t => t.profit <= 0);
    const winRate = (wins.length / closedTrades.length) * 100;
    const totalPnl = closedTrades.reduce((s, t) => s + t.profit, 0);
    const bestTrade = closedTrades.reduce((best, t) => t.profit > best.profit ? t : best, closedTrades[0]);
    const worstTrade = closedTrades.reduce((worst, t) => t.profit < worst.profit ? t : worst, closedTrades[0]);
    return { totalTrades: closedTrades.length, winRate, totalPnl, bestTrade, worstTrade };
  }, [closedTrades]);

  function formatDuration(openedAt: string, closedAt?: string) {
    const start = new Date(openedAt).getTime();
    const end = (closedAt ? new Date(closedAt) : new Date()).getTime();
    const diffMin = Math.floor((end - start) / 60000);
    if (diffMin < 1) return '<1m';
    if (diffMin < 60) return `${diffMin}m`;
    const hr = Math.floor(diffMin / 60);
    const min = diffMin % 60;
    if (hr < 24) return `${hr}h ${min}m`;
    const days = Math.floor(hr / 24);
    const remHr = hr % 24;
    return `${days}d ${remHr}h`;
  }

  // Generate sparkline SVG polyline points for a symbol
  const getSparklinePoints = useCallback((sym: string): string => {
    const history = priceHistory[sym];
    if (!history || history.length < 2) return '';
    const pts = history.slice(-12);
    const min = Math.min(...pts.map(p => p.close));
    const max = Math.max(...pts.map(p => p.close));
    const range = max - min || 1;
    return pts.map((p, i) => `${(i / 11) * 36},${20 - ((p.close - min) / range) * 18}`).join(' ');
  }, [priceHistory]);

  // Quick lot sizes
  const quickLots = [0.01, 0.05, 0.1, 0.5, 1.0];

  return (
    <TooltipProvider delayDuration={0}>
      <div className="p-4 pb-10 md:pb-4 space-y-4">
        {/* Symbol Selector - Pill style with sparklines */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {SYMBOLS.map((sym) => {
            const isActive = sym === selectedSymbol;
            const p = prices[sym];
            const sparkline = getSparklinePoints(sym);
            return (
              <button
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                className={`flex-shrink-0 py-2.5 px-3 rounded-full text-sm font-medium transition-all min-w-[120px] card-hover scale-click flex items-center gap-2.5 border ${
                  isActive
                    ? 'text-emerald-400 border-emerald-500/30 pill-active-glow symbol-pill-active inset-highlight'
                    : 'bg-card/80 border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <div className="flex flex-col items-start gap-0.5">
                  <div className="flex items-center gap-1.5">
                    {p && <div className={`direction-dot ${p.change >= 0 ? 'direction-dot-up' : 'direction-dot-down'}`} />}
                    <span className="text-xs font-bold tracking-tight">{SYMBOL_INFO[sym].name}</span>
                    {p && (
                      <span className="text-[9px] text-muted-foreground font-normal tabular-nums">
                        {p.spread.toFixed(1)}p
                      </span>
                    )}
                  </div>
                  {p && (
                    <div className={`text-[11px] tabular-nums font-medium ${p.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {p.bid.toFixed(SYMBOL_INFO[sym].digits)}
                    </div>
                  )}
                </div>
                {sparkline && (
                  <svg viewBox="0 0 36 20" className="w-9 h-5 flex-shrink-0" preserveAspectRatio="none">
                    <polyline
                      points={sparkline}
                      fill="none"
                      stroke={p && p.change >= 0 ? '#10b981' : '#ef4444'}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={isActive ? 1 : 0.6}
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Chart */}
          <div className="lg:col-span-3 space-y-4">
            <div className="chart-glow rounded-xl">
              <div className="glass-card-premium rounded-xl card-hover-lift border-border/40 chart-inner-glow">
                <div className="p-0">
                  <PriceChart
                    data={chartData}
                    symbol={selectedSymbol}
                    bid={price?.bid}
                    ask={price?.ask}
                    height={300}
                  />
                </div>
              </div>
            </div>

            {/* (a) Tabbed Positions / History */}
            <div className="glass-card-premium rounded-xl card-hover-lift">
              <Tabs defaultValue="open" className="w-full">
                <div className="flex items-center gap-2 mb-3 pb-0 pt-3 px-4">
                  <div className="flex items-center justify-between gap-2">
                    <TabsList className="h-8 glass-card-premium border-0 shadow-none gap-0.5 p-1">
                      <TabsTrigger value="open" className="text-xs h-6 rounded-lg data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 data-[state=active]:shadow-[0_0_12px_rgba(16,185,129,0.2),inset_0_1px_0_rgba(16,185,129,0.1)]">
                        Open ({openTrades.length})
                      </TabsTrigger>
                      <TabsTrigger value="history" className="text-xs h-6 rounded-lg data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 data-[state=active]:shadow-[0_0_12px_rgba(16,185,129,0.2),inset_0_1px_0_rgba(16,185,129,0.1)]">
                        History ({closedTrades.length})
                      </TabsTrigger>
                      <TabsTrigger value="advanced" className="text-xs h-6 rounded-lg data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-400 data-[state=active]:shadow-[0_0_12px_rgba(245,158,11,0.2),inset_0_1px_0_rgba(245,158,11,0.1)]">
                        Advanced
                      </TabsTrigger>
                    </TabsList>
                    <TradeExportButton />
                  </div>
                </div>

                <TabsContent value="open" className="mt-0">
                  <div className="px-4 pb-3">
                    {openTrades.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        No open positions. Use the panel to place a trade.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                              <TableHead className="text-[10px] h-8" aria-sort="none">Symbol</TableHead>
                              <TableHead className="text-[10px] h-8" aria-sort="none">Dir</TableHead>
                              <TableHead className="text-[10px] h-8 text-right" aria-sort="none">Lots</TableHead>
                              <TableHead className="text-[10px] h-8 text-right" aria-sort="none">Entry</TableHead>
                              <TableHead className="text-[10px] h-8 text-right">SL</TableHead>
                              <TableHead className="text-[10px] h-8 text-right">TP</TableHead>
                              <TableHead className="text-[10px] h-8 text-right" aria-sort="none">Pips</TableHead>
                              <TableHead className="text-[10px] h-8 text-right" aria-sort="none">P&L</TableHead>
                              <TableHead className="text-[10px] h-8" aria-sort="none">Time</TableHead>
                              <TableHead className="text-[10px] h-8 text-center">Trail</TableHead>
                              <TableHead className="text-[10px] h-8 text-center">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {openTrades.map((trade) => {
                              const maxProfit = Math.max(...openTrades.map(t => Math.abs(t.profit)), 1);
                              return (
                              <TableRow key={trade.id} className={`border-border compact-row table-row-hover ${trade.direction === 'BUY' ? 'trade-row-buy' : 'trade-row-sell'}`}>
                                <TableCell className="text-xs font-medium">{trade.symbol}</TableCell>
                                <TableCell>
                                  <div className={`flex items-center gap-1 text-xs font-bold ${trade.direction === 'BUY' ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {trade.direction === 'BUY' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {trade.direction}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-right tabular-nums">{trade.lotSize}</TableCell>
                                <TableCell className="text-xs text-right tabular-nums">{trade.entryPrice.toFixed(SYMBOL_INFO[trade.symbol].digits)}</TableCell>
                                <TableCell className="text-xs text-right tabular-nums text-red-400">
                                  {trade.stopLoss?.toFixed(SYMBOL_INFO[trade.symbol].digits) || '—'}
                                </TableCell>
                                <TableCell className="text-xs text-right tabular-nums text-emerald-400">
                                  {trade.takeProfit?.toFixed(SYMBOL_INFO[trade.symbol].digits) || '—'}
                                </TableCell>
                                <TableCell className={`text-xs text-right tabular-nums font-semibold ${trade.pips >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                  {trade.pips >= 0 ? '+' : ''}{trade.pips.toFixed(1)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className={`text-sm font-bold tabular-nums ${trade.profit >= 0 ? 'gradient-text-profit' : 'gradient-text-loss'}`}>
                                    {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                                  </div>
                                  <div className="pnl-bar-track mt-0.5">
                                    <div
                                      className={`pnl-bar-fill-premium ${trade.profit >= 0 ? 'profit' : 'loss'}`}
                                      style={{ width: `${Math.min((Math.abs(trade.profit) / maxProfit) * 100, 100)}%` }}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    <Timer className="h-2.5 w-2.5 opacity-50" />
                                    {formatDuration(trade.openedAt)}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {trade.isTrailingStop ? (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <div className="trail-animate inline-flex">
                                          <Activity className="h-3.5 w-3.5 text-emerald-500" />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-[10px]">Trailing {trade.trailingStop} pips</TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Switch
                                      checked={trade.isTrailingStop}
                                      onCheckedChange={(checked) => handleToggleTrailing(trade.id, checked)}
                                      className="scale-75 data-[state=checked]:bg-emerald-600"
                                    />
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <AnimatePresence>
                                    {confirmClose === trade.id ? (
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        className="flex items-center gap-1"
                                      >
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          className="h-6 px-2 text-[10px]"
                                          onClick={() => { closeTrade(trade.id); setConfirmClose(null); }}
                                        >
                                          Confirm
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 px-2 text-[10px]"
                                          onClick={() => setConfirmClose(null)}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </motion.div>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/15 transition-colors duration-200"
                                        onClick={() => setConfirmClose(trade.id)}
                                      >
                                        <Square className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </AnimatePresence>
                                </TableCell>
                              </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                  <div className="px-4 pb-3">
                    {closedTrades.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No trade history yet</p>
                        <p className="text-[11px] mt-1 opacity-60">Closed trades will appear here</p>
                      </div>
                    ) : (
                      <>
                        {/* Summary Stats + Win/Loss Ratio Bar + Avg Comparison */}
                        {historyStats && (() => {
                          const wins = closedTrades.filter(t => t.profit > 0);
                          const losses = closedTrades.filter(t => t.profit <= 0);
                          const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.profit, 0) / wins.length : 0;
                          const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.profit, 0) / losses.length) : 0;
                          const maxAvg = Math.max(avgWin, avgLoss, 1);
                          return (
                            <>
                            <div className="grid grid-cols-5 gap-2 mb-3">
                              <div className="text-center p-2 rounded-lg stat-card-premium">
                                <div className="text-[10px] text-muted-foreground uppercase">Trades</div>
                                <div className="text-sm font-bold tabular-nums count-up">{historyStats.totalTrades}</div>
                              </div>
                              <div className="text-center p-2 rounded-lg stat-card-premium">
                                <div className="text-[10px] text-muted-foreground uppercase">Win Rate</div>
                                <div className={`text-sm font-bold tabular-nums ${historyStats.winRate >= 50 ? 'neon-text-emerald' : 'neon-text-red'}`}>
                                  {historyStats.winRate.toFixed(0)}%
                                </div>
                              </div>
                              <div className={`text-center p-2 rounded-lg stat-card-premium ${historyStats.totalPnl >= 0 ? 'glow-pulse-emerald' : 'glow-pulse-red'}`}>
                                <div className="text-[10px] text-muted-foreground uppercase">Total P&L</div>
                                <div className={`text-sm font-bold tabular-nums ${historyStats.totalPnl >= 0 ? 'neon-text-emerald' : 'neon-text-red'}`}>
                                  {historyStats.totalPnl >= 0 ? '+' : ''}${historyStats.totalPnl.toFixed(2)}
                                </div>
                              </div>
                              <div className="text-center p-2 rounded-lg stat-card-premium">
                                <div className="text-[10px] text-muted-foreground uppercase">Best</div>
                                <div className="text-sm font-bold tabular-nums neon-text-emerald">
                                  +${historyStats.bestTrade.profit.toFixed(2)}
                                </div>
                              </div>
                              <div className="text-center p-2 rounded-lg stat-card-premium">
                                <div className="text-[10px] text-muted-foreground uppercase">Worst</div>
                                <div className="text-sm font-bold tabular-nums neon-text-red">
                                  ${historyStats.worstTrade.profit.toFixed(2)}
                                </div>
                              </div>
                            </div>
                            {/* Win/Loss Ratio Visual Bar */}
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-[10px] mb-1.5">
                                <span className="text-emerald-500 font-medium">{wins.length} Wins</span>
                                <span className="text-muted-foreground">{historyStats.winRate.toFixed(0)}%</span>
                                <span className="text-red-500 font-medium">{losses.length} Losses</span>
                              </div>
                              <div className="winloss-bar-premium">
                                <div
                                  className="bg-gradient-to-r from-emerald-600 to-emerald-400 animate-progress"
                                  style={{ width: `${historyStats.winRate}%` }}
                                />
                                <div
                                  className="bg-gradient-to-r from-red-400 to-red-600 animate-progress"
                                  style={{ width: `${100 - historyStats.winRate}%` }}
                                />
                              </div>
                            </div>
                            {/* Avg Win vs Avg Loss Comparison */}
                            <div className="mb-3 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-emerald-500 w-12 shrink-0">Avg Win</span>
                                <div className="flex-1 avg-bar-premium overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-emerald-600 to-emerald-400 animate-progress"
                                    style={{ width: `${(avgWin / maxAvg) * 100}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-emerald-500 tabular-nums font-medium w-16 text-right">
                                  +${avgWin.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-red-500 w-12 shrink-0">Avg Loss</span>
                                <div className="flex-1 avg-bar-premium overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-red-400 to-red-600 animate-progress"
                                    style={{ width: `${(avgLoss / maxAvg) * 100}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-red-500 tabular-nums font-medium w-16 text-right">
                                  -${avgLoss.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            </>
                          );
                        })()}
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-[10px] h-7">Symbol</TableHead>
                                <TableHead className="text-[10px] h-7">Dir</TableHead>
                                <TableHead className="text-[10px] h-7 text-right">Lots</TableHead>
                                <TableHead className="text-[10px] h-7 text-right">Entry</TableHead>
                                <TableHead className="text-[10px] h-7 text-right">Close</TableHead>
                                <TableHead className="text-[10px] h-7 text-right">Pips</TableHead>
                                <TableHead className="text-[10px] h-7 text-right">P&L</TableHead>
                                <TableHead className="text-[10px] h-7">Duration</TableHead>
                                <TableHead className="text-[10px] h-7">Strategy</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {closedTrades.map((trade) => (
                                <TableRow key={trade.id} className={`border-border compact-row table-row-hover ${trade.direction === 'BUY' ? 'trade-row-buy' : 'trade-row-sell'}`}>
                                  <TableCell className="text-xs font-medium">{trade.symbol}</TableCell>
                                  <TableCell>
                                    <div className={`flex items-center gap-1 text-[11px] font-bold ${trade.direction === 'BUY' ? 'text-emerald-500' : 'text-red-500'}`}>
                                      {trade.direction === 'BUY' ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                                      {trade.direction}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-[11px] text-right tabular-nums">{trade.lotSize}</TableCell>
                                  <TableCell className="text-[11px] text-right tabular-nums">{trade.entryPrice.toFixed(SYMBOL_INFO[trade.symbol].digits)}</TableCell>
                                  <TableCell className="text-[11px] text-right tabular-nums">{trade.currentPrice.toFixed(SYMBOL_INFO[trade.symbol].digits)}</TableCell>
                                  <TableCell className={`text-[11px] text-right tabular-nums font-semibold ${trade.pips >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {trade.pips >= 0 ? '+' : ''}{trade.pips.toFixed(1)}
                                  </TableCell>
                                  <TableCell className={`text-sm text-right tabular-nums font-bold ${trade.profit >= 0 ? 'gradient-text-profit' : 'gradient-text-loss'}`}>
                                    {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                                    <div className="flex items-center gap-1">
                                      <Timer className="h-2.5 w-2.5 opacity-40" />
                                      {formatDuration(trade.openedAt, trade.closedAt)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-[10px] text-muted-foreground">
                                    {trade.strategy || '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="advanced" className="mt-0">
                  <div className="px-4 pb-3">
                    <AdvancedOrderTypes />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Trading Panel */}
          <div className="space-y-4">
            {/* (b) Better Price Display Card */}
            <div className="glass-card-premium rounded-xl card-hover-lift">
              <div className="p-4 space-y-3">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-medium">{SYMBOL_INFO[selectedSymbol].name}</div>
                  {price ? (
                    <>
                      <div className={`text-2xl md:text-3xl font-bold tabular-nums count-up ${priceFlash[selectedSymbol] === 'up' ? 'flash-green' : priceFlash[selectedSymbol] === 'down' ? 'flash-red' : ''}`}>
                        {price.bid.toFixed(SYMBOL_INFO[selectedSymbol].digits)}
                      </div>
                      <div className={`text-xs tabular-nums flex items-center justify-center gap-1 mt-0.5 ${price.change >= 0 ? 'neon-text-emerald' : 'neon-text-red'}`}>
                        {price.change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        <span className="font-medium">{price.change >= 0 ? '+' : ''}{price.change.toFixed(SYMBOL_INFO[selectedSymbol].digits)}</span>
                        <span>({price.change >= 0 ? '+' : ''}{price.changePercent.toFixed(3)}%)</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-lg text-muted-foreground">—</div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-[10px] text-emerald-500/70 uppercase font-medium">Bid</div>
                    <div className="text-2xl md:text-3xl font-bold text-emerald-500 tabular-nums">
                      {price ? price.bid.toFixed(SYMBOL_INFO[selectedSymbol].digits) : '—'}
                    </div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div className="text-[10px] text-red-500/70 uppercase font-medium">Ask</div>
                    <div className="text-2xl md:text-3xl font-bold text-red-500 tabular-nums">
                      {price ? price.ask.toFixed(SYMBOL_INFO[selectedSymbol].digits) : '—'}
                    </div>
                  </div>
                </div>

                {/* High/Low for the day + range bar */}
                {price && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] tabular-nums">
                      <span className="text-red-400 font-medium">L: {price.low.toFixed(SYMBOL_INFO[selectedSymbol].digits)}</span>
                      <span className="text-muted-foreground">Daily Range</span>
                      <span className="text-emerald-400 font-medium">H: {price.high.toFixed(SYMBOL_INFO[selectedSymbol].digits)}</span>
                    </div>
                    <div className="relative h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="absolute top-0 h-full w-1 bg-foreground rounded-sm shadow-[0_0_6px_rgba(255,255,255,0.5)]"
                        style={{
                          left: `${price.high !== price.low ? ((price.bid - price.low) / (price.high - price.low)) * 100 : 50}%`,
                          transform: 'translateX(-50%)',
                        }}
                      />
                      <div
                        className="absolute top-0 h-full bg-gradient-to-r from-red-500/30 via-slate-600/30 to-emerald-500/30"
                        style={{ left: '0%', width: '100%' }}
                      />
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-muted-foreground">Spread: </span>
                      <span className="text-[10px] font-medium tabular-nums">{price.spread.toFixed(1)} pips</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* (c) Better Order Panel */}
            <div className={`order-panel-premium rounded-xl card-hover ${oneClickMode ? 'pulsing-border-amber' : ''}`}>
              <div className="p-5 pb-0 pt-4 px-5">
                <div className="section-header-accent">
                  <h3 className="text-sm font-semibold">New Order</h3>
                </div>
              </div>
              <div className="px-5 pb-5 pt-3 space-y-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground font-medium">Lot Size</Label>
                  <div className="flex flex-wrap gap-2 mt-1.5 mb-1.5">
                    {quickLots.map((lot) => (
                      <button
                        key={lot}
                        onClick={() => setLotSize(lot.toString())}
                        className={`lot-chip-premium text-[10px] px-3 py-1.5 border ${
                          parseFloat(lotSize) === lot
                            ? 'active'
                            : 'border-border/60 text-muted-foreground'
                        } tabular-nums`}
                      >
                        {lot}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    value={lotSize}
                    onChange={(e) => setLotSize(e.target.value)}
                    step="0.01"
                    min={BROKER_CONFIG.minLotSize}
                    max={BROKER_CONFIG.maxLotSize}
                    className="h-9 text-sm tabular-nums"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-[11px] text-muted-foreground font-medium">SL (pips)</Label>
                      <span className="text-[9px] text-muted-foreground tabular-nums">
                        ${orderMetrics.riskAmount.toFixed(2)}
                      </span>
                    </div>
                    <Input
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      step="1"
                      min="0"
                      className="h-9 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-[11px] text-muted-foreground font-medium">TP (pips)</Label>
                      <span className="text-[9px] text-muted-foreground tabular-nums">
                        ${orderMetrics.potentialProfit.toFixed(2)}
                      </span>
                    </div>
                    <Input
                      type="number"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      step="1"
                      min="0"
                      className="h-9 text-sm tabular-nums"
                    />
                  </div>
                </div>

                {/* Risk:Reward Ratio */}
                {(() => {
                  const slPips = parseFloat(stopLoss) || 0;
                  const tpPips = parseFloat(takeProfit) || 0;
                  const rr = slPips > 0 && tpPips > 0 ? (tpPips / slPips).toFixed(1) : null;
                  return rr ? (
                    <div className="flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg bg-slate-800/30 border border-border/30">
                      <Target className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Risk:Reward</span>
                      <span className={`text-xs font-bold tabular-nums ${parseFloat(rr) >= 2 ? 'text-emerald-500' : parseFloat(rr) >= 1 ? 'text-amber-500' : 'text-red-500'}`}>
                        1:{rr}
                      </span>
                    </div>
                  ) : null;
                })()}

                {/* Calculated Margin / Risk / Profit */}
                <div className="space-y-1.5 p-2.5 rounded-lg bg-slate-800/30 border border-border/50">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Calculated Margin
                    </span>
                    <span className="font-medium tabular-nums text-amber-500">${orderMetrics.margin.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-label flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Risk Amount
                    </span>
                    <span className={`font-bold tabular-nums ${orderMetrics.riskAmount > 0 ? 'neon-text-red' : 'text-muted-foreground'}`}>
                      ${orderMetrics.riskAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-label flex items-center gap-1">
                      <Target className="h-3 w-3" /> Potential Profit
                    </span>
                    <span className={`font-bold tabular-nums ${orderMetrics.potentialProfit > 0 ? 'neon-text-emerald' : 'text-muted-foreground'}`}>
                      +${orderMetrics.potentialProfit.toFixed(2)}
                    </span>
                  </div>
                </div>

                <Separator className="opacity-50" />

                {oneClickMode ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-500 font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      One-Click Trading Active
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        className="gradient-buy-btn trade-btn-premium card-press text-white h-12 font-bold text-base rounded-xl"
                        onClick={() => handleOpenTrade('BUY')}
                        disabled={!isConnected}
                      >
                        <ArrowUpRight className="h-5 w-5 mr-1" />
                        BUY
                      </Button>
                      <Button
                        className="gradient-sell-btn trade-btn-premium card-press text-white h-12 font-bold text-base rounded-xl"
                        onClick={() => handleOpenTrade('SELL')}
                        disabled={!isConnected}
                      >
                        <ArrowDownRight className="h-5 w-5 mr-1" />
                        SELL
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      className="gradient-buy-btn trade-btn-premium card-press text-white h-12 font-bold text-base rounded-xl"
                      onClick={() => handleOpenTrade('BUY')}
                      disabled={!isConnected}
                    >
                      <ArrowUpRight className="h-5 w-5 mr-1" />
                      BUY
                    </Button>
                    <Button
                      className="gradient-sell-btn trade-btn-premium card-press text-white h-12 font-bold text-base rounded-xl"
                      onClick={() => handleOpenTrade('SELL')}
                      disabled={!isConnected}
                    >
                      <ArrowDownRight className="h-5 w-5 mr-1" />
                      SELL
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/20 border border-border/30">
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] text-muted-foreground font-medium">One-Click Trading</Label>
                    {oneClickMode && (
                      <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30 badge-pulse badge-glow-amber">
                        LIVE
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={oneClickMode}
                    onCheckedChange={setOneClickMode}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>
              </div>
            </div>

            {/* Market Info */}
            <div className="glass-card-premium rounded-xl card-hover-lift">
              <div className="p-3 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Leverage</span>
                  <span className="font-medium">1:{BROKER_CONFIG.leverage}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Commission</span>
                  <span className="font-medium">${BROKER_CONFIG.commission}/lot</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Margin Call</span>
                  <span className="font-medium">{BROKER_CONFIG.marginCall}%</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Stop Out</span>
                  <span className="font-medium text-red-500">{BROKER_CONFIG.stopOut}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Order Book & Market Sentiment */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OrderBookDepth
            symbol={selectedSymbol}
            bid={price?.bid ?? SYMBOL_INFO[selectedSymbol].pipSize}
            ask={price?.ask ?? SYMBOL_INFO[selectedSymbol].pipSize * 2}
          />
          <MarketSentiment />
        </div>

        {/* Advanced Trade History Table */}
        <TradeHistoryTable />
      </div>

      {/* Trade Execution Confirmation Modal */}
      <TradeExecutionModal
        open={tradeModalOpen}
        onOpenChange={(open) => { if (!open) { setTradeModalOpen(false); setPendingTrade(null); } }}
        context={pendingTrade ?? undefined}
        onConfirm={handleModalConfirm}
      />
    </TooltipProvider>
  );
};

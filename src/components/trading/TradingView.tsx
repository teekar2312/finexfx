'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, BROKER_CONFIG, type Symbol, type TradeDirection } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, X, Zap, Square, AlertTriangle } from 'lucide-react';
import PriceChart from './PriceChart';

export default function TradingView() {
  const {
    selectedSymbol, setSelectedSymbol, prices, priceHistory,
    openTrades, addTrade, closeTrade, updateTrade,
    isConnected, riskSettings, addNotification,
  } = useTradingStore();

  const [lotSize, setLotSize] = useState('0.01');
  const [stopLoss, setStopLoss] = useState(riskSettings.stopLossPips.toString());
  const [takeProfit, setTakeProfit] = useState(riskSettings.takeProfitPips.toString());
  const [oneClickMode, setOneClickMode] = useState(false);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const prevPriceRef = useRef<Record<string, number>>({});
  const [priceFlash, setPriceFlash] = useState<Record<string, 'up' | 'down' | null>>({});

  const price = prices[selectedSymbol];
  const chartData = priceHistory[selectedSymbol] || [];

  useEffect(() => {
    if (price) {
      const prev = prevPriceRef.current[selectedSymbol];
      if (prev !== undefined && price.bid !== prev) {
        setPriceFlash(prev => ({ ...prev, [selectedSymbol]: price.bid > prev ? 'up' : 'down' }));
        const timer = setTimeout(() => {
          setPriceFlash(prev => ({ ...prev, [selectedSymbol]: null }));
        }, 500);
        return () => clearTimeout(timer);
      }
      prevPriceRef.current[selectedSymbol] = price.bid;
    }
  }, [price, selectedSymbol]);

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
  }, [price, isConnected, lotSize, stopLoss, takeProfit, selectedSymbol, addTrade, addNotification]);

  const handleToggleTrailing = (tradeId: string, enabled: boolean) => {
    updateTrade(tradeId, { isTrailingStop: enabled, trailingStop: enabled ? riskSettings.stopLossPips : undefined });
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="p-4 space-y-4">
        {/* Symbol Tabs */}
        <div className="flex gap-2">
          {SYMBOLS.map((sym) => {
            const isActive = sym === selectedSymbol;
            const p = prices[sym];
            return (
              <button
                key={sym}
                onClick={() => setSelectedSymbol(sym)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <div className="text-xs font-semibold">{SYMBOL_INFO[sym].name}</div>
                {p && (
                  <div className={`text-[11px] tabular-nums mt-0.5 ${p.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {p.bid.toFixed(SYMBOL_INFO[sym].digits)}
                    <span className="ml-1">{p.change >= 0 ? '+' : ''}{p.changePercent.toFixed(2)}%</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Chart */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="glass-card">
              <CardContent className="p-0">
                <PriceChart
                  data={chartData}
                  symbol={selectedSymbol}
                  bid={price?.bid}
                  ask={price?.ask}
                  height={380}
                />
              </CardContent>
            </Card>

            {/* Open Positions Table */}
            <Card className="glass-card">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    Open Positions ({openTrades.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {openTrades.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No open positions. Use the panel to place a trade.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-[10px] h-8">Symbol</TableHead>
                          <TableHead className="text-[10px] h-8">Direction</TableHead>
                          <TableHead className="text-[10px] h-8 text-right">Lots</TableHead>
                          <TableHead className="text-[10px] h-8 text-right">Entry</TableHead>
                          <TableHead className="text-[10px] h-8 text-right">SL</TableHead>
                          <TableHead className="text-[10px] h-8 text-right">TP</TableHead>
                          <TableHead className="text-[10px] h-8 text-right">Pips</TableHead>
                          <TableHead className="text-[10px] h-8 text-right">P&L</TableHead>
                          <TableHead className="text-[10px] h-8 text-center">Trail</TableHead>
                          <TableHead className="text-[10px] h-8 text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {openTrades.map((trade) => (
                          <TableRow key={trade.id} className="border-border">
                            <TableCell className="text-xs font-medium">{trade.symbol}</TableCell>
                            <TableCell>
                              <div className={`flex items-center gap-1 text-xs font-medium ${trade.direction === 'BUY' ? 'text-emerald-500' : 'text-red-500'}`}>
                                {trade.direction === 'BUY' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {trade.direction}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{trade.lotSize}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{trade.entryPrice.toFixed(SYMBOL_INFO[trade.symbol].digits)}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums text-red-500">
                              {trade.stopLoss?.toFixed(SYMBOL_INFO[trade.symbol].digits) || '—'}
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums text-emerald-500">
                              {trade.takeProfit?.toFixed(SYMBOL_INFO[trade.symbol].digits) || '—'}
                            </TableCell>
                            <TableCell className={`text-xs text-right tabular-nums font-semibold ${trade.pips >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {trade.pips >= 0 ? '+' : ''}{trade.pips.toFixed(1)}
                            </TableCell>
                            <TableCell className={`text-xs text-right tabular-nums font-semibold ${trade.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={trade.isTrailingStop}
                                onCheckedChange={(checked) => handleToggleTrailing(trade.id, checked)}
                                className="scale-75 data-[state=checked]:bg-emerald-600"
                              />
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
                                    className="h-6 px-2 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                    onClick={() => setConfirmClose(trade.id)}
                                  >
                                    <Square className="h-3 w-3" />
                                  </Button>
                                )}
                              </AnimatePresence>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Trading Panel */}
          <div className="space-y-4">
            {/* Price Display */}
            <Card className="glass-card">
              <CardContent className="p-4 space-y-3">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{SYMBOL_INFO[selectedSymbol].name}</div>
                  {price ? (
                    <>
                      <div className={`text-2xl font-bold tabular-nums ${priceFlash[selectedSymbol] === 'up' ? 'flash-green' : priceFlash[selectedSymbol] === 'down' ? 'flash-red' : ''}`}>
                        {price.bid.toFixed(SYMBOL_INFO[selectedSymbol].digits)}
                      </div>
                      <div className={`text-xs tabular-nums ${price.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {price.change >= 0 ? '+' : ''}{price.change.toFixed(SYMBOL_INFO[selectedSymbol].digits)} ({price.change >= 0 ? '+' : ''}{price.changePercent.toFixed(3)}%)
                      </div>
                    </>
                  ) : (
                    <div className="text-lg text-muted-foreground">—</div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-[10px] text-emerald-500/70 uppercase">Bid</div>
                    <div className="text-sm font-bold text-emerald-500 tabular-nums">
                      {price ? price.bid.toFixed(SYMBOL_INFO[selectedSymbol].digits) : '—'}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="text-[10px] text-red-500/70 uppercase">Ask</div>
                    <div className="text-sm font-bold text-red-500 tabular-nums">
                      {price ? price.ask.toFixed(SYMBOL_INFO[selectedSymbol].digits) : '—'}
                    </div>
                  </div>
                </div>

                {price && (
                  <div className="text-center">
                    <span className="text-[10px] text-muted-foreground">Spread: </span>
                    <span className="text-[10px] font-medium tabular-nums">{price.spread.toFixed(1)} pips</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Entry */}
            <Card className="glass-card">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-semibold">New Order</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Lot Size</Label>
                  <Input
                    type="number"
                    value={lotSize}
                    onChange={(e) => setLotSize(e.target.value)}
                    step="0.01"
                    min={BROKER_CONFIG.minLotSize}
                    max={BROKER_CONFIG.maxLotSize}
                    className="h-8 text-sm tabular-nums mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">SL (pips)</Label>
                    <Input
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      step="1"
                      min="0"
                      className="h-8 text-sm tabular-nums mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">TP (pips)</Label>
                    <Input
                      type="number"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      step="1"
                      min="0"
                      className="h-8 text-sm tabular-nums mt-1"
                    />
                  </div>
                </div>

                <Separator className="opacity-50" />

                {oneClickMode ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-500">
                      <AlertTriangle className="h-3 w-3" />
                      One-Click Trading Active
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 font-semibold"
                        onClick={() => handleOpenTrade('BUY')}
                        disabled={!isConnected}
                      >
                        <ArrowUpRight className="h-4 w-4 mr-1" />
                        BUY
                      </Button>
                      <Button
                        className="bg-red-600 hover:bg-red-700 text-white h-10 font-semibold"
                        onClick={() => handleOpenTrade('SELL')}
                        disabled={!isConnected}
                      >
                        <ArrowDownRight className="h-4 w-4 mr-1" />
                        SELL
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 font-semibold"
                      onClick={() => handleOpenTrade('BUY')}
                      disabled={!isConnected}
                    >
                      <ArrowUpRight className="h-4 w-4 mr-1" />
                      BUY
                    </Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700 text-white h-10 font-semibold"
                      onClick={() => handleOpenTrade('SELL')}
                      disabled={!isConnected}
                    >
                      <ArrowDownRight className="h-4 w-4 mr-1" />
                      SELL
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">One-Click Trading</Label>
                  <Switch
                    checked={oneClickMode}
                    onCheckedChange={setOneClickMode}
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Market Info */}
            <Card className="glass-card">
              <CardContent className="p-3 space-y-1.5">
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

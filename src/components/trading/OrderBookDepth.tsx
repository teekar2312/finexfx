'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Symbol, SYMBOL_INFO } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen } from 'lucide-react';

interface OrderBookDepthProps {
  symbol: Symbol;
  bid: number;
  ask: number;
}

interface OrderBookLevel {
  price: number;
  size: number;
  cumulative: number;
}

function generateOrderBook(
  bid: number,
  ask: number,
  symbol: Symbol,
  prevLevels?: { bids: OrderBookLevel[]; asks: OrderBookLevel[] }
): { bids: OrderBookLevel[]; asks: OrderBookLevel[] } {
  const pipSize = SYMBOL_INFO[symbol].pipSize;
  const levels = symbol === 'XAUUSD' ? 6 : 7;
  const digits = SYMBOL_INFO[symbol].digits;

  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];

  let cumBid = 0;
  for (let i = 0; i < levels; i++) {
    const priceOffset = (i + 1) * pipSize * (1 + Math.random() * 0.5);
    let price = bid - priceOffset;
    if (prevLevels?.bids[i]) {
      const prevPrice = prevLevels.bids[i].price;
      const drift = (Math.random() - 0.5) * pipSize * 2;
      price = prevPrice + drift;
      if (price >= bid) price = bid - pipSize;
    }
    price = Math.round(price / pipSize) * pipSize;
    const baseSize = 1.5 + Math.random() * 12;
    const size = prevLevels?.bids[i]
      ? Math.max(0.5, prevLevels.bids[i].size + (Math.random() - 0.5) * 3)
      : baseSize;
    cumBid += size;
    bids.push({
      price: parseFloat(price.toFixed(digits)),
      size: parseFloat(size.toFixed(2)),
      cumulative: parseFloat(cumBid.toFixed(2)),
    });
  }

  let cumAsk = 0;
  for (let i = 0; i < levels; i++) {
    const priceOffset = (i + 1) * pipSize * (1 + Math.random() * 0.5);
    let price = ask + priceOffset;
    if (prevLevels?.asks[i]) {
      const prevPrice = prevLevels.asks[i].price;
      const drift = (Math.random() - 0.5) * pipSize * 2;
      price = prevPrice + drift;
      if (price <= ask) price = ask + pipSize;
    }
    price = Math.round(price / pipSize) * pipSize;
    const baseSize = 1.2 + Math.random() * 10;
    const size = prevLevels?.asks[i]
      ? Math.max(0.5, prevLevels.asks[i].size + (Math.random() - 0.5) * 3)
      : baseSize;
    cumAsk += size;
    asks.push({
      price: parseFloat(price.toFixed(digits)),
      size: parseFloat(size.toFixed(2)),
      cumulative: parseFloat(cumAsk.toFixed(2)),
    });
  }

  return { bids, asks };
}

export default function OrderBookDepth({ symbol, bid, ask }: OrderBookDepthProps) {
  const [levels, setLevels] = useState<{ bids: OrderBookLevel[]; asks: OrderBookLevel[] }>(() =>
    generateOrderBook(bid, ask, symbol)
  );

  const updateLevels = useCallback(() => {
    setLevels((prev) => generateOrderBook(bid, ask, symbol, prev));
  }, [bid, ask, symbol]);

  useEffect(() => {
    const interval = setInterval(updateLevels, 2000);
    return () => clearInterval(interval);
  }, [updateLevels]);

  useEffect(() => {
    setLevels(generateOrderBook(bid, ask, symbol));
  }, [symbol, bid, ask]);

  const { bids, asks } = levels;
  const maxCumBid = bids[bids.length - 1]?.cumulative || 1;
  const maxCumAsk = asks[asks.length - 1]?.cumulative || 1;
  const totalBidVol = maxCumBid;
  const totalAskVol = maxCumAsk;
  const totalVol = totalBidVol + totalAskVol;
  const buyPressure = totalVol > 0 ? (totalBidVol / totalVol) * 100 : 50;
  const sellPressure = 100 - buyPressure;
  const spread = ask - bid;
  const spreadPips = spread / SYMBOL_INFO[symbol].pipSize;
  const digits = SYMBOL_INFO[symbol].digits;

  const maxBars = Math.max(bids.length, asks.length);
  const rows = useMemo(() => {
    const arr: { bid?: OrderBookLevel; ask?: OrderBookLevel; index: number }[] = [];
    for (let i = 0; i < maxBars; i++) {
      arr.push({
        bid: bids[bids.length - 1 - i],
        ask: asks[i],
        index: i,
      });
    }
    return arr;
  }, [bids, asks, maxBars]);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
            <CardTitle className="text-xs font-semibold">Order Book Depth</CardTitle>
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {SYMBOL_INFO[symbol].name}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {/* Buy/Sell Pressure Bar */}
        <div className="mb-2.5">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-emerald-500 font-medium">Buy {buyPressure.toFixed(1)}%</span>
            <span className="text-muted-foreground">Pressure</span>
            <span className="text-red-500 font-medium">Sell {sellPressure.toFixed(1)}%</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-800">
            <motion.div
              className="bg-emerald-500/60"
              initial={false}
              animate={{ width: `${buyPressure}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            <motion.div
              className="bg-red-500/60"
              initial={false}
              animate={{ width: `${sellPressure}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-1 mb-1 px-0.5">
          <div className="text-[10px] text-emerald-500/70 text-right pr-2">Price</div>
          <div className="text-[10px] text-muted-foreground text-center w-12">Size</div>
          <div className="text-[10px] text-red-500/70 pl-2">Price</div>
        </div>

        {/* Order Book Rows */}
        <div className="space-y-[1px]">
          <AnimatePresence mode="popLayout">
            {rows.map(({ bid: b, ask: a, index }) => {
              const bidWidth = b ? (b.cumulative / maxCumBid) * 100 : 0;
              const askWidth = a ? (a.cumulative / maxCumAsk) * 100 : 0;
              return (
                <motion.div
                  key={index}
                  className="grid grid-cols-[1fr_auto_1fr] gap-1 items-center"
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Bid Side */}
                  <div className="relative h-4 flex items-center justify-end">
                    <motion.div
                      className="absolute right-0 top-0 h-full bg-emerald-500/30 rounded-sm"
                      initial={false}
                      animate={{ width: `${bidWidth}%` }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                    {b && (
                      <span className="relative text-[11px] tabular-nums text-emerald-400 font-medium pr-2 z-10">
                        {b.price.toFixed(digits)}
                      </span>
                    )}
                  </div>

                  {/* Center Size Column */}
                  <div className="text-center w-12 flex-shrink-0">
                    {b && a ? (
                      <div className="flex flex-col items-center leading-none">
                        <span className="text-[9px] tabular-nums text-emerald-500/60">{b.size.toFixed(1)}</span>
                        <span className="text-[9px] tabular-nums text-red-500/60">{a.size.toFixed(1)}</span>
                      </div>
                    ) : b ? (
                      <span className="text-[9px] tabular-nums text-emerald-500/60">{b.size.toFixed(1)}</span>
                    ) : a ? (
                      <span className="text-[9px] tabular-nums text-red-500/60">{a.size.toFixed(1)}</span>
                    ) : null}
                  </div>

                  {/* Ask Side */}
                  <div className="relative h-4 flex items-center justify-start">
                    <motion.div
                      className="absolute left-0 top-0 h-full bg-red-500/30 rounded-sm"
                      initial={false}
                      animate={{ width: `${askWidth}%` }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                    {a && (
                      <span className="relative text-[11px] tabular-nums text-red-400 font-medium pl-2 z-10">
                        {a.price.toFixed(digits)}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Spread Indicator */}
        <div className="flex items-center justify-center my-2 py-1.5 rounded-md bg-slate-800/50 border border-border/50">
          <div className="text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Spread</div>
            <div className="text-sm font-bold tabular-nums text-amber-400">
              {spreadPips.toFixed(1)} <span className="text-[10px] font-normal text-muted-foreground">pips</span>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
          <div>
            <span className="text-emerald-500/70">Bids: </span>
            <span className="tabular-nums font-medium text-foreground/80">{totalBidVol.toFixed(1)}</span>
          </div>
          <div>
            <span className="text-red-500/70">Asks: </span>
            <span className="tabular-nums font-medium text-foreground/80">{totalAskVol.toFixed(1)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Total: </span>
            <span className="tabular-nums font-medium text-foreground/80">{totalVol.toFixed(1)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

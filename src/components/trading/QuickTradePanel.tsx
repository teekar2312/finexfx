'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { useShallow } from 'zustand/react/shallow';
import { SYMBOLS, SYMBOL_INFO, BROKER_CONFIG, type Symbol as TSymbol, type TradeDirection } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react';

export default function QuickTradePanel() {
  const {
    selectedSymbol, prices, openTrades, isConnected, riskSettings,
  } = useTradingStore(
    useShallow((s) => ({
      selectedSymbol: s.selectedSymbol, prices: s.prices, openTrades: s.openTrades, isConnected: s.isConnected, riskSettings: s.riskSettings,
    }))
  );
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const addTrade = useTradingStore((s) => s.addTrade);
  const closeTrade = useTradingStore((s) => s.closeTrade);
  const addNotification = useTradingStore((s) => s.addNotification);
  const setActiveTab = useTradingStore((s) => s.setActiveTab);

  const [isOpen, setIsOpen] = useState(false);
  const [lotSize, setLotSize] = useState('0.01');
  const [stopLoss, setStopLoss] = useState(riskSettings.stopLossPips.toString());
  const [takeProfit, setTakeProfit] = useState(riskSettings.takeProfitPips.toString());
  const [priceFlash, setPriceFlash] = useState<Record<string, 'up' | 'down' | null>>({});
  const prevPriceRef = useRef<Record<string, number>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  const price = prices[selectedSymbol];
  const tradeCount = openTrades.length;

  // Price flash effect
  useEffect(() => {
    if (price) {
      const prev = prevPriceRef.current[selectedSymbol];
      if (prev !== undefined && price.bid !== prev) {
        setPriceFlash(s => ({ ...s, [selectedSymbol]: price.bid > prev ? 'up' : 'down' }));
        const t = setTimeout(() => {
          setPriceFlash(s => ({ ...s, [selectedSymbol]: null }));
        }, 400);
        return () => clearTimeout(t);
      }
      prevPriceRef.current[selectedSymbol] = price.bid;
    }
  }, [price, selectedSymbol]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!panelRef.current?.contains(target) && !target.closest('[data-fab]')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

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

  const flash = priceFlash[selectedSymbol];
  const symInfo = SYMBOL_INFO[selectedSymbol];
  const spreadPips = price ? (price.spread / symInfo.pipSize) : 0;
  const visibleTrades = openTrades.slice(0, 3);

  return (
    <>
      {/* Transparent backdrop for click-outside dismissal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[89]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <div ref={panelRef} className="fixed bottom-20 right-4 z-[90]">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="glass-card w-[320px] max-h-[450px] flex flex-col rounded-xl border border-white/10 shadow-2xl overflow-hidden mb-3"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <span className="text-[11px] font-semibold text-zinc-300 tracking-wide uppercase">Quick Trade</span>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close quick trade panel"
                  className="p-0.5 rounded-md hover:bg-white/10 transition-colors text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {/* Symbol Selector */}
                <div className="grid grid-cols-4 gap-1">
                  {SYMBOLS.map((sym) => (
                    <button
                      key={sym}
                      onClick={() => setSelectedSymbol(sym)}
                      className={`px-1 py-1.5 rounded-md text-[10px] font-semibold tabular-nums transition-all ${
                        selectedSymbol === sym
                          ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                          : 'bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300'
                      }`}
                    >
                      {SYMBOL_INFO[sym].name.replace('/', '')}
                    </button>
                  ))}
                </div>

                {/* Bid/Ask / Spread */}
                {price ? (
                  <div className="grid grid-cols-3 gap-1">
                    <div className="bg-white/5 rounded-md px-2 py-1.5 text-center">
                      <div className="text-[9px] text-zinc-500 mb-0.5">BID</div>
                      <div
                        className={`text-xs font-bold tabular-nums ${
                          flash === 'up' ? 'text-emerald-400' : flash === 'down' ? 'text-red-400' : 'text-white'
                        }`}
                      >
                        {price.bid.toFixed(symInfo.digits)}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-md px-2 py-1.5 text-center">
                      <div className="text-[9px] text-zinc-500 mb-0.5">ASK</div>
                      <div
                        className={`text-xs font-bold tabular-nums ${
                          flash === 'up' ? 'text-emerald-400' : flash === 'down' ? 'text-red-400' : 'text-white'
                        }`}
                      >
                        {price.ask.toFixed(symInfo.digits)}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-md px-2 py-1.5 text-center">
                      <div className="text-[9px] text-zinc-500 mb-0.5">SPREAD</div>
                      <div className="text-xs font-bold tabular-nums text-amber-400">
                        {spreadPips.toFixed(1)}p
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-md px-2 py-2 text-center">
                    <div className="text-[10px] text-zinc-500">Waiting for prices...</div>
                  </div>
                )}

                {/* Lot Size */}
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 block">Lot Size</label>
                  <Input
                    type="number"
                    value={lotSize}
                    onChange={(e) => setLotSize(e.target.value)}
                    step="0.01"
                    min={BROKER_CONFIG.minLotSize}
                    max={BROKER_CONFIG.maxLotSize}
                    className="h-7 text-xs tabular-nums bg-white/5 border-white/10 text-white placeholder:text-zinc-600 px-2"
                  />
                </div>

                {/* SL / TP */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 block">SL (pips)</label>
                    <Input
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      step="1"
                      min="0"
                      className="h-7 text-xs tabular-nums bg-white/5 border-white/10 text-red-400 placeholder:text-zinc-600 px-2"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 block">TP (pips)</label>
                    <Input
                      type="number"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      step="1"
                      min="0"
                      className="h-7 text-xs tabular-nums bg-white/5 border-white/10 text-emerald-400 placeholder:text-zinc-600 px-2"
                    />
                  </div>
                </div>

                {/* BUY / SELL Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleOpenTrade('BUY')}
                    disabled={!isConnected}
                    aria-label="Buy"
                    className="h-8 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold tracking-wider flex items-center justify-center gap-1 transition-colors"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    BUY
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleOpenTrade('SELL')}
                    disabled={!isConnected}
                    aria-label="Sell"
                    className="h-8 rounded-md bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold tracking-wider flex items-center justify-center gap-1 transition-colors"
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    SELL
                  </motion.button>
                </div>

                {/* Open Positions Mini-List */}
                {openTrades.length > 0 && (
                  <div>
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1.5">
                      Open Positions ({openTrades.length})
                    </div>
                    <div className="space-y-1 max-h-[96px] overflow-y-auto custom-scrollbar">
                      {visibleTrades.map((trade) => {
                        const tradeInfo = SYMBOL_INFO[trade.symbol];
                        return (
                          <div
                            key={trade.id}
                            className="flex items-center justify-between bg-white/5 rounded-md px-2 py-1.5 group"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                                  trade.direction === 'BUY'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}
                              >
                                {trade.direction}
                              </span>
                              <span className="text-[10px] text-zinc-400 tabular-nums truncate">
                                {tradeInfo.name.replace('/', '')}
                              </span>
                              <span className="text-[9px] text-zinc-600 tabular-nums">
                                {trade.lotSize}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] font-semibold tabular-nums ${
                                  trade.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
                              </span>
                              <button
                                onClick={() => closeTrade(trade.id)}
                                aria-label="Close trade"
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all text-zinc-500 hover:text-zinc-300"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {openTrades.length > 3 && (
                        <button
                          onClick={() => { setActiveTab('trading'); setIsOpen(false); }}
                          className="w-full text-center text-[9px] text-zinc-500 hover:text-zinc-300 py-1 transition-colors"
                        >
                          +{openTrades.length - 3} more...
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Go to Trading link */}
              <div className="border-t border-white/10 px-3 py-2">
                <button
                  onClick={() => { setActiveTab('trading'); setIsOpen(false); }}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors w-full justify-center group"
                >
                  <span>Go to Trading</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB Button */}
        <motion.button
          data-fab="true"
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="relative w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition-colors flex items-center justify-center"
          aria-label={isOpen ? 'Close quick trade' : 'Open quick trade'}
        >
          {isOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Zap className="w-5 h-5" />
          )}

          {/* Trade count badge */}
          {tradeCount > 0 && !isOpen && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px] font-bold bg-red-500 text-white border-0 flex items-center justify-center rounded-full">
              {tradeCount}
            </Badge>
          )}

          {/* Emerald glow ring */}
          <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" style={{ animationDuration: '2s' }} />
        </motion.button>
      </div>
    </>
  );
}

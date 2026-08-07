'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { io, Socket } from 'socket.io-client';
import { SYMBOLS, type Symbol, type PriceTick } from '@/lib/types';

/**
 * Hook to connect to the live price-feed Socket.IO mini-service (port 3003).
 * Only activates when priceFeedMode === 'live' in the store.
 * When 'simulated', the existing use-price-simulator hook handles prices.
 */
export function useLivePriceFeed() {
  const priceFeedMode = useTradingStore((s) => s.priceFeedMode);
  const wsPort = useTradingStore((s) => s.brokerConfig.wsPort);
  const setPrices = useTradingStore((s) => s.setPrices);
  const setConnected = useTradingStore((s) => s.setConnected);
  const setConnectionStatus = useTradingStore((s) => s.setConnectionStatus);
  const setMarketConditions = useTradingStore((s) => s.setMarketConditions);
  const updatePriceHistory = useTradingStore((s) => s.updatePriceHistory);
  const setIndicatorValues = useTradingStore((s) => s.setIndicatorValues);
  const addSignal = useTradingStore((s) => s.addSignal);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    setConnectionStatus('connecting');

    const socket = io('/?XTransformPort=' + wsPort, {
      transports: ['websocket', 'polling'],
      reconnection: false, // we handle reconnection ourselves
      timeout: 5000,
    });

    socket.on('connect', () => {
      setConnectionStatus('connected');
      setConnected(true);
      // Server expects individual string per symbol, not an object
      for (const sym of SYMBOLS) {
        socket.emit('subscribe', sym);
      }
    });

    // Server emits 'prices' (plural) — array of ticks for all symbols
    socket.on('prices', (ticks: Array<{ symbol: string; bid: number; ask: number; spread: number; timestamp: number; high: number; low: number; change: number; changePercent: number }>) => {
      const mapped: PriceTick[] = ticks.map((t) => ({
        symbol: t.symbol as Symbol,
        bid: t.bid,
        ask: t.ask,
        spread: t.spread,
        timestamp: t.timestamp,
        high: t.high,
        low: t.low,
        change: t.change,
        changePercent: t.changePercent,
      }));
      setPrices(mapped);
    });

    // Server emits 'candles:SYM' per symbol
    for (const sym of SYMBOLS) {
      socket.on(`candles:${sym}`, (candles: any[]) => {
        updatePriceHistory(sym as Symbol, candles);
      });
    }

    // Server emits 'indicators:SYM' per symbol
    for (const sym of SYMBOLS) {
      socket.on(`indicators:${sym}`, (indicators: Record<string, number>) => {
        setIndicatorValues(sym, indicators);
      });
    }

    // Server emits 'signal' for new trading signals
    socket.on('signal', (signal: any) => {
      addSignal({
        id: signal.id,
        symbol: signal.symbol as Symbol,
        direction: signal.direction,
        confidence: signal.confidence,
        strategy: signal.strategy,
        marketCondition: signal.marketCondition,
        entryPrice: signal.entryPrice,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        riskReward: signal.riskReward,
        aiAnalysis: signal.aiAnalysis,
        isExecuted: false,
        createdAt: new Date().toISOString(),
      });
    });

    // Server emits 'marketConditions' for all symbols
    socket.on('marketConditions', (conditions: Record<string, string>) => {
      setMarketConditions(conditions as any);
    });

    // Server emits 'session:change' on session transitions
    socket.on('session:change', (data: { name: string; volatilityMultiplier: number }) => {
      // Session data available for future UI integration
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setConnectionStatus('error');
      setConnected(false);
    });

    socket.on('error', (data: { code: string; message: string }) => {
      console.error('[PriceFeed Error]', data.code, data.message);
    });

    socketRef.current = socket;
  }, [wsPort, setPrices, setConnected, setConnectionStatus, updatePriceHistory, setMarketConditions, setIndicatorValues, addSignal]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnectionStatus('disconnected');
    setConnected(false);
  }, [setConnected, setConnectionStatus]);

  useEffect(() => {
    if (priceFeedMode === 'live') {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [priceFeedMode, connect, disconnect]);

  // Auto-reconnect on error after 5s
  const connectionStatus = useTradingStore((s) => s.connectionStatus);
  useEffect(() => {
    if (priceFeedMode === 'live' && connectionStatus === 'error') {
      reconnectTimer.current = setTimeout(() => {
        connect();
      }, 5000);
    }
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [priceFeedMode, connectionStatus, connect]);

  return { connect, disconnect };
}

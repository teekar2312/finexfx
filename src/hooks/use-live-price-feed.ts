'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, type Symbol, type PriceTick } from '@/lib/types';
import type { Socket } from 'socket.io-client';

/**
 * Hook to connect to the live price-feed Socket.IO mini-service (port 3003).
 * Only activates when priceFeedMode === 'live' in the store.
 * When 'simulated', the existing use-price-simulator hook handles prices.
 *
 * N1 fix: Uses .then() pattern instead of top-level await to avoid
 * requiring the useCallback to be async (which would break useEffect deps).
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

    // Dynamic import — avoids bundling socket.io-client for SSR / simulated mode
    import('socket.io-client').then(({ io }) => {
      const socket = io('/?XTransformPort=' + wsPort, {
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: 5000,
      });

      socket.on('connect', () => {
        setConnectionStatus('connected');
        setConnected(true);
        for (const sym of SYMBOLS) {
          socket.emit('subscribe', sym);
        }
      });

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

      for (const sym of SYMBOLS) {
        socket.on(`candles:${sym}`, (candles: any[]) => {
          updatePriceHistory(sym as Symbol, candles);
        });
      }

      for (const sym of SYMBOLS) {
        socket.on(`indicators:${sym}`, (indicators: Record<string, number>) => {
          setIndicatorValues(sym, indicators);
        });
      }

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

      socket.on('marketConditions', (conditions: Record<string, string>) => {
        setMarketConditions(conditions as any);
      });

      socket.on('session:change', (_data: { name: string; volatilityMultiplier: number }) => {
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
    }).catch((err) => {
      console.error('[PriceFeed] Failed to load socket.io-client:', err);
      setConnectionStatus('error');
      setConnected(false);
    });
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

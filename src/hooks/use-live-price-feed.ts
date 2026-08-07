'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { io, Socket } from 'socket.io-client';
import type { Symbol } from '@/lib/types';

/**
 * Hook to connect to the live price-feed WebSocket mini-service.
 * Only activates when priceFeedMode === 'live' in the store.
 * When 'simulated', the existing use-price-simulator hook handles prices.
 */
export function useLivePriceFeed() {
  const priceFeedMode = useTradingStore((s) => s.priceFeedMode);
  const wsPort = useTradingStore((s) => s.brokerConfig.wsPort);
  const setPrices = useTradingStore((s) => s.setPrices);
  const setConnected = useTradingStore((s) => s.setConnected);
  const setConnectionStatus = useTradingStore((s) => s.setConnectionStatus);
  const updatePriceHistory = useTradingStore((s) => s.updatePriceHistory);
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
      // Subscribe to all symbols
      socket.emit('subscribe', { symbols: ['EURUSD', 'USDJPY', 'GBPUSD', 'XAUUSD'] });
    });

    socket.on('price', (data: { symbol: string; bid: number; ask: number; spread: number; timestamp: number; high: number; low: number; change: number; changePercent: number }) => {
      const sym = data.symbol as Symbol;
      setPrices([{
        symbol: sym,
        bid: data.bid,
        ask: data.ask,
        spread: data.spread,
        timestamp: data.timestamp,
        high: data.high,
        low: data.low,
        change: data.change,
        changePercent: data.changePercent,
      }]);
    });

    socket.on('candles', (data: { symbol: string; candles: any[] }) => {
      updatePriceHistory(data.symbol as Symbol, data.candles);
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setConnectionStatus('error');
      setConnected(false);
    });

    socket.on('session', (data: { session: string; volatilityMultiplier: number }) => {
      // Could update UI with current session info
    });

    socketRef.current = socket;
  }, [wsPort, setPrices, setConnected, setConnectionStatus, updatePriceHistory]);

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
  useEffect(() => {
    const status = useTradingStore.getState().connectionStatus;
    if (priceFeedMode === 'live' && status === 'error') {
      reconnectTimer.current = setTimeout(() => {
        connect();
      }, 5000);
    }
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [priceFeedMode, connect, wsPort]);

  return { connect, disconnect };
}

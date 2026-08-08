'use client';

import { useEffect, useRef } from 'react';
import { useTradingStore } from '@/store/trading-store';

/**
 * Synchronizes the Zustand store with the database on mount.
 * Loads account balance, trades, and risk settings from the API.
 * This addresses audit finding H3 — client state / DB desynchronization.
 */
export function useSyncWithDb() {
  const isInitialLoad = useRef(true);

  const setOpenTrades = useTradingStore((s) => s.setOpenTrades);
  const setBalance = useTradingStore((s) => s.setBalance);
  const setEquity = useTradingStore((s) => s.setEquity);
  const setFreeMargin = useTradingStore((s) => s.setFreeMargin);
  const setMargin = useTradingStore((s) => s.setMargin);
  const setDailyPnl = useTradingStore((s) => s.setDailyPnl);
  const setTotalPnl = useTradingStore((s) => s.setTotalPnl);
  const setRiskSettings = useTradingStore((s) => s.setRiskSettings);

  useEffect(() => {
    if (!isInitialLoad.current) return;
    isInitialLoad.current = false;

    // Load account data from DB
    fetch('/api/account')
      .then((r) => r.json())
      .then((data) => {
        if (data.balance !== undefined) {
          setBalance(data.balance);
          setEquity(data.equity);
          setFreeMargin(data.freeMargin);
          setMargin(data.margin);
          setDailyPnl(data.dailyPnl);
          setTotalPnl(data.totalPnl);
        }
      })
      .catch(() => { /* silent — use store defaults */ });

    // Load trades from DB
    fetch('/api/trades')
      .then((r) => r.json())
      .then((data) => {
        if (data.openTrades) {
          setOpenTrades(
            data.openTrades.map((t: any) => ({
              ...t,
              openedAt: t.openedAt,
              closedAt: t.closedAt ?? undefined,
            }))
          );
        }
      })
      .catch(() => { /* silent */ });

    // Load risk settings from DB
    fetch('/api/risk')
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          const { id, updatedAt, isDefault, ...settings } = data;
          setRiskSettings(settings);
        }
      })
      .catch(() => { /* silent */ });
  }, []);
}

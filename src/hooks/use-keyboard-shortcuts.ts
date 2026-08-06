'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useTradingStore, type TabId } from '@/store/trading-store';
import { SYMBOL_INFO, BROKER_CONFIG } from '@/lib/types';

const TAB_MAP: Record<string, TabId> = {
  '1': 'dashboard',
  '2': 'trading',
  '3': 'analysis',
  '4': 'indicators',
  '5': 'news',
  '6': 'risk',
  '7': 'backtesting',
  '8': 'journal',
  '9': 'analytics',
  '0': 'settings',
};

const TAB_LABELS: Record<string, string> = {
  '1': 'Dashboard',
  '2': 'Trading',
  '3': 'Analysis',
  '4': 'Indicators',
  '5': 'News',
  '6': 'Risk',
  '7': 'Backtesting',
  '8': 'Journal',
  '9': 'Analytics',
  '0': 'Settings',
};

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable) return true;
  if (el.closest('[contenteditable="true"]')) return true;
  return false;
}

interface UseKeyboardShortcutsOptions {
  showShortcutsHelp: boolean;
  setShowShortcutsHelp: (show: boolean) => void;
}

export function useKeyboardShortcuts({ showShortcutsHelp, setShowShortcutsHelp }: UseKeyboardShortcutsOptions) {
  const storeRef = useRef(useTradingStore.getState);

  // Keep storeRef up to date without re-registering the listener
  useEffect(() => {
    const unsub = useTradingStore.subscribe((state) => {
      storeRef.current = () => state;
    });
    return unsub;
  }, []);

  const showHelpRef = useRef(showShortcutsHelp);
  const setShowHelpRef = useRef(setShowShortcutsHelp);

  useEffect(() => {
    showHelpRef.current = showShortcutsHelp;
    setShowHelpRef.current = setShowShortcutsHelp;
  });

  const quickTradeOpenRef = useRef(false);

  const executeTrade = useCallback((direction: 'BUY' | 'SELL') => {
    const state = storeRef.current();
    const { selectedSymbol, prices, isConnected, addTrade, addNotification, riskSettings } = state;
    const price = prices[selectedSymbol];

    if (!price || !isConnected) {
      addNotification({ type: 'error', title: 'Cannot Trade', message: 'Not connected or no price data' });
      return;
    }

    const entryPrice = direction === 'BUY' ? price.ask : price.bid;
    const pipSize = SYMBOL_INFO[selectedSymbol].pipSize;
    const slPips = riskSettings.stopLossPips;
    const tpPips = riskSettings.takeProfitPips;
    const lotSize = 0.01;

    const trade = {
      id: `trade-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      symbol: selectedSymbol,
      direction,
      lotSize,
      entryPrice,
      currentPrice: entryPrice,
      stopLoss: direction === 'BUY'
        ? entryPrice - slPips * pipSize
        : entryPrice + slPips * pipSize,
      takeProfit: direction === 'BUY'
        ? entryPrice + tpPips * pipSize
        : entryPrice - tpPips * pipSize,
      isTrailingStop: false,
      trailingStop: undefined,
      pips: 0,
      profit: 0,
      commission: BROKER_CONFIG.commission * lotSize,
      spread: price.spread,
      swap: 0,
      status: 'open' as const,
      openedAt: new Date().toISOString(),
    };

    addTrade(trade);
  }, []);

  const clickQuickTradeFab = useCallback(() => {
    const fab = document.querySelector('[data-fab]') as HTMLElement | null;
    if (fab) fab.click();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip shortcuts when user is typing in an input/textarea/contenteditable
      if (isInputFocused()) return;

      // Escape → close any open modal/dialog/QuickTradePanel/help
      if (e.key === 'Escape') {
        e.preventDefault();

        // Close shortcuts help overlay first
        if (showHelpRef.current) {
          setShowHelpRef.current(false);
          return;
        }

        // Close QuickTradePanel if we opened it via keyboard
        if (quickTradeOpenRef.current) {
          clickQuickTradeFab();
          quickTradeOpenRef.current = false;
          return;
        }

        // Close any Radix dialog (shadcn)
        const dialogClose = document.querySelector('[data-radix-dialog-close]') as HTMLElement | null;
        if (dialogClose) {
          dialogClose.click();
          return;
        }

        // Close any Radix sheet
        const sheetClose = document.querySelector('[data-radix-sheet-close]') as HTMLElement | null;
        if (sheetClose) {
          sheetClose.click();
          return;
        }

        return;
      }

      // ? (Shift+/) → toggle keyboard shortcuts help overlay
      if (e.key === '?') {
        e.preventDefault();
        setShowHelpRef.current(!showHelpRef.current);
        return;
      }

      // Ctrl+1 through Ctrl+0 (or Alt+1 through Alt+0) → switch tabs
      if ((e.ctrlKey || e.altKey) && TAB_MAP[e.key]) {
        e.preventDefault();
        const tab = TAB_MAP[e.key];
        const label = TAB_LABELS[e.key];
        const state = storeRef.current();
        state.setActiveTab(tab);
        state.addNotification({
          type: 'info',
          title: `Switched to ${label}`,
          message: `Tab ${e.key}`,
        });
        return;
      }

      // B → Open QuickTradePanel if closed, or execute BUY on selected symbol
      if (e.key === 'b' || e.key === 'B') {
        // Skip if modifier keys are held (e.g. Ctrl+B for bookmark)
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        e.preventDefault();

        if (quickTradeOpenRef.current) {
          // Panel is open → execute BUY
          executeTrade('BUY');
          clickQuickTradeFab();
          quickTradeOpenRef.current = false;
        } else {
          // Panel is closed → open it
          clickQuickTradeFab();
          quickTradeOpenRef.current = true;
        }
        return;
      }

      // S → Execute SELL on selected symbol
      if (e.key === 's' || e.key === 'S') {
        // Skip if modifier keys are held (e.g. Ctrl+S for save)
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        e.preventDefault();
        executeTrade('SELL');
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [executeTrade, clickQuickTradeFab]);
}

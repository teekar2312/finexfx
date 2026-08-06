import { create } from 'zustand';
import type { PriceTick, Trade, TradingSignal, NewsItem, EconomicEvent, RiskSettings, BacktestResult, Symbol, MarketCondition, IndicatorConfig } from '@/lib/types';
import { SYMBOLS, BROKER_CONFIG } from '@/lib/types';
import { playSound } from '@/lib/sounds';

type TabId = 'dashboard' | 'trading' | 'analysis' | 'indicators' | 'news' | 'risk' | 'backtesting' | 'settings' | 'errors';

interface TradingState {
  // Navigation
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Prices
  prices: Record<Symbol, PriceTick>;
  setPrices: (prices: PriceTick[]) => void;
  selectedSymbol: Symbol;
  setSelectedSymbol: (sym: Symbol) => void;
  priceHistory: Record<Symbol, { time: number; open: number; high: number; low: number; close: number; volume: number }[]>;
  updatePriceHistory: (symbol: Symbol, candles: any[]) => void;

  // Market Conditions
  marketConditions: Record<string, MarketCondition>;
  setMarketConditions: (conditions: Record<string, MarketCondition>) => void;

  // Indicators
  indicatorValues: Record<string, Record<string, number>>;
  setIndicatorValues: (symbol: string, values: Record<string, number>) => void;
  indicatorConfigs: IndicatorConfig[];
  setIndicatorConfigs: (configs: IndicatorConfig[]) => void;

  // Trades
  openTrades: Trade[];
  closedTrades: Trade[];
  setOpenTrades: (trades: Trade[]) => void;
  addTrade: (trade: Trade) => void;
  updateTrade: (id: string, updates: Partial<Trade>) => void;
  closeTrade: (id: string) => void;

  // Signals
  signals: TradingSignal[];
  addSignal: (signal: TradingSignal) => void;
  clearSignals: () => void;

  // News
  newsItems: NewsItem[];
  setNewsItems: (items: NewsItem[]) => void;
  economicEvents: EconomicEvent[];
  setEconomicEvents: (events: EconomicEvent[]) => void;

  // Alerts
  priceAlerts: Array<{ id: string; symbol: Symbol; condition: string; price: number; isActive: boolean; message?: string }>;
  addPriceAlert: (alert: any) => void;
  removePriceAlert: (id: string) => void;
  togglePriceAlert: (id: string) => void;

  // Account
  accountType: 'live' | 'demo';
  setAccountType: (type: 'live' | 'demo') => void;
  balance: number;
  equity: number;
  freeMargin: number;
  margin: number;
  dailyPnl: number;
  totalPnl: number;
  isAutoTrading: boolean;
  setAutoTrading: (auto: boolean) => void;
  updateAccountPnl: (tradePnl: number) => void;

  // Risk
  riskSettings: RiskSettings;
  setRiskSettings: (settings: Partial<RiskSettings>) => void;
  todayRiskUsed: number;
  todayTradeCount: number;

  // Backtesting
  backtestResults: BacktestResult[];
  setBacktestResults: (results: BacktestResult[]) => void;
  isBacktesting: boolean;
  setIsBacktesting: (running: boolean) => void;

  // Error Logs
  errorLogs: Array<{ id: string; level: string; source: string; message: string; timestamp: string; resolved: boolean }>;
  addErrorLog: (log: any) => void;
  clearResolvedLogs: () => void;

  // Position Sizing
  suggestedLotSize: number;
  setSuggestedLotSize: (size: number) => void;

  // Connection
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // Notifications
  notifications: Array<{ id: string; type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string; timestamp: number }>;
  addNotification: (notif: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }) => void;
  removeNotification: (id: string) => void;
}

export const useTradingStore = create<TradingState>((set, get) => ({
  // Navigation
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Prices
  prices: {} as Record<Symbol, PriceTick>,
  setPrices: (ticks) => {
    const priceMap = { ...get().prices };
    ticks.forEach((tick) => {
      priceMap[tick.symbol as Symbol] = tick as PriceTick;
    });
    set({ prices: priceMap });
  },
  selectedSymbol: 'EURUSD',
  setSelectedSymbol: (sym) => set({ selectedSymbol: sym }),
  priceHistory: {} as any,
  updatePriceHistory: (symbol, candles) => {
    const history = { ...get().priceHistory };
    const existing = history[symbol] || [];
    if (candles.length === 1) {
      existing.push(candles[0]);
      if (existing.length > 200) existing.shift();
    } else {
      history[symbol] = candles;
      set({ priceHistory: history });
      return;
    }
    history[symbol] = existing;
    set({ priceHistory: history });
  },

  // Market Conditions
  marketConditions: {
    EURUSD: 'trending',
    USDJPY: 'range_bound',
    GBPUSD: 'trending',
    XAUUSD: 'high_volatility',
  },
  setMarketConditions: (conditions) => set({ marketConditions: conditions }),

  // Indicators
  indicatorValues: {},
  setIndicatorValues: (symbol, values) => {
    const iv = { ...get().indicatorValues };
    iv[symbol] = values;
    set({ indicatorValues: iv });
  },
  indicatorConfigs: [],
  setIndicatorConfigs: (configs) => set({ indicatorConfigs: configs }),

  // Trades
  openTrades: [],
  closedTrades: [],
  setOpenTrades: (trades) => set({ openTrades: trades }),
  addTrade: (trade) => {
    const { openTrades, riskSettings } = get();
    if (openTrades.length >= riskSettings.maxSimultaneousPositions) {
      get().addNotification({ type: 'warning', title: 'Position Limit', message: `Maximum ${riskSettings.maxSimultaneousPositions} simultaneous positions reached.` });
      return;
    }
    set({ openTrades: [...openTrades, trade] });
    playSound('trade_open');
    get().addNotification({ type: 'success', title: 'Trade Opened', message: `${trade.direction} ${trade.symbol} @ ${trade.entryPrice}` });
  },
  updateTrade: (id, updates) => {
    set({
      openTrades: get().openTrades.map(t => t.id === id ? { ...t, ...updates } : t),
    });
  },
  closeTrade: (id) => {
    const trade = get().openTrades.find(t => t.id === id);
    if (trade) {
      set({
        openTrades: get().openTrades.filter(t => t.id !== id),
        closedTrades: [{ ...trade, status: 'closed' as const, closedAt: new Date().toISOString() }, ...get().closedTrades],
      });
      playSound('trade_close');
      get().addNotification({ type: 'info', title: 'Trade Closed', message: `${trade.symbol} ${trade.direction} closed at ${trade.currentPrice} (P&L: $${trade.profit.toFixed(2)})` });
    }
  },

  // Signals
  signals: [],
  addSignal: (signal) => {
    if (signal.confidence > 75) {
      playSound('signal');
    }
    const signals = [signal, ...get().signals].slice(0, 50);
    set({ signals });
  },
  clearSignals: () => set({ signals: [] }),

  // News
  newsItems: [],
  setNewsItems: (items) => set({ newsItems: items }),
  economicEvents: [],
  setEconomicEvents: (events) => set({ economicEvents: events }),

  // Alerts
  priceAlerts: [],
  addPriceAlert: (alert) => {
    playSound('alert');
    set({ priceAlerts: [...get().priceAlerts, { ...alert, id: `alert-${Date.now()}` }] });
  },
  removePriceAlert: (id) => set({ priceAlerts: get().priceAlerts.filter(a => a.id !== id) }),
  togglePriceAlert: (id) => set({
    priceAlerts: get().priceAlerts.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a),
  }),

  // Account
  accountType: 'demo',
  setAccountType: (type) => set({ accountType: type }),
  balance: 10000,
  equity: 10000,
  freeMargin: 10000,
  margin: 0,
  dailyPnl: 0,
  totalPnl: 0,
  isAutoTrading: false,
  setAutoTrading: (auto) => set({ isAutoTrading: auto }),
  updateAccountPnl: (tradePnl) => {
    const state = get();
    const newDailyPnl = state.dailyPnl + tradePnl;
    const newTotalPnl = state.totalPnl + tradePnl;
    set({
      dailyPnl: newDailyPnl,
      totalPnl: newTotalPnl,
      equity: state.balance + newTotalPnl,
      freeMargin: state.balance + newTotalPnl - state.margin,
    });
  },

  // Risk
  riskSettings: {
    riskPerTrade: 0.5,
    stopLossPips: 10,
    takeProfitPips: 15,
    riskRewardRatio: 1.5,
    maxSimultaneousPositions: 3,
    dailyRiskLimit: 3.0,
    avoidMajorNews: true,
    dailyTargetPercent: 2.0,
    maxDailyTrades: 10,
  },
  setRiskSettings: (settings) => set({ riskSettings: { ...get().riskSettings, ...settings } }),
  todayRiskUsed: 0,
  todayTradeCount: 0,

  // Backtesting
  backtestResults: [],
  setBacktestResults: (results) => set({ backtestResults: results }),
  isBacktesting: false,
  setIsBacktesting: (running) => set({ isBacktesting: running }),

  // Error Logs
  errorLogs: [],
  addErrorLog: (log) => set({ errorLogs: [log, ...get().errorLogs].slice(0, 100) }),
  clearResolvedLogs: () => set({ errorLogs: get().errorLogs.filter(l => !l.resolved) }),

  // Position Sizing
  suggestedLotSize: 0.01,
  setSuggestedLotSize: (size) => set({ suggestedLotSize: size }),

  // Connection
  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),

  // Notifications
  notifications: [],
  addNotification: (notif) => {
    const n = { ...notif, id: `notif-${Date.now()}`, timestamp: Date.now() };
    set({ notifications: [...get().notifications, n].slice(-20) });
    setTimeout(() => get().removeNotification(n.id), 5000);
  },
  removeNotification: (id) => set({ notifications: get().notifications.filter(n => n.id !== id) }),
}));

export type { TabId };

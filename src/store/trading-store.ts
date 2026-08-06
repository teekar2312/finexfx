import { create } from 'zustand';
import type { PriceTick, Trade, TradingSignal, NewsItem, EconomicEvent, RiskSettings, BacktestResult, Symbol, MarketCondition, IndicatorConfig } from '@/lib/types';
import { SYMBOLS, BROKER_CONFIG } from '@/lib/types';
import { playSound } from '@/lib/sounds';

// Trade Journal types
export interface JournalEntry {
  id: string;
  tradeId: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  pips: number;
  pnl: number;
  lotSize: number;
  strategy: string;
  openTime: string;
  closeTime: string;
  duration: string;
  notes: string;
  tags: string[];
  mood: 'great' | 'good' | 'neutral' | 'bad' | 'terrible';
  mistakes: string[];
  lessons: string;
  rating: number;
  screenshotUrl?: string;
  createdAt: string;
}

type TabId = 'dashboard' | 'trading' | 'analysis' | 'indicators' | 'news' | 'risk' | 'backtesting' | 'journal' | 'analytics' | 'settings' | 'errors';

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

  // Trade Journal
  journalEntries: JournalEntry[];
  addJournalEntry: (entry: JournalEntry) => void;
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void;
  deleteJournalEntry: (id: string) => void;
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

  // Trade Journal
  journalEntries: [
    {
      id: 'j-001', tradeId: 't-100', symbol: 'EURUSD', direction: 'BUY',
      entryPrice: 1.0842, exitPrice: 1.0897, pips: 55, pnl: 55.0, lotSize: 0.1,
      strategy: 'EMA Crossover',
      openTime: '2025-01-15T08:30:00Z', closeTime: '2025-01-15T10:15:00Z', duration: '1h 45m',
      notes: 'Clean EMA 9/21 crossover with strong volume confirmation. Entry right at the crossover candle close. Price moved steadily in my favor. Exited at first sign of RSI divergence on M5.',
      tags: ['trending', 'EMA crossover', 'London session', 'textbook'],
      mood: 'great', mistakes: [], lessons: 'Trust the EMA crossover signal when volume confirms. No need to overthink a clean setup.',
      rating: 5, createdAt: '2025-01-15T10:20:00Z',
    },
    {
      id: 'j-002', tradeId: 't-101', symbol: 'GBPUSD', direction: 'SELL',
      entryPrice: 1.2715, exitPrice: 1.2688, pips: 27, pnl: 27.0, lotSize: 0.1,
      strategy: 'MA Ribbon',
      openTime: '2025-01-15T13:05:00Z', closeTime: '2025-01-15T14:22:00Z', duration: '1h 17m',
      notes: 'MA ribbon fan-out confirmed bearish momentum. Entered on pullback to SMA 8. Solid trend continuation trade during London/NY overlap.',
      tags: ['trending', 'MA ribbon', 'overlap session', 'pullback entry'],
      mood: 'good', mistakes: [], lessons: 'Pullback entries to fast MA during ribbon fan-out offer excellent R:R. The ribbon width indicates trend strength.',
      rating: 4, createdAt: '2025-01-15T14:30:00Z',
    },
    {
      id: 'j-003', tradeId: 't-102', symbol: 'USDJPY', direction: 'BUY',
      entryPrice: 149.85, exitPrice: 149.52, pips: -33, pnl: -33.0, lotSize: 0.1,
      strategy: 'Momentum Scalping',
      openTime: '2025-01-16T03:15:00Z', closeTime: '2025-01-16T03:48:00Z', duration: '33m',
      notes: 'Attempted momentum scalp on RSI bounce during Asian session. Price showed initial strength but reversed sharply on a sudden spike. Stopped out.',
      tags: ['scalping', 'Asian session', 'reversal', 'stopped out'],
      mood: 'bad', mistakes: ['Entered during low liquidity Asian session', 'Ignored the wider than normal spread', 'Did not wait for NY session open for USDJPY'],
      lessons: 'USDJPY momentum plays work best during London/NY overlap. Avoid scalping during thin Asian liquidity. Always check spread before entry.',
      rating: 2, createdAt: '2025-01-16T03:55:00Z',
    },
    {
      id: 'j-004', tradeId: 't-103', symbol: 'XAUUSD', direction: 'BUY',
      entryPrice: 2028.50, exitPrice: 2041.30, pips: 128, pnl: 128.0, lotSize: 0.01,
      strategy: 'RMI Trend Sync',
      openTime: '2025-01-16T14:00:00Z', closeTime: '2025-01-16T16:30:00Z', duration: '2h 30m',
      notes: 'Gold broke above key resistance with RMI confirming uptrend and SuperTrend flipping bullish. Rode the breakout for a strong move. Partially closed at +80 pips, let rest run to TP.',
      tags: ['breakout', 'gold', 'trending', 'partial close'],
      mood: 'great', mistakes: [], lessons: 'When multiple trend indicators align on gold (RMI + SuperTrend + breakout), the move can be significant. Partial closing locks in profit while letting winners run.',
      rating: 5, createdAt: '2025-01-16T16:35:00Z',
    },
    {
      id: 'j-005', tradeId: 't-104', symbol: 'EURUSD', direction: 'SELL',
      entryPrice: 1.0910, exitPrice: 1.0935, pips: -25, pnl: -25.0, lotSize: 0.1,
      strategy: 'Pivot Points',
      openTime: '2025-01-17T09:20:00Z', closeTime: '2025-01-17T09:55:00Z', duration: '35m',
      notes: 'Sold at R1 pivot resistance but price broke through. Market shifted to trending mode mid-trade. Should have recognized the breakout and flipped.',
      tags: ['range bound', 'pivot points', 'breakout failure'],
      mood: 'neutral', mistakes: ['Did not switch to breakout strategy when pivots broke', 'Held too long hoping for mean reversion'],
      lessons: 'When a pivot level breaks with volume, respect the breakout. Pivot point strategies work in range-bound markets only. Always have a market condition check before entry.',
      rating: 3, createdAt: '2025-01-17T10:00:00Z',
    },
    {
      id: 'j-006', tradeId: 't-105', symbol: 'GBPUSD', direction: 'BUY',
      entryPrice: 1.2650, exitPrice: 1.2712, pips: 62, pnl: 62.0, lotSize: 0.1,
      strategy: 'Linear Regression',
      openTime: '2025-01-17T15:10:00Z', closeTime: '2025-01-17T17:45:00Z', duration: '2h 35m',
      notes: 'Price bounced off the lower regression channel band perfectly. Bollinger Bands also showed oversold conditions. Entered with tight stop below the channel. Clean ride to the upper band.',
      tags: ['range bound', 'regression channel', 'BB bounce', 'mean reversion'],
      mood: 'great', mistakes: [], lessons: 'Regression channel + BB confluence at the lower band is a high-probability mean reversion setup. The channel provides natural TP targets.',
      rating: 5, createdAt: '2025-01-17T17:50:00Z',
    },
    {
      id: 'j-007', tradeId: 't-106', symbol: 'USDJPY', direction: 'SELL',
      entryPrice: 150.20, exitPrice: 149.90, pips: 30, pnl: 30.0, lotSize: 0.1,
      strategy: 'EMA/RSI Filter',
      openTime: '2025-01-20T08:00:00Z', closeTime: '2025-01-20T09:10:00Z', duration: '1h 10m',
      notes: 'EMA 5 crossed below EMA 13 and RSI was below 50 confirming bearish momentum. Short trade during London open with JPY strength on safe-haven flows.',
      tags: ['trending', 'EMA/RSI', 'London open', 'safe haven'],
      mood: 'good', mistakes: [], lessons: 'EMA/RSI filter works well on M1 for quick momentum trades. Combine with fundamental catalyst (risk-off flow) for higher probability.',
      rating: 4, createdAt: '2025-01-20T09:15:00Z',
    },
    {
      id: 'j-008', tradeId: 't-107', symbol: 'XAUUSD', direction: 'SELL',
      entryPrice: 2035.80, exitPrice: 2042.10, pips: -63, pnl: -63.0, lotSize: 0.01,
      strategy: 'Momentum Scalping',
      openTime: '2025-01-20T12:30:00Z', closeTime: '2025-01-20T13:15:00Z', duration: '45m',
      notes: 'Tried to fade gold rally thinking it was overextended. RSI showed overbought but gold kept pushing higher on inflation data. Classic mistake of picking tops.',
      tags: ['reversal attempt', 'overbought', 'gold', 'fundamental override'],
      mood: 'terrible', mistakes: ['Tried to pick a top in a strong trend', 'Ignored upcoming CPI data release', 'Over-leveraged on a counter-trend trade'],
      lessons: 'Never try to pick tops/bottoms in strong trends. Overbought/oversold indicators stay that way longer than you can stay solvent. Always check the economic calendar before counter-trend trades.',
      rating: 1, createdAt: '2025-01-20T13:20:00Z',
    },
  ],
  addJournalEntry: (entry) => set({ journalEntries: [entry, ...get().journalEntries] }),
  updateJournalEntry: (id, updates) => set({
    journalEntries: get().journalEntries.map(e => e.id === id ? { ...e, ...updates } : e),
  }),
  deleteJournalEntry: (id) => set({ journalEntries: get().journalEntries.filter(e => e.id !== id) }),
}));

export type { TabId };

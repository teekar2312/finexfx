export type Symbol = 'EURUSD' | 'USDJPY' | 'GBPUSD' | 'XAUUSD';

export const SYMBOLS: Symbol[] = ['EURUSD', 'USDJPY', 'GBPUSD', 'XAUUSD'];

export const SYMBOL_INFO: Record<Symbol, {
  name: string;
  pipSize: number;
  digits: number;
  baseCurrency: string;
  quoteCurrency: string;
  category: 'forex' | 'metal';
}> = {
  EURUSD: { name: 'EUR/USD', pipSize: 0.0001, digits: 5, baseCurrency: 'EUR', quoteCurrency: 'USD', category: 'forex' },
  USDJPY: { name: 'USD/JPY', pipSize: 0.01, digits: 3, baseCurrency: 'USD', quoteCurrency: 'JPY', category: 'forex' },
  GBPUSD: { name: 'GBP/USD', pipSize: 0.0001, digits: 5, baseCurrency: 'GBP', quoteCurrency: 'USD', category: 'forex' },
  XAUUSD: { name: 'XAU/USD', pipSize: 0.01, digits: 2, baseCurrency: 'XAU', quoteCurrency: 'USD', category: 'metal' },
};

export const TRADING_SESSIONS = {
  LONDON: { start: 8, end: 17, label: 'London', timezone: 'Europe/London' },
  NEW_YORK: { start: 13, end: 22, label: 'New York', timezone: 'America/New_York' },
  OVERLAP: { start: 13, end: 17, label: 'London/NY Overlap', timezone: 'UTC' },
} as const;

export type MarketCondition = 'trending' | 'range_bound' | 'high_volatility' | 'low_volatility';

export type TradeDirection = 'BUY' | 'SELL';
export type TradeStatus = 'open' | 'closed' | 'pending';
export type AccountType = 'live' | 'demo';
export type StrategyName =
  | 'MA_Ribbon'
  | 'Momentum_Scalping'
  | 'Pivot_Points'
  | 'EMA_Crossover'
  | 'RMI_Trend_Sync'
  | 'Linear_Regression'
  | 'EMA_RSI_Filter';

export interface PriceTick {
  symbol: Symbol;
  bid: number;
  ask: number;
  spread: number;
  timestamp: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
}

export interface PriceHistory {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  id: string;
  symbol: Symbol;
  direction: TradeDirection;
  lotSize: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: number;
  isTrailingStop: boolean;
  pips: number;
  profit: number;
  commission: number;
  spread: number;
  swap: number;
  status: TradeStatus;
  strategy?: string;
  aiConfidence?: number;
  marketCondition?: MarketCondition;
  openedAt: string;
  closedAt?: string;
}

export interface TradingSignal {
  id: string;
  symbol: Symbol;
  direction: TradeDirection | 'HOLD';
  confidence: number;
  strategy: StrategyName;
  marketCondition: MarketCondition;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  riskReward?: number;
  aiAnalysis?: string;
  isExecuted: boolean;
  createdAt: string;
}

export interface NewsItem {
  id: string;
  source: string;
  title: string;
  summary?: string;
  url?: string;
  category?: string;
  impact?: 'high' | 'medium' | 'low';
  currency?: string;
  publishedAt?: string;
}

export interface EconomicEvent {
  id: string;
  event: string;
  currency: string;
  impact: 'high' | 'medium' | 'low';
  actual?: string;
  forecast?: string;
  previous?: string;
  date?: string;
}

export interface RiskSettings {
  riskPerTrade: number;
  stopLossPips: number;
  takeProfitPips: number;
  riskRewardRatio: number;
  maxSimultaneousPositions: number;
  dailyRiskLimit: number;
  avoidMajorNews: boolean;
  dailyTargetPercent: number;
  maxDailyTrades: number;
}

export interface IndicatorConfig {
  name: string;
  enabled: boolean;
  settings: Record<string, any>;
}

export interface BacktestResult {
  id: string;
  name: string;
  symbol: Symbol;
  strategy: StrategyName;
  initialBalance: number;
  finalBalance: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalProfit: number;
  totalLoss: number;
  avgWin: number;
  avgLoss: number;
  equityCurve: { trade: number; equity: number }[];
}

export interface IndicatorValue {
  name: string;
  value: number;
  signal: 'bullish' | 'bearish' | 'neutral';
}

export interface BrokerConfig {
  name: string;
  leverage: number;
  minSpread: number;
  commission: number;
  minLotSize: number;
  maxLotSize: number;
  maxOpenPositions: number;
  marginCall: number;
  stopOut: number;
}

export const BROKER_CONFIG: BrokerConfig = {
  name: 'FINEX Indonesia',
  leverage: 500,
  minSpread: 0.5,
  commission: 1,
  minLotSize: 0.01,
  maxLotSize: 50,
  maxOpenPositions: 200,
  marginCall: 50,
  stopOut: 20,
};

export const STRATEGIES: Record<StrategyName, {
  label: string;
  description: string;
  bestMarketCondition: MarketCondition[];
  timeframe: string;
  indicators: string[];
}> = {
  MA_Ribbon: {
    label: 'Moving Average Ribbon',
    description: '5-8-13 SMAs on 2-min chart for trending markets',
    bestMarketCondition: ['trending'],
    timeframe: 'M2',
    indicators: ['SMA(5)', 'SMA(8)', 'SMA(13)', 'Volume'],
  },
  Momentum_Scalping: {
    label: 'Momentum Scalping',
    description: 'RSI(14) + MACD on 1-min chart for high momentum entries',
    bestMarketCondition: ['trending', 'high_volatility'],
    timeframe: 'M1',
    indicators: ['RSI(14)', 'MACD(12,26,9)', 'Volume'],
  },
  Pivot_Points: {
    label: 'Pivot Points',
    description: 'Daily pivot calculations on 1-2 min charts',
    bestMarketCondition: ['range_bound'],
    timeframe: 'M1-M2',
    indicators: ['Pivot Points', 'S1', 'R1', 'S2', 'R2'],
  },
  EMA_Crossover: {
    label: 'EMA Crossover',
    description: '9/21 EMAs with 20-period ATR on 5-min chart',
    bestMarketCondition: ['trending'],
    timeframe: 'M5',
    indicators: ['EMA(9)', 'EMA(21)', 'ATR(20)', 'Volume'],
  },
  RMI_Trend_Sync: {
    label: 'RMI Trend Sync',
    description: 'RMI + SuperTrend for trend-following entries',
    bestMarketCondition: ['trending'],
    timeframe: 'M5',
    indicators: ['RMI', 'SuperTrend(10,3)', 'Volume'],
  },
  Linear_Regression: {
    label: 'Linear Regression Channels',
    description: 'Regression channel + Bollinger Bands for range trading',
    bestMarketCondition: ['range_bound'],
    timeframe: 'M2-M5',
    indicators: ['Linear Regression', 'Bollinger Bands(20,2)', 'Volume'],
  },
  EMA_RSI_Filter: {
    label: 'EMA/RSI Filter',
    description: 'Fast/Slow EMAs + RSI on 1-min chart',
    bestMarketCondition: ['trending', 'range_bound'],
    timeframe: 'M1',
    indicators: ['EMA(5)', 'EMA(13)', 'RSI(14)', 'Volume'],
  },
};

export const INDICATOR_POOL = [
  { name: 'EMA', category: 'trend', settings: { periods: [9, 21, 50, 200] } },
  { name: 'SMA', category: 'trend', settings: { periods: [5, 8, 13, 20, 50, 100, 200] } },
  { name: 'VWAP', category: 'volume', settings: {} },
  { name: 'SuperTrend', category: 'trend', settings: { period: 10, multiplier: 3 } },
  { name: 'Parabolic SAR', category: 'trend', settings: { step: 0.02, max: 0.2 } },
  { name: 'RSI', category: 'momentum', settings: { period: 14 } },
  { name: 'Stochastic', category: 'momentum', settings: { kPeriod: 14, dPeriod: 3 } },
  { name: 'MACD', category: 'momentum', settings: { fast: 12, slow: 26, signal: 9 } },
  { name: 'Bollinger Bands', category: 'volatility', settings: { period: 20, stdDev: 2 } },
  { name: 'ATR', category: 'volatility', settings: { period: 14 } },
  { name: 'OBV', category: 'volume', settings: {} },
  { name: 'MFI', category: 'volume', settings: { period: 14 } },
  { name: 'Tick Volume', category: 'volume', settings: {} },
  { name: 'Ichimoku Cloud', category: 'trend', settings: { tenkan: 9, kijun: 26, senkou: 52 } },
  { name: 'HMA', category: 'trend', settings: { period: 20 } },
  { name: 'Keltner Channel', category: 'volatility', settings: { ema: 20, multiplier: 1.5 } },
  { name: 'Donchian Channel', category: 'volatility', settings: { period: 20 } },
  { name: 'Linear Regression', category: 'trend', settings: { period: 14 } },
  { name: 'CCI', category: 'momentum', settings: { period: 20 } },
  { name: 'Momentum', category: 'momentum', settings: { period: 10 } },
  { name: 'Williams %R', category: 'momentum', settings: { period: 14 } },
  { name: 'TSI', category: 'momentum', settings: { fast: 13, slow: 25 } },
  { name: 'ROC', category: 'momentum', settings: { period: 12 } },
  { name: 'Schaff Trend Cycle', category: 'momentum', settings: { fast: 23, slow: 50, cycle: 10 } },
  { name: 'Ultimate Oscillator', category: 'momentum', settings: { period1: 7, period2: 14, period3: 28 } },
  { name: 'Standard Deviation', category: 'volatility', settings: { period: 20 } },
  { name: 'Chaikin Volatility', category: 'volatility', settings: { ema: 10, roc: 10 } },
  { name: 'Volatility Ratio', category: 'volatility', settings: { short: 7, long: 14 } },
  { name: 'Volume Profile', category: 'volume', settings: {} },
  { name: 'Accumulation/Distribution', category: 'volume', settings: {} },
] as const;

export const MARKET_CONDITION_CONFIG: Record<MarketCondition, {
  label: string;
  color: string;
  description: string;
  characteristics: string[];
  bestStrategies: StrategyName[];
  riskConsiderations: string[];
}> = {
  trending: {
    label: 'Trending',
    color: 'text-emerald-500',
    description: 'Clear directional movement with consistent momentum',
    characteristics: ['Clear direction', 'Consistent momentum', 'Good volume'],
    bestStrategies: ['MA_Ribbon', 'EMA_Crossover', 'RMI_Trend_Sync', 'Momentum_Scalping'],
    riskConsiderations: ['Don\'t trade counter-trend', 'Use trailing stops', 'Monitor trend strength'],
  },
  range_bound: {
    label: 'Range-Bound',
    color: 'text-amber-500',
    description: 'Price moving between clear support and resistance levels',
    characteristics: ['Clear support/resistance', 'Predictable bounces', 'Regular volume'],
    bestStrategies: ['Pivot_Points', 'Linear_Regression', 'EMA_RSI_Filter'],
    riskConsiderations: ['Avoid breakout attempts', 'Use fixed stops', 'Watch for range expansion'],
  },
  high_volatility: {
    label: 'High Volatility',
    color: 'text-red-500',
    description: 'Large price swings driven by news or heavy volume',
    characteristics: ['Large price swings', 'Heavy volume', 'News-driven moves'],
    bestStrategies: ['Momentum_Scalping'],
    riskConsiderations: ['Reduce position size', 'Use wider stops', 'Quick exits', 'Monitor news events'],
  },
  low_volatility: {
    label: 'Low Volatility',
    color: 'text-slate-500',
    description: 'Small price moves with light volume and tight ranges',
    characteristics: ['Small price moves', 'Light volume', 'Tight ranges'],
    bestStrategies: [],
    riskConsiderations: ['Avoid trading', 'Don\'t force trades', 'Preserve capital', 'Wait for better conditions'],
  },
};

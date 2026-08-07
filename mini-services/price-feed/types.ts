// ═══════════════════════════════════════════════════════════════════
// Shared type definitions for the Price Feed Service
// ═══════════════════════════════════════════════════════════════════════════════

export type MarketCondition = 'trending' | 'range_bound' | 'high_volatility' | 'low_volatility';

export type StrategyName =
  | 'MA_Ribbon'
  | 'Momentum_Scalping'
  | 'Pivot_Points'
  | 'EMA_Crossover'
  | 'RMI_Trend_Sync'
  | 'Linear_Regression'
  | 'EMA_RSI_Filter';

export interface SymbolConfig {
  name: string;
  pipSize: number;
  digits: number;
  basePrice: number;
  prevClose: number;
  volatility: number;
  baseSpreadPips: number;
  maxSpreadPips: number;
  minSpreadPips: number;
  category: 'forex' | 'metal';
  baseCurrency: string;
  quoteCurrency: string;
  lotSize: number;
  tickValue: number;
}

export interface PriceTick {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;      // in pips
  change: number;       // from prevClose
  changePercent: number;
  high: number;         // session high
  low: number;          // session low
  timestamp: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorData {
  [key: string]: number | string;
}

export interface TradingSignal {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strategy: StrategyName;
  marketCondition: MarketCondition;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  aiAnalysis: string;
  isExecuted: boolean;
  createdAt: string;
}

export interface OrderBookLevel {
  price: number;
  volume: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  midPrice: number;
  timestamp: number;
}

export interface TradingSession {
  name: string;
  isActive: boolean;
  volatilityMultiplier: number;
  spreadMultiplier: number;
  opensAt?: string;
  closesAt?: string;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  price: number;
  message?: string;
  isTriggered: boolean;
  triggeredAt?: string;
}

export interface ServerStats {
  uptime: number;
  connectedClients: number;
  totalConnections: number;
  disconnections: number;
  tickCount: number;
  candlesGenerated: number;
  signalsGenerated: number;
  symbols: string[];
  session: TradingSession;
}

export interface SymbolState {
  bid: number;
  ask: number;
  basePrice: number;
  high: number;
  low: number;
  prevClose: number;
  trendBias: number;     // -1 to 1, for mean-reverting trend
  momentum: number;      // accumulated momentum for micro-trends
  candleOpen: number;
  candleHigh: number;
  candleLow: number;
  candleVolume: number;
}

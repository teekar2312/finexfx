/**
 * Zod validation schemas for all API routes.
 * 
 * Uses zod v4 compatible API.
 */
import { z } from 'zod';

// ─── Shared ───────────────────────────────────────────────
export const symbolSchema = z.enum(['EURUSD', 'USDJPY', 'GBPUSD', 'XAUUSD']);
export const directionSchema = z.enum(['BUY', 'SELL']);
export const impactSchema = z.enum(['high', 'medium', 'low']);
export const marketConditionSchema = z.enum(['trending', 'range_bound', 'high_volatility', 'low_volatility']);
export const strategyNameSchema = z.enum([
  'MA_Ribbon',
  'Momentum_Scalping',
  'Pivot_Points',
  'EMA_Crossover',
  'RMI_Trend_Sync',
  'Linear_Regression',
  'EMA_RSI_Filter',
]);

// ─── Trades ───────────────────────────────────────────────
export const createTradeSchema = z.object({
  symbol: symbolSchema,
  direction: directionSchema,
  lotSize: z.number().min(0.01).max(50).optional(),
  entryPrice: z.number().positive(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  strategy: strategyNameSchema.optional(),
  aiConfidence: z.number().min(0).max(100).optional(),
  marketCondition: marketConditionSchema.optional(),
});

// ─── Signals ──────────────────────────────────────────────
export const createSignalSchema = z.object({
  symbol: symbolSchema,
  direction: z.enum(['BUY', 'SELL', 'HOLD']),
  confidence: z.number().min(0).max(100),
  strategy: strategyNameSchema,
  marketCondition: marketConditionSchema.optional().default('trending'),
  entryPrice: z.number().optional().default(0),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
  riskReward: z.number().optional(),
  aiAnalysis: z.string().optional(),
});

// ─── Alerts ───────────────────────────────────────────────
export const createAlertSchema = z.object({
  symbol: symbolSchema,
  condition: z.enum(['above', 'below', 'crosses_above', 'crosses_below']),
  price: z.number().positive(),
  message: z.string().optional(),
});

export const toggleAlertSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean().optional(),
});

// ─── Risk Settings ────────────────────────────────────────
export const updateRiskSettingsSchema = z.object({
  riskPerTrade: z.number().min(0.1).max(10).optional(),
  stopLossPips: z.number().min(1).max(500).optional(),
  takeProfitPips: z.number().min(1).max(1000).optional(),
  riskRewardRatio: z.number().min(0.5).max(10).optional(),
  maxSimultaneousPositions: z.number().int().min(1).max(200).optional(),
  dailyRiskLimit: z.number().min(0.5).max(20).optional(),
  avoidMajorNews: z.boolean().optional(),
  dailyTargetPercent: z.number().min(0.1).max(20).optional(),
  maxDailyTrades: z.number().int().min(1).max(100).optional(),
});

// ─── Account ───────────────────────────────────────────────
export const updateAccountSchema = z.object({
  isAutoTrading: z.boolean().optional(),
  leverage: z.number().int().min(1).max(2000).optional(),
  accountType: z.enum(['live', 'demo']).optional(),
});

// ─── Backtest ─────────────────────────────────────────────
export const runBacktestSchema = z.object({
  strategy: strategyNameSchema,
  symbol: symbolSchema,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ─── Indicators ────────────────────────────────────────────
export const updateIndicatorSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  category: z.enum(['trend', 'momentum', 'volatility', 'volume']).optional().default('trend'),
  enabled: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

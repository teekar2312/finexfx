// ═══════════════════════════════════════════════════════════════════
// Signal Engine — Generates AI-like trading signals with rich analysis.
// Uses market conditions and indicator values for context.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SymbolConfig, TradingSignal, MarketCondition, StrategyName, IndicatorData } from '../types';
import { PriceEngine } from './price-engine';
import { IndicatorEngine } from './indicator-engine';

const STRATEGIES: StrategyName[] = [
  'MA_Ribbon',
  'Momentum_Scalping',
  'Pivot_Points',
  'EMA_Crossover',
  'RMI_Trend_Sync',
  'Linear_Regression',
  'EMA_RSI_Filter',
];

const STRATEGY_DESCRIPTIONS: Record<StrategyName, { bestConditions: MarketCondition[]; timeframe: string; description: string }> = {
  MA_Ribbon: {
    bestConditions: ['trending', 'range_bound'],
    timeframe: 'M5 - H1',
    description: 'Multi-period moving average ribbon identifies trend strength and direction changes through ribbon expansion/compression.'
  },
  Momentum_Scalping: {
    bestConditions: ['trending', 'high_volatility'],
    timeframe: 'M1 - M5',
    description: 'High-frequency momentum detection using RSI, CCI, and Stochastic for quick scalping entries during strong moves.'
  },
  Pivot_Points: {
    bestConditions: ['range_bound', 'low_volatility'],
    timeframe: 'M15 - H4',
    description: 'Classical support/resistance levels from daily pivots. Effective in ranging markets for bounce trades.'
  },
  EMA_Crossover: {
    bestConditions: ['trending'],
    timeframe: 'M5 - H1',
    description: 'Fast EMA (9) crossing slow EMA (21) with volume confirmation. Best in established trends with clean crossovers.'
  },
  RMI_Trend_Sync: {
    bestConditions: ['trending', 'high_volatility'],
    timeframe: 'M5 - M15',
    description: 'Relative Momentum Index synchronized with SuperTrend for trend-aligned momentum entries with tight risk management.'
  },
  Linear_Regression: {
    bestConditions: ['range_bound', 'trending'],
    timeframe: 'M15 - H1',
    description: 'Statistical regression channel with Bollinger Band confluence. Identifies mean reversion and channel trading opportunities.'
  },
  EMA_RSI_Filter: {
    bestConditions: ['trending', 'range_bound'],
    timeframe: 'M1 - M5',
    description: 'Dual EMA direction filter with RSI confirmation. Eliminates false signals by requiring both trend and momentum alignment.'
  },
};

class SignalCache {
  private lastSignals: Map<string, { signal: TradingSignal; timestamp: number }> = new Map();
  private minIntervalMs: number;

  constructor(minIntervalMs = 15000) {
    this.minIntervalMs = minIntervalMs;
  }

  canGenerate(sym: string): boolean {
    const last = this.lastSignals.get(sym);
    if (!last) return true;
    return Date.now() - last.timestamp > this.minIntervalMs;
  }

  set(sym: string, signal: TradingSignal) {
    this.lastSignals.set(sym, { signal, timestamp: Date.now() });
  }

  getLast(sym: string): TradingSignal | undefined {
    return this.lastSignals.get(sym)?.signal;
  }
}

export class SignalEngine {
  private configs: Record<string, SymbolConfig>;
  private priceEngine: PriceEngine;
  private indicatorEngine: IndicatorEngine;
  private cache: SignalCache;
  private signalCount: number = 0;

  constructor(configs: Record<string, SymbolConfig>, priceEngine: PriceEngine, indicatorEngine: IndicatorEngine) {
    this.configs = configs;
    this.priceEngine = priceEngine;
    this.indicatorEngine = indicatorEngine;
    this.cache = new SignalCache(15000);
  }

  generateSignal(sym: string): TradingSignal {
    const cfg = this.configs[sym];
    const mid = this.priceEngine.getMidPrice(sym);
    const condition = this.priceEngine.getMarketCondition(sym);
    const indicators = this.indicatorEngine.getIndicators(sym);

    // ── Strategy selection — prefer strategies matching the market condition ──
    const matchingStrategies = STRATEGIES.filter(s =>
      STRATEGY_DESCRIPTIONS[s].bestConditions.includes(condition)
    );
    const pool = matchingStrategies.length > 0 ? matchingStrategies : STRATEGIES;
    const strategy = pool[Math.floor(Math.random() * pool.length)];

    // ── Direction — use indicator hints ──────────────────────────────
    const rsi = (indicators.RSI_14 as number) || 50;
    const macdHist = (indicators.MACD_Histogram as number) || 0;
    const stochK = (indicators.Stochastic_K as number) || 50;

    let buyBias = 0;
    if (rsi < 40) buyBias += 0.2;
    if (rsi < 30) buyBias += 0.3;
    if (rsi > 60) buyBias -= 0.2;
    if (rsi > 70) buyBias -= 0.3;
    if (macdHist > 0) buyBias += 0.15;
    if (macdHist < 0) buyBias -= 0.15;
    if (stochK < 30) buyBias += 0.1;
    if (stochK > 70) buyBias -= 0.1;

    // Trend bias from price engine
    const state = this.priceEngine.getState(sym);
    buyBias += state.trendBias * 0.3;

    const direction = buyBias > 0.05 ? 'BUY' as const : buyBias < -0.05 ? 'SELL' as const : (Math.random() > 0.5 ? 'BUY' : 'SELL') as const;

    // ── Confidence — higher when indicators agree ────────────────────
    const agreement = Math.abs(buyBias);
    const baseConfidence = 55 + agreement * 40;
    const strategyMatch = matchingStrategies.includes(strategy) ? 5 : -5;
    const confidence = Math.max(52, Math.min(95, baseConfidence + strategyMatch + (Math.random() - 0.5) * 10));

    // ── SL/TP based on ATR ────────────────────────────────────────────
    const atr = (indicators.ATR_14 as number) || cfg.volatility * 20;
    const slPips = Math.max(3, Math.round((atr / cfg.pipSize) * 1.5));
    const tpPips = Math.round(slPips * (1.2 + Math.random() * 0.8)); // 1.2x - 2.0x

    const entryPrice = parseFloat(mid.toFixed(cfg.digits));
    const stopLoss = parseFloat((direction === 'BUY'
      ? mid - slPips * cfg.pipSize
      : mid + slPips * cfg.pipSize
    ).toFixed(cfg.digits));
    const takeProfit = parseFloat((direction === 'BUY'
      ? mid + tpPips * cfg.pipSize
      : mid - tpPips * cfg.pipSize
    ).toFixed(cfg.digits));

    const riskReward = parseFloat((tpPips / slPips).toFixed(2));

    // ── AI Analysis text ──────────────────────────────────────────────
    const analysis = this.generateAnalysis(sym, direction, confidence, strategy, condition, indicators);

    this.signalCount++;
    const signal: TradingSignal = {
      id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      symbol: sym,
      direction,
      confidence: parseFloat(confidence.toFixed(1)),
      strategy,
      marketCondition: condition,
      entryPrice,
      stopLoss,
      takeProfit,
      riskReward,
      aiAnalysis: analysis,
      isExecuted: false,
      createdAt: new Date().toISOString(),
    };

    this.cache.set(sym, signal);
    return signal;
  }

  private generateAnalysis(
    sym: string,
    direction: string,
    confidence: number,
    strategy: string,
    condition: MarketCondition,
    indicators: IndicatorData,
  ): string {
    const rsi = (indicators.RSI_14 as number) || 50;
    const macd = (indicators.MACD_12_26_9 as number) || 0;
    const atr = (indicators.ATR_14 as number) || 0;
    const stochK = (indicators.Stochastic_K as number) || 50;
    const cci = (indicators.CCI_20 as number) || 0;
    const bbUpper = (indicators.Bollinger_Upper as number) || 0;
    const bbLower = (indicators.Bollinger_Lower as number) || 0;
    const adx = Math.abs((indicators.Momentum as number) || 0);

    const rsiSignal = rsi < 30 ? 'OVERSOLD — potential reversal upward' : rsi > 70 ? 'OVERBOUGHT — potential reversal downward' : `${rsi.toFixed(1)} — neutral zone`;
    const stochSignal = stochK < 20 ? 'oversold (bullish divergence possible)' : stochK > 80 ? 'overbought (bearish divergence possible)' : `${stochK.toFixed(1)}`;
    const cciSignal = cci < -100 ? 'oversold territory' : cci > 100 ? 'overbought territory' : 'normal range';
    const bbPosition = `price within Bollinger Bands`; // simplified
    const volatilityDesc = atr > 0 ? `ATR at ${(atr * 100).toFixed(2)} — ${atr > this.configs[sym].volatility * 25 ? 'elevated' : 'moderate'} volatility` : 'ATR normal';

    const centralBank = Math.random() > 0.5
      ? `Hawkish stance detected, supporting ${direction === 'BUY' ? 'upward' : 'downward'} momentum with potential rate hold/hike`
      : `Dovish signals emerging with potential for rate cuts, ${direction === 'BUY' ? 'weakening' : 'strengthening'} the currency`;

    const nfpApproach = Math.random() > 0.6
      ? `NFP data approaching — expect increased volatility and potential whipsaws. ${confidence > 70 ? 'Signal has strong pre-event conviction.' : 'Exercise caution and consider tightening stops.'}`
      : `NFP passed recently — post-data drift ${direction === 'BUY' ? 'favors buyers' : 'favors sellers'} on ${sym}`;

    const cpiTrend = Math.random() > 0.5
      ? 'Inflation easing trend supports risk-on sentiment and dollar weakness'
      : 'Sticky inflation readings may trigger policy tightening, supporting safe-haven flows';

    const geoRisk = Math.random() > 0.7
      ? 'Elevated geopolitical risk driving safe-haven demand — monitor for sudden sentiment shifts'
      : 'Geopolitical environment stable, allowing fundamentals to drive price action';

    const sentiment = confidence > 75
      ? 'Strong conviction signal with multiple indicator confluence — high-probability setup'
      : confidence > 65
        ? 'Moderate conviction with mixed signals — use proper position sizing and risk management'
        : 'Lower confidence — consider waiting for better entry or additional confirmation';

    return `AI Analysis for ${sym}:

═══ SIGNAL SUMMARY ═══
Direction: ${direction} | Confidence: ${confidence.toFixed(1)}%
Strategy: ${strategy} | Market: ${condition}
Entry: ${this.priceEngine.getMidPrice(sym).toFixed(this.configs[sym].digits)}
Risk/Reward: 1:${((indicators.takeProfit || 0) / Math.max(1, Math.abs(indicators.stopLoss || 1))).toFixed(1)}

═══ TECHNICAL ANALYSIS ═══
• RSI(14): ${rsiSignal}
• Stochastic(${stochK.toFixed(1)}): ${stochSignal}
• CCI(20): ${cciSignal}
• MACD: ${macd > 0 ? 'Bullish' : 'Bearish'} momentum (${macd.toFixed(5)})
• Bollinger Bands: ${bbPosition}
• Volatility: ${volatilityDesc}

═══ FUNDAMENTAL FACTORS ═══
• Central Bank: ${centralBank}
• Labor Market: ${nfpApproach}
• Inflation/CPI: ${cpiTrend}
• Geopolitical: ${geoRisk}

═══ ASSESSMENT ═══
${sentiment}
${sym === 'XAUUSD' ? '• Gold: Responding to real yields, USD dynamics, and global risk sentiment' : `• ${sym}: Commodity prices ${direction === 'BUY' ? 'supporting' : 'weighing on'} currency movement`}`;
  }
}

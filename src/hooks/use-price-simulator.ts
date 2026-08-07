'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { SYMBOLS, SYMBOL_INFO, type Symbol, type MarketCondition, type StrategyName, type TradingSignal, type PriceHistory } from '@/lib/types';

interface SymbolState {
  bid: number;
  ask: number;
  basePrice: number;
  high: number;
  low: number;
  prevClose: number;
}

const initialState: Record<string, SymbolState> = {
  EURUSD: { bid: 1.08420, ask: 1.08430, basePrice: 1.08425, high: 1.08450, low: 1.08400, prevClose: 1.08380 },
  USDJPY: { bid: 157.320, ask: 157.330, basePrice: 157.325, high: 157.500, low: 157.200, prevClose: 157.280 },
  GBPUSD: { bid: 1.27150, ask: 1.27160, basePrice: 1.27155, high: 1.27200, low: 1.27100, prevClose: 1.27080 },
  XAUUSD: { bid: 3285.50, ask: 3286.00, basePrice: 3285.75, high: 3290.00, low: 3280.00, prevClose: 3282.50 },
};

const volatilities: Record<string, number> = {
  EURUSD: 0.00008,
  USDJPY: 0.05,
  GBPUSD: 0.00010,
  XAUUSD: 0.80,
};

function randomWalk(current: number, volatility: number): number {
  const change = (Math.random() - 0.49) * volatility * 2;
  return current + change;
}

function generateTick(sym: string, state: SymbolState) {
  const info = SYMBOL_INFO[sym as Symbol];
  const pip = info.pipSize;
  const vol = volatilities[sym];
  const digits = info.digits;

  const newBid = randomWalk(state.bid, vol);
  const spread = (0.5 + Math.random() * 1.5) * pip;
  const newAsk = newBid + spread;

  state.bid = newBid;
  state.ask = newAsk;
  state.high = Math.max(state.high, newAsk);
  state.low = Math.min(state.low, newBid);

  const mid = (newBid + newAsk) / 2;
  const change = mid - state.prevClose;
  const changePercent = (change / state.prevClose) * 100;

  return {
    symbol: sym as Symbol,
    bid: parseFloat(newBid.toFixed(digits)),
    ask: parseFloat(newAsk.toFixed(digits)),
    spread: parseFloat((spread / pip).toFixed(1)),
    change: parseFloat(change.toFixed(digits)),
    changePercent: parseFloat(changePercent.toFixed(4)),
    high: parseFloat(state.high.toFixed(digits)),
    low: parseFloat(state.low.toFixed(digits)),
    timestamp: Date.now(),
  };
}

function generateIndicators(sym: string, state: SymbolState): Record<string, number> {
  const mid = (state.bid + state.ask) / 2;
  const info = SYMBOL_INFO[sym as Symbol];
  const digits = info.digits;
  const vol = volatilities[sym];
  const rsi = 35 + Math.random() * 30;
  const macd = (Math.random() - 0.5) * vol * 5;
  const macdSignal = macd + (Math.random() - 0.5) * vol * 2;
  const atr = vol * (15 + Math.random() * 10);

  return {
    RSI_14: parseFloat(rsi.toFixed(2)),
    MACD_12_26_9: parseFloat(macd.toFixed(digits)),
    MACD_Signal: parseFloat(macdSignal.toFixed(digits)),
    MACD_Histogram: parseFloat((macd - macdSignal).toFixed(digits)),
    Stochastic_K: parseFloat((20 + Math.random() * 60).toFixed(2)),
    Stochastic_D: parseFloat((20 + Math.random() * 60).toFixed(2)),
    ATR_14: parseFloat(atr.toFixed(digits)),
    Bollinger_Upper: parseFloat((mid + atr * 2).toFixed(digits)),
    Bollinger_Middle: parseFloat(mid.toFixed(digits)),
    Bollinger_Lower: parseFloat((mid - atr * 2).toFixed(digits)),
    CCI_20: parseFloat(((Math.random() - 0.5) * 200).toFixed(2)),
    MFI_14: parseFloat((30 + Math.random() * 40).toFixed(2)),
    Williams_R: parseFloat((-(Math.random() * 80)).toFixed(2)),
    EMA_9: parseFloat((mid + (Math.random() - 0.5) * vol * 5).toFixed(digits)),
    EMA_21: parseFloat((mid + (Math.random() - 0.5) * vol * 10).toFixed(digits)),
    SMA_50: parseFloat((mid + (Math.random() - 0.5) * vol * 20).toFixed(digits)),
    SuperTrend: parseFloat((mid + (Math.random() - 0.5) * vol * 8).toFixed(digits)),
    OBV: Math.floor(Math.random() * 100000),
    Volume: Math.floor(1000 + Math.random() * 5000),
    Momentum: parseFloat(((Math.random() - 0.5) * vol * 10).toFixed(digits)),
    ROC_12: parseFloat(((Math.random() - 0.5) * 2).toFixed(4)),
    TSI: parseFloat(((Math.random() - 0.5) * 50).toFixed(2)),
    HMA_20: parseFloat((mid + (Math.random() - 0.5) * vol * 12).toFixed(digits)),
    Keltner_Upper: parseFloat((mid + atr * 1.5).toFixed(digits)),
    Keltner_Lower: parseFloat((mid - atr * 1.5).toFixed(digits)),
    Donchian_Upper: parseFloat((state.high).toFixed(digits)),
    Donchian_Lower: parseFloat((state.low).toFixed(digits)),
    Ichimoku_Tenkan: parseFloat((mid + (Math.random() - 0.5) * vol * 8).toFixed(digits)),
    Ichimoku_Kijun: parseFloat((mid + (Math.random() - 0.5) * vol * 15).toFixed(digits)),
    ParabolicSAR: parseFloat((mid + (Math.random() - 0.5) * vol * 6).toFixed(digits)),
    VWAP: parseFloat((mid + (Math.random() - 0.5) * vol * 3).toFixed(digits)),
    StdDev_20: parseFloat((vol * (3 + Math.random() * 5)).toFixed(digits)),
    ChaikinVol: parseFloat(((Math.random() - 0.5) * 10).toFixed(4)),
    VolRatio: parseFloat((0.5 + Math.random()).toFixed(4)),
    UltimateOsc: parseFloat((30 + Math.random() * 40).toFixed(2)),
    Schaff_STC: parseFloat((20 + Math.random() * 60).toFixed(2)),
    AD_Line: Math.floor(Math.random() * 50000 - 25000),
  };
}

function detectMarketCondition(sym: string): MarketCondition {
  const s = initialState[sym];
  const range = s.high - s.low;
  const vol = volatilities[sym];
  const rangeRatio = range / (vol * 30);
  const trendBias = Math.random();

  if (rangeRatio < 5) return trendBias > 0.6 ? 'trending' : 'low_volatility';
  if (rangeRatio > 20) return 'high_volatility';
  return trendBias > 0.5 ? 'trending' : 'range_bound';
}

const strategies: StrategyName[] = ['MA_Ribbon', 'Momentum_Scalping', 'Pivot_Points', 'EMA_Crossover', 'RMI_Trend_Sync', 'Linear_Regression', 'EMA_RSI_Filter'];

function generateSignal(sym: string, state: SymbolState): TradingSignal {
  const info = SYMBOL_INFO[sym as Symbol];
  const mid = (state.bid + state.ask) / 2;
  const pip = info.pipSize;
  const condition = detectMarketCondition(sym);
  const strategy = strategies[Math.floor(Math.random() * strategies.length)];
  const direction = Math.random() > 0.5 ? 'BUY' : 'SELL';
  const confidence = 55 + Math.random() * 40;
  const slPips = 5 + Math.random() * 10;
  const tpPips = slPips * 1.5;

  const analysis = `AI Analysis for ${sym}:\n\nMarket Condition: ${condition}\nStrategy: ${strategy}\nConfidence: ${confidence.toFixed(1)}%\n\nKey Factors:\n- Central Bank Policy: ${Math.random() > 0.5 ? 'Hawkish stance detected, supporting ' + (direction === 'BUY' ? 'upward' : 'downward') + ' momentum' : 'Dovish signals with potential for rate cuts'}\n- Economic Data: NFP approaching with ${Math.random() > 0.5 ? 'strong' : 'mixed'} labor market signals\n- CPI Trend: ${Math.random() > 0.5 ? 'Inflation easing, supporting risk-on sentiment' : 'Sticky inflation may trigger policy tightening'}\n- Geopolitical: ${Math.random() > 0.7 ? 'Elevated risk aversion due to geopolitical tensions' : 'Stable geopolitical environment'}\n- Market Sentiment: ${confidence > 70 ? 'Strong bullish/bearish conviction' : 'Mixed signals, exercise caution'}\n- Commodity Impact: ${sym === 'XAUUSD' ? 'Gold responding to USD strength and safe-haven demand' : 'Commodity prices ' + (Math.random() > 0.5 ? 'supporting' : 'weighing on') + ' currency movement'}`;

  return {
    id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    symbol: sym as Symbol,
    direction: direction as 'BUY' | 'SELL',
    confidence: parseFloat(confidence.toFixed(1)),
    strategy,
    marketCondition: condition,
    entryPrice: parseFloat(mid.toFixed(info.digits)),
    stopLoss: parseFloat((direction === 'BUY' ? mid - slPips * pip : mid + slPips * pip).toFixed(info.digits)),
    takeProfit: parseFloat((direction === 'BUY' ? mid + tpPips * pip : mid - tpPips * pip).toFixed(info.digits)),
    riskReward: 1.5,
    aiAnalysis: analysis,
    isExecuted: false,
    createdAt: new Date().toISOString(),
  };
}

export function usePriceSimulator() {
  const stateRef = useRef<Record<string, SymbolState>>(JSON.parse(JSON.stringify(initialState)));
  const candleBufferRef = useRef<Record<string, PriceHistory[]>>({});
  const signalTimerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const store = useTradingStore.getState();
    store.setConnected(true);

    // Initialize candle buffers with historical data
    SYMBOLS.forEach((sym) => {
      const candles: PriceHistory[] = [];
      const s = stateRef.current[sym];
      const info = SYMBOL_INFO[sym];
      let price = s.prevClose - (Math.random() * volatilities[sym] * 50);

      for (let i = 99; i >= 0; i--) {
        const open = price;
        const close = randomWalk(open, volatilities[sym] * 3);
        const high = Math.max(open, close) + Math.random() * volatilities[sym] * 2;
        const low = Math.min(open, close) - Math.random() * volatilities[sym] * 2;
        candles.push({
          time: Date.now() - i * 60000,
          open: parseFloat(open.toFixed(info.digits)),
          high: parseFloat(high.toFixed(info.digits)),
          low: parseFloat(low.toFixed(info.digits)),
          close: parseFloat(close.toFixed(info.digits)),
          volume: Math.floor(1000 + Math.random() * 5000),
        });
        price = close;
      }
      candleBufferRef.current[sym] = candles;
      store.updatePriceHistory(sym, candles);
    });

    // Generate initial market conditions
    const conditions: Record<string, MarketCondition> = {};
    SYMBOLS.forEach((sym) => {
      conditions[sym] = detectMarketCondition(sym);
    });
    store.setMarketConditions(conditions);

    // Generate initial indicators
    SYMBOLS.forEach((sym) => {
      const indicators = generateIndicators(sym, stateRef.current[sym]);
      store.setIndicatorValues(sym, indicators);
    });

    // Generate initial signals
    SYMBOLS.forEach((sym) => {
      store.addSignal(generateSignal(sym, stateRef.current[sym]));
    });

    // Price tick interval - 500ms
    const priceInterval = setInterval(() => {
      const s = useTradingStore.getState();
      const ticks = SYMBOLS.map((sym) => generateTick(sym, stateRef.current[sym]));
      s.setPrices(ticks);
    }, 500);

    // Candle update - 5 seconds
    const candleInterval = setInterval(() => {
      const s = useTradingStore.getState();
      SYMBOLS.forEach((sym) => {
        const state = stateRef.current[sym];
        const info = SYMBOL_INFO[sym];
        const vol = volatilities[sym];
        const lastCandle = candleBufferRef.current[sym][candleBufferRef.current[sym].length - 1];
        const open = lastCandle.close;
        const close = randomWalk(open, vol * 2);
        const high = Math.max(open, close) + Math.random() * vol;
        const low = Math.min(open, close) - Math.random() * vol;
        const newCandle = {
          time: Date.now(),
          open: parseFloat(open.toFixed(info.digits)),
          high: parseFloat(high.toFixed(info.digits)),
          low: parseFloat(low.toFixed(info.digits)),
          close: parseFloat(close.toFixed(info.digits)),
          volume: Math.floor(1000 + Math.random() * 5000),
        };
        candleBufferRef.current[sym].push(newCandle);
        if (candleBufferRef.current[sym].length > 200) {
          candleBufferRef.current[sym].shift();
        }
        s.updatePriceHistory(sym, [newCandle]);
      });
    }, 5000);

    // Indicator update - 3 seconds
    const indicatorInterval = setInterval(() => {
      const s = useTradingStore.getState();
      SYMBOLS.forEach((sym) => {
        const indicators = generateIndicators(sym, stateRef.current[sym]);
        s.setIndicatorValues(sym, indicators);
      });
    }, 3000);

    // Market conditions update - 10 seconds
    const conditionInterval = setInterval(() => {
      const s = useTradingStore.getState();
      const conditions: Record<string, MarketCondition> = {};
      SYMBOLS.forEach((sym) => {
        conditions[sym] = detectMarketCondition(sym);
      });
      s.setMarketConditions(conditions);
    }, 10000);

    // Signal generation + auto-trading - 30 seconds
    signalTimerRef.current = setInterval(() => {
      const s = useTradingStore.getState();

      // Auto-trading logic
      if (s.isAutoTrading && s.isConnected) {
        const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        const price = s.prices[sym];
        if (price) {
          const openTrades = s.openTrades;
          const riskSettings = s.riskSettings;

          // Check daily risk limit
          const dailyRiskUsed = s.dailyPnl < 0 ? Math.abs(s.dailyPnl) / s.balance * 100 : 0;
          if (dailyRiskUsed < riskSettings.dailyRiskLimit
            && openTrades.length < riskSettings.maxSimultaneousPositions
            && s.todayTradeCount < riskSettings.maxDailyTrades
            && !openTrades.some(t => t.symbol === sym)) {

            // Generate signal first
            const signal = generateSignal(sym, stateRef.current[sym]);

            // Only execute high-confidence signals (>70%)
            if (signal.confidence >= 70 && signal.marketCondition !== 'low_volatility') {
              const pipSize = SYMBOL_INFO[sym as Symbol].pipSize;
              const slPips = riskSettings.stopLossPips;
              const tpPips = slPips * riskSettings.riskRewardRatio;
              const direction = signal.direction as 'BUY' | 'SELL';
              const entryPrice = direction === 'BUY' ? price.ask : price.bid;

              const trade = {
                id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                symbol: sym as Symbol,
                direction,
                lotSize: 0.01,
                entryPrice,
                currentPrice: entryPrice,
                stopLoss: direction === 'BUY' ? entryPrice - slPips * pipSize : entryPrice + slPips * pipSize,
                takeProfit: direction === 'BUY' ? entryPrice + tpPips * pipSize : entryPrice - tpPips * pipSize,
                isTrailingStop: true,
                trailingStop: slPips,
                pips: 0,
                profit: 0,
                commission: 1,
                spread: price.spread,
                swap: 0,
                status: 'open' as const,
                strategy: signal.strategy,
                aiConfidence: signal.confidence,
                marketCondition: signal.marketCondition as MarketCondition,
                openedAt: new Date().toISOString(),
              };

              s.addSignal(signal);
              s.addTrade(trade);
              s.addNotification({
                type: 'success',
                title: 'Auto Trade Executed',
                message: `${direction} ${sym} @ ${entryPrice.toFixed(SYMBOL_INFO[sym as Symbol].digits)} (${signal.confidence.toFixed(1)}% confidence)`,
              });
              return; // Don't generate another signal this interval
            }

            s.addSignal(signal);
            return;
          }
        }
      }

      // Default: generate a regular signal
      const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      s.addSignal(generateSignal(sym, stateRef.current[sym]));
    }, 30000);

    // Open trade P&L update - 500ms
    const pnlInterval = setInterval(() => {
      const s = useTradingStore.getState();
      const allPrices = s.prices;
      const trades = s.openTrades;

      const tradesToClose: string[] = [];
      const updatedTrades = trades.map((trade) => {
        const price = allPrices[trade.symbol];
        if (!price) return trade;

        const currentPrice = trade.direction === 'BUY' ? price.bid : price.ask;
        const pipSize = SYMBOL_INFO[trade.symbol].pipSize;
        const pipMultiplier = SYMBOL_INFO[trade.symbol].category === 'forex' ? 100000 : 100;
        const pips = trade.direction === 'BUY'
          ? (currentPrice - trade.entryPrice) / pipSize
          : (trade.entryPrice - currentPrice) / pipSize;
        const profit = pips * trade.lotSize * pipMultiplier * pipSize;

        // SL/TP auto-close check (only if SL/TP are set)
        const hitSL = trade.stopLoss != null && (
          trade.direction === 'BUY'
            ? currentPrice <= trade.stopLoss
            : currentPrice >= trade.stopLoss
        );
        const hitTP = trade.takeProfit != null && (
          trade.direction === 'BUY'
            ? currentPrice >= trade.takeProfit
            : currentPrice <= trade.takeProfit
        );

        if (hitSL || hitTP) {
          tradesToClose.push(trade.id);
        }

        return { ...trade, currentPrice, pips, profit };
      });

      // Filter out SL/TP-hit trades before setting open trades (avoid double mutation)
      const remainingTrades = tradesToClose.length > 0
        ? updatedTrades.filter(t => !tradesToClose.includes(t.id))
        : updatedTrades;
      s.setOpenTrades(remainingTrades);

      // Auto-close trades that hit SL/TP
      for (const id of tradesToClose) {
        s.closeTrade(id);
      }
    }, 500);

    return () => {
      clearInterval(priceInterval);
      clearInterval(candleInterval);
      clearInterval(indicatorInterval);
      clearInterval(conditionInterval);
      clearInterval(pnlInterval);
      if (signalTimerRef.current) clearInterval(signalTimerRef.current);
    };
  }, []);
}
